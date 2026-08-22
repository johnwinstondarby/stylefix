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
StyleFix Canary Suite - degraded evidence builder v1.0.8

Creates a saved INDD containing one unused candidate character style and then
adds that INDD to an OPEN InDesign Book. The fixture exists to prove that an
otherwise LOW candidate is classified MEDIUM when book scope is unresolved for
standalone deletion authorization.

The builder does not import or reuse StyleFix scanner code.
*/

(function () {
    var VERSION = "1.0.8";
    var SCHEMA = "2";
    var EXPECTED_SCANNER = "1.0.8";
    var FIXTURE_ID = "StyleFix-Degraded108-" + stamp();
    var doc = null, book = null, style = null;
    var failed = 0, log = [];
    var stem = "StyleFix_Canary_Degraded_v1_0_8";
    var indd = new File(Folder.desktop.fsName + "/" + stem + ".indd");
    var bookFile = new File(Folder.desktop.fsName + "/" + stem + ".indb");
    var logFile = new File(Folder.desktop.fsName + "/" + stem + "_Build.txt");
    var censusFile = new File(Folder.desktop.fsName + "/" + stem + "_Census.csv");

    try {
        doc = app.documents.add(true);
        doc.documentPreferences.facingPages = false;
        style = doc.characterStyles.add({name:"Unnamed Style M01"});
        doc.insertLabel("StyleFixFixtureVersion",VERSION);
        doc.insertLabel("StyleFixFixtureSchema",SCHEMA);
        doc.insertLabel("StyleFixFixtureId",FIXTURE_ID);
        doc.insertLabel("StyleFixExpectedScannerVersion",EXPECTED_SCANNER);
        doc.insertLabel("StyleFixFixtureSuiteMember","degraded-evidence");
        doc.insertLabel("StyleFixExpectedRiskM01","MEDIUM");

        step("SAVE INDD",function(){ doc.save(indd); });
        step("CREATE BOOK",function(){
            book = app.books.add(bookFile);
            if (!book || book.isValid !== true) { throw new Error("Book creation did not return a valid Book."); }
        });
        step("ADD INDD TO BOOK",function(){
            var bc = book.bookContents.add(indd);
            if (!bc || bc.isValid !== true) { throw new Error("BookContents.add did not return a valid BookContent."); }
            if (fileKey(bc.fullName) !== fileKey(indd)) {
                throw new Error("BookContent fullName does not match degraded fixture INDD.");
            }
        });
        step("VERIFY UNUSED CANDIDATE",function(){
            var i, stories = doc.stories, j, ranges, ref;
            for (i = 0; i < stories.length; i++) {
                ranges = stories.item(i).textStyleRanges;
                for (j = 0; j < ranges.length; j++) {
                    ref = ranges.item(j).appliedCharacterStyle;
                    if (sameStyle(ref,style)) { throw new Error("M01 unexpectedly has direct text usage."); }
                }
            }
        });
        step("VERIFY OPEN BOOK MEMBERSHIP",function(){
            var i, found = false, contents = book.bookContents;
            for (i = 0; i < contents.length; i++) {
                if (fileKey(contents.item(i).fullName) === fileKey(indd)) { found = true; break; }
            }
            if (!found) { throw new Error("Open book does not contain degraded fixture INDD."); }
        });

        writeCensus();
        writeLog();

        if (failed === 0) {
            alert("StyleFix degraded-evidence fixture built successfully.\n\n" +
                "INDD:\n" + indd.fsName +
                "\n\nOPEN BOOK:\n" + bookFile.fsName +
                "\n\nExpected StyleFix result:\nUnnamed Style M01 = MEDIUM\nBookScopeAcceptable = NO\n\n" +
                "Leave the book open while running StyleFix v" + EXPECTED_SCANNER + ".");
        } else {
            alert("StyleFix degraded-evidence fixture is INCOMPLETE.\n\nFAILED STEPS: " + failed +
                "\n\nDo not use it as release evidence.\n\n" + logFile.fsName);
        }
    } catch (fatal) {
        failed++;
        log.push("FAIL\tFATAL\t" + errText(fatal));
        try { writeCensus(); } catch (ignoreCensus) {}
        try { writeLog(); } catch (ignoreLog) {}
        alert("StyleFix degraded-evidence builder v" + VERSION + " failed.\n\n" + errText(fatal));
    }

    function step(name,fn) {
        try { fn(); log.push("PASS\t" + name); }
        catch (e) { failed++; log.push("FAIL\t" + name + "\t" + errText(e)); }
    }

    function writeCensus() {
        censusFile.encoding = "UTF-8"; censusFile.lineFeed = "Windows";
        if (!censusFile.open("w")) { return; }
        censusFile.write("\uFEFF");
        censusFile.writeln(csv(["Fixture Version","Fixture Schema","Fixture ID","Expected Scanner","Control","Expected Risk","Book Open","Book Contains INDD","Direct Use Expected"]));
        censusFile.writeln(csv([VERSION,SCHEMA,FIXTURE_ID,EXPECTED_SCANNER,"M01","MEDIUM",
            (book && book.isValid === true) ? "YES" : "NO",
            bookContainsIndd() ? "YES" : "NO","NO"]));
        censusFile.close();
    }

    function writeLog() {
        var i;
        logFile.encoding = "UTF-8"; logFile.lineFeed = "Windows";
        if (!logFile.open("w")) { return; }
        logFile.writeln("StyleFix degraded-evidence builder v" + VERSION);
        logFile.writeln("Expected scanner: " + EXPECTED_SCANNER);
        logFile.writeln("Fixture schema: " + SCHEMA);
        logFile.writeln("Fixture ID: " + FIXTURE_ID);
        logFile.writeln("INDD: " + indd.fsName);
        logFile.writeln("Book: " + bookFile.fsName);
        logFile.writeln("InDesign version: " + safeApp("version"));
        logFile.writeln("InDesign build: " + (safeApp("buildNumber") || "NOT_EXPOSED"));
        logFile.writeln("OS: " + safeOs());
        logFile.writeln("Timestamp: " + (new Date()).toString());
        logFile.writeln("");
        for (i = 0; i < log.length; i++) { logFile.writeln(log[i]); }
        logFile.writeln("");
        logFile.writeln("FAILED STEPS: " + failed);
        logFile.close();
    }

    function bookContainsIndd() {
        var i, contents;
        if (!book || book.isValid !== true) { return false; }
        try {
            contents = book.bookContents;
            for (i = 0; i < contents.length; i++) {
                if (fileKey(contents.item(i).fullName) === fileKey(indd)) { return true; }
            }
        } catch (ignore) {}
        return false;
    }

    function sameStyle(a,b) {
        if (!a || !b) { return false; }
        try { return String(a.id) === String(b.id); } catch (ignoreId) {}
        try { return String(a.name) === String(b.name); } catch (ignoreName) {}
        return false;
    }

    function fileKey(f) {
        try { return String(f.fsName).replace(/\\/g,"/").toLowerCase(); }
        catch (e) { try { return String(f).replace(/\\/g,"/").toLowerCase(); } catch (ignore) { return ""; } }
    }

    function csv(values) {
        var out = [], i, s;
        for (i = 0; i < values.length; i++) {
            s = String(values[i]).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,function(ch){
                var h = ch.charCodeAt(0).toString(16).toUpperCase();
                while (h.length < 4) { h = "0" + h; }
                return "\\u" + h;
            }).replace(/"/g,'""');
            out.push('"' + s + '"');
        }
        return out.join(",");
    }

    function safeApp(prop) { try { return String(app[prop]); } catch (e) { return ""; } }
    function safeOs() { try { return String($.os); } catch (e) { return ""; } }
    function errText(e) {
        var a = [];
        try { if (e.message) { a.push(String(e.message)); } } catch (ignore1) {}
        try { if (e.number !== undefined) { a.push("Error " + e.number); } } catch (ignore2) {}
        try { if (e.line !== undefined) { a.push("line " + e.line); } } catch (ignore3) {}
        return a.join(" | ");
    }
    function stamp() {
        var d = new Date();
        return d.getFullYear() + two(d.getMonth()+1) + two(d.getDate()) + "-" +
            two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
    }
    function two(n) { return n < 10 ? "0" + n : String(n); }
}());
