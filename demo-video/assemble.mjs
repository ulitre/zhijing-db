import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { imageioFfmpeg } from './ffmpeg.mjs';

const FFMPEG = imageioFfmpeg();
const ORDER = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11'];
const CHAPTERS = {
  S03: '01 / 画像与入口',
  S04: '02 / 今日驾驶舱',
  S05: '03 / 自适应路径',
  S06: '04 / 资源合成与自愈评审',
  S07: '05 / 循证导师',
  S08: '06 / 真实 SQL 沙箱',
  S09: '07 / 学情画像',
  S10: '08 / 编排与可靠性',
};
const LEAD = 0.7;
const GAP = 0.35;
const FADE = 0.22;

const timing = JSON.parse(fs.readFileSync('audio/timing.json', 'utf8'));
fs.mkdirSync('build', { recursive: true });
fs.mkdirSync('out', { recursive: true });

function probe(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = (r.stderr || '').match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error(`cannot probe ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const scenes = [];
let cursor = 0;
for (const id of ORDER) {
  const clip = `clips/${id}-${({ S01: 'intro', S02: 'pain', S03: 'login', S04: 'dashboard', S05: 'path', S06: 'resources', S07: 'tutor', S08: 'sqllab', S09: 'profile', S10: 'architecture', S11: 'outro' })[id]}.mp4`;
  const clipDur = probe(clip);
  const data = timing.scenes[id];
  const audioDur = data.audioDuration;
  const duration = Math.max(clipDur, audioDur);
  let lineStart = LEAD;
  const lines = data.lines.map((line) => {
    const start = cursor + lineStart;
    lineStart += line.duration + GAP;
    return { ...line, start };
  });
  scenes.push({ id, clip, clipDur, duration, start: cursor, lines, chapter: CHAPTERS[id] || null });
  cursor += duration;
}

const timeline = { total: cursor, lead: LEAD, scenes };
fs.writeFileSync('build/timeline.json', JSON.stringify(timeline, null, 2), 'utf8');
console.log(`timeline: ${cursor.toFixed(2)}s across ${scenes.length} scenes`);

const SKIP = process.env.SKIP_NORMALIZE === '1' && fs.existsSync('build/video.mp4');
if (!SKIP) {
  const normalized = [];
  for (const s of scenes) {
    const out = `build/${s.id}.mp4`;
    const extra = Math.max(0, s.duration - s.clipDur);
    const filters = [];
    if (extra > 0.02) filters.push(`tpad=stop_mode=clone:stop_duration=${extra.toFixed(3)}`);
    filters.push('scale=1920:1080:force_original_aspect_ratio=decrease');
    filters.push('pad=1920:1080:(ow-iw)/2:(oh-ih)/2');
    filters.push('setsar=1', 'fps=30', 'format=yuv420p');
    filters.push(`fade=t=in:st=0:d=${FADE}`);
    filters.push(`fade=t=out:st=${(s.duration - FADE).toFixed(3)}:d=${FADE}`);
    const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', s.clip,
      '-vf', filters.join(','), '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
      '-pix_fmt', 'yuv420p', '-video_track_timescale', '90000', out];
    const r = spawnSync(FFMPEG, args, { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`normalize ${s.id}: ${r.stderr}`);
    normalized.push(out);
    console.log(`normalized ${s.id} -> ${s.duration.toFixed(2)}s (clip ${s.clipDur.toFixed(2)}s)`);
  }
  fs.writeFileSync('build/concat.txt', normalized.map((f) => `file '${path.resolve(f).replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'build/concat.txt', '-c', 'copy', 'build/video.mp4'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`concat: ${r.stderr}`);
  console.log('concat ok');
} else {
  console.log('skip normalize (existing build/video.mp4)');
}

let res = spawnSync('python', ['build_assets.py'], { encoding: 'utf8' });
process.stdout.write(res.stdout || '');
if (res.status !== 0) throw new Error(`assets: ${res.stderr}`);

res = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error',
  '-i', 'build/video.mp4', '-i', 'build/narration.wav',
  '-vf', 'scale=in_range=full:out_range=tv,ass=build/subs.ass',
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart',
  'out/zhijing-db-demo.mp4'], { encoding: 'utf8' });
if (res.status !== 0) throw new Error(`final: ${res.stderr}`);
const finalDur = probe('out/zhijing-db-demo.mp4');
console.log(`FINAL out/zhijing-db-demo.mp4 ${finalDur.toFixed(2)}s`);
