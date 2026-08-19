# StyleFix Canary Suite Status

Stable audit scanner on `main`: **v1.0.6**.

Validated core fixture builder: **v1.0.7**.

Development scanner on `v1.0.8-dev`: **v1.0.8 audit-only**.

## Certification status

Functional certification anchor before progress-monitor instrumentation:

`92b89c5feab4a712fd345d3daf3a07e39b70b2c0`

### Core fixture: PASS

The established v1.0.7 core fixture passes all 28 v1.0.8 acceptance controls. Location controls C07-C14 resolve as required, the DOM contract is nonblocking, fingerprint semantics pass, export-map semantics pass, and LOW authorization ends in `AUTHORIZED=YES`.

### Supplemental coverage fixture: PASS

The v1.0.8 supplemental fixture passes D08, D09, D10, E01/E02, F05 Match/Miss, F06 Match/Miss, and L01. The final scanner census is:

- LOW=2
- MEDIUM=0
- HIGH=6
- REPLACE=2
- AUTHORIZED=YES

D10 is dependency-only with zero direct runs and one `Canary Topic D10` page-reference override dependency. The independent supplemental IDML verifier v1.0.1 passes 10/10 controls, including the D10 zero-direct-use negative control.

The supplemental builder has two documented fixture-only correction paths discovered during certification:

- `VerifyCoverage108_L01.jsx` independently verifies the clean empty-shell L01 state when direct `NothingEnum` read-back is unreliable.
- `RepairCoverage108_D10.jsx` removes or refreshes generated D10 direct-use evidence while preserving the underlying page-reference dependency, then re-exports synchronized IDML evidence.

### Degraded-evidence fixture: PENDING

The degraded-evidence fixture remains the remaining evidence member. It must demonstrate M01=MEDIUM, `BookScopeAcceptable=NO`, and LOW authorization blocked while the generated book remains open.

## Why v1.0.8 exists

The first real v1.0.6 scanner run against the independently verified v1.0.7 fixture found all C01-C14 direct-use placements and all D01-D07 dependency controls, but the planted E02 EPUB export mapping was missed and E02 was incorrectly classified LOW. Manual CSV review also exposed weak page-location reporting, probe-count/instance-count confusion, an incorrect `Document.indexOptions` dependency path, and fingerprint dimensions that the fixture had not yet proved discriminating.

v1.0.8 is therefore a certification release rather than a remediation release.

## Suite members

- `core`: existing v1.0.7 fixture, used to re-test C01-C14, D01-D07, E01/E02, F01-F04, and P01.
- `supplemental-coverage`: v1.0.8 fixture for D08 running-header dependency, D09 index-generation dependency, D10 page-reference override dependency, E01/E02 export semantics, F05 fill-color discrimination, F06 font discrimination, and L01 clean empty-shell behavior.
- `degraded-evidence`: v1.0.8 fixture that places an otherwise unused candidate in an open `.indb` book so the expected risk is MEDIUM and `BookScopeAcceptable=NO`.

The supplemental IDML verifier independently checks F05/F06 direct-use serialization and fingerprint discrimination, E01/E02/L01 export-map state, and zero serialized direct use for D10.

## Release gate

Grade each fixture in fixed order: builder/read-back, correction verifier where explicitly documented, IDML where applicable, StyleFix CSV, StyleFix Diagnostic, then manual artifact review. A PASS line does not replace reading the CSV.
