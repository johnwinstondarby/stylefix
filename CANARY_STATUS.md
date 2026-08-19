# StyleFix Canary Suite Status

Stable audit scanner: **v1.0.8**.

Release status: **CERTIFIED**.

v1.0.8 is audit-only. Deletion and replacement remain disabled.

## Certification summary

The release gate is complete across all three fixture classes:

- **Core fixture:** PASS. Direct-use controls C01-C14, dependency controls D01-D07, export controls E01/E02, fingerprint controls F01-F04, and paragraph census P01 were graded against the expected matrix and manual artifact review.
- **Supplemental coverage fixture:** PASS. D08, D09, D10, E01/E02, F05 Match/Miss, F06 Match/Miss, and L01 were graded against the expected matrix. The dedicated supplemental IDML verifier completed 10/10 checks after the documented D10 fixture cleanup.
- **Degraded-evidence fixture:** PASS. `Unnamed Style M01` classified MEDIUM with zero direct use, `BookScopeAcceptable=NO`, and overall `AUTHORIZED=NO` while the generated INDD remained a member of an open INDB.

The final v1.0.8 runtime also includes the standalone stage-aware progress palette. The progress UI is instrumentation only and does not change classification, dependency, fingerprint, export-map, book-scope, or authorization logic.

## Static gate

`python .\tools\check_dom_contract.py` passes with the accepted DOM contract, five-state capability taxonomy, running-header correction, direct-access guard, and deferred-bootstrap order.

## Why v1.0.8 exists

The first real v1.0.6 scanner run against the independently verified v1.0.7 fixture found all difficult direct-use and dependency controls, but the planted E02 EPUB export mapping was missed and E02 was incorrectly classified LOW. Manual CSV review also exposed weak page-location reporting, probe-count/instance-count confusion, an incorrect index-generation dependency path, and fingerprint dimensions that the fixture had not yet proved discriminating.

v1.0.8 closes those evidence gaps and establishes the certified audit baseline for future work.

## Release interpretation

The v1.0.8 audit line is complete. `main` is the stable release branch. Future guarded remediation work moves to the v2.0 development line.

The CSV remains the primary review artifact. Machine-generated PASS results support release evidence but do not replace artifact review.
