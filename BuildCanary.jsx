#target "InDesign"

/*
StyleFix Canary Fixture Builder v1.0.6

Creates a NEW scratch document for the StyleFix acceptance harness.

The builder has its own verification path. It does not call, import, or reuse
StyleFix's usage-traversal functions. Each control is registered from the exact
object created during construction and is read back directly from that object.

The builder emits:
  - StyleFix_Canary_v1_0_6.indd
  - StyleFix_Canary_v1_0_6.idml
  - StyleFix_Canary_Build_v1_0_6.txt
  - StyleFix_Canary_Census_v1_0_6.csv

A fixture with any failed construction or read-back verification is invalid.
*/

(function () {
    var VERSION = "1.0.6";
    var FIXTURE_SCHEMA = "1";
    var FIXTURE_ID = "StyleFix-Canary-" + stamp();
    var log = [];
    var controls = [];
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
            writeFixtureLabels();
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

        step("E01 empty-shell negative control", buildE01);
        step("E02 export-tag mapping", buildE02);

        step("F01 unused single canonical match", buildF01);
        step("F02 used single canonical match", buildF02);
        step("F03 used tracking mismatch", buildF03);
        step("F04 used duplicate canonical match", buildF04);

        step("P01 paragraph-style census control", buildP01Record);

        verifyRegisteredControls();
        finalize();
    } catch (fatal) {
        alert("StyleFix Canary Builder v" + VERSION +
            "\n\nFATAL BUILD ERROR\n\n" + errText(fatal));
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
        canonical.F01 = doc.characterStyles.add({
            name:"Canary Canonical F01", pointSize:12, tracking:10
        });
        canonical.F02 = doc.characterStyles.add({
            name:"Canary Canonical F02", pointSize:13, tracking:20
        });
        canonical.F03 = doc.characterStyles.add({
            name:"Canary Canonical F03", pointSize:14, tracking:10
        });
        canonical.F04A = doc.characterStyles.add({
            name:"Canary Canonical F04 A", pointSize:15, tracking:30
        });
        canonical.F04B = doc.characterStyles.add({
            name:"Canary Canonical F04 B", pointSize:15, tracking:30
        });
    }

    function createParagraphCensus() {
        styles.P01 = doc.paragraphStyles.add({name:"Unnamed Style P01"});
    }

    function writeFixtureLabels() {
        doc.insertLabel("StyleFixFixtureVersion", VERSION);
        doc.insertLabel("StyleFixFixtureSchema", FIXTURE_SCHEMA);
        doc.insertLabel("StyleFixFixtureId", FIXTURE_ID);
        doc.insertLabel("StyleFixFixtureExpectedDirect", "14");
        doc.insertLabel("StyleFixFixtureExpectedDependency", "7");
        doc.insertLabel("StyleFixFixtureExpectedControls", "28");
    }

    function buildC01() {
        var tf = addFrame(page1, [36,36,72,300], "C01 ordinary story text");
        applyAll(tf.parentStory, styles.C01);
        registerDirect("C01","Ordinary story",tf.parentStory,styles.C01,"C01 ordinary story text");
    }

    function buildC02() {
        var tf = addFrame(page1, [84,36,144,300], "");
        var table = tf.insertionPoints.item(0).tables.add({bodyRowCount:1,columnCount:1});
        var cell = table.cells.item(0);
        cell.contents = "C02 table cell";
        applyAll(cell.texts.item(0), styles.C02);
        registerDirect("C02","Table cell",cell.texts.item(0),styles.C02,"C02 table cell");
    }

    function buildC03() {
        var tf = addFrame(page1, [156,36,240,300], "");
        var outer = tf.insertionPoints.item(0).tables.add({bodyRowCount:1,columnCount:1});
        var cell = outer.cells.item(0);
        cell.contents = "";
        var nested = cell.insertionPoints.item(0).tables.add({bodyRowCount:1,columnCount:1});
        var nestedCell = nested.cells.item(0);
        nestedCell.contents = "C03 nested table cell";
        applyAll(nestedCell.texts.item(0), styles.C03);
        registerDirect("C03","Nested table cell",nestedCell.texts.item(0),styles.C03,"C03 nested table cell");
    }

    function buildC04() {
        var tf = addFrame(page1, [252,36,324,300], "C04 host text ");
        var ip = tf.parentStory.insertionPoints.item(-1);
        var fn = tf.parentStory.footnotes.add(LocationOptions.AFTER, ip);
        fn.contents = "C04 footnote text";
        applyAll(fn.texts.item(0), styles.C04);
        registerDirect("C04","Footnote text",fn.texts.item(0),styles.C04,"C04 footnote text");
    }

    function buildC05() {
        var tf = addFrame(doc.pages.item(1), [36,36,108,300], "C05 host text ");
        var ip = tf.parentStory.insertionPoints.item(-1);
        var en, wrote = false, text;
        try { doc.endnoteOptions.frameCreateOption = EndnoteFrameCreate.NEW_PAGE; } catch (eOption) {}
        en = ip.createEndnote();

        try {
            en.texts.item(0).contents = "C05 endnote text";
            wrote = true;
        } catch (eSet) {}

        if (!wrote) {
            try {
                en.insertTextInEndnote(en.insertionPoints.item(0), "C05 endnote text");
                wrote = true;
            } catch (eInsert) {}
        }
        if (!wrote) { throw new Error("Could not insert endnote text."); }

        text = en.texts.item(0);
        applyAll(text, styles.C05);
        registerDirect("C05","Endnote text",text,styles.C05,"C05 endnote text");
    }

    function buildC06() {
        var tf = addFrame(doc.pages.item(1), [120,36,145,220], "");
        var filler = "", i, range;
        for (i = 0; i < 120; i++) {
            filler += "overset filler line " + i + "\r";
        }
        filler += "C06 OVERSET CANARY";
        tf.contents = filler;
        if (!tf.parentStory.overflows) {
            throw new Error("C06 frame did not overflow as expected.");
        }
        range = applyLastLiteral(tf.parentStory, "C06 OVERSET CANARY", styles.C06);
        registerDirect("C06","Overset text",range,styles.C06,"C06 OVERSET CANARY");
    }

    function buildC07() {
        var spread = doc.spreads.item(0);
        var tf = spread.textFrames.add(mainLayer);
        tf.geometricBounds = [36,700,72,950];
        tf.contents = "C07 pasteboard text frame";
        applyAll(tf.parentStory, styles.C07);
        registerDirect("C07","Pasteboard text frame",tf.parentStory,styles.C07,"C07 pasteboard text frame");
    }

    function buildC08() {
        var ms = doc.masterSpreads.item(0);
        var mp = ms.pages.item(0);
        var tf = addFrame(mp, [36,36,72,300], "C08 parent page text frame");
        applyAll(tf.parentStory, styles.C08);
        registerDirect("C08","Parent/master page text frame",tf.parentStory,styles.C08,"C08 parent page text frame");
    }

    function buildC09() {
        var host = addFrame(doc.pages.item(1), [170,36,250,300], "C09 host ");
        var child = doc.pages.item(1).textFrames.add(mainLayer);
        child.geometricBounds = [260,36,300,180];
        child.contents = "C09 anchored inline frame";
        applyAll(child.parentStory, styles.C09);
        child.anchoredObjectSettings.insertAnchoredObject(
            host.parentStory.insertionPoints.item(-1), AnchorPosition.INLINE_POSITION
        );
        registerDirect("C09","Anchored inline text frame",child.parentStory,styles.C09,"C09 anchored inline frame");
    }

    function buildC10() {
        var p = doc.pages.item(1);
        var tf = addFrame(p, [320,36,360,220], "C10 grouped text frame");
        var rect;
        applyAll(tf.parentStory, styles.C10);
        rect = p.rectangles.add(mainLayer);
        rect.geometricBounds = [365,36,390,80];
        p.groups.add([tf,rect]);
        registerDirect("C10","Grouped text frame",tf.parentStory,styles.C10,"C10 grouped text frame");
    }

    function buildC11() {
        var layer = doc.layers.add({name:"Canary Hidden Layer",visible:true,locked:false});
        var tf = doc.pages.item(2).textFrames.add(layer);
        tf.geometricBounds = [36,36,72,300];
        tf.contents = "C11 hidden layer text";
        applyAll(tf.parentStory, styles.C11);
        layer.visible = false;
        registerDirect("C11","Hidden-layer text frame",tf.parentStory,styles.C11,"C11 hidden layer text");
    }

    function buildC12() {
        var layer = doc.layers.add({name:"Canary Locked Layer",visible:true,locked:false});
        var tf = doc.pages.item(2).textFrames.add(layer);
        tf.geometricBounds = [84,36,120,300];
        tf.contents = "C12 locked layer text";
        applyAll(tf.parentStory, styles.C12);
        layer.locked = true;
        registerDirect("C12","Locked-layer text frame",tf.parentStory,styles.C12,"C12 locked layer text");
    }

    function buildC13() {
        var p3 = doc.pages.item(2), p4 = doc.pages.item(3), p5 = doc.pages.item(4);
        var a = addFrame(p3, [150,36,310,300], "");
        var b = addFrame(p4, [36,36,196,300], "");
        var c = addFrame(p5, [36,36,196,300], "");
        var content = "", i;

        a.nextTextFrame = b;
        b.nextTextFrame = c;

        for (i = 0; i < 100; i++) {
            content += "C13 threaded story line " + i + " lorem ipsum dolor sit amet.\r";
        }
        a.contents = content;
        applyAll(a.parentStory, styles.C13);

        if (countStoryFrames(a.parentStory) < 3) {
            throw new Error("C13 does not have three threaded text containers.");
        }
        registerDirect("C13","Threaded three-page story",a.parentStory,styles.C13,"C13 threaded story line");
    }

    function buildC14() {
        var ms = doc.masterSpreads.item(0), mp = ms.pages.item(0);
        var tf = addFrame(mp, [100,36,180,300], "");
        var table = tf.insertionPoints.item(0).tables.add({bodyRowCount:1,columnCount:1});
        var cell = table.cells.item(0);
        cell.contents = "C14 table on parent page";
        applyAll(cell.texts.item(0), styles.C14);
        registerDirect("C14","Table on parent/master page",cell.texts.item(0),styles.C14,"C14 table on parent page");
    }

    function buildD01() {
        var ps = doc.paragraphStyles.add({name:"Canary D01 Bullet"});
        ps.bulletsCharacterStyle = styles.D01;
        registerControl("D01","Dependency","Bullet character style",function () {
            return sameStyleDirect(ps.bulletsCharacterStyle, styles.D01);
        }, function () {
            return "bulletsCharacterStyle=" + directStyleName(ps.bulletsCharacterStyle);
        });
    }

    function buildD02() {
        var ps = doc.paragraphStyles.add({name:"Canary D02 GREP"});
        var ng = ps.nestedGrepStyles.add({
            appliedCharacterStyle:styles.D02,
            grepExpression:"CANARY_D02"
        });
        registerControl("D02","Dependency","Nested GREP style",function () {
            return sameStyleDirect(ng.appliedCharacterStyle, styles.D02);
        }, function () {
            return "appliedCharacterStyle=" + directStyleName(ng.appliedCharacterStyle);
        });
    }

    function buildD03() {
        var source = doc.paragraphStyles.add({name:"Canary D03 TOC Source"});
        var toc = doc.tocStyles.add({name:"Canary D03 TOC"});
        var entry = toc.tocStyleEntries.add(source.name,{pageNumberStyle:styles.D03});
        registerControl("D03","Dependency","TOC page-number style",function () {
            return sameStyleDirect(entry.pageNumberStyle, styles.D03);
        }, function () {
            return "pageNumberStyle=" + directStyleName(entry.pageNumberStyle);
        });
    }

    function buildD04() {
        var fmt = doc.crossReferenceFormats.add("Canary D04 Format");
        var bb = fmt.buildingBlocks.add(
            BuildingBlockTypes.CUSTOM_STRING_BUILDING_BLOCK, styles.D04, "D04"
        );
        registerControl("D04","Dependency","Cross-reference building block",function () {
            var ref = null;
            try { ref = bb.appliedCharacterStyle; } catch (e1) {}
            if (ref === null) { try { ref = bb.appliedStyle; } catch (e2) {} }
            return sameStyleDirect(ref, styles.D04);
        }, function () {
            var ref = null;
            try { ref = bb.appliedCharacterStyle; } catch (e1) {}
            if (ref === null) { try { ref = bb.appliedStyle; } catch (e2) {} }
            return "buildingBlockStyle=" + directStyleName(ref);
        });
    }

    function buildD05() {
        var tf = addFrame(doc.pages.item(5), [36,36,72,300], "D05 hyperlink source text");
        var txt = tf.parentStory.texts.item(0);
        var source = doc.hyperlinkTextSources.add(txt,{appliedCharacterStyle:styles.D05});
        registerControl("D05","Dependency","Hyperlink text source",function () {
            return sameStyleDirect(source.appliedCharacterStyle, styles.D05);
        }, function () {
            return "appliedCharacterStyle=" + directStyleName(source.appliedCharacterStyle);
        });
    }

    function buildD06() {
        doc.footnoteOptions.footnoteMarkerStyle = styles.D06;
        registerControl("D06","Dependency","Footnote marker style",function () {
            return sameStyleDirect(doc.footnoteOptions.footnoteMarkerStyle, styles.D06);
        }, function () {
            return "footnoteMarkerStyle=" + directStyleName(doc.footnoteOptions.footnoteMarkerStyle);
        });
    }

    function buildD07() {
        var child = doc.characterStyles.add({
            name:"Canary Child Based On D07",
            basedOn:styles.D07,
            pointSize:9
        });
        registerControl("D07","Dependency","Character-style basedOn",function () {
            return sameStyleDirect(child.basedOn, styles.D07);
        }, function () {
            return "basedOn=" + directStyleName(child.basedOn);
        });
    }

    function buildE01() {
        registerControl("E01","Formatting/export","Empty shell, no export map",function () {
            return exportMapCountDirect(styles.E01) === 0;
        }, function () {
            return "exportMaps=" + exportMapCountDirect(styles.E01);
        });
    }

    function buildE02() {
        var maps = styles.E02.styleExportTagMaps;
        maps.add("EPUB","span","canary-e02","");
        registerControl("E02","Formatting/export","Custom EPUB tag/class",function () {
            return exportMapCountDirect(styles.E02) >= 1;
        }, function () {
            return "exportMaps=" + exportMapCountDirect(styles.E02);
        });
    }

    function buildF01() {
        registerControl("F01","Fingerprint","Unused single canonical match",function () {
            return sameNumber(styles.F01.pointSize, canonical.F01.pointSize) &&
                sameNumber(styles.F01.tracking, canonical.F01.tracking);
        }, function () {
            return "candidate=" + styles.F01.pointSize + "/" + styles.F01.tracking +
                ";canonical=" + canonical.F01.pointSize + "/" + canonical.F01.tracking;
        });
    }

    function buildF02() {
        var tf = addFrame(doc.pages.item(5), [84,36,120,300], "F02 used single match");
        applyAll(tf.parentStory, styles.F02);
        registerControl("F02","Fingerprint","Used single canonical match",function () {
            return verifyTextDirect(tf.parentStory,styles.F02,"F02 used single match") &&
                sameNumber(styles.F02.pointSize,canonical.F02.pointSize) &&
                sameNumber(styles.F02.tracking,canonical.F02.tracking);
        }, function () {
            return directTextEvidence(tf.parentStory,styles.F02,"F02 used single match");
        });
    }

    function buildF03() {
        var tf = addFrame(doc.pages.item(5), [132,36,168,300], "F03 tracking mismatch");
        applyAll(tf.parentStory, styles.F03);
        registerControl("F03","Fingerprint","Tracking-only mismatch",function () {
            return verifyTextDirect(tf.parentStory,styles.F03,"F03 tracking mismatch") &&
                !sameNumber(styles.F03.tracking,canonical.F03.tracking);
        }, function () {
            return "candidateTracking=" + styles.F03.tracking +
                ";canonicalTracking=" + canonical.F03.tracking;
        });
    }

    function buildF04() {
        var tf = addFrame(doc.pages.item(5), [180,36,216,300], "F04 duplicate canonical match");
        applyAll(tf.parentStory, styles.F04);
        registerControl("F04","Fingerprint","Two canonical matches",function () {
            return verifyTextDirect(tf.parentStory,styles.F04,"F04 duplicate canonical match") &&
                sameNumber(styles.F04.pointSize,canonical.F04A.pointSize) &&
                sameNumber(styles.F04.tracking,canonical.F04A.tracking) &&
                sameNumber(styles.F04.pointSize,canonical.F04B.pointSize) &&
                sameNumber(styles.F04.tracking,canonical.F04B.tracking);
        }, function () {
            return "twoCanonicalMatches=" +
                canonical.F04A.name + "|" + canonical.F04B.name;
        });
    }

    function buildP01Record() {
        registerControl("P01","Paragraph census","Paragraph-style family boundary",function () {
            return styles.P01 && styles.P01.isValid === true &&
                String(styles.P01.name) === "Unnamed Style P01";
        }, function () {
            return "paragraphStyle=" + styles.P01.name;
        });
    }

    function registerDirect(id, context, textObj, style, literal) {
        registerControl(id,"Direct use",context,function () {
            return verifyTextDirect(textObj,style,literal);
        },function () {
            return directTextEvidence(textObj,style,literal);
        });
    }

    function registerControl(id, cls, context, verifyFn, evidenceFn) {
        controls.push({
            id:id,
            controlClass:cls,
            context:context,
            verify:verifyFn,
            evidence:evidenceFn,
            verified:false,
            evidenceText:""
        });
    }

    function verifyRegisteredControls() {
        var i, c, ok, evidence;
        var classCounts = {
            "Direct use":0,
            "Dependency":0,
            "Formatting/export":0,
            "Fingerprint":0,
            "Paragraph census":0
        };

        for (i = 0; i < controls.length; i++) {
            c = controls[i];
            ok = false;
            evidence = "";
            try {
                ok = c.verify() === true;
                evidence = c.evidence();
            } catch (eVerify) {
                ok = false;
                evidence = errText(eVerify);
            }
            c.verified = ok;
            c.evidenceText = evidence;
            if (ok && classCounts[c.controlClass] !== undefined) {
                classCounts[c.controlClass]++;
            }
            if (!ok) {
                failed++;
                log.push("FAIL\tVERIFY " + c.id + "\t" + c.context + "\t" + evidence);
            } else {
                log.push("PASS\tVERIFY " + c.id + "\t" + c.context + "\t" + evidence);
            }
        }

        requireCount("Direct-use census",classCounts["Direct use"],14);
        requireCount("Dependency census",classCounts["Dependency"],7);
        requireCount("Formatting/export census",classCounts["Formatting/export"],2);
        requireCount("Fingerprint census",classCounts["Fingerprint"],4);
        requireCount("Paragraph census",classCounts["Paragraph census"],1);
        requireCount("Total verified controls",
            classCounts["Direct use"] + classCounts["Dependency"] +
            classCounts["Formatting/export"] + classCounts["Fingerprint"] +
            classCounts["Paragraph census"],28);
    }

    function requireCount(label, actual, expected) {
        if (actual !== expected) {
            failed++;
            log.push("FAIL\t" + label + "\texpected=" + expected + "\tactual=" + actual);
        } else {
            log.push("PASS\t" + label + "\t" + actual);
        }
    }

    function verifyTextDirect(textObj, style, literal) {
        var chars, firstStyle, lastStyle, contents;
        if (!textObj || textObj.isValid !== true) { return false; }

        try {
            contents = String(textObj.contents);
            if (contents.indexOf(literal) < 0) { return false; }
        } catch (eContents) { return false; }

        try {
            chars = textObj.characters;
            if (chars.length < 1) { return false; }
            firstStyle = chars.item(0).appliedCharacterStyle;
            lastStyle = chars.item(-1).appliedCharacterStyle;
            return sameStyleDirect(firstStyle,style) && sameStyleDirect(lastStyle,style);
        } catch (eChars) {
            return false;
        }
    }

    function directTextEvidence(textObj, style, literal) {
        var contents = "", firstName = "", lastName = "", count = 0;
        try { contents = String(textObj.contents); } catch (eContents) {}
        try {
            count = textObj.characters.length;
            if (count > 0) {
                firstName = directStyleName(textObj.characters.item(0).appliedCharacterStyle);
                lastName = directStyleName(textObj.characters.item(-1).appliedCharacterStyle);
            }
        } catch (eChars) {}
        return "literal=" + (contents.indexOf(literal) >= 0 ? "YES" : "NO") +
            ";chars=" + count +
            ";firstStyle=" + firstName +
            ";lastStyle=" + lastName +
            ";expected=" + directStyleName(style);
    }

    function sameStyleDirect(a,b) {
        if (!a || !b) { return false; }
        try { return String(a.id) === String(b.id); } catch (eId) {}
        try { return String(a.name) === String(b.name); } catch (eName) {}
        return false;
    }

    function directStyleName(style) {
        if (!style) { return ""; }
        try { return String(style.name); } catch (e) { return ""; }
    }

    function exportMapCountDirect(style) {
        try { return style.styleExportTagMaps.length; } catch (e) { return -1; }
    }

    function sameNumber(a,b) {
        return Math.abs(Number(a) - Number(b)) < 0.0001;
    }

    function addFrame(container,bounds,contents) {
        var tf = container.textFrames.add(mainLayer);
        tf.geometricBounds = bounds;
        tf.contents = contents;
        return tf;
    }

    function applyAll(textObj,style) {
        textObj.applyCharacterStyle(style);
    }

    function applyLastLiteral(story,literal,style) {
        var full = String(story.contents);
        var idx = full.lastIndexOf(literal);
        var from, to, range;
        if (idx < 0) { throw new Error("Literal not found: " + literal); }
        from = story.characters.item(idx);
        to = story.characters.item(idx + literal.length - 1);
        range = story.characters.itemByRange(from,to);
        range.applyCharacterStyle(style);
        return range;
    }

    function countStoryFrames(story) {
        try { return story.textContainers.length; } catch (e) { return 0; }
    }

    function step(name,fn) {
        try {
            fn();
            log.push("PASS\tBUILD " + name);
        } catch (e) {
            failed++;
            log.push("FAIL\tBUILD " + name + "\t" + errText(e));
        }
    }

    function finalize() {
        var stem = "StyleFix_Canary_v" + VERSION.replace(/\./g,"_");
        var target = new File(Folder.desktop.fsName + "/" + stem + ".indd");
        var idml = new File(Folder.desktop.fsName + "/" + stem + ".idml");
        var logFile = new File(Folder.desktop.fsName + "/StyleFix_Canary_Build_v" +
            VERSION.replace(/\./g,"_") + ".txt");
        var censusFile = new File(Folder.desktop.fsName + "/StyleFix_Canary_Census_v" +
            VERSION.replace(/\./g,"_") + ".csv");
        var i;

        writeCensus(censusFile);

        try {
            doc.save(target);
            log.push("PASS\tSAVE INDD\t" + target.fsName);
        } catch (eSave) {
            failed++;
            log.push("FAIL\tSAVE INDD\t" + errText(eSave));
        }

        try {
            doc.exportFile(ExportFormat.INDESIGN_MARKUP,idml,false);
            if (!idml.exists) { throw new Error("IDML file was not created."); }
            log.push("PASS\tEXPORT IDML\t" + idml.fsName);
        } catch (eIdml) {
            failed++;
            log.push("FAIL\tEXPORT IDML\t" + errText(eIdml));
        }

        logFile.encoding = "UTF-8";
        logFile.lineFeed = "Windows";
        if (logFile.open("w")) {
            logFile.writeln("StyleFix Canary Fixture Builder v" + VERSION);
            logFile.writeln("Fixture schema: " + FIXTURE_SCHEMA);
            logFile.writeln("Fixture ID: " + FIXTURE_ID);
            logFile.writeln("InDesign version: " + safeApp("version"));
            logFile.writeln("InDesign build: " + safeApp("buildNumber"));
            logFile.writeln("OS: " + safeOs());
            logFile.writeln("Timestamp: " + (new Date()).toString());
            logFile.writeln("");
            for (i = 0; i < log.length; i++) { logFile.writeln(log[i]); }
            logFile.writeln("");
            logFile.writeln("REGISTERED CONTROLS: " + controls.length);
            logFile.writeln("FAILED STEPS: " + failed);
            logFile.close();
        }

        if (failed === 0) {
            alert("StyleFix canary fixture built and verified successfully.\n\n" +
                "INDD:\n" + target.fsName +
                "\n\nIDML:\n" + idml.fsName +
                "\n\nBuilder census:\n" + censusFile.fsName +
                "\n\nBuild log:\n" + logFile.fsName +
                "\n\nNext: run VerifyCanaryIDML.py against the IDML, then run StyleFix v" +
                VERSION + " against the INDD.");
        } else {
            alert("StyleFix canary fixture is INCOMPLETE.\n\n" +
                failed + " construction/read-back step(s) failed.\n\n" +
                "Do not use this fixture as release evidence.\n\nBuild log:\n" +
                logFile.fsName);
        }
    }

    function writeCensus(file) {
        var i, c;
        file.encoding = "UTF-8";
        file.lineFeed = "Windows";
        if (!file.open("w")) {
            failed++;
            log.push("FAIL\tWRITE CENSUS\tCould not open " + file.fsName);
            return;
        }
        file.write("\uFEFF");
        file.writeln(csv([
            "Fixture Version","Fixture Schema","Fixture ID",
            "ID","Control Class","Construction Context","Verified","Evidence"
        ]));
        for (i = 0; i < controls.length; i++) {
            c = controls[i];
            file.writeln(csv([
                VERSION,FIXTURE_SCHEMA,FIXTURE_ID,
                c.id,c.controlClass,c.context,c.verified ? "YES" : "NO",c.evidenceText
            ]));
        }
        file.close();
    }

    function csv(values) {
        var out = [], i, s;
        for (i = 0; i < values.length; i++) {
            s = String(values[i]).replace(/"/g,'""');
            out.push('"' + s + '"');
        }
        return out.join(",");
    }

    function safeApp(prop) {
        try { return String(app[prop]); } catch (e) { return ""; }
    }

    function safeOs() {
        try { return String($.os); } catch (e) { return ""; }
    }

    function errText(e) {
        var a = [];
        try { if (e.message) { a.push(String(e.message)); } } catch (x) {}
        try { if (e.number !== undefined) { a.push("Error " + e.number); } } catch (x2) {}
        try { if (e.line !== undefined) { a.push("line " + e.line); } } catch (x3) {}
        return a.join(" | ");
    }

    function stamp() {
        var d = new Date();
        return d.getFullYear() + two(d.getMonth()+1) + two(d.getDate()) + "-" +
            two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
    }

    function two(n) { return n < 10 ? "0" + n : String(n); }
}());
