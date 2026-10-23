import { spawnSync } from 'node:child_process';

let cached = null;

export function imageioFfmpeg() {
  if (cached) return cached;
  const res = spawnSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr || 'cannot locate ffmpeg');
  cached = res.stdout.trim();
  return cached;
}
