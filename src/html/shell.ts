import { playbackRates } from '../player/rates';

export const shell = `
<header class="topbar">
  <span class="brand">ContextCast</span><h1 id="briefing-title"></h1>
  <div class="header-actions">
    <button id="transcript-toggle" aria-expanded="true" aria-controls="transcript-panel" title="Toggle transcript (T)">Transcript</button>
    <button id="sources-toggle">Sources</button><button id="settings-toggle" title="Voice settings">Voice</button>
    <button id="shortcuts-toggle" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
  </div>
</header>
<main class="workspace">
  <nav class="chapters-panel" aria-label="Briefing chapters"><h2>Chapters</h2><div id="chapters"></div></nav>
  <section class="player-column" aria-label="Briefing player">
    <div class="stage"><div class="scene-header"><span id="scene-position"></span><h2 id="scene-title"></h2></div><div id="stage-content"></div><p id="stage-caption" hidden></p><div id="scene-sources" class="scene-sources"></div></div>
    <div class="transport">
      <input id="progress" type="range" min="0" step="0.1" value="0" aria-label="Estimated timeline, seek to nearest beat">
      <div class="transport-controls">
        <button id="previous-chapter" aria-label="Previous chapter" title="Previous chapter (Shift + ←)">|‹</button>
        <button id="back" aria-label="Back approximately five seconds" title="Back ≈5s (←)">−5s</button>
        <button id="play" class="play-button" aria-pressed="false" title="Play / pause (Space or K)">Play</button>
        <button id="forward" aria-label="Forward approximately five seconds" title="Forward ≈5s (→)">+5s</button>
        <button id="next-chapter" aria-label="Next chapter" title="Next chapter (Shift + →)">›|</button>
        <span class="time"><span id="elapsed"></span> / <span id="duration"></span></span>
        <label class="speed-control"><select id="speed" aria-label="Playback speed" title="Playback speed (< / >)">${playbackRates.map(rate => `<option value="${rate}"${rate === 1 ? ' selected' : ''}>${rate}×</option>`).join('')}</select></label>
        <button id="fullscreen" aria-label="Toggle fullscreen" title="Fullscreen (F)">⛶</button>
      </div>
      <div class="status-row"><span id="playback-status" role="status">Ready</span><span id="shortcut-feedback" role="status" aria-live="polite"></span><span>Seeking is approximate</span></div>
      <div id="message" class="message" role="status" hidden></div><p id="speech-unavailable" class="message" hidden></p>
    </div>
  </section>
  <aside class="transcript-panel" id="transcript-panel"><div class="transcript-header"><h2>Transcript</h2><button id="copy-transcript" aria-label="Copy transcript">Copy</button></div><div id="transcript-content"></div></aside>
</main>
<dialog id="settings-dialog"><div class="dialog-header"><h2>Voice</h2><button id="settings-close">Close</button></div><label for="voice">Narration voice</label><select id="voice" aria-label="Narration voice"><option>Loading voices…</option></select><p id="voice-note"></p><p class="muted">Changing the voice or speed restarts the current beat.</p></dialog>
<dialog id="shortcuts-dialog"><div class="dialog-header"><h2>Keyboard shortcuts</h2><button id="shortcuts-close">Close</button></div>
  <dl class="shortcuts">
    <dt><kbd>Space</kbd> / <kbd>K</kbd></dt><dd>Play / pause</dd>
    <dt><kbd>←</kbd> / <kbd>→</kbd></dt><dd>Back / forward ≈5 seconds</dd>
    <dt><kbd>J</kbd> / <kbd>L</kbd></dt><dd>Back / forward ≈10 seconds</dd>
    <dt><kbd>&lt;</kbd> / <kbd>&gt;</kbd></dt><dd>Slower / faster by 0.25×, from 0.25× to 10× (Shift + comma / period)</dd>
    <dt><kbd>Shift + ←</kbd> / <kbd>Shift + →</kbd></dt><dd>Previous / next chapter</dd>
    <dt><kbd>0</kbd>–<kbd>9</kbd></dt><dd>Seek to 0–90% of the estimated timeline</dd>
    <dt><kbd>Home</kbd> / <kbd>End</kbd></dt><dd>First / last beat</dd>
    <dt><kbd>T</kbd></dt><dd>Toggle transcript</dd><dt><kbd>F</kbd></dt><dd>Toggle fullscreen</dd>
    <dt><kbd>?</kbd></dt><dd>Show shortcuts</dd><dt><kbd>Esc</kbd></dt><dd>Close a dialog / exit fullscreen</dd>
  </dl><p class="muted">Shortcuts leave text fields and native controls alone. Speed changes restart the current beat and preserve paused state.</p>
</dialog>
<dialog id="sources-dialog"><div class="dialog-header"><h2>Sources & findings</h2><button id="sources-close">Close</button></div><p id="provenance" class="provenance"></p><h3>Findings</h3><div id="findings-list"></div><h3>Sources</h3><div id="all-sources"></div></dialog>
`;
