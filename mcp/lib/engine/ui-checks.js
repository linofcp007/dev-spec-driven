"use strict";

/**
 * dev-spec-driven engine — the UI checks (1.37): anti-patterns in a +ui feature's view / style files that are wrong whatever
 * the taste. Six rules, ids English-stable, each with a level:
 *   warn   — the feature report AND one finish warning (never a blocker): `zoom-disabled` (WCAG 1.4.4), `img-no-alt` (1.1.1),
 *            `outline-removed` (2.4.7), `click-no-keyboard` (2.1.1), `paste-blocked` (3.3.8);
 *   report — the feature report only: `transition-all` (certain as syntax, a guideline as a finding — shadcn's own Button,
 *            Switch and Sidebar ship it, so `shadcn add` would earn a finish warning on kit code).
 * Static, bounded, linear in what it reads, read-only. A file is read through viewLines (design-system.js: the ONE line walk —
 * its lines cut at DS_LINE_MAX, comments out) and a stylesheet's structure through styleTokens' walker (the ONE CSS block
 * walker, its events), never a second walker. Every doubt reads as "not judged": a wrong finding sends a team to fix code that
 * is right. A team silences ONE occurrence with a comment `ui-check-off: <rule-id>[, <rule-id>]` on its line or the line
 * above (any comment syntax of the file); a silenced finding is counted, never listed.
 *
 * Part of the engine behind mcp/lib/spec.js (the facade); the module rule is in engine/index.js. LAZY (the tier): what reads
 * the code loads on first use.
 */
// Owned by other engine modules — used at call time only; engine/index.js links them once the tier has loaded.
let opensString, quoteEnd, readFileHeads, styleTokens, RE_STYLE_EXT;
function __link(E) { ({ opensString, quoteEnd, readFileHeads, styleTokens, RE_STYLE_EXT } = E); }

// The rules: id → level (the report sorts warn first; finish counts warn alone).
const UI_RULES = { "zoom-disabled": "warn", "img-no-alt": "warn", "outline-removed": "warn", "click-no-keyboard": "warn", "paste-blocked": "warn",
  "transition-all": "report" };
const DS_TAG_LINES = 30; // one opening tag read over lines…
const DS_TAG_CHARS = 4000; // …and characters: past either it is not judged, nor is a tag that starts inside it
const DS_TAG_ATTRS = 100; // a tag's attributes read: one that holds more is not judged
const DS_CHECK_PER_FILE = 200; // findings kept per file (silenced ones too) — past it a file's further findings are not kept
const DS_VALUE = 80; // a finding's value, cut
const DS_BLOCK_DEPTH = 64; // a sheet's blocks judged nested that deep — a deeper one is not, nor what it holds
const DS_FOCUS_SHEETS = 1000; // the project's stylesheets read for a focus style…
const DS_FOCUS_CHARS = 4 * 1024 * 1024; // …and their characters: past either, `limits` says so and outline-removed is not judged
const DS_FOCUS_FILE_CHARS = 256 * 1024; // one stylesheet's characters read
const DS_MARK_IDS = 200; // characters after a `ui-check-off:` read for its ids
const BS = String.fromCharCode(92);

// What a file is: a stylesheet (RE_STYLE_EXT, design-system.js: its lines are all css — no tag), a script that holds JSX (tags in
// script mode throughout: a .tsx / .jsx file, a PascalCase .js component, an Angular *.component.ts), or markup (an SFC, HTML and
// its template engines).
const RE_SCRIPT_FILE = /\.[cm]?[jt]sx?$/i;

