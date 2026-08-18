#target "InDesign"

 /*
 StyleFix Canary Fixture Builder v1.0.5

 Creates a NEW scratch document containing the positive, dependency-only,
 formatting/export, cross-class, and book-scope controls defined in
 "StyleFix Canary Test.md".

 It never edits the active production document.

 The builder is deliberately fail-closed: every control is attempted inside
 its own guarded step and the final build log lists PASS/FAIL. A fixture with
 any failed construction step is not a valid canary fixture.
 ExtendScript / ECMAScript 3 compatible.
 */

(function () {
    var VERSION = "1.0.5";
    var log = [];
    var failed = 0;
    var doc = null;
    var page1, mainLayer;
    var styles = {};
    var canonical = {};

    try {
        doc = app.documents.add(true);
        doc.documentPreferences.facingPages = false;
        while (doc.pages.length < 6) { doc.pages.add(); }
        page1 = doc.pages.item(0);
        mainLayer = doc.layers.item(0);

        step("BASE", function () {
            createStyles();
            createCanonicalStyles();
            createParagraphCensus();
        });

        step("C01 ordinary story text", buildC01);
        step("C02 table cell", buildC02);
        step("C03 nested table cell", buildC03);
        step("C04 footnote text", buildC04);
        step("C05 endnote text", buildC05);
        step("C06 overset text", buildC06);
        step("C07 pasteboard text frame", buildC07);
        step("C08 parent/master page text frame", buildC08);
        step("C09 anchored inline text frame", buildC09);
        step("C10 grouped text frame", buildC10);
        step("C11 hidden-layer text frame", buildC11);
        step("C12 locked-layer text frame", buildC12);
        step("C13 threaded three-page story", buildC13);
        step("C14 table on parent/master page", buildC14);

        step("D01 bullet character-style dependency", buildD01);
        step("D02 nested GREP dependency", buildD02);
        step("D03 TOC page-number dependency", buildD03);
        step("D04 cross-reference building-block dependency", buildD04);
        step("D05 hyperlink text-source dependency", buildD05);
        step("D06 footnote marker dependency", buildD06);
        step("D07 basedOn dependency", buildD07);

        step("E01 empty-shell negative control", function () {});
        step("E02 export-tag mapping", buildE02);

        step("F01 unused single canonical match", function () {});
        step("F02 used single canonical match", buildF02);
        step("F03 used tracking mismatch", buildF03);
        step("F04 used duplicate canonical match", buildF04);

        step("P01 paragraph-style census control", function () {});

        finalize();
    } catch (fatal) {
        alert("StyleFix Canary Builder v" + VERSION + "\n\nFATAL BUILD ERROR\n\n" + errText(fatal));
    }

    function createStyles() {
        var ids = [
            "C01","C02","C03","C04","C05","C06","C07","C08","C09","C10","C11","C12","C13","C14",
            "D01","D02","D03","D04","D05","D06","D07",
            "E01","E02","F01","F02","F03","F04"
        ];
        var i;
        for (i = 0; i < ids.length; i++) {
            styles[ids[i]] = doc.characterStyles.add({name:"Unnamed Style " + ids[i]});
        }

        styles.F01.pointSize = 12;
        styles.F01.tracking = 10;
        styles.F02.pointSize = 13;
        styles.F02.tracking = 20;
        styles.F03.pointSize = 14;
        styles.F03.tracking = 11;
        styles.F04.pointSize = 15;
        styles.F04.tracking = 30;
    }

    function createCanonicalStyles() {
        canonical.F01 = doc.characterStyles.add({name:"Canary Canonical F01", pointSize:12, tracking:10});
        canonical.F02 = doc.characterStyles.add({name:"Canary Canonical F02", pointSize:13, tracking:20});
        canonical.F03 = doc.characterStyles.add({name:"Canary Canonical F03", pointSize:14, tracking:10});
        canonical.F04A = doc.characterStyles.add({name:"Canary Canonical F04 A", pointSize:15, tracking:30});
        canonical.F04B = doc.characterStyles.add({name:"Canary Canonical F04 B", pointSize:15, tracking:30});
    }

    function createParagraphCensus() {
        doc.paragraphStyles.add({name:"Unnamed Style P01"});
    }

    function buildC01() {
        var tf = addFrame(page1, [36,36,72,300], "C01 ordinary story text");
        applyAll(tf.parentStory, styles.C01);
    }

    function buildC02() {
        var tf = addFrame(page1, [84,36,144,300], "");
        var table = tf.insertionPoints.item(0).tables.add({bodyRowCount:1, columnCount:1});
        var cell = table.cells.item(0);
        cell.contents = "C02 table cell";
        applyAll(cell.texts.item(0), styles.C02);
    }

    function buildC03() {
        var tf = addFrame(page1, [156,36,240,300], "");
        var outer = tf.insertionPoints.item(0).tables.add({bodyRowCount:1, columnCount:1});
        var cell = outer.cells.item(0);
        cell.contents = "";
        var nested = cell.insertionPoints.item(0).tables.add({bodyRowCount:1, columnCount:1});
        var nestedCell = nested.cells.item(0);
        nestedCell.contents = "C03 nested table cell";
        applyAll(nestedCell.texts.item(0), styles.C03);
    }

    function buildC04() {
        var tf = addFrame(page1, [252,36,324,300], "C04 host text ");
        var ip = tf.parentStory.insertionPoints.item(-1);
        var fn = tf.parentStory.footnotes.add(LocationOptions.AFTER, ip);
        fn.contents = "C04 footnote text";
        applyAll(fn.texts.item(0), styles.C04);
    }

    function buildC05() {
        var tf = addFrame(doc.pages.item(1), [36,36,108,300], "C05 host text ");
        var ip = tf.parentStory.insertionPoints.item(-1);
        try { doc.endnoteOptions.frameCreateOption = EndnoteFrameCreate.NEW_PAGE; } catch (eOption) {}
        var en = ip.createEndnote();
        var wrote = false;
        try { en.texts.item(0).contents = "C05 endnote text"; wrote = true; } catch (eSet) {}
        if (!wrote) {
            try { en.insertTextInEndnote(en.insertionPoints.item(0), "C05 endnote text"); wrote = true; } catch (eInsert) {}
        }
        if (!wrote) { throw new Error("Could not insert endnote text."); }
        applyAll(en.texts.item(0), styles.C05);
    }

    function buildC06() {
        var tf = addFrame(doc.pages.item(1), [120,36,145,220], "");
        var filler = "", i;
        for (i = 0; i < 120; i++) { filler += "overset filler line " + i + "\r"; }
        filler += "C06 OVERSET CANARY";
        tf.contents = filler;
        if (!tf.parentStory.overflows) { throw new Error("C06 frame did not overflow as expected."); }
        applyLastLiteral(tf.parentStory, "C06 OVERSET CANARY", styles.C06);
    }

    function buildC07() {
        var spread = doc.spreads.item(0);
        var tf = spread.textFrames.add(mainLayer);
        tf.geometricBounds = [36, 700, 72, 950];
        tf.contents = "C07 pasteboard text frame";
        applyAll(tf.parentStory, styles.C07);
    }

    function buildC08() {
        var ms = doc.masterSpreads.item(0);
        var mp = ms.pages.item(0);
        var tf = addFrame(mp, [36,36,72,300], "C08 parent page text frame");
        applyAll(tf.parentStory, styles.C08);
    }

    function buildC09() {
        var host = addFrame(doc.pages.item(1), [170,36,250,300], "C09 host ");
        var child = doc.pages.item(1).textFrames.add(mainLayer);
        child.geometricBounds = [260,36,300,180];
        child.contents = "C09 anchored inline frame";
        applyAll(child.parentStory, styles.C09);
        child.anchoredObjectSettings.insertAnchoredObject(host.parentStory.insertionPoints.item(-1), AnchorPosition.INLINE_POSITION);
    }

    function buildC10() {
        var p = doc.pages.item(1);
        var tf = addFrame(p, [320,36,360,220], "C10 grouped text frame");
        applyAll(tf.parentStory, styles.C10);
        var rect = p.rectangles.add(mainLayer);
        rect.geometricBounds = [365,36,390,80];
        p.groups.add([tf, rect]);
    }

    function buildC11() {
        var layer = doc.layers.add({name:"Canary Hidden Layer", visible:true, locked:false});
        var tf = doc.pages.item(2).textFrames.add(layer);
        tf.geometricBounds = [36,36,72,300];
        tf.contents = "C11 hidden layer text";
        applyAll(tf.parentStory, styles.C11);
        layer.visible = false;
    }

    function buildC12() {
        var layer = doc.layers.add({name:"Canary Locked Layer", visible:true, locked:false});
        var tf = doc.pages.item(2).textFrames.add(layer);
        tf.geometricBounds = [84,36,120,300];
        tf.contents = "C12 locked layer text";
        applyAll(tf.parentStory, styles.C12);
        layer.locked = true;
    }

    function buildC13() {
        var p3 = doc.pages.item(2), p4 = doc.pages.item(3), p5 = doc.pages.item(4);
        var a = addFrame(p3, [150,36,310,300], "");
        var b = addFrame(p4, [36,36,196,300], "");
        var c = addFrame(p5, [36,36,196,300], "");
        a.nextTextFrame = b;
        b.nextTextFrame = c;
        var content = "", i;
        for (i = 0; i < 100; i++) { content += "C13 threaded story line " + i + " lorem ipsum dolor sit amet.\r"; }
        a.contents = content;
        applyAll(a.parentStory, styles.C13);
        if (!a.parentStory.overflows && countStoryFrames(a.parentStory) < 3) {
            throw new Error("C13 did not resolve as a three-frame threaded story.");
        }
    }

    function buildC14() {
        var ms = doc.masterSpreads.item(0), mp = ms.pages.item(0);
        var tf = addFrame(mp, [100,36,180,300], "");
        var table = tf.insertionPoints.item(0).tables.add({bodyRowCount:1, columnCount:1});
        var cell = table.cells.item(0);
        cell.contents = "C14 table on parent page";
        applyAll(cell.texts.item(0), styles.C14);
    }

    function buildD01() {
        var ps = doc.paragraphStyles.add({name:"Canary D01 Bullet"});
        ps.bulletsCharacterStyle = styles.D01;
    }

    function buildD02() {
        var ps = doc.paragraphStyles.add({name:"Canary D02 GREP"});
        ps.nestedGrepStyles.add({appliedCharacterStyle:styles.D02, grepExpression:"CANARY_D02"});
    }

    function buildD03() {
        var source = doc.paragraphStyles.add({name:"Canary D03 TOC Source"});
        var toc = doc.tocStyles.add({name:"Canary D03 TOC"});
        toc.tocStyleEntries.add(source.name, {pageNumberStyle:styles.D03});
    }

    function buildD04() {
        var fmt = doc.crossReferenceFormats.add("Canary D04 Format");
        fmt.buildingBlocks.add(BuildingBlockTypes.CUSTOM_STRING_BUILDING_BLOCK, styles.D04, "D04");
    }

    function buildD05() {
        var tf = addFrame(doc.pages.item(5), [36,36,72,300], "D05 hyperlink source text");
        var txt = tf.parentStory.texts.item(0);
        doc.hyperlinkTextSources.add(txt, {appliedCharacterStyle:styles.D05});
    }

    function buildD06() { doc.footnoteOptions.footnoteMarkerStyle = styles.D06; }

    function buildD07() {
        doc.characterStyles.add({name:"Canary Child Based On D07", basedOn:styles.D07, pointSize:9});
    }

    function buildE02() {
        var maps = styles.E02.styleExportTagMaps;
        maps.add("EPUB", "span", "canary-e02", "");
    }

    function buildF02() {
        var tf = addFrame(doc.pages.item(5), [84,36,120,300], "F02 used single match");
        applyAll(tf.parentStory, styles.F02);
    }

    function buildF03() {
        var tf = addFrame(doc.pages.item(5), [132,36,168,300], "F03 tracking mismatch");
        applyAll(tf.parentStory, styles.F03);
    }

    function buildF04() {
        var tf = addFrame(doc.pages.item(5), [180,36,216,300], "F04 duplicate canonical match");
        applyAll(tf.parentStory, styles.F04);
    }

    function addFrame(container, bounds, contents) {
        var tf = container.textFrames.add(mainLayer);
        tf.geometricBounds = bounds;
        tf.contents = contents;
        return tf;
    }

    function applyAll(textObj, style) { textObj.applyCharacterStyle(style); }

    function applyLastLiteral(story, literal, style) {
        var full = String(story.contents);
        var idx = full.lastIndexOf(literal);
        if (idx < 0) { throw new Error("Literal not found: " + literal); }
        var from = story.characters.item(idx);
        var to = story.characters.item(idx + literal.length - 1);
        story.characters.itemByRange(from, to).applyCharacterStyle(style);
    }

    function countStoryFrames(story) {
        var frames;
        try { frames = story.textContainers; return frames.length; } catch (e) { return 0; }
    }

    function step(name, fn) {
        try { fn(); log.push("PASS\t" + name); }
        catch (e) { failed++; log.push("FAIL\t" + name + "\t" + errText(e)); }
    }

    function finalize() {
        var target = new File(Folder.desktop.fsName + "/StyleFix_Canary_v" + VERSION.replace(/\./g, "_") + ".indd");
        var logFile = new File(Folder.desktop.fsName + "/StyleFix_Canary_Build_v" + VERSION.replace(/\./g, "_") + ".txt");
        var i;
        try { doc.save(target); log.push("PASS\tSAVE\t" + target.fsName); }
        catch (eSave) { failed++; log.push("FAIL\tSAVE\t" + errText(eSave)); }

        logFile.encoding = "UTF-8";
        logFile.lineFeed = "Windows";
        if (logFile.open("w")) {
            logFile.writeln("StyleFix Canary Fixture Builder v" + VERSION);
            logFile.writeln("InDesign version: " + safeApp("version"));
            logFile.writeln("InDesign build: " + safeApp("buildNumber"));
            logFile.writeln("Timestamp: " + (new Date()).toString());
            logFile.writeln("");
            for (i = 0; i < log.length; i++) { logFile.writeln(log[i]); }
            logFile.writeln("");
            logFile.writeln("FAILED STEPS: " + failed);
            logFile.close();
        }

        if (failed === 0) {
            alert("StyleFix canary fixture built successfully.\n\nDocument:\n" + target.fsName +
                "\n\nBuild log:\n" + logFile.fsName +
                "\n\nRun StyleFix v" + VERSION + " against this fixture and compare the CSV with CANARY_EXPECTED.csv.");
        } else {
            alert("StyleFix canary fixture is INCOMPLETE.\n\n" + failed + " construction step(s) failed.\n\n" +
                "Do not use this fixture as release evidence.\n\nBuild log:\n" + logFile.fsName);
        }
    }

    function safeApp(prop) { try { return String(app[prop]); } catch (e) { return ""; } }

    function errText(e) {
        var a = [];
        try { if (e.message) { a.push(String(e.message)); } } catch (x) {}
        try { if (e.number !== undefined) { a.push("Error " + e.number); } } catch (x2) {}
        try { if (e.line !== undefined) { a.push("line " + e.line); } } catch (x3) {}
        return a.join(" | ");
    }
}());
