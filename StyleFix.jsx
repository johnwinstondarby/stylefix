#target "InDesign"
#targetengine "StyleFix"

/*
StyleFix v1.0
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
    var VERSION = "1.0";
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
        var matches = [];
        var targetFP = formattingFingerprint(target);
        var i, style;
        if (targetFP === "") { return matches; }
        for (i = 0; i < canonical.length; i++) {
            style = canonical[i];
            if (!valid(style) || sameStyle(style, target)) { continue; }
            if (formattingFingerprint(style) === targetFP) {
                matches.push(style);
            }
        }
        return matches;
    }

    function formattingFingerprint(style) {
        var props = [
            "appliedFont", "fontStyle", "pointSize", "leading", "tracking",
            "capitalization", "position", "underline", "strikeThru", "noBreak",
            "horizontalScale", "verticalScale", "baselineShift", "skew", "ligatures",
            "fillColor", "fillTint", "strokeColor", "strokeTint", "strokeWeight",
            "overprintFill", "overprintStroke"
        ];
        var parts = [];
        var i;
        if (!valid(style)) { return ""; }
        for (i = 0; i < props.length; i++) {
            parts.push(props[i] + "=" + normalizedProperty(style, props[i]));
        }
        return parts.join(";");
    }

    function normalizedProperty(obj, prop) {
        var value;
        try { value = obj[prop]; } catch (e) { return "<unavailable>"; }
        if (value === null || value === undefined) { return "<null>"; }

        if (prop === "appliedFont") {
            try { if (value.fullName !== undefined) { return String(value.fullName); } } catch (eFont) {}
            try { if (value.name !== undefined) { return String(value.name); } } catch (eFontName) {}
        }
        if (prop === "fillColor" || prop === "strokeColor") {
            return styleRefName(value);
        }
        try {
            if (value.constructor === Array) { return value.join("/"); }
        } catch (eArray) {}
        try { return String(value); } catch (eString) { return "<unprintable>"; }
    }

    function classifyRisk(usage, deps, matches, usageScanErrors) {
        if (usage.runs > 0 || deps.count > 0) {
            if (deps.errors > 0 || usageScanErrors > 0) { return "HIGH"; }
            if (matches.length === 1) { return "REPLACE"; }
            return "HIGH";
        }
        if (deps.errors > 0 || usageScanErrors > 0) { return "MEDIUM"; }
        return "LOW";
    }

    function suggestedAction(risk, matches, deps) {
        if (risk === "LOW") {
            return "Safe deletion candidate after selected re-check";
        }
        if (risk === "MEDIUM") {
            return "Review; dependency scan was incomplete";
        }
        if (risk === "REPLACE") {
            return "Replace with " + styleName(matches[0]) + ", verify references, then delete";
        }
        if (deps.count > 0) {
            return "Resolve text usage/dependencies before deletion";
        }
        return "Review applied text before deletion";
    }

    function isCanonicalCandidate(style) {
        var name = styleName(style);
        if (name === "" || name === "[None]") { return false; }
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
        ui.summary.preferredSize = [1160, 86];

        ui.list = ui.win.add("listbox", undefined, [], {multiselect: false});
        ui.list.preferredSize = [1160, 440];
        ui.list.onDoubleClick = locateFirstUse;

        ui.status = ui.win.add("statictext", undefined, "");
        ui.status.preferredSize = [1160, 34];

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
                   fixed(row.styleName, 27) + "  " +
                   "Use " + fixed(row.directRuns, 5) + "  " +
                   "Chars " + fixed(row.characters, 7) + "  " +
                   "Deps " + fixed(row.dependencyCount, 4) + "  " +
                   "Imported " + fixed(row.imported, 4) + "  " +
                   "Match " + fixed(row.canonicalMatch || "-", 28) + "  " +
                   fixed(row.pages || "-", 30);
            ui.list.add("item", line);
        }

        ui.summary.text = docName(doc) + "\n" +
            "Character styles: " + counts.characterStyles +
            "    Unnamed candidates: " + counts.unnamedStyles +
            "    Imported: " + counts.imported +
            "    Directly used: " + counts.directlyUsed +
            "    Referenced: " + counts.referenced + "\n" +
            "LOW: " + counts.low +
            "    MEDIUM: " + counts.medium +
            "    HIGH: " + counts.high +
            "    REPLACE: " + counts.replace +
            "    Audit warnings: " + counts.scanWarnings;

        try { ui.win.layout.layout(true); } catch (eLayout) {}
    }

    function locateFirstUse() {
        var row, text, located = false;
        if (ui.list.selection === null) {
            alert("Select a StyleFix row first.");
            return;
        }

        row = rows[ui.list.selection.index];
        if (!row || row.firstUsage === null || !valid(row.firstUsage)) {
            alert("This style has no direct text usage to locate.\n\n" +
                  "Risk: " + (row ? row.risk : "?") +
                  (row && row.dependencies ? "\nDependencies: " + row.dependencies : ""));
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
            "Canonical Match", "Canonical Match Count", "Suggested Action",
            "Formatting Fingerprint"
        ]));

        for (i = 0; i < rows.length; i++) {
            row = rows[i];
            f.writeln(csv([
                row.risk, row.styleName, row.styleId, row.imported, row.basedOn,
                row.directRuns, row.characters, row.pages, row.samples,
                row.dependencyCount, row.dependencies, row.dependencyErrors,
                row.canonicalMatch, row.matchCount, row.action, row.fingerprint
            ]));
        }

        f.close();
        status("CSV saved: " + target.fsName);
        alert("StyleFix CSV saved.\n\n" + target.fsName);
    }

    function sortRows() {
        var rank = {"HIGH": 0, "REPLACE": 1, "MEDIUM": 2, "LOW": 3};
        rows.sort(function (a, b) {
            var ra = rank[a.risk] !== undefined ? rank[a.risk] : 9;
            var rb = rank[b.risk] !== undefined ? rank[b.risk] : 9;
            if (ra !== rb) { return ra - rb; }
            return naturalStyleCompare(a.styleName, b.styleName);
        });
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

    function safeAllCharacterStyles(doc) {
        var result = [];
        var all, i;
        try {
            all = doc.allCharacterStyles;
            for (i = 0; i < all.length; i++) { result.push(all[i]); }
        } catch (e) {}
        return result;
    }

    function importedState(style) {
        try {
            if (style.imported === true) { return "Yes"; }
            if (style.imported === false) { return "No"; }
        } catch (e) {}
        return "?";
    }

    function sameStyle(a, b) {
        if (a === null || b === null || a === undefined || b === undefined) { return false; }
        try { return Number(a.id) === Number(b.id); } catch (eId) {}
        try { return String(a.toSpecifier()) === String(b.toSpecifier()); } catch (eSpec) {}
        return false;
    }

    function styleRefMatches(ref, target) {
        if (ref === null || ref === undefined || target === null || target === undefined) { return false; }
        if (sameStyle(ref, target)) { return true; }
        try { return String(ref) === styleName(target); } catch (e) { return false; }
    }

    function styleKey(style) {
        try { return "ID:" + String(style.id); } catch (eId) {}
        return "NAME:" + styleName(style);
    }

    function styleName(style) {
        try { return String(style.name); } catch (e) { return "<unknown>"; }
    }

    function styleRefName(ref) {
        if (ref === null || ref === undefined) { return ""; }
        try { if (ref.name !== undefined) { return String(ref.name); } } catch (eName) {}
        try { return String(ref); } catch (eString) { return ""; }
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

    function containsString(arr, value) {
        var i;
        for (i = 0; i < arr.length; i++) {
            if (String(arr[i]) === String(value)) { return true; }
        }
        return false;
    }

    function safeCollectionLength(obj, prop) {
        try { return Number(obj[prop].length); } catch (e) { return 0; }
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
        try { return obj !== null && obj !== undefined && obj.isValid === true; } catch (e) { return false; }
    }

    function fixed(value, width) {
        var s = String(value);
        while (s.length < width) { s += " "; }
        if (s.length > width) { s = s.substring(0, width - 3) + "..."; }
        return s;
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
