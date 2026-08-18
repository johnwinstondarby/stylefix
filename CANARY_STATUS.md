# StyleFix Canary Builder Status

Current StyleFix scanner release: **v1.0.6**.

Current canary fixture builder: **v1.0.7**.

v1.0.7 is a builder-only correction. The scanner is intentionally held at v1.0.6 so the next canary run changes one experimental variable.

The v1.0.7 builder adds a startup capability probe, normalizes Story containers to Text before character-style application, inserts and then reacquires endnote text explicitly, and verifies every character in each planted literal span.
