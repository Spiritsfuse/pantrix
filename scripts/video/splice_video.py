"""Replace chosen segments of demo/presentation.mp4 without the raw build assets.

    python scripts/video/splice_video.py scripts/video/splice-plan.json

The finished video and its SRT are the only inputs for the segments that stay.
Segment boundaries come from the SRT: build_video.py starts the first caption of
every segment LEAD seconds after the segment begins, and the caption text is
split deterministically from the narration in segments.json.

Plan file (JSON):
  base_segments  segments.json as it was when the MP4 was built (path, or "git:<ref>")
  voice, rate    narration voice (same as build_video.py)
  plan           ordered list of
                   {"keep": [first, last]}                  inclusive indexes into base_segments
                   {"image": "path.png", "say": "..."}      a new narrated still (repo-relative path)
Needs ffmpeg/ffprobe and, for narration, Windows SAPI (same as build_video.py).
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_video as bv  # noqa: E402

ROOT = bv.ROOT
VIDEO = ROOT / "demo" / "presentation.mp4"
SRT = ROOT / "demo" / "presentation.srt"
STYLE = ("FontName=Segoe UI,FontSize=10,PrimaryColour=&H00ECF6FB,OutlineColour=&H80000000,"
         "BackColour=&H90201A15,BorderStyle=3,Outline=1,Shadow=0,MarginV=10")


def parse_srt(text: str) -> list[tuple[float, float, str]]:
    cues = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = block.strip().splitlines()
        m = re.match(r"(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)", lines[1])
        g = [int(x) for x in m.groups()]
        cues.append((g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000,
                     g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000, " ".join(lines[2:])))
    return cues


def load_base(ref: str) -> dict:
    if ref.startswith("git:"):
        out = bv.sh(["git", "show", f"{ref[4:]}:scripts/video/segments.json"], cwd=ROOT)
        return json.loads(out)
    return json.loads((ROOT / ref).read_text(encoding="utf-8"))


def boundaries(segs: list[dict], cues: list, total: float) -> list[tuple[float, float]]:
    starts, i = [], 0
    for seg in segs:
        n = len(bv.caption_chunks(seg["say"]))
        starts.append(cues[i][0] - bv.LEAD)
        i += n
    if i != len(cues):
        raise SystemExit(f"caption count mismatch: consumed {i} of {len(cues)} cues")
    ends = starts[1:] + [total]
    return list(zip(starts, ends))


def shift(cues, start, end, offset):
    return [(a + offset, b + offset, t) for a, b, t in cues if a >= start - 1e-3 and a < end - 1e-3]


def main(plan_path: str) -> None:
    spec = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    base = load_base(spec["base_segments"])["segments"]
    voice, rate = spec["voice"], spec["rate"]
    backup = Path(tempfile.gettempdir()) / "presentation-before-splice.mp4"
    if not backup.exists():
        shutil.copy(VIDEO, backup)
    src = backup  # always splice from the untouched original
    cues = parse_srt(SRT.read_text(encoding="utf-8")) if not (backup.parent / "presentation-before-splice.srt").exists() \
        else parse_srt((backup.parent / "presentation-before-splice.srt").read_text(encoding="utf-8"))
    if not (backup.parent / "presentation-before-splice.srt").exists():
        shutil.copy(SRT, backup.parent / "presentation-before-splice.srt")
    total = bv.probe_duration(src)
    bounds = boundaries(base, cues, total)

    work = Path(tempfile.mkdtemp(prefix="splice-"))
    parts: list[Path] = []
    out_cues: list[tuple[float, float, str]] = []
    clock = 0.0

    new_items = [it for it in spec["plan"] if "say" in it]
    wavs = []
    for it in new_items:
        key = hashlib.sha1(f"{voice}|{rate}|{it['say']}".encode()).hexdigest()[:16]
        wavs.append(work / f"{key}.wav")
    bv.synthesize([(it["say"], w) for it, w in zip(new_items, wavs)], voice, rate)
    wav_iter = iter(wavs)

    for n, it in enumerate(spec["plan"]):
        part = work / f"part-{n:03}.mp4"
        if "keep" in it:
            first, last = it["keep"]
            start, end = bounds[first][0], bounds[last][1]
            bv.sh(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ss", f"{start:.3f}", "-to", f"{end:.3f}",
                   "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(bv.FPS),
                   "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", str(part)])
            out_cues += shift(cues, start, end, clock - start)
        else:
            wav = next(wav_iter)
            speech = bv.probe_duration(wav)
            duration = max(bv.LEAD + speech + bv.TAIL, 3.0)
            raw = work / f"raw-{n:03}.mp4"
            bv.piece_image(ROOT / it["image"], wav, duration, raw)
            chunks = bv.caption_chunks(it["say"])
            words = sum(len(c.split()) for c in chunks)
            t, local = bv.LEAD, []
            for c in chunks:
                span = speech * len(c.split()) / words
                local.append((t, t + span, c))
                t += span
            (work / "cap.srt").write_text("".join(
                f"{i}\n{bv.srt_time(a)} --> {bv.srt_time(b)}\n{x}\n\n" for i, (a, b, x) in enumerate(local, 1)),
                encoding="utf-8")
            bv.sh(["ffmpeg", "-v", "error", "-y", "-i", raw.name, "-vf", f"subtitles=cap.srt:force_style='{STYLE}'",
                   "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(bv.FPS),
                   "-c:a", "copy", part.name], cwd=work)
            out_cues += [(a + clock, b + clock, x) for a, b, x in local]
        real = bv.probe_duration(part)
        print(f"[{n:02}] {part.name} {real:6.1f}s  {'keep ' + str(it['keep']) if 'keep' in it else it['image']}")
        clock += real
        parts.append(part)

    (work / "list.txt").write_text("".join(f"file '{p.name}'\n" for p in parts), encoding="utf-8")
    final = work / "final.mp4"
    bv.sh(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy",
           "-movflags", "+faststart", final.name], cwd=work)
    shutil.copy(final, VIDEO)
    SRT.write_text("".join(f"{i}\n{bv.srt_time(a)} --> {bv.srt_time(b)}\n{x}\n\n"
                           for i, (a, b, x) in enumerate(out_cues, 1)), encoding="utf-8")
    print(f"wrote {VIDEO.relative_to(ROOT)}: {bv.probe_duration(VIDEO) / 60:.1f} min, {len(out_cues)} captions")


if __name__ == "__main__":
    main(sys.argv[1])
