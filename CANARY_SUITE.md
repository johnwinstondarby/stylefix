# StyleFix v1.0.8 Canary Suite

v1.0.8 is audit-only. The production manuscript is outside the acceptance harness until the suite passes and the resulting CSVs are manually reviewed.

## Fixed grading order

For each suite member, use this order:

1. Build log and direct-object builder census.
2. Independent correction verification where a documented builder-readback defect applies.
3. Independent IDML verification where applicable.
4. StyleFix CSV.
5. StyleFix Diagnostic.
6. Manual artifact review against the applicable expected-results matrix.

If an earlier step fails, stop unless the suite explicitly defines a correction verifier for that exact failure. Later outputs are not release evidence for an unrelated failed control.

## Core fixture

Use the already validated v1.0.7 core fixture produced by `BuildCanary.jsx`. It covers C01-C14, D01-D07, E01/E02, F01-F04, and P01.

Expected results: `canary/expected/CANARY_CORE_EXPECTED_v1.0.8.csv`.

The v1.0.8 IDML verifier must independently confirm all applicable direct-use controls plus E01/E02 export-map serialization before the v1.0.8 scanner output is graded.

## Supplemental coverage fixture

Run `canary/coverage/BuildCoverage108.jsx`.

It builds:

- D08: running-header character-style dependency through a `MATCH_CHARACTER_STYLE_TYPE` text variable;
- D09: `Document.indexGenerationOptions.pageNumberStyle` dependency;
- D10: `PageReference.pageNumberStyleOverride` dependency on a real generated index topic/reference;
- E01: no export map;
- E02: explicit EPUB export map;
- F05 Match/Miss: fill-color fingerprint match and near-miss discrimination;
- F06 Match/Miss: applied-font fingerprint match and near-miss discrimination;
- L01: clean empty-shell LOW control.

The builder records the actual font pair and color pair selected on that machine. Both pairs must produce distinct read-back values before the fixture is valid. The clean supplemental fixture is expected to produce no MEDIUM results.

### L01 builder-readback correction

The original supplemental builder's `isEmptyShell()` check compares direct CharacterStyle property read-back to `NothingEnum.NOTHING`. In InDesign 21.5.1, a newly created empty CharacterStyle can serialize with no explicit formatting while one or more direct property reads do not compare equal to `NothingEnum.NOTHING`. This can produce `FAIL VERIFY L01` even when the generated L01 style is structurally empty.

When the only builder failure is L01 with `emptyShell=NO;exportMaps=0`, run `canary/coverage/VerifyCoverage108_L01.jsx` against the generated supplemental INDD. The correction verifier compares L01 against E01 and a fresh transient empty CharacterStyle across the full StyleFix fingerprint surface and verifies zero export maps. A PASS replaces only the failed L01 builder assertion. All other builder controls must already be PASS.

Expected results: `canary/expected/CANARY_SUPPLEMENTAL_EXPECTED_v1.0.8.csv`.

## Degraded-evidence fixture

Run `canary/degraded/BuildDegraded108.jsx`.

The builder saves an INDD containing unused `Unnamed Style M01`, creates an INDB, adds the INDD to that book, and leaves the book open. Run StyleFix while the generated book remains open.

Expected result: M01 = MEDIUM, `BookScopeAcceptable=NO`, and overall LOW authorization = NO.

Expected results: `canary/expected/CANARY_DEGRADED_EXPECTED_v1.0.8.csv`.

## Static DOM contract gate

Before an InDesign run, execute:

```powershell
python .\tools\check_dom_contract.py
```

The checker must report PASS. It verifies the v1.0.8 declaration/call-site contract and explicitly blocks recurrence of historical wrong names or wrong-object access patterns.

## Release interpretation

A machine-generated PASS does not finish grading. The CSV remains the primary review artifact because prior silent defects have been found by reading output that no automated gate identified.
