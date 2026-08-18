# StyleFix

StyleFix is an Adobe InDesign audit utility for examining imported and automatically generated character-style debris before any style is deleted or consolidated.

**Current release: v1.0.6, audit only.** StyleFix v1.0.6 does not delete styles or rewrite text. Its job is to answer a narrower question with defensible evidence: which candidate styles are unused, which are referenced, which carry export semantics, and whether the installed InDesign build exposes enough of the document model to authorize a LOW-risk result.

## What StyleFix audits

The current candidate families are:

- `Unnamed Style *`
- `Word Imported List Style*`

For each candidate character style, StyleFix reports direct text use, pages and samples, dependency references, EPUB/HTML export mappings, formatting state, canonical-style matches, and one of four risk classifications:

| Risk | Meaning |
| --- | --- |
| `LOW` | No direct use or dependency is known and every requirement in the current LOW Authorization Schema is satisfied. |
| `MEDIUM` | No use or dependency is confirmed, but the evidence chain is incomplete. |
| `HIGH` | The style is directly used or referenced and cannot be reduced to one clean canonical replacement. |
| `REPLACE` | The style is directly used, has exactly one validated canonical match, and is a diagnostic replacement candidate. `REPLACE` never authorizes deletion by itself. |

`EMPTY SHELL` and `SUBSTANTIVE` are formatting-state attributes, not risk levels. A formatting-empty style can still carry EPUB export semantics.

## Why the capability matrix exists

InDesign DOM exposure differs by version and context. StyleFix therefore probes the traversal paths it intends to use before scanning. Capability and instance presence are reported separately.

Usage-traversal capabilities are shown in the palette as `SUPPORTED`, `NOT_EXPOSED`, or `FAILED`, with an instance count. A missing usage-critical capability blocks `LOW` unless an operator records an explicit, session-scoped assertion based on an independent check. Assertions record the capability, operator, time, and basis in CSV and diagnostic provenance.

The **Save Diagnostic** button writes the capability matrix, InDesign version/build, operating system, installed-artifact parity, fixture metadata, assertions, warnings, and LOW authorization state to a text file suitable for a bug report.

## LOW Authorization Schema 1

A `LOW` result in v1.0.6 requires all five components to be YES:

1. Usage Traversal Complete
2. Dependency Scan Complete
3. Fingerprint Schema Complete
4. Export Map Scan Complete
5. Book Scope Acceptable

The CSV records `LOW Authorization Schema = 1`. The schema number will increase whenever the authorization conjunction changes, so archived reports cannot be mistaken for satisfying a newer standard.

## Installation for v1.0.6

v1.0.6 is still using the development module layout.

1. Close any running StyleFix palette.
2. In the InDesign Scripts Panel folder, **delete the previously installed `src` folder**. Do not merge a new release into the old folder.
3. Copy `StyleFix.jsx` and the complete repository `src` folder into the Scripts Panel folder.
4. Run `StyleFix.jsx`.

The loader reads the module files as text and checks the installed module set before evaluating it. A missing or incompatible module stops execution with an installed-artifact parity error.

The palette and CSV provenance show the resolved loader/base/patch versions and parity result.

Single-file packaging is required before the first public remediation release.

## Normal audit use

Open the INDD to inspect and run `StyleFix.jsx`.

Review the capability matrix before interpreting risk. Save the CSV for the audit record. Use **Save Diagnostic** if the capability matrix contains `NOT_EXPOSED` or `FAILED`, if the scan reports warnings, or when reporting a compatibility problem.

A `LOW` row means the complete v1.0.6 authorization chain passed for that run. It is still audit information in v1.0.6. No deletion command exists.

## Canary acceptance harness

Remediation is blocked until the canary passes on the same InDesign build used for production.

The repository contains:

- `StyleFix Canary Test.md` — binding acceptance specification.
- `BuildCanary.jsx` — creates the scratch fixture and performs an independent direct-object read-back.
- `CANARY_EXPECTED.csv` — expected StyleFix classifications.
- `VerifyCanaryIDML.py` — third measurement that parses exported IDML independently of both ExtendScript paths.
- `CANARY_FAILURES.csv` — structured failure history.
- `VERSION` — repository release marker.

`BuildCanary.jsx` generates an INDD, IDML, build log, and builder census. A fixture is invalid if the build log reports any failed construction or read-back step.

The IDML verifier then checks that the planted direct-use controls exist in `Stories/*.xml`. Only after those independent measurements pass should StyleFix scan the fixture.

The StyleFix CSV includes both the script version and fixture version so a run cannot be graded against the wrong expectation set.

## Remediation policy

Deletion and replacement remain disabled.

The planned remediation release will keep the existing multi-select pattern:

- Ctrl-click and Shift-click selection;
- **Delete Selected Safe Styles** only for candidates re-verified against the current LOW authorization schema;
- **Replace Selected With Canonical Style** only for explicitly reviewed matches;
- delete-after-replace permitted only after the same evidence completeness required for LOW plus a zero-reference rescan;
- automatic verification after every mutation;
- no unrestricted **Delete All** operation.

Audit-only operation is a valid permanent deployment posture. A refusal to delete is safer than an incorrect deletion.

## Development notes

The engineering rationale, evidence model, tool-order guidance, packaging plan, and remediation design are maintained in [DESIGN_NOTES.md](DESIGN_NOTES.md).

## Public-use status

StyleFix is being developed as a community utility rather than as a one-document cleanup script. Compatibility reporting and conservative refusal are therefore part of the product surface.

A formal open-source license has not yet been selected. That choice remains with the repository owner before the first public release.

Use StyleFix on backed-up documents and validate results independently. The software is provided without warranty.
