"use strict";

/**
 * dev-spec-driven engine — design values (1.38): what a raw value of a view file is against the project's own scale, and
 * what a registry token's value is against the code's. Pure — no fs, no require, nothing linked —, called by the
 * design-system report (engine/design-system.js); the lazy tier.
 *   - colours: hex (3 / 4 / 6 / 8 digits), rgb / rgba, hsl / hsla, oklab, oklch (CSS Color 4: comma or space syntax, %
 *     channels, an alpha after `/` or as a 4th argument, a hue in deg / turn / rad / grad, `none` = 0) → OKLab. `token`: the
 *     nearest token of the SAME colour — exact within one notation (float noise, a powerless hue), across two within the
 *     rounding of the pair as written (0.011 with an HSL side — integer HSL's rounding —, 0.001 otherwise — a hex written as
 *     3-decimal oklch is within 0.0007: Tailwind's zinc is NOT shadcn's neutral, 0.003–0.008 apart); an HSL side against a
 *     hex / rgb one also by the pair's rounding both ways (roundTrip: the hex in HSL rounds to the HSL as written, or the HSL
 *     paints the hex at 8 bits — zinc's #18181b is not hsl(0 0% 9%), 0.0083 apart; #eeeff2 is hsl(220 14% 94%)); `near`, a
 *     hint: the nearest token within the just-noticeable difference (0.02 ΔEOK). hwb / lab / lch / color() / a named colour
 *     are not parsed: the same TEXT names the token (1.37's rule, colorKey);
 *   - fonts: a `font-family` stack (its last family a generic one, one family that is not) by its primary family, against
 *     the font tokens of the REGISTRY's rows (a code token's stack is never read: designValue drops it);
 *   - motion: the literal times (above 1 ms) and easing functions of a transition / animation declaration or a Tailwind
 *     `duration-[…]` / `delay-[…]` / `ease-[…]`, against the duration and easing tokens — on the scale or raw, never a nearest;
 *   - groups: a raw value's key — a colour's notation-free (#1E40AF = rgb(30 64 175)), a Tailwind utility's without its variants;
 *   - drift: a registry token's value against the code's, within one notation (a colour's, a quantity's unit after s → ms);
 *   - the units table: a declaration's top-level lengths, a Tailwind utility's property.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js.
 */

const DS_EXACT = 1e-4; // ΔEOK within one notation: float noise, a hue that is powerless at chroma 0
const DS_SAME_HSL = 0.011; // …across two notations, one of them HSL (integer HSL's rounding: #05787d = hsl(183 92% 25%), 0.0106 —
// against a hex / rgb, the pair's round trip narrows it: sameAt)
const DS_SAME_CROSS = 0.001; // …across any other two (a hex as 3-decimal oklch: within 0.0007)
const DS_JND = 0.02; // `near`: the just-noticeable difference
const DS_ALPHA = 0.01; // alphas that differ by more are never the same colour, nor near

