#target "InDesign"

/*
StyleFix v1.0.8 supplemental L01 correction verifier.

Purpose:
- independently verify that Unnamed Style L01 is an untouched empty-shell style;
- avoid relying on direct NothingEnum equality, which can vary in ExtendScript
  read-back even when the style serializes with no explicit formatting;
- compare L01 against both E01 and a fresh transient empty CharacterStyle across
  the full StyleFix fingerprint surface;
- leave the fixture unchanged by removing the transient probe before exit.
*/

(function () {
    var VERSION = "1.0.0";
    var TARGET = "Unnamed Style L01";
    var REFERENCE = "Unnamed Style E01";
    var PROBE = "StyleFix L01 Empty Baseline Probe";
    var PROPS = [
        "appliedFont","fontStyle","pointSize","leading","tracking","appliedLanguage",
        "capitalization","position","underline","strikeThru","noBreak",
        "horizontalScale","verticalScale","baselineShift","skew","ligatures",
        "otfFigureStyle","fillColor","fillTint","strokeColor","strokeTint",
        "strokeWeight","overprintFill","overprintStroke"
    ];
    var doc, l01, e01, probe = null, differences = [], lines = [], ok = true, i;

    if (app.documents.length === 0) {
        alert("Open StyleFix_Canary_Supplemental_v1_0_8.indd first.");
        return;
    }

    doc = app.activeDocument;
    l01 = doc.characterStyles.itemByName(TARGET);
    e01 = doc.characterStyles.itemByName(REFERENCE);

    if (!l01.isValid || !e01.isValid) {
        alert("L01 verifier could not find the required styles.\n\nRequired:\n" + TARGET + "\n" + REFERENCE);
        return;
    }

    try {
        probe = doc.characterStyles.add({name:PROBE});

        for (i = 0; i < PROPS.length; i++) {
            compareProperty(PROPS[i]);
        }

        if (!sameBasedOn(l01,e01) || !sameBasedOn(l01,probe)) {
            differences.push("basedOn differs from empty references");
            ok = false;
        }

        if (safeMapCount(l01) !== 0) {
            differences.push("L01 export map count=" + safeMapCount(l01));
            ok = false;
        }
        if (safeMapCount(e01) !== 0) {
            differences.push("E01 export map count=" + safeMapCount(e01));
            ok = false;
        }

        lines.push("StyleFix supplemental L01 correction verifier");
        lines.push("==============================================");
        lines.push("Version: " + VERSION);
        lines.push("Document: " + safe(function(){return doc.name;},"<unknown>"));
        lines.push("Target: " + TARGET);
        lines.push("Reference: " + REFERENCE);
        lines.push("Probe: " + PROBE + " (transient)");
        lines.push("Fingerprint properties compared: " + PROPS.length);
        lines.push("L01 export maps: " + safeMapCount(l01));
        lines.push("E01 export maps: " + safeMapCount(e01));
        lines.push("Differences: " + differences.length);
        if (differences.length) {
            for (i = 0; i < differences.length; i++) { lines.push("  - " + differences[i]); }
        }
        lines.push("");
        lines.push(ok ? "PASS: L01 matches clean empty-shell references." : "FAIL: L01 differs from clean empty-shell references.");

    } catch (e) {
        ok = false;
        lines.push("FAIL: " + errText(e));
    } finally {
        try { if (probe && probe.isValid) { probe.remove(); } } catch (ignoreRemove) {}
    }

    writeReport(lines);
    alert("StyleFix L01 supplemental verification: " + (ok ? "PASS" : "FAIL") +
        "\n\n" + lines[lines.length - 1]);

    function compareProperty(prop) {
        var a = normalizedValue(l01,prop);
        var b = normalizedValue(e01,prop);
        var c = normalizedValue(probe,prop);
        if (a !== b || a !== c) {
            differences.push(prop + ": L01=" + a + "; E01=" + b + "; Probe=" + c);
            ok = false;
        }
    }

    function normalizedValue(style,prop) {
        var v;
        try { v = style[prop]; } catch (e) { return "<unavailable:" + errText(e) + ">"; }
        if (v === null || v === undefined) { return "<null>"; }
        try {
            if (v === NothingEnum.NOTHING) { return "<Nothing>"; }
        } catch (ignoreNothing) {}
        if (prop === "appliedFont") {
            return objectIdentity(v,["fullName","fontFamily","name"]);
        }
        if (prop === "appliedLanguage") {
            return objectIdentity(v,["icuLocaleName","name"]);
        }
        if (prop === "fillColor" || prop === "strokeColor") {
            return objectIdentity(v,["name","id"]);
        }
        try { return String(v); } catch (ignoreString) { return "<unstringifiable>"; }
    }

    function objectIdentity(obj,props) {
        var i, value;
        if (obj === null || obj === undefined) { return "<null>"; }
        for (i = 0; i < props.length; i++) {
            try {
                value = obj[props[i]];
                if (value !== null && value !== undefined && String(value) !== "") {
                    return props[i] + "=" + String(value);
                }
            } catch (ignore) {}
        }
        try { return String(obj); } catch (ignore2) { return "<object>"; }
    }

    function sameBasedOn(a,b) {
        var av = safe(function(){return styleIdentity(a.basedOn);},"<unavailable>");
        var bv = safe(function(){return styleIdentity(b.basedOn);},"<unavailable>");
        return av === bv;
    }

    function styleIdentity(s) {
        if (!s) { return "<null>"; }
        try { if (s.id !== undefined) { return "id=" + String(s.id); } } catch (ignoreId) {}
        try { if (s.name !== undefined) { return "name=" + String(s.name); } } catch (ignoreName) {}
        try { return String(s); } catch (ignore) { return "<style>"; }
    }

    function safeMapCount(style) {
        try { return Number(style.styleExportTagMaps.length); } catch (ignore) { return -1; }
    }

    function writeReport(reportLines) {
        var file = new File(Folder.desktop.fsName + "/StyleFix_Canary_Supplemental_v1_0_8_L01_Verify.txt");
        var j;
        file.encoding = "UTF-8";
        file.lineFeed = "Windows";
        if (!file.open("w")) { return; }
        for (j = 0; j < reportLines.length; j++) { file.writeln(reportLines[j]); }
        file.close();
    }

    function safe(fn,fallback) { try { return fn(); } catch (ignore) { return fallback; } }
    function errText(e) {
        var a = [];
        try { if (e.message) { a.push(String(e.message)); } } catch (ignore1) {}
        try { if (e.number !== undefined) { a.push("Error " + e.number); } } catch (ignore2) {}
        try { if (e.line !== undefined) { a.push("line " + e.line); } } catch (ignore3) {}
        return a.join(" | ");
    }
}());
