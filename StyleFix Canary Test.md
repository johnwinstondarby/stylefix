# StyleFix Canary Test

Binding acceptance test for StyleFix scanner completeness. No StyleFix release may delete or replace styles in a production document until this test passes on the same InDesign build used for that production run.

## Why a fixture

A production scan cannot prove scanner completeness. A missing traversal path can report zero use and look clean. The canary uses a document whose correct answer is known before the scan.

v1.0.6 requires independent measurements so the test harness cannot share the scanner's blind spot.

## Evidence layers

A valid canary run has three independent evidence layers before the StyleFix result is graded.

### 1. Construction plus independent builder read-back

Run `BuildCanary.jsx`.

The builder creates every control, retains the exact object returned by construction, then verifies that exact object directly. It does **not** call or import StyleFix traversal functions.

The builder emits:

- `StyleFix_Canary_v1_0_6.indd`
- `StyleFix_Canary_v1_0_6.idml`
- `StyleFix_Canary_Build_v1_0_6.txt`
- `StyleFix_Canary_Census_v1_0_6.csv`

The fixture is invalid if the build log reports any failed construction/read-back step or if the builder census contains `Verified = NO`.

### 2. IDML XML verification

Run:

```text
python VerifyCanaryIDML.py StyleFix_Canary_v1_0_6.idml
```

The verifier shares no traversal code with either ExtendScript. It maps character-style IDs from `Resources/Styles.xml` and checks `Stories/*.xml` for the planted direct-use controls.

All C01-C14 and F02-F04 must be present.

### 3. StyleFix scan

Run the same release of `StyleFix.jsx` against the generated INDD and save the CSV.

The CSV must report:

- Script Version = 1.0.6
- Fixture Version = 1.0.6
- Installed Artifact Parity = PASS
- LOW Authorization Schema = 1
- the traversal capability matrix
- the complete LOW authorization chain

A script/fixture version mismatch invalidates the run.

## Capability and instance requirements

The traversal matrix records capability and instance presence separately.

Capabilities used for direct-use discovery are `SUPPORTED`, `NOT_EXPOSED`, or `FAILED`. A usage-critical path that is not supported blocks LOW unless a session-scoped operator assertion is recorded with operator, timestamp, and independent basis.

The normal canary run should require no operator assertions. An assertion used during the canary must be reviewed as a test exception and does not count as a clean compatibility pass.

## Direct-use controls

Each style is applied in exactly one intended location unless noted. Expected result: Direct Runs >= 1 and risk is not LOW.

| ID | Location |
| --- | --- |
| C01 | Ordinary story text |
| C02 | Table cell |
| C03 | Cell of a table nested inside another cell |
| C04 | Footnote text |
| C05 | Endnote text |
| C06 | Overset text in an undersized frame |
| C07 | Text frame on the pasteboard |
| C08 | Text frame on a parent/master page |
| C09 | Anchored inline text frame |
| C10 | Text frame inside a group |
| C11 | Text frame on a hidden layer |
| C12 | Text frame on a locked layer |
| C13 | Threaded story spanning three pages |
| C14 | Table placed on a parent/master page |

C06 also verifies unresolved-page/overset reporting. C13 verifies multi-page reporting.

## Dependency-only controls

Zero intentional direct application. Expected result: Dependency Count >= 1 and risk not LOW.

| ID | Reference path |
| --- | --- |
| D01 | Bullet character style on a paragraph style |
| D02 | Nested GREP style on a paragraph style |
| D03 | Page-number style on a TOC style entry |
| D04 | Cross-reference format building block |
| D05 | Hyperlink text source character style |
| D06 | Footnote marker style |
| D07 | `basedOn` parent of another character style |

## Formatting and export controls

| ID | Setup | Expected |
| --- | --- | --- |
| E01 | No attributes, unused, unreferenced, no export mapping | LOW; Formatting State = EMPTY SHELL |
| E02 | No attributes, unused, unreferenced, custom export tag/class | Not LOW; Export Map Count >= 1 |
| F01 | Substantive, unused, fingerprint identical to one canonical style | LOW; match recorded |
| F02 | Substantive, used once, identical to one canonical style | REPLACE; match count 1; target `Canary Canonical F02` |
| F03 | Substantive, used once, differs from canonical by tracking | HIGH; match count 0 |
| F04 | Substantive, used once, identical to two canonical styles | HIGH; match count 2 |

## Cross-class census

| ID | Setup | Expected |
| --- | --- | --- |
| P01 | Paragraph style named inside candidate family | Paragraph census >= 1; absent from character candidate list |

## Book scope

Run the canary with no InDesign book open and no `.indb` in the fixture folder.

If every otherwise-unused candidate becomes MEDIUM because of book scope, the gate is misfiring.

A script cannot prove membership in an unopened book elsewhere. Production book scope remains a documented operator precondition.

## Pass criteria

The release is blocked unless all of the following hold in one test cycle:

1. Builder log reports zero failed steps.
2. Builder census contains 28 controls and every row is Verified = YES.
3. IDML verifier finds C01-C14 and F02-F04.
4. StyleFix installed parity is PASS.
5. StyleFix Script Version and Fixture Version are both 1.0.6.
6. No usage-critical traversal capability is `NOT_EXPOSED` or `FAILED`.
7. C01-C14 each report Direct Runs >= 1 and none is LOW.
8. D01-D07 each report Dependency Count >= 1 and none is LOW.
9. E02 is not LOW.
10. The LOW set is exactly E01, F01, and any separately documented unused negative controls.
11. F02 is REPLACE with one match naming `Canary Canonical F02`.
12. F03 and F04 are HIGH.
13. P01 appears in the paragraph census and not in the character candidate list.
14. Fingerprint schema probe reports zero dropped properties, or every dropped property is explicitly reviewed and the run is recorded as an exception.
15. LOW Authorization Schema = 1 and every component required for LOW is YES for E01 and F01.
16. The normal acceptance run uses no operator usage assertions.

Any failure blocks remediation. A partial pass is not a pass.

## Provenance record

Every canary StyleFix CSV records:

- script/release version;
- loader/base/patch versions;
- installed-artifact parity and module checks;
- run timestamp;
- document name/modification date;
- InDesign version/build;
- operating system;
- fixture version/schema/ID;
- book scope and determination method;
- fingerprint schema;
- traversal capability matrix and instance counts;
- operator usage assertions;
- LOW Authorization Schema and component results;
- warning sets; and
- counts by risk classification.

A CSV without this provenance is not release evidence.
