# StyleFix Supplemental Fixture Specification

**Target scanner:** v1.0.8-dev (post-patch)
**Fixture class:** Clean coverage fixture (positive-path proofs)
**Companion fixture:** Degraded-evidence fixture (MEDIUM and incomplete-authorization cases) — out of scope here
**Author role:** DAISY, structural and production partner
**Editorial authority:** Johann Darby
**Status:** Accepted as the acceptance contract for the v1.0.8-dev code pass. Pilgrim accepted the five-state taxonomy as the runtime contract model and locked the four open items; this revision folds in his one correction and those decisions. The authorization and location workstreams are kept separate.

---

## 1. Purpose

This specification defines the new controls to add to the clean coverage fixture so that positive dependency paths are proven, not merely made quiet, and so that the risk-outcome classes LOW and REPLACE are each demonstrated by a dedicated control once the authorization chain is complete.

The specification also formalizes a five-state taxonomy for DOM surface probing so that an inapplicable object state is never reported as a capability failure. The current fixture collapses several distinct conditions into `FAILED`, which is the root cause of the false DOM-contract blocks observed in the v1.0.7 run against v1.0.8-dev.

Two principles govern the clean fixture:

1. The clean fixture produces only LOW, HIGH, and REPLACE outcomes, plus the dependency-only controls that resolve their references. It does not produce MEDIUM. Any control whose purpose is to demonstrate degraded evidence or incomplete authorization belongs in the degraded-evidence fixture.
2. Every control that expects LOW or REPLACE carries an explicit authorization prerequisite: the run must reach `AUTHORIZED=YES`. A LOW or REPLACE expectation is only valid on a complete authorization chain, because under incomplete evidence the scanner correctly refuses to lower risk.

---

## 2. DOM capability state taxonomy

Every DOM surface probe resolves to exactly one of five states. The distinction between them is what separates a genuine defect from an expected, well-formed condition.

| State | Meaning | Is it a defect? |
|---|---|---|
| `SUPPORTED` | An applicable representative instance was found in the active document and the probe read the property or method successfully. This is positive proof that the build provides the surface and the document exercises it. | No |
| `NOT_APPLICABLE` | A representative instance was found and probed, but that instance is in a state where the property does not apply (for example, `basedOn` on a root style, or `variableOptions` on a variable type that does not carry them). The build provides the surface; this object's state makes it inapplicable. | No |
| `NO_APPLICABLE_INSTANCE` | The contract registers the surface, but the active document supplies no instance capable of exercising it. This state asserts nothing about whether the build provides the surface; it records only that the document could not exercise it. It never claims positive build support. | No |
| `NOT_EXPOSED` | A representative instance was found, and the property or method is genuinely absent from it in this build. This is positive proof that the build does not provide the surface, and therefore requires an instance to assert. | Only when the surface is required for the tool to operate |
| `FAILED` | An applicable representative was found, and the probe raised an unexpected error that is not an inapplicable-state error. | Yes |

### 2.1 Resolution decision tree

The tree is instance-first, because most InDesign surfaces cannot be feature-tested without a live instance. A build-support claim, positive or negative, may only be made when an instance is in hand to probe. For a surface property `P` on host class `H`:

1. Does the active document contain at least one instance of `H`?
   - No: resolve `NO_APPLICABLE_INSTANCE`. The contract registers the surface; the document supplies nothing to exercise it; no claim is made about build support. Stop.
   - Yes: continue.
2. Prefer an instance in a state where `P` applies. If instances of `H` exist but every one is in an inapplicable state, treat the representative as inapplicable and resolve `NOT_APPLICABLE` at step 3's inapplicable branch. Otherwise select an applicable instance as the representative and continue.
3. Feature-test and read `P` on the representative.
   - `P` is genuinely absent from the instance in this build: resolve `NOT_EXPOSED`. Stop.
   - `P` is present but the read raises an inapplicable-state error (for example, "Invalid request on a root style" or "The property is not applicable in the current state"): resolve `NOT_APPLICABLE`. Stop.
   - `P` is present but the read raises any other unexpected error: resolve `FAILED`. Stop.
   - The read succeeds: resolve `SUPPORTED`.

