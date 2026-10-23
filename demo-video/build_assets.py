import array
import json
import pathlib
import re
import subprocess
import wave

import imageio_ffmpeg

ROOT = pathlib.Path(__file__).parent
BUILD = ROOT / "build"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
RATE = 48000
TIMELINE = json.loads((BUILD / "timeline.json").read_text(encoding="utf-8"))


def ass_time(value: float) -> str:
    value = max(0.0, value)
    hours = int(value // 3600)
    minutes = int((value % 3600) // 60)
    seconds = value % 60
    return f"{hours}:{minutes:02d}:{seconds:05.2f}"


def wrap(text: str, limit: int = 20) -> str:
    if len(text) <= limit:
        return text
    marks = "，。、；：！？"
    middle = len(text) / 2
    candidates = [i + 1 for i, ch in enumerate(text[:-1]) if ch in marks]
    candidates = [i for i in candidates if 6 <= i <= len(text) - 6 and i <= limit + 4]
    if candidates:
        cut = min(candidates, key=lambda i: abs(i - middle))
        left, right = text[:cut], text[cut:]
        if len(left) <= limit + 4 and len(right) <= limit + 4:
            return left + "\\N" + right
    tokens = re.findall(r"[A-Za-z0-9%+. _\-/]+|.", text)
    lines = []
    current = ""
    for token in tokens:
        if current and len(current) + len(token) > limit:
            lines.append(current)
            current = token.lstrip()
        else:
            current += token
    if current:
        lines.append(current)
    if len(lines) <= 2:
        return "\\N".join(lines)
    mid = len(text) // 2
    return text[:mid] + "\\N" + text[mid:]


def build_ass() -> None:
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Microsoft YaHei,42,&H00FFFFFF,&H00FFFFFF,&H4D000000,&H4D000000,1,0,0,0,100,100,0.4,0,3,9,0,2,140,140,92,1
Style: Chapter,Microsoft YaHei,27,&H00527AE0,&H00527AE0,&H00000000,&H00000000,1,0,0,0,100,100,1.2,0,1,1.1,0,7,86,86,62,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for scene in TIMELINE["scenes"]:
        if scene["chapter"]:
            start = scene["start"] + 0.15
            events.append(f"Dialogue: 1,{ass_time(start)},{ass_time(start + 4.4)},Chapter,,0,0,0,,{scene['chapter']}")
        lines = scene["lines"]
        for index, line in enumerate(lines):
            if scene["id"] == "S11":
                continue
            start = line["start"]
            end = start + line["duration"] - 0.04
            if index + 1 < len(lines):
                end = min(end, lines[index + 1]["start"] - 0.08)
            if end <= start + 0.25:
                end = start + max(0.4, line["duration"])
            events.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Sub,,0,0,0,,{wrap(line['text'])}")
    (BUILD / "subs.ass").write_text(header + "\n".join(events) + "\n", encoding="utf-8")


def decode(path: pathlib.Path, tmp: pathlib.Path) -> array.array:
    subprocess.run([FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", str(path),
                    "-ac", "1", "-ar", str(RATE), "-sample_fmt", "s16", str(tmp)], check=True)
    with wave.open(str(tmp), "rb") as handle:
        data = handle.readframes(handle.getnframes())
    samples = array.array("h")
    samples.frombytes(data)
    return samples


def build_audio() -> None:
    total = TIMELINE["total"]
    total_samples = int(round(total * RATE))
    mix = array.array("h", bytes(total_samples * 2))
    tmp = BUILD / "_line.wav"
    for scene in TIMELINE["scenes"]:
        for line in scene["lines"]:
            samples = decode(ROOT / line["file"], tmp)
            offset = int(round(line["start"] * RATE))
            limit = min(len(samples), total_samples - offset)
            for i in range(limit):
                value = mix[offset + i] + samples[i]
                if value > 32767:
                    value = 32767
                elif value < -32768:
                    value = -32768
                mix[offset + i] = value
    peak = max((abs(v) for v in mix), default=0)
    if peak > 0:
        scale = min(1.0, (32767 * 0.89) / peak)
        if scale < 1.0:
            for i in range(len(mix)):
                mix[i] = int(mix[i] * scale)
    with wave.open(str(BUILD / "narration.wav"), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(mix.tobytes())
    print(f"narration.wav {total:.2f}s peak={peak}")


build_ass()
build_audio()

def srt_time(value: float) -> str:
    value = max(0.0, value)
    hours = int(value // 3600)
    minutes = int((value % 3600) // 60)
    seconds = int(value % 60)
    millis = int(round((value - int(value)) * 1000))
    if millis == 1000:
        seconds += 1
        millis = 0
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def build_srt() -> None:
    blocks = []
    index = 0
    for scene in TIMELINE["scenes"]:
        if scene["id"] == "S11":
            continue
        for line in scene["lines"]:
            index += 1
            start = line["start"]
            end = start + line["duration"] - 0.04
            text = wrap(line["text"]).replace("\\N", "\n")
            blocks.append(f"{index}\n{srt_time(start)} --> {srt_time(end)}\n{text}\n")
    (ROOT / "out").mkdir(exist_ok=True)
    (ROOT / "out" / "zhijing-db-demo.srt").write_text("\n".join(blocks), encoding="utf-8")
    print(f"zhijing-db-demo.srt {index} cues")


build_srt()

