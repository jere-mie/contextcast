// Dependency-free authoring validation. Keep in step with src/schema/briefing.ts.
export function validateBriefing(input) {
  const d = structuredClone(input);
  const fail = message => { throw new Error(message); };
  const object = (value, required, optional = []) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Expected an object');
    for (const key of required) if (!(key in value)) fail(`Missing field: ${key}`);
    for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) fail(`Unknown field: ${key}`);
  };
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const string = (value, field) => { if (!text(value)) fail(`Expected nonempty text: ${field}`); return value.trim(); };
  const choice = (value, choices) => { if (!choices.includes(value)) fail(`Expected one of ${choices.join(', ')}; got ${value}`); };
  const array = (value, min = 0, max = Infinity) => { if (!Array.isArray(value) || value.length < min || value.length > max) fail(`Expected array with ${min}–${max} entries`); };
  const integer = value => { if (!Number.isInteger(value) || value < 1) fail('Expected positive integer'); };
  const ids = new Set();
  const refId = value => { if (!text(value) || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value.trim())) fail(`Invalid identifier: ${value}`); return value.trim(); };
  const id = value => { const name = refId(value); if (ids.has(name)) fail(`Duplicate ID: ${name}`); ids.add(name); return name; };
  const items = (value, max = Infinity) => {
    array(value, 1, max);
    value.forEach(item => { object(item, ['id', 'title'], ['body']); item.id = id(item.id); item.title = string(item.title, 'title'); if ('body' in item) item.body = string(item.body, 'body'); });
  };
  object(d, ['schemaVersion', 'id', 'title', 'kind', 'subtitle', 'provenance', 'scenes'], ['language', 'settings', 'sources']);
  if (d.schemaVersion !== '1') fail(`Unsupported schemaVersion ${d.schemaVersion}. Migrate the input explicitly to version 1.`);
  d.id = id(d.id);
  for (const key of ['title', 'subtitle', 'provenance']) d[key] = string(d[key], key);
  choice(d.kind, ['pr-review', 'architecture', 'initiative', 'implementation']);
  d.language = string(d.language === undefined ? 'en-US' : d.language, 'language');
  if (d.settings === undefined) d.settings = {}; object(d.settings, [], ['estimatedWordsPerMinute']);
  if (d.settings.estimatedWordsPerMinute === undefined) d.settings.estimatedWordsPerMinute = 150;
  const wpm = d.settings.estimatedWordsPerMinute;
  if (typeof wpm !== 'number' || !Number.isFinite(wpm) || wpm < 80 || wpm > 240) fail('Words per minute must be 80–240');
  if (d.sources === undefined) d.sources = []; array(d.sources);
  d.sources.forEach(source => {
    object(source, ['id', 'label'], ['url', 'excerpt']); source.id = id(source.id); source.label = string(source.label, 'label');
    if ('excerpt' in source) source.excerpt = string(source.excerpt, 'excerpt');
    if ('url' in source) {
      let url; try { url = new URL(source.url); } catch { fail('Invalid evidence URL'); }
      if (typeof source.url !== 'string' || url.protocol !== 'https:' || url.username || url.password) fail('Only HTTPS evidence URLs without credentials are allowed');
    }
    if (!source.url && !source.excerpt) fail('A source needs a URL or excerpt');
  });
  const sources = new Set(d.sources.map(s => s.id));
  array(d.scenes, 1);
  d.scenes.forEach(scene => {
    object(scene, ['id', 'title', 'layout', 'visual', 'beats'], ['eyebrow']); scene.id = id(scene.id); scene.title = string(scene.title, 'title');
    if ('eyebrow' in scene) scene.eyebrow = string(scene.eyebrow, 'eyebrow');
    const v = scene.visual;
    switch (scene.layout) {
      case 'title': object(v, ['headline', 'description', 'items']); items(v.items, 6); break;
      case 'bullets': object(v, ['items']); items(v.items, 8); break;
      case 'diagram': object(v, ['definition', 'description']); break;
      case 'code':
        object(v, ['language', 'filename', 'code', 'startLine', 'description'], ['highlights']); integer(v.startLine); if (v.highlights === undefined) v.highlights = []; array(v.highlights);
        v.highlights.forEach(range => { array(range, 2, 2); range.forEach(integer); if (range[1] < range[0]) fail('Line range must be ascending'); }); break;
      case 'comparison': object(v, ['beforeTitle', 'afterTitle', 'before', 'after']); items(v.before); items(v.after); break;
      case 'finding':
        object(v, ['status', 'severity', 'headline', 'detail', 'recommendation']);
        choice(v.status, ['confirmed', 'potential', 'needs verification']); choice(v.severity, ['high', 'medium', 'low', 'info']); break;
      default: fail(`Unknown layout: ${scene.layout}`);
    }
    for (const [key, value] of Object.entries(v)) if (!['items', 'before', 'after', 'startLine', 'highlights'].includes(key)) v[key] = string(value, key);
    array(scene.beats, 1);
    scene.beats.forEach(beat => {
      object(beat, ['id', 'speech'], ['caption', 'cue', 'sourceIds']); beat.id = id(beat.id); beat.speech = string(beat.speech, 'speech');
      if (/```|\]\(|^\s*#{1,6}\s|\*\*[^*]+\*\*/m.test(beat.speech)) fail('Speech must be plain text, without Markdown');
      if ('caption' in beat) beat.caption = string(beat.caption, 'caption');
      if ('cue' in beat) {
        const cue = beat.cue;
        choice(cue?.type, ['none', 'focus', 'reveal', 'callout']);
        object(cue, cue.type === 'none' ? ['type'] : cue.type === 'callout' ? ['type', 'text'] : ['type', 'target']);
        if (cue.type === 'callout') cue.text = string(cue.text, 'cue.text');
        if (cue.type === 'focus' || cue.type === 'reveal') cue.target = refId(cue.target);
      }
      if (beat.sourceIds === undefined) beat.sourceIds = []; array(beat.sourceIds);
      beat.sourceIds = beat.sourceIds.map(value => { const ref = refId(value); if (!sources.has(ref)) fail(`Unknown source: ${ref}`); return ref; });
    });
  });
  return d;
}
