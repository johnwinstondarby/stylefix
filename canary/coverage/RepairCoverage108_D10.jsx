#target "InDesign"

/*
StyleFix v1.0.8 supplemental D10 cleanup repair.

Purpose:
- remove the generated index output story that can remain as overset text after
  the supplemental builder verifies D10 pageNumberStyleOverride;
- preserve the underlying Index/Topic/PageReference dependency;
- verify Unnamed Style D10 has zero direct text uses after cleanup;
- save the INDD and re-export the matching IDML fixture.

This script is fixture-only. It does not import or modify StyleFix scanner code.
*/

(function () {
    var VERSION = "1.0.0";
    var DOC_NAME = "StyleFix_Canary_Supplemental_v1_0_8.indd";
    var INDEX_NAME = "StyleFix Shared Index D09-D10";
    var TOPIC_NAME = "Canary Topic D10";
    var STYLE_NAME = "Unnamed Style D10";
    var doc, style, idx, topic, ref, before, after, repairedStories = 0;
    var lines = [], ok = true, i, stories, story, targets = [];

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
    idx = doc.indexes.itemByName(INDEX_NAME);
    if (!style.isValid || !idx.isValid) {
        alert("D10 repair could not find the required style/index.");
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
        if (before < 1) {
            throw new Error("Expected at least one generated direct D10 use before repair; found " + before + ".");
        }

        for (i = targets.length - 1; i >= 0; i--) {
            story = targets[i];
            if (!story || !story.isValid) { continue; }
            if (String(story.contents).indexOf(TOPIC_NAME) < 0) {
                throw new Error("A direct D10 use exists outside the generated index story; repair stopped.");
            }
            clearStory(story);
            repairedStories++;
        }

        after = countDirectUses(style,[]);
        if (after !== 0) {
            throw new Error("Direct D10 uses remain after repair: " + after + ".");
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
        exportIdml(doc);

        lines.push("StyleFix supplemental D10 cleanup repair");
        lines.push("======================================");
        lines.push("Version: " + VERSION);
        lines.push("Document: " + doc.name);
        lines.push("Direct D10 uses before: " + before);
        lines.push("Generated stories cleared: " + repairedStories);
        lines.push("Direct D10 uses after: " + after);
        lines.push("Dependency retained: YES");
        lines.push("IDML re-exported: YES");
        lines.push("");
        lines.push("PASS: D10 is dependency-only after cleanup.");
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

    function countDirectUses(targetStyle,storyOut) {
        var total = 0, s, r, ranges, j, k, seen = {};
        stories = doc.stories;
        for (j = 0; j < stories.length; j++) {
            s = stories.item(j);
            try { ranges = s.textStyleRanges; } catch (ignoreRanges) { continue; }
            for (k = 0; k < ranges.length; k++) {
                r = ranges.item(k);
                try {
                    if (sameStyle(r.appliedCharacterStyle,targetStyle)) {
                        total++;
                        if (storyOut && !seen[String(s.id)]) {
                            storyOut.push(s);
                            seen[String(s.id)] = true;
                        }
                    }
                } catch (ignoreRange) {}
            }
        }
        return total;
    }

    function clearStory(s) {
        var containers, j;
        try { s.contents = ""; } catch (ignoreStoryContents) {
            try { if (s.texts.length > 0) { s.texts.item(0).contents = ""; } } catch (ignoreTextContents) {}
        }
        try {
            containers = s.textContainers;
            for (j = containers.length - 1; j >= 0; j--) {
                try { if (containers[j].isValid) { containers[j].remove(); } } catch (ignoreContainer) {}
            }
        } catch (ignoreContainers) {}
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
