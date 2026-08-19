#target "InDesign"

/*
StyleFix v1.0.8 supplemental D10 cleanup repair.

Purpose:
- neutralize the generated index page-number text run if D10 is still applied;
- accept an already-clean INDD when D10 has zero direct text uses;
- preserve the underlying Index/Topic/PageReference dependency;
- verify Unnamed Style D10 has zero direct text uses after cleanup and save;
- re-export the matching IDML fixture so serialized evidence matches the INDD.

This script is fixture-only. It does not import or modify StyleFix scanner code.
*/

(function () {
    var VERSION = "1.0.2";
    var DOC_NAME = "StyleFix_Canary_Supplemental_v1_0_8.indd";
    var INDEX_NAME = "StyleFix Shared Index D09-D10";
    var TOPIC_NAME = "Canary Topic D10";
    var STYLE_NAME = "Unnamed Style D10";
    var doc, style, noneStyle, idx, topic, ref, before, after, afterSave;
    var lines = [], ok = true, targets = [], sample = "", action = "";

    if (app.documents.length === 0) {
        alert("Open " + DOC_NAME + " first.");
        return;
    }

    doc = app.activeDocument;
    if (String(doc.name) !== DOC_NAME) {
        alert("Active document must be " + DOC_NAME + ".\n\nCurrent: " + doc.name);
        return;
    }

    style = doc.characterStyles.itemByName(STYLE_NAME);
    noneStyle = doc.characterStyles.item(0);
    idx = doc.indexes.itemByName(INDEX_NAME);
    if (!style.isValid || !noneStyle.isValid || !idx.isValid) {
        alert("D10 repair could not find the required style/index objects.");
        return;
    }

    try {
        topic = findTopic(idx,TOPIC_NAME);
        if (!topic) { throw new Error("D10 topic is missing before repair."); }
        if (topic.pageReferences.length < 1) { throw new Error("D10 page reference is missing before repair."); }
        ref = topic.pageReferences.item(0);
        if (!sameStyle(ref.pageNumberStyleOverride,style)) {
            throw new Error("D10 pageNumberStyleOverride does not point to " + STYLE_NAME + " before repair.");
        }

        before = countDirectUses(style,targets);
        if (before > 1 || targets.length > 1) {
            throw new Error("Expected zero or one generated direct D10 run before repair; found " + before + ".");
        }

        if (before === 1) {
            try { sample = String(targets[0].contents); } catch (ignoreSample) { sample = ""; }
            neutralizeRange(targets[0],noneStyle);
            action = "Neutralized one generated D10 text run";
        } else {
            sample = "<none>";
            action = "INDD already had zero direct D10 runs; refresh evidence only";
        }

        after = countDirectUses(style,[]);
        if (after !== 0) {
            throw new Error("Direct D10 uses remain after cleanup: " + after + ".");
        }

        topic = findTopic(idx,TOPIC_NAME);
        if (!topic || topic.pageReferences.length < 1) {
            throw new Error("D10 dependency disappeared during cleanup.");
        }
        ref = topic.pageReferences.item(0);
        if (!sameStyle(ref.pageNumberStyleOverride,style)) {
            throw new Error("D10 pageNumberStyleOverride changed during cleanup.");
        }

        doc.save();
        afterSave = countDirectUses(style,[]);
        if (afterSave !== 0) {
            throw new Error("Direct D10 uses returned after save: " + afterSave + ".");
        }
        exportIdml(doc);

        lines.push("StyleFix supplemental D10 cleanup repair");
        lines.push("======================================");
        lines.push("Version: " + VERSION);
        lines.push("Document: " + doc.name);
        lines.push("Direct D10 uses before: " + before);
        lines.push("Action: " + action);
        lines.push("Generated D10 sample: " + sample);
        lines.push("Replacement character style: " + safeStyleName(noneStyle));
        lines.push("Direct D10 uses after: " + after);
        lines.push("Direct D10 uses after save: " + afterSave);
        lines.push("Dependency retained: YES");
        lines.push("IDML re-exported: YES");
        lines.push("");
        lines.push("PASS: D10 is dependency-only and INDD/IDML evidence was refreshed.");
    } catch (e) {
        ok = false;
        lines.push("FAIL: " + errText(e));
    }

    writeReport(lines);
    alert("StyleFix D10 supplemental repair: " + (ok ? "PASS" : "FAIL") +
        "\n\n" + lines[lines.length - 1]);

    function findTopic(indexObj,name) {
        var topics, j;
        try { topics = indexObj.allTopics; } catch (e) { return null; }
        for (j = 0; j < topics.length; j++) {
            try { if (String(topics[j].name) === name) { return topics[j]; } } catch (ignore) {}
        }
        return null;
    }

    function countDirectUses(targetStyle,rangeOut) {
        var total = 0, stories, s, r, ranges, j, k;
        stories = doc.stories;
        for (j = 0; j < stories.length; j++) {
            s = stories.item(j);
            try { ranges = s.textStyleRanges; } catch (ignoreRanges) { continue; }
            for (k = 0; k < ranges.length; k++) {
                r = ranges.item(k);
                try {
                    if (sameStyle(r.appliedCharacterStyle,targetStyle)) {
                        total++;
                        if (rangeOut) { rangeOut.push(r); }
                    }
                } catch (ignoreRange) {}
            }
        }
        return total;
    }

    function neutralizeRange(rangeObj,replacementStyle) {
        var applied = false;
        try {
            rangeObj.applyCharacterStyle(replacementStyle);
            applied = true;
        } catch (ignoreApply) {}
        if (!applied) {
            try {
                rangeObj.appliedCharacterStyle = replacementStyle;
                applied = true;
            } catch (ignoreAssign) {}
        }
        if (!applied) {
            throw new Error("Could not apply the replacement character style to the D10 generated range.");
        }
        try {
            if (sameStyle(rangeObj.appliedCharacterStyle,style)) {
                throw new Error("D10 style remained applied after neutralization.");
            }
        } catch (eVerify) {
            if (String(eVerify.message || "").indexOf("remained applied") >= 0) { throw eVerify; }
        }
    }

    function exportIdml(d) {
        var base = String(d.fullName.fsName).replace(/\.indd$/i,"");
        var out = new File(base + ".idml");
        d.exportFile(ExportFormat.INDESIGN_MARKUP,out,false);
    }

    function sameStyle(a,b) {
        if (!a || !b) { return false; }
        try { return String(a.id) === String(b.id); } catch (ignore) {}
        try { return String(a.name) === String(b.name); } catch (ignore2) {}
        return false;
    }

    function safeStyleName(s) {
        try { return String(s.name); } catch (ignore) { return "<unknown>"; }
    }

    function writeReport(reportLines) {
        var file = new File(Folder.desktop.fsName + "/StyleFix_Canary_Supplemental_v1_0_8_D10_Repair.txt");
        var j;
        file.encoding = "UTF-8";
        file.lineFeed = "Windows";
        if (!file.open("w")) { return; }
        for (j = 0; j < reportLines.length; j++) { file.writeln(reportLines[j]); }
        file.close();
    }

    function errText(e) {
        var a = [];
        try { if (e.message) { a.push(String(e.message)); } } catch (ignore1) {}
        try { if (e.number !== undefined) { a.push("Error " + e.number); } } catch (ignore2) {}
        try { if (e.line !== undefined) { a.push("line " + e.line); } } catch (ignore3) {}
        return a.join(" | ");
    }
}());
