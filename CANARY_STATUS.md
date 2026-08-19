# StyleFix Canary Suite Status

Stable audit scanner on `main`: **v1.0.6**.

Validated core fixture builder: **v1.0.7**.

Development scanner on `v1.0.8-dev`: **v1.0.8 audit-only**.

## Why v1.0.8 exists

The first real v1.0.6 scanner run against the independently verified v1.0.7 fixture found all C01-C14 direct-use placements and all D01-D07 dependency controls, but the planted E02 EPUB export mapping was missed and E02 was incorrectly classified LOW. Manual CSV review also exposed weak page-location reporting, probe-count/instance-count confusion, an incorrect `Document.indexOptions` dependency path, and fingerprint dimensions that the fixture had not yet proved discriminating.

v1.0.8 is therefore a certification release rather than a remediation release.

## Suite members

- `core`: existing v1.0.7 fixture, used to re-test C01-C14, D01-D07, E01/E02, F01-F04, and P01.
- `supplemental-coverage`: v1.0.8 fixture for E01/E02 export semantics, F05 fill-color discrimination, F06 font discrimination, I01 index-generation dependency, and I02 page-reference override dependency.
- `degraded-evidence`: v1.0.8 fixture that places an otherwise unused candidate in an open `.indb` book so the expected risk is MEDIUM and `BookScopeAcceptable=NO`.

The IDML verifier is also extended in v1.0.8 to independently check E01/E02 export mapping state in addition to direct-use controls.

## Release gate

Grade each fixture in fixed order: builder/read-back, IDML where applicable, StyleFix CSV, StyleFix Diagnostic, then manual artifact review. A PASS line does not replace reading the CSV.
