import type { Scene } from '../schema/briefing';
import type { MermaidConfig } from 'mermaid';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
}
const mermaidConfig: MermaidConfig = { startOnLoad: false, securityLevel: 'strict', theme: 'dark',
  suppressErrorRendering: true, fontFamily: 'Arial, sans-serif',
  secure: ['securityLevel', 'startOnLoad', 'suppressErrorRendering', 'maxTextSize', 'fontFamily'],
  flowchart: { htmlLabels: false }, themeVariables: { primaryColor: '#262a2e', primaryTextColor: '#e8e8e8', primaryBorderColor: '#8999a7', lineColor: '#8999a7', background: '#151617', fontSize: '16px' },
};
export const mermaidURL = 'https://cdn.jsdelivr.net/npm/mermaid@12.2.0/dist/mermaid.min.js';
type Mermaid = (typeof import('mermaid'))['default'];
let mermaidReady: Promise<Mermaid> | undefined;
function loadMermaid(): Promise<Mermaid> {
  return mermaidReady ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = mermaidURL; script.async = true;
    const timeout = setTimeout(() => { script.remove(); reject(new Error('Diagram library timed out')); }, 12000);
    script.onload = () => {
      clearTimeout(timeout);
      const mermaid = (window as unknown as { mermaid: Mermaid }).mermaid;
      try { mermaid.initialize(mermaidConfig); resolve(mermaid); }
      catch (error) { reject(error); }
    };
    script.onerror = () => { clearTimeout(timeout); reject(new Error('Diagram CDN unavailable')); };
    document.head.append(script);
  });
}
const diagrams = new Map<string, Promise<string>>();
let diagramNumber = 0;
function renderDiagram(scene: Extract<Scene, { layout: 'diagram' }>) {
  if (!diagrams.has(scene.id)) {
    // Diagram directives/frontmatter must not override the player's security configuration.
    const definition = scene.visual.definition;
    const result = /%%\{|^\s*---/m.test(definition) || !/^\s*(flowchart|graph|sequenceDiagram)\b/.test(definition)
      ? Promise.reject(new Error('Use a flowchart or sequence diagram without configuration directives.'))
      : loadMermaid().then(mermaid => mermaid.render(`diagram-${diagramNumber++}`, definition)).then(r => r.svg);
    // Cache both success and failure, rendering at most once per scene.
    result.catch(() => {}); diagrams.set(scene.id, result);
  }
  return diagrams.get(scene.id)!;
}
function cards(items: { id: string; title: string; body?: string }[]) {
  const list = element('div', 'cards');
  for (const item of items) {
    const card = element('div', 'idea'); card.dataset.target = item.id;
    card.append(element('h3', '', item.title));
    if (item.body) card.append(element('p', '', item.body)); list.append(card);
  }
  return list;
}
export function renderScene(scene: Scene) {
  const root = element('div', `scene layout-${scene.layout}`);
  switch (scene.layout) {
    case 'title':
      root.append(element('h2', 'hero-headline', scene.visual.headline), element('p', 'hero-description', scene.visual.description), cards(scene.visual.items)); break;
    case 'bullets': root.append(element('h2', 'visual-title', scene.title), cards(scene.visual.items)); break;
    case 'comparison': {
      root.append(element('h2', 'visual-title', scene.title));
      const columns = element('div', 'comparison');
      for (const [label, items] of [[scene.visual.beforeTitle, scene.visual.before], [scene.visual.afterTitle, scene.visual.after]] as const) {
        const col = element('section', 'comparison-column'); col.append(element('h3', 'column-label', label), cards([...items])); columns.append(col);
      } root.append(columns); break;
    }
    case 'code': {
      root.append(element('p', 'code-description', scene.visual.description));
      const frame = element('div', 'code-frame'); frame.append(element('div', 'code-filename', `${scene.visual.filename}  ·  ${scene.visual.language}`));
      const pre = element('pre'); pre.setAttribute('aria-label', scene.visual.description);
      scene.visual.code.split('\n').forEach((line, index) => {
        const num = scene.visual.startLine + index;
        const row = element('span', 'code-line'); row.dataset.target = `line-${num}`;
        if (scene.visual.highlights.some(([a, b]) => num >= a && num <= b)) row.classList.add('highlight-line');
        row.append(element('span', 'line-number', String(num)), element('code', '', line || ' ')); pre.append(row);
      }); frame.append(pre); root.append(frame); break;
    }
    case 'finding': {
      const f = scene.visual;
      root.append(element('div', 'finding-meta', `${f.severity.toUpperCase()} PRIORITY  /  ${f.status.toUpperCase()}`), element('h2', 'hero-headline', f.headline), element('p', 'finding-detail', f.detail));
      const recommendation = element('div', 'recommendation'); recommendation.append(element('span', 'column-label', 'PROPOSED REVIEW COMMENT'), element('p', '', f.recommendation));
      root.append(recommendation); break;
    }
    case 'diagram': {
      root.append(element('p', 'diagram-description', scene.visual.description));
      const host = element('div', 'diagram-host', 'Rendering diagram…'); host.setAttribute('role', 'img'); host.setAttribute('aria-label', scene.visual.description);
      root.append(host);
      void renderDiagram(scene).then(svg => {
        // Mermaid sanitizes its SVG in strict mode. Never pass source content to innerHTML.
        const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const node = parsed.documentElement;
        if (node.nodeName.toLowerCase() !== 'svg') throw new Error('Diagram did not produce an SVG');
        host.replaceChildren(document.importNode(node, true));
      }).catch(() => {
        host.removeAttribute('role'); host.replaceChildren(element('p', 'diagram-error', 'Diagram unavailable (CDN or syntax error). Description and source are still available.'), element('pre', 'diagram-source', scene.visual.definition));
      }); break;
    }
  }
  return root;
}
export function applyCues(root: HTMLElement, scene: Scene, beatIndex: number) {
  const beats = scene.beats.slice(0, beatIndex + 1);
  const revealTargets = new Set(scene.beats.flatMap(b => b.cue?.type === 'reveal' ? [b.cue.target] : []));
  const revealed = new Set(beats.flatMap(b => b.cue?.type === 'reveal' ? [b.cue.target] : []));
  const cue = scene.beats[beatIndex].cue;
  root.querySelectorAll<HTMLElement>('[data-target]').forEach(el => {
    el.classList.toggle('focused', cue?.type === 'focus' && cue.target === el.dataset.target);
    el.hidden = revealTargets.has(el.dataset.target!) && !revealed.has(el.dataset.target!);
  });
  root.querySelector('.beat-callout')?.remove();
  if (cue && cue.type !== 'none') {
    const hasTarget = cue.type === 'focus' && [...root.querySelectorAll<HTMLElement>('[data-target]')].some(el => el.dataset.target === cue.target);
    const text = cue.type === 'callout' ? cue.text : cue.type === 'focus' && !hasTarget && scene.layout === 'diagram' ? cue.target.replaceAll('-', ' ') : '';
    // An overlay is stable across Mermaid SVG versions; missing targets degrade to a label.
    if (text) root.append(element('div', 'beat-callout', text));
  }
}
