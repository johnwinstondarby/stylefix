#target "InDesign"
#targetengine "StyleFix"

/*
StyleFix v1.0.8 development loader.

v1.0.8 is an audit-only scanner/certification candidate on the v1.0.8-dev
branch. It retains the validated v1.0.5 base modules and v1.0.6 harness patch,
then layers a declared DOM contract and the v1.0.8 scanner patch.

The loader reads and validates every installed source component before eval.
Delete the installed src folder before copying a different release.
*/

(function () {
    var VERSION = "1.0.8";
    var BASE_VERSION = "1.0.5";
    var PATCH_VERSION = "1.0.8";
    var PATCH_CHAIN = "1.0.6 + 1.0.8";
    var CONTRACT_VERSION = "1.0.8";
    var base = File($.fileName).parent;
    var modules = [
        {path:"src/StyleFix.part01.jsxinc",tokens:['var VERSION = "1.0.5";','function scan()']},
        {path:"src/StyleFix.part02.jsxinc",tokens:['story.isEndnoteStory === true','function scanTextContainer']},
        {path:"src/StyleFix.part03.jsxinc",tokens:['function pagesForText','function isOversetRange']},
        {path:"src/StyleFix.part04.jsxinc",tokens:['function buildDependencyMap','footnoteMarkerStyle']},
        {path:"src/StyleFix.part05.jsxinc",tokens:['function fingerprintPropertyCandidates','styleExportTagMaps']},
        {path:"src/StyleFix.part06.jsxinc",tokens:['function bookScopeState','function buildCandidateLookup']},
        {path:"src/StyleFix.part07.jsxinc",tokens:['function buildUI','function saveCSV']},
        {path:"src/StyleFix.part08.jsxinc",tokens:['function writeProvenance','function safeAllCharacterStyles']},
        {path:"src/StyleFix.part09.jsxinc",tokens:['function errorSummary','}());']}
    ];
    var patch106Path = "src/StyleFix.v1.0.6.patch.jsxinc";
    var patch106Marker = "STYLEFIX_PATCH_VERSION: 1.0.6";
    var contractPath = "src/StyleFix.dom.v1.0.8.jsxinc";
    var contractMarker = "STYLEFIX_DOM_CONTRACT_VERSION: 1.0.8";
    var patch108Paths = [
        "src/v1.0.8/StyleFix.patch01.jsxinc",
        "src/v1.0.8/StyleFix.patch02.jsxinc",
        "src/v1.0.8/StyleFix.patch03.jsxinc",
        "src/v1.0.8/StyleFix.patch04.jsxinc",
        "src/v1.0.8/StyleFix.patch05.jsxinc",
        "src/v1.0.8/StyleFix.patch06.jsxinc",
        "src/v1.0.8/StyleFix.patch07.jsxinc",
        "src/v1.0.8/StyleFix.patch08.jsxinc",
        "src/v1.0.8/StyleFix.patch09.jsxinc",
        "src/v1.0.8/StyleFix.patch10.jsxinc",
        "src/v1.0.8/StyleFix.patch11.jsxinc"
    ];
    var patch108Pieces = [];
    var pieces = [], checks = [], failures = [];
    var i, j, text, closeAt, patch106, contract108, patch108, code, marker;

    function readUtf8(path) {
        var file = new File(base.fsName + "/" + path), value;
        if (!file.exists) { failures.push("MISSING " + path); return null; }
        file.encoding = "UTF-8";
        if (!file.open("r")) { failures.push("UNREADABLE " + path); return null; }
        value = file.read(); file.close(); return value;
    }

    for (i = 0; i < modules.length; i++) {
        text = readUtf8(modules[i].path);
        if (text === null) { continue; }
        for (j = 0; j < modules[i].tokens.length; j++) {
            if (text.indexOf(modules[i].tokens[j]) < 0) {
                failures.push("SIGNATURE MISMATCH " + modules[i].path + " missing token: " + modules[i].tokens[j]);
            }
        }
        checks.push(modules[i].path + "=base-" + BASE_VERSION + ":PASS");
        pieces.push(text);
    }

    patch106 = readUtf8(patch106Path);
    if (patch106 !== null) {
        if (patch106.indexOf(patch106Marker) < 0) { failures.push("PATCH VERSION MISMATCH " + patch106Path); }
        else { checks.push(patch106Path + "=patch-1.0.6:PASS"); }
    }

    contract108 = readUtf8(contractPath);
    if (contract108 !== null) {
        if (contract108.indexOf(contractMarker) < 0) { failures.push("DOM CONTRACT VERSION MISMATCH " + contractPath); }
        else { checks.push(contractPath + "=contract-" + CONTRACT_VERSION + ":PASS"); }
    }

    for (i = 0; i < patch108Paths.length; i++) {
        patch108 = readUtf8(patch108Paths[i]);
        marker = "STYLEFIX_PATCH_PART: 1.0.8/" + (i + 1 < 10 ? "0" : "") + (i + 1);
        if (patch108 === null) { continue; }
        if (patch108.indexOf(marker) < 0) {
            failures.push("PATCH PART VERSION MISMATCH " + patch108Paths[i]);
        } else {
            checks.push(patch108Paths[i] + "=patch-" + PATCH_VERSION + ":PASS");
            patch108Pieces.push(patch108);
        }
    }

    if (failures.length > 0 || pieces.length !== modules.length ||
        patch106 === null || contract108 === null || patch108Pieces.length !== patch108Paths.length) {
        alert("StyleFix v" + VERSION + "\n\nINSTALLED ARTIFACT PARITY FAILED.\n\n" +
            failures.join("\n") +
            "\n\nDelete the installed src folder, then copy StyleFix.jsx and the complete src folder from the same branch/release.");
        return;
    }

    closeAt = pieces[pieces.length - 1].lastIndexOf("}());");
    if (closeAt < 0) {
        alert("StyleFix v" + VERSION + "\n\nInstalled artifact parity failed: final base module closure was not found.");
        return;
    }
    pieces[pieces.length - 1] = pieces[pieces.length - 1].substring(0,closeAt);

    code = pieces.join("\n");
    code = code.replace('StyleFix v1.0.5','StyleFix v1.0.8');
    code = code.replace('var VERSION = "1.0.5";','var VERSION = "1.0.8";');
    code = code.replace('var RELEASE_TAG = "v1.0.5";','var RELEASE_TAG = "v1.0.8-dev";');
    code += "\n" + patch106 + "\n" + contract108 + "\n" + patch108Pieces.join("\n") + "\n}());\n";

    $.global.__STYLEFIX_LOADER_RUNTIME = {
        loaderVersion:VERSION,
        baseVersion:BASE_VERSION,
        patchVersion:PATCH_VERSION,
        patchChain:PATCH_CHAIN,
        contractVersion:CONTRACT_VERSION,
        parity:"PASS",
        moduleChecks:checks.join(" | "),
        installedFile:String(File($.fileName).fsName)
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