The representative selection in step 2 is the fix for the v1.0.7 defects. `STYLE_BASED_ON` must select a non-root character style that carries a real `basedOn` target; control D07 supplies that non-root representative. `VARIABLE_OPTIONS` and `VARIABLE_APPLIED_STYLE` must select a running-header variable type; control D08 supplies that representative, since a `MATCH_CHARACTER_STYLE` variable both exposes `variableOptions` and carries `appliedStyle`. In short: D07 proves `STYLE_BASED_ON`; D08 proves `VARIABLE_OPTIONS` and `VARIABLE_APPLIED_STYLE`.

### 2.2 Gate contribution by state

The DOM-contract-complete gate and the dependency-scan-complete gate compute their block sets from surface states as follows:

| State | Blocks authorization? |
|---|---|
| `SUPPORTED` | No |
| `NOT_APPLICABLE` | No |
| `NO_APPLICABLE_INSTANCE` | No |
| `NOT_EXPOSED` | Yes only if `required=YES`; otherwise no |
| `FAILED` | Yes |

The important change from v1.0.7 behavior: `NOT_APPLICABLE` and `NO_APPLICABLE_INSTANCE` never block. A root-style `basedOn` and an inapplicable `variableOptions` are expected readings of a healthy document, not evidence that the scan is incomplete. Only an unexpected error (`FAILED`) or a required capability that the build does not provide (`NOT_EXPOSED` with `required=YES`) may withhold authorization.

Recording note: the provenance block should continue to list every surface with its resolved state. Where a surface resolves to `NO_APPLICABLE_INSTANCE` in the clean fixture but the fixture is expected to supply an instance, that mismatch is a fixture-coverage gap to be surfaced as a fixture warning, not as a scanner defect and not as an authorization block.

---

## 3. New controls

Control identifiers below are proposals; final lettering is Pilgrim's call. Each control lists its construction, the single DOM or classification path it proves, and its full expected row so the acceptance matrix can assert against it directly.

Fields carried for every control: expected Risk, Formatting State, Semantic State, Usage Relationship, Direct Runs, Dependency Count, the DOM surface state it proves, and Authorization Prerequisite.

### 3.1 D08 — Running-header character-style appliedStyle dependency

**Proves:** the positive path for `VARIABLE_OPTIONS` and `VARIABLE_APPLIED_STYLE`, and supplies the applicable representative that lets `VARIABLE_OPTIONS` resolve `SUPPORTED` rather than `NOT_APPLICABLE` at the contract level.

**Construction:**
- Create a character style named `Canary Running Header D08`. This is the candidate under evaluation.
- Create a text variable of type `MATCH_CHARACTER_STYLE` (running header, character style scope) named `Canary RH Variable D08`.
- Set the variable's `variableOptions.appliedStyle` to `Canary Running Header D08`.
- Do not apply the candidate style to any body text. The reference exists solely through the running-header variable.

**Expected row:**

| Field | Value |
|---|---|
| Risk | HIGH |
| Formatting State | EMPTY SHELL |
| Semantic State | NO EXPORT MAP |
| Usage Relationship | DEPENDENCY ONLY |
| Direct Runs | 0 |
| Dependency Count | 1 |
| Dependency label | `Running header appliedStyle: Canary RH Variable D08` |
| Surface proven | `VARIABLE_OPTIONS=SUPPORTED`; `VARIABLE_APPLIED_STYLE=SUPPORTED` |
| Authorization prerequisite | none (this control contributes to authorization rather than depending on it) |

**Rationale:** the candidate is referenced by a dependency surface and never applied directly, mirroring D07 (based-on). Its presence forces both `variableOptions` and `appliedStyle` to have a real, applicable representative, so the contract probe proves the positive path instead of reporting `NO_APPLICABLE_INSTANCE` or, as in v1.0.7, misreporting `FAILED`.

**Companion for the based-on path:** confirm the fixture still contains the D07-style non-root based-on child so that `STYLE_BASED_ON` also selects a non-root representative. If D07 is retained unchanged, no new based-on control is required; the contract simply must prefer a non-root style when choosing the `basedOn` representative.

### 3.2 D09 — Index generation options dependency

**Proves:** `INDEX_PAGE_NUMBER_STYLE` (and by extension the index generation options dependency surface) resolves `SUPPORTED` with a real instance rather than defaulting.

