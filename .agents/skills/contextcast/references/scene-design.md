# Reusable scene choices

Use the schema and examples for exact field names. Content cannot contain executable JavaScript or arbitrary HTML.

| Layout | Useful for | Payload |
|---|---|---|
| title | Introduction and takeaways | headline, description, 1–6 items |
| bullets | Requirements and decisions | 1–8 items with stable IDs |
| diagram | Control/data flow and interactions | Mermaid definition and accessible description |
| code | Representative implementation | filename, language, code, startLine, highlight ranges, description |
| comparison | Before/after or coverage gaps | beforeTitle, afterTitle, before/after items |
| finding | A review concern or recommendation | status, severity, headline, detail, recommendation |

Supported Mermaid families are flowchart/graph and sequenceDiagram. Configuration directives and frontmatter are disallowed; the viewer controls strict security. Label diagrams conceptual when they simplify evidence. On parse error the viewer exposes readable source text.

Use `focus` to emphasize an item ID, or `line-44` for a code line. Mermaid focus uses a stable text overlay instead of internal SVG selectors. `reveal` applies to item IDs and reconstructs visibility from all beats up to the current beat. Unknown targets degrade gracefully. Every scene must be understandable with speech paused. Use callouts sparingly, for the current point. Code uses CSS line emphasis; no syntax highlighter is required.
