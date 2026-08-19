#target "InDesign"

/*
StyleFix Canary Suite - supplemental coverage builder v1.0.8

Independent fixture for export semantics, object-valued fingerprint
 discrimination, and index dependencies. It does not import StyleFix scanner
code and verifies the exact objects it creates.
*/

(function () {
    var VERSION = "1.0.8";
    var SCHEMA = "2";
    var EXPECTED_SCANNER = "1.0.8";
    var FIXTURE_ID = "StyleFix-Coverage108-" + stamp();
    var doc = null, page, layer, styles = {}, canonical = {}, controls = [], log = [], failed = 0;
    var fontPair = null, colorPair = null;

    try {
        doc = app.documents.add(true);
        doc.documentPreferences.facingPages = false;
        page = doc.pages.item(0);
        layer = doc.layers.item(0);

        step("BASE",function(){
            createStyles();
            colorPair = chooseDistinctSwatches();
            fontPair = chooseDistinctFonts();
            createCanonicalStyles();
            writeLabels();
        });

        step("E01 no export map",buildE01);
        step("E02 EPUB export map",buildE02);
        step("F05 fillColor discriminator",buildF05);
        step("F06 appliedFont discriminator",buildF06);
        step("I01 index generation dependency",buildI01);
        step("I02 page-reference override dependency",buildI02);

        verifyControls();
        finalize();
    } catch (fatal) {
        failed++;
        log.push("FAIL\tFATAL\t" + errText(fatal));
        try { finalize(); } catch (ignoreFinalize) {}
        alert("StyleFix supplemental canary v" + VERSION + " fatal error.\n\n" + errText(fatal));
    }

    function createStyles() {
        var ids = ["E01","E02","F05","F06","I01","I02"], i;
        for (i = 0; i < ids.length; i++) {
            styles[ids[i]] = doc.characterStyles.add({name:"Unnamed Style " + ids[i]});
        }
    }

    function createCanonicalStyles() {
        canonical.F05 = doc.characterStyles.add({name:"Canary Canonical F05"});
        canonical.F06 = doc.characterStyles.add({name:"Canary Canonical F06"});

        styles.F05.pointSize = 12; canonical.F05.pointSize = 12;
        styles.F05.tracking = 0; canonical.F05.tracking = 0;
        styles.F05.fillColor = colorPair.a;
        canonical.F05.fillColor = colorPair.b;

        styles.F06.pointSize = 12; canonical.F06.pointSize = 12;
        styles.F06.tracking = 0; canonical.F06.tracking = 0;
        styles.F06.appliedFont = fontPair.a;
        canonical.F06.appliedFont = fontPair.b;
    }

    function writeLabels() {
        doc.insertLabel("StyleFixFixtureVersion",VERSION);
        doc.insertLabel("StyleFixFixtureSchema",SCHEMA);
        doc.insertLabel("StyleFixFixtureId",FIXTURE_ID);
        doc.insertLabel("StyleFixExpectedScannerVersion",EXPECTED_SCANNER);
        doc.insertLabel("StyleFixFixtureFontPair",fontPair.aName + " <> " + fontPair.bName);
        doc.insertLabel("StyleFixFixtureColorPair",colorPair.aName + " <> " + colorPair.bName);
        doc.insertLabel("StyleFixFixtureSuiteMember","supplemental-coverage");
    }

    function buildE01() {
        register("E01","Export","No export map",function(){
            return styles.E01.styleExportTagMaps.length === 0;
        },function(){return "exportMaps=" + styles.E01.styleExportTagMaps.length;});
    }

    function buildE02() {
        styles.E02.styleExportTagMaps.add("EPUB","span","canary-e02-v108","");
        register("E02","Export","EPUB tag/class",function(){
            var maps = styles.E02.styleExportTagMaps;
            if (maps.length !== 1) { return false; }
            var m = maps.item(0);
            return String(m.exportTag) === "span" && String(m.exportClass) === "canary-e02-v108";
        },function(){
            var maps = styles.E02.styleExportTagMaps, m = maps.item(0);
            return "length=" + maps.length + ";tag=" + m.exportTag + ";class=" + m.exportClass;
        });
    }

    function buildF05() {
        var tf = addFrame([36,36,72,300],"F05 fill color discriminator");
        applyAll(tf.parentStory,styles.F05);
        register("F05","Fingerprint","Fill-color-only mismatch",function(){
            return verifyLiteral(tf.parentStory,styles.F05,"F05 fill color discriminator") &&
                styleValue(styles.F05,"fillColor") !== styleValue(canonical.F05,"fillColor") &&
                sameNumber(styles.F05.pointSize,canonical.F05.pointSize) &&
                sameNumber(styles.F05.tracking,canonical.F05.tracking);
        },function(){
            return "candidateFill=" + styleValue(styles.F05,"fillColor") +
                ";canonicalFill=" + styleValue(canonical.F05,"fillColor") +
                ";colorPair=" + colorPair.aName + "<>" + colorPair.bName;
        });
    }

    function buildF06() {
        var tf = addFrame([84,36,120,300],"F06 font discriminator");
        applyAll(tf.parentStory,styles.F06);
        register("F06","Fingerprint","Applied-font-only mismatch",function(){
            return verifyLiteral(tf.parentStory,styles.F06,"F06 font discriminator") &&
                styleValue(styles.F06,"appliedFont") !== styleValue(canonical.F06,"appliedFont") &&
                sameNumber(styles.F06.pointSize,canonical.F06.pointSize) &&
                sameNumber(styles.F06.tracking,canonical.F06.tracking);
        },function(){
            return "candidateFont=" + styleValue(styles.F06,"appliedFont") +
                ";canonicalFont=" + styleValue(canonical.F06,"appliedFont") +
                ";fontPair=" + fontPair.aName + "<>" + fontPair.bName;
        });
    }

    function buildI01() {
        doc.indexGenerationOptions.pageNumberStyle = styles.I01;
        register("I01","Dependency","Index generation page-number style",function(){
            return sameStyle(doc.indexGenerationOptions.pageNumberStyle,styles.I01);
        },function(){return "pageNumberStyle=" + styleName(doc.indexGenerationOptions.pageNumberStyle);});
    }

    function buildI02() {
        var tf = addFrame([132,36,168,300],"I02 index source");
        var idx = doc.indexes.add();
        var topic = idx.topics.add("StyleFix I02 Topic");
        var source = tf.parentStory.insertionPoints.item(0);
        var ref = topic.pageReferences.add(source,PageReferenceType.CURRENT_PAGE,undefined,styles.I02);
        register("I02","Dependency","Index page-reference override",function(){
            return sameStyle(ref.pageNumberStyleOverride,styles.I02);
        },function(){return "pageNumberStyleOverride=" + styleName(ref.pageNumberStyleOverride);});
    }

    function chooseDistinctSwatches() {
        var sw = doc.swatches, i, j, a, b, av, bv, sa, sb, ra, rb;
        for (i = 0; i < sw.length; i++) {
            for (j = i + 1; j < sw.length; j++) {
                sa = null; sb = null;
                try {
                    a = sw.item(i); b = sw.item(j);
                    av = styleValueObject(a); bv = styleValueObject(b);
                    if (av === "" || bv === "" || av === bv) { continue; }

                    sa = doc.characterStyles.add({name:"Probe Fill A " + i + " " + j});
                    sb = doc.characterStyles.add({name:"Probe Fill B " + i + " " + j});
                    sa.fillColor = a; sb.fillColor = b;
                    ra = styleValue(sa,"fillColor");
                    rb = styleValue(sb,"fillColor");
                    if (ra !== "" && rb !== "" && ra !== rb) {
                        sa.remove(); sb.remove();
                        return {a:a,b:b,aName:ra,bName:rb};
                    }
                } catch (ignore) {}
                try { if (sa && sa.isValid) { sa.remove(); } } catch (ignoreA) {}
                try { if (sb && sb.isValid) { sb.remove(); } } catch (ignoreB) {}
            }
        }
        throw new Error("Could not choose two assignable swatches with distinct fillColor read-back values.");
    }

    function chooseDistinctFonts() {
        var fonts = app.fonts, i, j, a, b, av, bv;
        for (i = 0; i < fonts.length; i++) {
            for (j = i + 1; j < fonts.length && j < i + 30; j++) {
                try {
                    a = fonts.item(i); b = fonts.item(j);
                    av = fontValue(a); bv = fontValue(b);
                    if (av !== "" && bv !== "" && av !== bv) {
                        var sa = doc.characterStyles.add({name:"Probe Font A " + i + " " + j});
                        var sb = doc.characterStyles.add({name:"Probe Font B " + i + " " + j});
                        sa.appliedFont = a; sb.appliedFont = b;
                        if (styleValue(sa,"appliedFont") !== styleValue(sb,"appliedFont")) {
                            sa.remove(); sb.remove();
                            return {a:a,b:b,aName:av,bName:bv};
                        }
                        sa.remove(); sb.remove();
                    }
                } catch (ignore) {}
            }
        }
        throw new Error("Could not choose two assignable fonts with distinct appliedFont values.");
    }

    function addFrame(bounds,contents) {
        var tf = page.textFrames.add(layer);
        tf.geometricBounds = bounds; tf.contents = contents; return tf;
    }

    function textObject(obj) {
        try {
            if (obj.texts && obj.texts.length > 0) { return obj.texts.item(0); }
        } catch (ignore) {}
        try {
            if (obj.characters !== undefined && obj.contents !== undefined) { return obj; }
        } catch (ignore2) {}
        return null;
    }

    function applyAll(obj,style) {
        var t = textObject(obj);
        if (!t || typeof t.applyCharacterStyle !== "function") { throw new Error("Could not resolve Text for style application."); }
        t.applyCharacterStyle(style);
    }

    function verifyLiteral(obj,style,literal) {
        var t = textObject(obj), contents, idx, i;
        if (!t) { return false; }
        contents = String(t.contents); idx = contents.indexOf(literal);
        if (idx < 0) { return false; }
        for (i = 0; i < literal.length; i++) {
            if (!sameStyle(t.characters.item(idx + i).appliedCharacterStyle,style)) { return false; }
        }
        return true;
    }

    function register(id,cls,context,verify,evidence) {
        controls.push({id:id,cls:cls,context:context,verify:verify,evidence:evidence,ok:false,evidenceText:""});
    }

    function verifyControls() {
        var i, c;
        for (i = 0; i < controls.length; i++) {
            c = controls[i];
            try { c.ok = c.verify() === true; c.evidenceText = c.evidence(); }
            catch (e) { c.ok = false; c.evidenceText = errText(e); }
            log.push((c.ok ? "PASS" : "FAIL") + "\tVERIFY " + c.id + "\t" + c.context + "\t" + c.evidenceText);
            if (!c.ok) { failed++; }
        }
        if (controls.length !== 6) { failed++; log.push("FAIL\tRegistered controls\texpected=6 actual=" + controls.length); }
        else { log.push("PASS\tRegistered controls\t6"); }
    }

    function finalize() {
        var stem = "StyleFix_Canary_Supplemental_v1_0_8";
        var indd = new File(Folder.desktop.fsName + "/" + stem + ".indd");
        var idml = new File(Folder.desktop.fsName + "/" + stem + ".idml");
        var logFile = new File(Folder.desktop.fsName + "/" + stem + "_Build.txt");
        var census = new File(Folder.desktop.fsName + "/" + stem + "_Census.csv");
        var i;
        writeCensus(census);
        try { doc.save(indd); log.push("PASS\tSAVE INDD\t" + indd.fsName); }
        catch (eSave) { failed++; log.push("FAIL\tSAVE INDD\t" + errText(eSave)); }
        try { doc.exportFile(ExportFormat.INDESIGN_MARKUP,idml,false); log.push("PASS\tEXPORT IDML\t" + idml.fsName); }
        catch (eIdml) { failed++; log.push("FAIL\tEXPORT IDML\t" + errText(eIdml)); }

        logFile.encoding = "UTF-8"; logFile.lineFeed = "Windows";
        if (logFile.open("w")) {
            logFile.writeln("StyleFix supplemental coverage builder v" + VERSION);
            logFile.writeln("Expected scanner: " + EXPECTED_SCANNER);
            logFile.writeln("Fixture schema: " + SCHEMA);
            logFile.writeln("Fixture ID: " + FIXTURE_ID);
            logFile.writeln("Font pair: " + (fontPair ? fontPair.aName + " <> " + fontPair.bName : "N/A"));
            logFile.writeln("Color pair: " + (colorPair ? colorPair.aName + " <> " + colorPair.bName : "N/A"));
            logFile.writeln("InDesign version: " + safeApp("version"));
            logFile.writeln("InDesign build: " + (safeApp("buildNumber") || "NOT_EXPOSED"));
            logFile.writeln("OS: " + safeOs());
            logFile.writeln("Timestamp: " + (new Date()).toString()); logFile.writeln("");
            for (i = 0; i < log.length; i++) { logFile.writeln(log[i]); }
            logFile.writeln(""); logFile.writeln("REGISTERED CONTROLS: " + controls.length);
            logFile.writeln("FAILED STEPS: " + failed); logFile.close();
        }
        alert("StyleFix supplemental canary v" + VERSION + (failed === 0 ? " built and verified successfully." : " is INCOMPLETE.") +
            "\n\nFAILED STEPS: " + failed + "\n\n" + logFile.fsName);
    }

    function writeCensus(file) {
        var i, c;
        file.encoding = "UTF-8"; file.lineFeed = "Windows";
        if (!file.open("w")) { failed++; return; }
        file.write("\uFEFF");
        file.writeln(csv(["Fixture Version","Expected Scanner","Fixture Schema","Fixture ID","ID","Control Class","Context","Verified","Evidence","Font Pair","Color Pair"]));
        for (i = 0; i < controls.length; i++) {
            c = controls[i];
            file.writeln(csv([VERSION,EXPECTED_SCANNER,SCHEMA,FIXTURE_ID,c.id,c.cls,c.context,c.ok ? "YES" : "NO",c.evidenceText,
                fontPair ? fontPair.aName + " <> " + fontPair.bName : "",
                colorPair ? colorPair.aName + " <> " + colorPair.bName : ""]));
        }
        file.close();
    }

    function styleValue(style,prop) {
        var v = style[prop];
        if (v === null || v === undefined) { return "NOTHING"; }
        if (prop === "appliedFont") { return fontValue(v); }
        if (prop === "fillColor" || prop === "strokeColor") { return styleValueObject(v); }
        try { return String(v); } catch (ignore) { return ""; }
    }
    function styleValueObject(v) {
        try { if (v.name !== undefined) { return String(v.name); } } catch (ignore) {}
        try { if (v.id !== undefined) { return "ID:" + String(v.id); } } catch (ignore2) {}
        try { return String(v); } catch (ignore3) { return ""; }
    }
    function fontValue(v) {
        try { if (v.fullName !== undefined && String(v.fullName) !== "") { return String(v.fullName); } } catch (ignore) {}
        try { if (v.name !== undefined && String(v.name) !== "") { return String(v.name); } } catch (ignore2) {}
        try { return String(v); } catch (ignore3) { return ""; }
    }
    function sameStyle(a,b) {
        if (!a || !b) { return false; }
        try { return String(a.id) === String(b.id); } catch (ignore) {}
        try { return String(a.name) === String(b.name); } catch (ignore2) {}
        return false;
    }
    function styleName(s) { try { return String(s.name); } catch (ignore) { return ""; } }
    function sameNumber(a,b) { return Math.abs(Number(a)-Number(b)) < 0.0001; }
    function step(name,fn) { try { fn(); log.push("PASS\tBUILD " + name); } catch (e) { failed++; log.push("FAIL\tBUILD " + name + "\t" + errText(e)); } }
    function safeApp(prop) { try { return String(app[prop]); } catch (ignore) { return ""; } }
    function safeOs() { try { return String($.os); } catch (ignore) { return ""; } }
    function errText(e) { var a=[]; try{if(e.message)a.push(String(e.message));}catch(x){} try{if(e.number!==undefined)a.push("Error "+e.number);}catch(x2){} try{if(e.line!==undefined)a.push("line "+e.line);}catch(x3){} return a.join(" | "); }
    function csv(values) { var out=[],i,s; for(i=0;i<values.length;i++){s=String(values[i]).replace(/"/g,'""');out.push('"'+s+'"');} return out.join(","); }
    function stamp(){var d=new Date();return d.getFullYear()+two(d.getMonth()+1)+two(d.getDate())+"-"+two(d.getHours())+two(d.getMinutes())+two(d.getSeconds());}
    function two(n){return n<10?"0"+n:String(n);}
}());