// --- colours ---------------------------------------------------------------------------------------------------------------------
const RE_HEX_COLOR = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RE_COLOR_CALL = /^(rgba?|hsla?|oklab|oklch)\(([^()]*)\)$/i;
const RE_ARG = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?)(%|deg|grad|rad|turn)?$/i;
// one argument → { v, u (its unit, lower-cased: "" | % | an angle's) } | null; `none` is 0 (CSS Color 4)
const argOf = (tok) => {
  if (/^none$/i.test(tok)) return { v: 0, u: "" };
  const m = RE_ARG.exec(tok);
  return m ? { v: Number(m[1]), u: (m[2] || "").toLowerCase() } : null;
};
const hueOf = (x) => (x.u === "" || x.u === "deg" ? x.v : x.u === "turn" ? x.v * 360 : x.u === "rad" ? (x.v * 180) / Math.PI : x.u === "grad" ? x.v * 0.9 : NaN);
// half a unit of a number's last written digit: `96.1%` 0.05, `25%` 0.5, `.5turn` 0.05, `1.83e2` 0.5 (`none` 0.5)
const halfDigit = (t) => { const m = /^[+-]?\d*(?:\.(\d+))?(?:e([+-]?\d+))?/i.exec(t); return 0.5 * 10 ** (Number(m[2] || 0) - (m[1] || "").length); };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
// sRGB (0..1, gamma-encoded) → OKLab (Björn Ottosson's matrices)
function okFromRgb(r0, g0, b0) {
  const r = toLinear(clamp01(r0)), g = toLinear(clamp01(g0)), b = toLinear(clamp01(b0));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function rgbFromHsl(h0, s, l) {
  const h = ((h0 % 360) + 360) % 360, c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
// A colour as written → { n (its notation: hex · rgb · hsl · oklab · oklch), ok ([L, a, b]), alpha } | null. (Linear: both
// patterns are anchored, the arguments split once — a raw colour is ≤ 60 characters inside, a registry cell ≤ 200.)
function parseColor(s0) {
  const s = String(s0 == null ? "" : s0).trim();
  const hex = RE_HEX_COLOR.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length < 6) h = h.split("").map((c) => c + c).join("");
    const ch = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { n: "hex", ok: okFromRgb(ch(0), ch(2), ch(4)), alpha: h.length === 8 ? ch(6) : 1, rgb: [ch(0), ch(2), ch(4)] };
  }
  const call = RE_COLOR_CALL.exec(s);
  if (!call) return null;
  const fn = call[1].toLowerCase(), n = fn === "rgba" ? "rgb" : fn === "hsla" ? "hsl" : fn;
  let body = call[2].trim(), alphaText = null;
  const slash = body.indexOf("/");
  if (slash !== -1) { alphaText = body.slice(slash + 1).trim(); body = body.slice(0, slash).trim(); }
  const comma = body.includes(",");
  const parts = comma ? body.split(",").map((x) => x.trim()) : body.split(/\s+/);
  // (the legacy comma syntax of rgb / hsl takes its alpha as a 4th argument)
  if (comma && slash === -1 && parts.length === 4 && (n === "rgb" || n === "hsl")) alphaText = parts.pop();
  if (parts.length !== 3) return null;
  const a = parts.map(argOf);
  if (a.some((x) => !x)) return null;
  let alpha = 1;
  if (alphaText != null) {
    const x = argOf(alphaText);
    if (!x || (x.u && x.u !== "%")) return null;
    alpha = clamp01(x.u === "%" ? x.v / 100 : x.v);
  }
  const pct = (x, full) => (x.u === "%" ? (x.v / 100) * full : x.u === "" ? x.v : NaN);
  let ok, rgb, hsl;
  if (n === "rgb") {
    rgb = a.map((x) => clamp01(x.u === "%" ? x.v / 100 : x.u === "" ? x.v / 255 : NaN));
    ok = okFromRgb(rgb[0], rgb[1], rgb[2]);
  } else if (n === "hsl") {
    const h = hueOf(a[0]), sat = clamp01(pct(a[1], 100) / 100), light = clamp01(pct(a[2], 100) / 100); // (a bare number is a percentage's: CSS Color 4)
    const paint = rgbFromHsl(h, sat, light);
    ok = okFromRgb(...paint);
    // (its numbers as written, half a unit of each one's last written digit — the hue's in degrees: `.5turn` 18 —, and the
    // sRGB triple it paints)
    hsl = { h, s: sat * 100, l: light * 100, paint, half: [hueOf({ v: halfDigit(parts[0]), u: a[0].u }), halfDigit(parts[1]), halfDigit(parts[2])] };
  } else if (n === "oklab") ok = [pct(a[0], 1), pct(a[1], 0.4), pct(a[2], 0.4)];
  else {
    const L = pct(a[0], 1), C = pct(a[1], 0.4), h = (hueOf(a[2]) * Math.PI) / 180;
    ok = [L, C * Math.cos(h), C * Math.sin(h)];
  }
  return ok.every(Number.isFinite) ? { n, ok, alpha, rgb, hsl } : null;
}
const deltaE = (p, q) => Math.hypot(p.ok[0] - q.ok[0], p.ok[1] - q.ok[1], p.ok[2] - q.ok[2]);
// Two parsed colours are the same colour: within the tolerance of their notations' pair, alphas alike. (sameColor is drift's,
// in one notation; the judge's is sameAt, below.)
const sameTolerance = (p, q) => (p.n === q.n ? DS_EXACT : p.n === "hsl" || q.n === "hsl" ? DS_SAME_HSL : DS_SAME_CROSS);
const sameColor = (p, q) => Math.abs(p.alpha - q.alpha) <= DS_ALPHA && deltaE(p, q) <= sameTolerance(p, q);
// (1.38.0 review 1) An HSL colour as written and an sRGB triple (a hex's, an rgb()'s): the triple, written in HSL as precisely
// as the HSL side is, gives its numbers — each channel within half a unit of its last written digit; the hue moot at s 0, the
// saturation at l 100 (at l 0 the HSL paints black, the one hex within 0.011 of it: roundTrip's painted check, review 2).
// `#05787d` rounds to hsl(183 92% 25%); zinc's #18181b (s 5.9%) never to hsl(0 0% 9%).
function roundsTo(hsl, [r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, within = (x, y, half) => Math.abs(x - y) <= half + 1e-9;
  if (!within((max + min) * 50, hsl.l, hsl.half[2])) return false;
  if (hsl.l === 100) return true;
  if (!within((d / (1 - Math.abs(max + min - 1))) * 100, hsl.s, hsl.half[1])) return false;
  if (hsl.s === 0) return true;
  // (the hue's distance round the circle: either side's turns and sign never matter)
  const dh = Math.abs((max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 - hsl.h) % 360;
  return within(Math.min(dh, 360 - dh), 0, hsl.half[0]);
}
// (1.38.0 review 2) The pair's rounding both ways: the triple rounds to the HSL as written (roundsTo), OR the HSL as written
// paints the triple at 8 bits a channel (each within half a unit of 1/255) — cal.com's hsla(220, 14%, 94%, 1) paints #eeeff2,
// whose own HSL (225 13.3% 94.1%) does not round to it.
const roundTrip = (hsl, rgb) => hsl.paint.every((c, i) => Math.abs(c - rgb[i]) * 255 <= 0.5 + 1e-9) || roundsTo(hsl, rgb);
// Two parsed colours (alphas alike) at ΔEOK d are the same colour: within their pair's tolerance — and an HSL one against a
// hex / rgb one round-trips. (The tolerance stays the ceiling, the round trip only narrows it: 479 of the 16.7M hexes are
// farther than 0.011 from their own integer HSL — near black, #020200 = hsl(60 100% 0%) at 0.084; saturated yellows to 0.013
// — and are not its token, as in 1.38.)
const sameAt = (p, q, d) => d <= sameTolerance(p, q) && (p.hsl && q.rgb ? roundTrip(p.hsl, q.rgb) : q.hsl && p.rgb ? roundTrip(q.hsl, p.rgb) : true);
// A colour as text is compared (1.37's rule — for what is not parsed: hwb / lab / lch / color() / a name): lower-cased, blanks
// out. (1.37 also wrote a 3 / 4-digit hex out: a hex is always parsed now.)
const colorKey = (v) => String(v).trim().toLowerCase().replace(/\s+/g, "");

// --- quantities, fonts, motion ----------------------------------------------------------------------------------------------------
// One number with one unit or none → { n, unit } | null; a time in seconds is milliseconds (the one certain conversion), its
// float noise rounded away (1.005s = 1005ms, never 1004.9999999999999).
const RE_QUANTITY = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))([a-z]+|%)?$/i;
function quantity(s0) {
  const m = RE_QUANTITY.exec(String(s0 == null ? "" : s0).trim());
  if (!m) return null;
  const unit = (m[2] || "").toLowerCase();
  return unit === "s" ? { n: Math.round(Number(m[1]) * 1e9) / 1e6, unit: "ms" } : { n: Number(m[1]), unit };
}
// CSS Fonts 4's generic families — a closed list
const FONT_GENERICS = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace",
  "ui-rounded", "math", "emoji", "fangsong"]);
