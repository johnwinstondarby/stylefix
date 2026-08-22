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

"""Convenience launcher for the StyleFix v1.0.8 canary-suite IDML verifier."""
from pathlib import Path
import runpy

runpy.run_path(
    str(Path(__file__).resolve().parent / "canary" / "verify" / "VerifyCanaryIDML.py"),
    run_name="__main__",
)
