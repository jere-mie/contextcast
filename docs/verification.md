# Verification

Windows, Node 24.16.0, Chrome 155 and Edge 155. Commands run against `file://` HTML artifacts, without a local server.

## Distribution

CDN loading is the standard and recommended mode. There is no offline build option. Mermaid 12.2.0 is loaded only when a diagram is opened, using `https://cdn.jsdelivr.net/npm/mermaid@12.2.0/dist/mermaid.min.js`. The HTML has no embedded third-party libraries, encoded asset blobs, or minified player code.

- PR example: 8 chapters, 48 beats, approximately 7:42 at 1×, about 78 KiB (previously 5.07 MiB).
- Architecture example: 2 chapters, 6 beats, about 56 KiB (previously 5.05 MiB).
- A build test caps the PR example below 100 KiB and checks formatted JSON and readable player code.
- The skill includes its template, examples, and dependency-free scripts. A test copies it into a temporary directory and generates an artifact with plain Node and no node_modules or ContextCast checkout.
- Agents can edit the embedded JSON, CSS, and player in the HTML directly. No integrity/hash regeneration is needed for edits. Runtime validation reports malformed data; generated JSON escapes HTML delimiters.

## Automated coverage

- TypeScript type checking.
- 40 schema, timeline, controller, build, safety, and portable-authoring tests. The portable validator and development Zod schema share positive/negative fixtures.
- Nine browser tests, including actual CDN flowchart and sequence rendering from a local HTML file, and direct data/player edits without rebuilding or updating hashes.
- No CDN requests on first scene, then exactly one pinned library request per briefing that opens a diagram. No narration or evidence content is included in a request URL.
- Blocked-CDN fallback: description/source, transcript, code navigation, and mock narration remain usable.
- Native local-voice utterance completion in Chrome and Edge; mock tests cover asynchronous voices, consent, missing synthesis, cancelled/stale callbacks, paused seeking, replay, and storage failure.
- Full keyboard controls, including all quarter-step rates from 0.25× to 10×, clamp/persistence, pause preservation, modifiers/native-control guards, and fullscreen.
- Malicious HTML/code remains text; invalid diagrams show source; reveals restore after backward seeks.
- No horizontal document overflow at 1280×720 / 390×844; desktop controls fit without page scrolling.

Screenshots are written to ignored `test-results/`. Human evaluation of pronunciation and long-session voice quality remains a useful manual check. Firefox and Safari were unavailable and have not been tested.

## Implementation notes

Mermaid is configured with strict security and no diagram-authored configuration overrides. Returned sanitized SVG is parsed into the DOM. Diagram promises are cached. The inline controller is library-free, speaks one beat at a time, and uses generation tokens rather than unreliable boundary events.

The content security policy permits editable inline scripts and the exact Mermaid CDN URL. This intentionally replaces the old inline script hash so agents can edit the HTML without recomputing it. Content remains escaped/validated; arbitrary third-party HTML remains untrusted. Page data requests are blocked; browser/OS voice services are outside that policy.

Offline bundling is not a recommended workflow or part of the authoring package. CDN failure fallback preserves readability rather than embedding large libraries in every artifact.
