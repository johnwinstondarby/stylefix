# StyleFix Design Notes

## Purpose

StyleFix exists to audit and, in a later opt-in release, safely consolidate imported InDesign style debris. The development rule is audit first, locate evidence, remediate only rules validated in real documents, and verify after every mutation.

The tool is intended for public practitioner use. A compatibility failure must therefore be visible and conservative rather than silently interpreted as absence.

## Current scope

v1.0.6 audits character styles named:

- `Unnamed Style *`
- `Word Imported List Style*`

It also performs a paragraph-style census for the same families so a zero character-style result cannot hide a same-named paragraph-style population.

## Evidence layers

StyleFix separates four kinds of evidence.

### Direct usage

The scanner walks document stories, story text-style ranges, tables, nested table text, footnotes, and all stories that InDesign exposes. Endnote context is identified through `Story.isEndnoteStory` when exposed, with `storyType` as a context-classification fallback. Context classification is informational; every exposed document story is scanned for direct character-style use.

### Dependencies

A document-wide dependency index covers, where exposed:

- character-style `basedOn`;
- paragraph-style drop-cap, bullet, and numbering character styles;
- nested styles, nested GREP styles, and nested line styles;
- text-variable style references;
- cross-reference formats/building blocks;
- hyperlink and cross-reference sources;
- TOC page-number and separator styles;
- footnote/endnote marker styles;
- index references;
- XML style maps; and
- character-style `styleExportTagMaps`.

Export mappings count as semantic dependencies because deleting the style can alter EPUB/HTML output even when the style has no formatting attributes.

### Formatting fingerprint

Character-style fingerprint properties are probed before use. Unsupported properties are reported instead of silently omitted. Canonical matching excludes imported debris families and formatting-empty styles.

### Scope and compatibility

Book scope, traversal capability, installed artifact parity, InDesign build, and operating system are provenance rather than incidental metadata.

## Traversal capability model

Capability and instance presence are separate fields.

Capability states:

- `SUPPORTED` — the required property is exposed on the relevant object class represented in the document, or the parent collection is exposed and contains zero instances requiring the child path.
- `NOT_EXPOSED` — the installed DOM does not expose the property.
- `FAILED` — the property exists or the traversal started, but the probe failed unexpectedly.

Usage-critical `NOT_EXPOSED` or `FAILED` states block LOW.

Noncritical context-classification capabilities may report N/A-like information without blocking direct-use detection if the underlying text is still scanned.

### Operator assertion escape

A missing usage capability can be overridden only by a recorded operator assertion entered through the palette. The assertion is session-scoped and records:

- document identity;
- capability;
- operator;
- timestamp; and
- independent basis.

The assertion is written into CSV and diagnostic provenance. It does not change the capability state; it changes only the LOW gate for that run.

No silent override switch is planned.

## LOW Authorization Schema

v1.0.6 uses `LOW Authorization Schema = 1`.

A LOW result requires:

- Usage Traversal Complete = YES
- Dependency Scan Complete = YES
- Fingerprint Schema Complete = YES
- Export Map Scan Complete = YES
- Book Scope Acceptable = YES

The schema number must increase when a new authorization component is added or an existing component changes meaning.

`REPLACE` is diagnostic. A future delete-after-replace operation must satisfy the same current LOW authorization schema, complete the replacement, then prove zero remaining references before deletion.

## Canary architecture

The acceptance harness deliberately uses independent measurements.

### Measurement 1: construction intent

`BuildCanary.jsx` creates each named control and records the exact object returned by construction.

### Measurement 2: independent direct-object read-back

The builder verifies those exact object references directly. It does not call or import StyleFix usage-traversal functions. Direct text controls are checked from the exact text/range object planted by the builder, using direct character-style reads rather than document discovery.

The builder emits `StyleFix_Canary_Census_vX_X_X.csv`.

### Measurement 3: IDML XML

The builder exports the fixture to IDML. `VerifyCanaryIDML.py` opens the IDML ZIP, maps character-style IDs from `Resources/Styles.xml`, and inspects `Stories/*.xml` for the planted direct-use styles. This code shares neither the builder's InDesign object handles nor StyleFix's traversal implementation.

Agreement among construction, direct-object read-back, IDML, and StyleFix discovery is the release evidence.

## Installed artifact parity

v1.0.6 still uses the v1.0.5 base modules plus a v1.0.6 override module. The loader reads all modules as text before evaluation and validates a known-release signature set. It refuses to run if a required file or signature is missing.

Runtime provenance reports:

- loader version;
- base module version;
- patch version;
- module checks; and
- installed parity.

The v1.0.6 installation procedure requires deleting the old `src` folder before copying the new release.

### Packaging direction

Single-file `StyleFix.jsx` packaging is required before any public remediation release. The development module layout is not intended as the long-term practitioner installation experience.

A future UXP/CCX package is a possible distribution path after the ExtendScript release is stable.

## Risk model

| Risk | Meaning |
| --- | --- |
| `LOW` | No direct use or dependency and current LOW authorization schema satisfied. |
| `MEDIUM` | No confirmed use/dependency but deletion-safety evidence incomplete. |
| `HIGH` | Direct use or dependency with no unique validated canonical replacement. |
| `REPLACE` | Direct use and exactly one validated canonical match. Diagnostic only. |

`EMPTY SHELL` and `SUBSTANTIVE` are formatting states.

## Planned remediation

Remediation remains opt-in and selection-based.

Planned controls:

- multi-select using Ctrl/Shift;
- Delete Selected Safe Styles;
- Replace Selected With Canonical Style;
- immediate revalidation before each mutation;
- current LOW authorization schema required for deletion;
- delete-after-replace requires zero-reference rescan;
- corrected/skipped/could-not-verify result counts;
- no Delete All.

## Tool order in the broader InDesign QA set

1. DocStats
2. HeaderFix
3. NormalFix
4. TableFix
5. StyleFix
6. DocStats final validation

NormalFix and TableFix establish canonical inline/table styles before any future StyleFix replacement pass.

## Failure recording

`CANARY_FAILURES.csv` records:

- date;
- version;
- context;
- error;
- line;
- diagnosis;
- fixed-in version;
- caught-by stage; and
- failure mode (`LOUD` or `SILENT`).

Silent defects are especially important because they can produce a confident clean report.
