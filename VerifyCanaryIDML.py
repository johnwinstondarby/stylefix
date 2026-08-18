#!/usr/bin/env python3
"""
StyleFix v1.0.6 canary IDML verifier.

Independent third measurement for the StyleFix canary. It does not use
BuildCanary.jsx or StyleFix.jsx traversal code. It opens the exported IDML ZIP,
maps character-style IDs from Resources/Styles.xml, then scans Story XML for
CharacterStyleRange elements using the planted canary styles.

Usage:
    python VerifyCanaryIDML.py StyleFix_Canary_v1_0_6.idml

Output:
    <input-stem>_IDML_Census.csv

Exit status:
    0 = every required direct-use control was found
    1 = one or more required direct-use controls were missing
    2 = verifier/input error
"""

from __future__ import annotations

import csv
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET

VERSION = "1.0.6"
REQUIRED = [f"C{i:02d}" for i in range(1, 15)] + ["F02", "F03", "F04"]
STYLE_RE = re.compile(r"^Unnamed Style (C\d{2}|F0[234])$")


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def style_map(zf: zipfile.ZipFile) -> dict[str, str]:
    try:
        data = zf.read("Resources/Styles.xml")
    except KeyError as exc:
        raise RuntimeError("Resources/Styles.xml is missing from the IDML.") from exc

    root = ET.fromstring(data)
    out: dict[str, str] = {}
    for elem in root.iter():
        if local(elem.tag) != "CharacterStyle":
            continue
        sid = elem.attrib.get("Self", "")
        name = elem.attrib.get("Name", "")
        if sid:
            out[sid] = name
    return out


def content_text(elem: ET.Element) -> str:
    parts: list[str] = []
    for node in elem.iter():
        if local(node.tag) == "Content" and node.text:
            parts.append(node.text)
    return "".join(parts)


def scan_story_xml(zf: zipfile.ZipFile, styles: dict[str, str]):
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
            name = styles.get(sid, sid)
            match = STYLE_RE.match(name)
            if not match:
                continue

            cid = match.group(1)
            text = content_text(elem).replace("\r", " ").replace("\n", " ").strip()
            found[cid].append(
                {
                    "story": story_name,
                    "style": name,
                    "style_id": sid,
                    "text": text[:240],
                }
            )
    return found


def write_csv(path: Path, found) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            [
                "Verifier Version",
                "Control ID",
                "Required",
                "Found",
                "Occurrence Count",
                "Style Name",
                "Story XML",
                "Sample Text",
            ]
        )
        all_ids = sorted(set(REQUIRED) | set(found))
        for cid in all_ids:
            rows = found.get(cid, [])
            writer.writerow(
                [
                    VERSION,
                    cid,
                    "YES" if cid in REQUIRED else "NO",
                    "YES" if rows else "NO",
                    len(rows),
                    rows[0]["style"] if rows else "",
                    " | ".join(r["story"] for r in rows[:10]),
                    " | ".join(r["text"] for r in rows[:5]),
                ]
            )


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
            styles = style_map(zf)
            found = scan_story_xml(zf, styles)
    except (zipfile.BadZipFile, ET.ParseError, RuntimeError, OSError) as exc:
        print(f"StyleFix IDML verification failed: {exc}", file=sys.stderr)
        return 2

    write_csv(out, found)
    missing = [cid for cid in REQUIRED if not found.get(cid)]

    print(f"StyleFix IDML verifier v{VERSION}")
    print(f"Input:  {src}")
    print(f"Output: {out}")
    print(f"Required direct-use controls: {len(REQUIRED)}")
    print(f"Found: {len(REQUIRED) - len(missing)}")

    if missing:
        print("MISSING: " + ", ".join(missing))
        return 1

    print("PASS: all required direct-use controls are present in IDML story XML.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
