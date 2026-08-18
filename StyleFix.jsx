#target "InDesign"
#targetengine "StyleFix"

/*
StyleFix v1.0.1
Read-only audit for Word/import-created character-style debris, initially focused on
character styles whose names begin with "Unnamed Style".

For each candidate StyleFix reports:
  - imported state;
  - direct text usage, character count, pages, and sample text;
  - known document dependencies/references;
  - candidate equivalence to an existing named character style;
  - conservative deletion risk: LOW, MEDIUM, HIGH, or REPLACE.

No styles or text are changed in v1.0.
ExtendScript / ECMAScript 3 compatible.
*/

(function () {
    var VERSION = "1.0.1";
    var UNNAMED_RE = /^Unnamed Style(?:\s|$)/i;
    var rows = [];
    var counts = null;
    var ui = {};

    if (app.documents.length === 0) {
        alert("StyleFix v" + VERSION + "\n\nOpen an InDesign document before running StyleFix.");
        return;
    }

    buildUI();
    scan();
    ui.win.show();

    function scan() {
        var doc = app.activeDocument;
        var allStyles = safeAllCharacterStyles(doc);
        var candidates = [];
        var canonical = [];
        var usageAudit, usageMap, usageScanErrors;
        var i, style, usage, deps, matches, risk, action, imported;

        rows = [];
        counts = {
            characterStyles: allStyles.length,
            unnamedStyles: 0,
            low: 0,
            medium: 0,
            high: 0,
            replace: 0,
            directlyUsed: 0,
            referenced: 0,
            imported: 0,
            scanWarnings: 0
        };

        status("Inventorying character styles in " + docName(doc) + "...");

        for (i = 0; i < allStyles.length; i++) {
            style = allStyles[i];
            if (!valid(style)) { continue; }
            if (UNNAMED_RE.test(styleName(style))) {
                candidates.push(style);
            } else if (isCanonicalCandidate(style)) {
                canonical.push(style);
            }
        }

        counts.unnamedStyles = candidates.length;
        usageAudit = buildUsageMap(doc, candidates);
        usageMap = usageAudit.map;
        usageScanErrors = usageAudit.errors;
        counts.scanWarnings += usageScanErrors;

        for (i = 0; i < candidates.length; i++) {
            style = candidates[i];
            status("Auditing " + (i + 1) + " of " + candidates.length + ": " + styleName(style));

            usage = usageMap[styleKey(style)] || emptyUsage();
            deps = dependencyInfo(doc, style, allStyles);
            matches = equivalentCanonicalStyles(style, canonical);
            imported = importedState(style);
            risk = classifyRisk(usage, deps, matches, usageScanErrors);
            action = suggestedAction(risk, matches, deps);

            if (usage.runs > 0) { counts.directlyUsed++; }
            if (deps.count > 0) { counts.referenced++; }
            if (imported === "Yes") { counts.imported++; }
            counts.scanWarnings += deps.errors;

            if (risk === "LOW") { counts.low++; }
            else if (risk === "MEDIUM") { counts.medium++; }
            else if (risk === "HIGH") { counts.high++; }
            else if (risk === "REPLACE") { counts.replace++; }

            rows.push({
                risk: risk,
                styleName: styleName(style),
                styleId: safeProperty(style, "id", "-"),
                imported: imported,
                basedOn: styleRefName(safePropertyObject(style, "basedOn")),
                directRuns: usage.runs,
                characters: usage.characters,
                pages: usagePageText(usage),
                firstPageSort: usage.firstPageSort,
                samples: usage.samples.join(" | "),
                dependencyCount: deps.count,
                dependencies: deps.details.join(" | "),
                dependencyErrors: deps.errors + usageScanErrors,
                canonicalMatch: matches.length === 1 ? styleName(matches[0]) : (matches.length > 1 ? joinStyleNames(matches) : ""),
                matchCount: matches.length,
                fingerprint: formattingFingerprint(style),
                action: action,
                style: style,
                firstUsage: usage.firstUsage,
                firstPageRef: usage.firstPageRef
            });
        }

        sortRows();
        refresh(doc);

        if (rows.length === 0) {
            status("Scan complete. No character styles named Unnamed Style * were found.");
        } else {
            status("Scan complete. Select a style and click Locate First Use, or export the audit CSV.");
        }
    }

    function buildUsageMap(doc, candidates) {
        var map = {};
        var errors = 0;
        var nameMap = {};
        var i, s, r, story, ranges, range, style, key, name;
        var usage, len, pageInfo, sample;

        for (i = 0; i < candidates.length; i++) {
            key = styleKey(candidates[i]);
            map[key] = emptyUsage();
            nameMap[styleName(candidates[i])] = key;
        }

        for (s = 0; s < doc.stories.length; s++) {
            story = doc.stories.item(s);
            if (!valid(story)) { continue; }

            try {
                ranges = story.textStyleRanges;
                for (r = 0; r < ranges.length; r++) {
                    range = ranges.item(r);
                    if (!valid(range)) { continue; }

                    style = safePropertyObject(range, "appliedCharacterStyle");
                    key = style !== null ? styleKey(style) : "";

                    if (map[key] === undefined) {
                        name = styleRefName(style);
                        key = nameMap[name] || "";
                    }
                    if (key === "" || map[key] === undefined) { continue; }

                    usage = map[key];
                    usage.runs++;
                    len = safeCollectionLength(range, "characters");
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
            } catch (eRanges) {
                errors++;
            }
        }

        return {map: map, errors: errors};
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

    function pagesForText(text) {
        var result = {names: [], refs: [], firstPageRef: null, firstPageSort: 999999998};
        var ips = [];
        var first, last;

        try { first = text.insertionPoints.item(0); ips.push(first); } catch (eFirst) {}
        try { last = text.insertionPoints.item(-1); ips.push(last); } catch (eLast) {}

        addPageFromInsertionPoint(result, ips.length > 0 ? ips[0] : null);
        if (ips.length > 1) { addPageFromInsertionPoint(result, ips[1]); }

        if (result.names.length === 0) {
            result.names.push("Overset/No page");
        }
        return result;
    }

    function addPageFromInsertionPoint(result, ip) {
        var frames, frame, page, name, sort;
        if (ip === null || !valid(ip)) { return; }
        try {
            frames = ip.parentTextFrames;
            if (!frames || frames.length === 0) { return; }
            frame = frames[0];
            if (!valid(frame)) { return; }
            page = frame.parentPage;
            if (page === null || !valid(page)) { return; }
            name = String(page.name);
            if (!containsString(result.names, name)) {
                result.names.push(name);
                result.refs.push(page);
            }
            sort = Number(page.documentOffset);
            if (sort < result.firstPageSort) {
                result.firstPageSort = sort;
                result.firstPageRef = page;
            }
        } catch (ePage) {}
    }

    function addPages(usage, pageInfo) {
        var i, name;
        for (i = 0; i < pageInfo.names.length; i++) {
            name = pageInfo.names[i];
            if (usage.pages[name] !== true) {
                usage.pages[name] = true;
                if (usage.pageNames.length < 20) {
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

    function dependencyInfo(doc, target, allStyles) {
        var info = {count: 0, details: [], errors: 0};
        var i, j, style, ps, collection, item, obj, options, indexObj, topics, topic, refs, ref;

        try {
            for (i = 0; i < allStyles.length; i++) {
                style = allStyles[i];
                if (!valid(style) || sameStyle(style, target)) { continue; }
                if (styleRefMatches(safePropertyObject(style, "basedOn"), target)) {
                    addDependency(info, "Based-on: " + styleName(style));
                }
            }
        } catch (eBasedOn) { info.errors++; }

        try {
            collection = doc.allParagraphStyles;
            for (i = 0; i < collection.length; i++) {
                ps = collection[i];
                if (!valid(ps)) { continue; }
                checkStyleProperty(info, ps, "dropCapStyle", target, "Paragraph " + styleName(ps) + " drop cap");
                checkStyleProperty(info, ps, "bulletsCharacterStyle", target, "Paragraph " + styleName(ps) + " bullets");
                checkStyleProperty(info, ps, "numberingCharacterStyle", target, "Paragraph " + styleName(ps) + " numbering");
                scanAppliedStyleCollection(info, safePropertyObject(ps, "nestedStyles"), target, "Paragraph " + styleName(ps) + " nested style");
                scanAppliedStyleCollection(info, safePropertyObject(ps, "nestedGrepStyles"), target, "Paragraph " + styleName(ps) + " nested GREP");
                scanAppliedStyleCollection(info, safePropertyObject(ps, "nestedLineStyles"), target, "Paragraph " + styleName(ps) + " nested line");
            }
        } catch (eParagraphStyles) { info.errors++; }

        try {
            collection = doc.textVariables;
            for (i = 0; i < collection.length; i++) {
                obj = collection.item(i);
                if (!valid(obj)) { continue; }
                options = safePropertyObject(obj, "variableOptions");
                if (options !== null && styleRefMatches(safePropertyObject(options, "appliedCharacterStyle"), target)) {
                    addDependency(info, "Text variable: " + safeProperty(obj, "name", "#" + i));
                }
            }
        } catch (eVariables) { info.errors++; }

        try {
            collection = doc.crossReferenceFormats;
            for (i = 0; i < collection.length; i++) {
                obj = collection.item(i);
                if (!valid(obj)) { continue; }
                if (styleRefMatches(safePropertyObject(obj, "appliedCharacterStyle"), target)) {
                    addDependency(info, "Cross-reference format: " + safeProperty(obj, "name", "#" + i));
                }
                scanAppliedStyleCollection(info, safePropertyObject(obj, "buildingBlocks"), target, "Cross-reference building block: " + safeProperty(obj, "name", "#" + i));
            }
        } catch (eCrossFormats) { info.errors++; }

        scanNamedSourceCollection(info, safePropertyObject(doc, "hyperlinkTextSources"), target, "Hyperlink source");
        scanNamedSourceCollection(info, safePropertyObject(doc, "crossReferenceSources"), target, "Cross-reference source");

        try {
            collection = doc.tocStyles;
            for (i = 0; i < collection.length; i++) {
                obj = collection.item(i);
                if (!valid(obj)) { continue; }
                refs = safePropertyObject(obj, "tocStyleEntries");
                if (refs === null) { continue; }
                for (j = 0; j < refs.length; j++) {
                    ref = refs.item(j);
                    if (!valid(ref)) { continue; }
                    if (styleRefMatches(safePropertyObject(ref, "pageNumberStyle"), target)) {
                        addDependency(info, "TOC " + safeProperty(obj, "name", "#" + i) + " page number: " + safeProperty(ref, "name", "entry " + j));
                    }
                    if (styleRefMatches(safePropertyObject(ref, "separatorStyle"), target)) {
                        addDependency(info, "TOC " + safeProperty(obj, "name", "#" + i) + " separator: " + safeProperty(ref, "name", "entry " + j));
                    }
                }
            }
        } catch (eTOC) { info.errors++; }

        try {
            options = doc.indexOptions;
            if (options !== null && options !== undefined) {
                checkStyleProperty(info, options, "pageNumberStyle", target, "Index option: page number");
                checkStyleProperty(info, options, "crossReferenceStyle", target, "Index option: cross reference");
                checkStyleProperty(info, options, "crossReferenceTopicStyle", target, "Index option: cross-reference topic");
            }
        } catch (eIndexOptions) { info.errors++; }

        try {
            collection = doc.indexes;
            for (i = 0; i < collection.length; i++) {
                indexObj = collection.item(i);
                if (!valid(indexObj)) { continue; }
                topics = indexObj.allTopics;
                for (j = 0; j < topics.length; j++) {
                    topic = topics[j];
                    if (!valid(topic)) { continue; }
                    refs = topic.pageReferences;
                    for (var k = 0; k < refs.length; k++) {
                        ref = refs.item(k);
                        if (!valid(ref)) { continue; }
                        if (styleRefMatches(safePropertyObject(ref, "pageNumberStyleOverride"), target)) {
                            addDependency(info, "Index page-reference override: " + safeProperty(topic, "name", "topic"));
                        }
                    }
                }
            }
        } catch (ePageRefs) { info.errors++; }

        return info;
    }

    function scanNamedSourceCollection(info, collection, target, label) {
        var i, item;
        if (collection === null || collection === undefined) { return; }
        try {
            for (i = 0; i < collection.length; i++) {
                item = collection.item(i);
                if (!valid(item)) { continue; }
                if (styleRefMatches(safePropertyObject(item, "appliedCharacterStyle"), target)) {
                    addDependency(info, label + ": " + safeProperty(item, "name", "#" + i));
                }
            }
        } catch (e) { info.errors++; }
    }

    function scanAppliedStyleCollection(info, collection, target, label) {
        var i, item;
        if (collection === null || collection === undefined) { return; }
        try {
            for (i = 0; i < collection.length; i++) {
                item = collection.item(i);
                if (!valid(item)) { continue; }
                if (styleRefMatches(safePropertyObject(item, "appliedCharacterStyle"), target)) {
                    addDependency(info, label + " #" + i);
                }
            }
        } catch (e) { info.errors++; }
    }

    function checkStyleProperty(info, obj, prop, target, label) {
        try {
            if (styleRefMatches(obj[prop], target)) {
                addDependency(info, label);
            }
        } catch (e) {}
    }

    function addDependency(info, detail) {
        info.count++;
        if (info.details.length < 30 && !containsString(info.details, detail)) {
            info.details.push(detail);
        }
    }

    function equivalentCanonicalStyles(target, canonical) {
        var out = [];
        var targetFingerprint = formattingFingerprint(target);
        var i, style;

        if (targetFingerprint === "") { return out; }

        for (i = 0; i < canonical.length; i++) {
            style = canonical[i];
            if (!valid(style)) { continue; }
            if (formattingFingerprint(style) === targetFingerprint) {
                out.push(style);
            }
        }
        return out;
    }

    function formattingFingerprint(style) {
        var parts = [];
        var props = [
            "appliedFont", "fontStyle", "pointSize", "leading", "tracking",
            "kerningMethod", "position", "horizontalScale", "verticalScale",
            "baselineShift", "skew", "capitalization", "underline", "strikeThru",
            "fillColor", "fillTint", "strokeColor", "strokeTint", "strokeWeight",
            "ligatures", "noBreak", "language", "otfFigureStyle"
        ];
        var i, value;

        for (i = 0; i < props.length; i++) {
            value = fingerprintValue(safePropertyObject(style, props[i]));
            parts.push(props[i] + "=" + value);
        }
        return parts.join("|");
    }

    function fingerprintValue(value) {
        if (value === null || value === undefined) { return "<null>"; }
        try {
            if (value.name !== undefined) { return "name:" + String(value.name); }
        } catch (eName) {}
        try {
            if (value.id !== undefined) { return "id:" + String(value.id); }
        } catch (eId) {}
        try { return String(value); } catch (eString) { return "<?>"; }
    }

    function classifyRisk(usage, deps, matches, usageScanErrors) {
        var uncertain = usageScanErrors > 0 || deps.errors > 0;
        var usedOrReferenced = usage.runs > 0 || deps.count > 0;

        if (usedOrReferenced && matches.length === 1 && !uncertain) {
            return "REPLACE";
        }
        if (usedOrReferenced) {
            return "HIGH";
        }
        if (uncertain) {
            return "MEDIUM";
        }
        return "LOW";
    }

    function suggestedAction(risk, matches, deps) {
        if (risk === "LOW") { return "Safe deletion candidate"; }
        if (risk === "REPLACE") { return "Review replacement with " + styleName(matches[0]); }
        if (risk === "MEDIUM") { return "Review audit warning before deletion"; }
        if (deps.count > 0) { return "Resolve usage/dependencies before deletion"; }
        return "Review direct uses before deletion";
    }

    function importedState(style) {
        try {
            return style.imported === true ? "Yes" : "No";
        } catch (e) {
            return "Unknown";
        }
    }

    function isCanonicalCandidate(style) {
        var name = styleName(style);
        if (name === "[None]" || name === "None" || name === "") { return false; }
        if (UNNAMED_RE.test(name)) { return false; }
        return true;
    }

    function buildUI() {
        var buttons, button;

        ui.win = new Window("palette", "StyleFix v" + VERSION);
        ui.win.orientation = "column";
        ui.win.alignChildren = ["fill", "top"];
        ui.win.margins = 12;
        ui.win.spacing = 8;

        ui.title = ui.win.add("statictext", undefined, "Unnamed Character Style Audit");
        try {
            ui.title.graphics.font = ScriptUI.newFont(ui.title.graphics.font.name, "BOLD", 15);
        } catch (eFont) {}

        ui.summary = ui.win.add("statictext", undefined, "", {multiline: true});
        ui.summary.preferredSize = [1120, 92];

        ui.list = ui.win.add("listbox", undefined, [], {multiselect: false});
        ui.list.preferredSize = [1120, 440];
        ui.list.onDoubleClick = locateFirstUse;

        ui.status = ui.win.add("statictext", undefined, "");
        ui.status.preferredSize = [1120, 34];

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
        var i, row, line;
        ui.list.removeAll();

        for (i = 0; i < rows.length; i++) {
            row = rows[i];
            line = fixed(row.risk, 8) + "  " +
                   fixed(row.styleName, 26) + "  " +
                   "Uses " + fixed(row.directRuns, 6) + "  " +
                   "Chars " + fixed(row.characters, 8) + "  " +
                   "Deps " + fixed(row.dependencyCount, 5) + "  " +
                   "Match " + fixed(row.canonicalMatch || "-", 24) + "  " +
                   fixed(row.pages || "-", 22) + "  " +
                   row.samples;
            ui.list.add("item", line);
        }

        ui.summary.text = docName(doc) + "\n" +
            "Character styles: " + counts.characterStyles +
            "    Unnamed candidates: " + counts.unnamedStyles +
            "    Directly used: " + counts.directlyUsed +
            "    Referenced: " + counts.referenced +
            "    Imported: " + counts.imported + "\n" +
            "Risk: HIGH=" + counts.high +
            "  REPLACE=" + counts.replace +
            "  MEDIUM=" + counts.medium +
            "  LOW=" + counts.low +
            "    Audit warnings: " + counts.scanWarnings;

        try { ui.win.layout.layout(true); } catch (eLayout) {}
    }

    function locateFirstUse() {
        var row, target, located = false;

        if (ui.list.selection === null) {
            alert("Select a StyleFix row first.");
            return;
        }

        row = rows[ui.list.selection.index];
        if (!row) { return; }

        if (row.firstUsage === null || !valid(row.firstUsage)) {
            alert(row.styleName + " has no direct text use to locate.\n\n" +
                  "Risk: " + row.risk + "\n" +
                  "Dependencies: " + row.dependencyCount +
                  (row.dependencies.length > 0 ? "\n\n" + row.dependencies : ""));
            return;
        }

        target = row.firstUsage;
        try {
            if (row.firstPageRef !== null && valid(row.firstPageRef)) {
                app.activeWindow.activePage = row.firstPageRef;
            }
        } catch (ePage) {}

        try { target.showText(); located = true; } catch (eShow) {}
        try { app.select(target); located = true; } catch (eSelect) {
            try { app.select(target.insertionPoints.item(0)); located = true; } catch (eIP) {}
        }

        if (located) {
            status("Located first direct use of " + row.styleName + ".");
        } else {
            alert("InDesign could not navigate to the first use of " + row.styleName + ".");
        }
    }

    function saveCSV() {
        var doc = app.activeDocument;
        var name = baseName(doc) + "_StyleFix_" + timestamp() + ".csv";
        var target = defaultFile(doc, name).saveDlg("Save StyleFix CSV", "CSV:*.csv");
        var f, i, row;

        if (target === null) { return; }
        if (!/\.csv$/i.test(target.name)) { target = new File(target.fsName + ".csv"); }

        f = new File(target.fsName);
        f.encoding = "UTF-8";
        f.lineFeed = "Windows";
        if (!f.open("w")) {
            alert("StyleFix could not open the selected file for writing.");
            return;
        }

        f.writeln(csv([
            "Risk", "Style Name", "Style ID", "Imported", "Based On",
            "Direct Runs", "Characters", "Pages", "Sample Text",
            "Dependency Count", "Dependencies", "Audit Warnings",
            "Canonical Match", "Canonical Match Count", "Formatting Fingerprint",
            "Suggested Action"
        ]));

        for (i = 0; i < rows.length; i++) {
            row = rows[i];
            f.writeln(csv([
                row.risk, row.styleName, row.styleId, row.imported, row.basedOn,
                row.directRuns, row.characters, row.pages, row.samples,
                row.dependencyCount, row.dependencies, row.dependencyErrors,
                row.canonicalMatch, row.matchCount, row.fingerprint, row.action
            ]));
        }

        f.close();
        status("CSV saved: " + target.fsName);
        alert("StyleFix CSV saved.\n\n" + target.fsName);
    }

    function sortRows() {
        rows.sort(function (a, b) {
            var ra = riskRank(a.risk);
            var rb = riskRank(b.risk);
            if (ra !== rb) { return ra - rb; }
            if (a.firstPageSort !== b.firstPageSort) { return a.firstPageSort - b.firstPageSort; }
            return numericSuffix(a.styleName) - numericSuffix(b.styleName);
        });
    }

    function riskRank(risk) {
        if (risk === "HIGH") { return 0; }
        if (risk === "REPLACE") { return 1; }
        if (risk === "MEDIUM") { return 2; }
        return 3;
    }

    function numericSuffix(name) {
        var m = String(name).match(/(\d+)\s*$/);
        return m ? Number(m[1]) : 999999999;
    }

    function safeAllCharacterStyles(doc) {
        var out = [];
        var all, i;
        try {
            all = doc.allCharacterStyles;
            for (i = 0; i < all.length; i++) {
                if (valid(all[i])) { out.push(all[i]); }
            }
        } catch (e) {}
        return out;
    }

    function styleKey(style) {
        try { return "id:" + String(style.id); } catch (eId) {}
        return "name:" + styleName(style);
    }

    function sameStyle(a, b) {
        if (a === null || b === null || a === undefined || b === undefined) { return false; }
        try { return String(a.id) === String(b.id); } catch (eId) {}
        return styleName(a) === styleName(b);
    }

    function styleRefMatches(ref, target) {
        if (ref === null || ref === undefined) { return false; }
        return sameStyle(ref, target) || styleRefName(ref) === styleName(target);
    }

    function styleRefName(style) {
        if (style === null || style === undefined) { return ""; }
        try { return String(style.name); } catch (eName) {}
        try { return String(style); } catch (eString) { return ""; }
    }

    function styleName(style) {
        try { return String(style.name); } catch (e) { return "<unknown>"; }
    }

    function safeCollectionLength(obj, prop) {
        try { return obj[prop].length; } catch (e) { return 0; }
    }

    function previewText(value) {
        var s = String(value).replace(/\u00A0/g, " ");
        s = s.replace(/[\r\n\t]+/g, " ");
        s = s.replace(/  +/g, " ");
        s = s.replace(/^ +/, "").replace(/ +$/, "");
        if (s.length > 120) { s = s.substring(0, 117) + "..."; }
        return s;
    }

    function safeContents(obj) {
        try { return obj.contents; } catch (e) { return ""; }
    }

    function containsString(arr, value) {
        var i;
        for (i = 0; i < arr.length; i++) {
            if (String(arr[i]) === String(value)) { return true; }
        }
        return false;
    }

    function joinStyleNames(styles) {
        var names = [], i;
        for (i = 0; i < styles.length; i++) { names.push(styleName(styles[i])); }
        return names.join(" | ");
    }

    function valid(obj) {
        try { return obj !== null && obj.isValid === true; } catch (e) { return false; }
    }

    function safeProperty(obj, name, fallback) {
        try {
            var value = obj[name];
            if (value === undefined || value === null) { return fallback; }
            return String(value);
        } catch (e) { return fallback; }
    }

    function safePropertyObject(obj, name) {
        try {
            var value = obj[name];
            return value === undefined ? null : value;
        } catch (e) { return null; }
    }

    function csv(values) {
        var out = [], i, s;
        for (i = 0; i < values.length; i++) {
            s = String(values[i]).replace(/"/g, "\"\"");
            out.push("\"" + s + "\"");
        }
        return out.join(",");
    }

    function fixed(value, width) {
        var s = String(value);
        while (s.length < width) { s += " "; }
        if (s.length > width) { s = s.substring(0, width - 3) + "..."; }
        return s;
    }

    function defaultFile(doc, name) {
        var folder = Folder.desktop;
        try {
            if (doc.saved && doc.filePath && doc.filePath.exists) { folder = doc.filePath; }
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

    function two(n) { return n < 10 ? "0" + n : String(n); }

    function status(text) {
        ui.status.text = text;
        try { ui.win.update(); } catch (e) {}
    }
}());
