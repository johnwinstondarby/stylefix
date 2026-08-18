# StyleFix

StyleFix is an Adobe InDesign ExtendScript utility for auditing imported and automatically generated style debris before any styles are deleted or consolidated.

## v1.0.1 scope

StyleFix v1.0.1 is read-only and initially focuses on **character styles whose names begin with `Unnamed Style`**. This is the pattern currently observed in the production document after Word content was imported into InDesign.

For every candidate style, v1.0.1 records:

- style name and ID;
- whether InDesign reports the style as imported;
- the style it is based on;
- direct text-style-range usage count;
- approximate number of characters carrying the style directly;
- page locations and sample text for direct uses;
- known document dependencies and indirect references;
- audit warnings when direct-usage or dependency checks cannot be completed;
- candidate formatting equivalence to an existing named character style;
- a conservative deletion-risk classification;
- a suggested next action.

No style, text, or document structure is changed in v1.0.1.

### v1.0.1 fix

v1.0.1 fixes the first-run `Error 21: undefined is not an object` raised while assembling audit rows. The `emptyUsage()` initializer now creates the `samples` array used by CSV/UI reporting. Audit behavior and risk classification are otherwise unchanged.

## Risk model

| Risk | Meaning |
| --- | --- |
| `LOW` | No direct text usage, no known dependency, and the dependency scan completed without warnings. Candidate for guarded deletion in a later version. |
| `MEDIUM` | One or more dependency checks could not be completed. Manual review is required before deletion. |
| `HIGH` | The style is directly applied to text or referenced by another document construct, and no single canonical equivalent was found. |
| `REPLACE` | The style is used or referenced and exactly one existing named character style has the same audited formatting fingerprint. Candidate for replacement followed by deletion, subject to field validation. |

`LOW` deliberately means more than unused. StyleFix requires both zero direct use and zero known dependencies before assigning LOW risk.

## Dependency coverage

v1.0 checks common InDesign character-style reference paths, including:

- other character styles using the candidate through `basedOn`;
- paragraph-style drop caps;
- paragraph-style bullets and numbering;
- nested styles;
- nested GREP styles;
- nested line styles;
- character-style running-header text variables;
- cross-reference formats and cross-reference building blocks;
- hyperlink text sources;
- cross-reference text sources;
- TOC page-number and separator styles;
- index-generation character styles;
- index page-number style overrides.

If a direct-usage scan or one of these dependency checks cannot be completed, an otherwise unused/unreferenced candidate is prevented from receiving LOW risk and is classified MEDIUM instead. A style with confirmed usage or dependencies remains HIGH unless it qualifies for a verified replacement candidate.

## Canonical-style matching

StyleFix compares each unnamed character style against existing named character styles using a formatting fingerprint composed from key character attributes such as font, font style, point size, leading, tracking, position, scaling, baseline shift, fill/stroke, and related character settings.

A match is a **candidate equivalence**, not an automatic replacement decision. v1.0 reports it for review. Remediation is deferred until production results establish that the comparison is sufficiently reliable.

## UI

The v1.0 palette provides:

- **Rescan**
- **Locate First Use**
- double-click to locate the first direct use
- **Save CSV**
- **Close**

Rows are sorted with higher-risk findings first.

## Planned remediation

After field validation, a remediation release can add the multi-select pattern used by the other InDesign QA utilities:

- Ctrl-click and Shift-click selection;
- **Delete Selected Safe Styles** for re-verified LOW-risk candidates;
- **Replace Selected With Canonical Style** for explicitly mapped candidates;
- immediate re-check of usage and dependencies before every mutation;
- zero-reference verification before deletion;
- automatic rescan and Corrected / Skipped / Could not verify reporting;
- no unrestricted Delete All operation.

## Compatibility

The script is written for Adobe InDesign ExtendScript / ECMAScript 3 compatibility.
