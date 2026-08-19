# StyleFix Design Notes

## Purpose

StyleFix audits imported InDesign character-style debris and is intended to become a conservative public practitioner utility. The development rule is audit first, locate evidence, remediate only rules validated in real documents, and verify after every future mutation.

Compatibility failure must be visible. Absence of evidence is never silently converted into evidence of absence.

## Current development state

- Stable scanner on `main`: v1.0.6, audit only.
- Validated core fixture builder: v1.0.7.
- Development scanner: v1.0.8 on `v1.0.8-dev`, audit only.

The first real scanner measurement against the independently verified core fixture found all C01-C14 direct-use placements and all D01-D07 dependency controls. It also classified E02 LOW despite a planted EPUB `StyleExportTagMap`. That confirmed a SILENT release blocker and demonstrated that the original `ExportMapScanComplete` gate could certify silence.

## Evidence architecture

StyleFix separates direct usage, dependency references, export semantics, formatting fingerprints, location, compatibility, and document scope. A LOW decision depends on the completeness of the evidence paths used to establish absence.

### DOM contract registry

v1.0.8 introduces `src/StyleFix.dom.v1.0.8.jsxinc` as the declaration of safety-relevant DOM properties and methods. Each entry records a contract code, actual member name, member kind, surface, evidence role, and whether the contract is required.

Runtime accessors resolve contract codes rather than assuming members at arbitrary call sites. A startup audit records `SUPPORTED`, `NOT_EXPOSED`, `FAILED`, or `NO_INSTANCE` as appropriate. After startup, the runtime gate refuses calls through unresolved required contracts.

`tools/check_dom_contract.py` is the build-time counterpart. It checks helper literals against the declaration table, verifies contract codes, blocks historical wrong names, and flags selected safety-critical direct member calls. The registry is therefore both declaration and enforced interface rather than documentation alone.

### Capability versus instance inventory

Capability and instance presence are independent facts. v1.0.8 first inventories literal document instances and then reports capability state separately. `SUPPORTED; instances=0` means the DOM path exists and the document contains no instances. `NO_INSTANCE` is used for a child path when the relevant parent inventory proves there is nothing to traverse. `NOT_EXPOSED` or `FAILED` on usage-critical paths blocks LOW unless a recorded operator assertion supplies an independent basis.

### Direct usage and location

All document stories are scanned, including table cells, nested tables, footnotes, endnote stories, parent-page content, hidden/locked layers, pasteboard stories, anchored/grouped objects, and overset text when exposed through the document story model.

Location reporting is an operational aid rather than a risk input. v1.0.8 resolves page information from direct parent frames, insertion-point frames, and parent-story text containers so table and threaded-story findings remain locatable.

### Dependencies

The v1.0.8 dependency index covers character-style inheritance, paragraph-style character references, nested styles, text variables, cross-reference surfaces, hyperlink/cross-reference sources, TOC references, footnote/endnote marker styles, index-generation styles, index page-reference overrides, XML maps, and style export-tag maps.

The index-generation object is `Document.indexGenerationOptions`. Topic/page-reference traversal remains a separate path through `Index.allTopics` and `Topic.pageReferences`.

D05 hyperlink-source and D06 footnote-marker direct appearances are modeled as instantiated dependency use when the dependency itself causes the styled text to materialize.

### Export-map evidence

v1.0.8 does not infer export completeness from the absence of an exception. It performs:

- a scratch semantic probe that creates a real export mapping and verifies it through the same scanner enumeration path;
- per-style length/count/item cross-checks;
- explicit mismatch recording;
- a separately reported export audit; and
- independent IDML verification for E01/E02.

Any inconsistency blocks `ExportMapScanComplete`.

### Fingerprint evidence

Property existence and property discrimination are different facts. v1.0.8 retains the 24-dimension schema probe and adds semantic scratch tests that establish distinguishable read-back for point size, tracking, fill color, stroke color, applied font, and applied language when the local InDesign installation provides assignable pairs.

Supplemental controls F05 and F06 independently test fill-color-only and applied-font-only canonical mismatches. The fixture records the actual swatch and font pair selected on that machine.

## LOW Authorization Schema 2

Schema 2 has six evidence-bearing components:

- Usage Traversal Complete
- Dependency Scan Complete
- Fingerprint Schema Complete
- Export Map Scan Complete
- Book Scope Acceptable
- DOM Contract Complete

Each component records a Boolean decision plus evidence text. LOW requires all six. `REPLACE` remains diagnostic and never authorizes deletion by itself.

## Canary suite

The harness is now a suite rather than one fixture.

### Core

The v1.0.7 fixture remains the primary broad-coverage specimen. It is already independently established by builder read-back and IDML direct-use verification.

### Supplemental coverage

`canary/coverage/BuildCoverage108.jsx` creates six controls: E01, E02, F05, F06, I01, and I02. It verifies its own construction directly and records resolved font/color pairs.

### Degraded evidence

`canary/degraded/BuildDegraded108.jsx` creates an otherwise unused candidate and adds the saved INDD to an open `.indb` book. The expected scanner result is MEDIUM with `BookScopeAcceptable=NO`. This tests a real NO path rather than fabricating an internal scanner error.

### Independent IDML measurement

`canary/verify/VerifyCanaryIDML.py` parses IDML directly. It checks direct-use styles and E01/E02 export-map serialization without using either ExtendScript code path.

### Grading order

Builder census first, IDML second, StyleFix CSV third, Diagnostic fourth, manual artifact review last. Any earlier failure invalidates later evidence for that fixture.

## Installed artifact parity and packaging

The development loader remains modular and reports the transitional base/patch chain explicitly. The complete `src` folder must be deleted before copying a new development checkout.

Single-file packaging is mandatory before any public remediation release. A future UXP/CCX package remains a possible later distribution path.

## Risk model

| Risk | Meaning |
| --- | --- |
| `LOW` | No direct use/dependency and current LOW authorization schema satisfied. |
| `MEDIUM` | No confirmed use/dependency but evidence incomplete. |
| `HIGH` | Direct use or dependency with no unique validated canonical replacement. |
| `REPLACE` | Direct use and exactly one validated canonical match. Diagnostic only. |

## Planned remediation

Remediation remains disabled during v1.0.8. Future controls remain multi-select, selection-based, revalidated before mutation, verified afterward, and no unrestricted Delete All is planned.

## Tool order

1. DocStats
2. HeaderFix
3. NormalFix
4. TableFix
5. StyleFix
6. DocStats final validation

NormalFix and TableFix establish canonical body/table formatting before any future StyleFix consolidation.

## Failure recording

`CANARY_FAILURES.csv` records date, version, context, error, line, diagnosis, fixing version, caught-by stage, and `LOUD` or `SILENT` failure mode. Silent defects receive particular attention because they can generate confident but wrong reports.
