#!/usr/bin/env python3
"""Static guard for StyleFix v1.0.8 DOM-contract and bootstrap discipline.

Checks that:
- every literal property passed to legacy accessor helpers is registered;
- every v1.0.8 domGet/domCall contract code is declared;
- historically wrong names do not reappear at live call sites;
- safety-critical DOM names are not accessed directly in the v1.0.8 patch;
- the accepted five-state contract correction is present;
- the running-header character-style contract resolves to appliedCharacterStyle;
- patch12 is installed and loaded after the earlier v1.0.8 patch parts;
- the legacy base bootstrap is removed and restarted only after contract/patch
  initialization has been appended to the assembled program.

The checker is part of the release gate, not runtime evidence.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "src" / "StyleFix.dom.v1.0.8.jsxinc"
PATCH_DIR = ROOT / "src" / "v1.0.8"
LOADER = ROOT / "StyleFix.jsx"

REG_RE = re.compile(r'domRegister108\("([^"]+)","([^"]+)"')
HELPER_RE = re.compile(r'\b(?:safePropertyObject|safeProperty|propertyReadable|readableValue)\s*\([^,]+,\s*"([^"]+)"')
CODE_RE = re.compile(r'\b(?:domGet108|domTryGet108|domCall108|domTryMethod108)\s*\([^,]+,\s*"([^"]+)"')

CRITICAL_DIRECT = {
    "indexGenerationOptions", "styleExportTagMaps", "appliedLanguage",
    "fillColor", "strokeColor", "appliedFont", "isEndnoteStory",
    "storyType", "textStyleRanges", "footnotes", "tables", "cells",
    "texts", "pageReferences", "allTopics", "variableOptions",
    "tocStyleEntries", "endnoteTextFrames", "parentTextFrames",
    "textContainers",
}

# These are StyleFix-owned evidence/state objects, not InDesign DOM hosts. Their
# field names deliberately mirror the DOM surfaces they summarize. The direct
# access guard must not confuse evidence fields such as inv.endnoteTextFrames
# with host-object access such as doc.endnoteTextFrames.
INTERNAL_RECEIVERS = {
    "inv", "inventory", "counts", "row", "usage", "scanMeta", "result", "audit",
    "capAudit", "contractAudit", "depAudit", "semanticAudit", "bookAudit", "state",
}

FORBIDDEN = [
    (re.compile(r'\bindexOptions\b'), "historical wrong Document.indexOptions name"),
    (re.compile(r'"language"'), "historical wrong fingerprint property language"),
    (re.compile(r'\.endnotes\b'), "generic container.endnotes traversal"),
    (re.compile(r'parentStory\s*\.\s*applyCharacterStyle'), "applyCharacterStyle on Story"),
]


def strip_strings_comments(src: str) -> str:
    out = []
    i = 0
    state = "code"
    quote = ""
    while i < len(src):
        ch = src[i]
        nxt = src[i + 1] if i + 1 < len(src) else ""
        if state == "code":
            if ch == "/" and nxt == "/":
                state = "line_comment"; out.extend("  "); i += 2; continue
            if ch == "/" and nxt == "*":
                state = "block_comment"; out.extend("  "); i += 2; continue
            if ch in "'\"":
                state = "string"; quote = ch; out.append(" "); i += 1; continue
            out.append(ch); i += 1; continue
        if state == "line_comment":
            if ch == "\n": state = "code"; out.append("\n")
            else: out.append(" ")
            i += 1; continue
        if state == "block_comment":
            if ch == "*" and nxt == "/":
                state = "code"; out.extend("  "); i += 2
            else:
                out.append("\n" if ch == "\n" else " "); i += 1
            continue
        if state == "string":
            if ch == "\\":
                out.append(" ")
                if i + 1 < len(src): out.append("\n" if src[i+1] == "\n" else " ")
                i += 2; continue
            if ch == quote:
                state = "code"; out.append(" "); i += 1; continue
            out.append("\n" if ch == "\n" else " "); i += 1
    return "".join(out)


def line_of(src: str, pos: int) -> int:
    return src.count("\n", 0, pos) + 1


def main() -> int:
    contract = CONTRACT.read_text(encoding="utf-8")
    patch_files = sorted(PATCH_DIR.glob("StyleFix.patch*.jsxinc"))
    if not patch_files:
        print("StyleFix DOM contract static check: FAIL")
        print(" - no v1.0.8 patch parts found")
        return 1
    patch = "\n".join(p.read_text(encoding="utf-8") for p in patch_files)
    loader = LOADER.read_text(encoding="utf-8")
    regs = REG_RE.findall(contract)
    codes = {c for c, _ in regs}
    names = {n for _, n in regs}
    errors: list[str] = []

    if len(regs) < 70:
        errors.append(f"contract registry unexpectedly small: {len(regs)} entries")

    # Patch12 adds only DOC_COLORS dynamically; account for that declared code.
    if 'domRegister108("DOC_COLORS","colors"' in patch:
        codes.add("DOC_COLORS")
        names.add("colors")

    for match in HELPER_RE.finditer(patch):
        name = match.group(1)
        if name not in names:
            errors.append(f"patch:{line_of(patch, match.start())}: helper uses unregistered DOM name {name!r}")

    for match in CODE_RE.finditer(patch):
        code = match.group(1)
        if code not in codes:
            errors.append(f"patch:{line_of(patch, match.start())}: accessor uses unregistered contract code {code!r}")

    code_patch = strip_strings_comments(patch)
    code_loader = strip_strings_comments(loader)
    code_combined = code_patch + "\n" + code_loader
    for pat, label in FORBIDDEN:
        for match in pat.finditer(code_combined):
            errors.append(f"code:{line_of(code_combined, match.start())}: forbidden {label}")

    for name in sorted(CRITICAL_DIRECT):
        pat = re.compile(r'(?P<recv>[A-Za-z_$][A-Za-z0-9_$]*|\])\.' + re.escape(name) + r'\b')
        for match in pat.finditer(code_patch):
            recv = match.group("recv")
            if recv in INTERNAL_RECEIVERS:
                continue
            errors.append(
                f"patch:{line_of(code_patch, match.start())}: direct DOM access .{name} "
                f"on receiver {recv!r}; use contract accessor"
            )

    for name in ["indexGenerationOptions", "appliedLanguage", "styleExportTagMaps"]:
        if name not in names:
            errors.append(f"required corrected DOM name missing from registry: {name}")

    if "domAssertRegisteredName108(prop);" not in patch:
        errors.append("dynamic fingerprint property access is missing domAssertRegisteredName108(prop)")

    patch12 = PATCH_DIR / "StyleFix.patch12.jsxinc"
    if not patch12.exists():
        errors.append("accepted-contract patch12 is missing")
    else:
        p12 = patch12.read_text(encoding="utf-8")
        if "STYLEFIX_PATCH_PART: 1.0.8/12" not in p12:
            errors.append("patch12 marker is missing or wrong")
        if 'entry = DOM108["VARIABLE_APPLIED_STYLE"]' not in p12 or 'entry.name = "appliedCharacterStyle"' not in p12:
            errors.append("running-header VARIABLE_APPLIED_STYLE is not corrected to appliedCharacterStyle")
        for state in ["NOT_APPLICABLE", "NO_APPLICABLE_INSTANCE", "NOT_EXPOSED", "FAILED"]:
            if state not in p12:
                errors.append(f"accepted five-state taxonomy missing {state} from patch12")
        if "findApplicableBasedOnRepresentative108" not in p12:
            errors.append("patch12 does not select an applicable basedOn representative")
        if "findRunningHeaderRepresentative108" not in p12:
            errors.append("patch12 does not select an applicable running-header representative")

    if '"src/v1.0.8/StyleFix.patch12.jsxinc"' not in loader:
        errors.append("loader does not include StyleFix.patch12.jsxinc")

    # Temporal initialization gate. Function declarations are hoisted in
    # ExtendScript, while registry assignments/domRegister calls are not.
    # The inherited base bootstrap must therefore be removed before eval and
    # reinserted after contract + v1.0.8 patch initialization.
    remove_pos = loader.find("code = code.replace(bootstrapNeedle,bootstrapReplacement);")
    append_pos = loader.find('code += "\\n" + patch106 + "\\n" + contract108 + "\\n" + patch108Pieces.join("\\n");')
    boot_pos = loader.find("__STYLEFIX_BOOT_STAGE = 'buildUI'")
    if "var bootstrapNeedle" not in loader:
        errors.append("loader does not declare the legacy bootstrap block")
    if remove_pos < 0:
        errors.append("loader does not remove the inherited early bootstrap")
    if append_pos < 0:
        errors.append("loader does not append contract/patch initialization as expected")
    if boot_pos < 0:
        errors.append("loader does not reinsert the deferred buildUI bootstrap")
    if remove_pos >= 0 and append_pos >= 0 and boot_pos >= 0 and not (remove_pos < append_pos < boot_pos):
        errors.append("loader bootstrap order is unsafe: removal < contract append < deferred boot is not satisfied")

    if errors:
        print("StyleFix DOM contract static check: FAIL")
        for e in errors:
            print(" - " + e)
        return 1

    print("StyleFix DOM contract static check: PASS")
    print(f"Registered contract entries: {len(regs)}")
    print(f"Registered unique names: {len(names)}")
    print("Historical bad-name guard: PASS")
    print("Critical direct-access guard: PASS")
    print("Accepted five-state contract guard: PASS")
    print("Running-header property guard: PASS")
    print("Deferred-bootstrap order guard: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