// --- the tag reader ------------------------------------------------------------------------------------------------------------
// An opening tag: `<` and a name — a letter, then letters, digits, `.`, `:`, `-` — followed by a blank, `/`, `>` or the line's
// end (`<img,` names no img). In SCRIPT mode never right after an identifier, `)`, `]` or a quote (`useState<div>`, `a<b`,
// `"<img>"`: a generic, a comparison, a string's) nor inside a string that closes on its line (blankStrings) — a JSX file
// throughout. A markup file's `<script>` block is not read for tags (its code's strings would read as markup).
const RE_TAG_START = /<([A-Za-z][\w.:-]*)/g;
const RE_TAG_NEXT = /[\s/>]/;
const RE_TAG_AFTER = /[\w$.)\]"'`]/;
// a script line with what its strings hold blanked — the same length, the quotes kept: a `<` there starts no tag
function blankStrings(l) {
  if (!(l.includes("\"") || l.includes("'") || l.includes("`"))) return l;
  const none = {};
  let out = "", from = 0;
  for (let k = 0; k < l.length; k++) {
    const c = l[k];
    if (!(c === "\"" || c === "'" || c === "`") || !opensString(l, k)) continue;
    const e = quoteEnd(l, k, none);
    if (e === -1) continue;
    out += l.slice(from, k + 1) + " ".repeat(e - k - 1);
    from = e;
    k = e;
  }
  return out + l.slice(from);
}
// The tag being read goes on to its `>` — the first one outside quotes and outside `{…}` (JSX's, Svelte's, Astro's
// expressions: `src={a > b ? x : y}`, `onLoad={() => go()}`), over lines; a quote carries over a line's end (an HTML value may
// hold one), a `\` escapes inside braces (a JS string's). → the `>`'s index on this line, or -1 (the tag goes on).
function readOn(cur, l, from) {
  for (let i = from; i < l.length; i++) {
    const c = l[i];
    if (cur.quote) { if (c === BS && cur.braces > 0) i++; else if (c === cur.quote) cur.quote = ""; continue; }
    if (c === "\"" || c === "'" || c === "`") cur.quote = c;
    else if (c === "{") cur.braces++;
    else if (c === "}") { if (cur.braces > 0) cur.braces--; } else if (c === ">" && cur.braces === 0) { cur.text += l.slice(from, i + 1); return i; }
  }
  cur.text += l.slice(from) + "\n";
  return -1;
}
// → { line(n, l), }: each line of a file that holds tags, in order; judge(tag, rest) for each tag read whole — tag: { name,
// line (its first), text (from `<` to `>`) }, rest: what follows it on its last line. The next tag is looked for PAST the
// previous one's end (a tag nested in an attribute — `icon={<img />}` — is not judged) and past a read that failed (no `>`
// within DS_TAG_LINES lines / DS_TAG_CHARS characters: neither it nor a tag starting in the lines it read is judged) — each
// character read once: linear (CRIT_1: a reader that looked again from the next `<` was 1,230× plain JSX on unclosed tags).
function tagReader(script, judge) {
  let cur = null, inScript = false; // the tag being read · inside a markup file's <script> block
  const line = (n, l) => {
    let from = 0, masked = null;
    for (;;) {
      if (cur) {
        const end = readOn(cur, l, from);
        if (end === -1) {
          if (++cur.lines > DS_TAG_LINES || cur.text.length > DS_TAG_CHARS) cur = null; // not judged — the reader goes on below
          return;
        }
        const tag = cur;
        cur = null;
        from = end + 1;
        if (tag.text.length > DS_TAG_CHARS) continue;
        judge(tag, l.slice(from));
        if (!script && tag.name === "script" && !tag.text.endsWith("/>")) inScript = true;
        continue;
      }
      if (inScript) { const e = l.indexOf("</script", from); if (e === -1) return; inScript = false; from = e + 8; continue; }
      if (l.indexOf("<", from) === -1) return;
      if (masked === null) masked = script ? blankStrings(l) : l;
      RE_TAG_START.lastIndex = from;
      let m;
      for (m = RE_TAG_START.exec(masked); m; m = RE_TAG_START.exec(masked)) {
        const next = masked[m.index + m[0].length];
        if (next !== undefined && !RE_TAG_NEXT.test(next)) continue;
        if (script && m.index > 0 && RE_TAG_AFTER.test(masked[m.index - 1])) continue;
        break;
      }
      if (!m) return;
      cur = { name: m[1], line: n, text: "<" + m[1], quote: "", braces: 0, lines: 1 };
      from = m.index + m[0].length;
    }
  };
  return { line };
}

