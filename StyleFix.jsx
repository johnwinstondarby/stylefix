#target "InDesign"
#targetengine "StyleFix"

/*
StyleFix v1.0.3
Read-only audit for Word/import-created character-style debris.

v1.0.3 hardens the audit before any deletion capability is introduced:
  - recursively scans story text, table cells, nested tables, footnotes, and endnotes;
  - builds dependency references once per document;
  - validates fingerprint properties and uses appliedLanguage;
  - uses ID/specifier identity before qualified-name fallback;
  - distinguishes unsupported dependency paths (N/A) from audit failures;
  - detects open-book scope and blocks LOW when document-only evidence is insufficient;
  - exports UTF-8 CSV with BOM;
  - uses a multi-column, multi-select audit list in preparation for remediation.

Audit families:
  - Unnamed Style *
  - Word Imported List Style *

No styles or text are changed in v1.0.3.
ExtendScript / ECMAScript 3 compatible.
*/

(function () {
    var VERSION = "1.0.3";
    var UNNAMED_RE = /^Unnamed Style(?:\s|$)/i;
    var WORD_LIST_RE = /^Word Imported List Style/i;

    var rows = [];
    var counts = null;
    var ui = {};
    var fingerprintProps = [];

    if (app.documents.length === 0) {
        alert("StyleFix v" + VERSION + "\n\nOpen an InDesign document before running StyleFix.");
        return;
    }

    buildUI();
    scan();
    ui.win.show();

    function scan() {
        var doc, allStyles, candidates, canonical;
        var usageAudit, depAudit, schemaAudit, bookAudit;
        var oldUnit = null;
        var i, style, usage, deps, matches, risk, action, imported, substantive, family;

        if (app.documents.length === 0) {
            rows = [];
            refreshNoDocument();
            alert("StyleFix v" + VERSION + "\n\nNo InDesign document is open.");
            return;
        }

        doc = app.activeDocument;
        rows = [];
        counts = newCounts();

        try {
            oldUnit = app.scriptPreferences.measurementUnit;
            app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;
        } catch (eUnit) {}

        try {
            allStyles = safeAllCharacterStyles(doc);
            candidates = [];
            canonical = [];

            counts.characterStyles = allStyles.length;
            status("Inventorying character styles in " + docName(doc) + "...");

            for (i = 0; i < allStyles.length; i++) {
                style = allStyles[i];
                if (!valid(style)) { continue; }

                if (isAuditCandidate(style)) {
                    candidates.push(style);
                    family = candidateFamily(style);
                    if (family === "Unnamed Style") { counts.unnamedStyles++; }
                    else if (family === "Word Imported List Style") { counts.wordListStyles++; }
                }
            }

            counts.candidateStyles = candidates.length;

            schemaAudit = validateFingerprintProperties(allStyles);
            fingerprintProps = schemaAudit.active;
            counts.fingerprintWarnings = schemaAudit.warnings.length;

            for (i = 0; i < allStyles.length; i++) {
                style = allStyles[i];
                if (valid(style) && isCanonicalCandidate(style)) {
                    canonical.push(style);
                }
            }

            usageAudit = buildUsageMap(doc, candidates);
            depAudit = buildDependencyMap(doc, candidates, allStyles);
            bookAudit = bookScopeState(doc);

            counts.usageWarnings = usageAudit.errors;
            counts.dependencyWarnings = depAudit.errors;
            counts.dependencyNA = depAudit.na.length;
            counts.bookScope = bookAudit.label;
            counts.bookScopeBlocksLow = bookAudit.blocksLow;

            for (i = 0; i < candidates.length; i++) {
                style = candidates[i];
                status("Auditing " + (i + 1) + " of " + candidates.length + ": " + styleName(style));

                usage = usageAudit.map[styleKey(style)] || emptyUsage();
                deps = depAudit.map[styleKey(style)] || emptyDependency();
                substantive = hasSubstantiveFormatting(style);
                matches = substantive ? equivalentCanonicalStyles(style, canonical) : [];
                imported = importedState(style);
                family = candidateFamily(style);

                risk = classifyRisk(
                    usage, deps, matches,
                    usageAudit.errors,
                    depAudit.errors,
                    schemaAudit.warnings.length,
                    bookAudit.blocksLow
                );
                action = suggestedAction(risk, matches, deps, substantive);

                if (usage.runs > 0) { counts.directlyUsed++; }
                if (deps.count > 0) { counts.referenced++; }
                if (imported === "Yes") { counts.imported++; }

                if (risk === "LOW") { counts.low++; }
                else if (risk === "MEDIUM") { counts.medium++; }
                else if (risk === "HIGH") { counts.high++; }
                else if (risk === "REPLACE") { counts.replace++; }

                rows.push({
                    risk: risk,
                    family: family,
                    styleName: styleName(style),
                    styleId: safeProperty(style, "id", "-"),
                    stylePath: styleQualifiedPath(style),
                    imported: imported,
                    basedOn: styleRefName(safePropertyObject(style, "basedOn")),
                    directRuns: usage.runs,
                    characters: usage.characters,
                    pages: usagePageText(usage),
                    firstPageSort: usage.firstPageSort,
                    samples: usage.samples.join(" | "),
                    dependencyCount: deps.count,
                    dependencies: deps.details.join(" | "),
                    formattingState: substantive ? "SUBSTANTIVE" : "EMPTY SHELL",
                    canonicalMatch: matches.length === 1 ? styleName(matches[0]) :
                        (matches.length > 1 ? joinStyleNames(matches) : ""),
                    matchCount: matches.length,
                    fingerprint: formattingFingerprint(style),
                    action: action,
                    style: style,
                    firstUsage: usage.firstUsage,
                    firstPageRef: usage.firstPageRef,
                    usageWarningCount: usageAudit.errors,
                    usageWarnings: usageAudit.errorDetails.join(" | "),
                    dependencyWarningCount: depAudit.errors,
                    dependencyWarnings: depAudit.errorDetails.join(" | "),
                    dependencyNA: depAudit.na.join(" | "),
                    fingerprintWarningCount: schemaAudit.warnings.length,
                    fingerprintWarnings: schemaAudit.warnings.join(" | "),
                    bookScope: bookAudit.label
                });
            }

            sortRows();
            refresh(doc);

            if (rows.length === 0) {
                status("Scan complete. No imported-style debris candidates were found.");
            } else {
                status("Scan complete. Select a style and click Locate First Use, or export the audit CSV.");
            }
        } catch (eScan) {
            status("Scan failed: " + errorSummary(eScan));
            alert("StyleFix scan failed.\n\n" + errorSummary(eScan));
        } finally {
            if (oldUnit !== null) {
                try { app.scriptPreferences.measurementUnit = oldUnit; } catch (eRestoreUnit) {}
            }
        }
    }

    function newCounts() {
        return {
            characterStyles: 0,
            candidateStyles: 0,
            unnamedStyles: 0,
            wordListStyles: 0,
            low: 0,
            medium: 0,
            high: 0,
            replace: 0,
            directlyUsed: 0,
            referenced: 0,
            imported: 0,
            usageWarnings: 0,
            dependencyWarnings: 0,
            dependencyNA: 0,
            fingerprintWarnings: 0,
            bookScope: "Standalone/No open-book match",
            bookScopeBlocksLow: false
        };
    }

    function buildUsageMap(doc, candidates) {
        var audit = {
            map: {},
            errors: 0,
            errorDetails: [],
            lookup: buildCandidateLookup(candidates),
            visited: {}
        };
        var stories = collectionElements(safePropertyObject(doc, "stories"));
        var endnotes, i;

        for (i = 0; i < candidates.length; i++) {
            audit.map[styleKey(candidates[i])] = emptyUsage();
        }

        for (i = 0; i < stories.length; i++) {
            scanTextContainer(stories[i], "Story " + safeProperty(stories[i], "id", "#" + i), audit, true);
        }

        endnotes = collectionElements(safePropertyObject(doc, "endnotes"));
        for (i = 0; i < endnotes.length; i++) {
            scanNoteObject(endnotes[i], "Endnote " + i, audit);
        }

        return audit;
    }

    function scanTextContainer(container, label, audit, scanNotes) {
        var key, ranges, tables, notes, i;

        if (container === null || container === undefined || !valid(container)) { return; }

        key = objectKey(container);
        if (key !== "" && audit.visited[key] === true) { return; }
        if (key !== "") { audit.visited[key] = true; }

        try {
            ranges = collectionElements(container.textStyleRanges);
            for (i = 0; i < ranges.length; i++) {
                recordUsageRange(ranges[i], audit);
            }
        } catch (eRanges) {
            addGlobalAuditError(audit, label + " textStyleRanges", eRanges);
        }

        try {
            tables = collectionElements(container.tables);
            for (i = 0; i < tables.length; i++) {
                scanTable(tables[i], label + " table " + i, audit);
            }
        } catch (eTables) {
            addGlobalAuditError(audit, label + " tables", eTables);
        }

        if (scanNotes === true) {
            try {
                notes = collectionElements(container.footnotes);
                for (i = 0; i < notes.length; i++) {
                    scanNoteObject(notes[i], label + " footnote " + i, audit);
                }
            } catch (eFootnotes) {
                addGlobalAuditError(audit, label + " footnotes", eFootnotes);
            }
        }
    }

    function scanTable(table, label, audit) {
        var cells, i, text;
        if (!valid(table)) { return; }

        try {
            cells = collectionElements(table.cells);
            for (i = 0; i < cells.length; i++) {
                if (!valid(cells[i])) { continue; }
                text = firstTextObject(cells[i]);
                if (text !== null) {
                    scanTextContainer(text, label + " cell " + i, audit, true);
                }
            }
        } catch (eCells) {
            addGlobalAuditError(audit, label + " cells", eCells);
        }
    }

    function scanNoteObject(note, label, audit) {
        var text = firstTextObject(note);
        if (text !== null) {
            scanTextContainer(text, label, audit, true);
        }
    }

    function firstTextObject(obj) {
        var texts, elements;
        try {
            texts = obj.texts;
            elements = collectionElements(texts);
            if (elements.length > 0 && valid(elements[0])) { return elements[0]; }
        } catch (e) {}
        return null;
    }

    function recordUsageRange(range, audit) {
        var style, candidateKey, usage, len, pageInfo, sample;

        if (!valid(range)) { return; }

        style = safePropertyObject(range, "appliedCharacterStyle");
        candidateKey = candidateKeyForRef(style, audit.lookup);
        if (candidateKey === "") { return; }

        usage = audit.map[candidateKey];
        if (usage === undefined) { return; }

        usage.runs++;
        len = textLength(range);
        usage.characters += len;

        pageInfo = pagesForText(range);
        addPages(usage, pageInfo);

        if (usage.firstUsage === null) {
            usage.firstUsage = range;
            usage.firstPageRef = pageInfo.firstPageRef;
            usage.firstPageSort = pageInfo.firstPageSort;
        }

        if (usage.samples.length < 3) {
            sample = previewText(safeContents(range));
            if (sample.length > 0 && !containsString(usage.samples, sample)) {
                usage.samples.push(sample);
            }
        }
    }

    function emptyUsage() {
        return {
            runs: 0,
            characters: 0,
            pages: {},
            pageNames: [],
            samples: [],
            firstUsage: null,
            firstPageRef: null,
            firstPageSort: 999999998,
            overflow: false
        };
    }

    function textLength(obj) {
        var s;
        try {
            s = String(obj.contents);
            return s.length;
        } catch (e) {
            return 0;
        }
    }

    function pagesForText(text) {
        var result = {names: [], firstPageRef: null, firstPageSort: 999999998};
        var frames, i, ips;

        try {
            frames = collectionElements(text.parentTextFrames);
            for (i = 0; i < frames.length; i++) {
                addPageFromFrame(result, frames[i]);
            }
        } catch (eFrames) {}

        if (result.names.length === 0) {
            ips = [];
            try { ips.push(text.insertionPoints.item(0)); } catch (eFirst) {}
            try { ips.push(text.insertionPoints.item(-1)); } catch (eLast) {}
            for (i = 0; i < ips.length; i++) {
                addPageFromInsertionPoint(result, ips[i]);
            }
        }

        if (result.names.length === 0) {
            result.names.push("Overset/No page");
        }

        return result;
    }

    function addPageFromFrame(result, frame) {
        var page;
        if (!valid(frame)) { return; }
        try {
            page = frame.parentPage;
            addPageObject(result, page);
        } catch (e) {}
    }

    function addPageFromInsertionPoint(result, ip) {
        var frames;
        if (ip === null || !valid(ip)) { return; }
        try {
            frames = collectionElements(ip.parentTextFrames);
            if (frames.length > 0) { addPageFromFrame(result, frames[0]); }
        } catch (e) {}
    }

    function addPageObject(result, page) {
        var name, sort;
        if (page === null || !valid(page)) { return; }

        try { name = String(page.name); } catch (eName) { return; }

        if (!containsString(result.names, name)) {
            result.names.push(name);
        }

        try {
            sort = Number(page.documentOffset);
            if (sort < result.firstPageSort) {
                result.firstPageSort = sort;
                result.firstPageRef = page;
            }
        } catch (eSort) {}
    }

    function addPages(usage, pageInfo) {
        var i, name;
        for (i = 0; i < pageInfo.names.length; i++) {
            name = pageInfo.names[i];
            if (usage.pages[name] !== true) {
                usage.pages[name] = true;
                if (usage.pageNames.length < 30) {
                    usage.pageNames.push(name);
                } else {
                    usage.overflow = true;
                }
            }
        }
        if (pageInfo.firstPageSort < usage.firstPageSort) {
            usage.firstPageSort = pageInfo.firstPageSort;
            usage.firstPageRef = pageInfo.firstPageRef;
        }
    }

    function usagePageText(usage) {
        if (usage.runs === 0) { return ""; }
        return usage.pageNames.join(", ") + (usage.overflow ? ", ..." : "");
    }

    function buildDependencyMap(doc, candidates, allStyles) {
        var audit = {
            map: {},
            errors: 0,
            errorDetails: [],
            na: [],
            lookup: buildCandidateLookup(candidates)
        };
        var i, style, paragraphStyles, ps, variables, variable, options;
        var formats, fmt, entries, entry, indexes, indexObj, topics, topic, refs, ref;
        var footOptions, endOptions;

        for (i = 0; i < candidates.length; i++) {
            audit.map[styleKey(candidates[i])] = emptyDependency();
        }

        try {
            for (i = 0; i < allStyles.length; i++) {
                style = allStyles[i];
                if (!valid(style)) { continue; }
                recordDependencyRef(
                    audit,
                    safePropertyObject(style, "basedOn"),
                    "Based-on: " + styleName(style)
                );
            }
        } catch (eBasedOn) {
            addGlobalAuditError(audit, "Character-style inheritance", eBasedOn);
        }

        try {
            paragraphStyles = safeAllParagraphStyles(doc);
            for (i = 0; i < paragraphStyles.length; i++) {
                ps = paragraphStyles[i];
                if (!valid(ps)) { continue; }
                recordPropertyDependency(audit, ps, "dropCapStyle", "Paragraph " + styleName(ps) + " drop cap");
                recordPropertyDependency(audit, ps, "bulletsCharacterStyle", "Paragraph " + styleName(ps) + " bullets");
                recordPropertyDependency(audit, ps, "numberingCharacterStyle", "Paragraph " + styleName(ps) + " numbering");
                recordAppliedStyleCollection(audit, safePropertyObject(ps, "nestedStyles"),
                    "Paragraph " + styleName(ps) + " nested style");
                recordAppliedStyleCollection(audit, safePropertyObject(ps, "nestedGrepStyles"),
                    "Paragraph " + styleName(ps) + " nested GREP");
                recordAppliedStyleCollection(audit, safePropertyObject(ps, "nestedLineStyles"),
                    "Paragraph " + styleName(ps) + " nested line");
            }
        } catch (eParagraph) {
            addGlobalAuditError(audit, "Paragraph-style references", eParagraph);
        }

        try {
            variables = collectionElements(safePropertyObject(doc, "textVariables"));
            for (i = 0; i < variables.length; i++) {
                variable = variables[i];
                if (!valid(variable)) { continue; }
                options = safePropertyObject(variable, "variableOptions");
                if (options !== null && propertyReadable(options, "appliedStyle")) {
                    recordDependencyRef(
                        audit,
                        safePropertyObject(options, "appliedStyle"),
                        "Text variable: " + safeProperty(variable, "name", "#" + i)
                    );
                }
            }
        } catch (eVariables) {
            addGlobalAuditError(audit, "Text-variable references", eVariables);
        }

        try {
            formats = collectionElements(safePropertyObject(doc, "crossReferenceFormats"));
            for (i = 0; i < formats.length; i++) {
                fmt = formats[i];
                if (!valid(fmt)) { continue; }
                recordPropertyDependency(audit, fmt, "appliedCharacterStyle",
                    "Cross-reference format: " + safeProperty(fmt, "name", "#" + i));
                recordAppliedStyleCollection(audit, safePropertyObject(fmt, "buildingBlocks"),
                    "Cross-reference building block: " + safeProperty(fmt, "name", "#" + i));
            }
        } catch (eCross) {
            addGlobalAuditError(audit, "Cross-reference formats", eCross);
        }

        recordNamedSourceCollection(audit, safePropertyObject(doc, "hyperlinkTextSources"), "Hyperlink source");
        recordNamedSourceCollection(audit, safePropertyObject(doc, "crossReferenceSources"), "Cross-reference source");

        try {
            formats = collectionElements(safePropertyObject(doc, "tocStyles"));
            for (i = 0; i < formats.length; i++) {
                fmt = formats[i];
                if (!valid(fmt)) { continue; }
                entries = collectionElements(safePropertyObject(fmt, "tocStyleEntries"));
                for (var j = 0; j < entries.length; j++) {
                    entry = entries[j];
                    if (!valid(entry)) { continue; }
                    recordPropertyDependency(audit, entry, "pageNumberStyle",
                        "TOC " + safeProperty(fmt, "name", "#" + i) + " page number");
                    recordPropertyDependency(audit, entry, "separatorStyle",
                        "TOC " + safeProperty(fmt, "name", "#" + i) + " separator");
                }
            }
        } catch (eTOC) {
            addGlobalAuditError(audit, "TOC references", eTOC);
        }

        footOptions = safePropertyObject(doc, "footnoteOptions");
        if (footOptions !== null && propertyReadable(footOptions, "footnoteMarkerStyle")) {
            recordPropertyDependency(audit, footOptions, "footnoteMarkerStyle", "Footnote marker style");
        } else {
            addNA(audit, "Footnote marker style property unavailable");
        }

        endOptions = safePropertyObject(doc, "endnoteOptions");
        if (endOptions !== null && propertyReadable(endOptions, "endnoteMarkerStyle")) {
            recordPropertyDependency(audit, endOptions, "endnoteMarkerStyle", "Endnote marker style");
        } else {
            addNA(audit, "Endnote marker style property unavailable");
        }

        if (propertyReadable(doc, "indexOptions")) {
            options = safePropertyObject(doc, "indexOptions");
            if (options !== null) {
                recordPropertyDependency(audit, options, "pageNumberStyle", "Index option: page number");
                recordPropertyDependency(audit, options, "crossReferenceStyle", "Index option: cross reference");
                recordPropertyDependency(audit, options, "crossReferenceTopicStyle", "Index option: cross-reference topic");
            }
        } else {
            addNA(audit, "Document.indexOptions unavailable");
        }

        try {
            indexes = collectionElements(safePropertyObject(doc, "indexes"));
            for (i = 0; i < indexes.length; i++) {
                indexObj = indexes[i];
                if (!valid(indexObj)) { continue; }
                topics = safeArrayLike(safePropertyObject(indexObj, "allTopics"));
                for (var t = 0; t < topics.length; t++) {
                    topic = topics[t];
                    if (!valid(topic)) { continue; }
                    refs = collectionElements(safePropertyObject(topic, "pageReferences"));
                    for (var r = 0; r < refs.length; r++) {
                        ref = refs[r];
                        if (!valid(ref)) { continue; }
                        recordPropertyDependency(audit, ref, "pageNumberStyleOverride",
                            "Index page-reference override: " + safeProperty(topic, "name", "topic"));
                    }
                }
            }
        } catch (eIndex) {
            addGlobalAuditError(audit, "Index page-reference overrides", eIndex);
        }

        scanXmlStyleMapCollection(audit, doc, "xmlImportMaps", "XML import style map");
        scanXmlStyleMapCollection(audit, doc, "xmlExportMaps", "XML export style map");

        return audit;
    }

    function emptyDependency() {
        return {count: 0, details: []};
    }

    function recordDependencyRef(audit, ref, detail) {
        var key = candidateKeyForRef(ref, audit.lookup);
        var item;
        if (key === "" || audit.map[key] === undefined) { return; }

        item = audit.map[key];
        item.count++;
        if (item.details.length < 40 && !containsString(item.details, detail)) {
            item.details.push(detail);
        }
    }

    function recordPropertyDependency(audit, obj, prop, detail) {
        if (obj === null || obj === undefined) { return; }
        if (!propertyReadable(obj, prop)) { return; }
        recordDependencyRef(audit, safePropertyObject(obj, prop), detail);
    }

    function recordAppliedStyleCollection(audit, collection, label) {
        var elements = collectionElements(collection);
        var i, item;
        for (i = 0; i < elements.length; i++) {
            item = elements[i];
            if (!valid(item)) { continue; }
            if (propertyReadable(item, "appliedCharacterStyle")) {
                recordDependencyRef(audit, safePropertyObject(item, "appliedCharacterStyle"), label + " #" + i);
            } else if (propertyReadable(item, "appliedStyle")) {
                recordDependencyRef(audit, safePropertyObject(item, "appliedStyle"), label + " #" + i);
            }
        }
    }

    function recordNamedSourceCollection(audit, collection, label) {
        var elements = collectionElements(collection);
        var i, item;
        for (i = 0; i < elements.length; i++) {
            item = elements[i];
            if (!valid(item)) { continue; }
            recordPropertyDependency(audit, item, "appliedCharacterStyle",
                label + ": " + safeProperty(item, "name", "#" + i));
        }
    }

    function scanXmlStyleMapCollection(audit, doc, prop, label) {
        var collection, elements, i, item, matchedProperty = false;

        if (!propertyReadable(doc, prop)) {
            addNA(audit, label + " collection unavailable");
            return;
        }

        collection = safePropertyObject(doc, prop);
        elements = collectionElements(collection);

        for (i = 0; i < elements.length; i++) {
            item = elements[i];
            if (!valid(item)) { continue; }

            if (propertyReadable(item, "appliedCharacterStyle")) {
                matchedProperty = true;
                recordDependencyRef(audit, safePropertyObject(item, "appliedCharacterStyle"), label + " #" + i);
            }
            if (propertyReadable(item, "characterStyle")) {
                matchedProperty = true;
                recordDependencyRef(audit, safePropertyObject(item, "characterStyle"), label + " #" + i);
            }
        }

        if (elements.length > 0 && !matchedProperty) {
            addNA(audit, label + " has no recognized character-style property");
        }
    }

    function fingerprintPropertyCandidates() {
        return [
            "appliedFont", "fontStyle", "pointSize", "leading", "tracking",
            "appliedLanguage", "capitalization", "position", "underline",
            "strikeThru", "noBreak", "horizontalScale", "verticalScale",
            "baselineShift", "skew", "ligatures", "otfFigureStyle",
            "fillColor", "fillTint", "strokeColor", "strokeTint", "strokeWeight",
            "overprintFill", "overprintStroke"
        ];
    }

    function validateFingerprintProperties(allStyles) {
        var requested = fingerprintPropertyCandidates();
        var active = [];
        var warnings = [];
        var i, j, prop, readable;

        for (i = 0; i < requested.length; i++) {
            prop = requested[i];
            readable = false;

            for (j = 0; j < allStyles.length; j++) {
                if (!valid(allStyles[j])) { continue; }
                if (propertyReadable(allStyles[j], prop)) {
                    readable = true;
                    break;
                }
            }

            if (readable) {
                active.push(prop);
            } else {
                warnings.push("Fingerprint property unavailable: " + prop);
            }
        }

        return {active: active, warnings: warnings};
    }

    function formattingFingerprint(style) {
        var parts = [];
        var i;
        if (!valid(style)) { return ""; }

        for (i = 0; i < fingerprintProps.length; i++) {
            parts.push(fingerprintProps[i] + "=" + normalizedProperty(style, fingerprintProps[i]));
        }
        return parts.join(";");
    }

    function hasSubstantiveFormatting(style) {
        var i, value;
        if (!valid(style)) { return false; }

        for (i = 0; i < fingerprintProps.length; i++) {
            try { value = style[fingerprintProps[i]]; } catch (eProperty) { continue; }
            if (!isNothingValue(value)) { return true; }
        }
        return false;
    }

    function equivalentCanonicalStyles(target, canonical) {
        var matches = [];
        var targetFP, i, style;

        if (!hasSubstantiveFormatting(target)) { return matches; }

        targetFP = formattingFingerprint(target);
        if (targetFP === "") { return matches; }

        for (i = 0; i < canonical.length; i++) {
            style = canonical[i];
            if (!valid(style) || sameStyle(style, target)) { continue; }
            if (!hasSubstantiveFormatting(style)) { continue; }
            if (formattingFingerprint(style) === targetFP) {
                matches.push(style);
            }
        }

        return matches;
    }

    function normalizedProperty(obj, prop) {
        var value;
        try { value = obj[prop]; } catch (e) { return "<unavailable>"; }
        if (value === null || value === undefined) { return "<null>"; }
        if (isNothingValue(value)) { return "NOTHING"; }

        if (prop === "appliedFont") {
            try { if (value.fullName !== undefined) { return String(value.fullName); } } catch (eFont) {}
            try { if (value.name !== undefined) { return String(value.name); } } catch (eFontName) {}
        }
        if (prop === "appliedLanguage") {
            return styleRefName(value);
        }
        if (prop === "fillColor" || prop === "strokeColor") {
            return styleRefName(value);
        }
        try {
            if (value.constructor === Array) { return value.join("/"); }
        } catch (eArray) {}
        try { return String(value); } catch (eString) { return "<unprintable>"; }
    }

    function isNothingValue(value) {
        var s;
        if (value === null || value === undefined) { return true; }

        try {
            if (NothingEnum !== undefined && value === NothingEnum.NOTHING) { return true; }
        } catch (eEnum) {}

        try { s = String(value).toLowerCase(); } catch (eString) { return false; }
        s = s.replace(/\s+/g, "");

        if (s === "" || s === "nothing" || s === "<null>" || s === "<unavailable>") {
            return true;
        }
        if (s.indexOf("nothingenum") >= 0) { return true; }
        return false;
    }

    function classifyRisk(usage, deps, matches, usageErrors, dependencyErrors, fingerprintWarnings, bookBlocksLow) {
        if (usage.runs > 0 || deps.count > 0) {
            if (matches.length === 1 && fingerprintWarnings === 0) {
                return "REPLACE";
            }
            return "HIGH";
        }

        if (usageErrors > 0 || dependencyErrors > 0 || bookBlocksLow) {
            return "MEDIUM";
        }

        return "LOW";
    }

    function suggestedAction(risk, matches, deps, substantive) {
        if (risk === "LOW") {
            return substantive ?
                "Safe deletion candidate after selected re-check" :
                "Empty imported shell; safe deletion candidate after selected re-check";
        }
        if (risk === "MEDIUM") {
            return substantive ?
                "Review scan/book-scope warnings before deletion" :
                "Empty imported shell; review scan/book-scope warnings before deletion";
        }
        if (risk === "REPLACE") {
            return "Candidate replacement with " + styleName(matches[0]) + "; verify before any remediation";
        }
        if (deps.count > 0) {
            return "Resolve text usage/dependencies before deletion";
        }
        return "Review applied text before deletion";
    }

    function bookScopeState(doc) {
        var result = {
            openBooks: 0,
            belongs: false,
            uncertain: false,
            blocksLow: false,
            label: "Standalone/No open-book match"
        };
        var books, i, book, contents, j, content;
        var docPath = filePathKey(safePropertyObject(doc, "fullName"));
        var contentPath;

        try {
            books = collectionElements(app.books);
            result.openBooks = books.length;
        } catch (eBooks) {
            return result;
        }

        if (books.length === 0) { return result; }

        for (i = 0; i < books.length; i++) {
            book = books[i];
            if (!valid(book)) { continue; }

            try {
                contents = collectionElements(book.bookContents);
                for (j = 0; j < contents.length; j++) {
                    content = contents[j];
                    if (!valid(content)) { continue; }
                    contentPath = filePathKey(safePropertyObject(content, "fullName"));
                    if (contentPath === "") {
                        result.uncertain = true;
                    }

                    if (docPath !== "" && contentPath !== "" && docPath === contentPath) {
                        result.belongs = true;
                        result.blocksLow = true;
                        result.label = "OPEN BOOK MEMBER: " + safeProperty(book, "name", "book");
                        return result;
                    }
                }
            } catch (eContents) {
                result.uncertain = true;
            }
        }

        if (docPath === "" || result.uncertain) {
            result.blocksLow = true;
            result.label = "OPEN BOOK SCOPE UNCERTAIN";
        } else {
            result.label = "Standalone/No open-book match";
        }

        return result;
    }

    function isAuditCandidate(style) {
        var name = styleName(style);
        return UNNAMED_RE.test(name) || WORD_LIST_RE.test(name);
    }

    function candidateFamily(style) {
        var name = styleName(style);
        if (UNNAMED_RE.test(name)) { return "Unnamed Style"; }
        if (WORD_LIST_RE.test(name)) { return "Word Imported List Style"; }
        return "Other";
    }

    function isCanonicalCandidate(style) {
        var name = styleName(style);
        if (name === "" || name === "[None]") { return false; }
        if (isAuditCandidate(style)) { return false; }
        if (/^Word Imported /i.test(name)) { return false; }
        if (importedState(style) === "Yes") { return false; }
        if (!hasSubstantiveFormatting(style)) { return false; }
        return true;
    }

    function buildCandidateLookup(candidates) {
        var lookup = {byId: {}, bySpecifier: {}, byPath: {}};
        var i, style, id, spec, path;

        for (i = 0; i < candidates.length; i++) {
            style = candidates[i];
            if (!valid(style)) { continue; }

            id = styleIdText(style);
            spec = styleSpecifier(style);
            path = styleQualifiedPath(style);

            if (id !== "") { lookup.byId[id] = styleKey(style); }
            if (spec !== "") { lookup.bySpecifier[spec] = styleKey(style); }
            if (path !== "") { lookup.byPath[path] = styleKey(style); }
        }

        return lookup;
    }

    function candidateKeyForRef(ref, lookup) {
        var id, spec, path;

        if (ref === null || ref === undefined) { return ""; }

        id = styleIdText(ref);
        if (id !== "" && lookup.byId[id] !== undefined) {
            return lookup.byId[id];
        }

        spec = styleSpecifier(ref);
        if (spec !== "" && lookup.bySpecifier[spec] !== undefined) {
            return lookup.bySpecifier[spec];
        }

        path = styleQualifiedPath(ref);
        if (path !== "" && lookup.byPath[path] !== undefined) {
            return lookup.byPath[path];
        }

        return "";
    }

    function sameStyle(a, b) {
        var aid, bid, aspec, bspec;

        if (a === null || b === null || a === undefined || b === undefined) { return false; }

        aid = styleIdText(a);
        bid = styleIdText(b);
        if (aid !== "" && bid !== "") { return aid === bid; }

        aspec = styleSpecifier(a);
        bspec = styleSpecifier(b);
        if (aspec !== "" && bspec !== "") { return aspec === bspec; }

        return styleQualifiedPath(a) === styleQualifiedPath(b);
    }

    function styleKey(style) {
        var id = styleIdText(style);
        var spec;
        if (id !== "") { return "ID:" + id; }

        spec = styleSpecifier(style);
        if (spec !== "") { return "SPEC:" + spec; }

        return "PATH:" + styleQualifiedPath(style);
    }

    function styleIdText(style) {
        try {
            if (style.id !== undefined && style.id !== null) { return String(style.id); }
        } catch (e) {}
        return "";
    }

    function styleSpecifier(style) {
        try { return String(style.toSpecifier()); } catch (e) { return ""; }
    }

    function styleQualifiedPath(style) {
        var parts = [];
        var node = style;
        var depth = 0;
        var name, typeName;

        while (node !== null && node !== undefined && depth < 12) {
            name = safeName(node);
            typeName = objectTypeName(node);

            if (name !== "") {
                parts.unshift(typeName + ":" + name);
            }

            if (typeName === "Document" || typeName === "Application") { break; }

            try { node = node.parent; } catch (eParent) { break; }
            depth++;
        }

        return parts.join("/");
    }

    function buildUI() {
        var buttons, button;

        ui.win = new Window("palette", "StyleFix v" + VERSION);
        ui.win.orientation = "column";
        ui.win.alignChildren = ["fill", "top"];
        ui.win.margins = 12;
        ui.win.spacing = 8;

        ui.title = ui.win.add("statictext", undefined, "Imported Character Style Debris Audit");
        try {
            ui.title.graphics.font = ScriptUI.newFont(ui.title.graphics.font.name, "BOLD", 15);
        } catch (eFont) {}

        ui.summary = ui.win.add("statictext", undefined, "", {multiline: true});
        ui.summary.preferredSize = [1220, 122];

        ui.list = ui.win.add("listbox", undefined, "", {
            numberOfColumns: 9,
            showHeaders: true,
            columnTitles: ["Risk", "Style", "Family", "State", "Uses", "Chars", "Deps", "Warnings", "Pages"],
            multiselect: true
        });
        ui.list.preferredSize = [1220, 460];
        try {
            ui.list.columnWidths = [70, 230, 170, 100, 55, 70, 55, 80, 280];
        } catch (eWidths) {}
        ui.list.onDoubleClick = locateFirstUse;

        ui.status = ui.win.add("statictext", undefined, "");
        ui.status.preferredSize = [1220, 34];

        buttons = ui.win.add("group");
        buttons.alignment = ["right", "top"];

        button = buttons.add("button", undefined, "Rescan");
        button.onClick = scan;

        button = buttons.add("button", undefined, "Locate First Use");
        button.onClick = locateFirstUse;

        button = buttons.add("button", undefined, "Save CSV");
        button.onClick = saveCSV;

        button = buttons.add("button", undefined, "Close");
        button.onClick = function () { ui.win.close(); };
    }

    function refresh(doc) {
        var i, row, item;

        ui.list.removeAll();

        for (i = 0; i < rows.length; i++) {
            row = rows[i];
            item = ui.list.add("item", row.risk);
            item.subItems[0].text = row.styleName;
            item.subItems[1].text = row.family;
            item.subItems[2].text = row.formattingState;
            item.subItems[3].text = String(row.directRuns);
            item.subItems[4].text = String(row.characters);
            item.subItems[5].text = String(row.dependencyCount);
            item.subItems[6].text = "U" + row.usageWarningCount + "/D" + row.dependencyWarningCount;
            item.subItems[7].text = row.pages || "-";
        }

        ui.summary.text =
            docName(doc) + "\n" +
            "Character styles: " + counts.characterStyles +
            "    Audit candidates: " + counts.candidateStyles +
            "    Unnamed: " + counts.unnamedStyles +
            "    Word Imported List: " + counts.wordListStyles +
            "    Imported: " + counts.imported + "\n" +
            "Directly used: " + counts.directlyUsed +
            "    Referenced: " + counts.referenced +
            "    Usage warnings: " + counts.usageWarnings +
            "    Dependency warnings: " + counts.dependencyWarnings +
            "    Dependency N/A: " + counts.dependencyNA +
            "    Fingerprint warnings: " + counts.fingerprintWarnings + "\n" +
            "LOW: " + counts.low +
            "    MEDIUM: " + counts.medium +
            "    HIGH: " + counts.high +
            "    REPLACE: " + counts.replace + "\n" +
            "Book scope: " + counts.bookScope;

        try { ui.win.layout.layout(true); } catch (eLayout) {}
    }

    function refreshNoDocument() {
        try {
            ui.list.removeAll();
            ui.summary.text = "No InDesign document is open.";
            status("Open a document and click Rescan.");
        } catch (e) {}
    }

    function firstSelectedRow() {
        var selection = ui.list.selection;
        if (selection === null) { return null; }

        try {
            if (selection.length !== undefined && selection.index === undefined) {
                if (selection.length === 0) { return null; }
                return rows[selection[0].index];
            }
            return rows[selection.index];
        } catch (e) {
            return null;
        }
    }

    function locateFirstUse() {
        var row, text, located = false;

        if (app.documents.length === 0) {
            alert("No InDesign document is open.");
            return;
        }

        row = firstSelectedRow();
        if (row === null) {
            alert("Select a StyleFix row first.");
            return;
        }

        if (row.firstUsage === null || !valid(row.firstUsage)) {
            alert("This style has no direct text usage to locate.\n\n" +
                  "Risk: " + row.risk +
                  (row.dependencies ? "\nDependencies: " + row.dependencies : ""));
            return;
        }

        text = row.firstUsage;

        try {
            if (row.firstPageRef !== null && valid(row.firstPageRef)) {
                app.activeWindow.activePage = row.firstPageRef;
            }
        } catch (ePage) {}

        try { text.showText(); located = true; } catch (eShow) {}
        try { app.select(text); located = true; } catch (eSelect) {
            try { app.select(text.insertionPoints.item(0)); located = true; } catch (eIP) {}
        }

        if (located) {
            status("Located first direct use of " + row.styleName + ".");
        } else {
            alert("InDesign could not navigate to the first recorded use of " + row.styleName + ".");
        }
    }

    function saveCSV() {
        var doc, name, target, f, i, row;

        if (app.documents.length === 0) {
            alert("No InDesign document is open.");
            return;
        }

        doc = app.activeDocument;
        name = baseName(doc) + "_StyleFix_" + timestamp() + ".csv";
        target = defaultFile(doc, name).saveDlg("Save StyleFix CSV", "CSV:*.csv");

        if (target === null) { return; }
        if (!/\.csv$/i.test(target.name)) {
            target = new File(target.fsName + ".csv");
        }

        f = new File(target.fsName);
        f.encoding = "UTF-8";
        f.lineFeed = "Windows";

        if (!f.open("w")) {
            alert("StyleFix could not open the selected file for writing.");
            return;
        }

        f.write("\uFEFF");

        f.writeln(csv([
            "Risk", "Family", "Style Name", "Style ID", "Style Path", "Imported", "Based On",
            "Direct Runs", "Characters", "Pages", "Sample Text",
            "Dependency Count", "Dependencies",
            "Formatting State", "Canonical Match", "Canonical Match Count",
            "Suggested Action", "Formatting Fingerprint",
            "Usage Warning Count", "Usage Warnings",
            "Dependency Warning Count", "Dependency Warnings",
            "Dependency N/A",
            "Fingerprint Warning Count", "Fingerprint Warnings",
            "Book Scope"
        ]));

        for (i = 0; i < rows.length; i++) {
            row = rows[i];
            f.writeln(csv([
                row.risk, row.family, row.styleName, row.styleId, row.stylePath, row.imported, row.basedOn,
                row.directRuns, row.characters, row.pages, row.samples,
                row.dependencyCount, row.dependencies,
                row.formattingState, row.canonicalMatch, row.matchCount,
                row.action, row.fingerprint,
                row.usageWarningCount, row.usageWarnings,
                row.dependencyWarningCount, row.dependencyWarnings,
                row.dependencyNA,
                row.fingerprintWarningCount, row.fingerprintWarnings,
                row.bookScope
            ]));
        }

        f.close();
        status("CSV saved: " + target.fsName);
        alert("StyleFix CSV saved.\n\n" + target.fsName);
    }

    function sortRows() {
        var rank = {"LOW": 0, "REPLACE": 1, "MEDIUM": 2, "HIGH": 3};

        rows.sort(function (a, b) {
            var ra = rank[a.risk] !== undefined ? rank[a.risk] : 9;
            var rb = rank[b.risk] !== undefined ? rank[b.risk] : 9;

            if (ra !== rb) { return ra - rb; }
            return naturalStyleCompare(a.styleName, b.styleName);
        });
    }

    function safeAllCharacterStyles(doc) {
        return safeArrayLike(safePropertyObject(doc, "allCharacterStyles"));
    }

    function safeAllParagraphStyles(doc) {
        return safeArrayLike(safePropertyObject(doc, "allParagraphStyles"));
    }

    function collectionElements(collection) {
        var result = [], elements, i;

        if (collection === null || collection === undefined) { return result; }

        try {
            elements = collection.everyItem().getElements();
            for (i = 0; i < elements.length; i++) {
                if (elements[i] !== null && elements[i] !== undefined) {
                    result.push(elements[i]);
                }
            }
            return result;
        } catch (eEvery) {}

        try {
            for (i = 0; i < collection.length; i++) {
                if (collection.item !== undefined) {
                    result.push(collection.item(i));
                } else {
                    result.push(collection[i]);
                }
            }
        } catch (eLoop) {}

        return result;
    }

    function safeArrayLike(value) {
        var result = [], i;
        if (value === null || value === undefined) { return result; }

        try {
            for (i = 0; i < value.length; i++) {
                result.push(value[i]);
            }
        } catch (e) {}

        return result;
    }

    function propertyReadable(obj, prop) {
        var value;
        if (obj === null || obj === undefined) { return false; }
        try {
            value = obj[prop];
            return value !== undefined;
        } catch (e) {
            return false;
        }
    }

    function addGlobalAuditError(audit, label, err) {
        audit.errors++;
        addAuditWarning(audit.errorDetails, label, err);
    }

    function addNA(audit, detail) {
        if (!containsString(audit.na, detail)) {
            audit.na.push(detail);
        }
    }

    function addAuditWarning(list, label, err) {
        var detail = label;
        var message = errorSummary(err);

        if (message.length > 0) {
            detail += ": " + message;
        }

        if (list.length < 40 && !containsString(list, detail)) {
            list.push(detail);
        }
    }

    function errorSummary(err) {
        var parts = [];
        try { if (err.message) { parts.push(String(err.message)); } } catch (eMessage) {}
        try { if (err.number !== undefined) { parts.push("Error " + String(err.number)); } } catch (eNumber) {}
        try { if (err.line !== undefined) { parts.push("line " + String(err.line)); } } catch (eLine) {}
        return parts.join(" | ");
    }

    function importedState(style) {
        try {
            if (style.imported === true) { return "Yes"; }
            if (style.imported === false) { return "No"; }
        } catch (e) {}
        return "?";
    }

    function styleName(style) {
        try { return String(style.name); } catch (e) { return "<unknown>"; }
    }

    function styleRefName(ref) {
        if (ref === null || ref === undefined) { return ""; }
        try { if (ref.name !== undefined) { return String(ref.name); } } catch (eName) {}
        try { return String(ref); } catch (eString) { return ""; }
    }

    function safeName(obj) {
        try { return String(obj.name); } catch (e) { return ""; }
    }

    function objectTypeName(obj) {
        var s;
        try {
            if (obj.constructor && obj.constructor.name) {
                return String(obj.constructor.name);
            }
        } catch (eConstructor) {}
        try {
            s = String(obj);
            if (/^\[object .+\]$/.test(s)) {
                return s.substring(8, s.length - 1);
            }
        } catch (eString) {}
        return "Object";
    }

    function objectKey(obj) {
        var spec;
        if (obj === null || obj === undefined) { return ""; }
        try {
            spec = String(obj.toSpecifier());
            if (spec !== "") { return "SPEC:" + spec; }
        } catch (eSpec) {}
        try {
            if (obj.id !== undefined && obj.id !== null) { return objectTypeName(obj) + ":ID:" + String(obj.id); }
        } catch (eId) {}
        return "";
    }

    function filePathKey(value) {
        var s = "";
        if (value === null || value === undefined) { return ""; }
        try {
            if (value.fsName !== undefined) { s = String(value.fsName); }
            else { s = String(value); }
        } catch (e) { return ""; }
        return s.replace(/\//g, "\\").toLowerCase();
    }

    function joinStyleNames(styles) {
        var names = [], i;
        for (i = 0; i < styles.length; i++) { names.push(styleName(styles[i])); }
        return names.join(" | ");
    }

    function previewText(value) {
        var s = String(value).replace(/\u00A0/g, " ");
        s = s.replace(/[\r\n\t]+/g, " ");
        s = s.replace(/  +/g, " ");
        s = s.replace(/^ +/, "").replace(/ +$/, "");
        if (s.length > 110) { s = s.substring(0, 107) + "..."; }
        return s;
    }

    function naturalStyleCompare(a, b) {
        var ma = String(a).match(/^(.*?)(\d+)$/);
        var mb = String(b).match(/^(.*?)(\d+)$/);

        if (ma && mb && ma[1] === mb[1]) {
            return Number(ma[2]) - Number(mb[2]);
        }

        a = String(a).toLowerCase();
        b = String(b).toLowerCase();

        if (a < b) { return -1; }
        if (a > b) { return 1; }
        return 0;
    }

    function containsString(arr, value) {
        var i;
        for (i = 0; i < arr.length; i++) {
            if (String(arr[i]) === String(value)) { return true; }
        }
        return false;
    }

    function safeContents(obj) {
        try { return obj.contents; } catch (e) { return ""; }
    }

    function safeProperty(obj, name, fallback) {
        try { return String(obj[name]); } catch (e) { return fallback; }
    }

    function safePropertyObject(obj, name) {
        try { return obj[name]; } catch (e) { return null; }
    }

    function valid(obj) {
        try {
            return obj !== null && obj !== undefined && obj.isValid === true;
        } catch (e) {
            return false;
        }
    }

    function csv(values) {
        var out = [], i, s;
        for (i = 0; i < values.length; i++) {
            s = String(values[i]).replace(/"/g, "\"\"");
            out.push("\"" + s + "\"");
        }
        return out.join(",");
    }

    function defaultFile(doc, name) {
        var folder = Folder.desktop;
        try {
            if (doc.saved && doc.filePath && doc.filePath.exists) {
                folder = doc.filePath;
            }
        } catch (e) {}
        return new File(folder.fsName + "/" + name);
    }

    function docName(doc) {
        try { return String(doc.name); } catch (e) { return "Active document"; }
    }

    function baseName(doc) {
        return docName(doc).replace(/\.indd$/i, "").replace(/[\\\/:*?"<>|]/g, "_");
    }

    function timestamp() {
        var d = new Date();
        return d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + "-" +
               two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
    }

    function two(n) {
        return n < 10 ? "0" + n : String(n);
    }

    function status(text) {
        try {
            ui.status.text = text;
            ui.win.update();
        } catch (e) {}
    }
}());
