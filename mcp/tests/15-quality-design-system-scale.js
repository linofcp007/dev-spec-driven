"use strict";
// Raw values against the project's own scale (1.38 — engine/design-values.js): the colour parser and the judge (`token` — the
// same colour, exact within a notation, the notation pair's rounding across two; `near` — a hint within the JND), fonts against
// the registry's font tokens, motion against the duration / easing tokens, `groups`, the feature report's kinds and their own
// bounds, spec_finish (colours and sizes alone); the costs, as ratios: 15-quality-design-system-cost.js. Expected colour
// distances are the critics' (CRIT_2, computed outside the engine: Tailwind's zinc vs shadcn's neutrals 0.003–0.008 apart;
// #05787d vs hsl(183 92% 25%) 0.0106).

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, S, tmp, list, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const T = require(path.join(__dirname, "lib", "engine", "index.js")).loadLazyTier();
  const rows = (list) => (list || []).map(([name, value]) => ({ name, value }));
  const scale = (reg, code) => T.tokenScale(rows(reg), rows(code));
  const judge = (value, reg, code, kind) => T.judgeRaw({ kind: kind || "color", value }, scale(reg, code));
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const lines = (...l) => l.join("\n") + "\n";
  // a registry of token rows (+ more markdown after them)
  const registry = (tokens, more) => "# Design System\n\n| Token | Value | Use |\n|---|---|---|\n" + tokens.map(([n, v]) => "| " + n + " | " + v + " | x |").join("\n") + "\n" + (more || "");
  // a project with one +ui feature whose tasks name src/checkout/ (and its registry, when given)
  let k = 0;
  const feature = (reg, files) => {
    const p = path.join(tmp, "proj-scale-" + ++k);
    S.initProject(p, ["ui"], "en");
    if (reg != null) write(p, ".specs/steering/design-system.md", reg);
    for (const [rel, text] of Object.entries(files)) write(p, rel, text);
    const f = S.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the checkout\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/checkout/_\n  - _Verify: npm test_\n");
    return { p, slug: f.slug };
  };
  const report = (x) => S.designSystemReport(x.p, { name: x.slug });

  { // the parser: every notation CSS Color 4 writes, `none`, % channels, hue units, an alpha either way; what it does not parse
    const P = T.parseColor;
    const ok = (s) => { const p = P(s); return p ? [p.n, ...p.ok.map((x) => Math.round(x * 1e4) / 1e4), Math.round(p.alpha * 1000) / 1000] : null; };
    const got = {
      hex3: ok("#fff"), hex4: ok("#fff8"), hex8: ok("#1d4ed880"), rgbComma: ok("rgb(29, 78, 216)"), rgbaComma: ok("rgba(29, 78, 216, 0.5)"),
      rgbPct: ok("rgb(100% 0% 0%)"), rgbSlash: ok("rgb(29 78 216 / 50%)"), hslTurn: ok("hsl(.5turn 100% 50%)"), hslBare: ok("hsl(180 100 50)"),
      oklchPct: ok("oklch(20.5% 0 none)"), oklab: ok("oklab(50% 25% -25%)"),
      none: [P("hwb(0 0% 0%)"), P("red"), P("color(display-p3 1 0 0)"), P("lab(50% 40 59.5)"), P("rgb(1 2)"), P("rgb(1 2 3 4)"), P("rgb(" + "1 ".repeat(2000) + ")")],
    };
    all("1.38 design values: parseColor — hex 3 / 4 / 6 / 8, rgb / rgba (comma or space, % channels, an alpha after `/` or as a 4th argument), hsl (turn, a bare s / l), oklch (L in %, `none` = 0), oklab (% a / b = 0.4); hwb / named / color() / lab, a wrong arity and a 4,000-character argument are not parsed (got " + js(got) + ")", {
      hex3: () => js(got.hex3) === js(["hex", 1, 0, 0, 1]),
      hex4: () => got.hex4[4] === 0.533,
      hex8: () => got.hex8[0] === "hex" && got.hex8[4] === 0.502,
      rgbComma: () => js(got.rgbComma.slice(1)) === js(ok("#1d4ed8").slice(1)) && got.rgbComma[0] === "rgb",
      rgbaComma: () => got.rgbaComma[4] === 0.5 && js(got.rgbaComma.slice(1, 4)) === js(ok("#1d4ed8").slice(1, 4)),
      rgbPct: () => js(got.rgbPct.slice(1)) === js(ok("#f00").slice(1)),
      rgbSlash: () => got.rgbSlash[4] === 0.5,
      hslTurn: () => js(got.hslTurn.slice(1)) === js(ok("#0ff").slice(1)) && got.hslTurn[0] === "hsl",
      hslBare: () => js(got.hslBare.slice(1)) === js(ok("#0ff").slice(1)),
      oklchPct: () => js(got.oklchPct) === js(["oklch", 0.205, 0, 0, 1]),
      oklab: () => js(got.oklab) === js(["oklab", 0.5, 0.1, -0.1, 1]),
      none: () => got.none.every((x) => x === null),
    });
  }

  { // the judge: the same colour — exact within one notation, the pair's rounding across two (0.011 with an HSL side, 0.001
    // otherwise: Tailwind's zinc is NOT shadcn's neutral) —, alphas alike; `near` the NEAREST token within 0.02; the 1.37 text
    // rule for what is not parsed; the registry's tokens first
    const NEUTRAL = [["--primary", "oklch(0.205 0 0)"]];
    const got = {
      hex3: judge("#fff", [["--w", "#ffffff"]]), comma: judge("rgb(29, 78, 216)", [["--b", "#1d4ed8"]]), pct: judge("rgb(100% 0% 0%)", [["--r", "#f00"]]),
      alphaSlash: judge("rgb(29 78 216 / .5)", [["--b", "#1d4ed8"]]), alpha4: judge("rgba(29, 78, 216, 0.5)", [["--b", "#1d4ed8"]]),
      alphaSame: judge("rgba(29, 78, 216, 0.5)", [["--b", "#1d4ed880"]]), hex8: judge("#1d4ed880", [["--b", "#1d4ed8"]]),
      turn: judge("hsl(.5turn 100% 50%)", [["--c", "#0ff"]]), rad: judge("hsl(3.14159rad 100% 50%)", [["--c", "#0ff"]]), grad: judge("hsl(200grad 100% 50%)", [["--c", "#0ff"]]),
      bare: judge("hsl(180 100 50)", [["--c", "#0ff"]]), lpct: judge("oklch(20.5% 0 0)", [["--n", "oklch(0.205 0 0)"]]),
      none: judge("#171717", [["--color-neutral-900", "oklch(20.5% 0 none)"]]), oklab: judge("oklab(0.5 0.1 -0.1)", [["--o", "oklab(50% 25% -25%)"]]),
      zincTw: judge("oklch(21% 0.006 285.885)", [["--color-neutral-900", "oklch(20.5% 0 none)"]]),
      zinc: ["#18181b", "#09090b", "#e4e4e7", "#f4f4f5"].map((v, i) => judge(v, [[["--primary", "--foreground", "--border", "--secondary"][i], ["oklch(0.205 0 0)", "oklch(0.145 0 0)", "oklch(0.922 0 0)", "oklch(0.97 0 0)"][i]]])),
      neutral: judge("#171717", NEUTRAL), neutral2: judge("#0a0a0a", [["--foreground", "oklch(0.145 0 0)"]]),
      hsl: judge("#05787d", [["--teal", "hsl(183 92% 25%)"]]),
      jnd: [judge("#f5f5f5", [["--w", "#fff"]]), judge("#fafafa", [["--w", "#fff"]])],
      nearest: judge("oklch(0.5 0 0)", [["--far", "oklch(0.518 0 0)"], ["--close", "oklch(0.487 0 0)"]]),
      text: judge("lab(50% 40 59.5)", [["--brand", "lab(50% 40 59.5)"]]), textOther: judge("lab(50% 40 59.5)", [["--brand", "lab(50% 40 60)"]]),
      first: judge("#123456", [["--a", "#123456"]], [["--b", "#123456"]]), code: judge("#123456", [], [["--b", "#123456"]]),
    };
    all("1.38 design values: judgeRaw — #fff = #ffffff, rgb(29, 78, 216) = #1d4ed8, % channels, hue in turn / rad / grad, a bare hsl, oklch's L in % and `none`; an alpha that differs is neither the same nor near; Tailwind's zinc-900 against neutral-900 (same notation, 0.0078) and zinc's hexes against shadcn's oklch neutrals are `near`, never the token — #171717 / #0a0a0a are; #05787d = hsl(183 92% 25%) (an HSL side: 0.011); near the NEAREST within 0.02 (#f5f5f5 at 0.0298 none, #fafafa near); lab() by its text; the registry before the code (got " + js(got) + ")", {
      hex3: () => got.hex3.token === "--w", comma: () => got.comma.token === "--b", pct: () => got.pct.token === "--r",
      alpha: () => js(got.alphaSlash) === "{}" && js(got.alpha4) === "{}" && js(got.hex8) === "{}" && got.alphaSame.token === "--b",
      hue: () => got.turn.token === "--c" && got.rad.token === "--c" && got.grad.token === "--c" && got.bare.token === "--c",
      oklch: () => got.lpct.token === "--n" && got.none.token === "--color-neutral-900" && got.oklab.token === "--o",
      zincTw: () => !got.zincTw.token && got.zincTw.near && got.zincTw.near.token === "--color-neutral-900" && got.zincTw.near.delta === 0.0078,
      zinc: () => js(got.zinc.map((x) => [x.token || null, x.near && x.near.delta])) === js([[null, 0.0079], [null, 0.0061], [null, 0.0046], [null, 0.0029]]),
      neutral: () => got.neutral.token === "--primary" && got.neutral2.token === "--foreground",
      hsl: () => got.hsl.token === "--teal",
      jnd: () => js(got.jnd[0]) === "{}" && got.jnd[1].near && got.jnd[1].near.token === "--w",
      nearest: () => got.nearest.near && got.nearest.near.token === "--close",
      text: () => got.text.token === "--brand" && js(got.textOther) === "{}",
      order: () => got.first.token === "--a" && got.code.token === "--b",
    });
  }

  { // (1.38.0 review 1, T1) an HSL side against a hex / rgb one is the same colour only when the other, written in HSL as
    // precisely as the HSL side is, gives its numbers (each channel within half a unit of its last written digit; the hue moot
    // at s 0, s at l 100) — (review 2, R2-T1) or the HSL as written PAINTS it at 8 bits a channel (each within half a
    // unit of 1/255) — under the pair's 0.011, which stays the ceiling; the NEAREST same colour is the token, of equals the
    // first. (%TEMP%/dsd-138f1-tokens/MUTATIONS.md, %TEMP%/dsd-138f2-tokens/MUTATIONS.md: each key kills the mutants it names.)
    const kind = (j) => (j.token ? "token" : j.near ? "near" : "none");
    const pair = (raw, tok) => kind(judge(raw, [["--t", tok]]));
    const got = {
      // shadcn's neutral as its Tailwind 4 upgrade writes it (hsl()) against Tailwind's zinc hexes; cal.com's integer hsla()
      zinc: [["#18181b", "hsl(0 0% 9%)"], ["#f4f4f5", "hsl(0 0% 96.1%)"], ["#e4e4e7", "hsl(0 0% 89.8%)"], ["#09090b", "hsl(0 0% 3.9%)"]].map(([r, t]) => judge(r, [["--n", t]])),
      cal: judge("#efefef", [["--cal-bg-subtle", "hsla(220, 14%, 94%, 1)"]]), rawHsl: pair("hsl(0 0% 3.9%)", "#09090b"), rgbSide: pair("rgb(9 9 11)", "hsl(0 0% 3.9%)"),
      // what must STILL be the token: the true pairs, integer and 1-decimal, hex and rgb()
      keep: [pair("#05787d", "hsl(183 92% 25%)"), pair("rgb(5, 120, 125)", "hsl(183 92% 25%)"), pair("#111827", "hsla(221, 39%, 11%, 1)"), pair("#fff", "hsl(0 0% 100%)"),
        pair("#18181b", "hsl(240 5.9% 10%)"), pair("#05787d", "hsl(182.5 92.3% 25.5%)")],
      // the precision written: one decimal off in s / l / h, painting ANOTHER hex (#3c82f5 and #2463eb — #2563eb's s is 83.19 —,
      // #19191c, #05777d), is another colour
      prec: { s: [pair("#3b82f6", "hsl(217.2 90.2% 59.8%)"), pair("#2563eb", "hsl(221.2 83.5% 53.3%)")], l: pair("#18181b", "hsl(240 5.9% 10.3%)"), h: pair("#05787d", "hsl(183.0 92.3% 25.5%)") },
      // (review 2) the colour an HSL token paints — cal.com's and Radix's, as a picker or devtools give it — from either side; a
      // channel painted at exactly half a unit (25.5) has both neighbours; CSS clamps before it paints; the next hex over (0.56
      // off) is not; the ceiling holds
      paint: { hex: pair("#eeeff2", "hsla(220, 14%, 94%, 1)"), rgb: pair("rgb(238, 239, 242)", "hsla(220, 14%, 94%, 1)"), radix: pair("#ffb224", "hsl(39, 100%, 57.0%)"),
        raw: pair("hsla(220, 14%, 94%, 1)", "#eeeff2"), half: [pair("#191919", "hsl(0 0% 10.0%)"), pair("#1a1a1a", "hsl(0 0% 10.0%)")],
        clamp: pair("#ff2b00", "hsl(10.2 150% 50%)"), next: pair("#edeff2", "hsla(220, 14%, 94%, 1)"), ceiling: pair("#000005", "hsl(236 93% 1%)") },
      // (review 2: from here, pairs the HSL does NOT paint — the hex's rounding alone decides; `.6turn` is 216° ± 18°)
      exp: pair("#05787d", "hsl(1.83e2 92% 25%)"), turns: pair("#05787d", "hsl(903 92% 25%)"), turnHalf: pair("#3b82f6", "hsl(.6turn 91.2% 59.8%)"),
      moot: { grey: pair("#818181", "hsl(217 0% 51%)"), white: pair("#fefefe", "hsl(210 40% 100%)"), black: pair("#000", "hsl(0 100% 0%)") },
      hue: { r: pair("#ff8100", "hsl(30 100% 50%)"), g: [pair("#81ff00", "hsl(90 100% 50%)"), pair("#008100", "hsl(120 100% 25%)")] },
      // (#002748's hue is 207.5 exactly, 207.49999999999997 in floats: 207 and 208 both its rounding)
      wrap: pair("#ff0100", "hsl(360 100% 50%)"), eps: pair("#002748", "hsl(208 100% 14%)"),
      clamp: { rgb: pair("rgb(300 0 0)", "hsl(0 100% 50%)"), sat: pair("#f00", "hsl(0 150% 50%)"), light: pair("#fff", "hsl(0 0% 120%)") },
      // the ceiling: #020200's own integer HSL is black, 0.084 away — never its token (as 1.38)
      ceiling: pair("#020200", "hsl(60 100% 0%)"),
      nearest: { after: judge("#18181b", [["--hsl", "hsl(240 5.9% 10%)"], ["--hex", "#18181b"]]).token, before: judge("#18181b", [["--hex", "#18181b"], ["--hsl", "hsl(240 5.9% 10%)"]]).token },
    };
    all("1.38.0 review 1 (T1) / review 2 (R2-T1): an HSL side against a hex / rgb one by the pair's rounding both ways — Tailwind's zinc hexes against shadcn's hsl() neutrals and cal.com's #efefef against hsla(220, 14%, 94%, 1) are `near`, from either side and for rgb(); #05787d = hsl(183 92% 25%), a 1-decimal pair, gray-900 = cal.com's hsla and #fff stay the token; one decimal off in s / l / h, painting another hex, is near; the hex / rgb() an HSL token paints is its token (#eeeff2, rgb(238, 239, 242), Radix's #ffb224; from either side; a half-unit channel's two neighbours; clamped before it paints), the next hex over is not, nor a painted hex past the 0.011 ceiling; the exponent, the turns of a hue and its half in its own unit (.6turn); the hue moot at s 0, s at l 100 (pairs the HSL does not paint); CSS's clamps; #020200 is not black's token (the 0.011 ceiling); an exact token listed after an HSL one wins (got " + js(got) + ")", {
      zinc: () => js(got.zinc.map((x) => [kind(x), x.near && x.near.delta])) === js([["near", 0.0083], ["near", 0.0032], ["near", 0.0046], ["near", 0.0058]]),
      cal: () => kind(got.cal) === "near" && got.cal.near.token === "--cal-bg-subtle" && got.rawHsl === "near" && got.rgbSide === "near",
      keep: () => got.keep.every((k) => k === "token"),
      prec: () => js(got.prec) === js({ s: ["near", "near"], l: "near", h: "near" }),
      paint: () => js(got.paint) === js({ hex: "token", rgb: "token", radix: "token", raw: "token", half: ["token", "token"], clamp: "token", next: "near", ceiling: "near" }),
      exp: () => got.exp === "token" && got.turns === "token" && got.turnHalf === "token",
      moot: () => js(got.moot) === js({ grey: "token", white: "token", black: "token" }),
      hue: () => got.hue.r === "token" && got.hue.g.every((k) => k === "token") && got.wrap === "token" && got.eps === "token",
      clamp: () => js(got.clamp) === js({ rgb: "token", sat: "token", light: "token" }),
      ceiling: () => got.ceiling === "none",
      nearest: () => got.nearest.after === "--hex" && got.nearest.before === "--hex",
    });
  }

  { // fonts: a STACK (its last family generic, one that is not, nothing built) against the registry's font tokens by its primary
    // family; a code token's stack never makes a font token (designValue drops it: CRIT_2 must-fix 3)
    const F = (v) => T.fontStackOf(v);
    const got = {
      stack: F("\"Inter\", sans-serif"), bang: F("Inter, sans-serif !important"), lone: F("\"Inter\""), generic: F("system-ui, sans-serif"), inherit: F("inherit"),
      built: [F("var(--f), sans-serif"), F("$base-font, sans-serif"), F("@font, serif")], emojiTail: F("Inter, sans-serif, \"Apple Color Emoji\""),
      on: judge("font-family: 'inter', sans-serif", [["--font-sans", "\"Inter\", ui-sans-serif, sans-serif"]], [], "font"),
      off: judge("font-family: Roboto, sans-serif", [["--font-sans", "\"Inter\", ui-sans-serif, sans-serif"]], [], "font"),
      codeOnly: scale([], [["--font-sans", "Inter, sans-serif"]]).fonts.size, regOnly: scale([["--font-sans", "Inter, sans-serif"]], []).fonts.size,
    };
    all("1.38 design values: fontStackOf — `\"Inter\", sans-serif` (and with !important) is a stack whose primary is `inter`; a lone family, a generic-only stack, `inherit`, a built one and a stack that ends in an emoji font are none; `'inter', sans-serif` is the token `\"Inter\", ui-sans-serif, sans-serif`, Roboto none; a code token's stack is no font token, a registry row's is (got " + js(got) + ")", {
      stack: () => got.stack && got.stack.primary === "inter" && got.bang && got.bang.primary === "inter",
      none: () => got.lone === null && got.generic === null && got.inherit === null && got.built.every((x) => x === null) && got.emojiTail === null,
      judged: () => got.on.token === "--font-sans" && js(got.off) === "{}",
      registryOnly: () => got.codeOnly === 0 && got.regOnly === 1,
    });
  }

  { // motion: the literal times above 1 ms and the easing functions, each on the scale for `token`; a keyword easing is not asked
    const DUR = [["--duration-fast", "150ms"], ["--duration-normal", "200ms"], ["--ease-out", "cubic-bezier(0.22, 1, 0.36, 1)"]];
    const m = (v) => T.judgeRaw({ kind: "motion", value: v }, scale(DUR));
    const got = {
      times: T.timesOf("opacity .2s, transform 1.1s 0.01ms 0s 1ms"), easings: T.easingsOf("x cubic-bezier(.22, 1, .36, 1) steps(4, end) linear(0, 1) cubic-bezier(1, 2) ease-in"),
      s: m("transition: opacity .2s"), keyword: m("transition: opacity 200ms ease-in-out"), both: m("transition: opacity 150ms cubic-bezier(.22,1,.36,1)"),
      partly: m("transition: opacity 200ms, transform 300ms"), tw: m("ease-[cubic-bezier(0.22,1,0.36,1)]"), twTime: m("md:hover:duration-[150ms]"), loop: m("animation: spin 1s linear infinite"),
      scale: (() => { const s = scale(DUR.concat([["--spin", "spin 1s linear infinite"], ["--trans", "opacity 300ms cubic-bezier(0.1, 0.2, 0.3, 0.4)"], ["--d2", "0.2s"], ["--e2", "cubic-bezier(.22,1,.36,1)"]])); return [s.durations.size, s.easings.size]; })(),
      // (a value two tokens hold names the FIRST: a duration, an easing, a text colour, a font's primary)
      firsts: (() => { const s = scale(DUR.concat([["--d2", "0.2s"], ["--e2", "cubic-bezier(.22,1,.36,1)"], ["--lab", "lab(50% 40 59.5)"], ["--lab2", "lab(50% 40 59.5)"], ["--f1", "Inter, sans-serif"], ["--f2", "Inter, serif"]]));
        return [T.judgeRaw({ kind: "motion", value: "transition: x .2s" }, s).token, T.judgeRaw({ kind: "motion", value: "ease-[cubic-bezier(0.22,1,0.36,1)]" }, s).token,
          T.judgeRaw({ kind: "color", value: "lab(50% 40 59.5)" }, s).token, T.judgeRaw({ kind: "font", value: "font-family: Inter, monospace" }, s).token]; })(),
    };
    all("1.38 design values: motion — the literal times (.2s = 200ms, 1.1s = 1100ms; 0.01ms, 0s, 1ms are none) and easing functions (a cubic-bezier of four numbers, steps, linear(); a keyword none); a token when EVERY literal is one — .2s = 200ms, a keyword easing not asked, Tailwind's ease-[…] spaced otherwise, variants kept; 200ms + 300ms (300 off the scale) none; a composite `--spin` or `opacity 300ms cubic-bezier(…)` is no token; a value two tokens hold names the first (got " + js(got) + ")", {
      times: () => js(got.times) === js([200, 1100]),
      easings: () => js(got.easings) === js(["cubic-bezier(0.22,1,0.36,1)", "steps(4,end)", "linear(0,1)"]),
      on: () => got.s.token === "--duration-normal" && got.keyword.token === "--duration-normal" && got.both.token === "--duration-fast" && got.tw.token === "--ease-out" && got.twTime.token === "--duration-fast",
      off: () => js(got.partly) === "{}" && js(got.loop) === "{}",
      scale: () => js(got.scale) === js([2, 1]),
      firsts: () => js(got.firsts) === js(["--duration-normal", "--ease-out", "--lab", "--f1"]),
    });
  }

  { // the feature report: fonts and motion are read only when the scale holds such a token — the registry's font row, a duration
    // / easing token of the registry or the code —, each a kind of its own in `counts`; the 1.35 shape stays without one
    const SHEET = lines(".card {", "  color: #1d4ed8;", "  font-family: \"Inter\", sans-serif;", "  transition: opacity 250ms ease;", "  transition-duration: 0.01ms !important;",
      "  transform: translateX(10px);", "  scroll-behavior: smooth;", "  transition-property: opacity;", "}", "@font-face{font-family:\"Inter\";src:url(a.woff2)}",
      ".a { font-family: system-ui, sans-serif; } .b { font-family: inherit; } .c { font-family: var(--f), sans-serif; }", ".d { font-family: Inter, sans-serif !important; }",
      ".e { transition: transform .3s cubic-bezier(.22, 1, .36, 1); animation: spin 1s linear infinite; }",
      ".f { --transition-duration: 250ms; transition: opacity calc(var(--x) * 200ms); }");
    const VIEW = lines("export const C = () => <div className=\"duration-[calc(var(--x)*400ms)] md:duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] ease-[var(--e)] delay-[2s]\" />;");
    const REG = registry([["--color-action", "#1d4ed8"], ["--font-sans", "\"Inter\", ui-sans-serif, sans-serif"], ["--duration-normal", "250ms"], ["--ease-out", "cubic-bezier(0.22, 1, 0.36, 1)"]]);
    const on = report(feature(REG, { "src/checkout/c.css": SHEET, "src/checkout/C.tsx": VIEW }));
    const plain = report(feature(registry([["--color-action", "#1d4ed8"]]), { "src/checkout/c.css": SHEET, "src/checkout/C.tsx": VIEW }));
    const codeMotion = report(feature(null, { "src/styles/tokens.css": ":root { --dur: 250ms; }\n", "src/checkout/c.css": SHEET }));
    const pick = (r, kind) => r.raw.filter((x) => x.kind === kind).map((x) => x.line + " " + x.value + (x.token ? " → " + x.token : ""));
    const fontGroup = on.groups.filter((g) => g.kind === "font").map((g) => [g.value, g.count, g.token]);
    const got = { counts: on.counts, total: on.total, font: pick(on, "font"), motion: pick(on, "motion"), plain: [plain.counts, plain.total], code: codeMotion.counts, fontGroup };
    all("1.38 feature report: with a font and motion tokens the stacks and the motion literals are raw values of their own kind (a token when every literal is one), never a lone face, a generic-only stack, inherit, a built one, the 0.01ms reset, a transform, scroll-behavior, a transition-property, a custom property named like one, a built time; Tailwind's duration / delay / ease arbitrary values (a built one none); the two ways the stack is written are one group; without such a token the 1.35 shape stays: {color, size} (got " + js(got) + ")", {
      fontGroup: () => js(fontGroup) === js([["font-family: \"Inter\", sans-serif", 2, "--font-sans"]]),
      counts: () => js(on.counts) === js({ color: 1, size: 0, font: 2, motion: 6 }) && on.total === 9,
      font: () => js(got.font) === js(["3 font-family: \"Inter\", sans-serif → --font-sans", "12 font-family: Inter, sans-serif !important → --font-sans"]),
      motion: () => js(got.motion) === js(["1 md:duration-[250ms] → --duration-normal", "1 ease-[cubic-bezier(0.22,1,0.36,1)] → --ease-out", "1 delay-[2s]", "4 transition: opacity 250ms ease → --duration-normal",
        "13 transition: transform .3s cubic-bezier(.22, 1, .36, 1)", "13 animation: spin 1s linear infinite"]),
      plain: () => js(plain.counts) === js({ color: 1, size: 0 }) && plain.total === 1 && !plain.raw.some((x) => x.kind === "font" || x.kind === "motion"),
      codeToken: () => js(codeMotion.counts) === js({ color: 1, size: 0, motion: 3 }),
    });
  }

  { // the report's scale: the registry's rows first, then the code's tokens the registry does not name (a value both hold names
    // the registry's; a name the registry holds keeps the registry's value — the code's is not on the scale)
    const x = feature(registry([["--a", "#123456"], ["--x", "#111111"], ["--p", "oklch(0.205 0 0)"]]), {
      "src/styles/tokens.css": ":root { --b: #123456; --c: #abcdef; --x: #222222; }\n",
      "src/checkout/c.css": lines(".v { color: #123456; background: #abcdef; border-color: #222222; outline-color: #18181b; caret-color: #171717; }"),
    });
    const r = report(x);
    const got = r.raw.map((v) => v.value + " " + (v.token || (v.near ? "≈" + v.near.token : "-")));
    all("1.38 feature report: a raw colour is the registry's token first (#123456 = --a, the code's --b too), else a code token the registry lacks (#abcdef = --c); the code's value of a name the registry holds is not on the scale (#222222 names no --x); zinc's #18181b is near shadcn's --p, #171717 is it (got " + js(got) + ")", {
      exact: () => js(got) === js(["#123456 --a", "#abcdef --c", "#222222 -", "#18181b ≈--p", "#171717 --p"]),
    });
  }

  { // groups: every value read, keyed by what it is — a colour notation-free, a utility without its variants —, those read twice
    // or more, the most frequent first (a tie keeps the reading order), each with its count, its files and its first place; the
    // first 50 listed, groupsTotal counts them all; judged like a row
    const many = Array.from({ length: 60 }, (_, i) => "#" + (0x100000 + i * 4099).toString(16).slice(-6));
    const x = feature(registry([["--blue", "#1e40af"]]), {
      "src/checkout/a.css": lines(".a { color: #1E40AF; }", ".b { color: #1e40af; }", ".c { color: rgb(30 64 175); }", ".d { padding: 13px; }", ".e { color: #999999; }"),
      "src/checkout/B.tsx": lines("export const B = () => <div className=\"md:p-[13px] p-[13px] text-[#1e40af]\" />;"),
      "src/checkout/many.css": lines(...many.flatMap((c) => [".m { color: " + c + "; }", ".n { color: " + c + "; }"]), ...Array(3).fill(".z { color: " + many[59] + "; }")),
    });
    const r = report(x);
    const got = { total: r.groupsTotal, listed: r.groups.length, first: r.groups.slice(0, 4).map((y) => [y.kind, y.value, y.count, y.files, y.at.file + ":" + y.at.line, y.token || null]),
      raw: r.raw.length, padding: r.groups.some((y) => y.value === "padding: 13px"), single: r.groups.some((y) => y.value === "#999999") };
    all("1.38 feature report: groups — #1E40AF, #1e40af, rgb(30 64 175) and a Tailwind `text-[#1e40af]` are ONE group (4, in 2 files, judged → --blue); `md:p-[13px]` and `p-[13px]` one (a CSS `padding: 13px` another, read once: none); a value read once is none; 62 repeated values → 50 listed, groupsTotal 62, the most frequent first (a value 5 times before the twice-read ones, a tie in reading order), counted past the 50 raw rows listed (got " + js(got) + ")", {
      colour: () => js(got.first[1]) === js(["color", "#1e40af", 4, 2, "src/checkout/B.tsx:1", "--blue"]),
      top: () => js(got.first[0].slice(0, 3)) === js(["color", many[59], 5]),
      utility: () => js(got.first[2]) === js(["size", "md:p-[13px]", 2, 1, "src/checkout/B.tsx:1", null]) && !got.padding,
      single: () => !got.single,
      bound: () => got.total === 62 && got.listed === 50 && got.raw === 50,
      order: () => js(got.first[3].slice(1, 5)) === js([many[0], 2, 1, "src/checkout/many.css:1"]) && r.groups.slice(1).every((y, i) => y.count <= r.groups[i].count),
    });
  }

  { // spec_finish: colours and sizes alone (CRIT_2 must-fix 4 — 1.37's text and the four prose files stay true): a feature whose
    // raw values are fonts and motion only gets no raw-value warning; finish's part has 1.37's keys (no units, no groups)
    const REG = registry([["--blue", "#1d4ed8"], ["--font-sans", "Inter, sans-serif"], ["--duration-normal", "200ms"]],
      "\n| Property | Units |\n|---|---|\n| font-size | rem |\n");
    const mixed = feature(REG, { "src/checkout/c.css": lines(".a { color: #1d4ed8; font-family: Inter, sans-serif; transition: opacity 200ms; font-size: 14px; }", ".b { color: #123456; }") });
    const only = feature(REG, { "src/checkout/c.css": lines(".a { font-family: Roboto, sans-serif; transition: opacity 250ms; }") });
    const rm = report(mixed), fm = T.designSystemFinish(mixed.p, mixed.slug), fo = T.designSystemFinish(only.p, only.slug);
    const wm = S.finishFeature(mixed.p, mixed.slug).warnings || [], wo = S.finishFeature(only.p, only.slug).warnings || [];
    const rawLine = (w) => w.filter((x) => /raw value/.test(x));
    const got = { report: [rm.counts, rm.total, rm.units && rm.units.total], finish: [fm.raw.counts, fm.raw.total, Object.keys(fm).sort()], only: [fo.raw.counts, fo.raw.total], warn: [rawLine(wm), rawLine(wo)] };
    all("1.38 spec_finish: the report counts fonts and motion (and the units table), finish counts colours and sizes alone — its total, its counts, its warning; a feature whose raw values are a font and a motion value only gets no raw-value warning; finish's part keeps 1.37's keys (got " + js(got) + ")", {
      report: () => js(rm.counts) === js({ color: 2, size: 1, font: 1, motion: 1 }) && rm.total === 5 && rm.units.total === 1,
      finish: () => js(fm.raw.counts) === js({ color: 2, size: 1 }) && fm.raw.total === 3 && js(Object.keys(fm).sort()) === js(["raw", "registered", "tokens", "uiChecks", "unregistered"]),
      only: () => js(fo.raw.counts) === js({ color: 0, size: 0 }) && fo.raw.total === 0 && rawLine(wo).length === 0,
      warn: () => rawLine(wm).length === 1 && /hold 3 raw values/.test(rawLine(wm)[0]),
    });
  }

  { // the new kinds' own bound: DS_RAW_PER_FILE values of a kind a file — a transition-heavy sheet never hides its colours, a past
    // value says `motion-values` / `font-values` (with the file), exactly 200 says nothing; with kinds the early exit waits for
    // each kind to be past its bound (200 colours first, the motion after them still read)
    const REG = registry([["--blue", "#1d4ed8"], ["--font-sans", "Inter, sans-serif"], ["--duration-normal", "200ms"]]);
    const motion = (n, from) => Array.from({ length: n }, (_, i) => ".m" + i + " { transition: opacity " + (from + i) + "ms; }");
    const fonts = (n) => Array.from({ length: n }, (_, i) => ".f" + i + " { font-family: F" + i + ", sans-serif; }");
    const colours = (n) => Array.from({ length: n }, (_, i) => ".c" + i + " { color: #" + (0x100000 + i).toString(16) + "; }");
    const run = (text, more, reg) => report(feature(reg || REG, Object.assign({ "src/checkout/s.css": text }, more)));
    const heavy = run(lines(...motion(250, 2), ...colours(5)), { "src/checkout/t.css": lines(...motion(250, 2)) });
    const exact = run(lines(...motion(200, 2), ...colours(5))), fontHeavy = run(lines(...fonts(250), ...colours(5)));
    // (motion the only new kind read: the early exit may come once it is PAST its bound — never at it, the 201st unseen)
    const MOTION = registry([["--blue", "#1d4ed8"], ["--duration-normal", "200ms"]]);
    const after = run(lines(...colours(200), ...motion(3, 2)), {}, MOTION), past = run(lines(...colours(200), ...motion(201, 2)), {}, MOTION);
    const got = { heavy: [heavy.counts, heavy.limits], exact: [exact.counts, exact.limits], fontHeavy: [fontHeavy.counts, fontHeavy.limits], after: after.counts, past: past.limits };
    all("1.38 feature report: 250 motion values then 5 colours → the colours counted (200 motion a file, `motion-values` {read: 200, file: the FIRST file it cut}); exactly 200 → no limit; 250 font stacks → `font-values`; 200 colours then 3 motion values → the motion read; then 201 → `motion-values` (got " + js(got) + ")", {
      heavy: () => js(heavy.counts) === js({ color: 5, size: 0, font: 0, motion: 400 }) && js(heavy.limits) === js([{ code: "motion-values", read: 200, file: "src/checkout/s.css" }]) && heavy.truncated === true,
      exact: () => exact.counts.motion === 200 && js(exact.limits) === js([]),
      font: () => js(fontHeavy.counts) === js({ color: 5, size: 0, font: 200, motion: 0 }) && js(fontHeavy.limits) === js([{ code: "font-values", read: 200, file: "src/checkout/s.css" }]),
      after: () => after.counts.color === 200 && after.counts.motion === 3,
      past: () => js(past.limits) === js([{ code: "motion-values", read: 200, file: "src/checkout/s.css" }]),
    });
  }

  { // rawValuesOf (no kinds) is 1.37's reader: a stack, a transition and a Tailwind duration are never its values; a value
    // written twice on one line is ONE value of that line; what a `{` follows is a selector — a colour in its attribute is none
    // (the 1.37 rules declarations() carries, replayed after the split)
    const text = lines(".a { font-family: Inter, sans-serif; transition: opacity 250ms; color: #123456; padding: 13px; }", "<div className=\"duration-[250ms]\" />",
      ".b { color: #654321; } .c { color: #654321; }", "a:not([data-color=\"#ff0000\"]) { display: none; }");
    const got = T.rawValuesOf(text, "src/a.css");
    all("1.38 rawValuesOf without kinds: colours and sizes alone, as 1.37; a line's repeated value once; a selector's colour none (got " + js(got) + ")", {
      exact: () => js(got) === js([{ line: 1, kind: "color", value: "#123456" }, { line: 1, kind: "size", value: "padding: 13px" }, { line: 3, kind: "color", value: "#654321" }]),
    });
  }

  { // tools/list: spec_scan's designSystem sentence says "raw values" — fonts and motion are raw values too (−9 characters, the
    // one tools/list change of 1.38; its cap 45,000)
    const d = (list.result.tools.find((t) => t.name === "spec_scan") || {}).description || "";
    all("1.38 tools/list: spec_scan's description names a feature's raw values, no longer \"raw colours / sizes\"", {
      raw: () => d.includes("with `name`, a feature's usage rows against it and the raw values in its view files.") && !d.includes("raw colours / sizes"),
    });
  }
};