// --- a tag's attributes ----------------------------------------------------------------------------------------------------------
// → [{ name, value (as written, quotes / braces kept; null: none) } | { spread: true }] — null past DS_TAG_ATTRS of them (a tag
// is not judged on what it was not read for). A `{…}` where a NAME stands is a spread
// (`{...props}`, `{...getRootProps()}`, a template engine's `{{attrs}}`: it may hold any attribute) — unless it holds one
// identifier, Svelte's shorthand `{alt}`, which names that attribute.
const RE_NAME_STOP = /[\s=>/"'`{]/;
const RE_IDENT = /^[A-Za-z_$][\w$]*$/;
function closing(s, i) { // s[i] is `{` → the index of the `}` that closes it (quotes and nested braces in between), or -1
  let depth = 0, quote = "";
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (quote) { if (c === BS) k++; else if (c === quote) quote = ""; continue; }
    if (c === "\"" || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return k;
  }
  return -1;
}
function attributesOf(text, from) {
  const out = [];
  let i = from;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === ">") break;
    if (c === "{") {
      const e = closing(text, i);
      const inner = text.slice(i + 1, e === -1 ? n : e).trim();
      if (out.push(RE_IDENT.test(inner) ? { name: inner, value: null } : { spread: true }) > DS_TAG_ATTRS) return null;
      if (e === -1) break;
      i = e + 1;
      continue;
    }
    if (!RE_NAME_STOP.test(c)) {
      let j = i;
      while (j < n && !RE_NAME_STOP.test(text[j])) j++;
      const name = text.slice(i, j);
      let k = j;
      while (k < n && /\s/.test(text[k])) k++;
      if (text[k] !== "=") { if (out.push({ name, value: null }) > DS_TAG_ATTRS) return null; i = j; continue; }
      k++;
      while (k < n && /\s/.test(text[k])) k++;
      let e;
      if (text[k] === "\"" || text[k] === "'" || text[k] === "`") { e = text.indexOf(text[k], k + 1); e = e === -1 ? n : e + 1; } else if (text[k] === "{") { e = closing(text, k); e = e === -1 ? n : e + 1; } else { e = k; while (e < n && !/[\s>]/.test(text[e])) e++; }
      if (out.push({ name, value: text.slice(k, e) }) > DS_TAG_ATTRS) return null;
      i = e;
      continue;
    }
    i++;
  }
  return out;
}
// An event attribute → { event (lower case), mods } | null: Angular `(click)` / `(keyup.enter)`, Vue `@click.stop` /
// `v-on:click`, Alpine `x-on:click`, Svelte 4 `on:click|self`, JSX `onClick`, HTML and Svelte 5 `onclick`.
const RE_EV_ANGULAR = /^\(([\w-]+)((?:\.[\w-]+)*)\)$/;
const RE_EV_VUE = /^(?:@|v-on:|x-on:)([\w-]+)((?:\.[\w-]+)*)$/;
const RE_EV_SVELTE = /^on:([\w-]+)((?:\|[\w-]+)*)$/;
const RE_EV_ON = /^on([A-Za-z][\w-]*)$/;
function eventOf(name) {
  let m = RE_EV_ANGULAR.exec(name) || RE_EV_VUE.exec(name);
  if (m) return { event: m[1].toLowerCase(), mods: m[2] ? m[2].slice(1).split(".") : [] };
  m = RE_EV_SVELTE.exec(name);
  if (m) return { event: m[1].toLowerCase(), mods: m[2] ? m[2].slice(1).split("|") : [] };
  m = RE_EV_ON.exec(name);
  return m ? { event: m[1].toLowerCase(), mods: [] } : null;
}
// An attribute's name as bound — `:alt`, `v-bind:alt`, `x-bind:alt`, `bind:alt`, `[alt]`, `[attr.alt]` → alt — lower-cased
// (HTML's are case-insensitive; JSX's `tabIndex`)
const RE_BOUND = /^(?::|v-bind:|x-bind:|bind:)([\w-]+)(?:\.[\w-]+)*$|^\[(?:attr\.)?([\w-]+)\]$/;
const boundName = (name) => { const m = RE_BOUND.exec(name); return (m ? m[1] || m[2] : name).toLowerCase(); };
// a value as written → its literal (`"none"`, `{"none"}`, `{false}` → none, false), lower-cased
const literal = (v) => (v == null ? "" : v.replace(/^[{\s"'`]+|[}\s"'`]+$/g, "").toLowerCase());

// --- the tag rules ---------------------------------------------------------------------------------------------------------------
// Focusable by default (HTML's interactive content, `summary`, `option`): a click there reaches the keyboard. `a` / `area`
// only with an `href` (Angular's `routerLink` renders one).
const FOCUSABLE = new Set(["a", "area", "audio", "button", "details", "embed", "iframe", "input", "label", "object", "option", "select", "summary", "textarea",
  "video"]);
const RE_ELEMENT = /^[a-z][a-z0-9]*$/; // an element — never a component (`Card`), a custom element (`my-el`), a member (`motion.div`), `svelte:window`
const RE_KEY_EVENT = /^key(?:down|up|press)$/;
const RE_DISPLAY_NONE = /display\s*:\s*["'`]?none(?![\w-])/i;
const RE_DELEGATES = /\.focus\(|stopPropagation|target/i; // an inline click handler that forwards focus or reads the event's target
const RE_CANCELS = /preventDefault|return\s+false/;
const RE_READS_CLIPBOARD = /clipboardData|getData/;
function judgeTag(tag, rest, add) {
  const attrs = attributesOf(tag.text, tag.name.length + 1);
  if (!attrs) return;
  const spread = attrs.some((a) => a.spread);
  const named = new Map(), events = [];
  for (const a of attrs) {
    if (a.spread) continue;
    const ev = eventOf(a.name);
    if (ev) { ev.attr = a.name; ev.value = a.value; events.push(ev); continue; }
    const b = boundName(a.name);
    if (!named.has(b)) named.set(b, a.value);
  }
  const shown = (b) => named.has(b) && literal(named.get(b)) !== "false"; // present and not literally false
  // paste-blocked: any tag (a component passes it down) — an inline handler that cancels the paste and reads no clipboard,
  // or a bare `.prevent` / `|preventDefault`; a named handler is not followed
  for (const e of events) {
    if (e.event !== "paste") continue;
    const v = e.value == null ? "" : e.value;
    const blocks = e.value == null ? e.mods.includes("prevent") || e.mods.includes("preventDefault") : RE_CANCELS.test(v);
    if (blocks && !RE_READS_CLIPBOARD.test(v)) { add("paste-blocked", tag.line, "<" + tag.name + " " + e.attr + ">"); break; }
  }
  if (spread) return; // (a spread may hold any attribute)
  // img-no-alt: `<img` (as written) with no alt in any binding, no accessible name, not decorative, rendered
  if (tag.name === "img" && !named.has("alt") && !named.has("aria-label") && !named.has("aria-labelledby") &&
    !["presentation", "none"].includes(literal(named.get("role"))) && !shown("aria-hidden") && !shown("hidden") &&
    !(named.has("style") && RE_DISPLAY_NONE.test(named.get("style") || ""))) add("img-no-alt", tag.line, "<img>");
  // click-no-keyboard: a click handler on an element the keyboard cannot reach
  const click = events.find((e) => e.event === "click");
  if (!click || !RE_ELEMENT.test(tag.name)) return;
  const focusable = tag.name === "a" || tag.name === "area" ? named.has("href") || named.has("routerlink") : FOCUSABLE.has(tag.name);
  if (focusable || named.has("role") || named.has("tabindex") || named.has("inert") || shown("aria-hidden") || events.some((e) => RE_KEY_EVENT.test(e.event))) return;
  // …an empty or self-closing element (a modal's backdrop), a handler for the element itself or a delegating one
  const r = rest.trimStart();
  if (tag.text.endsWith("/>") || (r.startsWith("</" + tag.name) && /^\s*>/.test(r.slice(2 + tag.name.length)))) return;
  if (click.mods.includes("self") || (click.value == null && click.mods.includes("stop")) || RE_DELEGATES.test(click.value || "")) return;
  add("click-no-keyboard", tag.line, "<" + tag.name + " " + click.attr + ">");
}

// --- values ----------------------------------------------------------------------------------------------------------------------
// s cut at `sep` (a character test) outside parentheses → its pieces
function splitTop(s, isSep) {
  const out = [];
  let depth = 0, from = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(" || c === "[") depth++;
    else if ((c === ")" || c === "]") && depth > 0) depth--;
    else if (depth === 0 && isSep(c)) { out.push(s.slice(from, i)); from = i + 1; }
  }
  out.push(s.slice(from));
  return out;
}
const isComma = (c) => c === ",";
const isBlank = (c) => c === " " || c === "\t" || c === "\n";
// transition-all: a `transition` item that animates every property — `all`, or no property (the default) — for a LITERAL time
// that is not 0; `transition-property: all`. Never `none`, an item with no time (it animates nothing: a duration of 0), the
// longhand `transition-duration` (the reduced-motion reset) — nor a value built from a variable or a global keyword: its word
// is the item's property (no `all`) or no time (`all var(--d)`, `$btn-transition`, `inherit`).
const RE_TIME = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)m?s$/i;
const RE_EASING = /^(?:ease(?:-in|-out|-in-out)?|linear|step-start|step-end|(?:cubic-bezier|steps|linear)\(.*\)|allow-discrete|normal)$/i;
function transitionAll(prop, value) {
  const v = value.replace(/\s*!\s*important\s*$/i, "").trim();
  for (const item of splitTop(v, isComma)) {
    const words = splitTop(item.trim(), isBlank).filter(Boolean);
    if (prop === "transition-property") { if (words.length === 1 && words[0].toLowerCase() === "all") return true; continue; }
    let property = null, duration = null;
    for (const w of words) {
      if (RE_TIME.test(w)) { if (duration === null) duration = parseFloat(w); continue; }
      if (!RE_EASING.test(w) && property === null) property = w.toLowerCase();
    }
    if ((property === null || property === "all") && duration > 0) return true;
  }
  return false;
}

// --- Tailwind's utilities --------------------------------------------------------------------------------------------------------
// A line's class-like tokens (cut at blanks, quotes and the punctuation code puts around a string) — variants, then the
// utility: `transition-all` (any variants, `!`); an outline removal (`outline-none`, `outline-hidden`, `outline-0`) under
// `focus:` / `focus-visible:` — a bare one is not judged (shadcn puts it on focus-managed containers and activedescendant
// options); and a FOCUS STYLE: any other utility under a focus variant (`focus-visible:ring-2`, `group-focus:…`).
// → whether the text holds a focus style.
const RE_TW_PICK = /transition-all|outline-|focus/;
const RE_TW_SPLIT = /[\s"'`{}(),;=<>]+/;
const RE_TW_FOCUS = /^(?:(?:group|peer)-)?focus(?:-visible|-within)?(?:\/[\w-]+)?$/;
const RE_TW_REMOVAL = /^outline-(?:none|hidden|0)$/;
function utilities(s, line, add) {
  if (!RE_TW_PICK.test(s)) return false;
  let focus = false;
  for (const tok of s.split(RE_TW_SPLIT)) {
    if (!tok) continue;
    const parts = tok.split(":");
    const util = parts.pop().replace(/^!|!$/g, "");
    if (util === "transition-all") { add("transition-all", line, tok); continue; }
    if (!util) continue;
    if (RE_TW_REMOVAL.test(util)) { if (parts.some((v) => v === "focus" || v === "focus-visible")) add("outline-removed", line, tok); } else if (parts.some((v) => RE_TW_FOCUS.test(v))) focus = true;
  }
  return focus;
}

// --- a stylesheet's structure (the walker's events) ------------------------------------------------------------------------------
// outline-removed: an outline removal — `outline: none | 0`, `outline-style: none`, `outline-width: 0` (`!important` too; never
// `outline: 2px solid transparent`, which forced colours show) — in a rule whose selector list holds
//   - "element": a selector whose last compound is `*` or an element focusable by default, with no pseudo-class / -element
//     (`button { outline: none }`, `* { outline: 0 }`) — a class alone is never judged (`.modal { outline: 0 }`), or
//   - "focus": a selector whose last compound holds `:focus` itself (never -visible / -within / -moz-focusring) — and the
//     rule, its nested blocks included, declares nothing but removals (Bootstrap's `outline: 0; box-shadow: …` replaces it);
// never a selector that names focus-visible (`:focus:not(:focus-visible)`), inside `@media print`, nor a rule that never
// closes. A CANDIDATE: any focus style of the file, the feature's files or the project's stylesheets excuses it (uiChecksReport).
// A FOCUS STYLE: a rule naming a focus pseudo-class (or inside one) that declares anything but a removal; a Tailwind focus
// utility in an `@apply`.
// transition-all: a `transition` / `transition-property` declaration (transitionAll), a Tailwind `transition-all` in an
// `@apply` — never inside `@media (prefers-reduced-motion: reduce)`.
const RE_REMOVAL = /^(?:outline\s*:\s*(?:none|0(?:px)?)|outline-style\s*:\s*none|outline-width\s*:\s*0(?:px)?)(?:\s*!\s*important)?$/i;
const RE_FOCUS_PSEUDO = /:focus(?:-visible|-within)?(?![\w-])/i;
const RE_FOCUS_ITSELF = /:focus(?![\w-])/i;
const RE_PRINT = /^@media\b.*\bprint\b/i;
const RE_REDUCED = /prefers-reduced-motion\s*(?:\)|:\s*reduce)/i;
const RE_DECLARATION = /^([A-Za-z-]+)\s*:\s*([\s\S]*)$/;
const RE_COMPOUND_TYPE = /^(\*|[A-Za-z][A-Za-z0-9]*)/;
// a selector's last compound: what follows its last combinator (a blank, `>`, `+`, `~`) outside parentheses and brackets
function lastCompound(sel) {
  let depth = 0, from = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === "(" || c === "[") depth++;
    else if ((c === ")" || c === "]") && depth > 0) depth--;
    else if (depth === 0 && (isBlank(c) || c === ">" || c === "+" || c === "~")) from = i + 1;
  }
  return sel.slice(from);
}
function outlineShape(prelude) {
  let shape = null;
  for (const raw of splitTop(prelude, isComma)) {
    const sel = raw.trim();
    if (!sel || /focus-visible/i.test(sel)) continue;
    const last = lastCompound(sel);
    if (!last.includes(":")) {
      const t = RE_COMPOUND_TYPE.exec(last);
      if (t && (t[1] === "*" || FOCUSABLE.has(t[1].toLowerCase()))) return "element";
    } else if (RE_FOCUS_ITSELF.test(last)) shape = "focus";
  }
  return shape;
}
// → whether the sheet holds a focus style; add (null: the focus fact alone — the project's sheets) takes the findings
function sheetChecks(text, rel, add) {
  let focus = false;
  const open = []; // the open blocks, innermost last: { selector, shape, print, reduced, focus, removals, other }
  let deep = 0; // the blocks open past DS_BLOCK_DEPTH (their rule's extent is then unknown: never a "focus" candidate)
  styleTokens(text, rel, {
    block: (e) => {
      if (deep || open.length >= DS_BLOCK_DEPTH) { if (deep++ === 0) open[open.length - 1].other = true; return; }
      const p = open.length ? open[open.length - 1] : null, at = e.prelude[0] === "@";
      open.push({ selector: e.prelude, shape: at ? null : outlineShape(e.prelude), print: (p != null && p.print) || (at && RE_PRINT.test(e.prelude)),
        reduced: (p != null && p.reduced) || (at && RE_REDUCED.test(e.prelude)), focus: (p != null && p.focus) || (!at && RE_FOCUS_PSEUDO.test(e.prelude)),
        removals: [], other: false });
    },
    statement: (e) => {
      if (deep) return;
      const b = open.length ? open[open.length - 1] : null, reduced = b != null && b.reduced;
      const removal = RE_REMOVAL.test(e.text);
      if (b != null && b.focus && !removal) focus = true;
      // (a Tailwind `@apply`: its utilities, as a class list's — no motion rule inside a reduced-motion block)
      const apply = /^@apply\s/i.test(e.text);
      if (apply && utilities(e.text, e.from, (rule, line, value) => { if (add && !(reduced && rule === "transition-all")) add(rule, line, value); })) focus = true;
      if (!add) return;
      if (b != null) { if (!removal) b.other = true; else if (!b.print) b.removals.push({ line: e.from, text: e.text }); }
      const d = apply || reduced ? null : RE_DECLARATION.exec(e.text);
      const prop = d ? d[1].toLowerCase() : "";
      if ((prop === "transition" || prop === "transition-property") && transitionAll(prop, d[2])) add("transition-all", e.from, e.text);
    },
    close: () => {
      if (deep) { deep--; return; }
      const b = open.pop();
      if (!b) return;
      if (b.other && open.length) open[open.length - 1].other = true; // (a rule's extent holds its nested blocks)
      if (add && b.removals.length && (b.shape === "element" || (b.shape === "focus" && !b.other))) for (const r of b.removals) add("outline-removed", r.line, b.selector + " { " + r.text + " }");
    },
  });
  return focus;
}

// --- one file ----------------------------------------------------------------------------------------------------------------------
// zoom-disabled: the viewport stops pinch-zoom — `user-scalable=no | 0`, `maximum-scale` under 2 (a <meta>'s content, any
// view file), Next's `userScalable: false`, `maximumScale: <2` (the viewport export)
const RE_ZOOM_OFF = /user-scalable\s*=\s*(?:no|0)(?![\w.])|userScalable\s*:\s*false(?![\w$])/i;
const RE_MAX_SCALE = /(?:maximum-scale\s*=|maximumScale\s*:)\s*(\d+(?:\.\d+)?|\.\d+)/gi;
// a `transition:` outside a stylesheet's lines — a style object (`transition: "all .3s"`), an inline style attribute, a
// CSS-in-JS template's declaration line: its value to its quote's end, else to `;` / a quote / `}` / the line's end
const RE_TRANSITION_PROP = /(?<![\w-])(transition(?:-property)?)\s*:\s*/gi;
function scriptTransitions(l, line, add) {
  RE_TRANSITION_PROP.lastIndex = 0;
  for (let m = RE_TRANSITION_PROP.exec(l); m; m = RE_TRANSITION_PROP.exec(l)) {
    const at = m.index + m[0].length, q = l[at];
    let end;
    if (q === "\"" || q === "'" || q === "`") { end = l.indexOf(q, at + 1); if (end === -1) end = l.length; } else { end = at; while (end < l.length && !/[;"'`}]/.test(l[end])) end++; }
    const value = q === "\"" || q === "'" || q === "`" ? l.slice(at + 1, end) : l.slice(at, end);
    if (transitionAll(m[1].toLowerCase(), value)) add("transition-all", line, m[1] + ": " + value);
    RE_TRANSITION_PROP.lastIndex = Math.max(end, RE_TRANSITION_PROP.lastIndex); // (past the value: each character read once)
  }
}
// the rule ids a `ui-check-off:` comment names: ids (letters and `-`) separated by `,` / blanks, read up to the next marker
const RE_MARK_IDS = /^\s*([a-z]+(?:-[a-z]+)*(?:\s*,\s*[a-z]+(?:-[a-z]+)*)*)/;
function markIds(src) {
  const ids = new Set();
  for (let k = src.indexOf("ui-check-off:"); k !== -1;) {
    const next = src.indexOf("ui-check-off:", k + 13);
    const m = RE_MARK_IDS.exec(src.slice(k + 13, Math.min(next === -1 ? src.length : next, k + 13 + DS_MARK_IDS)));
    if (m) for (const id of m[1].split(",")) ids.add(id.trim());
    k = next;
  }
  return ids;
}
// One view / style file → { findings: [{ rule, line, value, silenced }], focus }. lines: viewLines(text, rel)'s (n 1-based, src,
// l without its comments, css). A finding is at its tag's or declaration's FIRST line, one per rule and line, DS_CHECK_PER_FILE
// at most; `silenced` when a `ui-check-off:` comment (in `src`, absent from `l`) on that line or the one above names its rule.
// outline-removed findings are CANDIDATES (focus: does the file hold a focus style — uiChecksReport decides).
function uiChecksOf(lines, rel) {
  const sheet = RE_STYLE_EXT.test(rel);
  const findings = [], seen = new Set(), marks = new Map(), css = [];
  let focus = false, anyCss = false;
  const add = (rule, line, value) => {
    const k = rule + ":" + line;
    if (seen.has(k) || findings.length >= DS_CHECK_PER_FILE) return;
    seen.add(k);
    findings.push({ rule, line, value: String(value).replace(/\s+/g, " ").trim().slice(0, DS_VALUE), silenced: false });
  };
  const tags = sheet ? null : tagReader(RE_SCRIPT_FILE.test(rel), (tag, rest) => judgeTag(tag, rest, add));
  for (const { n, src, l, css: isCss } of lines) {
    if (src.includes("ui-check-off:") && !l.includes("ui-check-off:")) marks.set(n, markIds(src));
    css.push(isCss ? l : "");
    if (isCss) { anyCss = true; continue; }
    tags.line(n, l);
    if (/scal/i.test(l)) {
      const off = RE_ZOOM_OFF.exec(l);
      if (off) add("zoom-disabled", n, off[0]);
      RE_MAX_SCALE.lastIndex = 0;
      for (let m = RE_MAX_SCALE.exec(l); m; m = RE_MAX_SCALE.exec(l)) if (parseFloat(m[1]) < 2) add("zoom-disabled", n, m[0]);
    }
    if (utilities(l, n, add)) focus = true;
    if (l.includes("transition")) scriptTransitions(l, n, add);
  }
  if (anyCss && sheetChecks(css.join("\n"), rel, add)) focus = true;
  for (const f of findings) {
    const here = marks.get(f.line), above = marks.get(f.line - 1);
    f.silenced = (here != null && here.has(f.rule)) || (above != null && above.has(f.rule));
  }
  return { findings, focus };
}

// --- the feature's files ---------------------------------------------------------------------------------------------------------
// Does any of the project's stylesheets hold a focus style (sheetChecks over the WHOLE file — never the name-ranked token
// candidates: `focus.css`, `_a11y.scss`, a .less file count)? sheets: [{rel, full}], read the shorter path first, each up
// to DS_FOCUS_FILE_CHARS, DS_FOCUS_SHEETS files / DS_FOCUS_CHARS characters at most; it stops at the first that holds one.
// → { focus, limits: [{code: focus-sheets | focus-chars, read}] — a bound that cut the search }
function uiFocusPass(sheets) {
  const list = sheets.slice().sort((a, b) => a.rel.length - b.rel.length || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const heads = readFileHeads(list.slice(0, DS_FOCUS_SHEETS).map((s) => s.full), DS_FOCUS_FILE_CHARS);
  let read = 0, chars = 0;
  try {
    for (const s of list) {
      if (read >= DS_FOCUS_SHEETS) return { focus: false, limits: [{ code: "focus-sheets", read }] };
      if (chars >= DS_FOCUS_CHARS) return { focus: false, limits: [{ code: "focus-chars", read }] };
      const text = heads.next();
      read++;
      if (text == null) continue;
      chars += text.length;
      if (sheetChecks(text, s.rel, null)) return { focus: true, limits: [] };
    }
  } finally {
    heads.stop();
  }
  return { focus: false, limits: [] };
}
// The feature report's `uiChecks` → { findings (the first `cap`: rule, level, file, line, value — warn first, then by file
// and line), total, byRule, silenced, limits }. files: [{ rel, findings, focus }] (uiChecksOf of each file read). The
// outline-removed candidates stand only while NO focus style exists — in the feature's files, else in the project's
// stylesheets (projectFocus(): uiFocusPass, called only then — no candidate, no read); a search a bound cut judges none.
function uiChecksReport(files, projectFocus, cap) {
  let focus = files.some((f) => f.focus), limits = [];
  if (!focus && files.some((f) => f.findings.some((x) => x.rule === "outline-removed"))) ({ focus, limits } = projectFocus());
  const list = [];
  let silenced = 0;
  for (const f of files) {
    for (const x of f.findings) {
      if (x.rule === "outline-removed" && (focus || limits.length)) continue;
      if (x.silenced) { silenced++; continue; }
      list.push({ rule: x.rule, level: UI_RULES[x.rule], file: f.rel, line: x.line, value: x.value });
    }
  }
  const rank = (x) => (x.level === "warn" ? 0 : 1);
  list.sort((a, b) => rank(a) - rank(b) || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line);
  const byRule = {};
  for (const x of list) byRule[x.rule] = (byRule[x.rule] || 0) + 1;
  return { findings: list.slice(0, cap), total: list.length, byRule, silenced, limits };
}

// spec_finish's part of a feature report's uiChecks → { total, byRule, top (the first 3: rule, file, line, value) } — the warn-level
// findings alone (the report sorts them first; a report-level rule is never a finish warning)
function uiFinishChecks(report) {
  const byRule = {};
  let total = 0;
  for (const [rule, n] of Object.entries(report.byRule)) if (UI_RULES[rule] === "warn") { byRule[rule] = n; total += n; }
  const top = report.findings.filter((x) => x.level === "warn").slice(0, 3).map((x) => ({ rule: x.rule, file: x.file, line: x.line, value: x.value }));
  return { total, byRule, top };
}

module.exports = { uiChecksOf, uiChecksReport, uiFinishChecks, uiFocusPass, __link };