**Construction:**
- Create a character style named `Canary Index PageNum D09`. This is the candidate.
- Create the single shared fixture index via `doc.indexes.add()`. D09 and D10 share this one index: D09 establishes the document-level index-generation style dependency, and D10 adds a topic and page reference inside the same index. This keeps fixture noise down while leaving the two dependency paths independently testable.
- Set `doc.indexGenerationOptions.pageNumberStyle` to `Canary Index PageNum D09`.

**Expected row:**

| Field | Value |
|---|---|
| Risk | HIGH |
| Formatting State | EMPTY SHELL |
| Semantic State | NO EXPORT MAP |
| Usage Relationship | DEPENDENCY ONLY |
| Direct Runs | 0 |
| Dependency Count | 1 |
| Dependency label | `Index page number style: [index name]` |
| Surface proven | `INDEX_PAGE_NUMBER_STYLE=SUPPORTED` (instance count 1) |
| Authorization prerequisite | none |

### 3.3 D10 — PageReference pageNumberStyleOverride dependency

**Proves:** `INDEX_ALL_TOPICS`, `TOPIC_PAGE_REFERENCES`, and `PAGE_REFERENCE_STYLE_OVERRIDE` resolve `SUPPORTED`, moving them off `NO_APPLICABLE_INSTANCE`.

**Construction:**
- Create a character style named `Canary PageRef Override D10`. This is the candidate.
- Use the same index created in D09. Do not create a second index.
- Add a topic: `index.topics.add(["Canary Topic D10"])`.
- Add a page reference on that topic pointing at a marked location in a placed story that sits on a real page, not the pasteboard.
- Set that page reference's `pageNumberStyleOverride` to `Canary PageRef Override D10`.
- Generate the index once (see the generation note below), then reacquire the page reference object and verify `pageNumberStyleOverride` by direct read-back before the fixture is considered built.

**Expected row:**

| Field | Value |
|---|---|
| Risk | HIGH |
| Formatting State | EMPTY SHELL |
| Semantic State | NO EXPORT MAP |
| Usage Relationship | DEPENDENCY ONLY |
| Direct Runs | 0 |
| Dependency Count | 1 |
| Dependency label | `Index page reference style override: Canary Topic D10` |
| Surface proven | `INDEX_ALL_TOPICS=SUPPORTED`; `TOPIC_PAGE_REFERENCES=SUPPORTED`; `PAGE_REFERENCE_STYLE_OVERRIDE=SUPPORTED` |
| Authorization prerequisite | none |

**Note on index generation (locked procedure):** page references populate reliably only after the index is generated at least once. The builder must: create the page reference against live, non-overset text on a real page; set the override; generate the index one time; reacquire the page reference object, since generation can invalidate the earlier specifier; and then verify `pageNumberStyleOverride` by direct read-back. The fixture build aborts if the read-back does not return `Canary PageRef Override D10`.

### 3.4 F05 — fillColor discrimination

**Proves:** the fingerprint captures `fillColor` as a distinguishing property and the canonical-match logic discriminates on it. This is the per-control complement to repairing the global semantic scratch probe, which currently cannot establish two distinguishable `fillColor` values.

**Construction:**
- Define two named swatches in the fixture, for example `Canary Fill A` and `Canary Fill B`, with clearly distinct color values.
- Create character style `Canary Canonical F05` with `fillColor = Canary Fill A` and an otherwise fixed fingerprint.
- Create the candidate `Canary Fill Match F05` with an identical fingerprint including `fillColor = Canary Fill A`, applied to one direct run. Expected to match the canonical and resolve REPLACE.
- Create a near-miss candidate `Canary Fill Miss F05` identical except `fillColor = Canary Fill B`, applied to one direct run. Expected not to match the canonical on fillColor and to remain HIGH.

**Expected rows:**

| Control | Risk | Formatting State | Semantic State | Direct Runs | Canonical Match | fillColor in fingerprint | Authorization prerequisite |
|---|---|---|---|---|---|---|---|
| `Canary Fill Match F05` | REPLACE | SUBSTANTIVE | NO EXPORT MAP | 1 | `Canary Canonical F05` (count 1) | `Canary Fill A` (not NOTHING) | `AUTHORIZED=YES` |
| `Canary Fill Miss F05` | HIGH | SUBSTANTIVE | NO EXPORT MAP | 1 | none (count 0) | `Canary Fill B` (not NOTHING) | none |

