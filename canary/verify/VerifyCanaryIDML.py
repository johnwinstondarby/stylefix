#!/usr/bin/env python3
# StyleFix - character style auditing for Adobe InDesign documents
# Copyright (C) 2026 John Darby
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
# SPDX-License-Identifier: GPL-3.0-or-later

"""StyleFix v1.0.8 independent IDML canary verifier.

This verifier shares no ExtendScript traversal code with either StyleFix or the
fixture builders. It reads the IDML ZIP directly.

Checks:
- direct-use controls C01-C14 and F02-F06 when present;
- E01/E02 StyleExportTagMap state in Resources/Styles.xml;
- E02 EPUB tag/class values when serialized by IDML.

Exit status:
  0 = all controls applicable to this fixture passed
  1 = one or more applicable controls failed or are indeterminate
  2 = input/verifier error
"""

from __future__ import annotations

import csv
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET

VERSION = "1.0.8"
CORE_DIRECT = [f"C{i:02d}" for i in range(1, 15)] + ["F02", "F03", "F04"]
SUPPLEMENTAL_DIRECT = ["F05", "F06"]
DIRECT_STYLE_RE = re.compile(r"^Unnamed Style (C\d{2}|F0[2-6])$")
EXPORT_CONTROLS = ["E01", "E02"]


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


def scan_story_xml(zf: zipfile.ZipFile, style_ids: dict[str, str]):
    found: dict[str, list[dict[str, str]]] = defaultdict(list)
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
            name = style_ids.get(sid, sid)
            match = DIRECT_STYLE_RE.match(name)
            if not match:
                continue
            cid = match.group(1)
            text = content_text(elem).replace("\r", " ").replace("\n", " ").strip()
            found[cid].append(
                {"story": story_name, "style": name, "style_id": sid, "text": text[:240]}
            )
    return found


def map_values_from_style(style_elem: ET.Element):
    """Return serialized StyleExportTagMap values found inside one CharacterStyle.

    IDML versions may differ in namespace/presentation, so this intentionally
    keys on the element local name and normalizes attribute spellings. If no
    map element is serialized beneath the CharacterStyle, the result is empty.
    """
    out: list[dict[str, str]] = []
    for elem in style_elem.iter():
        if "styleexporttagmap" not in local(elem.tag).replace("-", "").lower():
            continue
        vals = {"type": "", "tag": "", "class": "", "attrs": ""}
        for k, v in elem.attrib.items():
            nk = norm_attr_name(k)
            if nk == "exporttype":
                vals["type"] = v
            elif nk == "exporttag":
                vals["tag"] = v
            elif nk == "exportclass":
                vals["class"] = v
            elif nk == "exportattributes":
                vals["attrs"] = v
        out.append(vals)
    return out


def export_results(by_name: dict[str, ET.Element]):
    results = []
    for cid in EXPORT_CONTROLS:
        style_name = f"Unnamed Style {cid}"
        elem = by_name.get(style_name)
        if elem is None:
            results.append(
                {"id": cid, "style": style_name, "found_style": False, "maps": [],
                 "pass": False, "detail": "CharacterStyle missing from Resources/Styles.xml"}
            )
            continue
        maps = map_values_from_style(elem)
        if cid == "E01":
            ok = len(maps) == 0
            detail = f"serializedMaps={len(maps)};expected=0"
        else:
            ok = len(maps) >= 1
            tag_ok = any(m["tag"] == "span" for m in maps) if maps else False
            class_ok = any(m["class"] in {"canary-e02", "canary-e02-v108"} for m in maps) if maps else False
            ok = ok and tag_ok and class_ok
            detail = (
                f"serializedMaps={len(maps)};tagSpan={'YES' if tag_ok else 'NO'};"
                f"expectedClass={'YES' if class_ok else 'NO'};values={maps}"
            )
        results.append(
            {"id": cid, "style": style_name, "found_style": True, "maps": maps,
             "pass": ok, "detail": detail}
        )
    return results


def determine_direct_requirements(by_name: dict[str, ET.Element]):
    names = set(by_name)
    required: list[str] = []
    if any(f"Unnamed Style {cid}" in names for cid in CORE_DIRECT):
        required.extend(cid for cid in CORE_DIRECT if f"Unnamed Style {cid}" in names)
    if any(f"Unnamed Style {cid}" in names for cid in SUPPLEMENTAL_DIRECT):
        required.extend(cid for cid in SUPPLEMENTAL_DIRECT if f"Unnamed Style {cid}" in names)
    return required


def write_csv(path: Path, direct_required, direct_found, export_checks) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.writer(fh)
        writer.writerow([
            "Verifier Version", "Check Class", "Control ID", "Required", "Pass",
            "Occurrence/Map Count", "Style Name", "Story XML", "Sample/Detail"
        ])
        for cid in direct_required:
            rows = direct_found.get(cid, [])
            writer.writerow([
                VERSION, "DIRECT_USE", cid, "YES", "YES" if rows else "NO", len(rows),
                rows[0]["style"] if rows else f"Unnamed Style {cid}",
                " | ".join(r["story"] for r in rows[:10]),
                " | ".join(r["text"] for r in rows[:5]),
            ])
        for item in export_checks:
            writer.writerow([
                VERSION, "EXPORT_MAP", item["id"], "YES", "YES" if item["pass"] else "NO",
                len(item["maps"]), item["style"], "", item["detail"]
            ])


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: python VerifyCanaryIDML.py <StyleFix_Canary_*.idml>", file=sys.stderr)
        return 2
    src = Path(argv[1]).expanduser().resolve()
    if not src.is_file():
        print(f"IDML not found: {src}", file=sys.stderr)
        return 2
    out = src.with_name(src.stem + "_IDML_Census.csv")

    try:
        with zipfile.ZipFile(src, "r") as zf:
            style_ids, by_name = style_inventory(zf)
            direct_found = scan_story_xml(zf, style_ids)
            direct_required = determine_direct_requirements(by_name)
            exports = export_results(by_name) if any(f"Unnamed Style {x}" in by_name for x in EXPORT_CONTROLS) else []
    except (zipfile.BadZipFile, ET.ParseError, RuntimeError, OSError) as exc:
        print(f"StyleFix IDML verification failed: {exc}", file=sys.stderr)
        return 2

    write_csv(out, direct_required, direct_found, exports)
    missing = [cid for cid in direct_required if not direct_found.get(cid)]
    failed_exports = [x["id"] for x in exports if not x["pass"]]

    print(f"StyleFix IDML verifier v{VERSION}")
    print(f"Input:  {src}")
    print(f"Output: {out}")
    print(f"Required direct-use controls: {len(direct_required)}")
    print(f"Found: {len(direct_required) - len(missing)}")
    if exports:
        print("Export controls: " + ", ".join(
            f"{x['id']}={'PASS' if x['pass'] else 'FAIL'}" for x in exports
        ))

    if missing or failed_exports:
        if missing:
            print("MISSING DIRECT: " + ", ".join(missing))
        if failed_exports:
            print("FAILED EXPORT: " + ", ".join(failed_exports))
        return 1

    print("PASS: all applicable IDML canary controls passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
