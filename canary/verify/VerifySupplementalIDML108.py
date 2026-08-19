#!/usr/bin/env python3
"""Independent IDML verifier for the StyleFix v1.0.8 supplemental fixture.

The verifier reads the IDML ZIP directly and shares no ExtendScript traversal
code with StyleFix or the fixture builder.

Checks:
- F05 Match, F05 Miss, F06 Match, and F06 Miss are serialized as direct uses;
- each direct-use style carries the expected literal text;
- D10 has zero serialized direct uses so it remains dependency-only;
- E01 has no serialized StyleExportTagMap;
- E02 has exactly one EPUB span mapping with class canary-e02-v108;
- L01 exists and has no export mapping;
- F05 Match serializes the same point size, tracking, and fill color as its
  canonical style, while F05 Miss serializes a different fill color;
- F06 Match serializes the same point size, tracking, and applied font as its
  canonical style, while F06 Miss serializes a different applied font.

Exit status:
  0 = all checks passed
  1 = one or more checks failed
  2 = input/verifier error
"""

from __future__ import annotations

import csv
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET

VERSION = "1.0.1"

DIRECT = {
    "F05 Match": "F05 MATCH fill discriminator",
    "F05 Miss": "F05 MISS fill discriminator",
    "F06 Match": "F06 MATCH font discriminator",
    "F06 Miss": "F06 MISS font discriminator",
}
NEGATIVE_DIRECT = ["D10"]


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def norm_attr_name(name: str) -> str:
    return local(name).replace("-", "").replace("_", "").lower()


def style_inventory(zf: zipfile.ZipFile):
    try:
        data = zf.read("Resources/Styles.xml")
    except KeyError as exc:
        raise RuntimeError("Resources/Styles.xml is missing from the IDML.") from exc
    root = ET.fromstring(data)
    by_self: dict[str, str] = {}
    by_name: dict[str, ET.Element] = {}
    for elem in root.iter():
        if local(elem.tag) != "CharacterStyle":
            continue
        sid = elem.attrib.get("Self", "")
        name = elem.attrib.get("Name", "")
        if sid:
            by_self[sid] = name
        if name:
            by_name[name] = elem
    return by_self, by_name


def content_text(elem: ET.Element) -> str:
    parts: list[str] = []
    for node in elem.iter():
        if local(node.tag) == "Content" and node.text:
            parts.append(node.text)
    return "".join(parts)


def scan_direct(zf: zipfile.ZipFile, style_ids: dict[str, str]):
    targets = {f"Unnamed Style {name}" for name in DIRECT}
    targets.update(f"Unnamed Style {name}" for name in NEGATIVE_DIRECT)
    found: dict[str, list[tuple[str, str]]] = defaultdict(list)
    story_names = sorted(
        name for name in zf.namelist()
        if name.startswith("Stories/") and name.lower().endswith(".xml")
    )
    if not story_names:
        raise RuntimeError("No Stories/*.xml files were found in the IDML.")
    for story_name in story_names:
        root = ET.fromstring(zf.read(story_name))
        for elem in root.iter():
            if local(elem.tag) != "CharacterStyleRange":
                continue
            sid = elem.attrib.get("AppliedCharacterStyle", "")
            style_name = style_ids.get(sid, sid)
            if style_name not in targets:
                continue
            text = content_text(elem).replace("\r", " ").replace("\n", " ").strip()
            found[style_name].append((story_name, text))
    return found


def map_values(style_elem: ET.Element):
    out: list[dict[str, str]] = []
    for elem in style_elem.iter():
        if "styleexporttagmap" not in local(elem.tag).replace("-", "").lower():
            continue
        vals = {"type": "", "tag": "", "class": "", "attrs": ""}
        for key, value in elem.attrib.items():
            nk = norm_attr_name(key)
            if nk == "exporttype":
                vals["type"] = value
            elif nk == "exporttag":
                vals["tag"] = value
            elif nk == "exportclass":
                vals["class"] = value
            elif nk == "exportattributes":
                vals["attrs"] = value
        out.append(vals)
    return out


def child_property(style_elem: ET.Element, child_name: str) -> str:
    for child in style_elem.iter():
        if local(child.tag) == child_name:
            return (child.text or "").strip()
    return ""


def serialized_value(style_elem: ET.Element, prop: str) -> str:
    if prop == "AppliedFont":
        return child_property(style_elem, "AppliedFont")
    return style_elem.attrib.get(prop, "")


