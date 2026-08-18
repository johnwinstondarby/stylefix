#target "InDesign"
#targetengine "StyleFix"

/*
StyleFix v1.0.6 runtime loader.

v1.0.6 is a harness-hardening release. The maintained implementation still
uses the v1.0.5 base modules plus a v1.0.6 override module. This loader reads
every module as text, validates the installed module set before evaluation,
then appends the v1.0.6 override before the base IIFE closes.

Delete the installed src folder before copying a new release. Do not merge a
new release into an older src folder.
*/

(function () {
    var VERSION = "1.0.6";
    var BASE_VERSION = "1.0.5";
    var PATCH_VERSION = "1.0.6";
    var base = File($.fileName).parent;
    var modules = [
        {path:"src/StyleFix.part01.jsxinc", tokens:['var VERSION = "1.0.5";','function scan()']},
        {path:"src/StyleFix.part02.jsxinc", tokens:['story.isEndnoteStory === true','isEndnote ? "ENDNOTE" : "STORY"','function scanTextContainer']},
        {path:"src/StyleFix.part03.jsxinc", tokens:['function pagesForText','function isOversetRange']},
        {path:"src/StyleFix.part04.jsxinc", tokens:['function buildDependencyMap','footnoteMarkerStyle']},
        {path:"src/StyleFix.part05.jsxinc", tokens:['function fingerprintPropertyCandidates','styleExportTagMaps']},
        {path:"src/StyleFix.part06.jsxinc", tokens:['function bookScopeState','function buildCandidateLookup']},
        {path:"src/StyleFix.part07.jsxinc", tokens:['function buildUI','function saveCSV']},
        {path:"src/StyleFix.part08.jsxinc", tokens:['function writeProvenance','function safeAllCharacterStyles']},
        {path:"src/StyleFix.part09.jsxinc", tokens:['function errorSummary','}());']}
    ];
    var patchPath = "src/StyleFix.v1.0.6.patch.jsxinc";
    var patchMarker = "STYLEFIX_PATCH_VERSION: 1.0.6";
    var pieces = [];
    var checks = [];
    var failures = [];
    var i, j, text, f, closeAt, patch, code;

    function readUtf8(path) {
        var file = new File(base.fsName + "/" + path);
        var value;
        if (!file.exists) {
            failures.push("MISSING " + path);
            return null;
        }
        file.encoding = "UTF-8";
        if (!file.open("r")) {
            failures.push("UNREADABLE " + path);
            return null;
        }
        value = file.read();
        file.close();
        return value;
    }

    for (i = 0; i < modules.length; i++) {
        text = readUtf8(modules[i].path);
        if (text === null) { continue; }

        for (j = 0; j < modules[i].tokens.length; j++) {
            if (text.indexOf(modules[i].tokens[j]) < 0) {
                failures.push("SIGNATURE MISMATCH " + modules[i].path +
                    " missing token: " + modules[i].tokens[j]);
            }
        }
        checks.push(modules[i].path + "=base-" + BASE_VERSION + ":PASS");
        pieces.push(text);
    }

    patch = readUtf8(patchPath);
    if (patch !== null) {
        if (patch.indexOf(patchMarker) < 0) {
            failures.push("PATCH VERSION MISMATCH " + patchPath);
        } else {
            checks.push(patchPath + "=patch-" + PATCH_VERSION + ":PASS");
        }
    }

    if (failures.length > 0 || pieces.length !== modules.length || patch === null) {
        alert("StyleFix v" + VERSION + "\n\nINSTALLED ARTIFACT PARITY FAILED.\n\n" +
            failures.join("\n") +
            "\n\nDelete the installed src folder, then copy StyleFix.jsx and the complete src folder from the same release.");
        return;
    }

    closeAt = pieces[pieces.length - 1].lastIndexOf("}());");
    if (closeAt < 0) {
        alert("StyleFix v" + VERSION + "\n\nInstalled artifact parity failed: final base module does not contain the expected closure.");
        return;
    }
    pieces[pieces.length - 1] = pieces[pieces.length - 1].substring(0, closeAt);

    code = pieces.join("\n");
    code = code.replace('StyleFix v1.0.5', 'StyleFix v1.0.6');
    code = code.replace('var VERSION = "1.0.5";', 'var VERSION = "1.0.6";');
    code = code.replace('var RELEASE_TAG = "v1.0.5";', 'var RELEASE_TAG = "v1.0.6";');
    code += "\n" + patch + "\n}());\n";

    $.global.__STYLEFIX_LOADER_RUNTIME = {
        loaderVersion: VERSION,
        baseVersion: BASE_VERSION,
        patchVersion: PATCH_VERSION,
        parity: "PASS",
        moduleChecks: checks.join(" | "),
        installedFile: String(File($.fileName).fsName)
    };

    try {
        eval(code);
    } catch (e) {
        var msg = "StyleFix v" + VERSION + " failed to load.\n\n";
        try { msg += e.message; } catch (ignore1) { msg += String(e); }
        try { msg += "\nLine: " + e.line; } catch (ignore2) {}
        alert(msg);
    }
}());
