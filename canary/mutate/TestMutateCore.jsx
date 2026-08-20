#target "InDesign"

/*
Localis mutation core canary v0.1.0

Run with this repository structure preserved so the script can load:
    ../../core/mutate.jsxinc

The canary builds a disposable InDesign document and proves the portable
transaction contract before any production tool adopts it.
*/

(function () {
    var CANARY_VERSION = "0.1.0";
    var root = File($.fileName).parent.parent.parent;
    var coreFile = new File(root.fsName + "/core/mutate.jsxinc");
    var core, doc, page, tests = [], failed = 0;
    var logFile = new File(Folder.desktop.fsName + "/Localis_Mutate_Core_Canary_v0_1_0.txt");
    var csvFile = new File(Folder.desktop.fsName + "/Localis_Mutate_Core_Canary_v0_1_0.csv");
    var inddFile = new File(Folder.desktop.fsName + "/Localis_Mutate_Core_Canary_v0_1_0.indd");

    if (!coreFile.exists) {
        alert("Localis mutation core canary\n\nMissing core file:\n" + coreFile.fsName +
            "\n\nPreserve the repository core/ and canary/mutate/ folders when installing the canary.");
        return;
    }

    try {
        $.evalFile(coreFile);
    } catch (eLoad) {
        alert("Localis mutation core canary could not load core/mutate.jsxinc.\n\n" + errText(eLoad));
        return;
    }

    if (typeof LocalisCreateMutateCore !== "function") {
        alert("Localis mutation core canary\n\nLocalisCreateMutateCore() was not defined by the loaded core file.");
        return;
    }

    core = LocalisCreateMutateCore({app:app});

    try {
        doc = app.documents.add(true);
        doc.documentPreferences.facingPages = false;
        page = doc.pages.item(0);

        runTest("T01","successful mutation + verification",function () {
            var t = makeTarget("T01","before");
            var tx = core.transaction("Mutate Canary T01",[t],standardHandlers({after:"after"}),{});
            assertEq(tx.committed,1,"committed count");
            assertEq(tx.results[0].state,core.states.COMMITTED,"state");
            assertEq(String(t.contents),"after","mutated contents");
        });

        runTest("T02","precheck refusal",function () {
            var t = makeTarget("T02","before");
            var h = standardHandlers({after:"after"});
            h.precheck = function () { return {ok:false,reason:"intentional canary refusal"}; };
            var tx = core.transaction("Mutate Canary T02",[t],h,{});
            assertEq(tx.skipped,1,"skipped count");
            assertEq(tx.results[0].state,core.states.SKIPPED,"state");
            assertEq(String(t.contents),"before","contents unchanged");
        });

        runTest("T03","mutation throws before change",function () {
            var t = makeTarget("T03","before");
            var h = standardHandlers({after:"after"});
            h.mutate = function () { throw new Error("intentional pre-change mutation failure"); };
            var tx = core.transaction("Mutate Canary T03",[t],h,{});
            assertEq(tx.rolledBack,1,"rolled-back count");
            assertEq(tx.results[0].state,core.states.MUTATION_FAILED_ROLLED_BACK,"state");
            assertEq(String(t.contents),"before","prior state restored");
        });

        runTest("T04","partial mutation throws and rolls back",function () {
            var t = makeTarget("T04","before");
            var h = standardHandlers({after:"after"});
            h.mutate = function (target) {
                target.contents = "partial";
                throw new Error("intentional post-change mutation failure");
            };
            var tx = core.transaction("Mutate Canary T04",[t],h,{});
            assertEq(tx.results[0].state,core.states.MUTATION_FAILED_ROLLED_BACK,"state");
            assertEq(String(t.contents),"before","partial change restored");
        });

        runTest("T05","verification failure rolls back",function () {
            var t = makeTarget("T05","before");
            var h = standardHandlers({after:"after"});
            h.verify = function () { return {ok:false,reason:"intentional verification failure"}; };
            var tx = core.transaction("Mutate Canary T05",[t],h,{});
            assertEq(tx.results[0].state,core.states.VERIFICATION_FAILED_ROLLED_BACK,"state");
            assertEq(String(t.contents),"before","failed verification restored");
        });

        runTest("T06","rollback restores complete snapshot",function () {
            var t = makeTarget("T06","before");
            t.label = "label-before";
            var h = standardHandlers({after:"after"});
            h.mutate = function (target) {
                target.contents = "after";
                target.label = "label-after";
            };
            h.verify = function () { return false; };
            var tx = core.transaction("Mutate Canary T06",[t],h,{});
            assertEq(tx.results[0].state,core.states.VERIFICATION_FAILED_ROLLED_BACK,"state");
            assertEq(String(t.contents),"before","contents restored");
            assertEq(String(t.label),"label-before","label restored");
        });

        runTest("T07","broken rollback produces hard failure",function () {
            var t = makeTarget("T07","before");
            var h = standardHandlers({after:"after"});
            h.verify = function () { return false; };
            h.rollback = function () { /* intentionally does nothing */ };
            var tx = core.transaction("Mutate Canary T07",[t],h,{});
            assertEq(tx.rollbackFailures,1,"rollback failure count");
            assertTrue(tx.aborted === true,"transaction aborted");
            assertEq(tx.results[0].state,core.states.ROLLBACK_FAILED,"state");
            assertEq(String(t.contents),"after","failed rollback leaves changed canary target");
            try { app.undo(); } catch (ignoreUndo) { t.contents = "before"; }
            if (String(t.contents) !== "before") { t.contents = "before"; }
        });

        runTest("T08","rollback failure stops remaining batch",function () {
            var a = makeTarget("T08-A","before-a");
            var b = makeTarget("T08-B","before-b");
            var h = standardHandlers({after:"changed"});
            h.verify = function () { return false; };
            h.rollback = function () { /* intentionally broken for first target */ };
            var tx = core.transaction("Mutate Canary T08",[a,b],h,{});
            assertTrue(tx.aborted === true,"transaction aborted");
            assertEq(tx.processed,1,"only first target processed");
            assertEq(String(b.contents),"before-b","second target untouched");
            try { app.undo(); } catch (ignoreUndo) { a.contents = "before-a"; }
            if (String(a.contents) !== "before-a") { a.contents = "before-a"; }
        });

        runTest("T09","successful batch is one grouped Undo step",function () {
            var a = makeTarget("T09-A","before-a");
            var b = makeTarget("T09-B","before-b");
            var h = standardHandlers({after:"after"});
            h.mutate = function (target,snapshot,index) {
                target.contents = index === 0 ? "after-a" : "after-b";
            };
            h.verify = function (target,snapshot,index) {
                return String(target.contents) === (index === 0 ? "after-a" : "after-b");
            };
            var tx = core.transaction("Mutate Canary T09",[a,b],h,{});
            assertTrue(tx.undoGrouped === true,"undo grouping reported");
            assertEq(tx.committed,2,"both targets committed");
            app.undo();
            assertEq(String(a.contents),"before-a","first target restored by one Undo");
            assertEq(String(b.contents),"before-b","second target restored by same Undo");
        });

        runTest("T10","transaction journal is complete",function () {
            var a = makeTarget("T10-A","before-a");
            var b = makeTarget("T10-B","before-b");
            var tx = core.transaction("Mutate Canary T10",[a,b],standardHandlers({after:"after"}),{});
            assertEq(tx.requested,2,"requested");
            assertEq(tx.processed,2,"processed");
            assertEq(tx.results.length,2,"journal rows");
            assertTrue(tx.results[0].snapshotCaptured === true,"snapshot captured");
            assertTrue(tx.results[0].rollbackReady === true,"rollback readiness recorded");
            assertTrue(tx.results[0].mutationAttempted === true,"mutation attempt recorded");
            assertTrue(tx.results[0].verifyOk === true,"verification recorded");
            assertEq(tx.finalState,core.states.COMMITTED,"batch final state");
        });

        try { doc.save(inddFile); } catch (eSave) {
            runTest("SAVE","save canary INDD",function () { throw eSave; });
        }
        writeOutputs();

        alert("Localis mutation core canary v" + CANARY_VERSION + "\n\n" +
            "Core version: " + core.version + "\n" +
            "Checks: " + tests.length + "\n" +
            "Passed: " + (tests.length - failed) + "\n" +
            "Failed: " + failed + "\n\n" +
            (failed === 0 ? "PASS: portable rollback transaction core passed all canary checks." :
                "FAIL: do not integrate the mutation core into a production tool.") +
            "\n\nLog:\n" + logFile.fsName);
    } catch (fatal) {
        tests.push({id:"FATAL",name:"canary runtime",pass:false,detail:errText(fatal)});
        failed++;
        try { writeOutputs(); } catch (ignoreWrite) {}
        alert("Localis mutation core canary failed.\n\n" + errText(fatal));
    }

    function standardHandlers(spec) {
        spec = spec || {};
        return {
            describeTarget:function (target) { return String(target.label || "canary target"); },
            precheck:function () { return true; },
            snapshot:function (target) {
                return {
                    state:{contents:String(target.contents),label:String(target.label)},
                    rollbackReady:true,
                    reason:"canary snapshot captured"
                };
            },
            mutate:function (target) { target.contents = String(spec.after || "after"); },
            verify:function (target) { return String(target.contents) === String(spec.after || "after"); },
            rollback:function (target,state) {
                target.contents = state.contents;
                target.label = state.label;
            },
            verifyRollback:function (target,state) {
                return String(target.contents) === String(state.contents) &&
                    String(target.label) === String(state.label);
            }
        };
    }

    function makeTarget(label,contents) {
        var tf = page.textFrames.add();
        tf.geometricBounds = [10,10,30,120];
        tf.label = String(label);
        tf.contents = String(contents);
        return tf;
    }

    function runTest(id,name,fn) {
        try {
            fn();
            tests.push({id:id,name:name,pass:true,detail:"PASS"});
        } catch (e) {
            failed++;
            tests.push({id:id,name:name,pass:false,detail:errText(e)});
        }
    }

    function assertEq(actual,expected,label) {
        if (String(actual) !== String(expected)) {
            throw new Error(label + ": expected " + expected + ", found " + actual);
        }
    }

    function assertTrue(value,label) {
        if (value !== true) { throw new Error(label + ": expected true"); }
    }

    function writeOutputs() {
        var i;
        logFile.encoding = "UTF-8";
        logFile.lineFeed = "Windows";
        if (logFile.open("w")) {
            logFile.writeln("Localis mutation core canary v" + CANARY_VERSION);
            logFile.writeln("Core version: " + core.version);
            logFile.writeln("InDesign version: " + safeApp("version"));
            logFile.writeln("InDesign build: " + (safeApp("buildNumber") || "NOT_EXPOSED"));
            logFile.writeln("OS: " + safeOs());
            logFile.writeln("Timestamp: " + (new Date()).toString());
            logFile.writeln("");
            for (i = 0; i < tests.length; i++) {
                logFile.writeln((tests[i].pass ? "PASS" : "FAIL") + "\t" + tests[i].id + "\t" + tests[i].name + "\t" + tests[i].detail);
            }
            logFile.writeln("");
            logFile.writeln("CHECKS: " + tests.length);
            logFile.writeln("PASSED: " + (tests.length - failed));
            logFile.writeln("FAILED: " + failed);
            logFile.close();
        }

        csvFile.encoding = "UTF-8";
        csvFile.lineFeed = "Windows";
        if (csvFile.open("w")) {
            csvFile.write("\uFEFF");
            csvFile.writeln(csv(["Check","Name","Result","Detail"]));
            for (i = 0; i < tests.length; i++) {
                csvFile.writeln(csv([tests[i].id,tests[i].name,tests[i].pass ? "PASS" : "FAIL",tests[i].detail]));
            }
            csvFile.close();
        }
    }

    function csv(values) {
        var out = [], i, s;
        for (i = 0; i < values.length; i++) {
            s = String(values[i]).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,function (ch) {
                var h = ch.charCodeAt(0).toString(16).toUpperCase();
                while (h.length < 4) { h = "0" + h; }
                return "\\u" + h;
            }).replace(/"/g,'""');
            out.push('"' + s + '"');
        }
        return out.join(",");
    }

    function safeApp(prop) { try { return String(app[prop]); } catch (ignore) { return ""; } }
    function safeOs() { try { return String($.os); } catch (ignore) { return ""; } }

    function errText(e) {
        var a = [];
        try { if (e.message) { a.push(String(e.message)); } } catch (ignore1) {}
        try { if (e.number !== undefined) { a.push("Error " + String(e.number)); } } catch (ignore2) {}
        try { if (e.line !== undefined) { a.push("line " + String(e.line)); } } catch (ignore3) {}
        if (a.length === 0) { try { a.push(String(e)); } catch (ignore4) {} }
        return a.join(" | ");
    }
}());