**Semantic-probe acceptance:** with F05 present, the fingerprint semantic probe must report `fillColor=PASS[<A> <> <B>]` alongside the existing `pointSize` and `tracking` passes, and overall semantic probe must return PASS. The scratch probe that establishes the two comparison values must be corrected independently; F05 confirms the corrected probe against fixture swatches with known-distinct values.

### 3.5 F06 — appliedFont discrimination

**Proves:** the fingerprint captures `appliedFont` as a distinguishing property and the canonical-match logic discriminates on it.

**Construction:**
- Select two fonts dynamically but deterministically. The builder walks a preferred candidate list of font families in fixed order, selects the first two that are installed, confirms that `appliedFont` returns distinct values for the two, and aborts fixture generation if it cannot establish two distinct installed fonts. The selection is deterministic because the candidate list order is fixed; it is portable because it adapts to the host's installed set rather than hard-coding a pair that may be absent.
- Record the exact chosen pair in three places: the control labels, the fixture census, and the `# Fixture Font Pair` CSV provenance field. The provenance field must never remain `N/A` while F06 is asserted.
- Designate the first selected font as Font One and the second as Font Two.
- Create character style `Canary Canonical F06` with `appliedFont = Font One` and an otherwise fixed fingerprint.
- Create candidate `Canary Font Match F06` with identical fingerprint including `appliedFont = Font One`, one direct run. Expected REPLACE.
- Create near-miss `Canary Font Miss F06` identical except `appliedFont = Font Two`, one direct run. Expected HIGH.

**Expected rows:**

| Control | Risk | Formatting State | Semantic State | Direct Runs | Canonical Match | appliedFont in fingerprint | Authorization prerequisite |
|---|---|---|---|---|---|---|---|
| `Canary Font Match F06` | REPLACE | SUBSTANTIVE | NO EXPORT MAP | 1 | `Canary Canonical F06` (count 1) | `Font One` (not NOTHING) | `AUTHORIZED=YES` |
| `Canary Font Miss F06` | HIGH | SUBSTANTIVE | NO EXPORT MAP | 1 | none (count 0) | `Font Two` (not NOTHING) | none |

**Font-pair note:** because `appliedFont` discrimination depends on both fonts resolving on the host to distinct values, the builder confirms distinctness after selection and aborts loudly if it cannot establish two distinct installed fonts. A substituted or missing font must never silently collapse the two values into one. Deterministic selection from a fixed-order candidate list preserves portability across build environments without hard-coding a pair.

### 3.6 L01 — clean empty-shell LOW control

**Proves:** the LOW outcome fires for a genuinely orphaned style once the authorization chain is complete. This is the positive control for safe deletion and the clean-fixture replacement for any empty-shell control that previously demonstrated MEDIUM under incomplete authorization.

**Construction:**
- Create character style `Canary Orphan L01`.
- Apply it to nothing. Give it no dependencies, no export map, and no substantive formatting. Every fingerprint property resolves to NOTHING.

**Expected row:**

| Field | Value |
|---|---|
| Risk | LOW |
| Formatting State | EMPTY SHELL |
| Semantic State | NO EXPORT MAP |
| Usage Relationship | NONE |
| Direct Runs | 0 |
| Dependency Count | 0 |
| Export Map Count | 0 |
| Canonical Match | none |
| Authorization prerequisite | `AUTHORIZED=YES` |

**Relationship to E01 (locked):** E01 stays in the clean fixture with a narrowed purpose. It remains the negative half of the E01/E02 export-map pair and must resolve LOW once authorization succeeds, which preserves the independent export-map test. L01 becomes the dedicated empty-shell-safe-deletion control, giving the LOW outcome its own explicit assertion distinct from the export-map pair. E01's current MEDIUM reading in the v1.0.7 run is a symptom of the incomplete authorization chain, not its intended end state; under the corrected chain E01 resolves LOW. Neither E01 nor L01 may expect MEDIUM; any empty-shell control that is meant to demonstrate MEDIUM under deliberately degraded evidence belongs only in the degraded-evidence fixture.

