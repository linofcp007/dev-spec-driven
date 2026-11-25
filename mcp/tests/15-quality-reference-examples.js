"use strict";
// Spec quality — Reference examples (1.41): .specs/steering/structure.md's `## Reference Examples` table (Pattern · Copy · Applies to),
// its reader (a table only, its columns by header, 30 rows, cells cut), the gone-file predicate (ONE path per Copy cell — every doubt
// not judged), doctor's `reference-examples` (project-level, lean = full) and the brief's Reference examples part. Every fixture below
// was written from a mutation of the rule it names (the mutation list came first): each must fail without it. The cells are the real
// shapes 1.35 review 3 collected for the registry's stalePath (packages, aliases, prose, a site, a glob, a folder…).

const fs = require("fs");
const path = require("path");

exports.run = async ({ ok, all, eq, S, tmp, fsCalls, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const I = require(path.join(__dirname, "lib", "i18n.js"));
  const Q = (l) => I.msg(l || "en").quality;
  const B = (l) => I.brief(l || "en");
  const DEMO = path.join(__dirname, "..", "examples", "demo-project");
  const demo = (n) => {
    const p = path.join(tmp, "proj-refex-" + n);
    fs.cpSync(DEMO, p, { recursive: true });
    return p;
  };
  const write = (p, rel, text) => { const f = path.join(p, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  const STRUCT = ".specs/steering/structure.md";
  const FILE = ".specs/steering/structure.md";
  const table = (head, rows) => ["| " + head.join(" | ") + " |", "|" + head.map(() => "---").join("|") + "|", ...rows.map((r) => "| " + r.join(" | ") + " |")].join("\n");
  const structure = (p, section, heading = "Reference Examples") => write(p, STRUCT, "# Project Structure\n\n## Layout\nsrc/ holds the code.\n\n## " + heading + "\n\n" + section + "\n\n## Naming\nkebab-case files.\n");
  const check = (p, lang) => E.referenceExamplesCheck(p, lang || "en");

  // --- the reader: a table only, columns by header (else by position), slot rows skipped, 30 rows, a cell cut at 200 -------------------
  {
    const p = demo("reader");
    const rows = [["A new API key service", "`src/api-keys/service.js`", "`src/api-keys/**`"], ["[pattern]", "[file to copy]", "[glob]"], ["Dash", "—", ""], ["Empty", "", ""]];
    structure(p, "<!-- the table the brief quotes -->\n" + table(["Pattern", "Copy", "Applies to"], rows));
    const r1 = E.referenceExamples(p);
    // reordered: the header decides, never the position
    structure(p, table(["Applies to", "Pattern", "Copy"], [["src/**", "Reordered", "src/api-keys/service.js"]]));
    const r2 = E.referenceExamples(p);
    // no header known: positions 1 · 2 · 3
    structure(p, table(["What", "File", "Where"], [["By position", "src/api-keys/service.js", "src/**"]]));
    const r3 = E.referenceExamples(p);
    // 31 rows: the 31st is not read, said; a long cell is cut
    structure(p, table(["Pattern", "Copy", "Applies to"], Array.from({ length: 31 }, (_, i) => ["P" + i + (i === 0 ? " " + "w".repeat(300) : ""), "src/api-keys/service.js", ""])));
    const r4 = E.referenceExamples(p);
    // a table inside a fence or a comment is none; a bullet-only section has no table
    structure(p, "```\n" + table(["Pattern", "Copy", "Applies to"], [["Fenced", "src/x.js", ""]]) + "\n```\n<!--\n" + table(["Pattern", "Copy"], [["Hidden", "src/y.js"]]) + "\n-->\n- Patterns to follow: `src/api-keys/service.js` demonstrates the service shape.");
    const r5 = E.referenceExamples(p);
    all("1.41 reference examples: the reader — the section's first table, its columns by header (reordered) else by position, slot / dash / empty Copy rows skipped, 30 rows read (31st counted), a cell cut at 200; a fenced or commented table and bullets are no table (got " +
      js([r1, r2, r3, r4 && { total: r4.total, truncated: r4.truncated, len: r4.rows[0].pattern.length }, r5]) + ")", {
      first: r1.table === true && r1.total === 1 && js(r1.rows[0]) === js({ pattern: "A new API key service", copy: "`src/api-keys/service.js`", appliesTo: "`src/api-keys/**`" }) && r1.file === FILE,
      reordered: js(r2.rows[0]) === js({ pattern: "Reordered", copy: "src/api-keys/service.js", appliesTo: "src/**" }),
      positions: js(r3.rows[0]) === js({ pattern: "By position", copy: "src/api-keys/service.js", appliesTo: "src/**" }),
      bound: r4.total === 30 && r4.truncated === 1 && r4.rows[0].pattern.length === 200,
      noTable: r5 && r5.table === false,
    });
    // PT / ES headings and columns; no structure.md / no section → null
    structure(p, table(["Padrão", "Aplica-se a", "Copiar"], [["Um serviço", "src/**", "src/api-keys/service.js"]]), "Exemplos de Referência");
    const pt = E.referenceExamples(p);
    structure(p, table(["Patrón", "Copiar", "Se aplica a"], [["Un servicio", "src/api-keys/service.js", "src/**"]]), "Ejemplos de Referencia");
    const es = E.referenceExamples(p);
    structure(p, "nothing here", "Something Else");
    const none = E.referenceExamples(p);
    all("1.41 reference examples: the PT (Exemplos de Referência · Padrão / Copiar / Aplica-se a) and ES (Ejemplos de Referencia · Patrón / Copiar / Se aplica a) headings and columns read; no such section → null (got " + js([pt, es, none]) + ")", {
      pt: pt && js(pt.rows[0]) === js({ pattern: "Um serviço", copy: "src/api-keys/service.js", appliesTo: "src/**" }),
      es: es && js(es.rows[0]) === js({ pattern: "Un servicio", copy: "src/api-keys/service.js", appliesTo: "src/**" }),
      none: none === null && E.referenceExamples(path.join(tmp, "proj-refex-nowhere")) === null,
    });
  }

  // --- the gone predicate: ONE path per Copy cell; gone only for a project file whose first folder is there -------------------------------
  {
    const p = demo("gone");
    write(p, "src/components/Card.tsx", "x");
    write(p, "_shared/Badge.tsx", "x");
    write(p, "README.md", "# x\n");
    const root = path.resolve(p);
    const notJudged = ["next/link", "primereact/button", "~/components/Button.vue", "#components/Button.vue", "N/A.", "n/a (custom, e.g. inline)", "Built into the layout.",
      "storybook.example.com/button.html", "src/components/*.tsx", "src/components/Card", "built with Node.js", "file.py::handler", "src/api-keys/service.js#verify",
      "https://example.com/x.js", "gone-root.js", "lost/folder/x.ts", "was src/old/Card.jsx, now src/components/Card.tsx", "src/components"];
    const there = ["src/components/Card.tsx", "`src/components/Card.tsx` (see docs/Gone.md)", "[Card docs](src/components/Card.tsx)", "_shared/Badge.tsx", "README.md", "src/api-keys/service.js:12"];
    const gone = ["src/components/Gone.tsx", "[Gone](src/components/Gone.tsx)", "`src/components/Gone.tsx:12`", "src/components/No Such/Lost.tsx", "src/runbook-template.md", "src/components/Gone.tsx (see README.md)"];
    // (the predicate is internal: judged through the doctor's list, which names each gone file as its project path, in row order)
    const goneOf = (cells) => { structure(p, table(["Pattern", "Copy", "Applies to"], cells.map((c, i) => ["R" + i, c, ""]))); const c = check(p); return c && c.status === "warn" ? c.detail : ""; };
    const nj = goneOf(notJudged.concat(there));
    const gd = goneOf(gone);
    all("1.41 reference examples: a Copy cell is gone only when it names a file of the project (an extension) whose first folder is there and the file is not — a package, an alias, prose, a site, a glob, a folder, a root-level file, a gone first folder, `file.py::func`, `x.ts#name`, a URL are never judged; a file there (beside a note, behind a link, with a :12 anchor) is there; a document is judged too (got " +
      js([nj, gd]) + ")", {
      notJudged: nj === "" && root.length > 0,
      gone: gd === Q().refExamplesGone(["src/components/Gone.tsx", "src/components/Gone.tsx", "src/components/Gone.tsx", "src/components/No Such/Lost.tsx", "src/runbook-template.md", "src/components/Gone.tsx"].map((x) => "`" + x + "`").join(", "), 0, FILE),
    });
  }

  // --- doctor's reference-examples: warn (gone ≤ 6 named + more · rows past 30), pass (all there · no table: not read), absent ----------
  {
    const p = demo("doctor");
    const docOf = () => (S.specDoctor(p, "api-keys").checks || []).filter((c) => c.id === "reference-examples");
    const d0 = docOf();
    structure(p, table(["Pattern", "Copy", "Applies to"], Array.from({ length: 8 }, (_, i) => ["G" + i, "src/api-keys/gone-" + i + ".js", ""])));
    const d1 = docOf();
    structure(p, table(["Pattern", "Copy", "Applies to"], Array.from({ length: 31 }, (_, i) => ["P" + i, "src/api-keys/service.js", ""])));
    const d2 = docOf();
    structure(p, table(["Pattern", "Copy", "Applies to"], [["Service", "src/api-keys/service.js", "src/**"]]));
    const d3 = docOf();
    structure(p, "- `src/api-keys/service.js` demonstrates the service.");
    const d4 = docOf();
    structure(p, table(["Pattern", "Copy", "Applies to"], [["[pattern]", "[file]", "[glob]"]]));
    const d5 = docOf();
    all("1.41 reference examples: doctor — no section: no entry; 8 gone files: a warn naming 6 (+2 more); 31 rows: a warn for the one not read; every file there: a pass; a section without a table: a pass saying it is not read; only slot rows: no entry (got " + js([d0, d1, d2, d3, d4, d5]) + ")", {
      absent: d0.length === 0 && d5.length === 0,
      gone: d1.length === 1 && d1[0].status === "warn" && d1[0].detail === Q().refExamplesGone([0, 1, 2, 3, 4, 5].map((i) => "`src/api-keys/gone-" + i + ".js`").join(", "), 2, FILE),
      truncated: d2.length === 1 && d2[0].status === "warn" && d2[0].detail === Q().refExamplesTruncated(1, 30, FILE),
      pass: d3.length === 1 && d3[0].status === "pass" && d3[0].detail === Q().refExamplesOk(1, FILE),
      unread: d4.length === 1 && d4[0].status === "pass" && d4[0].detail === Q().refExamplesUnread(FILE),
    });
    // lean = full: the lean doctor (next_action's) runs it while every other check passes, skips it only once one warns or fails
    const entry = E.DOCTOR_CHECKS.find((e) => e.id === "reference-examples");
    structure(p, table(["Pattern", "Copy", "Applies to"], [["Gone", "src/api-keys/gone.js", ""]]));
    const full = S.specDoctor(p, "api-keys"), na = S.nextAction(p, "api-keys");
    all("1.41 reference examples: lean = full — the entry runs last, in a lean doctor only while every other check passes (its warn can't change a non-pass verdict); next_action's verdict = spec_doctor's (got " + js([full.verdict, na.verdict]) + ")", {
      last: entry && entry.last === true,
      leanAllPass: entry.applies({ lean: true, checks: [{ status: "pass" }] }) === true,
      leanWarned: entry.applies({ lean: true, checks: [{ status: "pass" }, { status: "warn" }] }) === false,
      full: entry.applies({ lean: false, checks: [{ status: "fail" }] }) === true,
      verdict: full.verdict === na.verdict,
    });
    // spec_upgrade: a project-level warn never makes a feature an attention item on its own
    const up = S.specUpgrade(p);
    const f = (up.features || []).find((x) => x.name === "api-keys");
    ok(f && f.doctor.warnings.includes("reference-examples") && !(f.attention.includes("warnings") && f.doctor.warnings.every((w) => w === "reference-examples")),
      "1.41 reference examples: spec_upgrade lists the warn, never as an attention item by itself (got " + js(f && [f.doctor.warnings, f.attention]) + ")");
    // the cost: one reading per row — the lean skip reads no Copy file, the check's lstats are the rows' segments (an exact count)
    structure(p, table(["Pattern", "Copy", "Applies to"], Array.from({ length: 30 }, (_, i) => ["W" + i, "src/api-keys/deep/er/x-" + i + ".js", ""])));
    const src = path.join(path.resolve(p), "src") + path.sep;
    const calls = fsCalls(src, () => check(p));
    const leanCalls = fsCalls(src, () => E.DOCTOR_CHECKS.find((e) => e.id === "reference-examples").applies({ lean: true, checks: [{ status: "warn" }] }) && check(p));
    // per row: onDisk(src) = 0 under src/ (it IS src) — then onDisk(src/api-keys/deep/…): src (not under src/), api-keys ✓, deep ✗ → 2 lstats
    eq({ lstat: calls.lstatSync || 0, lean: Object.keys(leanCalls).length }, { lstat: 30 * 2, lean: 0 },
      "1.41 reference examples: the check's cost is one reading per row (30 rows × 2 lstats under src/ — the walk stops at the first missing segment), and a lean doctor that already warns reads none");
  }

  // --- the brief's part: the rows for the task's files (globs, else the Copy file's folder), a gone one named, bounded, refs ------------
  {
    const p = demo("brief");
    write(p, "src/billing/total.js", "x");
    structure(p, table(["Pattern", "Copy", "Applies to"], [
      ["A service", "`src/api-keys/service.js`", "`src/api-keys/**`"], // glob — matches the tasks implementing src/api-keys/service.js
      ["Sibling", "src/api-keys/service.js", ""], // no glob: the Copy file's folder is a target's folder
      ["Gone one", "src/api-keys/verify-old.js", "src/**"], // gone: named, never quoted
      ["Elsewhere", "src/billing/total.js", "src/billing/**"], // not for this task
      ["Parent folder", "src/x.js", ""], // its folder src/ is no target's folder (a target's PARENT)
    ]));
    const b = S.taskBrief(p, "api-keys", 5, {});
    const w = S.taskBrief(p, "api-keys", 5, { write: true });
    all("1.41 reference examples: the brief quotes the rows whose Applies-to glob matches the task's files, or (no glob) whose Copy file shares a target's folder — never another folder's row, nor a parent folder's; a gone file is named, never quoted; write: refs.examples (got " + js([b.examples, w.refs && w.refs.examples]) + ")", {
      quoted: b.examples && js(b.examples.quoted.map((r) => r.pattern)) === js(["A service", "Sibling"]) && b.examples.quoted[0].copy === "src/api-keys/service.js",
      gone: js(b.examples.gone) === js(["src/api-keys/verify-old.js"]) && b.brief.includes(B().examplesGone("`src/api-keys/verify-old.js`")) && !b.brief.includes("**Gone one**"),
      notOthers: !b.brief.includes("Elsewhere") && !b.brief.includes("Parent folder"),
      rendered: b.brief.includes(B().examples + "\n" + B().examplesRule(FILE) + "\n- **A service** — `src/api-keys/service.js` (`src/api-keys/**`)"),
      refs: w.refs && js(w.refs.examples) === js({ quoted: 2, gone: ["src/api-keys/verify-old.js"], total: 5 }) && !("examples" in w),
    });
    // a task whose files no row is for: the count, never a row; an absolute _Implements:_ inside the project matches (briefTargets)
    const t = path.join(p, ".specs", "api-keys", "tasks.md");
    fs.writeFileSync(t, fs.readFileSync(t, "utf8").replace("- [ ] 2. [shared][P] Add `api_keys` table migration + indexes (`hash`, `(tenant_id,status)`)",
      "- [ ] 2. [shared][P] Add `api_keys` table migration + indexes (`hash`, `(tenant_id,status)`)\n  - _Implements: db/migrations/001.sql_\n- [ ] 20. Absolute\n  - _Implements: " + path.join(path.resolve(p), "src", "api-keys", "new.js").split(path.sep).join("/") + "_\n" +
      "- [ ] 21. A folder\n  - _Implements: src/api-keys/_"));
    const b2 = S.taskBrief(p, "api-keys", 2, {});
    const b20 = S.taskBrief(p, "api-keys", 20, {});
    const b21 = S.taskBrief(p, "api-keys", 21, {});
    all("1.41 reference examples: rows but none for the task's files → the count, no row; an absolute _Implements:_ path inside the project reads as its project path; a FOLDER target is its own folder, never its parent's (got " + js([b2.examples, b20.examples && b20.examples.quoted.map((r) => r.pattern), b21.examples && b21.examples.quoted.map((r) => r.pattern)]) + ")", {
      noMatch: b2.examples && !b2.examples.quoted.length && b2.brief.includes(B().examplesNoMatch(5, FILE)),
      absolute: b20.examples && js(b20.examples.quoted.map((r) => r.pattern)) === js(["A service", "Sibling"]),
      folder: b21.examples && js(b21.examples.quoted.map((r) => r.pattern)) === js(["A service", "Sibling"]),
    });
    // the bound: 6 rows within 1,200 characters, the rest counted
    structure(p, table(["Pattern", "Copy", "Applies to"], Array.from({ length: 9 }, (_, i) => ["Row " + i + (i === 7 ? " " + "z".repeat(190) : ""), "src/api-keys/service.js", "src/api-keys/**"])));
    const b3 = S.taskBrief(p, "api-keys", 5, {});
    ok(b3.examples.quoted.length === 6 && b3.examples.omitted === 3 && b3.brief.includes(B().examplesOmitted(3, FILE)),
      "1.41 reference examples: a brief quotes at most 6 rows, the rest counted (got " + js([b3.examples.quoted.length, b3.examples.omitted]) + ")");
    // (6 rows of 200 + 23 + 15 characters: 5 fit in 1,200 — the 6th is counted, never quoted past the budget)
    structure(p, table(["Pattern", "Copy", "Applies to"], Array.from({ length: 6 }, (_, i) => ["Long " + i + " " + "q".repeat(300), "src/api-keys/service.js", "src/api-keys/**"])));
    const b4 = S.taskBrief(p, "api-keys", 5, {});
    ok(b4.examples.quoted.length === 5 && b4.examples.omitted === 1 && b4.examples.quoted.reduce((s, r) => s + r.pattern.length + r.copy.length + r.appliesTo.length, 0) <= 1200,
      "1.41 reference examples: the quoted rows stay within 1,200 characters (got " + js([b4.examples.quoted.length, b4.examples.omitted]) + ")");
    // no table row: no part, no key (= 1.40)
    const p0 = demo("brief-none");
    const b0 = S.taskBrief(p0, "api-keys", 5, {});
    ok(!("examples" in b0) && !b0.brief.includes(B().examples), "1.41 reference examples: a brief without the table has no Reference examples part and no key");
  }

  // --- 1.41.0 review 1 (R1-L-2): a Copy cell naming MORE than one path — a second code span, or `,` / `;` / and (e / y) between two
  // paths — is a doubt: never judged gone, quoted by the brief as written (`asWritten`); a note beside ONE path is no list ----------
  {
    const p = demo("doubt");
    write(p, "src/api-keys/service.test.js", "x");
    const A = "src/api-keys/**";
    const rows = [
      ["Service + test", "`src/api-keys/service.js`, `src/api-keys/service.test.js`", A], // the reviewer's shapes: both files there
      ["Service and test", "src/api-keys/service.js and src/api-keys/service.test.js", A],
      ["Gone single", "src/api-keys/gone-single.js", A], // still judged
      ["Spans", "`src/api-keys/gone-a.js` `src/api-keys/gone-b.js`", A], // two code spans, no separator
      ["Semicolon", "src/api-keys/gone-a.js; src/api-keys/gone-b.js", A],
      ["Noted", "src/api-keys/gone-note.js (the old one, with its verify)", A], // ONE file name: a note, still judged
      ["Plain", "src/api-keys/service.js", A],
      ["PT", "src/api-keys/gone-a.js e src/api-keys/gone-b.js", "lib/**"], ["ES", "src/api-keys/gone-a.js y src/api-keys/gone-b.js", "lib/**"],
      ["Folder, file", "src/api-keys/, src/api-keys/service.js", "lib/**"], // a folder is path-like too (read as ONE path it was a gone file)
    ];
    structure(p, table(["Pattern", "Copy", "Applies to"], rows));
    const d = check(p);
    const b = S.taskBrief(p, "api-keys", 5, {});
    const q = (b.examples && b.examples.quoted) || [];
    const row = (pattern) => q.find((r) => r.pattern === pattern) || {};
    const line = (r) => "- **" + r[0] + "** — " + r[1] + " (" + r[2] + ")";
    all("1.41.0 review 1: a Copy cell naming two files (`a`, `b` · a and b · `a` `b` · a; b · a e b · a y b) is never judged gone — doctor names only the single gone paths; the brief quotes such a row as written (asWritten), a plain one as its path, and names the single gone ones (got " +
      js({ d, quoted: q, gone: b.examples && b.examples.gone }) + ")", {
      doctor: d && d.status === "warn" && d.detail === Q().refExamplesGone("`src/api-keys/gone-single.js`, `src/api-keys/gone-note.js`", 0, FILE),
      quoted: js(q.map((r) => r.pattern)) === js(["Service + test", "Service and test", "Spans", "Semicolon", "Plain"]),
      asWritten: [0, 1, 3, 4].every((i) => row(rows[i][0]).copy === rows[i][1] && row(rows[i][0]).asWritten === true) &&
        row("Plain").copy === "src/api-keys/service.js" && !("asWritten" in row("Plain")),
      rendered: b.brief.includes(line(rows[0])) && b.brief.includes(line(rows[1])) && b.brief.includes("- **Plain** — `src/api-keys/service.js` (" + A + ")"),
      gone: js(b.examples.gone) === js(["src/api-keys/gone-single.js", "src/api-keys/gone-note.js"]),
    });
    // still judged: a single gone path, with or without backticks — the doubt is only a list
    structure(p, table(["Pattern", "Copy", "Applies to"], [["One", "`src/api-keys/gone-one.js`", ""]]));
    const d1 = check(p);
    ok(d1 && d1.status === "warn" && d1.detail === Q().refExamplesGone("`src/api-keys/gone-one.js`", 0, FILE), "1.41.0 review 1: a single gone Copy path still warns (got " + js(d1) + ")");
  }

  // --- 1.41.0 review 1 (M22): without a glob, a Copy file's folder matches a target's folder case-folded where the file system folds case
  {
    const p = demo("fold");
    structure(p, table(["Pattern", "Copy", "Applies to"], [["Upper", "SRC/API-KEYS/service.js", ""]]));
    const b = S.taskBrief(p, "api-keys", 5, {});
    const got = b.examples ? b.examples.quoted.map((r) => r.pattern) : null;
    ok(js(got) === js(E.FOLD_CASE ? ["Upper"] : []), "1.41.0 review 1: a no-glob row's Copy folder differing from the task's only by case is quoted where case folds, never elsewhere (got " + js(got) + ")");
  }

  // --- 1.41.0 review 1 (R1-L-3): the check reads the table and its Copy paths ONCE per engine call — spec_upgrade runs the full doctor
  // per feature, so over 6 features it lstat'ed each Copy path's folders 3× what it did over 2. COUNTED: exactly equal; each feature
  // still words the warn in its own language. In one scope: a write of structure.md reads the table again, and another project reads
  // its own files (the same table text).
  {
    const proj = (n) => {
      const p = path.join(tmp, "proj-refex-upgrade-" + n);
      S.initProject(p, ["core"], "en");
      for (let i = 0; i < n; i++) S.createFeature(p, "Feature " + i, ["core"], "Feature " + i + " does a thing", undefined, i === 1 ? "pt" : "en");
      for (let i = 0; i < 30; i++) write(p, "src/a/b/c" + i + "/x.ts", "x");
      structure(p, table(["Pattern", "Copy", "Applies to"], Array.from({ length: 30 }, (_, i) => ["P" + i, i === 0 ? "src/a/b/gone/x.ts" : "src/a/b/c" + i + "/x.ts", "src/a/**"])));
      return p;
    };
    const p2 = proj(2), p6 = proj(6);
    const count = (p) => fsCalls(path.join(path.resolve(p), "src") + path.sep, () => S.specUpgrade(p)).lstatSync || 0;
    const c2 = count(p2), c6 = count(p6);
    const up = S.specUpgrade(p6);
    const warnOf = (slug) => (S.specDoctor(p6, slug).checks || []).find((c) => c.id === "reference-examples");
    const gone = "`src/a/b/gone/x.ts`";
    const pt = warnOf("feature-1"), en = warnOf("feature-0");
    // one scope: the table rewritten through the engine's writer, then another project with the same text and the gone file present
    const pw = demo("memo-write"), pa = demo("memo-a"), pb = demo("memo-b");
    structure(pw, table(["Pattern", "Copy", "Applies to"], [["Gone", "src/api-keys/gone.js", ""]]));
    for (const x of [pa, pb]) structure(x, table(["Pattern", "Copy", "Applies to"], [["Gone", "src/api-keys/gone.js", ""]]));
    write(pb, "src/api-keys/gone.js", "x");
    const scoped = S.withReadCache(() => {
      const before = check(pw);
      E.writeFileAtomic(path.join(pw, STRUCT), "# Project Structure\n\n## Reference Examples\n\n" + table(["Pattern", "Copy", "Applies to"], [["There", "src/api-keys/service.js", ""]]) + "\n");
      return { before, after: check(pw), a: check(pa), b: check(pb) };
    });
    all("1.41.0 review 1: reference-examples is read ONCE per engine call — spec_upgrade over 6 features lstats exactly what it does over 2, each feature's warn in its own language; in one scope a write of structure.md is read again and another project reads its own files (got " +
      js({ c2, c6, pt: pt && pt.detail, scoped: Object.fromEntries(Object.entries(scoped).map(([k, v]) => [k, v && v.status])) }) + ")", {
      setup: up.ok !== false && (up.features || []).length === 6 && c2 > 0,
      once: c6 === c2,
      languages: pt && pt.detail === Q("pt").refExamplesGone(gone, 0, FILE) && en && en.detail === Q().refExamplesGone(gone, 0, FILE),
      rewritten: scoped.before.status === "warn" && scoped.after.status === "pass",
      perProject: scoped.a.status === "warn" && scoped.b.status === "pass",
    });
  }

  // --- 1.41.0 review 1 (R1-L-5): an Applies-to folder matches through a glob — the references say a folder needs `/**` -------------------
  {
    const rd = (f) => fs.readFileSync(path.join(__dirname, "..", "skills", "dev-spec-driven", "references", f), "utf8").replace(/\s+/g, " ");
    const st = rd("steering-templates.md"), tr = rd("tooling-reference.md");
    const says = (t) => /Applies-to folder needs `\/\*\*`/.test(t);
    ok(says(st) && says(tr), "1.41.0 review 1: steering-templates.md and tooling-reference.md say an Applies-to folder needs `/**` (`src/api-keys/**`, never `src/api-keys/`)");
  }
};
