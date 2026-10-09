"use strict";

/**
 * dev-spec-driven — the stop gate's claim scan on a one-byte text (zero-dependency: Node core only; the engine's stopClaims and the
 * Stop hook's pre-filter, hooks/hook-utils.js, both use it).
 *
 * V8 compiles a regex for a one-byte (Latin-1) subject and for a two-byte one apart, and the two-byte code of a Unicode property
 * class is large: [\p{L}\p{N}_] — the claim scan's word boundary, twice in each of ~60 patterns — costs ~0.5 ms a use against ~0.1 ms
 * (Node 26, Windows), so one em dash, curly quote or emoji in a closing message made stopClaims ~110 ms slower (1.26). A text holding a
 * character past U+00FF is scanned as its PROJECTION instead: one Latin-1 character per code point (an index map leads each match
 * back to the original text), each chosen so that every scan regex — rewritten once — answers exactly as the original on the original:
 *   - a code point a pattern names (an em dash, ’, ✓, U+FE0F…) → a C1 control of its own, put in the rewritten patterns where the
 *     original stood — and in each \p{…} class holding it;
 *   - a code point case-equivalent (/iu) to a Latin-1 one (ſ K Å ẞ Ÿ μ Μ) → that Latin-1 character;
 *   - U+2028 / U+2029 → \r (a line terminator; the prose holds no \r);  other whitespace → U+00A0;
 *   - a letter → ª (U+00AA), a number → ² (U+00B2), an Extended_Pictographic → © (U+00A9), anything else → U+009F — each the same
 *     to every pattern atom as the original (a \p{…} class, \w / \W, \s, \d, `.`, [^…], case folding); a code point in two of those
 *     classes (ℹ, U+2139: a letter and a pictograph) → a C1 control added to each class it is in;
 *   - a C1 control the projection uses, found in the original → U+009F.
 * latin1Table(sources) returns null when a pattern holds what the rewrite does not read (another property escape, \P{…}, a class
 * range past ASCII, a cased non-Latin-1 literal, one of the stand-ins): the caller then scans the text as it is — slower, never
 * different. mcp/tests/10-guards-stop-scan.js checks the projected scan answers as the plain one on thousands of messages.
 */

// Non-Latin-1 code points case-equivalent (simple case folding, /iu) to a Latin-1 character — Unicode 15/16 (computed: every code
// point tested against /^[\x00-\xff]$/iu); the test re-derives it.
const FOLD = new Map([[0x178, 0xff], [0x17f, 0x73], [0x39c, 0xb5], [0x3bc, 0xb5], [0x1e9e, 0xdf], [0x212a, 0x6b], [0x212b, 0xe5]]);
const NEUTRAL = 0x9f; // a C1 control: \W, \S, \D, `.`, [^\n] — none of \p{L} \p{N} \p{Extended_Pictographic} \s
const NATURAL = { L: 0xaa, N: 0xb2, EP: 0xa9, S: 0xa0, LT: 0x0d, "": NEUTRAL }; // a Latin-1 character of each class alone
const C1 = []; // the C1 controls handed out to named code points and to the class combinations without a Latin-1 representative
for (let c = 0x80; c < 0x9f; c++) if (c !== 0x85) C1.push(c);
const PROPS = { L: "\\p{L}", N: "\\p{N}", EP: "\\p{Extended_Pictographic}" };
const PROP_NAMES = { L: "L", Letter: "L", N: "N", Number: "N", Extended_Pictographic: "EP" };
let CLASS_RE = null; // compiled on first use (two-byte, tiny)
const classesOf = (cp) => {
  if (!CLASS_RE) CLASS_RE = { L: new RegExp(PROPS.L, "u"), N: new RegExp(PROPS.N, "u"), EP: new RegExp(PROPS.EP, "u"), S: /\s/u };
  const ch = String.fromCodePoint(cp);
  return ["L", "N", "EP", "S"].filter((k) => CLASS_RE[k].test(ch));
};
const hex2 = (c) => "\\x" + c.toString(16).padStart(2, "0");

