# StyleFix

StyleFix is an Adobe InDesign ExtendScript utility for auditing imported and automatically generated character-style debris before any styles are deleted or consolidated.

## v1.0.3 scope

StyleFix v1.0.3 remains read-only. It audits the two imported-style families observed in the production document:

- `Unnamed Style *`
- `Word Imported List Style*`

No style, text, or document structure is changed in v1.0.3.

## Peer-review hardening in v1.0.3

v1.0.3 incorporates the correctness and reporting findings from peer review before remediation is allowed.

### Recursive direct-usage scanning

Direct-use detection now walks:

- ordinary story text;
- table-cell text;
- nested tables;
- footnotes; and
- endnotes when exposed by the installed InDesign DOM.

This closes the prior blind spot where a character style used only inside a table cell could appear unused.

Page reporting now uses all parent text frames available for each discovered range before falling back to first/last insertion points.

### One-pass dependency map

Dependency sources are walked once per document and indexed by candidate character-style identity instead of being re-walked for every candidate.

The dependency audit covers, where exposed by the installed DOM:

- character-style `basedOn` relationships;
- paragraph-style drop-cap, bullet, and numbering character styles;
- nested styles;
- nested GREP styles;
- nested line styles;
- text-variable character-style references using `appliedStyle`;
- cross-reference formats and building blocks;
- hyperlink and cross-reference text sources;
- TOC page-number and separator styles;
- footnote and endnote marker styles;
- index options and index page-reference overrides; and
- XML import/export style-map collections when the installed DOM exposes a recognizable character-style reference.

Unsupported/version-specific dependency paths are reported as **N/A** rather than audit failures. A supported check that begins and then fails is still reported as a dependency warning.

### Style identity

Candidate matching now prefers:

1. style ID;
2. full InDesign specifier; then
3. fully qualified style path.

Leaf-name fallback is no longer used. This prevents two same-named character styles in different style groups from being cross-attributed.

### Fingerprint schema validation

The fingerprint property list is probed against real character styles at scan start. Properties that cannot be read are removed from the active fingerprint and reported as fingerprint warnings.

The language property is `appliedLanguage`. `otfFigureStyle` is also included only when the installed DOM confirms it is readable.

A style whose active audited properties are all `NOTHING` remains classified as `EMPTY SHELL` and does not participate in canonical replacement matching.

### Global evidence and risk

A global usage-scan or dependency-scan failure still blocks an otherwise unused style from receiving `LOW`, because document-wide deletion safety has not been established.

A global usage warning no longer automatically suppresses `REPLACE` for a style with confirmed use or dependency. Replacement classification still requires exactly one canonical fingerprint match and a clean fingerprint schema.

### Book scope

StyleFix checks open InDesign books. If the active document is identified as a member of an open `.indb`, or book membership cannot be established safely, document-only evidence cannot receive `LOW`.

This prevents a style from being called safe merely because it is unused in one chapter while another open book chapter may still use it.

### Palette and CSV

v1.0.3 adds:

- a multi-column list with headers;
- `multiselect: true` in preparation for the remediation release;
- LOW-first sorting for the future deletion workflow;
- UTF-8 BOM in CSV output for Excel on Windows;
- separate usage warnings, dependency warnings, dependency N/A notes, fingerprint warnings, and book scope;
- point-based scan measurement settings, restored after the scan; and
- document-state guards so **Rescan**, **Locate First Use**, and **Save CSV** do not fail after the active document is closed.

## Risk model

| Risk | Meaning |
| --- | --- |
| `LOW` | No direct text usage, no known dependency, usage/dependency scans completed, and book scope does not block document-only safety. Candidate for guarded deletion in a later version. |
| `MEDIUM` | No confirmed use or dependency, but usage/dependency evidence is incomplete or open-book scope prevents a document-only LOW result. |
| `HIGH` | The style is directly used or referenced and does not have one clean canonical replacement match. |
| `REPLACE` | The style is directly used or referenced and exactly one non-imported, substantive canonical character style has the same validated formatting fingerprint. Diagnostic only in v1.0.3. |

`LOW` means more than unused. It requires zero direct use, zero known dependencies, complete supported audit coverage, and acceptable document/book scope.

## Recommended tool order

For the current InDesign QA toolset, the preferred production order is:

1. **DocStats** for broad document inventory and discrepancy discovery.
2. **HeaderFix** for the fixed section markers.
3. **NormalFix** for body-text paragraph cleanup and `CLI Code Red Body` conversion.
4. **TableFix** for table semantics, table paragraph styles, and `CLI Code Red Table` preservation.
5. **StyleFix** for imported-style debris audit and, in a future remediation release, consolidation/deletion.
6. **DocStats** again for final validation before export.

NormalFix and TableFix should establish the canonical red CLI character styles before any future StyleFix replacement operation. This keeps StyleFix from consolidating imported red styles before the position-aware NormalFix/TableFix passes have completed.

## Planned remediation

After v1.0.3 passes production validation, the remediation release will use the multi-select pattern already established in the other InDesign QA tools:

- Ctrl-click and Shift-click selection;
- **Delete Selected Safe Styles** for re-verified LOW-risk candidates;
- **Replace Selected With Canonical Style** for explicitly mapped candidates;
- immediate usage/dependency/book-scope re-check before every mutation;
- zero-reference verification before deletion;
- automatic rescan and Corrected / Skipped / Could not verify reporting;
- no unrestricted Delete All action.

## Compatibility

The script is written for Adobe InDesign ExtendScript / ECMAScript 3 compatibility.
