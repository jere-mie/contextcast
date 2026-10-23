# PR story and evidence

The useful sequence is business intent, requirement, existing behavior, implementation, risk, tests, and review decision. Merge or split scenes to fit the actual material; this is not a fixed slide count.

Collect the linked requirement, base/head revision, relevant surrounding code, provider/library contracts, and tests. Record which tests were actually run. Distinguish supplied reports from executed results. Prefer evidence URLs pinned to the reviewed commit and line range. Embedded excerpts are suitable for private/local material; label their origin and avoid publishing secrets.

For each concern, connect trigger → observed code path → possible consequence → missing guarantee → proposed action. `confirmed` requires direct evidence of the claimed behavior; `potential` describes a plausible concern; `needs verification` marks an unresolved question. Severity is impact, not confidence. Do not turn incomplete evidence into a definite defect.

Give a copy-friendly proposed review comment with a targeted question, a useful regression test, or a minimal remedy. Do not post it. If source access is missing, narrate that limitation and avoid pretending to have reviewed the full PR. The bundled fictional sample demonstrates the player, not a real review.
