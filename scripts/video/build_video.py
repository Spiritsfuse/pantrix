"""Assemble demo/presentation.mp4 and demo/preview.gif from real project material.

    python scripts/video/build_video.py            # needs ffmpeg/ffprobe; TTS needs Windows

Inputs (all produced from the real system):
  scripts/video/segments.json      order, narration text and visuals
  demo/.work/slides/*.png          slides exported from demo/presentation.pptx
  demo/.work/cards, demo/.work/code   scripts/evidence/render-video-cards.mjs
  demo/.work/clips/*.webm          scripts/evidence/record-walkthrough.mjs (live browser)
  docs/evidence/*.png              rendered terminal transcripts and screenshots

Narration is synthesised with the Windows SAPI voice named in segments.json and
burned in as captions. Nothing is generated that the inputs do not show.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "demo" / ".work"
PIECES = WORK / "pieces"
AUDIO = WORK / "audio"
W, H, FPS = 1920, 1080, 30
BG = "0xefe6d6"
LEAD = 0.5  # seconds of silence before narration starts in each piece
TAIL = 0.9  # seconds after narration ends


def sh(cmd: list[str], **kw) -> str:
    res = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if res.returncode != 0:
        sys.stderr.write(res.stderr[-3000:])
        raise SystemExit(f"command failed: {' '.join(cmd[:6])} ...")
    return res.stdout


def probe_duration(path: Path) -> float:
    out = sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return float(out.strip())


def probe_size(path: Path) -> tuple[int, int]:
    out = sh(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
              "-of", "csv=p=0:s=x", str(path)])
    w, h = out.strip().split("x")
    return int(w), int(h)


def synthesize(items: list[tuple[str, Path]], voice: str, rate: int) -> None:
    """Render every narration line to WAV with one PowerShell/SAPI session."""
    todo = [(t, p) for t, p in items if not p.exists()]
    if not todo:
        return
    with tempfile.TemporaryDirectory() as tmp:
        jobs = Path(tmp) / "jobs.json"
        jobs.write_text(json.dumps([{"text": t, "path": str(p)} for t, p in todo]), encoding="utf-8")
        script = Path(tmp) / "tts.ps1"
        script.write_text(
            "Add-Type -AssemblyName System.Speech\n"
            "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer\n"
            f"$s.SelectVoice('{voice}')\n"
            f"$s.Rate = {rate}\n"
            f"$jobs = Get-Content -Raw -Encoding UTF8 '{jobs}' | ConvertFrom-Json\n"
            "foreach ($j in $jobs) { $s.SetOutputToWaveFile($j.path); $s.Speak($j.text) }\n"
            "$s.SetOutputToNull()\n",
            encoding="utf-8",
        )
        sh(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script)])


def encode_args(duration: float) -> list[str]:
    return ["-t", f"{duration:.3f}", "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart"]


def audio_filter(index: int) -> str:
    ms = int(LEAD * 1000)
    return f"[{index}:a]adelay={ms}|{ms},apad[aout]"


def piece_image(img: Path, wav: Path, duration: float, out: Path) -> None:
    w, h = probe_size(img)
    target_w = min(1840, w) if (w, h) != (W, H) else W
    scaled_h = math.ceil(h * target_w / w / 2) * 2
    if scaled_h <= H - 40 or (w, h) == (W, H):
        vf = (f"[0:v]scale={target_w}:-2:flags=lanczos,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={BG},"
              f"format=yuv420p[vout]")
    else:
        # Tall terminal output: scroll from top to bottom, holding 2 s at each end.
        hold = 2.0
        travel = max(duration - 2 * hold, 1.0)
        vf = (f"[0:v]scale={target_w}:-2:flags=lanczos,pad={W}:ih+40:(ow-iw)/2:20:color={BG},"
              f"crop={W}:{H}:0:'min(max(0,(t-{hold})/{travel}),1)*(ih-{H})',format=yuv420p[vout]")
    sh(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-i", str(img), "-i", str(wav),
        "-filter_complex", f"{vf};{audio_filter(1)}", "-map", "[vout]", "-map", "[aout]", *encode_args(duration), str(out)])


def piece_clip(clip: Path, wav: Path, duration: float, out: Path) -> None:
    clip_len = probe_duration(clip)
    extra = max(0.0, duration - clip_len)
    vf = (f"[0:v]scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={BG},"
          f"fps={FPS},tpad=stop_mode=clone:stop_duration={extra:.3f},format=yuv420p[vout]")
    sh(["ffmpeg", "-v", "error", "-y", "-i", str(clip), "-i", str(wav),
        "-filter_complex", f"{vf};{audio_filter(1)}", "-map", "[vout]", "-map", "[aout]", *encode_args(duration), str(out)])


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def caption_chunks(text: str, max_words: int = 13) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks: list[str] = []
    for sentence in sentences:
        words = sentence.split()
        while words:
            n = len(words) if len(words) <= max_words + 3 else max_words
            chunks.append(" ".join(words[:n]))
            words = words[n:]
    return chunks


def main() -> None:
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg not found")
    spec = json.loads((ROOT / "scripts" / "video" / "segments.json").read_text(encoding="utf-8"))
    PIECES.mkdir(parents=True, exist_ok=True)
    AUDIO.mkdir(parents=True, exist_ok=True)

    segs = spec["segments"]
    wavs = []
    for seg in segs:
        key = hashlib.sha1(f"{spec['voice']}|{spec['rate']}|{seg['say']}".encode()).hexdigest()[:16]
        wavs.append(AUDIO / f"{key}.wav")
    synthesize([(s["say"], p) for s, p in zip(segs, wavs)], spec["voice"], spec["rate"])

    card_no = 0
    pieces: list[Path] = []
    captions: list[tuple[float, float, str]] = []
    clock = 0.0
    for i, (seg, wav) in enumerate(zip(segs, wavs), 1):
        speech = probe_duration(wav)
        duration = max(seg.get("seconds", 0), LEAD + speech + TAIL, 3.0)
        out = PIECES / f"piece-{i:03}.mp4"
        if "card" in seg:
            card_no += 1
            visual = WORK / "cards" / f"card-{card_no:02}.png"
            piece_image(visual, wav, duration, out)
        elif "image" in seg:
            piece_image(ROOT / seg["image"], wav, duration, out)
        else:
            clip = ROOT / seg["clip"]
            duration = max(duration, probe_duration(clip))
            piece_clip(clip, wav, duration, out)
        real = probe_duration(out)
        chunks = caption_chunks(seg["say"])
        total_words = sum(len(c.split()) for c in chunks)
        t = clock + LEAD
        for c in chunks:
            span = speech * len(c.split()) / total_words
            captions.append((t, t + span, c))
            t += span
        clock += real
        pieces.append(out)
        print(f"[{i:02}/{len(segs)}] {out.name} {real:5.1f}s  ({seg.get('image') or seg.get('clip') or 'card'})")

    concat = WORK / "concat.txt"
    concat.write_text("".join(f"file 'pieces/{p.name}'\n" for p in pieces), encoding="utf-8")
    raw = WORK / "presentation-raw.mp4"
    sh(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", raw.name],
       cwd=WORK)

    srt = WORK / "captions.srt"
    srt.write_text("".join(f"{n}\n{srt_time(a)} --> {srt_time(b)}\n{text}\n\n"
                           for n, (a, b, text) in enumerate(captions, 1)), encoding="utf-8")
    style = ("FontName=Segoe UI,FontSize=10,PrimaryColour=&H00ECF6FB,OutlineColour=&H80000000,"
             "BackColour=&H90201A15,BorderStyle=3,Outline=1,Shadow=0,MarginV=10")
    final = ROOT / "demo" / "presentation.mp4"
    sh(["ffmpeg", "-v", "error", "-y", "-i", raw.name, "-vf", f"subtitles=captions.srt:force_style='{style}'",
        "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "copy",
        "-movflags", "+faststart", str(final)], cwd=WORK)
    shutil.copy(srt, ROOT / "demo" / "presentation.srt")

    gif = ROOT / "demo" / "preview.gif"
    app = WORK / "clips" / "app.webm"
    sh(["ffmpeg", "-v", "error", "-y", "-ss", "8", "-t", "14", "-i", str(app), "-vf",
        "fps=8,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer",
        str(gif)])
    print(f"wrote {final.relative_to(ROOT)} ({probe_duration(final) / 60:.1f} min), {gif.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
