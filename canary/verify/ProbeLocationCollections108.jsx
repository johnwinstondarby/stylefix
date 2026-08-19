#target "InDesign"

/*
StyleFix v1.0.8 final location probe.
Read-only. Uses length/item enumeration first so it does not rely on everyItem().getElements().
*/

(function () {
    var VERSION = "1.0.0";
    var TARGETS = {C09:true,C10:true,C12:true,C13:true,C14:true};
    var doc, lines = [], hits = {}, i;

    if (app.documents.length === 0) {
        alert("Open StyleFix_Canary_v1_0_7.indd first.");
        return;
    }
    doc = app.activeDocument;
    for (i in TARGETS) { if (TARGETS.hasOwnProperty(i)) { hits[i] = 0; } }

    log("StyleFix Final Location Probe");
    log("=============================");
    log("Version: " + VERSION);
    log("Document: " + safe(function(){return doc.name;},"ERR"));
    log("");

    dumpDocumentPages();
    dumpMasterPages();
    scanStories();
    scanMasterStories();

    log("");
    log("Summary");
    log("-------");
    for (i in TARGETS) { if (TARGETS.hasOwnProperty(i)) { log(i + " hits=" + hits[i]); } }
    save();

    function dumpDocumentPages() {
        var pages = items(doc.pages), p;
        log("Document pages: " + pages.length);
        for (p = 0; p < pages.length; p++) {
            log("  page[" + p + "] name=" + safeProp(pages[p],"name") +
                "; bounds=" + bounds(pages[p]) +
                "; parent=" + summary(safeObj(function(){return pages[p].parent;})));
        }
        log("");
    }

    function dumpMasterPages() {
        var masters = items(doc.masterSpreads), m, pages, p;
        log("Master spreads: " + masters.length);
        for (m = 0; m < masters.length; m++) {
            pages = items(masters[m].pages);
            log("  master[" + m + "] name=" + safeProp(masters[m],"name") + "; pages=" + pages.length);
            for (p = 0; p < pages.length; p++) {
                log("    masterPage[" + p + "] name=" + safeProp(pages[p],"name") +
                    "; bounds=" + bounds(pages[p]) +
                    "; parent=" + summary(safeObj(function(){return pages[p].parent;})));
            }
        }
        log("");
    }

    function scanStories() {
        var stories = items(doc.stories), s;
        log("Document.stories item-enumerated: " + stories.length);
        for (s = 0; s < stories.length; s++) { scanTextContainer(stories[s],"Story[" + s + "]",0); }
    }

    function scanMasterStories() {
        var masters = items(doc.masterSpreads), m, pages, p, frames, f;
        log("");
        log("Master page story scan");
        for (m = 0; m < masters.length; m++) {
            pages = items(masters[m].pages);
            for (p = 0; p < pages.length; p++) {
                frames = items(pages[p].textFrames);
                log("  master=" + safeProp(masters[m],"name") + " page=" + safeProp(pages[p],"name") + " textFrames=" + frames.length);
                for (f = 0; f < frames.length; f++) {
                    scanTextContainer(frames[f].parentStory,"Master["+m+"].Page["+p+"].Frame["+f+"]",0);
                }
            }
        }
    }

    function scanTextContainer(container,label,tableDepth) {
        var ranges = items(safeObj(function(){return container.textStyleRanges;}));
        var tables = items(safeObj(function(){return container.tables;}));
        var r, t;
        for (r = 0; r < ranges.length; r++) { inspectRange(ranges[r],label + ".range[" + r + "]",tableDepth); }
        for (t = 0; t < tables.length; t++) { scanTable(tables[t],label + ".table[" + t + "]",tableDepth + 1); }
    }

    function scanTable(table,label,tableDepth) {
        var cells = items(table.cells), c, texts;
        for (c = 0; c < cells.length; c++) {
            texts = items(cells[c].texts);
            if (texts.length > 0) { scanTextContainer(texts[0],label + ".cell[" + c + "]",tableDepth); }
        }
    }

    function inspectRange(range,label,tableDepth) {
        var style = safeObj(function(){return range.appliedCharacterStyle;});
        var name = safeProp(style,"name"), id, frames, f;
        if (name.indexOf("Unnamed Style ") !== 0) { return; }
        id = name.substring("Unnamed Style ".length);
        if (TARGETS[id] !== true) { return; }
        hits[id]++;
        log("");
        log("=== " + id + " HIT " + hits[id] + " ===");
        log("label=" + label + "; tableDepth=" + tableDepth + "; chars=" + safe(function(){return String(range.contents).length;},"ERR"));
        log("range.parent=" + summary(safeObj(function(){return range.parent;})));
        frames = arrayLike(safeObj(function(){return range.parentTextFrames;}));
        log("range.parentTextFrames=" + frames.length);
        for (f = 0; f < frames.length; f++) { inspectFrame(frames[f],"range.frame["+f+"]"); }
        inspectStory(range);
        traceParentChain(range);
    }

    function inspectStory(range) {
        var story = safeObj(function(){return range.parentStory;}), frames, f;
        log("range.parentStory=" + summary(story));
        if (!story) { return; }
        frames = arrayLike(safeObj(function(){return story.textContainers;}));
        log("story.textContainers=" + frames.length);
        for (f = 0; f < frames.length; f++) { inspectFrame(frames[f],"story.frame["+f+"]"); }
    }

    function inspectFrame(frame,label) {
        var parent = safeObj(function(){return frame.parent;});
        var parentPage = safeObj(function(){return frame.parentPage;});
        log(label + "=" + summary(frame) + "; bounds=" + bounds(frame) +
            "; parentPage=" + summary(parentPage) + "; parent=" + summary(parent));
        inferByOwningPages(frame,label);
        if (typeName(parent) === "Character" || typeName(parent) === "InsertionPoint") {
            var hosts = arrayLike(safeObj(function(){return parent.parentTextFrames;})), h;
            log(label + ".hostFrames=" + hosts.length);
            for (h = 0; h < hosts.length; h++) {
                log(label + ".host["+h+"]=" + summary(hosts[h]) + "; bounds=" + bounds(hosts[h]) +
                    "; parentPage=" + summary(safeObjFactory(hosts[h],"parentPage")));
                inferByOwningPages(hosts[h],label + ".host["+h+"]");
            }
        }
    }

    function inferByOwningPages(obj,label) {
        var container = ancestorPageContainer(obj), pages, b, i, area, best = null, bestArea = 0;
        if (!container) { log(label + ".inferred=<no Spread/MasterSpread ancestor>"); return; }
        pages = items(container.pages);
        b = boundsArray(obj);
        log(label + ".owner=" + summary(container) + "; owner.pages=" + pages.length);
        for (i = 0; i < pages.length; i++) {
            area = overlap(b,boundsArray(pages[i]));
            log(label + ".owner.page["+i+"] name=" + safeProp(pages[i],"name") + "; bounds=" + bounds(pages[i]) + "; overlap=" + area);
            if (area > bestArea) { bestArea = area; best = pages[i]; }
        }
        log(label + ".inferred=" + (best ? safeProp(best,"name") : "<none>") + "; overlap=" + bestArea);
    }

    function ancestorPageContainer(obj) {
        var current = obj, parent, depth = 0, t;
        while (current && depth < 16) {
            t = typeName(current);
            if (t === "Spread" || t === "MasterSpread") { return current; }
            parent = safeObj(function(){return current.parent;});
            if (!parent || parent === current) { return null; }
            current = parent;
            depth++;
        }
        return null;
    }

    function traceParentChain(obj) {
        var current = obj, parent, d = 0;
        log("parent chain:");
        while (current && d < 12) {
            log("  " + d + ": " + summary(current));
            parent = safeObj(function(){return current.parent;});
            if (!parent || parent === current) { break; }
            current = parent;
            d++;
        }
    }

    function items(collection) {
        var out = [], len = 0, i, item;
        if (!collection) { return out; }
        try { len = Number(collection.length); } catch (eLen) { len = 0; }
        if (isNaN(len) || len < 0) { len = 0; }
        for (i = 0; i < len; i++) {
            item = null;
            try {
                if (typeof collection.item === "function") { item = collection.item(i); }
                else { item = collection[i]; }
            } catch (eItem) {}
            if (item) { out.push(item); }
        }
        return out;
    }

    function arrayLike(value) {
        var out = [], len = 0, i;
        if (!value) { return out; }
        try { len = Number(value.length); } catch (e) { len = 0; }
        if (isNaN(len) || len < 0) { len = 0; }
        for (i = 0; i < len; i++) {
            try { out.push(typeof value.item === "function" ? value.item(i) : value[i]); } catch (ignore) {}
        }
        return out;
    }

    function boundsArray(obj) {
        var b = safeObj(function(){return obj.geometricBounds;});
        if (!b) { b = safeObj(function(){return obj.bounds;}); }
        if (!b || b.length === undefined || b.length < 4) { return null; }
        return [Number(b[0]),Number(b[1]),Number(b[2]),Number(b[3])];
    }

    function bounds(obj) { var b = boundsArray(obj); return b ? "["+b.join(",")+"]" : "N/A"; }
    function overlap(a,b) {
        var top,left,bottom,right;
        if (!a || !b) { return 0; }
        top=Math.max(a[0],b[0]); left=Math.max(a[1],b[1]); bottom=Math.min(a[2],b[2]); right=Math.min(a[3],b[3]);
        return (bottom>top && right>left) ? (bottom-top)*(right-left) : 0;
    }

    function safeObj(fn) { try { var v=fn(); return v===undefined ? null : v; } catch(e) { return null; } }
    function safeObjFactory(obj,prop) { return safeObj(function(){return obj[prop];}); }
    function safe(fn,fallback) { try { var v=fn(); return (v===null||v===undefined)?fallback:String(v); } catch(e) { return fallback; } }
    function safeProp(obj,prop) { return obj ? safe(function(){return obj[prop];},"") : ""; }
    function typeName(obj) { if (!obj) { return "<null>"; } try { if (obj.reflect&&obj.reflect.name) {return String(obj.reflect.name);} } catch(e){} try {if(obj.constructor&&obj.constructor.name){return String(obj.constructor.name);}}catch(e2){} return typeof obj; }
    function summary(obj) { if (!obj) { return "<null>"; } return typeName(obj)+"{name="+safeProp(obj,"name")+";id="+safeProp(obj,"id")+";spec="+safe(function(){return obj.toSpecifier();},"N/A")+"}"; }
    function log(s) { lines.push(String(s)); }
    function stamp() { var d=new Date(); function two(n){return n<10?"0"+n:String(n);} return d.getFullYear()+two(d.getMonth()+1)+two(d.getDate())+"-"+two(d.getHours())+two(d.getMinutes())+two(d.getSeconds()); }
    function save() {
        var f=File(Folder.desktop.fsName+"/StyleFix_Location_Collections_"+stamp()+".txt");
        f.encoding="UTF-8";
        if(!f.open("w")){alert("Could not write report: "+f.fsName);return;}
        for(i=0;i<lines.length;i++){f.writeln(lines[i]);}
        f.close();
        alert("StyleFix final location probe complete.\n\n"+f.fsName);
    }
}());