const RE_FONT_BUILT = /var\(|[$@]|#\{/;
const fontName = (x) => x.trim().replace(/^(["'])(.*)\1$/, "$2").trim().replace(/\s+/g, " ").toLowerCase();
// A font-family value that is a STACK → { primary (its first family, unquoted, lower-cased), key (the stack so) } | null: its last
// family a generic one, at least one that is not, nothing built (`var(`, a Sass / Less variable, an interpolation) — never a
// lone family (`@font-face { font-family: "Inter" }` declares a face), `inherit`, `system-ui, sans-serif`.
function fontStackOf(v0) {
  const v = String(v0 == null ? "" : v0).replace(/\s*!important\s*$/i, "").trim();
  if (!v || RE_FONT_BUILT.test(v)) return null;
  const items = v.split(",").map(fontName);
  // (a lone family is never a stack: it would be generic and not at once)
  if (!FONT_GENERICS.has(items[items.length - 1]) || items.every((x) => FONT_GENERICS.has(x))) return null;
  return { primary: items[0], key: items.join(",") };
}
// The properties that hold times and easings — a closed CSS list (item 1's "motion declared" is another predicate: never one
// for two rules)
const RE_MOTION_PROP = /^(?:transition|animation)(?:-(?:duration|delay|timing-function))?$/i;
const RE_TIME = /(?<![\w.-])(\d+(?:\.\d+)?|\.\d+)(ms|s)(?![\w-])/gi;
const RE_EASING = /(?<![\w-])(cubic-bezier|steps|linear)\(([^()]{0,120})\)/gi;
// the literal times of a value, in ms, above 1 ms (the reduced-motion reset `0.01ms` is never raw — the 1px hairline's precedent)
const timesOf = (v) => [...String(v).matchAll(RE_TIME)].map((m) => quantity(m[1] + m[2]).n).filter((ms) => ms > 1);
// an easing function as compared: its name and its arguments, numbers written out (`.22` = `0.22`), blanks dropped
const easingKey = (name, args) => name.toLowerCase() + "(" + args.split(",").map((x) => { const t = x.trim().toLowerCase(); return RE_QUANTITY.test(t) && !/[a-z%]$/.test(t) ? String(Number(t)) : t; }).join(",") + ")";
// the literal easing functions of a value (a cubic-bezier of four numbers, steps(…), linear(…)) — a keyword (`ease-in-out`) is none
const easingsOf = (v) => [...String(v).matchAll(RE_EASING)].map((m) => easingKey(m[1], m[2])).filter((k) => !k.startsWith("cubic-bezier(") || /^cubic-bezier\(-?[\d.e+-]+(?:,-?[\d.e+-]+){3}\)$/.test(k));
// A value that IS one easing function (a token's) → its key | null
const easingOf = (v) => { const s = String(v).trim(), e = easingsOf(s); return e.length === 1 && s.replace(RE_EASING, "").trim() === "" ? e[0] : null; };
// A Tailwind utility as a raw value holds no blank (`md:p-[13px]`); a declaration does (`padding: 13px`)
const RE_VARIANTS = /^(?:[a-z0-9-]{1,24}:){1,4}/;
const isUtility = (v) => !/\s/.test(v) && v.includes("-[");
const bareUtility = (v) => (isUtility(v) ? v.replace(RE_VARIANTS, "") : v);
// what a raw value holds: a declaration's value (after its `prop: `); a utility past its first variant, whole without one (its
// literals are read where they stand: `duration-[250ms]`, `md:ease-[cubic-bezier(…)]`)
const valueOf = (v) => v.slice(v.indexOf(":") + 1);

// --- the scale ---------------------------------------------------------------------------------------------------------------------
// The tokens a raw value is judged against, built once a report → { colors ([{name, p}], parsed), text (colorKey → name: what is
// not parsed), durations (ms → name), easings (key → name), fonts (primary → name: the registry's rows alone) }. registry: its
// rows read with their values ({name, value}); code: the code's tokens whose name the registry does not hold. The registry's
// first: a value both hold names the registry's token.
function tokenScale(registry, code) {
  const s = { colors: [], text: new Map(), durations: new Map(), easings: new Map(), fonts: new Map() };
  const put = (t, own) => {
    const v = String(t.value == null ? "" : t.value).trim();
    if (!v) return;
    const k = colorKey(v);
    if (!s.text.has(k)) s.text.set(k, t.name);
    const p = parseColor(v);
    if (p) { s.colors.push({ name: t.name, p }); return; }
    const q = quantity(v);
    if (q && q.unit === "ms") { if (!s.durations.has(q.n)) s.durations.set(q.n, t.name); return; }
    const e = easingOf(v);
    if (e) { if (!s.easings.has(e)) s.easings.set(e, t.name); return; }
    const f = own ? fontStackOf(v) : null;
    if (f && !s.fonts.has(f.primary)) s.fonts.set(f.primary, t.name);
  };
  for (const t of registry) put(t, true);
  for (const t of code) put(t, false);
  return s;
}
// What a raw colour is against the scale → { token } (the NEAREST token of the same colour — of equals, the first: an exact
// token listed after an HSL one wins) · { near: {token, delta} } · {}
function judgeColor(v, scale) {
  const p = parseColor(v);
  if (!p) { const t = scale.text.get(colorKey(v)); return t ? { token: t } : {}; }
  let token = null, same = Infinity, near = null, best = Infinity;
  for (const c of scale.colors) {
    if (Math.abs(c.p.alpha - p.alpha) > DS_ALPHA) continue;
    const d = deltaE(p, c.p);
    if (d < same && sameAt(p, c.p, d)) { same = d; token = c.name; }
    if (d <= DS_JND && d < best) { best = d; near = c.name; }
  }
  return token ? { token } : near ? { near: { token: near, delta: Math.round(best * 10000) / 10000 } } : {};
}
// A raw value (or a group: {kind, value}) against the scale → the fields it carries: colours `token` / `near`; a font stack
// `token` (its primary family a font token's); a motion value `token` when EVERY literal time and easing it holds is a
// token's (the first time's, else the first easing's — a keyword easing is not asked); a size nothing (1.38: no size scale).
function judgeRaw(e, scale) {
  if (e.kind === "color") return judgeColor(e.value, scale);
  if (e.kind === "font") { const f = fontStackOf(valueOf(e.value)), t = f && scale.fonts.get(f.primary); return t ? { token: t } : {}; }
  if (e.kind !== "motion") return {};
  const inner = valueOf(e.value), names = [];
  for (const ms of timesOf(inner)) names.push(scale.durations.get(ms));
  for (const k of easingsOf(inner)) names.push(scale.easings.get(k));
  return names.every(Boolean) ? { token: names[0] } : {}; // (a motion value holds a literal: that is why it was read)
}
// A raw value's group: the same value written alike — a colour by what it IS (notation-free, alpha included: #1E40AF =
// rgb(30 64 175)), a font stack by its families, a Tailwind utility without its variants, the rest as written (lower-cased,
// blanks folded). (The kinds' keys never meet: a parsed colour's is its numbers, a stack's holds its generic family.)
function groupKey(e) {
  const v = String(e.value);
  if (e.kind === "color") { const p = parseColor(v), q = (x) => Math.round(x * 1e6); return p ? q(p.ok[0]) + " " + q(p.ok[1]) + " " + q(p.ok[2]) + " " + q(p.alpha) : colorKey(v); }
  const f = e.kind === "font" ? fontStackOf(valueOf(v)) : null;
  return f ? f.key : bareUtility(v).toLowerCase().replace(/\s+/g, " ");
}
// A registry token's value against the code's → "color" | "quantity" (they differ) | null (the same, or not compared): one
// parsed colour each IN ONE NOTATION (sameColor: exact there — #3b82f6 and hsl(217 91% 60%) are not compared), or one
// quantity each with one unit (s → ms; 16px and 1rem are not compared). A reference, several parts, a font stack: not compared.
function tokenDrift(reg0, code0) {
  const a = String(reg0 == null ? "" : reg0).trim(), b = String(code0 == null ? "" : code0).trim();
  const p = parseColor(a), q = parseColor(b);
  if (p || q) return p && q && p.n === q.n && !sameColor(p, q) ? "color" : null;
  const x = quantity(a), y = quantity(b);
  return x && y && x.unit === y.unit && x.n !== y.n ? "quantity" : null;
}

// --- the units table -------------------------------------------------------------------------------------------------------------
// A value's FIRST top-level literal with a unit the row does not allow → that unit, lower-cased | null. Top-level: outside
// parentheses (`calc()`, `clamp()`, `var()` are a doubt — an unclosed one holds the rest); never 0, a unitless number, a hex
// colour's digits, a word's, a negative length's (a digit after `-`: `margin: 0 -8px` — said, 1.38.0 review 1's T2).
const RE_UNIT_LITERAL = /(?<![\w.#-])(\d+(?:\.\d+)?|\.\d+)([a-z]+|%)(?![\w-])/gi;
function offUnit(v0, allowed) {
  const v = String(v0);
  let top = v;
  if (v.includes("(")) {
    // (a parenthesis's content left out, the text outside kept: one pass, its pieces joined once)
    const parts = [];
    let depth = 0, from = 0;
    for (let i = 0; i < v.length; i++) {
      if (v[i] === "(") { if (depth++ === 0) parts.push(v.slice(from, i)); }
      else if (v[i] === ")" && depth > 0 && --depth === 0) from = i + 1;
    }
    if (depth === 0) parts.push(v.slice(from));
    top = parts.join(" ");
  }
  RE_UNIT_LITERAL.lastIndex = 0;
  for (let m = RE_UNIT_LITERAL.exec(top); m; m = RE_UNIT_LITERAL.exec(top)) {
    const unit = m[2].toLowerCase();
    if (Number(m[1]) !== 0 && !allowed.includes(unit)) return unit;
  }
  return null;
}
// The property a Tailwind size utility sets (RE_TW_SIZE's: p* / m* / gap / space-* / text / rounded* / leading / tracking)
const TW_SIDES = { t: "top", r: "right", b: "bottom", l: "left", x: "inline", y: "block", s: "inline-start", e: "inline-end" };
function twProperty(u) {
  if (/^[pm][trblxyse]?$/.test(u)) return (u[0] === "p" ? "padding" : "margin") + (u[1] ? "-" + TW_SIDES[u[1]] : "");
  if (u === "gap") return "gap";
  if (u === "gap-x") return "column-gap";
  if (u === "gap-y") return "row-gap";
  if (u === "space-x") return "margin-inline-start";
  if (u === "space-y") return "margin-block-start";
  if (u === "text") return "font-size";
  if (u === "leading") return "line-height";
  if (u === "tracking") return "letter-spacing";
  return u.startsWith("rounded") ? "border-radius" : null;
}
// The units table's row of a property → a lookup (memoized): the row naming it exactly, else the one with the LONGEST
// `prefix-*` it falls under (`margin-*` covers `margin` and `margin-top`; `border-radius` exact wins over `border-*`).
function unitRows(table) {
  const memo = new Map();
  return (prop) => {
    if (memo.has(prop)) return memo.get(prop);
    let hit = null, best = -1;
    for (const r of table.rows) {
      for (const p of r.props) {
        if (p === prop) { hit = r; best = Infinity; break; }
        const pre = p.endsWith("-*") ? p.slice(0, -2) : null;
        if (pre != null && (prop === pre || prop.startsWith(pre + "-")) && pre.length > best) { hit = r; best = pre.length; }
      }
      if (best === Infinity) break;
    }
    memo.set(prop, hit);
    return hit;
  };
}

module.exports = { parseColor, fontStackOf, timesOf, easingsOf, easingOf, tokenScale, judgeRaw, groupKey, tokenDrift, offUnit, twProperty, unitRows,
  RE_MOTION_PROP };
