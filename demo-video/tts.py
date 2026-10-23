import asyncio
import json
import pathlib
import re
import subprocess
import sys

import edge_tts
import imageio_ffmpeg

ROOT = pathlib.Path(__file__).parent
DATA = json.loads((ROOT / "narration.json").read_text(encoding="utf-8"))
OUT = ROOT / "audio"
OUT.mkdir(exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
LEAD = 0.7
GAP = 0.35
TAIL = 0.8


def duration(path: pathlib.Path) -> float:
    proc = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    match = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", proc.stderr)
    if not match:
        raise RuntimeError(f"cannot read duration: {path}")
    return int(match.group(1)) * 3600 + int(match.group(2)) * 60 + float(match.group(3))


async def synth(text: str, path: pathlib.Path, voice: str, rate: str) -> None:
    last = None
    for attempt in range(4):
        try:
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            await communicate.save(str(path))
            if path.exists() and path.stat().st_size > 500:
                return
        except Exception as exc:
            last = exc
        await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"tts failed for {text!r}: {last}")


async def main() -> None:
    voice = DATA["voice"]
    rate = DATA["rate"]
    result = {"voice": voice, "rate": rate, "scenes": {}}
    for scene, lines in DATA["scenes"].items():
        items = []
        for index, text in enumerate(lines, start=1):
            name = f"{scene}_{index:02d}.mp3"
            path = OUT / name
            if not path.exists() or path.stat().st_size < 500:
                await synth(text, path, voice, rate)
            items.append({"index": index, "text": text, "file": f"audio/{name}", "duration": round(duration(path), 3)})
        audio_len = LEAD + sum(item["duration"] for item in items) + GAP * (len(items) - 1) + TAIL
        result["scenes"][scene] = {"lines": items, "audioDuration": round(audio_len, 3)}
        print(f"{scene}: {len(items)} lines, {audio_len:.2f}s")
    (ROOT / "audio" / "timing.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    total = sum(v["audioDuration"] for v in result["scenes"].values())
    print(f"TOTAL narration windows: {total:.2f}s")


asyncio.run(main())
