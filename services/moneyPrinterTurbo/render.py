"""Adapt MacFlow's validated workspace media to MoneyPrinterTurbo's local renderer."""

from __future__ import annotations

import json
import signal
import subprocess
import sys
from pathlib import Path

if sys.version_info < (3, 11):
    sys.exit(3)

from videoProject import ProjectError, RenderCancelled, VideoProject


def stop_render(_number: int, _frame: object) -> None:
    raise RenderCancelled("Render cancelled")


def run_ffmpeg(tool: str, arguments: list[str], directory: Path) -> None:
    options = ["-nostdin", "-hide_banner", "-loglevel", "error",
               "-filter_threads", "2", "-filter_complex_threads", "2"]
    with subprocess.Popen([tool, *options, *arguments], cwd=directory,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) as process:
        try:
            if process.wait(timeout=240):
                raise ProjectError("FFmpeg could not process the selected media")
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()


def timestamp(seconds: float) -> str:
    whole, milliseconds = divmod(round(seconds * 1000), 1000)
    minutes, second = divmod(whole, 60)
    hours, minute = divmod(minutes, 60)
    return f"{hours:02}:{minute:02}:{second:02},{milliseconds:03}"


def write_captions(directory: Path, scenes: list[dict]) -> bool:
    sections = []
    elapsed = 0.0
    for scene in scenes:
        end = elapsed + scene["duration"]
        line = scene.get("caption", "").strip()
        if line:
            sections.append(f"{len(sections) + 1}\n{timestamp(elapsed)} --> {timestamp(end)}\n{line}\n")
        elapsed = end
    if sections:
        (directory / "captions.srt").write_text("\n".join(sections), encoding="utf-8")
    return bool(sections)


def main() -> None:
    directory = Path(sys.argv[1]).resolve()
    ffmpeg, ffprobe = sys.argv[2:4]
    request = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    project = VideoProject(directory / "project")
    if (project.directory / "project.json").is_file():
        revision = project.revision()["revision_id"]
    else:
        settings = request["settings"]
        scenes = []
        for index, source in enumerate(request["scenes"]):
            footage = source["footage"]
            if source["image"]:
                footage = str(directory / f"still{index}.mp4")
                size = f"{settings['width']}:{settings['height']}"
                run_ffmpeg(ffmpeg, [
                    "-y", "-protocol_whitelist", "file,pipe", "-f", "image2",
                    "-pattern_type", "none", "-loop", "1", "-i", source["footage"],
                    "-t", str(source["duration"]), "-vf",
                    f"scale={size}:force_original_aspect_ratio=decrease,pad={size}:(ow-iw)/2:(oh-ih)/2,setsar=1",
                    "-r", "30", "-threads", "2", "-c:v", "libx264", "-preset", "ultrafast",
                    "-pix_fmt", "yuv420p", footage,
                ], directory)
            scenes.append({"id": f"scene{index}", "footage": footage, "duration": source["duration"]})
        manifest = {"project_id": "macflow", "settings": settings, "scenes": scenes}
        if request.get("bgm"):
            manifest["bgm"] = request["bgm"]
        revision = project.create_revision(manifest, ffmpeg=ffmpeg, ffprobe=ffprobe)["revision_id"]
    result = project.render(revision, retry=True, ffmpeg=ffmpeg, ffprobe=ffprobe, stage_timeout=240)
    export = result["export"]["path"]
    captions = write_captions(directory, request["scenes"])
    narration = request.get("narration")
    if narration or captions:
        args = ["-y", "-protocol_whitelist", "file,pipe", "-i", export]
        if narration:
            args += [
                "-protocol_whitelist", "file,pipe", "-format_whitelist",
                "mov,matroska,wav,mp3,flac,ogg,aac", "-i", narration, "-filter_complex",
                "[0:a][1:a]amix=inputs=2:duration=first:normalize=0[a]",
            ]
        args += ["-map", "0:v:0"]
        args += ["-map", "[a]", "-c:a", "aac"] if narration else ["-map", "0:a:0", "-c:a", "copy"]
        if captions:
            args += ["-vf", "subtitles=captions.srt:force_style='FontName=Arial,Outline=1,MarginV=25'",
                     "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-pix_fmt", "yuv420p"]
        else:
            args += ["-c:v", "copy"]
        export = str(directory / "finished.mp4")
        run_ffmpeg(ffmpeg, [*args, "-movflags", "+faststart", export], directory)
    print(json.dumps({"export": export}))


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, stop_render)
    signal.signal(signal.SIGINT, stop_render)
    main()
