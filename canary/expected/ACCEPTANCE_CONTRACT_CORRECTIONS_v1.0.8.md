# StyleFix v1.0.8 supplemental acceptance-contract corrections

These corrections are implementation facts verified against the Adobe InDesign DOM before the supplemental fixture was coded.

1. **D08 running-header property.** `VariableTypes.MATCH_CHARACTER_STYLE_TYPE` returns a `MatchCharacterStylePreference` through `TextVariable.variableOptions`. The character-style property on that preference is `appliedCharacterStyle`, not `appliedStyle`. The internal contract code `VARIABLE_APPLIED_STYLE` remains stable, but it resolves to `MatchCharacterStylePreference.appliedCharacterStyle` at runtime.
2. **Audited candidate names.** The fixture candidate styles are named `Unnamed Style D08`, `Unnamed Style D09`, `Unnamed Style D10`, `Unnamed Style F05 Match`, `Unnamed Style F05 Miss`, `Unnamed Style F06 Match`, `Unnamed Style F06 Miss`, and `Unnamed Style L01` so they are inside StyleFix's current audited candidate family. Canonical styles keep their `Canary Canonical ...` names.
3. **Endnote authorization evidence.** Usage completeness is established from positively inventoried endnote stories in `Document.stories`, which is the path the scanner traverses. `endnoteTextFrames` frame-to-story linkage remains diagnostic corroboration and does not veto a positively scanned endnote story.

The five-state taxonomy and all locked control IDs remain unchanged.