---

## 4. Expected aggregate effect on the clean fixture

After the v1.0.8-dev patches and these additions, the clean coverage fixture is expected to satisfy:

- `AUTHORIZED=YES`. The authorization chain reaches completion because: the endnote frame-to-story resolution clears the usage-traversal block; the DOM contract selects applicable representatives so `STYLE_BASED_ON` and `VARIABLE_OPTIONS` resolve `SUPPORTED`; `VariableOptions.appliedStyle` resolves `SUPPORTED` through D08; and the corrected fill-color scratch probe returns semantic PASS, confirmed against F05.
- Risk counts contain no MEDIUM. LOW is demonstrated by L01, REPLACE by the F05 and F06 match controls (and by the existing F02 single-match control once authorization completes), and HIGH by the direct-usage and dependency-only controls that are correctly withheld from deletion.
- The DOM contract block list is empty. `NOT_APPLICABLE` and `NO_APPLICABLE_INSTANCE` states, where they occur, are recorded but do not appear as blocks.
- Location acceptance for C08 through C14 resolves to real page or frame contexts rather than `Pasteboard/No page`. Location resolution is a separate workstream from the authorization gates above and can proceed in parallel; it is listed here only because both must pass for the full fixture to pass.

The two workstreams are independent. The authorization gates unblock the risk-outcome controls (L01, F05, F06, and the E/F carryovers). The location fix unblocks C08 through C14. Neither shares code with the other, so they can be assigned and verified separately.

---

## 5. Authoring notes for fixture construction

- Place every control's referenced text on a real page where the control's acceptance requires a resolved location. Pasteboard and overset placements are reserved for the controls that specifically test those contexts (the current C06 overset and C07 pasteboard controls).
- Author each dependency-only control so the reference is the sole tie to the candidate style, keeping direct runs at zero, so the dependency path is the only thing the scanner can be resolving.
- Guarantee at authoring time that both members of each discrimination pair are present: two distinct swatches for F05, two present fonts for F06. Abort fixture generation with a clear message if a swatch or font is missing, so a silent substitution never collapses a discrimination pair.
- Record the font pair in `# Fixture Font Pair`. Leaving it `N/A` while asserting F06 is a contradiction the fixture should not ship with.
- Keep the clean fixture free of any deliberately degraded evidence. Broken frame-to-story links, missing required surfaces, and truncated dependency chains belong only in the degraded-evidence fixture, where MEDIUM and incomplete-authorization outcomes are the expected result.

---

## 6. Resolved decisions

The four open items are decided and locked into the sections above.

1. **Control lettering.** Final: D08, D09, D10, F05, F06, and L01. The IDs fit the existing control families and are used verbatim in the acceptance matrix.
2. **Index sharing.** D09 and D10 share one index. D09 establishes the document-level index-generation style dependency; D10 adds a topic and real page reference inside that same index. Independently testable, minimal fixture noise.
3. **E01 disposition.** E01 stays in the clean fixture with a narrowed purpose as the negative half of the E01/E02 export-map pair, resolving LOW once authorization succeeds. L01 is the dedicated empty-shell-safe-deletion control. The clean fixture expects no MEDIUM from either.
4. **F06 font selection.** Dynamic but deterministic. The builder selects the first two installed families from a fixed-order candidate list, confirms `appliedFont` returns distinct values, aborts if it cannot, and records the exact pair in control labels, the census, and the `# Fixture Font Pair` provenance field.
5. **Index generation.** The builder generates the shared index once during fixture construction, then reacquires the D10 page reference and verifies `pageNumberStyleOverride` by direct read-back, aborting if the read-back does not match.

## 7. Taxonomy runtime contract, as accepted

Pilgrim accepted the five-state taxonomy in §2 as the runtime contract model, with one wording refinement now incorporated: `NO_APPLICABLE_INSTANCE` means the contract is registered but the active document supplies no applicable instance, and it makes no claim that the build positively supports the surface. `NOT_APPLICABLE` and `NO_APPLICABLE_INSTANCE` remain visible in provenance and never block authorization. A required `NOT_EXPOSED` and any genuine `FAILED` state do block. This document is the acceptance contract for the next v1.0.8-dev code pass, with the authorization and location workstreams kept separate.
