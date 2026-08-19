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
HELPER_RE = re.compile(
    r'\b(?:safePropertyObject|safeProperty|propertyReadable|readableValue)'
    r'\s*\([^,\n]+,\s*"([^"]+)"'
)
CODE_RE = re.compile(
    r'\b(?:domGet108|domTryGet108|domCall108|domTryMethod108)'
    r'\s*\([^,\n]+,\s*"([^"]+)"'
)

CRITICAL_DIRECT = {
    "indexGenerationOptions", "styleExportTagMaps", "appliedLanguage",
    "fillColor", "strokeColor", "appliedFont", "isEndnoteStory",
    "storyType", "textStyleRanges", "footnotes", "tables", "cells",
    "texts", "pageReferences", "allTopics", "variableOptions",
    "tocStyleEntries", "endnoteTextFrames", "parentTextFrames",
    "textContainers",
}

# StyleFix-owned evidence/state objects. Their fields can intentionally mirror
# DOM names without being direct DOM access.
INTERNAL_RECEIVERS = {
    "inv", "inventory", "counts", "row", "usage", "scanMeta", "result", "audit",
    "capAudit", "contractAudit", "depAudit", "semanticAudit", "bookAudit", "state",
}

# Historical bad members that must never appear as executable member access.
FORBIDDEN_CODE = [
    (re.compile(r'(?<![A-Za-z0-9_$])(?:[A-Za-z_$][A-Za-z0-9_$]*|\])\.indexOptions\b'),
     "historical wrong Document.indexOptions name"),
    (re.compile(r'(?<![A-Za-z0-9_$])(?:[A-Za-z_$][A-Za-z0-9_$]*|\])\.endnotes\b'),
     "generic container.endnotes traversal"),
    (re.compile(r'\bparentStory\s*\.\s*applyCharacterStyle\b'),
     "applyCharacterStyle on Story"),
]

# Historical wrong literal-property use. Diagnostic prose containing the word
# language is harmless; only accessor/property declarations are checked.
FORBIDDEN_LITERAL = [
    (re.compile(
        r'\b(?:safePropertyObject|safeProperty|propertyReadable|readableValue)'
        r'\s*\([^,\n]+,\s*"language"'
     ), 'historical wrong fingerprint property literal "language"'),
]


def mask_js_code(src: str) -> str:
    """Mask JS strings/comments while preserving line and column positions.

    Quoted-string state resets at each physical source line. ExtendScript/ES3
    source strings cannot contain an unescaped physical newline. This keeps
    punctuation in a JavaScript regex literal on one line from corrupting the
    lexical state of later lines. Block comments remain stateful across lines.
    """
    out: list[str] = []
    in_block = False

    for line in src.splitlines(keepends=True):
        chars = list(line)
        i = 0
        quote: str | None = None

        while i < len(chars):
            ch = chars[i]
            nxt = chars[i + 1] if i + 1 < len(chars) else ""

            if in_block:
                if ch == "*" and nxt == "/":
                    chars[i] = " "
                    chars[i + 1] = " "
                    in_block = False
                    i += 2
                else:
                    if ch not in "\r\n":
                        chars[i] = " "
                    i += 1
                continue

            if quote is not None:
                if ch == "\\":
                    if ch not in "\r\n":
                        chars[i] = " "
                    if i + 1 < len(chars):
                        if chars[i + 1] not in "\r\n":
                            chars[i + 1] = " "
                        i += 2
                    else:
                        i += 1
                    continue
                if ch == quote:
                    chars[i] = " "
                    quote = None
                    i += 1
                    continue
                if ch not in "\r\n":
                    chars[i] = " "
                i += 1
                continue

            if ch == "/" and nxt == "/":
                for j in range(i, len(chars)):
                    if chars[j] not in "\r\n":
                        chars[j] = " "
                break

            if ch == "/" and nxt == "*":
                chars[i] = " "
                chars[i + 1] = " "
                in_block = True
                i += 2
                continue

            if ch in ("'", '"'):
                chars[i] = " "
                quote = ch
                i += 1
                continue

            i += 1

        out.append("".join(chars))

    return "".join(out)


def line_of(src: str, pos: int) -> int:
    return src.count("\n", 0, pos) + 1


def source_line(src: str, line_no: int) -> str:
    lines = src.splitlines()
    if 1 <= line_no <= len(lines):
        return lines[line_no - 1].strip()
    return ""


