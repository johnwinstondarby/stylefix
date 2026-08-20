# Localis Mutation Transaction Core

**Component:** `core/mutate.jsxinc`  
**Current version:** 0.1.0  
**Runtime:** Adobe InDesign ExtendScript / ECMAScript 3  
**Status:** standalone canary stage; not yet wired into StyleFix production behavior

## Purpose

`core/mutate.jsxinc` is a portable transaction engine for every Localis InDesign tool that changes a document. It centralizes the safety mechanics around a mutation while leaving tool-specific document logic in callbacks.

The component is intentionally independent of StyleFix. It can move into the planned suite repository without changing its public contract.

## Core rule

Every document mutation follows this sequence:

```
PRECHECK
    -> SNAPSHOT
    -> ROLLBACK READINESS
    -> MUTATE
    -> VERIFY
         PASS -> COMMITTED
         FAIL -> ROLLBACK -> VERIFY ROLLBACK
                              PASS -> ROLLED BACK
                              FAIL -> ROLLBACK_FAILED -> STOP BATCH
```

The transaction engine never calls `app.undo()` for item recovery. Internal rollback writes the captured prior state back to the target and verifies the restoration. The entire command is separately grouped with `app.doScript(..., UndoModes.ENTIRE_SCRIPT, ...)` so a successful batch remains one operator-controlled Undo step.

## Public API

Load the component and create a core instance:

```javascript
var mutateCore = LocalisCreateMutateCore({app:app});
```

Run a transaction:

```javascript
var tx = mutateCore.transaction(
    "ToolName - Fix Selected",
    targets,
    {
        precheck:precheck,
        snapshot:snapshot,
        mutate:mutate,
        verify:verify,
        rollback:rollback,
        verifyRollback:verifyRollback,
        describeTarget:describeTarget
    },
    {
        onEvent:onEvent
    }
);
```

`describeTarget` and `onEvent` are optional. The six safety callbacks are required.

## Callback contracts

### `precheck(target,index,context)`

Re-evaluates eligibility immediately before mutation.

Return either:

```javascript
true
```

or:

```javascript
{ok:true, reason:"eligible"}
```

A false or missing decision produces `SKIPPED` and no mutation.

### `snapshot(target,index,context)`

Captures the state required to reconstruct the target.

Return:

```javascript
{
    state:{ /* restoration state */ },
    rollbackReady:true,
    reason:"snapshot complete"
}
```

`rollbackReady` must be explicitly true. Otherwise the target is skipped.

A snapshot should contain stable restoration values rather than relying only on live InDesign object references. Typical state includes IDs, paths, style names or IDs, primitive formatting values, character-style run signatures, cell fills, link paths, metadata values, or other information the tool needs to restore and verify the prior state.

### `mutate(target,snapshotState,index,context)`

Performs the intended change.

Any exception is assumed capable of leaving a partial mutation. The core immediately enters rollback.

### `verify(target,snapshotState,index,context)`

Re-reads the post-mutation state from InDesign. A write returning without error is not proof of success.

Return true or `{ok:true,...}` only when the intended state is confirmed.

### `rollback(target,snapshotState,index,context)`

Restores the captured prior state. This callback never calls `app.undo()`.

### `verifyRollback(target,snapshotState,index,context)`

Re-reads the restored state and proves that rollback succeeded.

A failed or thrown rollback verification produces `ROLLBACK_FAILED`. The transaction stops immediately and no later targets are changed.

## Item result states

| State | Meaning |
|---|---|
| `SKIPPED` | Eligibility or rollback readiness was not established. No mutation was started. |
| `COMMITTED` | Mutation completed and post-state verification passed. |
| `MUTATION_FAILED_ROLLED_BACK` | Mutation threw; prior state was restored and verified. |
| `VERIFICATION_FAILED_ROLLED_BACK` | Mutation returned, verification failed; prior state was restored and verified. |
| `ROLLBACK_FAILED` | Restoration failed or could not be verified. Remaining targets were aborted. |

Batch `finalState` can additionally report `COMPLETED_WITH_ROLLBACKS`, `ROLLED_BACK`, or `NO_CHANGES`.

## Hard safety invariants

1. Mutation does not start without explicit rollback readiness.
2. Mutation exceptions trigger rollback even when the exception may have occurred before the first write.
3. Verification is based on read-back state rather than successful method return.
4. Rollback is verified independently.
5. Rollback failure always stops the batch.
6. No configuration option can continue a batch after `ROLLBACK_FAILED`.
7. Internal recovery never consumes or depends on the InDesign Undo stack.
8. Undo grouping is required by default.
9. Observer/UI callback failures do not change transaction behavior; they are counted as `observerErrors`.
10. The journal records the safety path taken for every processed target.

## Transaction journal

The returned transaction object records:

- component version
- label and undo label
- requested and processed target counts
- committed, skipped, rolled-back, and rollback-failure counts
- abort state and reason
- fatal wrapper error, if any
- timing
- per-target journal rows

Each target row records:

- target description
- precheck result
- snapshot capture and rollback readiness
- mutation attempt and return state
- verification result
- rollback attempt and return state
- rollback verification result
- final item state
- failure and rollback error text
- timing

This journal is designed to feed the future shared `core/report` provenance and diagnostic layer.

## UI integration

The component contains no ScriptUI code. `options.onEvent(eventName,tx,journal)` receives advisory transaction events that a tool can use for the shared progress window or status text. Observer exceptions are swallowed and counted so UI instrumentation cannot alter mutation safety.

Current event names include:

`PRECHECK`, `SNAPSHOT`, `MUTATE`, `VERIFY`, `ROLLBACK`, `ROLLBACK_VERIFY`, `SKIPPED`, `COMMITTED`, `ROLLED_BACK`, `ROLLBACK_FAILED`.

## Canary

`canary/mutate/TestMutateCore.jsx` exercises the component in a disposable InDesign document.

Acceptance controls:

| Control | Expected result |
|---|---|
| T01 | successful mutation verifies and commits |
| T02 | failed precheck skips without mutation |
| T03 | mutation exception before a write enters rollback and verifies restoration |
| T04 | partial mutation followed by exception restores prior state |
| T05 | post-mutation verification failure restores prior state |
| T06 | rollback restores a multi-property snapshot |
| T07 | broken rollback produces `ROLLBACK_FAILED` and aborts |
| T08 | no later target is changed after rollback failure |
| T09 | two successful target mutations are reversed by one InDesign Undo |
| T10 | transaction journal contains the expected evidence fields |

The canary writes a TXT log and CSV result file to the desktop. Production integration is blocked until all ten controls pass in the target InDesign version.

## Planned adopters

The component is intended to become the shared `core/mutate` implementation for:

- DocStats guarded actions
- HeaderFix correction actions
- NormalFix selected paragraph remediation
- TableFix selected table remediation
- StyleFix v2 guarded replacement/deletion actions

Tool-specific snapshots and restoration functions remain with each tool. Transaction sequencing and recovery semantics remain shared.