// A run that needs no reading — printable ASCII and the escapes of a printable ASCII character that name no code point by number
// (\s \w \d \b, \. \( …) — is copied as it is, never atom by atom (the ~68 sources are mostly words and syntax: ~5,000 atoms read
// one by one took ~5 ms). Read singly: a backslash naming a property or a code point (\p \P \u \x \c \k \0-9 \n \r \t \f \v), [ and
// ], a class's - (a range), anything past ASCII or a control.
const RE_RUN_OUT = /(?:[^\x00-\x1f\x7f-￿\\[]|\\[^pPuxck0-9nrtfv\x00-\x1f\x7f-￿])+/y;
const RE_RUN_IN = /(?:[^\x00-\x1f\x7f-￿\\\]-]|\\[^pPuxck0-9nrtfv\x00-\x1f\x7f-￿])+/y;
// Walks a pattern source: calls on(kind, value, raw, inClass) for each atom — "cp" (a literal or an escaped code point), "prop" (a
// \p{…} name; negated: "nprop"), "range" ([lo, hi]), "other" (anything else, copied) — and returns the source rebuilt from what on()
// returns (raw when undefined). Printable ASCII runs are copied without a call. Throws on a form it can't read.
function walk(src, on) {
  let out = "", i = 0, inClass = false, prev = null; // prev: the code point of the class atom just read (a range may follow)
  const emit = (kind, value, raw) => { const r = on(kind, value, raw, inClass); out += r === undefined ? raw : r; };
  const readEscape = (at) => { // → [kind, value, raw, end]
    const n = src[at + 1];
    if (n === undefined) throw new Error("trailing backslash");
    if (n === "p" || n === "P") {
      const m = /^\{([A-Za-z_=]+)\}/.exec(src.slice(at + 2));
      if (!m) throw new Error("bad property escape");
      return [n === "p" ? "prop" : "nprop", m[1], src.slice(at, at + 2 + m[0].length), at + 2 + m[0].length];
    }
    if (n === "u") {
      if (src[at + 2] === "{") {
        const m = /^\{([0-9A-Fa-f]{1,6})\}/.exec(src.slice(at + 2));
        if (!m) throw new Error("bad \\u{}");
        return ["cp", parseInt(m[1], 16), src.slice(at, at + 2 + m[0].length), at + 2 + m[0].length];
      }
      const h = src.slice(at + 2, at + 6);
      if (!/^[0-9A-Fa-f]{4}$/.test(h)) throw new Error("bad \\u");
      let cp = parseInt(h, 16), end = at + 6;
      const lo = /^\\u([dD][c-fC-F][0-9A-Fa-f]{2})/.exec(src.slice(end));
      if (cp >= 0xd800 && cp <= 0xdbff && lo) { cp = 0x10000 + ((cp - 0xd800) << 10) + (parseInt(lo[1], 16) - 0xdc00); end += 6; }
      return ["cp", cp, src.slice(at, end), end];
    }
    if (n === "x") {
      const h = src.slice(at + 2, at + 4);
      if (!/^[0-9A-Fa-f]{2}$/.test(h)) throw new Error("bad \\x");
      return ["cp", parseInt(h, 16), src.slice(at, at + 4), at + 4];
    }
    const simple = { n: 0x0a, r: 0x0d, t: 0x09, f: 0x0c, v: 0x0b, 0: 0 };
    if (Object.prototype.hasOwnProperty.call(simple, n) && !(n === "0" && /[0-9]/.test(src[at + 2] || ""))) return ["cp", simple[n], src.slice(at, at + 2), at + 2];
    if (n === "c") return ["cp", src.charCodeAt(at + 2) % 32, src.slice(at, at + 3), at + 3];
    if (n === "k") { const m = /^<[^>]+>/.exec(src.slice(at + 2)); if (!m) throw new Error("bad \\k"); return ["other", null, src.slice(at, at + 2 + m[0].length), at + 2 + m[0].length]; }
    if (/[1-9]/.test(n)) { const m = /^[0-9]+/.exec(src.slice(at + 1)); return ["other", null, src.slice(at, at + 1 + m[0].length), at + 1 + m[0].length]; }
    if (/[dDwWsSbB]/.test(n)) return ["other", null, src.slice(at, at + 2), at + 2];
    const cp = src.codePointAt(at + 1); // an escaped character stands for itself (\. \- \/ \( …)
    const len = cp > 0xffff ? 2 : 1;
    return ["cp", cp, src.slice(at, at + 1 + len), at + 1 + len];
  };
  while (i < src.length) {
    const run = inClass ? RE_RUN_IN : RE_RUN_OUT;
    run.lastIndex = i;
    const r = run.exec(src);
    if (r) { out += r[0]; i += r[0].length; prev = inClass ? r[0].charCodeAt(r[0].length - 1) : null; continue; }
    const ch = src[i];
    if (inClass && ch === "]") { inClass = false; prev = null; out += ch; i++; continue; }
    if (!inClass && ch === "[") { inClass = true; prev = null; out += src[i + 1] === "^" ? "[^" : "["; i += src[i + 1] === "^" ? 2 : 1; continue; }
    if (inClass && ch === "-" && prev !== null && src[i + 1] !== "]" && i + 1 < src.length) { // a range prev-next
      let next, raw, end;
      if (src[i + 1] === "\\") { const e = readEscape(i + 1); if (e[0] !== "cp") throw new Error("class range to a class escape"); [, next, raw, end] = e; }
      else { next = src.codePointAt(i + 1); end = i + 1 + (next > 0xffff ? 2 : 1); raw = src.slice(i + 1, end); }
      emit("range", [prev, next], "-" + raw);
      prev = null;
      i = end;
      continue;
    }
    if (ch === "\\") {
      const [kind, value, raw, end] = readEscape(i);
      emit(kind, value, raw);
      prev = inClass && kind === "cp" ? value : null;
      i = end;
      continue;
    }
    const cp = src.codePointAt(i);
    const len = cp > 0xffff ? 2 : 1;
    const raw = src.slice(i, i + len);
    if (!inClass && "()|*+?{}.^$".includes(raw)) emit("other", null, raw); // syntax (quantifier braces, groups, anchors) — copied
    else emit("cp", cp, raw);
    prev = inClass ? cp : null;
    i += len;
  }
  if (inClass) throw new Error("unclosed class");
  return out;
}

