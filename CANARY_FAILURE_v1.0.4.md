# StyleFix canary failure: v1.0.4

The v1.0.4 canary fixture built and the scanner failed before a valid audit CSV was produced.

Observed InDesign error:

- Error 55: Object does not support the property or method `endnotes`
- Reported from the assembled StyleFix scanner during direct-usage traversal

Root cause: the v1.0.4 recursive walker probed `endnotes` on generic descended text containers and also attempted a document-level `endnotes` collection. InDesign exposes endnote collections on specific container classes; generic Text exposes endnote ranges rather than an `endnotes` collection.

v1.0.5 changes endnote discovery to scan document stories and classify stories with `Story.isEndnoteStory` as ENDNOTE context. It removes document-level and generic-container `endnotes` probing.

This failed run is not release evidence and does not authorize production remediation.
