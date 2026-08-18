#target "InDesign"
#targetengine "StyleFix"

/* StyleFix v1.0.5 loader. Keep the src folder beside this file. */
(function () {
    var VERSION = "1.0.5";
    var base = File($.fileName).parent;
    var names = [
        "src/StyleFix.part01.jsxinc",
        "src/StyleFix.part02.jsxinc",
        "src/StyleFix.part03.jsxinc",
        "src/StyleFix.part04.jsxinc",
        "src/StyleFix.part05.jsxinc",
        "src/StyleFix.part06.jsxinc",
        "src/StyleFix.part07.jsxinc",
        "src/StyleFix.part08.jsxinc",
        "src/StyleFix.part09.jsxinc"
    ];
    var code = "";
    var i, f;

    for (i = 0; i < names.length; i++) {
        f = new File(base.fsName + "/" + names[i]);
        if (!f.exists) {
            alert("StyleFix v" + VERSION + "\n\nMissing source component:\n" + f.fsName +
                  "\n\nKeep StyleFix.jsx and the src folder together.");
            return;
        }
        f.encoding = "UTF-8";
        if (!f.open("r")) {
            alert("StyleFix v" + VERSION + "\n\nCould not read source component:\n" + f.fsName);
            return;
        }
        code += f.read() + "\n";
        f.close();
    }

    try {
        eval(code);
    } catch (e) {
        var msg = "StyleFix v" + VERSION + " failed to load.\n\n";
        try { msg += e.message; } catch (ignore1) { msg += String(e); }
        try { msg += "\nLine: " + e.line; } catch (ignore2) {}
        alert(msg);
    }
}());