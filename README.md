# StyleFix

StyleFix is an Adobe InDesign ExtendScript utility for auditing imported and automatically generated style debris before any styles are deleted or consolidated.

## v1.0.5

StyleFix v1.0.5 remains read-only. It audits character styles in the two imported-style families observed in production:

- `Unnamed Style *`
- `Word Imported List Style*`

It also performs a paragraph-style census for those same name families so a zero character-style count cannot hide a similarly named paragraph-style population.

No style, text, or document structure is changed in v1.0.5.

### v1.0.5 canary hotfix

The first v1.0.4 canary run failed with InDesign Error 55 because the recursive walker attempted to obtain `endnotes` from generic descended text containers. Generic Text objects do not expose that collection in the tested ExtendScript DOM.

v1.0.5 removes document-level and generic-container `endnotes` probing. Endnote content is discovered by scanning document stories and classifying a story whose `isEndnoteStory` property is true as ENDNOTE context. This keeps direct-use scanning inside the Story API surface and allows endnote text-style ranges to flow through the same usage scanner as ordinary stories.

The failed v1.0.4 run is recorded in `CANARY_FAILURE_v1.0.4.md` and is not release evidence.

### Safeguards carried forward

v1.0.5 includes:

- recursive direct-use scanning across ordinary stories, table cells, nested tables, footnotes, endnote stories, and overset/no-page text;
- a one-pass dependency index;
- style identity by ID, specifier, then fully qualified path;
- fingerprint property validation using `appliedLanguage`;
- EPUB/HTML `styleExportTagMaps` inspection;
- a paragraph-style census for the candidate naming families;
- an explicit delete-after-replace evidence gate;
- book-scope checks;
- multi-column `multiselect: true` UI in preparation for later remediation;
- LOW-first sorting;
- UTF-8 BOM for CSV output;
- point-normalized fingerprint measurements;
- document-state guards; and
- a provenance header in every CSV with script/release version, run time, document identity, InDesign version/build, book-scope determination, fingerprint schema, warnings, and risk/candidate counts.

`EMPTY SHELL` and `SUBSTANTIVE` are formatting-state attributes. They are not risk classifications. A formatting-empty style can still carry export semantics.

## Risk model

| Risk | Meaning |
| --- | --- |
| `LOW` | No direct text use, no dependency or export mapping, supported scans completed, and book scope permits document-only safety. |
| `MEDIUM` | No confirmed use or dependency, but deletion-safety evidence is incomplete or book scope blocks LOW. |
| `HIGH` | Direct use without one clean canonical match, or a dependency/export mapping that must be resolved. |
| `REPLACE` | Direct use, no known dependency/export mapping, and exactly one non-imported substantive canonical character style has the same validated fingerprint. Diagnostic only in v1.0.5. |

A future delete-after-replace action must satisfy the same evidence completeness required for LOW and must finish with a zero-reference rescan. `REPLACE` alone never authorizes deletion.

## Canary gate

`StyleFix Canary Test.md` is the binding acceptance test for scanner completeness before any remediation release.

Repository artifacts:

- `StyleFix Canary Test.md` defines the control matrix and pass criteria.
- `BuildCanary.jsx` creates a new scratch InDesign fixture. It never edits the active production document.
- `CANARY_EXPECTED.csv` records the expected result for every control.
- `VERSION` is the repository release marker.

Run `BuildCanary.jsx` first. The builder writes a scratch INDD and build log to the Desktop. A build with any failed construction step is invalid and must not be used as release evidence.

Then run `StyleFix.jsx` against the fixture and save the CSV. The canary release is blocked by any failed control in `StyleFix Canary Test.md`.

The direct-use matrix includes ordinary story text, table cells, nested tables, footnotes, endnotes, overset text, pasteboard and parent-page stories, anchored frames, grouped frames, hidden and locked layers, threaded stories, and a parent-page table.

Dependency controls cover bullets, nested GREP, TOC page-number styles, cross-reference building blocks, hyperlink text sources, footnote markers, and `basedOn`.

Formatting/export controls verify empty-shell behavior, export-tag safety, single-match replacement, tracking-only mismatch, and duplicate canonical matches.

## EPUB semantic safety

For each candidate character style, StyleFix inspects `styleExportTagMaps` when exposed by the installed InDesign DOM. An explicit export map counts as a semantic dependency and prevents LOW.

If export-tag-map inspection cannot be completed, LOW is blocked.

## Book scope

StyleFix checks open InDesign books and also reports nearby `.indb` files as potential unresolved scope.

Runtime inspection cannot prove membership in an unopened book located elsewhere. Book scope remains a documented production precondition in addition to the runtime checks.

## Recommended tool order

1. **DocStats** for broad document inventory and discrepancy discovery.
2. **HeaderFix** for fixed section markers.
3. **NormalFix** for body-text paragraph cleanup and `CLI Code Red Body` conversion.
4. **TableFix** for table semantics, table paragraph styles, and `CLI Code Red Table` preservation.
5. **StyleFix** for imported-style debris audit and future guarded consolidation/deletion.
6. **DocStats** again for final validation before export.

NormalFix and TableFix should establish canonical red CLI character styles before any future StyleFix replacement operation.

## Planned remediation

Remediation remains disabled until the canary passes on the same InDesign build used for production.

The planned release will use the established multi-select pattern:

- Ctrl-click and Shift-click selection;
- **Delete Selected Safe Styles** for re-verified LOW candidates;
- **Replace Selected With Canonical Style** for explicitly reviewed matches;
- immediate usage/dependency/export/book-scope re-check before every mutation;
- zero-reference verification before deletion;
- automatic rescan and Corrected / Skipped / Could not verify reporting;
- no unrestricted Delete All operation.

## Compatibility and repository layout

The scripts are written for Adobe InDesign ExtendScript / ECMAScript 3 compatibility.

`StyleFix.jsx` is the v1.0.5 loader and the `src/StyleFix.part*.jsxinc` files contain the audited implementation. Keep the `src` folder beside `StyleFix.jsx` when running the repository version. The loader assembles the source in order and reports a missing-component error rather than running a partial artifact.

A self-contained deployable `StyleFix.jsx` is planned after the canary passes, so packaging changes do not obscure scanner correctness during this test cycle.