def scan_live_code(filename: str, raw: str, errors: list[str]) -> None:
    code = mask_js_code(raw)

    for pat, label in FORBIDDEN_CODE:
        for match in pat.finditer(code):
            ln = line_of(code, match.start())
            errors.append(
                f"{filename}:{ln}: forbidden {label} | {source_line(raw, ln)}"
            )

    for pat, label in FORBIDDEN_LITERAL:
        for match in pat.finditer(raw):
            ln = line_of(raw, match.start())
            errors.append(
                f"{filename}:{ln}: forbidden {label} | {source_line(raw, ln)}"
            )

    for name in sorted(CRITICAL_DIRECT):
        pat = re.compile(
            r'(?<![A-Za-z0-9_$])'
            r'(?P<recv>[A-Za-z_$][A-Za-z0-9_$]*|\])\.'
            + re.escape(name) + r'\b'
        )
        for match in pat.finditer(code):
            recv = match.group("recv")
            if recv in INTERNAL_RECEIVERS:
                continue
            ln = line_of(code, match.start())
            errors.append(
                f"{filename}:{ln}: direct DOM access .{name} "
                f"on receiver {recv!r}; use contract accessor | "
                f"{source_line(raw, ln)}"
            )


def main() -> int:
    contract = CONTRACT.read_text(encoding="utf-8")
    patch_files = sorted(PATCH_DIR.glob("StyleFix.patch*.jsxinc"))
    if not patch_files:
        print("StyleFix DOM contract static check: FAIL")
        print(" - no v1.0.8 patch parts found")
        return 1

    loader = LOADER.read_text(encoding="utf-8")
    regs = REG_RE.findall(contract)
    codes = {c for c, _ in regs}
    names = {n for _, n in regs}
    errors: list[str] = []

    if len(regs) < 70:
        errors.append(f"contract registry unexpectedly small: {len(regs)} entries")

    patch_raw: dict[Path, str] = {
        path: path.read_text(encoding="utf-8") for path in patch_files
    }
    patch_joined = "\n".join(patch_raw[path] for path in patch_files)

    # Patch12 adds DOC_COLORS dynamically. Account for that declared code/name.
    if 'domRegister108("DOC_COLORS","colors"' in patch_joined:
        codes.add("DOC_COLORS")
        names.add("colors")

    for path, raw in patch_raw.items():
        for match in HELPER_RE.finditer(raw):
            name = match.group(1)
            if name not in names:
                errors.append(
                    f"{path.name}:{line_of(raw, match.start())}: "
                    f"helper uses unregistered DOM name {name!r}"
                )

        for match in CODE_RE.finditer(raw):
            code_name = match.group(1)
            if code_name not in codes:
                errors.append(
                    f"{path.name}:{line_of(raw, match.start())}: "
                    f"accessor uses unregistered contract code {code_name!r}"
                )

        # Lex each patch independently. A lexical assumption in one patch part
        # must never contaminate the next patch part.
        scan_live_code(path.name, raw, errors)

    for name in ["indexGenerationOptions", "appliedLanguage", "styleExportTagMaps"]:
        if name not in names:
            errors.append(f"required corrected DOM name missing from registry: {name}")

    if "domAssertRegisteredName108(prop);" not in patch_joined:
        errors.append("dynamic fingerprint property access is missing domAssertRegisteredName108(prop)")

    patch12 = PATCH_DIR / "StyleFix.patch12.jsxinc"
    if not patch12.exists():
        errors.append("accepted-contract patch12 is missing")
    else:
        p12 = patch12.read_text(encoding="utf-8")
        if "STYLEFIX_PATCH_PART: 1.0.8/12" not in p12:
            errors.append("patch12 marker is missing or wrong")
        if (
            'entry = DOM108["VARIABLE_APPLIED_STYLE"]' not in p12
            or 'entry.name = "appliedCharacterStyle"' not in p12
        ):
            errors.append(
                "running-header VARIABLE_APPLIED_STYLE is not corrected "
                "to appliedCharacterStyle"
            )
        for state in [
            "NOT_APPLICABLE", "NO_APPLICABLE_INSTANCE", "NOT_EXPOSED", "FAILED"
        ]:
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
    remove_pos = loader.find("code = code.replace(bootstrapNeedle,bootstrapReplacement);")
    append_pos = loader.find(
        'code += "\\n" + patch106 + "\\n" + contract108 + "\\n" + '
        'patch108Pieces.join("\\n");'
    )
    boot_pos = loader.find("__STYLEFIX_BOOT_STAGE = 'buildUI'")
    if "var bootstrapNeedle" not in loader:
        errors.append("loader does not declare the legacy bootstrap block")
    if remove_pos < 0:
        errors.append("loader does not remove the inherited early bootstrap")
    if append_pos < 0:
        errors.append("loader does not append contract/patch initialization as expected")
    if boot_pos < 0:
        errors.append("loader does not reinsert the deferred buildUI bootstrap")
    if (
        remove_pos >= 0
        and append_pos >= 0
        and boot_pos >= 0
        and not (remove_pos < append_pos < boot_pos)
    ):
        errors.append(
            "loader bootstrap order is unsafe: removal < contract append < "
            "deferred boot is not satisfied"
        )

    if errors:
        print("StyleFix DOM contract static check: FAIL")
        for error in errors:
            print(" - " + error)
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