// The projection's table for these pattern sources → { named: Map(cp → C1), combo: Map("L+EP" → C1), props: {L|N|EP: [C1…]}, used: Set }
// or null (a source the rewrite can't read faithfully — the caller scans the original text).
function latin1Table(sources) {
  const named = new Set();
  const reserved = new Set([...C1, NEUTRAL, ...Object.values(NATURAL)]);
  try {
    for (const src of sources) walk(String(src), (kind, value) => {
      if (kind === "nprop") throw new Error("negated property");
      if (kind === "prop" && !PROP_NAMES[value]) throw new Error("property " + value);
      if (kind === "range" && (value[0] > 0x7f || value[1] > 0x7f)) throw new Error("range past ASCII");
      if (kind === "cp") {
        if (reserved.has(value)) throw new Error("a stand-in in a pattern");
        if (value > 0xff) {
          const ch = String.fromCodePoint(value);
          if (ch.toLowerCase() !== ch || ch.toUpperCase() !== ch || FOLD.has(value)) throw new Error("a cased literal");
          named.add(value);
        }
      }
    });
  } catch {
    return null;
  }
  const free = C1.slice();
  const table = { named: new Map(), combo: new Map(), props: { L: [], N: [], EP: [] } };
  for (const cp of [...named].sort((a, b) => a - b)) {
    if (!free.length) return null;
    const c = free.shift();
    table.named.set(cp, c);
    for (const k of classesOf(cp)) { if (k === "S") return null; table.props[k].push(c); }
  }
  for (const k of ["L+N", "L+EP", "N+EP", "L+N+EP"]) {
    if (!free.length) return null;
    const c = free.shift();
    table.combo.set(k, c);
    for (const p of k.split("+")) table.props[p].push(c);
  }
  table.used = new Set([...table.named.values(), ...table.combo.values()]);
  table.cache = new Map();
  return table;
}

// A pattern source → the same pattern for the projected text (table: latin1Table's, built from a superset of the sources).
function latin1Pattern(src, table) {
  return walk(String(src), (kind, value, raw, inClass) => {
    if (kind === "cp" && value > 0xff) return hex2(table.named.get(value));
    if (kind === "prop") {
      const extra = table.props[PROP_NAMES[value]].map(hex2).join("");
      if (!extra) return raw;
      return inClass ? raw + extra : "[" + raw + extra + "]";
    }
    return undefined;
  });
}

// The Latin-1 character a code point past U+00FF stands as (null: none — e.g. whitespace that is also a letter).
function standIn(cp, table) {
  if (table.named.has(cp)) return table.named.get(cp);
  if (FOLD.has(cp)) return FOLD.get(cp);
  if (cp === 0x2028 || cp === 0x2029) return NATURAL.LT;
  const k = classesOf(cp);
  if (k.includes("S")) return k.length === 1 ? NATURAL.S : null;
  const key = k.join("+");
  return key in NATURAL ? NATURAL[key] : table.combo.has(key) ? table.combo.get(key) : null;
}
// Does the text hold a character past U+00FF?
const RE_WIDE = /[^\x00-\xff]/;
const hasWide = (text) => RE_WIDE.test(text);
// text → { text: its one-byte projection, at: [projected index → original index] (length + 1; null when they are the same) } — or null
// (a character no Latin-1 one stands for: the caller scans the original). A text without a character past U+00FF is returned as a
// one-byte copy (a slice of a two-byte string can stay two-byte in V8 even when what it holds is Latin-1).
function latin1Text(text, table) {
  const s = String(text);
  if (!hasWide(s)) return { text: Buffer.from(s, "latin1").toString("latin1"), at: null };
  const codes = new Uint8Array(s.length);
  let at = null, n = 0;
  for (let i = 0; i < s.length;) {
    const cp = s.codePointAt(i);
    const len = cp > 0xffff ? 2 : 1;
    let c;
    if (cp <= 0xff) c = table.used.has(cp) ? NEUTRAL : cp;
    else {
      c = table.cache.get(cp);
      if (c === undefined) { c = standIn(cp, table); table.cache.set(cp, c); }
      if (c === null) return null;
    }
    if (len === 2 && !at) { at = []; for (let k = 0; k <= n; k++) at.push(k); } // the first astral code point: the map starts
    if (at) at[n] = i;
    codes[n++] = c;
    i += len;
  }
  if (at) at[n] = s.length;
  return { text: Buffer.from(codes.buffer, codes.byteOffset, n).toString("latin1"), at };
}

module.exports = { FOLD, latin1Table, latin1Pattern, latin1Text, hasWide, walk };
