#target "InDesign"

/*
StyleFix v1.0.8 Core Canary Location Probe

Read-only diagnostic for the five remaining location controls:
C09 anchored inline frame
C10 grouped frame
C12 locked-layer frame
C13 threaded multi-page story
C14 table on parent/master page

The probe intentionally uses direct DOM reads. It is a canary diagnostic,
not production StyleFix scanner code. Its purpose is to expose the exact
object chains InDesign returns so location resolution can be fixed from
evidence rather than guesswork.
*/

(function () {
    var VERSION = "1.0.0";
    var TARGETS = {C09:true,C10:true,C12:true,C13:true,C14:true};
    var doc, lines = [], hits = {}, i;

    if (app.documents.length === 0) {
        alert("StyleFix Location Probe\n\nOpen StyleFix_Canary_v1_0_7.indd first.");
        return;
    }

    doc = app.activeDocument;
    for (i in TARGETS) { if (TARGETS.hasOwnProperty(i)) { hits[i] = 0; } }

    log("StyleFix v1.0.8 Core Canary Location Probe");
    log("============================================");
    log("Probe version: " + VERSION);
    log("Document: " + safeString(function(){ return doc.name; },"<unknown>"));
    log("InDesign: " + safeString(function(){ return app.version; },"<unknown>"));
    log("");

    scanDocument();

    log("");
    log("Summary");
    log("-------");
    for (i in TARGETS) {
        if (TARGETS.hasOwnProperty(i)) { log(i + " hits=" + hits[i]); }
    }

    saveReport();

    function scanDocument() {
        var stories = collectionArray(doc.stories), s;
        for (s = 0; s < stories.length; s++) {
            scanTextContainer(stories[s],"Story[" + s + "]",0);
        }
    }

    function scanTextContainer(container,label,tableDepth) {
        var ranges = collectionArray(safeObject(function(){ return container.textStyleRanges; }));
        var tables = collectionArray(safeObject(function(){ return container.tables; }));
        var r, t;

        for (r = 0; r < ranges.length; r++) {
            inspectRange(ranges[r],label + ".textStyleRanges[" + r + "]",tableDepth);
        }
        for (t = 0; t < tables.length; t++) {
            scanTable(tables[t],label + ".tables[" + t + "]",tableDepth + 1);
        }
    }

    function scanTable(table,label,tableDepth) {
        var cells = collectionArray(safeObject(function(){ return table.cells; }));
        var c, texts;
        for (c = 0; c < cells.length; c++) {
            texts = collectionArray(safeObjectFactory(cells[c],"texts"));
            if (texts.length > 0) {
                scanTextContainer(texts[0],label + ".cells[" + c + "].texts[0]",tableDepth);
            }
        }
    }

    function inspectRange(range,label,tableDepth) {
        var style = safeObject(function(){ return range.appliedCharacterStyle; });
        var name = objectName(style);
        var id;
        if (name.indexOf("Unnamed Style ") !== 0) { return; }
        id = name.substring("Unnamed Style ".length);
        if (TARGETS[id] !== true) { return; }

        hits[id]++;
        log("");
        log("============================================================");
        log(id + " HIT " + hits[id]);
        log("============================================================");
        log("Traversal label: " + label);
        log("Table depth: " + tableDepth);
        log("Range type: " + typeName(range));
        log("Range valid: " + validity(range));
        log("Range chars: " + safeString(function(){ return String(range.contents).length; },"ERR"));
        log("Range sample: " + preview(safeString(function(){ return range.contents; },"")));

        traceFrames("range.parentTextFrames",safeObject(function(){ return range.parentTextFrames; }));
        traceInsertionPoints(range);
        traceStory(range);
    }

    function traceInsertionPoints(range) {
        var ips = collectionArray(safeObject(function(){ return range.insertionPoints; }));
        log("insertionPoints.length=" + ips.length);
        if (ips.length === 0) { return; }
        traceInsertionPoint("first insertion point",ips[0]);
        if (ips.length > 1) { traceInsertionPoint("last insertion point",ips[ips.length - 1]); }
    }

    function traceInsertionPoint(label,ip) {
        log(label + ": type=" + typeName(ip) + "; valid=" + validity(ip));
        traceFrames(label + ".parentTextFrames",safeObject(function(){ return ip.parentTextFrames; }));
        log(label + ".parentStory=" + objectSummary(safeObject(function(){ return ip.parentStory; })));
    }

    function traceStory(range) {
        var story = safeObject(function(){ return range.parentStory; });
        var containers;
        log("range.parentStory=" + objectSummary(story));
        if (story === null) { return; }
        log("story.id=" + safeString(function(){ return story.id; },"ERR"));
        log("story.overflows=" + safeString(function(){ return story.overflows; },"ERR"));
        containers = safeObject(function(){ return story.textContainers; });
        traceFrames("story.textContainers",containers);
    }

    function traceFrames(label,value) {
        var frames = collectionArray(value), i;
        log(label + ": rawType=" + typeName(value) + "; length=" + frames.length);
        if (value !== null) {
            log(label + ": rawLength=" + safeString(function(){ return value.length; },"ERR") +
                "; hasItem=" + safeString(function(){ return typeof value.item; },"ERR") +
                "; hasEveryItem=" + safeString(function(){ return typeof value.everyItem; },"ERR"));
        }
        for (i = 0; i < frames.length; i++) {
            log(label + "[" + i + "]=" + objectSummary(frames[i]));
            traceObjectChain(frames[i],label + "[" + i + "]",0,{});
        }
    }

    function traceObjectChain(obj,label,depth,seen) {
        var page, parent, key;
        if (obj === null || depth > 10) { return; }
        key = objectKey(obj);
        if (key !== "" && seen[key] === true) {
            log(indent(depth) + label + " cycle=" + key);
            return;
        }
        if (key !== "") { seen[key] = true; }

        page = safeObject(function(){ return obj.parentPage; });
        log(indent(depth) + label +
            " type=" + typeName(obj) +
            "; valid=" + validity(obj) +
            "; parentPage=" + objectSummary(page) +
            "; parentPageString=" + safeString(function(){ return String(page); },"ERR"));

        parent = safeObject(function(){ return obj.parent; });
        if (parent === null || parent === obj) {
            log(indent(depth) + label + ".parent=" + objectSummary(parent));
            return;
        }
        log(indent(depth) + label + ".parent=" + objectSummary(parent));

        /* Characters and insertion points can identify the host text frame. */
        if (typeName(parent) === "Character" || typeName(parent) === "InsertionPoint") {
            traceFrames(indent(depth) + label + ".parent.parentTextFrames",
                safeObject(function(){ return parent.parentTextFrames; }));
        }

        traceObjectChain(parent,label + ".parent",depth + 1,seen);
    }

    function collectionArray(value) {
        var out = [], elements, i, len;
        if (value === null || value === undefined) { return out; }

        try {
            if (value.constructor === Array) {
                for (i = 0; i < value.length; i++) { out.push(value[i]); }
                return out;
            }
        } catch (ignoreArray) {}

        try {
            if (typeof value.everyItem === "function") {
                elements = value.everyItem().getElements();
                if (elements && elements.length !== undefined) {
                    for (i = 0; i < elements.length; i++) { out.push(elements[i]); }
                    return out;
                }
            }
        } catch (ignoreEvery) {}

        try { len = Number(value.length); }
        catch (ignoreLength) { len = 0; }
        if (isNaN(len) || len < 0) { len = 0; }

        for (i = 0; i < len; i++) {
            try {
                if (typeof value.item === "function") { out.push(value.item(i)); }
                else { out.push(value[i]); }
            } catch (ignoreItem) {}
        }
        return out;
    }

    function safeObject(fn) {
        try {
            var v = fn();
            if (v === undefined) { return null; }
            return v;
        } catch (e) { return null; }
    }

    function safeObjectFactory(obj,prop) {
        return function(){ return obj[prop]; };
    }

    function safeString(fn,fallback) {
        try {
            var v = fn();
            if (v === null || v === undefined) { return fallback; }
            return String(v);
        } catch (e) { return fallback + " [" + errorText(e) + "]"; }
    }

    function objectName(obj) {
        if (obj === null || obj === undefined) { return ""; }
        try { return String(obj.name); } catch (e) {}
        try { return String(obj); } catch (e2) {}
        return "";
    }

    function objectSummary(obj) {
        if (obj === null || obj === undefined) { return "<null>"; }
        return typeName(obj) +
            "{valid=" + validity(obj) +
            ";name=" + objectName(obj) +
            ";id=" + safeString(function(){ return obj.id; },"N/A") +
            ";spec=" + shortSpec(obj) + "}";
    }

    function typeName(obj) {
        if (obj === null || obj === undefined) { return "<null>"; }
        try { if (obj.reflect && obj.reflect.name) { return String(obj.reflect.name); } } catch (e1) {}
        try { if (obj.constructor && obj.constructor.name) { return String(obj.constructor.name); } } catch (e2) {}
        return typeof obj;
    }

    function validity(obj) {
        if (obj === null || obj === undefined) { return "NO"; }
        try {
            if (obj.isValid === true) { return "YES"; }
            if (obj.isValid === false) { return "NO"; }
        } catch (e) {}
        return "N/A";
    }

    function shortSpec(obj) {
        var s;
        try {
            s = String(obj.toSpecifier());
            if (s.length > 180) { s = s.substring(0,177) + "..."; }
            return s;
        } catch (e) { return "N/A"; }
    }

    function objectKey(obj) {
        if (obj === null || obj === undefined) { return ""; }
        try { return String(obj.toSpecifier()); } catch (e) {}
        try { return typeName(obj) + ":" + String(obj.id); } catch (e2) {}
        return "";
    }

    function preview(s) {
        var out = String(s || "").replace(/[\r\n\t]+/g," ").replace(/  +/g," ");
        if (out.length > 160) { out = out.substring(0,157) + "..."; }
        return out;
    }

    function indent(n) {
        var s = "", i;
        for (i = 0; i < n; i++) { s += "  "; }
        return s;
    }

    function errorText(e) {
        var msg = "";
        try { msg = String(e.message || e); } catch (ignore) { msg = "<error>"; }
        try { if (e.number !== undefined) { msg += " (#" + e.number + ")"; } } catch (ignoreN) {}
        return msg;
    }

    function log(s) { lines.push(String(s)); }

    function stamp() {
        var d = new Date();
        function two(n) { return n < 10 ? "0" + n : String(n); }
        return d.getFullYear() + two(d.getMonth()+1) + two(d.getDate()) + "-" +
            two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
    }

    function saveReport() {
        var desktop = Folder.desktop;
        var file = File(desktop.fsName + "/StyleFix_Location_Probe_" + stamp() + ".txt");
        file.encoding = "UTF-8";
        if (!file.open("w")) {
            alert("StyleFix Location Probe\n\nCould not open report file for writing:\n" + file.fsName);
            return;
        }
        for (i = 0; i < lines.length; i++) { file.writeln(lines[i]); }
        file.close();
        alert("StyleFix Location Probe complete.\n\n" + file.fsName);
    }
}());
