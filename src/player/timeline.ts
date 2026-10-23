import type { Briefing, Beat } from '../schema/briefing';
export interface Entry { sceneIndex: number; beatIndex: number; beat: Beat; start: number; duration: number }
export function timeline(data: Briefing, rate = 1): Entry[] {
  let start = 0;
  return data.scenes.flatMap((scene, sceneIndex) => scene.beats.map((beat, beatIndex) => {
    const duration = (Math.max(2, beat.speech.split(/\s+/u).length * 60 / data.settings.estimatedWordsPerMinute) + 0.35) / rate;
    const entry = { sceneIndex, beatIndex, beat, start, duration }; start += duration; return entry;
  }));
}
export const totalDuration = (entries: Entry[]) => entries.at(-1)!.start + entries.at(-1)!.duration;
export function nearest(entries: Entry[], seconds: number) {
  return entries.reduce((best, e, i) => Math.abs(e.start - seconds) < Math.abs(entries[best].start - seconds) ? i : best, 0);
}
export function skipTarget(entries: Entry[], index: number, position: number, direction: -1 | 1, seconds = 5) {
  const candidate = nearest(entries, position + direction * seconds);
  return direction < 0 ? Math.max(0, Math.min(candidate, index - 1)) : Math.min(entries.length - 1, Math.max(candidate, index + 1));
}
export const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
