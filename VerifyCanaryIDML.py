#!/usr/bin/env python3
"""Convenience launcher for the StyleFix v1.0.8 canary-suite IDML verifier."""
from pathlib import Path
import runpy

runpy.run_path(
    str(Path(__file__).resolve().parent / "canary" / "verify" / "VerifyCanaryIDML.py"),
    run_name="__main__",
)
