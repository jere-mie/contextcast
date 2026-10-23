# Verification and implementation notes

Verified October 22, 2026 on Windows with Node 24.16.0 and npm 11.13.0.

## Results

- `npm run typecheck`: passed.
- `npm test`: 35 passed, none skipped. Covers schema failures, all layouts, unsupported versions, estimates/skip edges, one-at-a-time playback, stale callbacks, pause/resume including late end while paused, rate/voice changes, failures, 150-beat sequential playback, build output, and escaping.
- `npm run build:examples`: passed. PR example: 8 scenes, 48 beats, approximately 7:42 at 1×, 5.07 MiB. Architecture example: 2 scenes, 6 beats, 5.05 MiB. Each output is one HTML file with no companion assets.
- `npm run test:browser`: 7 passed in installed Chrome 155 and 7 passed in installed Edge 155. Both use Playwright headless on Windows, directly opening `file://` artifacts.
- Skill `quick_validate.py`: passed for `.agents/skills/contextcast`.
- `npm audit`: zero reported vulnerabilities after pinning Mermaid 12.2.0 and its resolved dependencies.

Both browsers exposed native synthesis and eight OS/browser voices. A user-clicked short utterance with a selected local voice emitted completion and brought the player to **Briefing complete** in each browser. This confirms actual native synthesis lifecycle events; no human listening/voice-quality judgment was performed.

Browser coverage includes:

- Network-disabled direct file opening, with zero HTTP(S) requests; no server running.
- All eight PR chapters and the architecture briefing.
- Mermaid flowchart and sequence SVG rendering.
- Full transcript, evidence excerpts, and one active chapter/beat.
- No document-width overflow at 1280×720 and 390×844. Desktop controls fit at 1280×720 without document scrolling; content, chapters, and transcript scroll independently. Narrow screens stack panels.
- Mocked asynchronous voices, no autoplay, consent refusal/acceptance for remote-only voices, and no consent restoration after reload.
- Rapid chapter/rate changes, stale speech callbacks, paused seeking, completion/replay, and keyboard playback/transcript shortcuts.
- Compact, neutral UI with no decorative badges, card frames, slogan/footer, or repeated narration captions. Voice settings are in a dialog.
- YouTube-style K/Space, J/L, arrow and chapter seeking, digit seeking, Home/End, 0.25× speed steps across the full 0.25×–10× range, speed clamping/persistence, fullscreen, shortcut help, and native-control/modifier guards. Letter shortcuts remain available when a button has focus.
- Absent synthesis and blocked local storage without loss of manual navigation.
- Malicious HTML/code displayed as text, invalid diagrams showing readable source, and reveals restored after seeking backward.

Screenshots are generated in ignored `test-results/`. Native tests do not evaluate every platform voice, multi-minute audible playback, or subjective clarity. Firefox and Safari were not available and have not been tested. Safari/Firefox voice loading and pause behavior can differ; verify on the intended platform before claiming support there.

## Decisions

The player is vanilla TypeScript with a small DOM renderer. Reveal.js is omitted because the scene shell and chapter buttons already satisfy navigation, and an independent slide controller would duplicate playback state. There are six reusable layouts. CSS line emphasis is used for code. The title renderer is content-kind independent.

Mermaid 12.2.0 is bundled, initialized with strict security, and used only for flowcharts and sequence diagrams. Diagram configuration directives are disallowed. Source text is never treated as HTML. Mermaid's sanitized SVG is parsed into a DOM; an error shows the source rather than a blank stage. Diagram promises are cached by scene.

Speech is a mockable adapter. The controller owns beat order, cancellation generation, pause state, voice, rate, and estimated elapsed time. Estimated skips snap to beat boundaries and force directional movement where possible. No boundary-event dependency, media file, backend, source fetching, or remote TTS API exists in the runtime.

Local voice preference is based on browser-reported `localService`, with language matching where possible. Remote/unknown selection asks for explicit consent every reopened session. A vanished voice stops narration. Browser/OS voice services may operate outside the page's network policy; offline assets alone do not guarantee offline speech.

Embedded evidence excerpts extend the HTTPS-source model to private or fictional examples without inventing links. All source references are validated. The compiler embeds escaped data and a hash-authorized inline runtime with page networking blocked by content security policy.

## Manual checks still useful

Listen to the full sample with the intended voice for pronunciation and pacing; verify long-running pause/resume behavior on that browser/OS. Review real briefing evidence and narration for accuracy. Exact time seeking, word captions, real PR fetching, and external comment posting are outside this MVP.
