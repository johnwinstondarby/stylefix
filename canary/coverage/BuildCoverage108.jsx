/*
 * StyleFix - character style auditing for Adobe InDesign documents
 * Copyright (C) 2026 John Darby
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
// SPDX-License-Identifier: GPL-3.0-or-later

#target "InDesign"

/*
StyleFix Canary Suite - clean supplemental coverage builder v1.0.8

Acceptance-contract fixture for:
- D08 running-header character-style dependency;
- D09 index-generation page-number dependency;
- D10 page-reference style-override dependency;
- E01/E02 export-map negative/positive pair;
- F05 fillColor match and near-miss discrimination;
- F06 appliedFont match and near-miss discrimination;
- L01 clean empty-shell LOW control.

The builder does not import StyleFix scanner code. It retains direct references
to the objects it creates and independently reads them back before saving.
*/

(function () {
    var VERSION = "1.0.8";
    var SCHEMA = "3";
    var EXPECTED_SCANNER = "1.0.8";
    var FIXTURE_ID = "StyleFix-Coverage108-" + stamp();
    var INDEX_NAME = "StyleFix Shared Index D09-D10";
    var TOPIC_NAME = "Canary Topic D10";
    var FONT_PREFERENCES = [
        "Aptos", "Arial", "Times New Roman", "Courier New", "Calibri",
        "Minion Pro", "Myriad Pro", "Georgia", "Verdana", "Tahoma"
    ];

    var doc = null, page, layer, styles = {}, canonical = {}, controls = [];
    var log = [], failed = 0, fontPair = null, colorPair = null;
    var sharedIndex = null, d10Ref = null, generatedIndexStory = null;

    try {
        doc = app.documents.add(true);
        doc.documentPreferences.facingPages = false;
        page = doc.pages.item(0);
        layer = doc.layers.item(0);

        step("BASE",function () {
            createStyles();
            colorPair = createDistinctColors();
            fontPair = chooseDistinctFonts();
            createCanonicalStyles();
            writeLabels();
        });

        step("D08 running-header character-style dependency",buildD08);
        step("D09 index-generation page-number dependency",buildD09);
        step("D10 page-reference style override",buildD10);
        step("E01 no export map",buildE01);
        step("E02 EPUB export map",buildE02);
        step("F05 fillColor match + near-miss",buildF05);
        step("F06 appliedFont match + near-miss",buildF06);
        step("L01 empty-shell LOW control",buildL01);

        verifyControls();
        finalize();
    } catch (fatal) {
        failed++;
        log.push("FAIL\tFATAL\t" + errText(fatal));
        try { finalize(); } catch (ignoreFinalize) {}
        alert("StyleFix supplemental canary v" + VERSION + " fatal error.\n\n" + errText(fatal));
    }

    function createStyles() {
        var names = [
            "D08","D09","D10","E01","E02",
            "F05 Match","F05 Miss","F06 Match","F06 Miss","L01"
        ], i;
        for (i = 0; i < names.length; i++) {
            styles[names[i]] = doc.characterStyles.add({name:"Unnamed Style " + names[i]});
        }
    }

    function createCanonicalStyles() {
        canonical.F05 = doc.characterStyles.add({name:"Canary Canonical F05"});
        canonical.F06 = doc.characterStyles.add({name:"Canary Canonical F06"});

        canonical.F05.pointSize = 12;
        canonical.F05.tracking = 40;
        canonical.F05.fillColor = colorPair.a;
        styles["F05 Match"].pointSize = 12;
        styles["F05 Match"].tracking = 40;
        styles["F05 Match"].fillColor = colorPair.a;
        styles["F05 Miss"].pointSize = 12;
        styles["F05 Miss"].tracking = 40;
        styles["F05 Miss"].fillColor = colorPair.b;

        canonical.F06.pointSize = 12;
        canonical.F06.tracking = 50;
        canonical.F06.appliedFont = fontPair.a;
        styles["F06 Match"].pointSize = 12;
        styles["F06 Match"].tracking = 50;
        styles["F06 Match"].appliedFont = fontPair.a;
        styles["F06 Miss"].pointSize = 12;
        styles["F06 Miss"].tracking = 50;
        styles["F06 Miss"].appliedFont = fontPair.b;
    }

    function writeLabels() {
        doc.insertLabel("StyleFixFixtureVersion",VERSION);
        doc.insertLabel("StyleFixFixtureSchema",SCHEMA);
        doc.insertLabel("StyleFixFixtureId",FIXTURE_ID);
        doc.insertLabel("StyleFixExpectedScannerVersion",EXPECTED_SCANNER);
        doc.insertLabel("StyleFixFixtureFontPair",fontPair.aName + " <> " + fontPair.bName);
        doc.insertLabel("StyleFixFixtureColorPair",colorPair.aName + " <> " + colorPair.bName);
        doc.insertLabel("StyleFixFixtureSuiteMember","clean-supplemental-coverage");
    }

    function buildD08() {
        var variable = doc.textVariables.add({
            name:"Canary RH Variable D08",
            variableType:VariableTypes.MATCH_CHARACTER_STYLE_TYPE
        });
        var options = variable.variableOptions;

        /* Adobe MatchCharacterStylePreference uses appliedCharacterStyle. */
        options.appliedCharacterStyle = styles.D08;

        register("D08","Dependency","Running header character-style preference",function () {
            var v = doc.textVariables.itemByName("Canary RH Variable D08");
            return v.isValid && v.variableType === VariableTypes.MATCH_CHARACTER_STYLE_TYPE &&
                sameStyle(v.variableOptions.appliedCharacterStyle,styles.D08);
        },function () {
            var v = doc.textVariables.itemByName("Canary RH Variable D08");
            return "variableType=MATCH_CHARACTER_STYLE_TYPE;appliedCharacterStyle=" +
                styleName(v.variableOptions.appliedCharacterStyle);
        });
    }

    function buildD09() {
        sharedIndex = doc.indexes.add({name:INDEX_NAME});
        doc.indexGenerationOptions.pageNumberStyle = styles.D09;
        register("D09","Dependency","Index generation page-number style",function () {
            return doc.indexes.itemByName(INDEX_NAME).isValid &&
                sameStyle(doc.indexGenerationOptions.pageNumberStyle,styles.D09);
        },function () {
            return "index=" + doc.indexes.itemByName(INDEX_NAME).name +
                ";pageNumberStyle=" + styleName(doc.indexGenerationOptions.pageNumberStyle);
        });
    }

    function buildD10() {
        var tf = addFrame([36,36,72,320],"D10 real-page index source");
        var idx = doc.indexes.itemByName(INDEX_NAME);
        var topic = idx.topics.add(TOPIC_NAME);
        var source = tf.parentStory.insertionPoints.item(0);
        var reacquiredIndex, topics, t, refs, i;

        d10Ref = topic.pageReferences.add(source,PageReferenceType.CURRENT_PAGE,undefined,styles.D10);
        if (!sameStyle(d10Ref.pageNumberStyleOverride,styles.D10)) {
            throw new Error("D10 override did not read back before index generation.");
        }

        generatedIndexStory = idx.generate(page,[36,360],layer,false,false);

        reacquiredIndex = doc.indexes.itemByName(INDEX_NAME);
        topics = reacquiredIndex.allTopics;
        topic = null;
        for (i = 0; i < topics.length; i++) {
            t = topics[i];
            try { if (String(t.name) === TOPIC_NAME) { topic = t; break; } } catch (ignoreName) {}
        }
        if (topic === null) { throw new Error("D10 topic could not be reacquired after index generation."); }
        refs = topic.pageReferences;
        if (refs.length < 1) { throw new Error("D10 page reference disappeared after index generation."); }
        d10Ref = refs.item(0);
        if (!sameStyle(d10Ref.pageNumberStyleOverride,styles.D10)) {
            throw new Error("D10 pageNumberStyleOverride mismatch after index generation.");
        }

        /* Remove generated content so D09/D10 remain dependency-only controls. */
        try { if (generatedIndexStory && generatedIndexStory.isValid) { generatedIndexStory.remove(); } } catch (ignoreRemove) {}
        generatedIndexStory = null;

        register("D10","Dependency","Index page-reference style override",function () {
            var idx2 = doc.indexes.itemByName(INDEX_NAME), topics2 = idx2.allTopics;
            var topic2 = null, refs2, j;
            for (j = 0; j < topics2.length; j++) {
                try { if (String(topics2[j].name) === TOPIC_NAME) { topic2 = topics2[j]; break; } } catch (ignoreTopic) {}
            }
            if (topic2 === null) { return false; }
            refs2 = topic2.pageReferences;
            if (refs2.length < 1) { return false; }
            return sameStyle(refs2.item(0).pageNumberStyleOverride,styles.D10);
        },function () {
            var idx2 = doc.indexes.itemByName(INDEX_NAME), topics2 = idx2.allTopics;
            var topic2 = null, refs2, j;
            for (j = 0; j < topics2.length; j++) {
                try { if (String(topics2[j].name) === TOPIC_NAME) { topic2 = topics2[j]; break; } } catch (ignoreTopic) {}
            }
            refs2 = topic2 ? topic2.pageReferences : null;
            return "sharedIndex=" + idx2.name + ";topic=" + (topic2 ? topic2.name : "MISSING") +
                ";pageRefs=" + (refs2 ? refs2.length : 0) +
                ";pageNumberStyleOverride=" + (refs2 && refs2.length ? styleName(refs2.item(0).pageNumberStyleOverride) : "MISSING");
        });
    }

    function buildE01() {
        register("E01","Export","No export map",function () {
            return styles.E01.styleExportTagMaps.length === 0;
        },function () { return "exportMaps=" + styles.E01.styleExportTagMaps.length; });
    }

    function buildE02() {
        styles.E02.styleExportTagMaps.add("EPUB","span","canary-e02-v108","");
        register("E02","Export","EPUB tag/class",function () {
            var maps = styles.E02.styleExportTagMaps, m;
            if (maps.length !== 1) { return false; }
            m = maps.item(0);
            return String(m.exportTag) === "span" && String(m.exportClass) === "canary-e02-v108";
        },function () {
            var maps = styles.E02.styleExportTagMaps, m = maps.item(0);
            return "length=" + maps.length + ";tag=" + m.exportTag + ";class=" + m.exportClass;
        });
    }

    function buildF05() {
        var matchFrame = addFrame([84,36,112,320],"F05 MATCH fill discriminator");
        var missFrame = addFrame([120,36,148,320],"F05 MISS fill discriminator");
        applyAll(matchFrame.parentStory,styles["F05 Match"]);
        applyAll(missFrame.parentStory,styles["F05 Miss"]);

        register("F05","Fingerprint","fillColor match and near-miss",function () {
            return verifyLiteral(matchFrame.parentStory,styles["F05 Match"],"F05 MATCH fill discriminator") &&
                verifyLiteral(missFrame.parentStory,styles["F05 Miss"],"F05 MISS fill discriminator") &&
                sameFingerprintExcept(styles["F05 Match"],canonical.F05,"fillColor") &&
                styleValue(styles["F05 Match"],"fillColor") === styleValue(canonical.F05,"fillColor") &&
                sameFingerprintExcept(styles["F05 Miss"],canonical.F05,"fillColor") &&
                styleValue(styles["F05 Miss"],"fillColor") !== styleValue(canonical.F05,"fillColor");
        },function () {
            return "matchFill=" + styleValue(styles["F05 Match"],"fillColor") +
                ";missFill=" + styleValue(styles["F05 Miss"],"fillColor") +
                ";canonicalFill=" + styleValue(canonical.F05,"fillColor") +
                ";pair=" + colorPair.aName + "<>" + colorPair.bName;
        });
    }

    function buildF06() {
        var matchFrame = addFrame([156,36,184,320],"F06 MATCH font discriminator");
        var missFrame = addFrame([192,36,220,320],"F06 MISS font discriminator");
        applyAll(matchFrame.parentStory,styles["F06 Match"]);
        applyAll(missFrame.parentStory,styles["F06 Miss"]);

        register("F06","Fingerprint","appliedFont match and near-miss",function () {
            return verifyLiteral(matchFrame.parentStory,styles["F06 Match"],"F06 MATCH font discriminator") &&
                verifyLiteral(missFrame.parentStory,styles["F06 Miss"],"F06 MISS font discriminator") &&
                sameFingerprintExcept(styles["F06 Match"],canonical.F06,"appliedFont") &&
                styleValue(styles["F06 Match"],"appliedFont") === styleValue(canonical.F06,"appliedFont") &&
                sameFingerprintExcept(styles["F06 Miss"],canonical.F06,"appliedFont") &&
                styleValue(styles["F06 Miss"],"appliedFont") !== styleValue(canonical.F06,"appliedFont");
        },function () {
            return "matchFont=" + styleValue(styles["F06 Match"],"appliedFont") +
                ";missFont=" + styleValue(styles["F06 Miss"],"appliedFont") +
                ";canonicalFont=" + styleValue(canonical.F06,"appliedFont") +
                ";pair=" + fontPair.aName + "<>" + fontPair.bName;
        });
    }

    function buildL01() {
        register("L01","Risk outcome","Clean empty shell",function () {
            return isEmptyShell(styles.L01) && styles.L01.styleExportTagMaps.length === 0;
        },function () {
            return "emptyShell=" + (isEmptyShell(styles.L01) ? "YES" : "NO") +
                ";exportMaps=" + styles.L01.styleExportTagMaps.length;
        });
    }

    function createDistinctColors() {
        var ca = doc.colors.add({name:"Canary Fill A",model:ColorModel.PROCESS,space:ColorSpace.RGB,colorValue:[16,64,128]});
        var cb = doc.colors.add({name:"Canary Fill B",model:ColorModel.PROCESS,space:ColorSpace.RGB,colorValue:[224,32,16]});
        var sa = doc.characterStyles.add({name:"Probe Canary Fill A"});
        var sb = doc.characterStyles.add({name:"Probe Canary Fill B"});
        var av, bv;
        sa.fillColor = ca; sb.fillColor = cb;
        av = styleValue(sa,"fillColor"); bv = styleValue(sb,"fillColor");
        try { sa.remove(); } catch (ignoreA) {}
        try { sb.remove(); } catch (ignoreB) {}
        if (av === "" || bv === "" || av === "NOTHING" || bv === "NOTHING" || av === bv) {
            throw new Error("Could not establish two distinct fillColor read-back values.");
        }
        return {a:ca,b:cb,aName:av,bName:bv};
    }

    function chooseDistinctFonts() {
        var fonts = app.fonts, byFamily = {}, i, f, family, key;
        var orderedFamilies = [], selected = [], pref, a, b, sa, sb, av, bv;

        for (i = 0; i < fonts.length; i++) {
            try {
                f = fonts.item(i);
                if (f.status !== FontStatus.INSTALLED) { continue; }
                family = String(f.fontFamily);
                if (family === "") { continue; }
                key = family.toLowerCase();
                if (byFamily[key] === undefined) { byFamily[key] = f; orderedFamilies.push(family); }
            } catch (ignoreFont) {}
        }

        for (i = 0; i < FONT_PREFERENCES.length; i++) {
            pref = FONT_PREFERENCES[i].toLowerCase();
            if (byFamily[pref] !== undefined) { selected.push(byFamily[pref]); }
            if (selected.length === 2) { break; }
        }

        if (selected.length < 2) {
            orderedFamilies.sort(function (x,y) {
                x = x.toLowerCase(); y = y.toLowerCase();
                return x < y ? -1 : (x > y ? 1 : 0);
            });
            for (i = 0; i < orderedFamilies.length && selected.length < 2; i++) {
                f = byFamily[orderedFamilies[i].toLowerCase()];
                if (selected.length === 0 || String(f.fontFamily) !== String(selected[0].fontFamily)) { selected.push(f); }
            }
        }

        if (selected.length < 2) { throw new Error("Could not select two distinct installed font families."); }
        a = selected[0]; b = selected[1];
        sa = doc.characterStyles.add({name:"Probe Font A"});
        sb = doc.characterStyles.add({name:"Probe Font B"});
        sa.appliedFont = a; sb.appliedFont = b;
        av = styleValue(sa,"appliedFont"); bv = styleValue(sb,"appliedFont");
        try { sa.remove(); } catch (ignoreSa) {}
        try { sb.remove(); } catch (ignoreSb) {}
        if (av === "" || bv === "" || av === "NOTHING" || bv === "NOTHING" || av === bv) {
            throw new Error("Selected fonts did not produce distinct appliedFont read-back values: " + av + " <> " + bv);
        }
        return {a:a,b:b,aName:av,bName:bv};
    }

    function sameFingerprintExcept(a,b,exceptProp) {
        var props = ["pointSize","tracking","fillColor","appliedFont"], i, p;
        for (i = 0; i < props.length; i++) {
            p = props[i];
            if (p === exceptProp) { continue; }
            if (styleValue(a,p) !== styleValue(b,p)) { return false; }
        }
        return true;
    }

    function isEmptyShell(style) {
        var props = ["pointSize","tracking","fillColor","appliedFont"], i;
        for (i = 0; i < props.length; i++) {
            if (styleValue(style,props[i]) !== "NOTHING") { return false; }
        }
        return true;
    }

    function addFrame(bounds,contents) {
        var tf = page.textFrames.add(layer);
        tf.geometricBounds = bounds;
        tf.contents = contents;
        return tf;
    }

    function textObject(obj) {
        try { if (obj.texts && obj.texts.length > 0) { return obj.texts.item(0); } } catch (ignore) {}
        try { if (obj.characters !== undefined && obj.contents !== undefined) { return obj; } } catch (ignore2) {}
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
        if (controls.length !== 8) { failed++; log.push("FAIL\tRegistered controls\texpected=8 actual=" + controls.length); }
        else { log.push("PASS\tRegistered controls\t8"); }
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
            logFile.writeln("StyleFix supplemental clean coverage builder v" + VERSION);
            logFile.writeln("Expected scanner: " + EXPECTED_SCANNER);
            logFile.writeln("Fixture schema: " + SCHEMA);
            logFile.writeln("Fixture ID: " + FIXTURE_ID);
            logFile.writeln("Font pair: " + (fontPair ? fontPair.aName + " <> " + fontPair.bName : "N/A"));
            logFile.writeln("Color pair: " + (colorPair ? colorPair.aName + " <> " + colorPair.bName : "N/A"));
            logFile.writeln("InDesign version: " + safeApp("version"));
            logFile.writeln("InDesign build: " + (safeApp("buildNumber") || "NOT_EXPOSED"));
            logFile.writeln("OS: " + safeOs());
            logFile.writeln("Timestamp: " + (new Date()).toString());
            logFile.writeln("");
            for (i = 0; i < log.length; i++) { logFile.writeln(log[i]); }
            logFile.writeln("");
            logFile.writeln("REGISTERED CONTROLS: " + controls.length);
            logFile.writeln("FAILED STEPS: " + failed);
            logFile.close();
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
        var v;
        try { v = style[prop]; } catch (ignoreRead) { return "<unavailable>"; }
        if (v === null || v === undefined || isNothing(v)) { return "NOTHING"; }
        if (prop === "appliedFont") { return fontValue(v); }
        if (prop === "fillColor" || prop === "strokeColor") { return styleValueObject(v); }
        try { return String(v); } catch (ignore) { return ""; }
    }

    function isNothing(v) {
        try { return v === NothingEnum.NOTHING; } catch (ignore) { return false; }
    }

    function styleValueObject(v) {
        try { if (v.name !== undefined && String(v.name) !== "") { return String(v.name); } } catch (ignore) {}
        try { if (v.id !== undefined) { return "ID:" + String(v.id); } } catch (ignore2) {}
        try { return String(v); } catch (ignore3) { return ""; }
    }

    function fontValue(v) {
        try { if (v.fullName !== undefined && String(v.fullName) !== "") { return String(v.fullName); } } catch (ignore) {}
        try { if (v.fontFamily !== undefined && String(v.fontFamily) !== "") { return String(v.fontFamily) + "\t" + String(v.fontStyleName || ""); } } catch (ignore2) {}
        try { if (v.name !== undefined && String(v.name) !== "") { return String(v.name); } } catch (ignore3) {}
        try { return String(v); } catch (ignore4) { return ""; }
    }

    function sameStyle(a,b) {
        if (!a || !b) { return false; }
        try { return String(a.id) === String(b.id); } catch (ignore) {}
        try { return String(a.name) === String(b.name); } catch (ignore2) {}
        return false;
    }

    function styleName(s) { try { return String(s.name); } catch (ignore) { return ""; } }
    function step(name,fn) { try { fn(); log.push("PASS\tBUILD " + name); } catch (e) { failed++; log.push("FAIL\tBUILD " + name + "\t" + errText(e)); } }
    function safeApp(prop) { try { return String(app[prop]); } catch (ignore) { return ""; } }
    function safeOs() { try { return String($.os); } catch (ignore) { return ""; } }
    function errText(e) { var a=[]; try{if(e.message)a.push(String(e.message));}catch(x){} try{if(e.number!==undefined)a.push("Error "+e.number);}catch(x2){} try{if(e.line!==undefined)a.push("line "+e.line);}catch(x3){} return a.join(" | "); }
    function csv(values) { var out=[],i,s; for(i=0;i<values.length;i++){s=String(values[i]).replace(/"/g,'""');out.push('"'+s+'"');} return out.join(","); }
    function stamp(){var d=new Date();return d.getFullYear()+two(d.getMonth()+1)+two(d.getDate())+"-"+two(d.getHours())+two(d.getMinutes())+two(d.getSeconds());}
    function two(n){return n<10?"0"+n:String(n);}
}());
