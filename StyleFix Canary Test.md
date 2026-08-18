# StyleFix Canary Test

Acceptance test that must pass before any StyleFix release is permitted to
delete or replace a style in a production document.

## Why a fixture and not the manuscript

A production scan cannot prove scanner completeness. If the scanner fails to
look inside table cells, the manuscript reports zero uses for a style that is
in use, and the report looks clean. A clean production result is therefore
consistent with both a correct scanner and a broken one.

The canary inverts this. It is a document whose correct answer is known in
advance, so the scan is graded against a fixed expectation rather than
interpreted.

Two control classes are required:

- **Positive controls.** Styles placed in locations the scanner must reach.
  Each must report usage or a dependency, and none may receive LOW.
- **Negative controls.** Styles that genuinely are unused and unreferenced.
  Each must receive LOW.

Without negative controls, a scanner that classifies nothing as LOW passes the
test while being useless.

## Fixture construction

Build the fixture with a script, `BuildCanary.jsx`, rather than by hand. A
generated fixture is reproducible, reviewable in the repository as text, and
survives InDesign version changes. Commit the generator and the expected
result file. Rebuild and re-run after every version bump.

Run the canary on the same InDesign build used for production. Dependency and
usage coverage vary by DOM version, and a pass on one build does not carry to
another.

Name the canary styles inside the production candidate families so that the
candidate pattern matching is also under test.

## Placement matrix

Positive controls. Each style is applied to text in exactly one location.
Expected result for all of them: direct runs at least 1, risk not LOW.

| ID  | Location |
| --- | --- |
| C01 | Ordinary story text |
| C02 | Table cell |
| C03 | Cell of a table nested inside another cell |
| C04 | Footnote text |
| C05 | Endnote text |
| C06 | Overset text in an undersized frame |
| C07 | Text frame on the pasteboard |
| C08 | Text frame on a parent (master) page |
| C09 | Anchored inline text frame |
| C10 | Text frame inside a group |
| C11 | Text frame on a hidden layer |
| C12 | Text frame on a locked layer |
| C13 | Threaded story spanning three pages |
| C14 | Table placed on a parent (master) page |

C06 additionally verifies that unresolved pages are reported rather than
dropped. C13 additionally verifies page-range reporting.

## Dependency-only controls

Zero text application. Expected result for all of them: dependency count at
least 1, risk not LOW.

| ID  | Reference path |
| --- | --- |
| D01 | Bullet character style on a paragraph style |
| D02 | Nested GREP style on a paragraph style |
| D03 | Page-number style on a TOC style entry |
| D04 | Cross-reference format building block |
| D05 | Hyperlink text source character style |
| D06 | Footnote marker style |
| D07 | `basedOn` parent of another character style |

## Formatting and export controls

| ID  | Setup | Expected |
| --- | --- | --- |
| E01 | No attributes set, unused, unreferenced, no export mapping | LOW, formatting state EMPTY SHELL |
| E02 | No attributes set, unused, unreferenced, custom export tag and class | Not LOW |
| F01 | Substantive, unused, unreferenced, fingerprint identical to one canonical style | LOW, match recorded in the report |
| F02 | Substantive, used once, fingerprint identical to exactly one canonical style | REPLACE, match count 1, correct target named |
| F03 | Substantive, used once, fingerprint differing from canonical by tracking only | HIGH, match count 0 |
| F04 | Substantive, used once, fingerprint identical to two canonical styles | HIGH, match count 2 |

E02 is the control for export-tag safety. F03 is the control against
over-matching, which is the failure mode that causes a wrong replacement.

## Cross-class census control

| ID  | Setup | Expected |
| --- | --- | --- |
| P01 | A **paragraph** style named inside a candidate family | Reported in the paragraph census; absent from the character-style candidate list |

This confirms that a zero count in one style class is reported as a class
boundary rather than as evidence of absence.

## Book scope control

Run the canary with no InDesign book open. If every candidate returns MEDIUM,
the book gate is firing on a document that has no book membership, and the gate
logic needs correction before the production run.

Note the limit of the runtime check: the DOM can only see books that are
currently open. A document may belong to a book that is closed, and no script
can determine that. Book scope is therefore a documented precondition, not a
verified fact.

## Pass criteria

The release is blocked unless all of the following hold on a single run.

1. C01 through C14 each report direct runs of at least 1, and none is LOW.
2. D01 through D07 each report a dependency count of at least 1, and none is LOW.
3. E02 is not LOW.
4. The complete set of LOW results is exactly E01, F01, and any dedicated
   unused negative controls. No other style is LOW.
5. F02 is REPLACE with a match count of 1 naming the correct canonical style.
6. F03 and F04 are HIGH.
7. P01 appears in the paragraph census and not in the character-style
   candidate list.
8. The fingerprint schema probe reports zero dropped properties, or the
   dropped properties are listed in the run record and reviewed.

Any single failure blocks the production run. A partial pass is not a pass,
because the failures indicate which locations the scanner cannot see, and the
production document contains all of those locations.

## Run record

Every canary run and every production CSV carries a provenance header:

- script version and release tag;
- run timestamp;
- document name and document modification date;
- InDesign version and build;
- book scope determination and how it was established;
- fingerprint schema probe result, including dropped properties;
- candidate family patterns in effect;
- counts by risk classification.

A CSV without this header cannot be audited later and should not be entered
into the record.
