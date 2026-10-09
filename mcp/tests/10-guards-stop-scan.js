"use strict";
// Guards and hooks — 1.27: the stop gate's claim scan on a one-byte text (mcp/lib/latin1-scan.js) — the same answers as the plain scan, without the two-byte regex cost.
// (A character past U+00FF in the closing message — an em dash, a curly quote, an emoji — made V8 compile every claim pattern's
// [\p{L}\p{N}_] boundaries for a two-byte subject: stopClaims ~120 ms slower, the Stop hook's pre-filter ~30 ms.)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

exports.run = async ({ ok, all, S, tmp, __dirname, require, remeasure }) => {
  const js = JSON.stringify;
  const L1 = require("./lib/latin1-scan.js");
  const HU = require("../hooks/hook-utils.js");
  const f = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hooks", "stop-claims.generated.json"), "utf8"));
  const C = (cp) => String.fromCodePoint(cp);

  // (a) the projection answers as the plain scan — stopClaims (claim, admitted, the claims' text) and the hook's pre-filter — on
  // generated messages full of wide characters: every pattern-named one (— – ’ ✓ ✔ U+FE0F), letters / numbers / pictographs / spaces /
  // marks of other scripts, the case-folding ſ K Å ẞ Ÿ μ Μ, U+2028, ℹ (a letter AND a pictograph), astral emoji, and the C1 controls
  // and Latin-1 characters the projection stands in with
  {
    const wide = [0x2014, 0x2013, 0x2019, 0x2018, 0x201c, 0x201d, 0x2026, 0x2713, 0x2714, 0x2705, 0x274c, 0xfe0f, 0x1f389, 0x1f680, 0x2139, 0x3c0, 0x3a0, 0x17f,
      0x212a, 0x212b, 0x1e9e, 0x178, 0x3bc, 0x39c, 0x2003, 0x3000, 0x2028, 0x2029, 0x300, 0x301, 0x663, 0x4e2d, 0x200d, 0x2192, 0x2022, 0x2167, 0x80, 0x81, 0x88, 0x9f,
      0xaa, 0xb2, 0xa9, 0xa0, 0xb5].map(C);
    const frags = ["All", "tasks", "task 3", "is", "are", "done", "complete", "implemented", "verified", "I", "I've", "I’ve", "we", "the feature", "everything",
      "works", "tests", "pass", "ready to merge", "good to go", "Status:", "DONE", "not", "isn’t", "?", ".", ",", "—", "–", "\n", "✅", "✓", "✔️", "a tarefa 2", "está",
      "foi", "feito", "concluída", "terminei", "implementei", "tudo", "pronto para merge", "os testes", "passam", "a passar", "verdes", "funciona", "la tarea", "están",
      "terminada", "hecho", "listo", "he", "se ha", "completado", "terminé", "las pruebas", "pasan", "en verde", "probado", "que", "de leer", "in src/a.ts", "x",
      "2 failing", "0 tests failing", "not verified", "fixed the 2 failing tests", "tasks 1–3 done", "`code — done`", "> quoted done", "```\ndone\n```", "**Done**", "- done"];
    let seed = 27;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const hand = ["Work complete — ready to merge.", "Done — all tests pass.", "All tasks done ✅", "✅ Feito", "Hecho ✅", "Tasks 1–3 are done.", "It isn’t done yet.",
      "Done ✓", "✔️ Done", "ℹ️ All tasks done.", "ſtatus: done", "All teſts paſs.", "Everything worKs.", "Done" + C(0x2028) + "all tests pass.", "All" + C(0x2003) + "done.",
      "A tarefa 2 está conclu" + "i" + C(0x301) + "da.", "Here is the summary — no claim.", "Not finished yet — I need the API key first.", "Tudo pronto 🎉", "Listo para el merge 🚀",
      "λ All tasks done.", "Done.", "2 failing — not verified."];
    const gen = [];
    for (let i = 0; i < 3000; i++) {
      let m = "";
      const n = 1 + Math.floor(rnd() * 12);
      for (let k = 0; k < n; k++) {
        let x = pick(frags);
        if (rnd() < 0.35) { const at = Math.floor(rnd() * (x.length + 1)); x = x.slice(0, at) + pick(wide) + x.slice(at); }
        m += x + (rnd() < 0.8 ? " " : rnd() < 0.5 ? pick(wide) : "");
      }
      gen.push(m);
    }
    const msgs = hand.concat(gen);
    const plainHook = (m) => new RegExp(f.word.pre + "(?:" + f.claims.join(")|(?:") + ")" + f.word.post, String(f.word.flags).replace("g", "")).test(HU.claimProse(m, f.prose));
    const differ = [], hookDiffer = [], missed = [];
    let claims = 0, admitted = 0;
    for (const m of msgs) {
      const a = S.stopClaims(m), b = S.stopClaims(m, { plain: true });
      if (js(a) !== js(b)) differ.push([m, a, b]);
      if (a.claim) claims++;
      if (a.admitted) admitted++;
      const h = HU.claimMatch(m, f);
      if (h !== plainHook(m)) hookDiffer.push(m);
      if (a.claim && !h) missed.push(m);
    }
    const loaded = Object.keys(require.cache).some((k) => /[\\/]mcp[\\/]lib[\\/]latin1-scan\.js$/.test(k));
    all("1.27: the claim scan on a one-byte projection answers as the plain scan — stopClaims (claim, admitted, the claims' own text) and the Stop hook's pre-filter — on " +
      msgs.length + " messages with wide characters (" + claims + " claims, " + admitted + " admissions); every claim still passes the pre-filter (got " +
      js({ differ: differ.slice(0, 2), hookDiffer: hookDiffer.slice(0, 2), missed: missed.slice(0, 2) }) + ")", {
      same: () => differ.length === 0, hookSame: () => hookDiffer.length === 0, superset: () => missed.length === 0,
      enough: () => claims > 600 && admitted > 100, projected: () => loaded,
      table: () => L1.latin1Table([f.word.pre + f.word.post, ...f.claims, ...f.triggers.map((t) => t.source)]) !== null,
    });
  }

  // (b) the projection itself: one Latin-1 character per code point (an index map for astral ones), each standing for its class; a text
  // without wide characters comes back as a one-byte copy; the fold table is every code point /iu reads as a Latin-1 one (re-derived)
  {
    const t = L1.latin1Table([f.word.pre + f.word.post, ...f.claims]);
    const text = "a" + C(0x2014) + "b " + C(0x1f389) + " " + C(0x3c0) + " " + C(0x212a) + " " + C(0x2139) + C(0x2003) + C(0x663) + C(0x2028) + C(0x81) + "!";
    const p = L1.latin1Text(text, t);
    const back = p.at ? p.text.split("").map((_, k) => text.slice(p.at[k], p.at[k + 1])) : null;
    const fold = [];
    const any = /^[\x00-\xff]$/iu;
    for (let cp = 0x100; cp <= 0x10ffff; cp++) if ((cp < 0xd800 || cp > 0xdfff) && any.test(C(cp))) fold.push(cp);
    const foldOk = fold.length === L1.FOLD.size && fold.every((cp) => L1.FOLD.has(cp) && new RegExp("^" + C(L1.FOLD.get(cp)) + "$", "iu").test(C(cp)));
    const copy = L1.latin1Text("plain café", t);
    all("1.27: the projection — one Latin-1 character per code point, mapped back by index (an astral emoji is one), each a stand-in of its class (a named one: its own C1; π → ª, K → k, ٣ → ², 🎉 → ©, U+2003 → U+00A0, U+2028 → \\r, a C1 control → U+009F); a Latin-1 text comes back as itself; the fold table is complete (" +
      fold.map((c) => c.toString(16)).join(" ") + ") (got " + js({ text: p && p.text, back, fold: fold.length }) + ")", {
      oneByte: () => !/[^\x00-\xff]/.test(p.text) && p.text.length === back.length && back.join("") === text,
      classes: () => p.text === "a" + String.fromCharCode(t.named.get(0x2014)) + "b \xa9 \xaa k " + String.fromCharCode(t.combo.get("L+EP")) + "\xa0\xb2\r\x9f!",
      astral: () => back[4] === C(0x1f389), copy: () => copy.text === "plain café" && copy.at === null, fold: () => foldOk,
    });
  }

  // (c) the rewrite refuses what it can't read faithfully — the caller then scans the text as it is (slower, never different)
  {
    const refused = ["\\P{L}", "\\p{Lu}", "[à-ÿ]", "[\\u2010-\\u2015]", "\\xaa", "ª", "Ω", "\\r", "\\u0081"].filter((s) => L1.latin1Table([s]) !== null);
    const accepted = ["(?<![\\p{L}\\p{N}_])(?:done)(?![\\p{L}\\p{N}_])", "[-–]", "[.,!:—–-]", "\\u2713|\\u2714", "[ \\t*_#>\\p{Extended_Pictographic}\\uFE0F\\u2713\\u2714-]",
      "[^\\n]", "status\\W{0,8}done", "a\\-b[\\]x]"].filter((s) => L1.latin1Table([s]) === null);
    const rw = L1.latin1Pattern("[-–]x\\u2013", L1.latin1Table(["[-–]x\\u2013"]));
    ok(!refused.length && !accepted.length && rw === "[-\\x80]x\\x80",
      "1.27: latin1Table refuses \\P{…}, another property, a class range past ASCII, a stand-in, a cased non-Latin-1 literal or \\r in a pattern, and reads the claim patterns' forms (\\p{L} \\p{N} \\p{Extended_Pictographic}, a named dash or check mark, escaped ones, [^\\n], \\W{0,8}, escaped brackets); a named code point is rewritten to its stand-in (got " +
      js({ refused, accepted, rw }) + ")");
  }

  // (e) the Stop hook end to end on wide messages (a project with a tick and no evidence: a claim is sent back): no trigger word → silent
  // before the engine loads (its triggers read the prose as it is), a trigger but no claim → silent too (the claims scan the projection),
  // a claim with an em dash or an emoji → the engine's block
  {
    const p = path.join(tmp, "stop-scan-hook");
    S.initProject(p, ["core"], "en");
    const fe = S.createFeature(p, "Pay", ["core"], "", undefined, "en");
    fs.writeFileSync(path.join(fe.dir, "tasks.md"), "- [ ] 1. [US1] Charge\n  - _Verify: npm test_\n");
    S.completeTask(p, "pay", 1);
    const pre = path.join(tmp, "stop-scan-preload.js"), out = path.join(tmp, "stop-scan-preload.out");
    fs.writeFileSync(pre, "process.on('exit', () => require('fs').writeFileSync(" + js(out) + ", String(Object.keys(require.cache).some((k) => /[\\\\/]mcp[\\\\/]lib[\\\\/]spec\\.js$/.test(k)))));\n");
    const stop = (m) => {
      try { fs.unlinkSync(out); } catch { /* none */ }
      const r = spawnSync(process.execPath, ["-r", pre, path.join(__dirname, "..", "hooks", "stop-hook.js")], { encoding: "utf8", timeout: 30000,
        env: { ...process.env, CLAUDE_PROJECT_DIR: "", SPEC_PROJECT_DIR: "" }, input: js({ session_id: "s", cwd: p, hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: m }) });
      let block = false;
      try { block = JSON.parse(r.stdout).decision === "block"; } catch { /* silent */ }
      return (block ? "block" : r.stdout === "" ? "silent" : "?") + "/" + (fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "?");
    };
    const got = ["Here is the summary — the layout you asked about.", "Not finished yet — I need the API key first.", "Work complete — ready to merge.", "All tasks done ✅"].map(stop);
    ok(js(got) === js(["silent/false", "silent/false", "block/true", "block/true"]),
      "1.27: the Stop hook on wide messages — no trigger word: silent, no engine; a trigger without a claim: silent, no engine; a claim with an em dash or an emoji: the engine's block (got " + js(got) + ")");
  }

  // (d) the cliff, in fresh processes (the regexes compile once per process — what each Stop hook pays): a claim with an em dash scanned
  // projected costs well under the plain scan of the same message (it cost ~6× the ASCII one), and near the ASCII one
  {
    const SPEC = path.join(__dirname, "lib", "spec.js");
    const child = (msg, plain) => {
      const r = spawnSync(process.execPath, ["-e", "const S = require(" + js(SPEC) + "); S.msg('en'); S.msg('pt'); S.msg('es'); const t0 = process.hrtime.bigint(); const r = S.stopClaims(" +
        js(msg) + ", { plain: " + plain + " }); process.stdout.write(JSON.stringify([Number(process.hrtime.bigint() - t0) / 1e6, r.claim]));"], { encoding: "utf8", timeout: 60000 });
      try { return JSON.parse(r.stdout); } catch { return [NaN, null]; }
    };
    const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const wideMsg = "Work complete — ready to merge.", asciiMsg = "Work complete, ready to merge.";
    const measure = () => {
      const w = [], p = [], a = [];
      let claims = true;
      for (let i = 0; i < 5; i++) {
        const x = child(wideMsg, false), y = child(wideMsg, true), z = child(asciiMsg, false);
        w.push(x[0]); p.push(y[0]); a.push(z[0]);
        claims = claims && x[1] === true && y[1] === true && z[1] === true;
      }
      return { projected: med(w), plain: med(p), ascii: med(a), claims };
    };
    const holds = (s) => s.claims && s.projected < 0.75 * s.plain && s.projected <= Math.max(60, 3 * s.ascii);
    const s = remeasure(measure, holds);
    ok(holds(s), "1.27: stopClaims on a closing message with an em dash, in a fresh process — projected " + Math.round(s.projected) + " ms vs the plain two-byte scan " +
      Math.round(s.plain) + " ms (ASCII: " + Math.round(s.ascii) + " ms; median of 5 each)" + (s.tries > 1 ? " — measured " + s.tries + " times" : "") + " (got " + js(s) + ")");
  }
};
