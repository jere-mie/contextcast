import type { Briefing } from '../schema/briefing';
import { PlaybackController, playbackRates } from './controller';
import { BrowserSpeech } from './speech';
import { formatTime } from './timeline';
import { renderScene, applyCues, element } from '../renderers/scenes';
import { validateBriefing } from '../../.agents/skills/contextcast/scripts/validate.mjs';

function readBriefing(): Briefing {
  const source = document.querySelector('#briefing-data')!.textContent!;
  try { return validateBriefing(JSON.parse(source)) as Briefing; }
  catch (error) {
    document.body.replaceChildren(element('h1', '', 'Invalid briefing data'), element('p', 'message', String(error)), element('pre', 'diagram-source', source));
    throw error;
  }
}
const data = readBriefing();
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const speech = new BrowserSpeech();
const player = new PlaybackController(data, speech);
const store = {
  get(key: string) { try { return localStorage.getItem(`contextcast:${key}`); } catch { return null; } },
  set(key: string, value: string) { try { localStorage.setItem(`contextcast:${key}`, value); } catch {} },
};
document.title = `${data.title} · ContextCast`;
document.documentElement.lang = data.language;
$('#briefing-title').textContent = data.title;
$('#provenance').textContent = data.provenance;
const speed = $<HTMLSelectElement>('#speed');
const savedRate = Number(store.get('rate'));
if (playbackRates.includes(savedRate)) { player.setRate(savedRate); speed.value = String(savedRate); }
const voiceSelect = $<HTMLSelectElement>('#voice');
function refreshVoices() {
  const voices = speech.voices();
  const previous = player.voice;
  // Never restore a remote or unknown voice automatically from storage.
  const preferred = voices.find(v => v.localService === true && v.voiceURI === store.get('voice'))
    ?? voices.find(v => v.localService === true && v.lang.toLowerCase() === data.language.toLowerCase())
    ?? voices.find(v => v.localService === true && v.lang.split('-')[0] === data.language.split('-')[0])
    ?? voices.find(v => v.localService === true);
  const selected = previous ? voices.find(v => v.voiceURI === previous.voiceURI && v.localService === previous.localService) : preferred;
  voiceSelect.replaceChildren(new Option('Text only · choose a voice', ''));
  voices.forEach(v => voiceSelect.add(new Option(`${v.name} · ${v.lang} · ${v.localService === true ? 'local' : v.localService === false ? 'remote' : 'unknown service'}`, v.voiceURI)));
  if (selected) voiceSelect.value = selected.voiceURI;
  if (selected?.voiceURI !== previous?.voiceURI) player.setVoice(selected);
  $('#voice-note').textContent = !speech.supported ? 'Browser narration unavailable. Text-only navigation is ready.' : selected ? (selected.localService === true ? 'Local voice reported by your browser. Speech stays with your browser / OS.' : 'Remote or unknown voice selected for this session. Text may be sent to its provider.') : voices.length ? 'Select a voice to listen. Remote voices may send narration to their provider.' : 'No voices available yet. You can read and navigate the full briefing.';
  $('#speech-unavailable').hidden = !!selected;
  $('#speech-unavailable').textContent = !speech.supported ? 'Narration unavailable in this browser. The transcript is available.' : 'No voice selected. Open Voice to choose one, or read the transcript.';
}
speech.onVoicesChanged(refreshVoices);
voiceSelect.addEventListener('change', () => {
  const voice = speech.voices().find(v => v.voiceURI === voiceSelect.value);
  if (voice && voice.localService !== true && !window.confirm('This voice is remote or its service is unknown. Narration text may be sent to its provider. Use it for this session?')) { voiceSelect.value = player.voice?.voiceURI ?? ''; return; }
  player.setVoice(voice); if (voice?.localService === true) store.set('voice', voice.voiceURI);
  $('#speech-unavailable').hidden = !!voice;
  $('#voice-note').textContent = voice ? `${voice.localService === true ? 'Local' : 'Remote / unknown'} voice selected. Changing voice or speed restarts the current beat.` : 'Text-only mode. Choose a voice to listen.';
});
let feedbackTimer: ReturnType<typeof setTimeout>;
function feedback(text: string) {
  $('#shortcut-feedback').textContent = text; clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { $('#shortcut-feedback').textContent = ''; }, 1800);
}
function changeSpeed(value: number) {
  player.setRate(value); speed.value = String(player.rate); store.set('rate', speed.value);
  feedback(`${player.rate}×`);
}
speed.addEventListener('change', () => changeSpeed(Number(speed.value)));

