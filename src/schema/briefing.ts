import { z } from 'zod';

const text = z.string().trim().min(1);
const id = text.regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'Use a stable identifier beginning with a letter');
const item = z.object({ id, title: text, body: text.optional() }).strict();
const range = z.tuple([z.number().int().positive(), z.number().int().positive()])
  .refine(([a, b]) => b >= a, 'Line range must be ascending');
const visual = z.discriminatedUnion('layout', [
  z.object({ layout: z.literal('title'), visual: z.object({ headline: text, description: text, items: z.array(item).min(1).max(6) }).strict() }).strict(),
  z.object({ layout: z.literal('bullets'), visual: z.object({ items: z.array(item).min(1).max(8) }).strict() }).strict(),
  z.object({ layout: z.literal('diagram'), visual: z.object({ definition: text, description: text }).strict() }).strict(),
  z.object({ layout: z.literal('code'), visual: z.object({ language: text, filename: text, code: text, startLine: z.number().int().positive(), highlights: z.array(range).default([]), description: text }).strict() }).strict(),
  z.object({ layout: z.literal('comparison'), visual: z.object({ beforeTitle: text, afterTitle: text, before: z.array(item).min(1), after: z.array(item).min(1) }).strict() }).strict(),
  z.object({ layout: z.literal('finding'), visual: z.object({ status: z.enum(['confirmed', 'potential', 'needs verification']), severity: z.enum(['high', 'medium', 'low', 'info']), headline: text, detail: text, recommendation: text }).strict() }).strict(),
]);
const cue = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }).strict(),
  z.object({ type: z.literal('focus'), target: id }).strict(),
  z.object({ type: z.literal('reveal'), target: id }).strict(),
  z.object({ type: z.literal('callout'), text }).strict(),
]);
const beat = z.object({
  id, speech: text.refine(s => !/```|\]\(|^\s*#{1,6}\s|\*\*[^*]+\*\*/m.test(s), 'Speech must be plain spoken text, without Markdown'),
  caption: text.optional(), cue: cue.optional(), sourceIds: z.array(id).default([]),
}).strict();
const sceneBase = { id, title: text, eyebrow: text.optional(), beats: z.array(beat).min(1) };
const scene = z.discriminatedUnion('layout', [
  visual.options[0].extend(sceneBase), visual.options[1].extend(sceneBase),
  visual.options[2].extend(sceneBase), visual.options[3].extend(sceneBase),
  visual.options[4].extend(sceneBase), visual.options[5].extend(sceneBase),
]);

export const briefingSchema = z.object({
  schemaVersion: z.literal('1'), id, title: text,
  kind: z.enum(['pr-review', 'architecture', 'initiative', 'implementation']),
  subtitle: text, language: text.default('en-US'),
  provenance: text,
  settings: z.object({ estimatedWordsPerMinute: z.number().min(80).max(240).default(150) }).strict().default({}),
  sources: z.array(z.object({ id, label: text, url: z.string().url().refine(s => { try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } }, 'Only HTTPS evidence links without credentials are allowed').optional(), excerpt: text.optional() }).strict().refine(s => !!s.url || !!s.excerpt, 'A source needs an HTTPS URL or embedded evidence excerpt')).default([]),
  scenes: z.array(scene).min(1),
}).strict().superRefine((data, ctx) => {
  const ids = new Set<string>();
  const add = (value: string) => { if (ids.has(value)) ctx.addIssue({ code: 'custom', message: `Duplicate ID: ${value}` }); ids.add(value); };
  add(data.id);
  data.sources.forEach(s => add(s.id));
  const sources = new Set(data.sources.map(s => s.id));
  data.scenes.forEach(s => {
    add(s.id);
    if (s.layout === 'title' || s.layout === 'bullets') s.visual.items.forEach(i => add(i.id));
    if (s.layout === 'comparison') [...s.visual.before, ...s.visual.after].forEach(i => add(i.id));
    s.beats.forEach(b => { add(b.id); b.sourceIds.forEach(ref => { if (!sources.has(ref)) ctx.addIssue({ code: 'custom', message: `Unknown source: ${ref} in ${b.id}` }); }); });
  });
});
export type Briefing = z.infer<typeof briefingSchema>;
export type Scene = Briefing['scenes'][number];
export type Beat = Scene['beats'][number];
export function validateBriefing(input: unknown): Briefing {
  if (typeof input === 'object' && input && 'schemaVersion' in input && input.schemaVersion !== '1') {
    throw new Error(`Unsupported schemaVersion ${String(input.schemaVersion)}. This compiler accepts version 1; migrate the input explicitly before building.`);
  }
  return briefingSchema.parse(input);
}
