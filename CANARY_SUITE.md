# StyleFix v1.0.8 Canary Suite

v1.0.8 is audit-only. The production manuscript is outside the acceptance harness until the suite passes and the resulting CSVs are manually reviewed.

## Fixed grading order

For each suite member, use this order:

1. Build log and direct-object builder census.
2. Independent IDML verification where applicable.
3. StyleFix CSV.
4. StyleFix Diagnostic.
5. Manual artifact review against the applicable expected-results matrix.

If an earlier step fails, stop. Later outputs are not release evidence for that fixture.

## Core fixture

Use the already validated v1.0.7 core fixture produced by `BuildCanary.jsx`. It covers C01-C14, D01-D07, E01/E02, F01-F04, and P01.

Expected results: `canary/expected/CANARY_CORE_EXPECTED_v1.0.8.csv`.

The v1.0.8 IDML verifier must independently confirm all applicable direct-use controls plus E01/E02 export-map serialization before the v1.0.8 scanner output is graded.

## Supplemental coverage fixture

Run `canary/coverage/BuildCoverage108.jsx`.

It builds:

- E01: no export map;
- E02: explicit EPUB export map;
- F05: used style differing from its canonical candidate only by fill color;
- F06: used style differing from its canonical candidate only by applied font;
- I01: `Document.indexGenerationOptions.pageNumberStyle` dependency;
- I02: `PageReference.pageNumberStyleOverride` dependency.

The builder records the actual font pair and color pair selected on that machine. Both pairs must produce distinct read-back values before the fixture is valid.

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