const chapterButtons: HTMLButtonElement[] = [];
const transcriptButtons: HTMLButtonElement[] = [];
data.scenes.forEach((scene, sceneIndex) => {
  const index = player.entries.findIndex(e => e.sceneIndex === sceneIndex);
  const button = element('button', 'chapter'); button.type = 'button';
  button.append(element('span', 'chapter-number', String(sceneIndex + 1).padStart(2, '0')), element('span', 'chapter-name', scene.title), element('span', 'chapter-time', `≈ ${formatTime(player.entries[index].start)}`));
  button.addEventListener('click', () => player.seek(index)); $('#chapters').append(button); chapterButtons.push(button);
  const heading = element('h3', 'transcript-heading', `${String(sceneIndex + 1).padStart(2, '0')}  ${scene.title}`); $('#transcript-content').append(heading);
  scene.beats.forEach(beat => {
    const beatIndex = player.entries.findIndex(e => e.beat.id === beat.id);
    const line = element('button', 'transcript-beat', beat.speech); line.type = 'button';
    line.dataset.beat = beat.id; line.addEventListener('click', () => player.seek(beatIndex));
    $('#transcript-content').append(line); transcriptButtons.push(line);
  });
});
function sourceLink(id: string) {
  const source = data.sources.find(s => s.id === id)!;
  if (!source.url) {
    const button = element('button', 'source-link', `${source.label} ⤢`);
    button.addEventListener('click', () => { if (!sourcesDialog.open) sourcesDialog.showModal(); document.getElementById(`source-${id}`)?.scrollIntoView({ block: 'center' }); });
    return button;
  }
  const link = element('a', 'source-link', `${source.label} ↗`);
  link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
data.sources.forEach(source => {
  const block = element('div', 'source-block'); block.id = `source-${source.id}`;
  block.append(source.url ? sourceLink(source.id) : element('strong', 'source-link', source.label));
  if (source.excerpt) block.append(element('pre', 'source-excerpt', source.excerpt));
  $('#all-sources').append(block);
});
if (!data.sources.length) $('#all-sources').append(element('p', 'muted', 'No external sources supplied. See the provenance note.'));
const findings = data.scenes.filter(s => s.layout === 'finding');
findings.forEach(s => {
  const card = element('button', 'finding-summary'); card.append(element('span', 'column-label', `${s.visual.severity} · ${s.visual.status}`), element('strong', '', s.visual.headline));
  card.addEventListener('click', () => player.seek(player.entries.findIndex(e => data.scenes[e.sceneIndex].id === s.id))); $('#findings-list').append(card);
});
if (!findings.length) $('#findings-list').textContent = 'No review findings in this briefing.';
let renderedScene = -1;
let selectedIndex = -1;
const progress = $<HTMLInputElement>('#progress');
function render() {
  const entry = player.entry; const scene = data.scenes[entry.sceneIndex];
  if (renderedScene !== entry.sceneIndex) {
    $('#stage-content').replaceChildren(renderScene(scene)); renderedScene = entry.sceneIndex;
    $('#scene-title').textContent = scene.title;
    $('#scene-position').textContent = `${entry.sceneIndex + 1} / ${data.scenes.length}`;
  }
  applyCues($('#stage-content'), scene, entry.beatIndex);
  chapterButtons.forEach((b, i) => { b.setAttribute('aria-current', i === entry.sceneIndex ? 'step' : 'false'); b.querySelector('.chapter-time')!.textContent = `≈ ${formatTime(player.entries.find(e => e.sceneIndex === i)!.start)}`; });
  transcriptButtons.forEach((b, i) => b.setAttribute('aria-current', i === player.index ? 'true' : 'false'));
  if (selectedIndex !== player.index) {
    $('#stage-caption').textContent = entry.beat.caption ?? '';
    $('#stage-caption').hidden = !entry.beat.caption;
    const sources = $('#scene-sources'); sources.replaceChildren(...entry.beat.sourceIds.map(sourceLink));
    // Scroll only during playback and only if the active row is outside the reader viewport.
    const active = transcriptButtons[player.index]; const pane = $('#transcript-content');
    if (player.status === 'playing' && !pane.matches(':hover') && !pane.contains(document.activeElement)) {
      const a = active.getBoundingClientRect(), p = pane.getBoundingClientRect();
      if (a.top < p.top || a.bottom > p.bottom) pane.scrollTop += a.top - p.top - 50;
    }
    selectedIndex = player.index;
  }
  $('#play').textContent = player.status === 'playing' ? 'Pause' : player.status === 'completed' ? 'Replay' : 'Play';
  $('#play').setAttribute('aria-pressed', String(player.status === 'playing'));
  $('#play').setAttribute('aria-disabled', String(!speech.supported || !player.voice));
  $('#play').toggleAttribute('disabled', !speech.supported || !player.voice);
  $('#playback-status').textContent = player.status === 'completed' ? 'Briefing complete' : player.status === 'playing' ? 'Narrating' : player.status === 'paused' ? 'Paused' : 'Ready when you are';
  $('#message').textContent = player.message;
  $('#message').hidden = !player.message;
  $('#previous-chapter').toggleAttribute('disabled', entry.sceneIndex === 0);
  $('#next-chapter').toggleAttribute('disabled', entry.sceneIndex === data.scenes.length - 1);
  tick();
}
function tick() {
  progress.max = String(player.duration); progress.value = String(player.position);
  progress.style.setProperty('--progress', `${100 * player.position / player.duration}%`);
  progress.setAttribute('aria-valuetext', `Approximately ${formatTime(player.position)} of ${formatTime(player.duration)}. Seeks to narration beats.`);
  $('#elapsed').textContent = `≈ ${formatTime(player.position)}`; $('#duration').textContent = `≈ ${formatTime(player.duration)}`;
}
player.onChange = render;
$('#play').addEventListener('click', () => player.toggle());
$('#back').addEventListener('click', () => player.skip(-1)); $('#forward').addEventListener('click', () => player.skip(1));
$('#previous-chapter').addEventListener('click', () => player.chapter(-1)); $('#next-chapter').addEventListener('click', () => player.chapter(1));
progress.addEventListener('input', () => player.seekTime(Number(progress.value)));
function toggleTranscript() { const pane = $('#transcript-panel'); pane.hidden = !pane.hidden; $('#transcript-toggle').setAttribute('aria-expanded', String(!pane.hidden)); $('.workspace').classList.toggle('transcript-hidden', pane.hidden); }
$('#transcript-toggle').addEventListener('click', toggleTranscript);
const sourcesDialog = $<HTMLDialogElement>('#sources-dialog');
$('#sources-toggle').addEventListener('click', () => sourcesDialog.showModal()); $('#sources-close').addEventListener('click', () => sourcesDialog.close());
const settingsDialog = $<HTMLDialogElement>('#settings-dialog');
$('#settings-toggle').addEventListener('click', () => settingsDialog.showModal()); $('#settings-close').addEventListener('click', () => settingsDialog.close());
const shortcutsDialog = $<HTMLDialogElement>('#shortcuts-dialog');
$('#shortcuts-toggle').addEventListener('click', () => shortcutsDialog.showModal()); $('#shortcuts-close').addEventListener('click', () => shortcutsDialog.close());
async function toggleFullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { feedback('Fullscreen unavailable'); }
}
$('#fullscreen').addEventListener('click', toggleFullscreen);
$('#copy-transcript').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(data.scenes.map(s => `${s.title}\n${s.beats.map(b => b.speech).join('\n')}`).join('\n\n')); $('#copy-transcript').textContent = 'Copied'; }
  catch { $('#copy-transcript').textContent = 'Select text to copy'; }
});
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || document.querySelector('dialog[open]')) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('input, select, textarea, [contenteditable]:not([contenteditable=false]), [role=textbox]')) return;
  const key = event.key.toLowerCase();
  // Space/Enter keep native activation on a focused button or link. Letter shortcuts still work after clicking Play.
  if (key === ' ' && target?.closest('button, a, summary, [role=button]')) return;
  if (event.repeat && [' ', 'k', 't', 'f', '?'].includes(key)) { event.preventDefault(); return; }
  if (key === ' ' || key === 'k') player.toggle();
  else if (key === 'arrowleft' || key === 'arrowright') { const direction = key === 'arrowleft' ? -1 : 1; event.shiftKey ? player.chapter(direction) : player.skip(direction); }
  else if (key === 'j' || key === 'l') player.skip(key === 'j' ? -1 : 1, 10);
  else if (key === '<' || key === '>') {
    const index = playbackRates.indexOf(player.rate);
    changeSpeed(playbackRates[Math.max(0, Math.min(playbackRates.length - 1, index + (key === '>' ? 1 : -1)))]);
  }
  else if (/^[0-9]$/.test(key)) player.seekTime(player.duration * Number(key) / 10);
  else if (key === 'home') player.seek(0);
  else if (key === 'end') player.seek(player.entries.length - 1);
  else if (key === 't') toggleTranscript();
  else if (key === 'f') void toggleFullscreen();
  else if (key === '?') shortcutsDialog.showModal();
  else return;
  event.preventDefault();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });
window.addEventListener('pagehide', () => player.dispose());
refreshVoices(); render(); setInterval(tick, 200);
