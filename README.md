# StyleFix

StyleFix is an Adobe InDesign ExtendScript utility for auditing imported and automatically generated character-style debris before any styles are deleted or consolidated.

## v1.0.2 scope

StyleFix v1.0.2 is read-only. It expands the audit to the two imported-style families observed in the production document:

- `Unnamed Style *`
- `Word Imported List Style*`

For every candidate style, the audit records:

- family, style name, and style ID;
- whether InDesign reports the style as imported;
- the style it is based on;
- direct text-style-range usage count;
- approximate number of characters carrying the style directly;
- page locations and sample text for direct uses;
- usage-scan warnings, including the Story ID and error when a story cannot be completely scanned;
- known document dependencies and indirect references;
- dependency-scan warnings, identifying the dependency check that failed;
- whether the style contains substantive formatting or is an `EMPTY SHELL` whose audited formatting properties are all `NOTHING`;
- candidate formatting equivalence to an existing canonical character style when substantive formatting exists;
- conservative deletion risk;
- suggested next action.

No style, text, or document structure is changed in v1.0.2.

## Diagnostic refinements in v1.0.2

The first production audit showed 84 `Unnamed Style *` entries with zero direct use and zero detected dependencies, but each row carried one undifferentiated audit warning. It also showed many `Word Imported List Style*` entries being offered as canonical matches because both style families appeared to contain no substantive formatting.

v1.0.2 makes four refinements:

1. **Usage and dependency warnings are separated.** The CSV now reports `Usage Warning Count`, `Usage Warnings`, `Dependency Warning Count`, and `Dependency Warnings` independently.
2. **Warning sources are identified.** Usage warnings include the Story ID that could not be completely scanned. Dependency warnings name the failing dependency check and include the InDesign error when available.
3. **Imported styles are excluded from canonical matching.** `Unnamed Style *`, `Word Imported List Style*`, any `Word Imported ...` style, and any style InDesign explicitly reports as imported cannot serve as canonical replacement targets.
4. **Empty-shell styles do not participate in canonical matching.** If every audited character-formatting property is `NOTHING`, the style is classified as `EMPTY SHELL` and no equivalent canonical style is proposed.

## Risk model

| Risk | Meaning |
| --- | --- |
| `LOW` | No direct text usage, no known dependency, and no usage or dependency scan warning. Candidate for guarded deletion in a later version. |
| `MEDIUM` | No confirmed use or dependency, but one or more audit checks were incomplete. Review the named warning before deletion. |
| `HIGH` | The style is directly applied to text or referenced by another document construct, or a used/referenced style has incomplete audit coverage. |
| `REPLACE` | The style is used or referenced and exactly one non-imported, substantive canonical character style has the same audited formatting fingerprint. Candidate for replacement followed by deletion after field validation. |

`LOW` deliberately means more than unused. StyleFix requires zero direct use, zero known dependencies, and complete audit coverage.

## Dependency coverage

v1.0.2 checks common InDesign character-style reference paths, including:

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

Any failed check is reported by name instead of being collapsed into one generic warning count.

## Canonical-style matching

Canonical replacement candidates must now be:

- named character styles outside the two debris families;
- not named `Word Imported ...`;
- not explicitly reported by InDesign as imported; and
- substantively formatted.

StyleFix compares substantive candidates using key character attributes such as font, font style, point size, leading, tracking, position, scaling, baseline shift, fill/stroke, and related character settings.

A canonical match remains diagnostic evidence only. v1.0.2 performs no replacement.

## UI

The palette provides:

- **Rescan**
- **Locate First Use**
- double-click to locate the first direct use
- **Save CSV**
- **Close**

Rows remain single-select in the audit release. Multi-select is reserved for the remediation phase.

## Planned remediation

After the refined production audit establishes deletion safety, the remediation release will use the same multi-select pattern as the other InDesign QA utilities:

- Ctrl-click and Shift-click selection;
- **Delete Selected Safe Styles** for re-verified LOW-risk candidates;
- **Replace Selected With Canonical Style** for explicitly mapped candidates;
- immediate re-check of usage and dependencies before every mutation;
- zero-reference verification before deletion;
- automatic rescan and Corrected / Skipped / Could not verify reporting;
- no unrestricted Delete All operation.

## Compatibility

The script is written for Adobe InDesign ExtendScript / ECMAScript 3 compatibility.