def fingerprint_checks(by_name: dict[str, ET.Element]):
    checks: list[tuple[str, bool, str]] = []

    f05m = by_name.get("Unnamed Style F05 Match")
    f05x = by_name.get("Unnamed Style F05 Miss")
    f05c = by_name.get("Canary Canonical F05")
    if f05m is None or f05x is None or f05c is None:
        checks.append(("F05 serialization", False, "one or more F05 styles are missing"))
    else:
        match_same = all(
            serialized_value(f05m, p) == serialized_value(f05c, p)
            for p in ("PointSize", "Tracking", "FillColor")
        )
        miss_base_same = all(
            serialized_value(f05x, p) == serialized_value(f05c, p)
            for p in ("PointSize", "Tracking")
        )
        miss_fill_diff = serialized_value(f05x, "FillColor") != serialized_value(f05c, "FillColor")
        detail = (
            f"matchFill={serialized_value(f05m,'FillColor')};"
            f"missFill={serialized_value(f05x,'FillColor')};"
            f"canonicalFill={serialized_value(f05c,'FillColor')}"
        )
        checks.append(("F05 serialization", match_same and miss_base_same and miss_fill_diff, detail))

    f06m = by_name.get("Unnamed Style F06 Match")
    f06x = by_name.get("Unnamed Style F06 Miss")
    f06c = by_name.get("Canary Canonical F06")
    if f06m is None or f06x is None or f06c is None:
        checks.append(("F06 serialization", False, "one or more F06 styles are missing"))
    else:
        match_same = all(
            serialized_value(f06m, p) == serialized_value(f06c, p)
            for p in ("PointSize", "Tracking", "AppliedFont")
        )
        miss_base_same = all(
            serialized_value(f06x, p) == serialized_value(f06c, p)
            for p in ("PointSize", "Tracking")
        )
        miss_font_diff = serialized_value(f06x, "AppliedFont") != serialized_value(f06c, "AppliedFont")
        detail = (
            f"matchFont={serialized_value(f06m,'AppliedFont')};"
            f"missFont={serialized_value(f06x,'AppliedFont')};"
            f"canonicalFont={serialized_value(f06c,'AppliedFont')}"
        )
        checks.append(("F06 serialization", match_same and miss_base_same and miss_font_diff, detail))

    return checks


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: python VerifySupplementalIDML108.py <StyleFix_Canary_Supplemental_v1_0_8.idml>", file=sys.stderr)
        return 2

    src = Path(argv[1]).expanduser().resolve()
    if not src.is_file():
        print(f"IDML not found: {src}", file=sys.stderr)
        return 2

    out = src.with_name(src.stem + "_IDML_Census.csv")
    rows: list[list[object]] = []
    failures: list[str] = []

    try:
        with zipfile.ZipFile(src, "r") as zf:
            style_ids, by_name = style_inventory(zf)
            direct = scan_direct(zf, style_ids)

            for short, literal in DIRECT.items():
                style_name = f"Unnamed Style {short}"
                occurrences = direct.get(style_name, [])
                literal_ok = any(literal in text for _, text in occurrences)
                ok = len(occurrences) >= 1 and literal_ok
                detail = (
                    f"occurrences={len(occurrences)};literal={'YES' if literal_ok else 'NO'};"
                    f"stories={' | '.join(x[0] for x in occurrences[:10])}"
                )
                rows.append(["DIRECT_USE", short, style_name, "YES" if ok else "NO", detail])
                if not ok:
                    failures.append(short)

            for short in NEGATIVE_DIRECT:
                style_name = f"Unnamed Style {short}"
                occurrences = direct.get(style_name, [])
                ok = len(occurrences) == 0
                detail = (
                    f"occurrences={len(occurrences)};expected=0;"
                    f"stories={' | '.join(x[0] for x in occurrences[:10])};"
                    f"samples={' | '.join(x[1] for x in occurrences[:5])}"
                )
                rows.append(["DIRECT_USE_NEGATIVE", short, style_name, "YES" if ok else "NO", detail])
                if not ok:
                    failures.append(short + " direct-use negative")

            for short in ("E01", "E02", "L01"):
                style_name = f"Unnamed Style {short}"
                elem = by_name.get(style_name)
                maps = map_values(elem) if elem is not None else []
                if short in {"E01", "L01"}:
                    ok = elem is not None and len(maps) == 0
                    detail = f"style={'YES' if elem is not None else 'NO'};serializedMaps={len(maps)};expected=0"
                else:
                    ok = (
                        elem is not None
                        and len(maps) == 1
                        and maps[0]["type"] == "EPUB"
                        and maps[0]["tag"] == "span"
                        and maps[0]["class"] == "canary-e02-v108"
                    )
                    detail = f"style={'YES' if elem is not None else 'NO'};serializedMaps={len(maps)};values={maps}"
                rows.append(["EXPORT_MAP", short, style_name, "YES" if ok else "NO", detail])
                if not ok:
                    failures.append(short)

            for check_name, ok, detail in fingerprint_checks(by_name):
                rows.append(["FINGERPRINT_SERIALIZATION", check_name, "", "YES" if ok else "NO", detail])
                if not ok:
                    failures.append(check_name)

    except (zipfile.BadZipFile, ET.ParseError, RuntimeError, OSError) as exc:
        print(f"StyleFix supplemental IDML verification failed: {exc}", file=sys.stderr)
        return 2

    with out.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.writer(fh)
        writer.writerow(["Verifier Version", "Check Class", "Control", "Style Name", "Pass", "Detail"])
        for row in rows:
            writer.writerow([VERSION] + row)

    print(f"StyleFix supplemental IDML verifier v{VERSION}")
    print(f"Input:  {src}")
    print(f"Output: {out}")
    print(f"Checks: {len(rows)}")
    print(f"Passed: {len(rows) - len(failures)}")

    if failures:
        print("FAIL: " + ", ".join(failures))
        return 1

    print("PASS: all supplemental IDML controls passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
