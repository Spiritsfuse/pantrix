"""Replace the narration audio of demo/presentation.mp4 with a neural voice, keeping video and captions.

    python scripts/video/replace_audio.py [--voice en-IN-PrabhatNeural]

For every segment in scripts/video/segments.json the narration is synthesised with edge-tts
(Microsoft neural voices; the text is sent to the service, nothing else), fitted to the time
window the burned-in captions already occupy (tempo change only when needed, capped), placed
at the segment's start plus the usual lead-in, and muxed over the untouched video stream.
Needs ffmpeg/ffprobe and `pip install edge-tts`.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_video as bv  # noqa: E402
import splice_video as sv  # noqa: E402

ROOT = bv.ROOT
SR = 48000


async def synth(items: list[tuple[str, Path]], voice: str) -> None:
    import edge_tts

    sem = asyncio.Semaphore(4)

    async def one(text: str, path: Path) -> None:
        async with sem:
            for attempt in range(4):
                try:
                    await edge_tts.Communicate(text, voice).save(str(path))
                    return
                except Exception:  # transient network errors
                    await asyncio.sleep(2 * (attempt + 1))
            raise SystemExit(f"TTS failed for: {text[:50]}")

    await asyncio.gather(*(one(t, p) for t, p in items if not p.exists()))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="en-IN-PrabhatNeural")
    args = ap.parse_args()

    segs = json.loads((ROOT / "scripts" / "video" / "segments.json").read_text(encoding="utf-8"))["segments"]
    video = sv.VIDEO
    original = Path(tempfile.gettempdir()) / "presentation-before-audio.mp4"
    if not original.exists():
        shutil.copy(video, original)
    cues = sv.parse_srt(sv.SRT.read_text(encoding="utf-8"))
    total = bv.probe_duration(original)
    bounds = sv.boundaries(segs, cues, total)

    work = Path(tempfile.mkdtemp(prefix="audio-"))
    cache = Path(tempfile.gettempdir()) / "pantrix-tts-cache"
    cache.mkdir(exist_ok=True)
    mp3s = [cache / (hashlib.sha1(f"{args.voice}|{s['say']}".encode()).hexdigest()[:16] + ".mp3") for s in segs]
    asyncio.run(synth([(s["say"], p) for s, p in zip(segs, mp3s)], args.voice))

    # captions of each segment, to know how long the old speech lasted
    idx, speech = 0, []
    for seg in segs:
        n = len(bv.caption_chunks(seg["say"]))
        speech.append(cues[idx + n - 1][1] - cues[idx][0])
        idx += n

    parts = []
    for i, (seg, mp3, (start, end)) in enumerate(zip(segs, mp3s, bounds)):
        length = end - start
        raw = work / f"raw-{i:03}.wav"
        bv.sh(["ffmpeg", "-v", "error", "-y", "-i", str(mp3), "-ar", str(SR), "-ac", "1", str(raw)])
        dur = bv.probe_duration(raw)
        room = length - bv.LEAD - 0.2
        tempo = min(max(dur / speech[i], 0.9), 1.25)
        if dur / tempo > room:
            tempo = min(dur / room, 1.4)
        out = work / f"seg-{i:03}.wav"
        bv.sh(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af",
               f"atempo={tempo:.4f},adelay={int(bv.LEAD * 1000)}:all=1,apad=whole_dur={length:.3f}",
               "-t", f"{length:.3f}", "-ar", str(SR), "-ac", "1", str(out)])
        parts.append(out)
        print(f"[{i:02}] {length:6.1f}s window, speech {dur:5.1f}s -> tempo {tempo:.2f}")

    (work / "list.txt").write_text("".join(f"file '{p.name}'\n" for p in parts), encoding="utf-8")
    track = work / "narration.wav"
    bv.sh(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "list.txt", "-af",
           "loudnorm=I=-17:TP=-2:LRA=9", "-ar", str(SR), str(track)], cwd=work)
    final = work / "final.mp4"
    bv.sh(["ffmpeg", "-v", "error", "-y", "-i", str(original), "-i", str(track), "-map", "0:v", "-map", "1:a",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-shortest", "-movflags", "+faststart",
           str(final)])
    shutil.copy(final, video)
    print(f"wrote {video.relative_to(ROOT)}: {bv.probe_duration(video) / 60:.1f} min, voice {args.voice}")


if __name__ == "__main__":
    main()
