# ContextCast

Narrated technical explanations in one portable HTML file. A coding agent writes structured scenes and short narration beats; the reusable player handles diagrams, code, evidence, chapters, transcript, and browser-native speech. No generated audio, account, server, API key, or telemetry.

## Try it

Open [the fictional PR review](dist/example-pr-review.html) or [the architecture walkthrough](dist/example-architecture.html) directly in Chrome or Edge. Press **Play briefing** to listen with an available local voice. Everything is usable silently, including the full transcript and evidence. The PR demo has 8 chapters, 48 beats, and an estimated 7:42 at 1×. Its ticket, code, and test inventory are explicitly fictional and embedded in Sources.

Requires Node 22.12 or newer for authoring. Viewing requires only a current desktop browser with JavaScript enabled.

```sh
npm ci
npm run build:examples
npm run validate -- examples/pr-review.json
npm run build -- examples/pr-review.json dist/my-review.html
```

The last command validates the JSON and writes exactly one HTML file. It prints the absolute path and size. Each sample is about 5.1 MiB, mostly the bundled Mermaid library. No network or additional files are required to render it. Do not double-click the JSON; open the generated HTML.

## Create a briefing through Codex

This repository includes [.agents/skills/contextcast/SKILL.md](.agents/skills/contextcast/SKILL.md), available to Codex when working here. Example request:

> Use $contextcast to explain this PR for an engineer joining the review. Research its linked requirement, implementation, and tests. Write briefings/review.json and compile dist/review.html. Label unavailable evidence and potential concerns.

The skill produces JSON plus the HTML deliverable. It does not fetch sources from the viewer or post review comments. To use it elsewhere, make this repository's compiler available and install/copy the skill into that agent's supported skill directory; update its repository location if needed. The skill uses the general Agent Skills format and can be placed in Claude Code's supported skill location as well.

## Authoring contract

See [the TypeScript/Zod schema](src/schema/briefing.ts) and [complete sample](examples/pr-review.json). `schemaVersion` is `"1"`. Unsupported versions fail explicitly; migration requires an author to update the input rather than silently reinterpret it. Unknown fields fail validation, including per-briefing scripts or audio payloads.

Top-level fields: `id`, `title`, `kind`, `subtitle`, `provenance`, `language`, `settings`, `sources`, `scenes`. All briefing, scene, beat, source, and visual item IDs are globally unique. Each scene has `id`, `title`, `layout`, matching `visual`, and one or more `beats`. A beat contains `id`, plain-text `speech`, optional `caption` and `cue`, and declared `sourceIds`. Narration is always the exact transcript; caption is only a shorter stage display.

Six layouts: `title`, `bullets`, `diagram`, `code`, `comparison`, `finding`. Code includes filename, language, start line, excerpt, accessible description, and optional highlight ranges. Line emphasis is CSS; no token syntax highlighter. Diagrams support Mermaid flowcharts and sequence diagrams. Their descriptions are mandatory, configuration directives are disallowed, and failures show the original source. Findings separate severity from `confirmed`, `potential`, or `needs verification` status.

Sources require a label and an HTTPS URL or an embedded plain-text excerpt. Embedded evidence supports local/private material without inventing public links. External links are opened only on a user click. HTTP, credentials in URLs, and dangerous schemes are rejected. Use commit-pinned links and small excerpts. No secrets should be included in artifacts.

Cues: `focus` targets an item ID or `line-42`; `reveal` targets an item; `callout` carries text; `none` resets focus. Reveal state is recomputed from the scene's preceding beats after every seek. Mermaid focus uses a stable text overlay rather than fragile SVG selectors. A missing cue target is harmless.

## Playback and privacy

