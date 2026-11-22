"use strict";
// Spec quality — +ui's state matrix (1.38): doctor's ui-states over [UI] UI States (the scaffold's table, recognised by its a11y
// header cell; a warn at m / l / no size, a note at s, never a fail, never on a finished feature), the corpus key it reads (an
// English doctor loads no other language) and spec_upgrade's advisory listing. Every fixture below was written from a mutation of
// the rule it names (the mutation list came first): each must fail without it.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ all, rpc, payload, S, tmp, approveBefore, remeasure, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const E = require(path.join(__dirname, "lib", "engine", "index.js"));
  const I = require(path.join(__dirname, "lib", "i18n.js"));
  const Q = (l) => I.msg(l || "en").quality;
  const LABELS = (l) => Object.values(Q(l).uiStateLabels);
  const L = (id, l) => Q(l).uiStateLabels[id]; // (lazy: the parent has no such key)
  const table = (header, rows) => ["| " + header.join(" | ") + " |", "|" + "---|".repeat(header.length), ...rows.map((r) => "| " + r.join(" | ") + " |")].join("\n");
  // the matrix: a row per label (EN by default), `cell(label, view)` in each view, the a11y cell `o.a11y(label)` (blank by default)
  const matrix = (views, cell, o = {}) => table(["State", ...views, o.a11yHead || "Announced · focus", ...(o.after || [])],
    (o.labels || LABELS()).map((l) => [l, ...views.map((v) => cell(l, v)), o.a11y ? o.a11y(l) : "", ...(o.after || []).map(() => "")]));
  const said = (l, v) => l.toLowerCase() + " in " + v + ": what it shows, and a Retry";
  const states = (body, o = {}) => "# Design: Orders\n\n## Overview\nOne page.\n\n" + (o.before || "") + "## [UI] UI States\nEach view, state by state.\n\n" + body +
    "\n\n## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n";
  const check = (design, size = "m", lang = "en") => E.uiStatesCheck(design, lang, { size });
  const gapOf = (n, ...items) => Q().usOpen(n, items.join("; "));

  // --- what a matrix is: the scaffold's a11y header cell, the views between, nothing after --------------------------------------------
  {
    const st = {};
    const one = (tag, body, size) => { st[tag] = check(states(body), size); };
    one("full", matrix(["Orders list", "Order detail"], said));
    one("machine", table(["State", "Event", "Next state"], [["Idle", "fetch", "Loading"], ["Loading", "resolve", "Success"], ["Loading", "reject", "Error"], ["Error", "retry", "Loading"]]));
    one("looks", table(["State", "Looks"], [["Loading", "a skeleton"], ["Error", "a banner"]]));
    one("announced", matrix(["Orders list"], (l) => (l === "Undo" ? "" : said(l, "list")), { a11yHead: "Announced" }));
    one("announcedMore", matrix(["Orders list"], (l) => (l === "Undo" ? "" : said(l, "list")), { a11yHead: "Announced · focus (WCAG 4.1.3)" }));
    one("es", matrix(["Orders list"], (l) => (l === "Undo" ? "" : said(l, "list")), { a11yHead: "Anunciado · foco" }));
    one("notes", matrix(["Orders list"], said, { after: ["Notes"] }));
    one("a11yBlank", matrix(["Orders list"], said, { a11y: (l) => (l === "Worst case" ? "" : "status · focus stays") }));
    one("blankCol", matrix(["Orders list", ""], (l, v) => (v ? said(l, v) : "")));
    one("slotCol", matrix(["Orders list", "[view]"], (l, v) => (v === "Orders list" ? said(l, v) : "")));
    one("noView", table(["State", "Announced · focus"], [["Loading", "status"], ["Error", "alert"]]));
    const gappy = matrix(["Orders list"], (l) => (l === "Stale" ? "" : said(l, "list")));
    one("fenced", "Our matrix:\n\n```md\n" + gappy + "\n```\n");
    one("commented", "Our matrix, later:\n\n<!--\n" + gappy + "\n-->\n");
    st.elsewhere = check("# Design: Orders\n\n## [UI] Component Contracts\n\n" + gappy + "\n\n## [UI] UI States\nLoading: a skeleton. Error: a banner with Retry.\n");
    all("1.38 ui-states — a matrix is the table whose header holds the scaffold's a11y cell (Announced · focus / Anunciado · foco, any language, the words whole): a state machine, a State | Looks table, an `Announced` or an annotated header, a table with no view, a fenced or commented matrix, one outside UI States are none (no-matrix); the views are the columns between the state and it — a blank or slot header is none, the a11y column and a Notes column after it are never judged (got " +
      js(Object.fromEntries(Object.entries(st).map(([k, v]) => [k, [v.status, v.state, v.detail.slice(0, 140)]]))) + ")", {
      full: () => st.full.status === "pass" && st.full.state === "ok" && st.full.detail === Q().usOk(2, 16),
      machine: () => st.machine.state === "no-matrix" && st.machine.status === "pass" && st.machine.detail === Q().usNone,
      looks: () => st.looks.state === "no-matrix",
      announced: () => st.announced.state === "no-matrix",
      announcedMore: () => st.announcedMore.state === "no-matrix",
      anyLanguage: () => st.es.status === "warn" && st.es.detail === gapOf(1, Q().usView("Orders list", "Undo")),
      notes: () => st.notes.state === "ok" && st.notes.detail === Q().usOk(1, 16),
      a11yBlank: () => st.a11yBlank.state === "ok",
      blankCol: () => st.blankCol.state === "ok" && st.blankCol.detail === Q().usOk(1, 16),
      slotCol: () => st.slotCol.state === "ok" && st.slotCol.detail === Q().usOk(1, 16),
      noView: () => st.noView.state === "no-matrix",
      fenced: () => st.fenced.state === "no-matrix",
      commented: () => st.commented.state === "no-matrix",
      elsewhere: () => st.elsewhere.state === "no-matrix",
    });
  }

  // --- the rows: a label's words in any language, the last one perhaps longer; several rows of one state joined ----------------------
  {
    const st = {};
    // the full one-view matrix with ONE row's label replaced (its cell designed): a row naming the state leaves no gap
    const swap = (tag, from, to) => { st[tag] = check(states(matrix(["Orders list"], said, { labels: LABELS().map((l) => (l === from ? to : l)) }))); };
    swap("qualifier", "Error", "Error — recoverable");
    swap("paren", "Loading", "Loading (skeleton)");
    swap("plural", "Error", "Errors");
    swap("exito", "Success", "Exito");
    swap("vacio", "Empty — no results", "Vacio — sin resultados");
    swap("nao", "Not found", "Nao encontrado");
    swap("bold", "Loading", "**LOADING**");
    swap("nothing", "Not found", "Nothing found");
    swap("spinner", "Loading", "Spinner");
    // a state's second row answers the view its first leaves open
    const two = table(["State", "Orders list", "Order detail", "Announced · focus"], LABELS().flatMap((l) => (l === "Error"
      ? [["Error", "a banner with Retry", "", ""], ["Error — inline", "", "the field says what is wrong", ""]] : [[l, said(l, "list"), said(l, "detail"), ""]])));
    st.twoRows = check(states(two));
    // each language's scaffold rows name the 16 ids in order: a matrix holding ONLY label i answers state i alone
    const ids = Object.keys(Q().uiStateLabels);
    const order = {};
    for (const l of ["en", "pt", "es", "pt-BR"]) {
      order[l] = LABELS(l).map((lab, i) => {
        const m = E.uiStateMatrix(states(table(["State", "View", Q(l).uiStateA11y], [[lab, "what the user sees", ""]])), ids);
        const answered = ids.filter((id) => !m.tables[0].gaps.some((g) => g.id === id));
        return answered.length === 1 && answered[0] === ids[i];
      }).every(Boolean);
    }
    const NF = () => gapOf(1, Q().usNoRow(L("not-found")));
    all("1.38 ui-states — a row names a state when its first cell's words (accents folded, any case) begin with a label's in EN / PT / ES / pt-BR, the label's last word perhaps the start of a longer one (`Error — recoverable`, `Loading (skeleton)`, `Errors`, `Exito`, `Vacio — sin resultados`, `Nao encontrado`, `**LOADING**`), every other word whole (`Nothing found` is not Not found); no synonym (`Spinner`); a state's rows are joined (a second Error row answers view 2) (got " +
      js({ st: Object.fromEntries(Object.entries(st).map(([k, v]) => [k, [v.state, v.detail.slice(0, 120)]])), order }) + ")", {
      qualifier: () => st.qualifier.state === "ok",
      paren: () => st.paren.state === "ok",
      plural: () => st.plural.state === "ok",
      exito: () => st.exito.state === "ok",
      vacio: () => st.vacio.state === "ok",
      nao: () => st.nao.state === "ok",
      bold: () => st.bold.state === "ok",
      nothing: () => st.nothing.status === "warn" && st.nothing.detail === NF(),
      spinner: () => st.spinner.status === "warn" && st.spinner.detail === gapOf(1, Q().usNoRow(L("loading"))),
      twoRows: () => st.twoRows.state === "ok",
      order: () => ["en", "pt", "es", "pt-BR"].every((l) => order[l] === true),
    });
  }

  // --- a view cell: designed, n/a — why (4+ words), or open; one n/a cell answers its row -------------------------------------------------
  {
    const st = {};
    const one = (tag, views, row) => {
      const body = table(["State", ...views, "Announced · focus"], LABELS().map((l) => (l === "Conflict" ? ["Conflict", ...row] : [l, ...views.map((v) => said(l, v)), ""])));
      st[tag] = check(states(body));
    };
    one("naShort", ["Orders list"], ["n/a — cached", ""]);
    one("tbd", ["Orders list"], ["TBD", ""]);
    one("slot", ["Orders list"], ["[what the user sees]", ""]);
    one("dash", ["Orders list"], ["—", ""]);
    one("na", ["Orders list"], ["n/a — this view edits nothing in place", ""]);
    one("rowNa", ["Orders list", "Order detail"], ["n/a — nothing here is edited in place", "", ""]);
    one("rowNaTbd", ["Orders list", "Order detail"], ["n/a — nothing here is edited in place", "TBD", ""]);
    one("rowNaA11y", ["Orders list", "Order detail"], ["n/a — nothing here is edited in place", "", "nothing is announced"]);
    one("naBoth", ["Orders list", "Order detail"], ["n/a — nothing here is edited in place", "the banner says what changed", ""]);
    const open = (view) => gapOf(1, Q().usView(view, L("conflict")));
    all("1.38 ui-states — a view cell is designed (any words), n/a — a reason of 4+ words, or open: blank, a slot, TBD, a mark, an n/a with a shorter reason; a row whose ONLY worded view cell is an n/a answers every view (another worded cell — TBD too — is judged on its own; the a11y cell never counts) (got " +
      js(Object.fromEntries(Object.entries(st).map(([k, v]) => [k, [v.state, v.detail.slice(0, 120)]]))) + ")", {
      naShort: () => st.naShort.detail === open("Orders list"),
      tbd: () => st.tbd.detail === open("Orders list"),
      slot: () => st.slot.detail === open("Orders list"),
      dash: () => st.dash.detail === open("Orders list"),
      na: () => st.na.state === "ok",
      rowNa: () => st.rowNa.state === "ok",
      rowNaTbd: () => st.rowNaTbd.status === "warn" && st.rowNaTbd.detail === open("Order detail"),
      rowNaA11y: () => st.rowNaA11y.state === "ok",
      naBoth: () => st.naBoth.state === "ok",
    });
  }

  // --- the gaps and the detail: no-row once per table, per view up to five states, six items, `table N ›`, the feature's language ------
  {
    const twoViews = (cell, labels) => matrix(["Orders list", "Order detail"], cell, labels ? { labels } : {});
    const noUndo = check(states(twoViews(said, LABELS().filter((l) => l !== "Undo"))));
    const mixed = check(states(twoViews((l, v) => ((l === "Offline") || (l === "Stale" && v === "Orders list") ? "" : said(l, v)), LABELS().filter((l) => l !== "Undo"))));
    const seven = check(states(matrix(["Orders list"], (l) => (LABELS().indexOf(l) < 7 ? "" : said(l, "list")))));
    const views8 = Array.from({ length: 8 }, (_, i) => "View " + (i + 1));
    const eight = check(states(matrix(views8, (l, v) => (LABELS().indexOf(l) === views8.indexOf(v) ? "" : said(l, v)))));
    // two matrices (a table that is none before them): each item names its table's place in the section
    const twoTables = check(states(table(["Field", "Rule"], [["email", "required"]]) + "\n\nThe list:\n\n" + matrix(["Orders list"], said) +
      "\n\nThe dialog:\n\n" + matrix(["Edit dialog"], (l) => (l === "Stale" ? "" : said(l, "dialog")))));
    const loc = {};
    for (const l of ["pt", "es", "pt-BR"]) {
      const labels = LABELS(l);
      loc[l] = check(states(table([Q(l).uiStateHead, Q(l).uiStateView, Q(l).uiStateA11y], labels.filter((x) => x !== L("undo", l)).map((x) => [x, x === L("stale", l) ? "" : "o que se vê", ""]))), "m", l);
    }
    const lab = (i) => LABELS()[i];
    all("1.38 ui-states — the detail: a state with no row is ONE item per table (counted once), each view's open states up to five then counted, six items then counted, `table N ›` when UI States holds several matrices (N: the table's place in the section), the count = states with no row + open cells; in the feature's language (got " +
      js({ noUndo: noUndo.detail, mixed: mixed.detail, seven: seven.detail, eight: eight.detail, twoTables: twoTables.detail, loc: Object.fromEntries(Object.entries(loc).map(([k, v]) => [k, v.detail.slice(0, 160)])) }) + ")", {
      noRowOnce: () => noUndo.status === "warn" && noUndo.detail === gapOf(1, Q().usNoRow("Undo")),
      mixed: () => mixed.detail === gapOf(4, Q().usNoRow("Undo"), Q().usView("Orders list", "Offline, Stale"), Q().usView("Order detail", "Offline")),
      five: () => seven.detail === gapOf(7, Q().usView("Orders list", [0, 1, 2, 3, 4].map(lab).concat(Q().xacMore(2)).join(", "))),
      six: () => eight.detail === gapOf(8, ...views8.slice(0, 6).map((v, i) => Q().usView(v, lab(i))), Q().xacMore(2)),
      table: () => twoTables.detail === gapOf(1, Q().usTable(3, Q().usView("Edit dialog", "Stale"))),
      langs: () => ["pt", "es", "pt-BR"].every((l) => loc[l].status === "warn" &&
        loc[l].detail === Q(l).usOpen(2, [Q(l).usNoRow(L("undo", l)), Q(l).usView(Q(l).uiStateView, L("stale", l))].join("; "))) && loc.pt.detail !== loc["pt-BR"].detail,
    });
  }

  // --- the bounds: 10 tables, 60 rows, 12 views — what is past one is not judged, and the detail says so --------------------------------
  {
    const cut = () => "; " + Q().usTruncated(10, 60, 12);
    const tables11 = check(states(Array.from({ length: 10 }, (_, i) => table(["Note", "Text"], [["n" + i, "x"]])).join("\n\n") + "\n\n" +
      matrix(["Orders list"], (l) => (l === "Stale" ? "" : said(l, "list")))));
    // the Undo row at place 61 (15 states, then 45 rows of the team's own states)
    const rows61 = check(states(table(["State", "Orders list", "Announced · focus"], LABELS().filter((l) => l !== "Undo").map((l) => [l, said(l, "list"), ""])
      .concat(Array.from({ length: 45 }, (_, i) => ["Draft " + i, "a draft", ""]), [["Undo", "a toast with Undo", ""]]))));
    const views13 = Array.from({ length: 13 }, (_, i) => "View " + (i + 1));
    const cols13 = check(states(matrix(views13, (l, v) => (l === "Stale" && v === "View 13" ? "" : said(l, v)))));
    all("1.38 ui-states — bounded: an 11th table, a 61st row, a 13th view are not read, and the detail says what was read (got " + js([tables11.detail, rows61.detail, cols13.detail]) + ")", {
      tables: () => tables11.state === "no-matrix" && tables11.detail === Q().usNone + cut(),
      rows: () => rows61.status === "warn" && rows61.detail === gapOf(1, Q().usNoRow("Undo")) + cut(),
      views: () => cols13.state === "ok" && cols13.detail === Q().usOk(12, 16) + cut(),
    });
  }

  // --- 1.39 (BS-5 — H1–H4): the anchor is looked for in a header's first 64 cells; past them, none found, the table is none and
  // the detail says a bound cut (the view bound's own words: CRIT_3 must-fix 6, no new argument); found within them, the cells
  // after it cost nothing and say nothing
  {
    const cut = () => "; " + Q().usTruncated(10, 60, 12);
    const named = Array.from({ length: 12 }, (_, i) => "View " + (i + 1));
    const blanks = (n) => Array.from({ length: n }, () => "");
    const cell = (l, v) => (v ? said(l, v) : "");
    const at63 = check(states(matrix([...named, ...blanks(50)], cell))); // State + 62 columns: the anchor is the 64th cell (index 63)
    const at64 = check(states(matrix([...named, ...blanks(51)], cell))); // …the 65th (index 64)
    const notes = check(states(matrix([...named, ...blanks(27)], cell, { after: Array.from({ length: 60 }, () => "Notes") }))); // anchor at 40, 101 cells
    all("1.39 ui-states — the anchor is read in a header's first 64 cells: at its 64th it is a matrix (12 views, blank columns between), at its 65th none — usNone and the cut said; an anchor at 40 with 60 columns after it is read whole, nothing said (got " +
      js([at63.detail, at64.detail, notes.detail]) + ")", {
      within: () => at63.state === "ok" && at63.detail === Q().usOk(12, 16),
      past: () => at64.state === "no-matrix" && at64.detail === Q().usNone + cut(),
      after: () => notes.state === "ok" && notes.detail === Q().usOk(12, 16),
    });
    // H1 (cost): 200,000 header cells, the anchor last — the matrix reader against sectionState on the same design, medians of 5
    // interleaved rounds (1.38: 2.1–2.75× — each cell's words read for the anchor; 1.39: what parsing the row costs)
    const sec = (E.trackSectionTable("ui") || []).find((s) => s.name === "UI States");
    const hostile = states(table(["State", ...Array.from({ length: 200000 }, (_, i) => "v" + i + "xxxx"), "Announced · focus"], [["Loading", "a", ""]]));
    const ids = Object.keys(Q().uiStateLabels);
    const time = (f) => { const t0 = process.hrtime.bigint(); const r = f(); return [Number(process.hrtime.bigint() - t0) / 1e6, r]; };
    E.uiStateMatrix(hostile, ids); E.sectionState(hostile, [sec], E.trackMarker("ui"), { size: "m", lang: "en" }); // warm
    const t = remeasure(() => {
      const xa = [], xb = [];
      let m = null;
      for (let r = 0; r < 5; r++) { const [a, got] = time(() => E.uiStateMatrix(hostile, ids)); m = got; xa.push(a); xb.push(time(() => E.sectionState(hostile, [sec], E.trackMarker("ui"), { size: "m", lang: "en" }))[0]); }
      const med = (xs) => xs.sort((x, y) => x - y)[2];
      return { matrix: med(xa), section: med(xb), tables: m.tables.length, views: m.truncated.views };
    }, (s) => s.matrix <= s.section + 50);
    all("1.39 ui-states (cost — BS-5): a header of 200,000 cells, the anchor last, costs the matrix reader ≤ 1× sectionState (+ 50 ms) on the same design — medians of 5 interleaved rounds — and reads as none, said (got " + js(t) + ")", {
      bound: () => t.matrix <= t.section + 50,
      said: () => t.tables === 0 && t.views === true,
    });
  }

  // --- the status: a warn at m / l / no size, a note at s; the section's own state first ---------------------------------------------------
  {
    const gappy = states(matrix(["Orders list"], (l) => (l === "Stale" ? "" : said(l, "list"))));
    const d = gapOf(1, Q().usView("Orders list", "Stale"));
    const scaffold = (lang) => I.design({ name: "Orders", tracks: ["core", "ui"], label: "core +ui", slug: "orders", summary: "", size: "m" }, lang);
    const noTodo = scaffold("en").replace(/^> \*\*TODO\*\*.*\n/gm, "");
    const written = noTodo.replace("## [UI] UI States\n", "## [UI] UI States\nThe orders list, state by state.\n");
    const st = { s: check(gappy, "s"), m: check(gappy, "m"), l: check(gappy, "l"), none: E.uiStatesCheck(gappy, "en", {}), fresh: check(scaffold("en")), noTodo: check(noTodo),
      written: check(written), na: check(states("").replace("Each view, state by state.\n\n", "n/a — this feature shows no screen at all\n")), missing: check("# Design\n\n## Overview\nx\n") };
    all("1.38 ui-states — a gap WARNS at size m / l and with no size, is a pass with a note at s; the scaffold's untouched matrix (its TODO kept or not) is the section unwritten — once a line is the author's, its 16 blank rows are gaps; an n/a section has no view; a missing one is ui-sections' (got " +
      js(Object.fromEntries(Object.entries(st).map(([k, v]) => [k, [v.status, v.state, v.detail.slice(0, 110)]]))) + ")", {
      s: () => st.s.status === "pass" && st.s.state === "small" && st.s.detail === Q().usSmall(d),
      m: () => st.m.status === "warn" && st.m.detail === d,
      l: () => st.l.status === "warn" && st.l.detail === d,
      none: () => st.none.status === "warn" && st.none.detail === d,
      fresh: () => st.fresh.status === "pass" && st.fresh.state === "unfilled" && st.fresh.detail === Q().usUnfilled,
      noTodo: () => st.noTodo.state === "unfilled",
      written: () => st.written.status === "warn" && st.written.detail.startsWith(Q().usOpen(16, "").split(" — ")[0]),
      na: () => st.na.status === "pass" && st.na.state === "na" && st.na.detail === Q().usNa,
      missing: () => st.missing.status === "pass" && st.missing.state === "unfilled",
    });
  }

  // --- linear on a hostile cell: every cell is cut before the reader -----------------------------------------------------------------------
  {
    const big = "word ".repeat(200000); // 1 MB
    const hostile = states(table(["State", "Orders list", "Announced · focus"], LABELS().map((l) => [l === "Error" ? "Error " + big : l, l === "Stale" ? big : said(l, "list"), l === "Loading" ? big : ""])));
    const prose = states("Prose. " + big.repeat(3) + "\n\n" + matrix(["Orders list"], said));
    const t = remeasure(() => {
      const t0 = Date.now(); const h = check(hostile); const t1 = Date.now(); const p = check(prose);
      return { ms: t1 - t0, prose: Date.now() - t1, h: h.state, p: p.state };
    }, (s) => s.ms < 2 * s.prose + 150);
    all("1.38 ui-states — 1 MB cells (a state's, a view's, the a11y one) cost no more than 2× (+ 0.15 s) a 3 MB prose UI States read at the same moment (got " + js(t) + ")", {
      linear: () => t.ms < 2 * t.prose + 150,
      read: () => t.h === "ok" && t.p === "ok",
    });
  }

  // --- doctor: right after ui-deprecated, never a fail, never on a finished feature, not without +ui ------------------------------------
  const REQ = "# Feature: Orders\n\n## Summary\nList the orders.\n\n## User Stories\n### US-1 (P1): See my orders\nAs a buyer I want to see my orders.\n**Independent Test:** open the list.\n\n" +
    "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer opens the orders page THE SYSTEM SHALL list the orders.\n" +
    "2. **US-1.AC-2** — IF the list fails to load THEN THE SYSTEM SHALL show an error message with a Retry action.\n\n## Success Criteria\n- **SC-001** — 95% of lists load in under 2 s.\n\n" +
    "## Edge Cases & Error Handling\n- **EC-1** — WHEN there is no order THE SYSTEM SHALL show the empty state.\n\n## Non-Functional Requirements\n- **NFR-1** — p95 < 2 s.\n\n## Out of Scope\n- Refunds.\n";
  const DESIGN = (statesBody) => "# Design: Orders\n\n## Overview\nOne page.\n\n## Architecture\n```mermaid\ngraph TD\n  P[Page] --> A[API]\n```\n\n" +
    "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n| Reuse | the orders store | `src/orders/store.ts` | it holds the orders |\n\n" +
    "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n| Layout | One page | Simple | Long | A redesign | ✓ |\n| Layout | Tabs | Short | More clicks | Drop-off | ✗ |\n\n" +
    "## Data Models\nOrder {id, total}.\n\n## Error Handling\nSee the IF…THEN criteria.\n\n## Testing Strategy\nComponent tests.\n\n## Risks\n- A slow API — medium — a timeout and a Retry.\n\n" +
    "## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
    "## [UI] Design System Usage\nn/a — this page uses no shared component at all\n\n## [UI] UI States\nThe orders list, state by state.\n\n" + statesBody + "\n\n" +
    "## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n\n## [UI] Responsiveness & i18n\nBreakpoints 360 / 768 / 1280.\n\n## [UI] UI Performance Budget\nLCP under 2.5 s.\n";
  const GAPPY = matrix(["Orders list"], (l) => (l === "Stale" ? "" : said(l, "list")));
  const mk = (tag, o = {}) => {
    const p = path.join(tmp, "proj-uistates-" + tag);
    S.initProject(p, ["ui"], "en");
    if (o.registry) { fs.mkdirSync(path.join(p, ".specs", "steering"), { recursive: true }); fs.writeFileSync(path.join(p, ".specs", "steering", "design-system.md"), o.registry); }
    const f = S.createFeature(p, { name: "Orders", tracks: o.tracks || ["ui"], summary: "x", ...(o.size ? { size: o.size } : {}) });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
    approveBefore(p, f.slug, "design");
    fs.writeFileSync(path.join(f.dir, "design.md"), DESIGN(o.states || GAPPY));
    return { p, slug: f.slug, dir: f.dir };
  };
  const ids = (g) => (S.specDoctor(g.p, g.slug).checks || []).map((c) => c.id);
  const checkOf = (g) => (S.specDoctor(g.p, g.slug).checks || []).find((c) => c.id === "ui-states") || null;
  {
    const dep = mk("order-dep", { registry: "# Design System\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Table | src/Table.tsx |  | _Deprecated: use Grid_ |\n| Grid | src/Grid.tsx |  |  |\n" });
    const plain = mk("order-plain");
    const core = mk("core", { tracks: ["core"] });
    const fresh = (() => { const p = path.join(tmp, "proj-uistates-fresh"); S.initProject(p, ["ui"], "en"); const f = S.createFeature(p, { name: "Orders", tracks: ["ui"], summary: "x" }); return { p, slug: f.slug }; })();
    const l = mk("size-l", { size: "l" });
    const before = checkOf(l);
    const ap = S.approvePhase(l.p, l.slug, "design", "t");
    const after = checkOf(l);
    const viaMcp = ((payload(await rpc("tools/call", { name: "spec_doctor", arguments: { projectDir: l.p, name: l.slug } })).checks) || []).find((c) => c.id === "ui-states");
    const di = ids(dep), pi = ids(plain);
    all("1.38 doctor ui-states: right after ui-deprecated (after ui-design-system when no registry row is deprecated); never on a feature without +ui nor on a design still a later phase's template; a WARN at size l whose design approval goes through (no gate, no failing id) — MCP spec_doctor returns {id, status, detail} (got " +
      js({ di, pi, core: checkOf(core), fresh: ids(fresh).filter((x) => /^ui-/.test(x)), before, ap: [ap.ok, ap.failing], after, viaMcp }) + ")", {
      afterDeprecated: () => di.indexOf("ui-states") === di.indexOf("ui-deprecated") + 1 && di.indexOf("ui-deprecated") > 0,
      afterUsage: () => pi.indexOf("ui-states") === pi.indexOf("ui-design-system") + 1 && !pi.includes("ui-deprecated"),
      core: () => checkOf(core) === null,
      laterTemplate: () => !ids(fresh).includes("ui-states"),
      neverGated: () => before.status === "warn" && ap.ok === true && !(ap.failing || []).length && after.status === "warn",
      mcp: () => js(viaMcp) === js({ id: "ui-states", status: "warn", detail: gapOf(1, Q().usView("Orders list", "Stale")) }),
    });
  }
  {
    // a finished feature is never asked: size s (a note), a READY written finish
    const p = path.join(tmp, "proj-uistates-finished");
    S.initProject(p, ["ui"], "en");
    const f = S.createFeature(p, { name: "Price Tag", tracks: ["ui"], summary: "Show a price", size: "s" });
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ.replace("# Feature: Orders", "# Feature: Price Tag"));
    fs.writeFileSync(path.join(f.dir, "design.md"), "# Design: Price Tag\n\n## Overview\nA price with its currency.\n\n## Architecture\n```mermaid\ngraph TD\n  P[PriceTag] --> F[format]\n```\n\n" +
      "## Decisions, reuse & risks\nReuses the money formatter (`src/lib/money.ts`); one component rather than a helper, so the markup is shared; no material risk: it only renders.\n\n" +
      "## Error Handling\nSee the IF…THEN criteria.\n\n## Constitution Check\n- [x] Small components — complies.\n\n## Complexity Tracking\nNone.\n\n" +
      "## [UI] UI States\nThe tag, state by state.\n\n" + GAPPY + "\n\n## [UI] Accessibility\nWCAG 2.2 AA; axe in the component tests.\n");
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the price tag\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/components/PriceTag.tsx_\n  - _Verify: npm test_\n");
    fs.mkdirSync(path.join(p, "src", "components"), { recursive: true });
    fs.writeFileSync(path.join(p, "src", "components", "PriceTag.tsx"), "export const PriceTag = () => null;\n");
    const approvals = ["requirements", "design", "tasks"].map((ph) => { const a = S.approvePhase(p, f.slug, ph, "t"); return a.ok ? true : (a.failing || a.error); });
    S.completeTask(p, f.slug, 1, { command: "npm test", exitCode: 0, summary: "42/42 passing" });
    const open = checkOf({ p, slug: f.slug });
    const fin = S.finishFeature(p, f.slug, { write: true });
    const done = checkOf({ p, slug: f.slug });
    all("1.38 doctor ui-states: never on a finished feature — at size s a gap is a note before its written finish, and the check is not run after it (got " +
      js({ approvals, open, fin: [fin.readyToFinish, fin.blockers], done }) + ")", {
      before: () => approvals.every((a) => a === true) && open && open.status === "pass" && open.detail === Q().usSmall(gapOf(1, Q().usView("Orders list", "Stale"))),
      finished: () => fin.readyToFinish === true && done === null,
    });
  }
  {
    // spec_upgrade lists it — an advisory warn, as the design-weigh and critical-flow ones: no `warnings` attention of its own. A
    // feature whose doctor warns on nothing else (its steering written, every phase approved, its tasks covering its criteria)
    const p = path.join(tmp, "proj-uistates-upgrade");
    S.initProject(p, ["ui"], "en");
    for (const s of fs.readdirSync(path.join(p, ".specs", "steering"))) fs.writeFileSync(path.join(p, ".specs", "steering", s), "# " + s + "\n\nWhat this project holds to, written by the team.\n");
    const f = S.createFeature(p, { name: "Orders", tracks: ["ui"], summary: "x", size: "m" });
    fs.writeFileSync(path.join(f.dir, "classification.md"), "# Classification: Orders\n\nTracks core +ui, size m: one page of the shop.\n");
    fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ.replace(/## Edge Cases[\s\S]*?## Out of Scope/, "## Out of Scope"));
    fs.writeFileSync(path.join(f.dir, "design.md"), DESIGN(GAPPY));
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks: Orders\n\n- [ ] 1. [US1] Build the orders page\n  - _Requirements: US-1.AC-1, US-1.AC-2_\n  - _Implements: src/orders/Orders.tsx_\n  - _Verify: npm test_\n");
    for (const x of ["quickstart.md", "checklist.md"]) fs.writeFileSync(path.join(f.dir, x), "# " + x + "\n\n1. Open the orders page: the list loads in under 2 s (SC-001).\n");
    const approvals = ["classification", "requirements", "design", "tasks"].map((ph) => { const a = S.approvePhase(p, f.slug, ph, "t"); return a.ok ? true : [ph, a.failing, a.error]; });
    const upF = (S.specUpgrade(p).features || []).find((x) => x.name === f.slug) || {};
    const doc = upF.doctor || {};
    all("1.38 spec_upgrade: a design whose state matrix has a gap lists ui-states among the feature's warnings, and that warn alone adds no `warnings` attention (got " + js({ approvals, doc, attention: upF.attention }) + ")", {
      listed: () => approvals.every((a) => a === true) && js(doc.warnings) === js(["ui-states"]),
      advisory: () => js(upF.attention) === js([]),
    });
  }

  // --- the corpus: an English doctor reads every language's labels without loading pt.js / es.js ---------------------------------------
  {
    const g = mk("corpus-en", { states: matrix(["Orders list"], said, { labels: LABELS().filter((l) => l !== "Undo").map((l) => (l === "Success" ? "Éxito" : l)) }) });
    const child = function (lib, proj, slug) {
      const path = require("path");
      const S = require(path.join(lib, "spec.js")), E = require(path.join(lib, "engine", "index.js"));
      const c = (S.specDoctor(proj, slug).checks || []).find((x) => x.id === "ui-states") || null;
      const loaded = Object.keys(require.cache).map((f) => f.split(path.sep).join("/")).filter((f) => f.includes("/lib/i18n/")).map((f) => path.posix.basename(f)).sort();
      process.stdout.write(JSON.stringify({ c, loaded, source: E.builtinCorpusSource() }));
    };
    const file = path.join(tmp, "uistates-corpus-child.js");
    fs.writeFileSync(file, "\"use strict\";\n(" + child.toString() + ")(process.argv[2], process.argv[3], process.argv[4]);\n");
    const r = spawnSync(process.execPath, [file, path.join(__dirname, "lib"), g.p, g.slug], { encoding: "utf8", timeout: 120000 });
    let out = {};
    try { out = JSON.parse(r.stdout); } catch { out = { stdout: r.stdout, stderr: String(r.stderr).slice(0, 300) }; }
    all("1.38 corpus: an English doctor of a +ui feature reads the state labels of every language from the corpus (an `Éxito` row answers Success) and loads no pt.js, es.js or pt-br.js (got " + js(out) + ")", {
      check: () => !!out.c && out.c.status === "warn" && out.c.detail === gapOf(1, Q().usNoRow("Undo")),
      loaded: () => Array.isArray(out.loaded) && out.loaded.includes("en.js") && !out.loaded.some((x) => ["pt.js", "es.js", "pt-br.js"].includes(x)),
      corpus: () => out.source === "file",
      names: () => {
        const n = E.uiStateNames(), has = new Set(n.labels.map(([id, lab]) => id + "\t" + lab));
        return js(E.renderUiStateNames()) === js(require(path.join(__dirname, "lib", "engine", "corpus.generated.json")).uiStateNames) &&
          ["en", "pt", "es", "pt-BR"].every((l) => Object.entries(Q(l).uiStateLabels).every(([id, lab]) => has.has(id + "\t" + lab)) && n.a11y.includes(Q(l).uiStateA11y)) &&
          n.labels.length + n.a11y.length === E.renderUiStateNames().length;
      },
    });
  }
};
