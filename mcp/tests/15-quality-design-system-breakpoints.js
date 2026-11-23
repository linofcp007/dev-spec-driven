"use strict";
// The breakpoints (1.38) — engine/breakpoints.js: the widths the visual review captures, spec_scan {designSystem: true}'s
// `breakpoints` (both shapes). ui.md's `- Breakpoints:` line (where it is read, how its value reads), else Tailwind 4's
// `--breakpoint-*` in a top-level `@theme` block, read through the token walk's observer, else the default set; never computed in
// finish or the seed (V8 coverage of a child). Every fixture below was written from a mutation of the rule it names (the mutation
// list came first): each must fail without it.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ all, rpc, payload, remeasure, S, tmp, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const T = require(path.join(__dirname, "lib", "engine", "index.js")).loadLazyTier();
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const UI = ".specs/steering/ui.md";
  const DEFAULT = [320, 390, 768, 1024, 1440];
  let n = 0;
  // a folder holding ui.md alone (ui === null: none) and, for the code, one stylesheet walked with the observer → the report
  const report = (ui, css, rel = "src/app.css") => {
    const d = path.join(tmp, "bp-" + ++n);
    if (ui != null) write(d, UI, ui); else fs.mkdirSync(d, { recursive: true });
    const w = T.breakpointWatch();
    if (css != null) T.styleTokens(css, rel, w.on(rel, css));
    return T.breakpointsReport(d, w.found);
  };
  const widths = (r) => js(r.widths);
  const lines = (...l) => l.join("\n") + "\n";

  // --- ui.md's line -----------------------------------------------------------------------------------------------------------------
  { // BP-ui-shapes (U1, U2): the label in any case, emphasis marks around it, any list marker
    const lower = report(lines("# UI Standards", "", "## Responsiveness & i18n", "- breakpoints: 480 / 960 px · text expansion +30–40 %"));
    const bold = report("- **Breakpoints:** 480 px\n"), boldOut = report("- **Breakpoints**: 960 px\n"), star = report("* Breakpoints: 600px\n");
    all("1.38 breakpoints (ui.md): the `- Breakpoints:` line is read in any case, bold inside or outside the colon, under any list marker; `from: \"ui.md\"`, `at` its file:line, 320 first (got " +
      js({ lower, bold: bold.widths, boldOut: boldOut.widths, star: star.widths }) + ")", {
      lower: () => widths(lower) === js([320, 480, 960]) && lower.from === "ui.md" && lower.at === UI + ":4" && lower.partial === false && js(lower.limits) === js([]),
      bold: () => widths(bold) === js([320, 480]) && bold.from === "ui.md",
      boldOut: () => widths(boldOut) === js([320, 960]),
      star: () => widths(star) === js([320, 600]),
    });
  }

  { // BP-ui-first (U3, U4): a list item only, the FIRST one
    const r = report(lines("Breakpoints: we used 1200 once, on the old site.", "", "- Breakpoints: 480 / 960 px", "- Breakpoints: 1600 px"));
    all("1.38 breakpoints (ui.md): a prose line `Breakpoints: …` is not the item; of two items the first is read (got " + js(r) + ")", {
      first: () => widths(r) === js([320, 480, 960]) && r.at === UI + ":3",
    });
  }

  { // BP-ui-hidden (U5, U6, U7): fenced code, an HTML comment over lines and the front matter are not read; `at` is the file's own line
    const fence = report(lines("```md", "- Breakpoints: 999 px", "```", "- Breakpoints: 480 px"));
    const comment = report(lines("<!-- the old ones:", "- Breakpoints: 1999 px", "-->", "- Breakpoints: 480 px"));
    const front = report(lines("---", "inclusion: always", "description: |", "  - Breakpoints: 2999 px", "---", "", "# UI", "- Breakpoints: 480 px"));
    all("1.38 breakpoints (ui.md): a Breakpoints line in fenced code, in an HTML comment over lines or in the front matter is not read; `at` counts every line of the file (got " +
      js({ fence, comment, front }) + ")", {
      fence: () => widths(fence) === js([320, 480]) && fence.at === UI + ":4",
      comment: () => widths(comment) === js([320, 480]) && comment.at === UI + ":4",
      front: () => widths(front) === js([320, 480]) && front.at === UI + ":8",
    });
  }

  { // BP-ui-cut (U8) and BP-ui-slot (U9): the value ends at a `·` before a word; a `[…]` slot — closed or not — is not read; the stub
    const dot = report("- Breakpoints: 480 / 960 px · max content width 1200 px\n");
    const slot = report("- Breakpoints: 480 / 960 px [1200 in print]\n"), open = report("- Breakpoints: 480 px [tablet 1200, desktop 1600\n");
    const stubs = {};
    for (const lang of ["en", "pt", "es", "pt-BR"]) {
      const p = path.join(tmp, "proj-bp-stub-" + lang);
      S.initProject(p, ["ui"], lang);
      const text = fs.readFileSync(path.join(p, UI), "utf8");
      stubs[lang] = { line: (text.match(/^- Breakpoints: .*$/m) || [""])[0].slice(0, 40), r: T.breakpointsReport(p, null) };
    }
    all("1.38 breakpoints (ui.md): the value ends at a `·` before a word; a `[…]` slot is not read, closed or not — so the +ui stub's own line (`[360 / 768 / 1280 px]`, EN / PT / ES / pt-BR) gives the default set (got " +
      js({ dot: dot.widths, slot: slot.widths, open: open.widths, stubs }) + ")", {
      dot: () => widths(dot) === js([320, 480, 960]),
      slot: () => widths(slot) === js([320, 480, 960]),
      open: () => widths(open) === js([320, 480]),
      stubs: () => Object.values(stubs).every((s) => s.line.startsWith("- Breakpoints: [360") && s.r.from === "default" && js(s.r.widths) === js(DEFAULT) && s.r.at === null && s.r.unreadTotal === 0),
    });
  }

  { // BP-ui-list (U8b — 1.38.0 review 1, BS-1): the value ends at the first `·` no length follows — the widths as the CLI prints
    // them (cli/commands.js joins them with " · ") pasted over the stub's slot, in EN / PT / ES / pt-BR, read whole, the stub's
    // ` · text expansion …` still ending it; seven pasted widths → six, the seventh said; blanks after a `·` (a tab, two); a length
    // written `.5rem` continues the list; three dots are no length
    const print = (ws) => ws.join(" · ") + " px";
    const pasted = {};
    for (const lang of ["en", "pt", "es", "pt-BR"]) {
      const p = path.join(tmp, "proj-bp-pasted-" + lang), file = path.join(p, UI);
      S.initProject(p, ["ui"], lang);
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("[360 / 768 / 1280 px]", print(DEFAULT)));
      pasted[lang] = T.breakpointsReport(p, null);
    }
    const seven = report("- Breakpoints: " + print([320, 390, 768, 1024, 1440, 1600, 2000]) + " · text expansion +30–40 % · RTL: no\n");
    const tab = report("- Breakpoints: 480 px ·\t960 px · text\n"), two = report("- Breakpoints: 480 px ·  960 px\n");
    const dotted = report("- Breakpoints: 480 px · .5rem · 960 px\n"), dots = report("- Breakpoints: 480 px · ... 960 px\n");
    all("1.38.0 review 1 breakpoints (ui.md): a `·` a length follows separates a list — the CLI's printed widths pasted into the stub's line read whole (EN / PT / ES / pt-BR), its ` · text expansion` still ends the value; seven → six and `breakpoint-widths`; blanks skipped after the `·`; `.5rem` is a length, `...` none (got " +
      js({ pasted: Object.fromEntries(Object.entries(pasted).map(([k, r]) => [k, [r.from, r.widths]])), seven, tab: tab.widths, two: two.widths, dotted: dotted.widths, dots: dots.widths }) + ")", {
      pasted: () => Object.values(pasted).every((r) => r.from === "ui.md" && js(r.widths) === js(DEFAULT) && r.unreadTotal === 0 && js(r.limits) === js([])),
      seven: () => widths(seven) === js([320, 390, 768, 1024, 1440, 2000]) && js(seven.limits) === js([{ code: "breakpoint-widths", read: 6, count: 1, first: 1600 }]),
      blanks: () => widths(tab) === js([320, 480, 960]) && widths(two) === js([320, 480, 960]),
      dotted: () => widths(dotted) === js([320, 480, 960]),
      dots: () => widths(dots) === js([320, 480]),
    });
  }

  { // BP-ui-bracket (1.39, BS-6 — U3, U4, B2, B3, B4; U2 and B1 are BP-ui-slot's stubs and aside): a CLOSED `[…]` at the slot's
    // own place — opening the value, after the label's closing emphasis marks and blanks — whose text is no template's is the
    // team's filled value, read; the stub's own slot (the template's text) is not, an unclosed one is not, nor a bracket anywhere
    // else (the rest of the value after the filled one is read as ever, its own brackets left out); the template test asks the
    // bracket's text, never the whole value
    const filled = report("- Breakpoints: [576 / 768 / 992 / 1200 / 1400 px] · text expansion +30–40 % · RTL: [yes / no]\n");
    const unclosed = report("- Breakpoints: [576 / 768 px · text\n"), bold = report("- **Breakpoints:** [576 / 768 px]\n");
    const rest = report("- Breakpoints: [576 / 768 px] 1200 px [1600 in print]\n"), stubThen = report("- Breakpoints: [360 / 768 / 1280 px] 600 px\n");
    const later = report("- Breakpoints: 600 px [640 / 960 px]\n");
    all("1.39 breakpoints (ui.md — BS-6): a closed `[…]` opening the value whose text is no template's is read (`from: \"ui.md\"`), with the rest of the value; the stub's own slot, an unclosed `[`, a bracket elsewhere are not (got " +
      js({ filled: [filled.from, filled.widths], unclosed: unclosed.widths, bold: bold.widths, rest: rest.widths, stubThen: stubThen.widths, later: later.widths }) + ")", {
      filled: () => filled.from === "ui.md" && widths(filled) === js([320, 576, 768, 992, 1200, 1400]) && filled.at === UI + ":1" && filled.unreadTotal === 0,
      unclosed: () => unclosed.from === "default" && js(unclosed.widths) === js(DEFAULT),
      bold: () => bold.from === "ui.md" && widths(bold) === js([320, 576, 768]),
      rest: () => widths(rest) === js([320, 576, 768, 1200]),
      stubThen: () => widths(stubThen) === js([320, 600]),
      later: () => widths(later) === js([320, 600]),
    });
  }

  { // BP-ui-nbsp (1.39, R2-BS-3 — N1a, N1b, N2): a no-break space after the `·` (U+00A0, or U+202F, the narrow one French
    // typography puts there) continues the list like a blank — the two a thousands group already takes; a word after it still ends
    // the value, and so does a line break's absence of any (the class holds blanks, never `\s`'s line ends or any character)
    const nb = String.fromCharCode(0xa0), nn = String.fromCharCode(0x202f);
    const a0 = report("- Breakpoints: 360 ·" + nb + "768 ·" + nb + "1280 px\n"), af = report("- Breakpoints: 360 ·" + nn + "768 ·" + nn + "1280 px\n");
    const mixed = report("- Breakpoints: 360 ·" + nb + nn + " 768 px ·" + nb + "text 1280 px\n"), word = report("- Breakpoints: 480 px ·" + nb + "max width 1200 px\n");
    const other = report("- Breakpoints: 480 px ·" + String.fromCharCode(0x2009) + "960 px\n"); // (a thin space is no blank of the class)
    all("1.39 breakpoints (ui.md — R2-BS-3): a no-break space (U+00A0 or U+202F) after a `·` continues the list as a blank does; a word after it still ends the value; another space character (U+2009) is no blank of the class (got " +
      js({ a0: a0.widths, af: af.widths, mixed: mixed.widths, word: word.widths, other: other.widths }) + ")", {
      nbsp: () => widths(a0) === js([320, 360, 768, 1280]) && a0.from === "ui.md",
      narrow: () => widths(af) === js([320, 360, 768, 1280]),
      mixed: () => widths(mixed) === js([320, 360, 768]),
      word: () => widths(word) === js([320, 480]),
      other: () => widths(other) === js([320, 480]),
    });
  }

  { // BP-ui-bound (U10): ui.md's value is read up to 200 characters, said; a number the bound cuts is no number
    // (the value is what follows the colon, its blank too: 1600 starts at its 208th character; 12800 straddles the bound, 1280
    // before it; 1280 ends right at it, a blank after it)
    const past = report("- Breakpoints: 480 / 960 px — " + "a".repeat(190) + " 1600 px\n");
    const halved = report("- Breakpoints: " + "a".repeat(194) + " 12800px\n");
    const short = report("- Breakpoints: 480 px " + " ".repeat(300) + "\n");
    const whole = report("- Breakpoints: " + "a".repeat(194) + " 1280 " + "b".repeat(20) + "\n"); // (1280 ends at the bound, a blank after it)
    all("1.38 breakpoints (ui.md): the Breakpoints value is read up to 200 characters — a width past them is not, `breakpoint-line` {read 200, at} says so (in breakpoints.limits); `12800px` cut at the bound is not read as 1280; trailing blanks are no excess (got " +
      js({ past, halved, short: short.limits, whole: whole.widths }) + ")", {
      past: () => widths(past) === js([320, 480, 960]) && js(past.limits) === js([{ code: "breakpoint-line", read: 200, at: UI + ":1" }]),
      halved: () => js(halved.widths) === js(DEFAULT) && halved.from === "default" && halved.unreadTotal === 0 && js(halved.limits) === js([{ code: "breakpoint-line", read: 200, at: UI + ":1" }]),
      short: () => js(short.limits) === js([]),
      whole: () => widths(whole) === js([320, 1280]) && whole.limits.length === 1,
    });
  }

  { // BP-ui-units (U11–U16, R1): px, rem / em × 16, a bare number takes the unit written next (else px), thousands groups, the
    // ceiling of a fraction, the floor and the ceiling of the range, sorted and deduplicated
    const units = report("- Breakpoints: 48rem / 64em / 1440PX / 1600\n"), next = report("- Breakpoints: 30 / 48 / 80 rem\n");
    const groups = report("- Breakpoints: 1.250rem / 1.280 px / 1,440px / 2.560\n"), edges = report("- Breakpoints: 767.5px, 240px, 5120px, 320 px, 1024 / 480 / 1024 px\n");
    const four = report("- Breakpoints: 1.2800px\n"); // (a group is three digits: 1.28 px, the floor's)
    const spaced = report("- Breakpoints: 2" + String.fromCharCode(0xa0) + "560 px / 3" + String.fromCharCode(0x202f) + "840 px\n"); // (no-break spaces)
    all("1.38 breakpoints (ui.md): a width is a min edge in px — rem / em × 16, a unit in any case, a bare number in the unit written next (`30 / 48 / 80 rem`) else px, `1.280 px` / `1,440px` / `2.560` / a no-break space thousands (`1.250rem` a decimal, `1.2800px` none), 767.5px → 768; under 320 the floor's, over 3840 unread {name, value, at}; ascending, once each (got " +
      js({ units: units.widths, next: next.widths, groups: [groups.widths, groups.unreadTotal], four: four.widths, spaced: spaced.widths, edges }) + ")", {
      units: () => widths(units) === js([320, 768, 1024, 1440, 1600]),
      next: () => widths(next) === js([320, 480, 768, 1280]),
      groups: () => widths(groups) === js([320, 1280, 1440, 2560]) && groups.unreadTotal === 0,
      four: () => four.from === "default",
      spaced: () => widths(spaced) === js([320, 2560, 3840]),
      edges: () => widths(edges) === js([320, 480, 768, 1024]) && edges.unreadTotal === 1 && js(edges.unread) === js([{ name: "Breakpoints", value: "5120px", at: UI + ":1" }]),
    });
  }

  { // BP-sources (U17, U18, R3): ui.md first, but only when it gives a width; the code next; else the default set
    const below = report("- Breakpoints: 240px\n", "@theme {\n  --breakpoint-tablet: 50rem;\n}\n");
    const wins = report("- Breakpoints: 600 px\n", "@theme {\n  --breakpoint-x: calc(1px + 2px);\n  --breakpoint-y: 50rem;\n}\n");
    const none = report(null, null), noFound = T.breakpointsReport(path.join(tmp, "bp-nowhere"), null);
    all("1.38 breakpoints (sources): ui.md decides when it gives a width (the code's unread then unlisted); a ui.md width under the floor alone leaves it to the code; nothing anywhere → the default set, at null (got " +
      js({ below, wins, none }) + ")", {
      below: () => below.from === "code" && widths(below) === js([320, 390, 768, 800, 1024, 1440]) && below.partial === true && below.at === "src/app.css:2",
      wins: () => wins.from === "ui.md" && widths(wins) === js([320, 600]) && wins.partial === false && wins.unreadTotal === 0 && js(wins.unread) === js([]),
      none: () => js(none) === js({ widths: DEFAULT, from: "default", partial: false, at: null, unread: [], unreadTotal: 0, limits: [] }) && js(noFound) === js(none),
    });
  }

  // --- Tailwind 4's @theme ----------------------------------------------------------------------------------------------------------
  { // BP-theme-options (C1, C2, C3): `@theme` and its options; never another block, a nested @theme or a block inside @theme
    const decl = " {\n  --breakpoint-*: initial;\n  --breakpoint-md: 50rem;\n}\n";
    const opts = ["@theme", "@theme inline", "@theme static", "@theme reference", "@theme default", "@theme inline reference"].map((p) => [p, report(null, p + decl).widths]);
    const others = report(null, ":root {\n  --breakpoint-md: 50rem;\n}\n@theme-x {\n  --breakpoint-lg: 70rem;\n}\n.theme { --breakpoint-xl: 90rem; }\n");
    const nested = report(null, "@media print {\n  @theme {\n    --breakpoint-p: 150rem;\n  }\n}\n");
    const inner = report(null, "@theme {\n  @keyframes k {\n    --breakpoint-k: 175rem;\n  }\n}\n");
    all("1.38 breakpoints (@theme): `@theme` with any of its options (inline, static, reference, default) is read; `:root`, `@theme-x`, a class and a @theme nested in another block are not, nor a block inside @theme (got " +
      js({ opts, others, nested: nested.widths, inner: inner.widths }) + ")", {
      opts: () => opts.every(([, w]) => js(w) === js([320, 800])),
      others: () => others.from === "default" && js(others.widths) === js(DEFAULT),
      nested: () => nested.from === "default",
      inner: () => inner.from === "default",
    });
  }

  { // BP-theme-reset (C4, C5, C6, C11): `--breakpoint-*: initial` / `--*: initial` reset (the file's earlier ones too; not partial);
    // `--breakpoint-<name>: initial` drops that name; the last declaration of a name is the one kept
    const twreset = report(null, lines("@import \"tailwindcss\";", "@theme {", "  --breakpoint-*: initial;", "  --breakpoint-tablet: 40rem;", "  --breakpoint-laptop: 64rem;", "}"));
    const above = report(null, lines("@theme {", "  --breakpoint-old: 100rem;", "  --breakpoint-*: initial;", "  --breakpoint-md: 50rem;", "}"));
    const all1 = report(null, lines("@theme {", "  --*: initial;", "  --breakpoint-md: 50rem;", "}"));
    const drop = report(null, lines("@theme {", "  --breakpoint-*: initial;", "  --breakpoint-sm: 30rem;", "  --breakpoint-md: 50rem;", "  --breakpoint-sm: initial;", "}"));
    const again = report(null, lines("@theme {", "  --breakpoint-*: initial;", "  --breakpoint-md: 48rem;", "  --breakpoint-lg: 70rem;", "  --breakpoint-md: 50rem;", "}"));
    all("1.38 breakpoints (@theme): Tailwind docs' reset (`--breakpoint-*: initial`, then its own) is complete — not partial, at its first declaration; a declaration above a reset is gone; `--*: initial` resets too; `--breakpoint-sm: initial` drops sm (no unread); a name declared twice keeps the last, so the first declaration kept is the one below (got " +
      js({ twreset, above: above.widths, all1: [all1.widths, all1.partial], drop: [drop.widths, drop.unreadTotal], again: [again.widths, again.at] }) + ")", {
      twreset: () => widths(twreset) === js([320, 640, 1024]) && twreset.from === "code" && twreset.partial === false && twreset.at === "src/app.css:4",
      above: () => widths(above) === js([320, 800]) && above.partial === false,
      all1: () => widths(all1) === js([320, 800]) && all1.partial === false,
      drop: () => widths(drop) === js([320, 800]) && drop.unreadTotal === 0,
      again: () => widths(again) === js([320, 800, 1120]) && again.at === "src/app.css:4",
    });
  }

  { // BP-theme-unread (C8, C9, C10, R4): a value that is no length (calc(), var(), vw, a word, 1e3px) or wider than 3840 is unread —
    // the first five listed with name, value and file:line, all counted; `0` is the floor's
    const r = report(null, lines("@theme {", "  --breakpoint-*: initial;", "  --breakpoint-a: calc(40rem + 1px);", "  --breakpoint-b: var(--w);", "  --breakpoint-c: 0;",
      "  --breakpoint-d: 250rem;", "  --breakpoint-e: 800PX;", "  --breakpoint-f: 40vw;", "  --breakpoint-g: auto;", "  --breakpoint-h: 1e3px;", "}"));
    all("1.38 breakpoints (@theme): unread — a value other than 0 or a px / rem / em length (a unit in any case), or wider than 3840 px: the first 5 [{name, value, at}], unreadTotal all; 0 is no unread (got " + js(r) + ")", {
      widths: () => widths(r) === js([320, 800]) && r.from === "code",
      unread: () => r.unreadTotal === 6 && js(r.unread.map((u) => u.name)) === js(["--breakpoint-a", "--breakpoint-b", "--breakpoint-d", "--breakpoint-f", "--breakpoint-g"]),
      first: () => js(r.unread[0]) === js({ name: "--breakpoint-a", value: "calc(40rem + 1px)", at: "src/app.css:3" }) && r.unread[2].value === "250rem",
    });
  }

  { // BP-cap (R2): six widths at most — the narrowest five and the widest; `breakpoint-widths` names how many and the first left out
    const r = report("- Breakpoints: 400 / 500 / 600 / 700 / 800 / 900 / 1000 px\n");
    const six = report("- Breakpoints: 400 / 500 / 600 / 700 / 800 px\n");
    all("1.38 breakpoints: at most 6 widths — the narrowest 5 and the widest; `breakpoint-widths` {read 6, count, first} says what was left (got " + js({ r, six: six.widths }) + ")", {
      cap: () => widths(r) === js([320, 400, 500, 600, 700, 1000]) && js(r.limits) === js([{ code: "breakpoint-widths", read: 6, count: 2, first: 800 }]),
      six: () => widths(six) === js([320, 400, 500, 600, 700, 800]) && js(six.limits) === js([]),
    });
  }

  { // BP-fill (1.39, BS-2 — F1–F9, L1, L2; it replaces 1.38's BP-partial-cap, R2-BS-1's restored union cap): under partial the
    // theme's own widths first (past six the narrowest five and the widest, the rest said), then the default set where room is
    // left, in the order 768 · 1024 · 1440 · 390; `breakpoint-widths` counts and names only the theme's own widths left out — a
    // default one the fill had no room for is never said. The union cap (1.38), review 1's ascending fill, a widest-first fill,
    // 390 never filled, the fill before the cap, the fill when not partial, past six or twice: each fails here
    const add = (...ws) => "@theme inline {\n" + ws.map((w, i) => "  --breakpoint-w" + i + ": " + w + "px;\n").join("") + "}\n";
    const two = report(null, add(1600, 2000)), four = report(null, add(1600, 1800, 2000, 2400)), seven = report(null, add(400, 500, 600, 700, 800, 900, 1000));
    const asc = report(null, add(1600, 1800, 2000)), widest = report(null, add(1600, 1920, 2560)), one = report(null, add(1920)), twice = report(null, add(768, 1600));
    const five = report(null, add(640, 768, 1024, 1280, 1536)); // Tailwind's own five restated, no reset
    const reset = report(null, "@theme {\n  --breakpoint-*: initial;\n  --breakpoint-md: 50rem;\n}\n");
    all("1.39 breakpoints (@theme, partial — BS-2): the theme's own widths first, then the default set where room is left (768 · 1024 · 1440 · 390), six at most, ascending; past six the theme's own narrowest five and widest; `breakpoint-widths` counts and names only the theme's own widths left out; a reset theme gets no default width (got " +
      js({ two: [two.widths, two.limits], four: [four.widths, four.limits], seven: [seven.widths, seven.limits], asc: asc.widths, widest: widest.widths, one: one.widths, twice: twice.widths, five: [five.widths, five.limits], reset: [reset.widths, reset.partial] }) + ")", {
      two: () => widths(two) === js([320, 768, 1024, 1440, 1600, 2000]) && two.partial === true && two.from === "code" && js(two.limits) === js([]),
      four: () => widths(four) === js([320, 768, 1600, 1800, 2000, 2400]) && js(four.limits) === js([]),
      seven: () => widths(seven) === js([320, 400, 500, 600, 700, 1000]) && seven.partial === true && js(seven.limits) === js([{ code: "breakpoint-widths", read: 6, count: 2, first: 800 }]),
      ascending: () => widths(asc) === js([320, 768, 1024, 1600, 1800, 2000]) && js(asc.limits) === js([]),
      widestFirst: () => widths(widest) === js([320, 768, 1024, 1600, 1920, 2560]),
      phoneLast: () => widths(one) === js([320, 390, 768, 1024, 1440, 1920]) && js(one.limits) === js([]),
      once: () => widths(twice) === js([320, 390, 768, 1024, 1440, 1600]),
      declaredFirst: () => widths(five) === js([320, 640, 768, 1024, 1280, 1536]) && js(five.limits) === js([]),
      notPartial: () => widths(reset) === js([320, 800]) && reset.partial === false && js(reset.limits) === js([]),
    });
  }

  // --- 1.39: a Sass map named …breakpoints (the walk's `open` event, the void rule, precedence — CRIT_3 must-fixes 1–3) -------------
  // several sheets walked in order (the scan's: token files, then the sheet candidates) → the report
  const sheets = (files) => {
    const d = path.join(tmp, "bp-" + ++n);
    fs.mkdirSync(d, { recursive: true });
    const w = T.breakpointWatch();
    for (const [rel, css] of files) T.styleTokens(css, rel, w.on(rel, css));
    return T.breakpointsReport(d, w.found);
  };
  const BS5 = lines("$grid-breakpoints: (", "  xs: 0,", "  sm: 576px,", "  md: 768px,", "  lg: 992px,", "  xl: 1200px,", "  xxl: 1400px", ") !default;");
  const names = (r) => js(r.unread.map((u) => [u.name, u.value, u.at]));

  { // BP-sass-shapes (S1, S2, S2b, S3, S4, S7, S8, S10, E1, E2, A2): Bootstrap 6's `_config.scss` map as written (a comment line
    // inside, `!default`) → its widths, at its `$` line; the name's LAST word is `breakpoints` — `$breakpoints`, `$mq-breakpoints`,
    // never `$spacers` (a 0-led map of lengths too) or `$grid-breakpoints-custom`; a block's own map is not read (one-line or over
    // lines); an entry that is no length unread as `$name.key` (keys quoted or not), a nested map (Bulma) nothing, a list nothing;
    // a map never `partial`, so no default width fills it
    const bs6 = report(null, lines("// Breakpoints", "//", "// Define the minimum dimensions at which your layout will change.", "", "// scss-docs-start breakpoints",
      "$breakpoints: (", "  xs: 0,", "  // the phones", "  sm: 576px,", "  md: 768px,", "  lg: 1024px,", "  xl: 1280px,", "  2xl: 1536px", ") !default;", "// scss-docs-end breakpoints"), "scss/_config.scss");
    const named = report(null, lines("$spacers: (0: 0, 1: .25rem, 5: 400px);", "$grid-breakpoints-custom: (sm: 700px);", "$mq-breakpoints: (tablet: 740px, desktop: 980px);"), "src/main.scss");
    const local = report(null, lines(".x { $grid-breakpoints: (sm: 600px); }", ".y {", "  $grid-breakpoints: (", "    sm: 650px", "  );", "}"), "src/main.scss");
    const entries = report(null, lines("$breakpoints: (xs: 0, \"sm\": 600px, md: $tablet, 'lg': 750, xl: 5000px, xxl: 80em);"), "src/main.scss");
    const bulma = report(null, lines("$breakpoints: (", "  \"mobile\": (", "    \"until\": $tablet,", "  ),", "  \"tablet\": (", "    \"from\": $tablet,", "  ),", ") !default;"), "sass/utilities/_variables.scss");
    const list = report(null, lines("$show-breakpoints: (mobile, tablet, desktop);", "$x-breakpoints: \"a\" \"b\";", "$y-breakpoints: ();"), "src/main.scss");
    const quoted = report(null, lines("$q-breakpoints: (sm: 600px, note: \"a, b)\", md: 900px);"), "src/main.scss"); // (a quoted `,` / `)` cuts nothing)
    all("1.39 breakpoints (a Sass map): a top-level `$…breakpoints` literal map's 0 / px / rem / em entries are min edges — Bootstrap 6's over lines (a comment inside), at its `$` line; `$spacers` / `$grid-breakpoints-custom` / a block's own map are not read; a non-length entry is unread `$name.key`; a nested map and a list give nothing; never partial (got " +
      js({ bs6, named: named.widths, local: local.widths, entries, bulma: [bulma.widths, bulma.unreadTotal], list: [list.widths, list.unreadTotal] }) + ")", {
      bs6: () => widths(bs6) === js([320, 576, 768, 1024, 1280, 1536]) && bs6.from === "code" && bs6.at === "scss/_config.scss:6" && bs6.partial === false && bs6.unreadTotal === 0 && js(bs6.limits) === js([]),
      named: () => widths(named) === js([320, 740, 980]) && named.at === "src/main.scss:3",
      local: () => local.from === "default" && local.unreadTotal === 0,
      entries: () => widths(entries) === js([320, 600, 1280]) &&
        names(entries) === js([["$breakpoints.md", "$tablet", "src/main.scss:1"], ["$breakpoints.lg", "750", "src/main.scss:1"], ["$breakpoints.xl", "5000px", "src/main.scss:1"]]),
      bulma: () => bulma.from === "default" && bulma.unreadTotal === 0,
      list: () => list.from === "default" && list.unreadTotal === 0,
      quoted: () => widths(quoted) === js([320, 600, 900]) && names(quoted) === js([["$q-breakpoints.note", "\"a, b)\"", "src/main.scss:1"]]),
    });
  }

  { // BP-sass-with (S5, V1, V3, E3): `@use … with (…)` — sass-mq's own example override (examples/custom/custom.scss, MIT) over
    // lines and on one line; a map that is the last override (its rest the `with`'s closing statement, read to the map's own `)`)
    // or whole on its line (`(…),` — read at once); a map another override follows over lines (Dashticz's loader.scss, MIT) is
    // never delivered whole by the walk: one unread, and the next map's widths (`$container-max-widths`) never read, in either order
    const mq = report(null, lines("// Simple way to use Sass MQ with custom params", "", "@use '../../mq' as responsive with (", "  $breakpoints: (", "    vga: 640px,", "    svga: 800px,",
      "    xga: 1024px,", "    uxga: 1600px,", "  )", ");", "", "body {", "  font-size: 100%;", "}"), "examples/custom/custom.scss");
    const mqOne = report(null, lines("@use '../../mq' as responsive with ($breakpoints: (vga: 640px, svga: 800px, xga: 1024px, uxga: 1600px));"), "src/custom.scss");
    const last = report(null, lines("@use 'bootstrap' with (", "  $primary: #f00,", "  $grid-breakpoints: (", "    xs: 0,", "    sm: 600px", "  )", ");"), "src/custom.scss");
    const now = report(null, lines("@use 'bootstrap' with (", "  $grid-breakpoints: (xs: 0, sm: 600px),", "  $primary: red", ");"), "src/custom.scss");
    const dash = (second) => lines("// Retain the Bootstrap 3 breakpoints", "@use 'bootstrap/scss/bootstrap' with (", "  $grid-breakpoints: (", "    xs: 0,", "    sm: 768px,", "    md: 992px,",
      "    lg: 1200px,", "  ),", "  $container-max-widths: (", "    sm: 540px,", "    md: 720px,", "  )" + (second ? "," : ""), ...(second ? ["  $grid-gutter-width: 30px"] : []), ");", "@use 'bootstrap3-compat';");
    const d1 = report(null, dash(true), "src/loader.scss"), d2 = report(null, dash(false), "src/loader.scss");
    all("1.39 breakpoints (a Sass map, `@use … with`): sass-mq's override over lines and on one line → [320, 640, 800, 1024, 1600]; the map as the last override or whole on its line read; Dashticz's map followed by another override → one unread `$grid-breakpoints` at its line, the default set — never 540 / 720 (got " +
      js({ mq: [mq.widths, mq.at], mqOne: mqOne.widths, last: last.widths, now: now.widths, d1, d2: d2.widths }) + ")", {
      mq: () => widths(mq) === js([320, 640, 800, 1024, 1600]) && mq.at === "examples/custom/custom.scss:4" && mq.unreadTotal === 0,
      mqOne: () => widths(mqOne) === js([320, 640, 800, 1024, 1600]) && mqOne.at === "src/custom.scss:1",
      last: () => widths(last) === js([320, 600]) && last.unreadTotal === 0 && last.at === "src/custom.scss:3",
      now: () => widths(now) === js([320, 600]) && now.unreadTotal === 0,
      dashticz: () => [d1, d2].every((r) => r.from === "default" && names(r) === js([["$grid-breakpoints", "( …", "src/loader.scss:3"]])),
    });
  }

  { // BP-sass-void (V2, V4, V5, S9): a pending open is completed only by the very NEXT event, a top-level statement — a block event
    // first, a nested open or statement first, the file's end: one unread, nothing read; a 3,000-character map over lines (its rest
    // cut by the walk at DS_PRELUDE) one unread, no width; the same map on one line loses its name to the cut — nothing (said)
    const block = report(null, lines("$grid-breakpoints: (", ".a {}", "sm: 600px);"), "src/main.scss");
    const nested = report(null, lines("$grid-breakpoints: (", ".x {", "  $y: (", "    a: 1px", "  );", "}", "sm: 600px);"), "src/main.scss");
    const eof = report(null, "$grid-breakpoints: (\n  sm: 600px\n)", "src/main.scss");
    const stray = report(null, "$grid-breakpoints: (xs: 0, sm: 600px }\n", "src/main.scss"); // (a stray `}` ends the statement, its map unclosed)
    const ws = Array.from({ length: 300 }, (_, i) => "w" + i + ": " + (400 + i) + "px");
    const longMulti = report(null, lines("$grid-breakpoints: (", "  xs: 0,", ...ws.map((w) => "  " + w + ","), ") !default;"), "src/main.scss");
    const longOne = report(null, lines("$grid-breakpoints: (xs: 0, " + ws.join(", ") + ");"), "src/main.scss");
    // its FIRST line past DS_PRELUDE (the open's value is cut), then its end; a statement whose cut leaves exactly a map's
    // assignment, or a `@use … with (`, at its head — the walk kept its last DS_PRELUDE characters: never read as whole
    const longHead = report(null, lines("$grid-breakpoints: (xs: 0, " + ws.join(", ") + ",", ");"), "src/main.scss");
    // (the statement's last DS_PRELUDE characters are `head`, entries of 1px, then `close`)
    const at2000 = (head, close) => { let b = head; for (let i = 0; b.length < T.DS_PRELUDE; i++) b += ", p" + i + ": 1px"; return "$filler: " + "x".repeat(500) + " " + b.slice(0, T.DS_PRELUDE - close.length) + close; };
    const cutAssign = report(null, lines(at2000("$grid-breakpoints: (sm: 600px", ")") + ";"), "src/main.scss");
    const cutWith = report(null, lines(at2000("@use 'b' with ($grid-breakpoints: (sm: 600px", "))") + ";"), "src/main.scss");
    const tails = [at2000("$grid-breakpoints: (sm: 600px", ")"), at2000("@use 'b' with ($grid-breakpoints: (sm: 600px", "))")].map((s) => s.slice(-T.DS_PRELUDE).slice(0, 18));
    all("1.39 breakpoints (a Sass map — the void rule): an open the next event does not complete (a block, a nested declaration, the file's end) → one unread at its line; a map past DS_PRELUDE over lines, or its first line past it → one unread; on one line → nothing (the walk's cut took its name); a cut statement that happens to start with an assignment or a `with` is never read (got " +
      js({ block: names(block), nested: names(nested), eof: names(eof), longMulti: [longMulti.from, names(longMulti)], longOne: [longOne.from, longOne.unreadTotal], longHead: [longHead.from, longHead.unreadTotal],
        cutAssign: [cutAssign.from, cutAssign.unreadTotal], cutWith: [cutWith.from, cutWith.unreadTotal] }) + ")", {
      longHead: () => longHead.from === "default" && longHead.unreadTotal === 1 && longHead.unread[0].at === "src/main.scss:1",
      cutAssign: () => cutAssign.from === "default" && cutAssign.unreadTotal === 1 && cutAssign.unread[0].name === "$grid-breakpoints",
      cutWith: () => cutWith.from === "default" && cutWith.unreadTotal === 0 && js(tails) === js(["$grid-breakpoints:", "@use 'b' with ($gr"]),
      block: () => block.from === "default" && names(block) === js([["$grid-breakpoints", "( …", "src/main.scss:1"]]),
      nested: () => nested.from === "default" && names(nested) === js([["$grid-breakpoints", "( …", "src/main.scss:1"]]),
      eof: () => eof.from === "default" && names(eof) === js([["$grid-breakpoints", "( …", "src/main.scss:1"]]),
      unclosed: () => stray.from === "default" && names(stray) === js([["$grid-breakpoints", "(xs: 0, sm: 600px", "src/main.scss:1"]]) && stray.unreadTotal === 1,
      longMulti: () => longMulti.from === "default" && names(longMulti) === js([["$grid-breakpoints", "( …", "src/main.scss:1"]]),
      longOne: () => longOne.from === "default" && longOne.unreadTotal === 0,
    });
  }

  { // BP-sass-precedence (S6, P1, P2, P3, P4, P5, A1, A3): per name, a plain or `with` assignment sets aside the `!default` ones —
    // read or not; otherwise all count; names unite; `at` the first KEPT declaration with a length, in the walk's order; a variable
    // or a function value (map-merge) is unread, never nothing
    const vars = ["scss/_variables.scss", BS5];
    const plain = sheets([vars, ["scss/custom.scss", lines("$enable-shadows: true;", "$grid-breakpoints: (xs: 0, md: 900px);")]]);
    const withIt = sheets([vars, ["scss/custom.scss", lines("@use 'bootstrap' with ($grid-breakpoints: (xs: 0, sm: 600px, md: 900px));")]]);
    const merge = sheets([vars, ["scss/custom.scss", lines("$grid-breakpoints: map-merge($grid-breakpoints, (xxxl: 1920px));")]]);
    const variable = sheets([["src/styles.scss", lines("$breakpoints: $grid-breakpoints;")]]);
    const unite = sheets([vars, ["scss/custom.scss", lines("$mq-breakpoints: (tablet: 740px);")]]);
    const defaults = sheets([["scss/_variables.scss", lines("$grid-breakpoints: (xs: 0, sm: 600px) !default;")], ["src/theme.scss", lines("$grid-breakpoints: (xs: 0, md: 900px) !default;")]]);
    const mixed = sheets([["src/_variables.scss", lines("$grid-breakpoints: (xs: 0, sm: 600px);")], ["src/app.css", lines("@theme inline {", "  --breakpoint-3xl: 1600px;", "}")]]);
    all("1.39 breakpoints (a Sass map — precedence): a plain map (or a `with` override) sets aside the `!default` one of its name — read or not (a map-merge: unread, the default set); `at` the first kept; names unite; two `!default` ones both count; a variable is unread (got " +
      js({ plain: [plain.widths, plain.at], withIt: withIt.widths, merge: [merge.from, names(merge)], variable: names(variable), unite: unite.widths, defaults: [defaults.widths, defaults.at], mixed: [mixed.widths, mixed.at, mixed.partial] }) + ")", {
      plain: () => widths(plain) === js([320, 900]) && plain.at === "scss/custom.scss:2" && plain.partial === false,
      withIt: () => widths(withIt) === js([320, 600, 900]) && withIt.at === "scss/custom.scss:1",
      merge: () => merge.from === "default" && names(merge) === js([["$grid-breakpoints", "map-merge($grid-breakpoints, (xxxl: 1920px))", "scss/custom.scss:1"]]),
      variable: () => variable.from === "default" && names(variable) === js([["$breakpoints", "$grid-breakpoints", "src/styles.scss:1"]]) && variable.unreadTotal === 1 && merge.unreadTotal === 1, // (1.39.0 review 1: each counted once — badTotal)
      unite: () => widths(unite) === js([320, 576, 740, 768, 992, 1400]) && js(unite.limits) === js([{ code: "breakpoint-widths", read: 6, count: 1, first: 1200 }]) && unite.at === "scss/_variables.scss:1",
      defaults: () => widths(defaults) === js([320, 600, 900]) && defaults.at === "scss/_variables.scss:1",
      walkOrder: () => mixed.at === "src/_variables.scss:1" && mixed.partial === true && widths(mixed) === js([320, 600, 768, 1024, 1440, 1600]),
    });
  }

  { // BP-sass-files (S11, S12, S13): the map reader reads .scss alone — never a .css (no Sass there, an `@theme` beside it or not)
    // nor an indented .sass; a .scss with no `breakpoints` in it gets no observer (the pre-test: no event built)
    const css = report(null, lines("@theme { --x: 1px; }", "$grid-breakpoints: (sm: 600px);"), "src/app.css");
    const sass = report(null, lines("$grid-breakpoints: (sm: 600px)", "$a: 1;"), "src/app.sass");
    const w = T.breakpointWatch(), text = lines("$grid: (sm: 600px);", ".a { color: red; }");
    all("1.39 breakpoints (a Sass map — which files): a .css or a .sass holding a `$grid-breakpoints` map gives nothing; a .scss without the word `breakpoints` gets no observer (got " +
      js({ css: css.from, sass: sass.from, none: w.on("src/main.scss", text) }) + ")", {
      css: () => css.from === "default" && css.unreadTotal === 0,
      sass: () => sass.from === "default" && sass.unreadTotal === 0,
      pretest: () => w.on("src/main.scss", text) === null && w.found.files.length === 0,
    });
  }

  // --- through the scan: the walks that already run, both shapes, the report's own fields ------------------------------------------------
  // shadcn v4's app/globals.css (apps/v4, MIT) as written: imports, @source and @custom-variant lines, then `@theme inline` ADDING two
  // breakpoints to Tailwind's own five (its first declaration at line 45), then the page's tokens
  const STYLES = ["luma", "lyra", "maia", "mira", "nova", "rhea", "sera", "vega"];
  const SHADCN = lines("@import \"tailwindcss\";", "@import \"tw-animate-css\";", "@import \"shadcn/tailwind.css\";", "@import \"./legacy-themes.css\";", "",
    "@source \"../node_modules/streamdown/dist/*.js\";", ...["base", "aria", "radix"].flatMap((k) => STYLES.map((s) => "@source \"../styles/" + k + "-" + s + "/**/*.tsx\";")), "",
    ...["vega", "nova", "lyra", "maia", "mira", "luma", "sera", "rhea"].map((s) => "@custom-variant style-" + s + " (&:where(.style-" + s + " *));"), "",
    "@custom-variant dark (&:is(.dark *));", "@custom-variant fixed (&:is(.layout-fixed *));", "",
    "@theme inline {", "  --breakpoint-3xl: 1600px;", "  --breakpoint-4xl: 2000px;", "  --font-sans: var(--font-sans);", "  --radius-sm: calc(var(--radius) * 0.6);",
    "  --radius-lg: var(--radius);", "  --color-background: var(--background);", "  --color-foreground: var(--foreground);", "}", "",
    ":root {", "  --radius: 0.625rem;", "  --background: oklch(1 0 0);", "  --foreground: oklch(0.145 0 0);", "  --card: oklch(1 0 0);", "  --primary: oklch(0.205 0 0);", "}", "",
    "@utility container-wrapper {", "  @apply mx-auto w-full px-2 3xl:fixed:max-w-[calc(var(--breakpoint-2xl)+2rem)];", "}");

  { // BP-theme-real (C7) — and the project shape's own fields (R5) and both shapes alike (R6), the MCP result the engine's
    const p = path.join(tmp, "proj-bp-shadcn");
    S.initProject(p, ["ui"], "en");
    write(p, "app/globals.css", SHADCN);
    write(p, ".specs/steering/design-system.md", "# Design System\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n\n| Token | Value | Use |\n|---|---|---|\n" +
      ["--breakpoint-3xl", "--breakpoint-4xl", "--font-sans", "--radius-sm", "--radius-lg", "--color-background", "--color-foreground", "--radius", "--background", "--foreground", "--card", "--primary"].map((t) => "| " + t + " | x |  |").join("\n") +
      "\n\n_Token sources: app/globals.css_\n");
    const f = S.createFeature(p, { name: "Pricing", tracks: ["ui"], summary: "x" });
    const proj = S.designSystemReport(p), feat = S.designSystemReport(p, { name: f.slug });
    const viaMcp = payload(await rpc("tools/call", { name: "spec_scan", arguments: { projectDir: p, designSystem: true } }));
    const featMcp = payload(await rpc("tools/call", { name: "spec_scan", arguments: { projectDir: p, designSystem: true, name: f.slug } }));
    // the same project, its ui.md's Breakpoints line too long: the line decides, and its limit stays in breakpoints.limits
    const ui = fs.readFileSync(path.join(p, UI), "utf8");
    fs.writeFileSync(path.join(p, UI), ui.replace(/^- Breakpoints: .*$/m, "- Breakpoints: 600 / 1200 px " + "x".repeat(220)));
    const cutRep = S.designSystemReport(p);
    all("1.38 breakpoints (shadcn v4's globals.css, through the token walk): `@theme inline` adds 3xl / 4xl to Tailwind's own → partial: 1600 and 2000, then the default set where room is left (1.39, BS-2: 768 · 1024 · 1440 — no width of the theme's left out, nothing said), at app/globals.css:45; the project and the feature carry the same `breakpoints`, last; its limits never reach the report's `limits` / `truncated` / `inSync`; MCP = engine (got " +
      js({ bp: proj.breakpoints, inSync: proj.inSync, limits: proj.limits, cut: [cutRep.breakpoints, cutRep.inSync, cutRep.limits] }) + ")", {
      real: () => js(proj.breakpoints) === js({ widths: [320, 768, 1024, 1440, 1600, 2000], from: "code", partial: true, at: "app/globals.css:45", unread: [], unreadTotal: 0,
        limits: [] }),
      inSync: () => proj.inSync === true && js(proj.limits) === js([]) && proj.truncated === false,
      shapes: () => js(feat.breakpoints) === js(proj.breakpoints) && Object.keys(proj).pop() === "breakpoints" && Object.keys(feat).pop() === "breakpoints",
      mcp: () => js(viaMcp.breakpoints) === js(proj.breakpoints) && js(featMcp.breakpoints) === js(feat.breakpoints),
      cut: () => cutRep.breakpoints.from === "ui.md" && js(cutRep.breakpoints.widths) === js([320, 600, 1200]) && js(cutRep.breakpoints.limits.map((l) => l.code)) === js(["breakpoint-line"]) &&
        cutRep.inSync === true && js(cutRep.limits) === js([]) && cutRep.truncated === false,
    });
  }

  { // BP-theme-files (C12, C13): every stylesheet the walks read — a token file (theme.css) first, then a global sheet that is no
    // source (one custom property): both read, `at` the first in that order
    const p = path.join(tmp, "proj-bp-files");
    fs.mkdirSync(p, { recursive: true });
    write(p, "src/styles/theme.css", lines("@theme {", "  --breakpoint-*: initial;", "  --breakpoint-tab: 50rem;", "}"));
    write(p, "src/app.css", lines("@import \"tailwindcss\";", "@theme inline {", "  --breakpoint-wide: 100rem;", "}"));
    const r = S.designSystemReport(p);
    all("1.38 breakpoints (the walks): a token file's @theme and a global sheet's that is no token source are both read, the token file first (got " + js({ bp: r.breakpoints, sources: r.found.sources }) + ")", {
      both: () => js(r.breakpoints.widths) === js([320, 800, 1600]) && r.breakpoints.from === "code" && r.breakpoints.partial === false,
      order: () => r.breakpoints.at === "src/styles/theme.css:3" && js(r.found.sources) === js(["src/styles/theme.css"]),
    });
  }

  { // BP-sass-scan (1.39): through the scan's walks — a Bootstrap 5 app whose vendored `scss/_variables.scss` (a token file by name)
    // keeps the `!default` map and whose `scss/custom.scss` (a sheet candidate, no custom property in it) overrides it before
    // importing Bootstrap: the override decides, at its line; the MCP result the engine's; a sheet the scan never opens by name
    // (`scss/_config.scss`) is not read
    const p = path.join(tmp, "proj-bp-sass");
    fs.mkdirSync(p, { recursive: true });
    write(p, "scss/_variables.scss", lines("$white: #fff !default;", "$primary: #0d6efd !default;", "", BS5));
    write(p, "scss/custom.scss", lines("// the app's own breakpoints", "$grid-breakpoints: (", "  xs: 0,", "  sm: 600px,", "  md: 900px,", "  lg: 1200px", ");", "", "@import \"bootstrap/scss/bootstrap\";"));
    write(p, "scss/_config.scss", lines("$breakpoints: (xs: 0, tv: 3000px);"));
    const r = S.designSystemReport(p);
    const viaMcp = payload(await rpc("tools/call", { name: "spec_scan", arguments: { projectDir: p, designSystem: true } }));
    all("1.39 breakpoints (a Sass map, through the scan): the vendored `!default` map in a token file and the app's plain override in custom.scss — the override's widths, at its line; `_config.scss` unread by the walk; MCP = engine (got " +
      js(r.breakpoints) + ")", {
      scan: () => js(r.breakpoints) === js({ widths: [320, 600, 900, 1200], from: "code", partial: false, at: "scss/custom.scss:2", unread: [], unreadTotal: 0, limits: [] }),
      mcp: () => js(viaMcp.breakpoints) === js(r.breakpoints),
    });
  }

  { // BP-crash (1.39.0 review 1, BU-1 — mutants B1–B11): no input overflows the stack, and what is kept stays bounded —
    // codeBreakpoints keeps the unread COUNT and the first BP_UNREAD (a Sass record its own first BP_UNREAD, all counted: no entry
    // past them can be among the report's first), breakpointsReport joins each source's one by one, never a spread (V8's
    // arguments end near 125K). The reviewer's Sass shape — one-line maps of 480 unitless entries (a line of ~1,930 characters,
    // under DS_PRELUDE: every entry read, each one unread) in three 256K sheets, 192,960 unread — and 1.38's own Tailwind one —
    // 200,000 distinct `--breakpoint-aN: x` in 256K `@theme` sheets (1.38.0 threw there too) — each return the report: the
    // default set, the first five in the walk's order (ui.md's own first: its line's 5000 px is no width), unreadTotal exact; a
    // hostile `!default` map a plain one sets aside counts nothing; through the scan and MCP alike, both shapes; the cost ≤ 3×
    // (+ 50 ms) each shape's twin the pre-test skips (medians of 5 interleaved rounds; the Tailwind leg on its first 50,000:
    // the walk dominates both sides — the observer's share is what the ratio reads)
    const fill = (unit) => unit.repeat(Math.floor(256 * 1024 / unit.length));
    const wide = "$a-breakpoints: (" + ["b0:1", "b1:1", "b2:1", "b3:1", "b4:1", ...Array(475).fill("a:1")].join(",") + ");\n";
    const sheet = fill(wide), perSheet = sheet.split("\n").length - 1, SASS_TOTAL = 3 * perSheet * 480;
    const twSheets = (n) => {
      const out = [];
      let cur = "";
      for (let i = 0; i < n; i++) {
        const l = "  --breakpoint-a" + i + ": x;\n";
        if (cur.length + l.length > 256 * 1024 - 12) { out.push("@theme {\n" + cur + "}\n"); cur = ""; }
        cur += l;
      }
      return [...out, "@theme {\n" + cur + "}\n"];
    };
    const watch = (files) => { const w = T.breakpointWatch(); for (const [rel, text] of files) T.styleTokens(text, rel, w.on(rel, text)); return w.found; };
    const sassFiles = [0, 1, 2].map((k) => ["src/s" + k + ".scss", sheet]), twFiles = twSheets(200000).map((t, k) => ["src/t" + k + ".css", t]);
    const dUi = path.join(tmp, "bp-crash-ui"), dNone = path.join(tmp, "bp-crash");
    write(dUi, UI, "- Breakpoints: 5000 px\n");
    fs.mkdirSync(dNone, { recursive: true });
    const sFound = watch(sassFiles), tFound = watch(twFiles);
    const run = (d, found) => { try { return T.breakpointsReport(d, found); } catch (e) { return { threw: e.name + ": " + e.message }; } };
    const s = run(dUi, sFound), t = run(dNone, tFound), cb = T.codeBreakpoints(tFound), records = sFound.files.flatMap((x) => x.maps), r0 = records[0] || { bad: [] };
    const aside = run(dNone, watch([["src/v.scss", wide.replace(");", ") !default;")], ["src/c.scss", lines("$a-breakpoints: (sm: 600px);")]]));
    const uiSix = report("- Breakpoints: 4000 / 4100 / 4200 / 4300 / 4400 / 4500 px\n"); // (ui.md's own path: six unread, five listed — B8)
    // through the scan (three sheet candidates by name), project and feature shapes, and MCP
    const p = path.join(tmp, "proj-bp-crash");
    S.initProject(p, ["ui"], "en");
    for (const k of [0, 1, 2]) write(p, "p" + k + "/custom.scss", sheet);
    const f = S.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x" });
    const safe = (fn) => { try { return fn().breakpoints; } catch (e) { return { threw: e.name + ": " + e.message, unread: [] }; } };
    const pb = safe(() => S.designSystemReport(p)), fb = safe(() => S.designSystemReport(p, { name: f.slug }));
    const viaMcp = payload(await rpc("tools/call", { name: "spec_scan", arguments: { projectDir: p, designSystem: true } }));
    const featMcp = payload(await rpc("tools/call", { name: "spec_scan", arguments: { projectDir: p, designSystem: true, name: f.slug } }));
    const u = (name, value, at) => ({ name, value, at });
    all("1.39.0 review 1 breakpoints (BU-1): ~193K Sass unread (480 a line, three 256K sheets) and 200,000 Tailwind ones (1.38's own crash) return the report — the default set, the first five in the walk's order (ui.md's first), unreadTotal exact; codeBreakpoints and each Sass record keep five and count all; a set-aside hostile map counts nothing; the scan and MCP alike, both shapes (got " +
      js({ s, t: [t.from, t.unreadTotal, t.unread && t.unread.map((x) => x.name), t.threw], cb: [cb.unread.length, cb.unreadTotal], record: [r0.bad.length, r0.badTotal, records.length], aside: [aside.widths, aside.unreadTotal, aside.threw],
        proj: [pb.unreadTotal, pb.unread[0], pb.threw], mcp: [viaMcp.breakpoints ? viaMcp.breakpoints.unreadTotal : viaMcp, featMcp.breakpoints ? featMcp.breakpoints.unreadTotal : featMcp] }) + ")", {
      sass: () => s.from === "default" && widths(s) === js(DEFAULT) && s.unreadTotal === 1 + SASS_TOTAL && SASS_TOTAL > 150000 &&
        js(s.unread) === js([u("Breakpoints", "5000 px", UI + ":1"), ...["b0", "b1", "b2", "b3"].map((k) => u("$a-breakpoints." + k, "1", "src/s0.scss:1"))]),
      tailwind: () => t.from === "default" && t.unreadTotal === 200000 && js(t.unread) === js([0, 1, 2, 3, 4].map((i) => u("--breakpoint-a" + i, "x", "src/t0.css:" + (i + 2)))),
      code: () => cb.unread.length === 5 && cb.unreadTotal === 200000 && js(cb.unread) === js(t.unread),
      records: () => records.length === 3 * perSheet && records.every((m) => m.bad.length <= 5) && r0.bad.length === 5 && r0.badTotal === 480,
      aside: () => widths(aside) === js([320, 600]) && aside.unreadTotal === 0 && aside.at === "src/c.scss:1",
      uiPath: () => uiSix.from === "default" && uiSix.unreadTotal === 6 && js(uiSix.unread.map((x) => x.value)) === js(["4000", "4100", "4200", "4300", "4400"]),
      scan: () => pb.from === "default" && pb.unreadTotal === SASS_TOTAL && pb.unread.length === 5 &&
        pb.unread[0].name === "$a-breakpoints.b0" && /^p\d\/custom\.scss:1$/.test(pb.unread[0].at) && js(fb) === js(pb),
      mcp: () => js(viaMcp.breakpoints) === js(pb) && js(featMcp.breakpoints) === js(fb),
    });
    // the cost: each shape walked with the observer and reported against its twin (no observer: `breakpointz`, `@themx`)
    const twin = (files, a, b) => files.map(([rel, text]) => [rel, text.split(a).join(b)]);
    const twSmall = twSheets(50000).map((x, k) => ["src/t" + k + ".css", x]);
    const sassTwin = twin(sassFiles, "breakpoints", "breakpointz"), twTwin = twin(twSmall, "@theme {", "@themx {");
    const runs = [() => run(dNone, watch(sassFiles)), () => run(dNone, watch(sassTwin)), () => run(dNone, watch(twSmall)), () => run(dNone, watch(twTwin))];
    const time = (fn) => { const t0 = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t0) / 1e6; };
    runs.forEach((fn) => fn()); // warm
    const ok3 = (x) => x[0] <= 3 * x[1] + 50 && x[2] <= 3 * x[3] + 50;
    const k = remeasure(() => { const x = runs.map(() => []); for (let r = 0; r < 5; r++) runs.forEach((fn, i) => x[i].push(time(fn))); return x.map((xs) => xs.sort((a, b) => a - b)[2]); }, ok3, 3);
    all("1.39.0 review 1 breakpoints (BU-1, cost): the Sass crash shape (three 256K sheets) and the Tailwind one (50,000 unread) each ≤ 3× (+ 50 ms) their twins the pre-test skips — medians of 5 interleaved rounds (got [sass, twin, tailwind, twin] ms " +
      js(k.map((x) => Math.round(x))) + ")", {
      sass: () => k[0] <= 3 * k[1] + 50,
      tailwind: () => k[2] <= 3 * k[3] + 50 && run(dNone, watch(twSmall)).unreadTotal === 50000,
    });
  }

  { // BP-never (U19, C15): computed on spec_scan {designSystem}'s path only — V8 coverage of a child: spec_finish's part
    // (designSystemFinish) and the seed (designSystemSeed) run NO function of breakpoints.js, though the project holds a ui.md line,
    // a Tailwind @theme and a feature; the project report and the feature report do
    const p = path.join(tmp, "proj-bp-never");
    S.initProject(p, ["ui"], "en");
    write(p, "app/globals.css", SHADCN);
    const ui = fs.readFileSync(path.join(p, UI), "utf8");
    fs.writeFileSync(path.join(p, UI), ui.replace(/^- Breakpoints: .*$/m, "- Breakpoints: 600 / 1200 px"));
    write(p, "src/components/Card.tsx", "export const Card = () => <div className=\"p-4\" />;\n");
    const f = S.createFeature(p, { name: "Cards", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the cards\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/components/Card.tsx_\n  - _Verify: npm test_\n");
    const child = function (lib, proj, slug) {
      const fs = require("fs"), path = require("path"), url = require("url"), v8 = require("v8");
      const E = require(path.join(lib, "engine", "index.js"));
      E.loadLazyTier(); // (the tier's modules loaded: their own top-level code is no call)
      const num = (f) => (f.match(/-(\d+)-(\d+)\.json$/) || ["", "0", "0"]).slice(1).map(Number);
      // the functions of breakpoints.js that ran since the last take (the counters reset at each)
      const ran = () => {
        v8.takeCoverage();
        const dir = process.env.NODE_V8_COVERAGE;
        const last = fs.readdirSync(dir).filter((f) => f.startsWith("coverage-")).sort((a, b) => num(a)[0] - num(b)[0] || num(a)[1] - num(b)[1]).pop();
        const out = [];
        for (const s of JSON.parse(fs.readFileSync(path.join(dir, last), "utf8")).result) {
          if (!s.url.startsWith("file:") || path.basename(url.fileURLToPath(s.url)) !== "breakpoints.js") continue;
          for (const fn of s.functions) if (fn.ranges[0].startOffset > 0 && fn.ranges[0].count > 0) out.push(fn.functionName || "(anonymous)");
        }
        return out.sort();
      };
      ran();
      const fin = E.designSystemFinish(proj, slug), seed = E.designSystemSeed(proj, "en");
      const quiet = ran();
      const rep = E.designSystemReport(proj);
      const project = ran();
      const feat = E.designSystemReport(proj, { name: slug });
      const feature = ran();
      process.stdout.write(JSON.stringify({ quiet, project, feature, fin: !!(fin && fin.uiChecks), seed: !!(seed && seed.text), from: [rep.breakpoints.from, feat.breakpoints.from] }));
    };
    const script = path.join(tmp, "bp-never-child.js");
    fs.writeFileSync(script, "\"use strict\";\n(" + child.toString() + ")(process.argv[2], process.argv[3], process.argv[4]);\n");
    const covDir = path.join(tmp, "bp-never-coverage");
    fs.mkdirSync(covDir, { recursive: true });
    const kid = spawnSync(process.execPath, [script, path.join(__dirname, "lib"), p, f.slug], { encoding: "utf8", timeout: 300000, env: { ...process.env, NODE_V8_COVERAGE: covDir } });
    let got;
    try { got = JSON.parse(kid.stdout); } catch { got = { stdout: String(kid.stdout).slice(0, 300), stderr: String(kid.stderr).slice(0, 300) }; }
    const must = ["breakpointWatch", "on", "breakpointsReport", "uiBreakpoints"];
    all("1.38 breakpoints: never computed in finish or the seed — V8 coverage: designSystemFinish and designSystemSeed (both answered) run no function of breakpoints.js on a project holding a ui.md line, an @theme and a +ui feature; the project report runs the watch, the observer and the report, the feature report too (got " +
      js(got) + ")", {
      ran: () => got.fin === true && got.seed === true && js(got.from) === js(["ui.md", "ui.md"]),
      quiet: () => Array.isArray(got.quiet) && got.quiet.length === 0,
      project: () => Array.isArray(got.project) && must.every((m) => got.project.includes(m)) && got.project.includes("block") && got.project.includes("statement"),
      feature: () => Array.isArray(got.feature) && must.every((m) => got.feature.includes(m)),
    });
  }

  // --- cost ------------------------------------------------------------------------------------------------------------------------------
  { // K2: hostile inputs stay linear — a 256K sheet of @theme breakpoint statements against the same sheet the walk reads with no
    // observer (`@themx`: no `@theme` in its text); a ui.md of one 256K Breakpoints line — a list of `1 · ` (a length follows each
    // `·`: the value's end is searched over the whole line, 1.38.0 review 1) — and one of 50,000 Breakpoints lines against an
    // ordinary ui.md of the same size (a 256K line of prose, 50,000 other list items) whose one Breakpoints line comes last. Each
    // pair timed interleaved, the median of 5 rounds, a round tens of milliseconds long (the ui.md line pair: 15 reports a round —
    // review 1's BS-7: over 3 calls the denominator was ~5 ms, noise on a loaded machine); ≤ 3× + 50 ms (a GC pause), the line
    // pair ≤ 5× + 50 ms: the list line is captured, searched and cut where the prose line is refused at its first character —
    // 1.5–3× at rest, 4.6× seen under four suites' load; a search that rescans per `·` is 18× (the mutation pass)
    const body = "--breakpoint-a: 1px;\n".repeat(12000);
    const theme = "@theme {\n" + body + "}\n", themx = "@themx {\n" + body + "}\n";
    const ui = (tag, text) => { const d = path.join(tmp, "bp-k2-" + tag); write(d, UI, text); return d; };
    const dLine = ui("line", "- Breakpoints: " + "1 · ".repeat(64 * 1024) + "\n"), dProse = ui("prose", "Layout " + "a ".repeat(128 * 1024) + "\n- Breakpoints: 480 px\n");
    const dMany = ui("many", "- Breakpoints: 480 px\n".repeat(50000)), dList = ui("list", "- Spacing: 4800 px\n".repeat(50000) + "- Breakpoints: 480 px\n");
    const time = (fn, k) => { const t0 = process.hrtime.bigint(); for (let i = 0; i < k; i++) fn(); return Number(process.hrtime.bigint() - t0) / 1e6; };
    const pair = (a, b, k) => {
      const xa = [], xb = [];
      for (let r = 0; r < 5; r++) { xa.push(time(a, k)); xb.push(time(b, k)); }
      const med = (xs) => xs.sort((x, y) => x - y)[2];
      return [med(xa), med(xb)];
    };
    const walk = (text) => { const w = T.breakpointWatch(); T.styleTokens(text, "a.css", w.on("a.css", text)); return w.found; };
    const rep = (d) => () => T.breakpointsReport(d, null);
    walk(theme); walk(themx); rep(dLine)(); rep(dProse)(); rep(dMany)(); rep(dList)(); // warm
    const within = (x, i) => x[i] <= (i === 2 ? 5 : 3) * x[i + 1] + 50;
    const s = remeasure(() => [...pair(() => walk(theme), () => walk(themx), 1), ...pair(rep(dLine), rep(dProse), 15), ...pair(rep(dMany), rep(dList), 1)],
      (x) => within(x, 0) && within(x, 2) && within(x, 4), 3);
    const decls = walk(theme).files[0].decls;
    all("1.38 breakpoints (cost): a 256K @theme of breakpoint statements walks ≤ 3× (+ 50 ms) the same sheet with no observer; ui.md's 256K Breakpoints line (a `1 · ` list) reads ≤ 5× (+ 50 ms) and 50,000 Breakpoints lines ≤ 3× (+ 50 ms) an ordinary ui.md of the same size — medians of 5 interleaved rounds (got [theme, themx, line ×15, prose ×15, many, list] ms " +
      js(s.map((x) => Math.round(x))) + ")", {
      theme: () => within(s, 0) && decls.size === 1,
      line: () => within(s, 2) && js(rep(dLine)().limits.map((l) => l.code)) === js(["breakpoint-line"]),
      many: () => within(s, 4) && rep(dMany)().at === UI + ":1" && rep(dList)().at === UI + ":50001",
    });

    // K3c (1.39 — the Sass map reader, cost guards): 100 .scss sheets, each Bootstrap's map and 300 rules reading it
    // (`map-get($grid-breakpoints, md)`), walked with the observer and reported ≤ 1.5× (+ 50 ms) their `breakpointz` twins (no
    // observer: the pre-test); hostile 256K sheets — a `$x-breakpoints: (` per line (the first opens a parenthesis the walk never
    // sees closed: one open, the rest map keys, one unread), a one-line map per line, `$a-breakpoints: 1px,` per line (each open
    // voiding the last) — each ≤ 3× (+ 50 ms) its twin. Medians of 5 interleaved rounds (measured at rest: 0.96–1.25×; 1.0×,
    // 1.7–2.3×, 1.1–1.5×)
    const sassSheet = BS5 + Array.from({ length: 300 }, (_, i) => ".c" + i + " { width: map-get($grid-breakpoints, md); color: red; }").join("\n") + "\n";
    const twin = (t) => t.split("breakpoints").join("breakpointz");
    const fill = (unit) => unit.repeat(Math.ceil(256 * 1024 / unit.length));
    const dEmpty = path.join(tmp, "bp-k3c");
    fs.mkdirSync(dEmpty, { recursive: true });
    const scss = (texts) => () => { const w = T.breakpointWatch(); for (const t of texts) T.styleTokens(t, "src/custom.scss", w.on("src/custom.scss", t)); return T.breakpointsReport(dEmpty, w.found); };
    const real = Array(100).fill(sassSheet), hostile = [fill("$x-breakpoints: (\n"), fill("$x-breakpoints: (a: 1px, b: 2px);\n"), fill("$a-breakpoints: 1px,\n")];
    const runs = [scss(real), scss(real.map(twin)), ...hostile.flatMap((h) => [scss([h]), scss([twin(h)])])];
    runs.forEach((f) => f()); // warm
    const ok3 = (x) => x[0] <= 1.5 * x[1] + 50 && [2, 4, 6].every((i) => x[i] <= 3 * x[i + 1] + 50);
    const k = remeasure(() => [...pair(runs[0], runs[1], 1), ...pair(runs[2], runs[3], 1), ...pair(runs[4], runs[5], 1), ...pair(runs[6], runs[7], 1)], ok3, 3);
    const got = runs.filter((_, i) => i % 2 === 0).map((f) => f());
    all("1.39 breakpoints (cost — the Sass map reader): 100 sheets with a map and 300 rules ≤ 1.5× (+ 50 ms) their twins the pre-test skips; 256K sheets of an open per line, a one-line map per line, a voiding list per line each ≤ 3× (+ 50 ms) its twin — medians of 5 interleaved rounds (got [real, twin, open, twin, one-line, twin, voids, twin] ms " +
      js(k.map((x) => Math.round(x))) + ")", {
      real: () => k[0] <= 1.5 * k[1] + 50 && js(got[0].widths) === js([320, 576, 768, 992, 1200, 1400]),
      hostile: () => [2, 4, 6].every((i) => k[i] <= 3 * k[i + 1] + 50) && got[1].unreadTotal === 1 && got[2].unreadTotal === 0 && got[3].unreadTotal > 10000,
    });
  }
};
