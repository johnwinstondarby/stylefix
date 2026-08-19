# StyleFix

StyleFix is an Adobe InDesign audit utility for examining imported and automatically generated character-style debris before any style is deleted or consolidated.

**Stable audit scanner on `main`: v1.0.6. Development branch: `v1.0.8-dev`, audit only.** No StyleFix release currently deletes styles or rewrites text.

The current candidate families are `Unnamed Style *` and `Word Imported List Style*`. For each candidate character style, StyleFix reports direct text use, location, dependency references, EPUB/HTML export mappings, formatting state, canonical-style matches, and a risk classification.

| Risk | Meaning |
| --- | --- |
| `LOW` | No direct use or dependency is known and the current LOW Authorization Schema is satisfied. |
| `MEDIUM` | No use or dependency is confirmed, but deletion-safety evidence is incomplete. |
| `HIGH` | The style is directly used or referenced and cannot be reduced to one uniquely validated canonical replacement. |
| `REPLACE` | The style is directly used and has exactly one validated canonical match. Diagnostic only. |

`EMPTY SHELL` and `SUBSTANTIVE` describe formatting state. A formatting-empty style can still carry export semantics.

## v1.0.8 development focus

The first independently established canary scanner run found all difficult direct-use and dependency controls, but it also found one unsafe LOW classification: the planted E02 EPUB export mapping was missed. Manual review of the CSV exposed additional evidence-quality gaps. v1.0.8 addresses those as a class rather than adding isolated patches.

The development branch adds:

- a declared DOM contract registry and a static contract checker;
- startup probing of required DOM contracts;
- corrected `Document.indexGenerationOptions` dependency coverage;
- export-map enumeration using explicit length/count/item cross-checks plus a semantic scratch probe;
- LOW Authorization Schema 2 with evidence text for every component;
- fingerprint semantic discrimination probes for scalar, color, font, and language dimensions;
- literal document instance inventory separate from capability state;
- revised page/location resolution for threaded, table, parent-page, anchored, grouped, hidden, locked, pasteboard, and overset text;
- printable sanitization of control characters in CSV samples;
- explicit `NOT_EXPOSED` provenance instead of blank build metadata;
- a multi-fixture canary suite.

## DOM contract rule

Safety-relevant DOM names are declared in `src/StyleFix.dom.v1.0.8.jsxinc`. v1.0.8 scanner code resolves those names through registered accessors. `tools/check_dom_contract.py` verifies that helper call sites use registered names, contract codes exist, historical wrong names do not reappear, and selected safety-critical members are not called directly.

This is intended to prevent a recurring failure class in which a plausible but incorrect property or object relationship silently degrades evidence.

## LOW Authorization Schema 2

v1.0.8 requires six evidence-bearing components to authorize LOW:

1. Usage Traversal Complete
2. Dependency Scan Complete
3. Fingerprint Schema Complete
4. Export Map Scan Complete
5. Book Scope Acceptable
6. DOM Contract Complete

Each component reports both a decision and supporting evidence. The schema number changes when the authorization conjunction or its meaning changes.

## Canary suite

The release gate uses independent measurements. Builder verification never calls StyleFix traversal code. IDML verification parses the exported IDML ZIP directly.

Current suite members:

- **Core fixture:** existing v1.0.7 fixture covering C01-C14, D01-D07, E01/E02, F01-F04, and P01.
- **Supplemental coverage fixture:** `canary/coverage/BuildCoverage108.jsx`, covering E01/E02 export semantics, F05 fill-color discrimination, F06 applied-font discrimination, I01 index-generation dependency, and I02 page-reference override dependency.
- **Degraded evidence fixture:** `canary/degraded/BuildDegraded108.jsx`, covering a deliberate MEDIUM result through open-book membership.
- **Independent IDML verifier:** `canary/verify/VerifyCanaryIDML.py`.
- **Expected matrices:** `canary/expected/`.
- **Failure history:** `CANARY_FAILURES.csv`.

Grade in fixed order: builder/read-back, IDML, StyleFix CSV, StyleFix Diagnostic, then manual artifact review. A PASS line is evidence; the CSV remains the instrument panel.

## Development installation

The v1.0.8 development branch still uses modular packaging.

1. Close any running StyleFix palette.
2. Delete the previously installed `src` folder from the InDesign Scripts Panel folder.
3. Copy `StyleFix.jsx` and the complete `src` folder from the same checkout.
4. Run `StyleFix.jsx`.

The loader reads module files before evaluation and refuses to run on an installed-artifact parity failure. Runtime provenance reports loader, base, patch chain, contract version, module checks, and installed file path.

Single-file packaging is required before a public remediation release.

## Stable reference

`main` remains the last runnable audit state while v1.0.8 is developed on `v1.0.8-dev`. The stable `main` commit should receive an annotated Git tag before community-facing installation instructions point users at a fixed release artifact.

## Remediation policy

Deletion and replacement remain disabled. Any future remediation release will be explicit, selection-based, revalidated immediately before mutation, verified afterward, and will not provide an unrestricted Delete All command.

## Development notes

See [DESIGN_NOTES.md](DESIGN_NOTES.md) for the evidence model, contract design, canary architecture, packaging direction, and tool-order guidance.

## Public-use status

StyleFix is being developed as a community utility rather than as a one-document cleanup script. Conservative refusal and compatibility reporting are part of the product surface.

A formal open-source license has not yet been selected. Use StyleFix on backed-up documents and validate results independently. The software is provided without warranty.