- Play/Pause, approximate ±5s, estimated timeline seeking, previous/next chapter, transcript seeking, and 0.25×–10× speed.
- One utterance at a time. Real `end` events advance beats. Generation tokens ignore stale callbacks after cancellation. No boundary events are needed.
- Timeline estimate: `(max(2, words × 60 / WPM) + 0.35) / rate` seconds per beat, default 150 WPM. Progress uses a monotonic clock only while speech runs, clamps within the beat, and reconciles on completion. Seeking snaps to the closest beat boundary; repeated skips always move to another beat when one exists. It is not precise audio seeking.
- Rate or voice changes restart the current beat; paused navigation stays paused. At completion, **Replay** starts from the beginning.
- Local voices are preferred, including asynchronous `voiceschanged` loading. Local selections and speed are persisted if storage is available. Remote/unknown voices are never selected or restored automatically. Selecting one asks for affirmative confirmation for that session. Local/remote labels reflect browser reports, not an absolute privacy guarantee.
- The HTML assets work offline. Voice availability and offline speech depend on the browser/OS. Remote voices may send narration to their provider. ContextCast does not supply a voice service and does not upload content itself. A content-security policy blocks network requests by page code; browser/OS speech services are outside that policy.
- No speech API, no voices, or a speech error leaves chapters, code, diagrams, evidence, and transcript usable. Speech errors offer retry. Voices can be installed/enabled through the OS/browser.
- Hidden tabs pause automatically. Resume explicitly after returning. Leaving the page cancels speech. Settings storage failure is harmless.

Keyboard shortcuts: **Space/K** play or pause; **←/→** seek approximately 5 seconds; **J/L** seek approximately 10 seconds; **</>** (Shift + comma/period) decrease/increase speed by 0.25× between 0.25× and 10×; **Shift+←/→** change chapter; **0–9** seek to 0–90% of the estimated timeline; **Home/End** first/last beat; **T** toggle transcript; **F** fullscreen; **?** shortcut reference; **Esc** close dialogs or exit fullscreen. Speed changes restart the current beat and preserve paused state. Actual speaking speed depends on the selected browser/OS voice. Letter shortcuts work after clicking buttons, while focused buttons retain native Space/Enter behavior. Text fields, selects, sliders, open dialogs, and Ctrl/Alt/Meta combinations retain native keys. The compact desktop layout keeps controls visible without page scrolling; chapters and transcript scroll independently. Voice selection lives under **Voice**. At narrow widths the transcript stacks below the stage.

## Develop and verify

```sh
npm run typecheck
npm test
npm run build:examples
npm run test:browser
# Or all of the above:
npm run check
```

Browser tests use installed Chrome through Playwright, headless, directly against `file://` artifacts. To use Edge in PowerShell:

```powershell
$env:CONTEXTCAST_BROWSER = 'msedge'
npm run test:browser
```

If no browser is installed, install Chrome/Edge first. Browser tests fail rather than silently skip. Automated speech tests use a mock adapter or mock browser synthesis to test asynchronous voices, cancellation races, pause/resume, completion, replay, missing speech, and remote voice consent. A native browser test independently checks speech API/voice enumeration, offline rendering, both diagram types, sources, chapters, and 1280×720 / narrow viewports. These do not prove audible voice quality; listening on the intended OS/browser is still a manual check. See [verification notes](docs/verification.md).

## Implementation decisions

Vanilla TypeScript, Zod 3.25.76, esbuild 0.25.12, and Mermaid 12.2.0. Dependencies are pinned, including the lockfile's transitive resolutions. No Reveal.js: a small DOM renderer and a single controller provide chapter/beat navigation directly, avoiding a second slide state machine. Mermaid is bundled into the HTML in strict mode, with no CDN, fonts, lazy external chunks, or runtime source fetching. The authoring repository remains modular; each deliverable is self-contained.

Plain content uses DOM `textContent`. JSON escapes HTML delimiters; the compiler also protects script end tags in vendor strings. Only strict-mode Mermaid's sanitized SVG is parsed into a DOM. A hash-based script policy blocks arbitrary injected scripts, and the viewer blocks page-initiated networking. These measures do not make unknown HTML from other authors trusted.

Relevant upstream references: [MDN SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis), [voice localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService), and [Mermaid usage](https://mermaid.js.org/config/usage).

Scope: no video/audio export, viewer-side chat, external source fetching, cloud hosting, or exact speech seeking. Firefox and Safari are compatibility targets requiring manual testing; no universal browser support claim. Keep narration beats short because some browser/voice combinations pause poorly or have platform-specific synthesis quirks.
