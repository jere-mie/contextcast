# ContextCast

Small, editable HTML technical briefings with browser-native narration, diagrams, code, chapters, a transcript, and evidence links.

Open [the fictional PR review](dist/example-pr-review.html) or [architecture walkthrough](dist/example-architecture.html) in Chrome or Edge. Press **Play** to listen. The review has 8 chapters and 48 beats, about 7:42 at 1×. Its ticket, code, and test report are fictional and embedded in Sources.

**CDN loading is the standard and recommended approach.** Mermaid 12.2.0 loads from a pinned jsDelivr URL only when a diagram is opened. No vendor library is embedded. The PR HTML is about 78 KiB; the architecture HTML is about 56 KiB. Both contain readable CSS, player JavaScript, and formatted briefing JSON. There is no offline-bundle build mode.

## Author a briefing

Install or copy [the contextcast skill folder](.agents/skills/contextcast) into your agent's skills directory. The entire authoring package lives there:

```text
contextcast/
  SKILL.md
  assets/template.html
  assets/pr-review.json
  assets/architecture.json
  scripts/build.mjs
  scripts/validate.mjs
  references/
```

The skill is portable: no checkout location to configure, no npm install, TypeScript, or bundler. You only need Node.js 22.12+ to run the small build script. Give your agent the skill and access to the code/PR/documents you want explained:

> Use $contextcast to explain this PR. Investigate the requirement, implementation, and tests. Produce a narrated briefing with diagrams and evidence. Label missing sources and potential concerns. Save the JSON and small HTML artifact.

The agent starts from an example and runs:

```sh
node /path/to/contextcast/scripts/build.mjs review.json review.html
```

The command validates and writes one HTML file. Recipients need only a browser. No accounts, API keys, audio assets, source integrations, or server are required by the viewer. Research access is provided by the author's agent.

## Edit the HTML directly

Briefing content lives in the pretty-printed `<script id="briefing-data" type="application/json">` block. Change titles, narration, scenes, cues, or evidence there and reload the file. The player validates the edited content on opening. No rebuild or script-hash regeneration is necessary. Keep embedded JSON valid; encode `<` as `\u003c` so text cannot close the script element. The build script handles escaping for you when starting from a JSON file.

CSS and player code are also readable in the same file. Reuse the template and controller instead of having the agent recreate speech handling for every briefing. Do not inline downloaded libraries or turn the output into a minified blob. The separate JSON can remain your source of truth for repeatable generation.

## Content and controls

Six layouts: `title`, `bullets`, `diagram`, `code`, `comparison`, and `finding`. Scenes contain short narration beats; the beat drives the visual. Sources accept HTTPS URLs or embedded excerpts. Findings separate severity from confirmed, potential, or needs-verification status. Diagrams support flowcharts and sequence diagrams in Mermaid strict mode; configuration directives are disallowed. Code uses line emphasis.

See the [examples](.agents/skills/contextcast/assets), [scene guide](.agents/skills/contextcast/references/scene-design.md), [portable validator](.agents/skills/contextcast/scripts/validate.mjs), and [development TypeScript schema](src/schema/briefing.ts). Version `1` is required; unknown versions, fields, duplicate IDs, broken references, unsafe URLs, Markdown narration, and per-briefing scripts/audio fail validation.

Keyboard shortcuts:

| Key | Action |
|---|---|
| Space / K | Play / pause |
| ← / → | Seek approximately 5 seconds |
| J / L | Seek approximately 10 seconds |
| < / > | Speed ±0.25×, from 0.25× to 10× |
| Shift + ← / → | Previous / next chapter |
| 0–9 | Seek to 0–90% of the estimated timeline |
| Home / End | First / last beat |
| T | Toggle transcript |
| F | Fullscreen |
| ? / Esc | Shortcut help / dismiss |

Letter shortcuts work after clicking buttons. Native form controls and modifier combinations retain their keys. Speed/voice changes restart the current beat and preserve paused state. Actual speaking speed depends on the browser/OS voice. Desktop controls remain visible; content, chapters, and transcript scroll independently.

## Speech and network behavior

Speech starts only on Play. Local voices are preferred; selecting a remote/unknown voice requires explicit session consent. Settings persistence is optional. The player pauses when hidden and cancels speech on leaving the page. No working speech service leaves the transcript and manual navigation usable.

Timing is approximate: `(max(2, words × 60 / WPM) + 0.35) / rate` seconds per beat, default 150 WPM. Real utterance completion advances beats; boundary events are unused. Seeking snaps to beat boundaries and cancellation generation tokens discard stale speech callbacks.

The only page-initiated network dependency is the pinned Mermaid script, loaded on demand. There is no CDN request until a diagram is opened, and no viewer source fetching or analytics. A failed CDN shows the diagram description and source; the rest of the briefing still works. This fallback is not an offline distribution mode. CDN code executes in the page; network/privacy requirements should account for that. Browser/OS speech services operate separately and may use remote voices.

Content is treated as data, using escaped JSON and DOM text nodes. Mermaid sanitizes SVG in strict mode. The content security policy permits editable inline player scripts and the exact pinned Mermaid script URL, while blocking page data requests. Editability means the inline player is not hash-locked; do not treat arbitrary HTML from unknown authors as trusted.

## Maintain ContextCast

Only development of the shared player/template needs the repository's TypeScript/npm toolchain:

```sh
npm ci
npm run check
```

`npm run build:examples` refreshes the portable skill template/examples and rebuilds both demo HTML files. `npm run refresh:skill` refreshes just the skill package. Development-only compilation remains available as `npm run build -- input.json output.html`; authors should use the portable `node .../scripts/build.mjs` command above.

Tests cover schema parity, speech races, seeking, the full speed range, output size/readability, a copied skill running without node_modules, direct file opening, on-demand CDN diagrams, and CDN failure. Browser tests require installed Chrome, or set `CONTEXTCAST_BROWSER=msedge` for Edge. See [verification notes](docs/verification.md). Firefox and Safari have not been tested.

Vanilla TypeScript, Zod 3.25.76 for development validation, esbuild 0.25.12 for maintaining the template, Mermaid 12.2.0 from CDN. No Reveal.js: one controller owns scene and speech state. Upstream: [Web Speech](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis), [Mermaid usage](https://mermaid.js.org/config/usage).
