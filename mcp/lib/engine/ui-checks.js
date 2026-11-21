"use strict";

/**
 * dev-spec-driven engine — the UI checks (1.37): anti-patterns in a +ui feature's view / style files that are wrong whatever
 * the taste. Six rules, ids English-stable, each with a level:
 *   warn   — the feature report AND one finish warning (never a blocker): `zoom-disabled` (WCAG 1.4.4), `img-no-alt` (1.1.1),
 *            `outline-removed` (2.4.7), `click-no-keyboard` (2.1.1), `paste-blocked` (3.3.8 at a sign-in or code step; a
 *            usability defect elsewhere);
 *   report — the feature report only: `transition-all` (certain as syntax, a guideline as a finding — shadcn's own Button,
 *            Switch and Sidebar ship it, so `shadcn add` would earn a finish warning on kit code).
 * Static, bounded, linear in what it reads, read-only. A file is read through viewLines (design-system.js: the ONE line walk —
 * its lines cut at DS_LINE_MAX, comments out) and a stylesheet's structure through styleTokens' walker (the ONE CSS block
 * walker, its events), never a second walker. Every doubt reads as "not judged": a wrong finding sends a team to fix code that
 * is right. A team silences ONE occurrence with a comment `ui-check-off: <rule-id>[, <rule-id>]` on its line or the line
 * above (an HTML, JS or CSS comment; never a template engine's own: Blade's `{{-- --}}`, Twig's `{# #}`); a silenced
 * finding is counted, never listed.
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
const DS_CHECK_PER_FILE = 200; // findings kept per file (silenced ones too) — past it a file's further findings are counted, never kept
const DS_VALUE = 80; // a finding's value, cut
const DS_BLOCK_DEPTH = 64; // a sheet's blocks judged nested that deep — a deeper one is not, nor what it holds
// the project's stylesheets READ for a focus style, and the characters PARSED of them (a sheet naming `focus`, read whole):
// past either `limits` says so and outline-removed is not judged — measured (review 1 of 1.37 and its follow-up), on 3,000
// CSS modules where an antivirus scans each open (~1 ms): the report with the pass at its sheets bound ≤ 2.5× the same report
// with no candidate (1.1–1.9×), finish's part ≤ 2× (1.0–1.95×), modules that all name `:focus` at the chars bound ≤ 3× (2.0–2.75×)
const DS_FOCUS_SHEETS = 48;
const DS_FOCUS_CHARS = 384 * 1024;
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
// → { line(n, l, cut), failed() }: each line of a file that holds tags, in order (cut: viewLines cut it at DS_LINE_MAX);
// judge(tag) for each tag read whole — tag: { name, line (its first), text (from `<` to `>`) } — → CONTROL, a click candidate
// (its body decides: clickBodies) or nothing. The next tag is looked for PAST the previous one's end (a tag nested in an
// attribute — `icon={<img />}` — is not judged) and past a read that failed — no `>` within DS_TAG_LINES lines /
// DS_TAG_CHARS characters (neither it nor a tag starting in the lines it read is judged; failed() counts them — mayFind's), or none
// before the end of a CUT line (what the line held past the cut is unread: the read ends there, no quote or brace carried
// into the lines below — review 1 of 1.37) — each character read once: linear (CRIT_1: a reader that looked again from the
// next `<` was 1,230× plain JSX on unclosed tags). What lies between the tags reaches the click bodies being read (gap).
// (a read that failed is counted only for a tag that could have held a finding: an element, or one whose read part names a
// click or paste handler — review 2 of 1.37: a component's 30-line props, shadcn's `<DayPicker classNames={{…}}>`, were a
// limit line nobody could act on)
const mayFind = (t) => (RE_ELEMENT.test(t.name) || /click|paste/i.test(t.text) ? 1 : 0);
function tagReader(script, judge, add) {
  let cur = null, inScript = false, failed = 0; // the tag being read · inside a markup file's <script> block · reads past a bound
  const bodies = clickBodies(add, () => failed++);
  const line = (n, l, cut) => {
    let from = 0, masked = null;
    for (;;) {
      if (cur) {
        const end = readOn(cur, l, from);
        if (end === -1) {
          // (a body being read past a tag not read whole is past its own bound by then — lineEnd)
          if (cut) cur = null; // (the line-length limit says it)
          else if (++cur.lines > DS_TAG_LINES || cur.text.length > DS_TAG_CHARS) { failed += mayFind(cur); cur = null; } // not judged — the reader goes on below
          break;
        }
        const tag = cur;
        cur = null;
        from = end + 1;
        if (tag.text.length > DS_TAG_CHARS) { failed += mayFind(tag); continue; }
        bodies.tag(tag, judge(tag), n);
        if (!script && tag.name === "script" && !tag.text.endsWith("/>")) inScript = true;
        continue;
      }
      if (inScript) { const e = l.indexOf("</script", from); if (e === -1) break; inScript = false; from = e + 8; continue; }
      if (l.indexOf("<", from) === -1) { if (bodies.pending()) bodies.gap(l, from, l.length); break; }
      if (masked === null) masked = script ? blankStrings(l) : l;
      RE_TAG_START.lastIndex = from;
      let m;
      for (m = RE_TAG_START.exec(masked); m; m = RE_TAG_START.exec(masked)) {
        const next = masked[m.index + m[0].length];
        if (next !== undefined && !RE_TAG_NEXT.test(next)) continue;
        if (script && m.index > 0 && RE_TAG_AFTER.test(masked[m.index - 1])) continue;
        break;
      }
      if (bodies.pending()) bodies.gap(masked, from, m ? m.index : masked.length);
      if (!m) break;
      cur = { name: m[1], line: n, text: "<" + m[1], quote: "", braces: 0, lines: 1 };
      from = m.index + m[0].length;
    }
    bodies.lineEnd(n, l.length, cut);
  };
  // (a candidate whose close tag never came — an end tag HTML lets one omit: `<li onclick>…</ul>` — is counted at the file's
  // end, never dropped silently: review 2 of 1.37)
  return { line, failed: () => failed + bodies.left() };
}
// click-no-keyboard's BODIES (review 1 of 1.37: Laravel's starter kits — a wrapper whose slot holds the <button>, a backdrop
// holding its empty overlay layer). A click candidate (an element the keyboard cannot reach — judgeTag) is judged only when
// its body, read to its matching close tag within the tag reader's own bounds (DS_TAG_LINES lines / DS_TAG_CHARS characters
// from its `>` — past them: not judged, counted), holds content a user reads — literal text, or an expression that is no slot
// outlet — and nothing that is or may render a control (a CONTROL tag — a click on it bubbles to the candidate —, a slot
// outlet, a line cut at DS_LINE_MAX): a doubt, which clears every candidate being read (the control is in each of their
// bodies). Candidates nest: text marks each one open (textMark: those below it), a close tag pops the elements opened since,
// to its own name (an element of that name open — counted by name: an unmatched close costs nothing). Each character once.
const CONTROL = "control";
// a slot outlet in a body: JSX's `{children}` / `{props.children}` — called too, a render prop's `{children(state)}` /
// `{children?.()}` —, Svelte's `{@render …}`, a Blade echo of a bare variable (`{{ $trigger }}`, the raw `{!! $slot !!}` —
// review 2 of 1.37); `{#if}` / `{:else}` / `{/if}` and `{}` (a comment's braces) are no content
const RE_OUTLET = /^(?:(?:[\w$]+\.)*children(?:(?:\?\.)?\([\s\S]*\))?|@render\b[\s\S]*|!!\s*\$[A-Za-z_]\w*\s*!!)$/, RE_BARE_ECHO = /^\$[A-Za-z_]\w*$/;
function clickBodies(add, overBound) {
  let cands = [], head = 0, textMark = 0, els = [], open = new Map(), seen = 0; // pending candidates (head: the outermost kept) · elements opened since
  const pending = () => head < cands.length;
  const reset = () => { cands = []; head = 0; textMark = 0; els = []; open = new Map(); };
  const close = (name) => {
    if (!open.get(name)) return;
    for (;;) {
      const e = els.pop();
      open.set(e.name, open.get(e.name) - 1);
      if (e.cand != null && e.cand >= head) { const c = cands.pop(); if (e.cand < textMark) add("click-no-keyboard", c.line, c.value); if (textMark > cands.length) textMark = cands.length; }
      if (e.name === name) break;
    }
    if (!pending()) reset();
  };
  // what lies between tags, s[a..b): a close tag, an expression (`{…}`, `{{…}}`: an outlet is a doubt), text
  const gap = (s, a, b) => {
    for (let i = a; i < b && pending(); i++) {
      const c = s[i];
      if (c === " " || c === "\t") continue;
      if (c === "<" && s[i + 1] === "/") {
        let j = i + 2;
        while (j < b && !/[\s<>]/.test(s[j])) j++;
        close(s.slice(i + 2, j));
        while (j < b && (s[j] === " " || s[j] === "\t")) j++;
        i = j < b && s[j] === ">" ? j : j - 1;
        continue;
      }
      if (c === "{") {
        const two = s[i + 1] === "{", e = closing(s, i, b), end = e === -1 ? b : e;
        const inner = s.slice(i + (two ? 2 : 1), two && s[end - 1] === "}" ? end - 1 : end).trim();
        if ((two ? RE_BARE_ECHO : RE_OUTLET).test(inner)) { reset(); return; }
        if (inner && !/^[#:/]/.test(inner)) textMark = cands.length;
        i = end;
        continue;
      }
      textMark = cands.length;
    }
  };
  return {
    pending, gap, left: () => cands.length - head,
    tag: (t, k, n) => {
      if (k === CONTROL) { if (pending()) reset(); return; }
      if (t.text.endsWith("/>") || (!k && !pending())) return;
      if (k) cands.push({ line: t.line, value: k.value, n0: n, at: seen });
      els.push({ name: t.name, cand: k ? cands.length - 1 : null });
      open.set(t.name, (open.get(t.name) || 0) + 1);
    },
    // a line read: a cut one may hold a control past the cut; a candidate whose body went past the bound is not judged
    lineEnd: (n, len, cut) => {
      seen += len + 1;
      if (cut && pending()) reset();
      while (pending() && (n - cands[head].n0 >= DS_TAG_LINES || seen - cands[head].at > DS_TAG_CHARS)) { head++; overBound(); }
      if (!pending() && els.length) reset();
    },
  };
}

// --- a tag's attributes ----------------------------------------------------------------------------------------------------------
// → [{ name, value (as written, quotes / braces kept; null: none) } | { spread: true }] — null past DS_TAG_ATTRS of them (a tag
// is not judged on what it was not read for). A `{…}` where a NAME stands is a spread
// (`{...props}`, `{...getRootProps()}`, a template engine's `{{attrs}}`: it may hold any attribute) — unless it holds one
// identifier, Svelte's shorthand `{alt}`, which names that attribute. So is a binding with no argument — Vue's `v-bind="$attrs"`,
// Alpine's `x-bind="obj"` (the object form: it binds an object of attributes — review 1 of 1.37).
const RE_NAME_STOP = /[\s=>/"'`{]/;
const RE_IDENT = /^[A-Za-z_$][\w$]*$/;
const RE_OBJECT_BIND = /^[vx]-bind$/;
function closing(s, i, to = s.length) { // s[i] is `{` → the index (before `to`) of the `}` that closes it (quotes and nested braces in between), or -1
  let depth = 0, quote = "";
  for (let k = i; k < to; k++) {
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
      if (out.push(RE_OBJECT_BIND.test(name) ? { spread: true } : { name, value: text.slice(k, e) }) > DS_TAG_ATTRS) return null;
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
// a role the keyboard reaches without a tabindex of its own: ARIA's composite widget items, whose container moves focus to them
// (a roving tabindex, aria-activedescendant), and presentation / none (no widget at all)
const ROLE_REACHED = new Set(["option", "menuitem", "menuitemcheckbox", "menuitemradio", "treeitem", "gridcell", "row", "tab", "columnheader", "rowheader",
  "presentation", "none"]);
// a listener modifier that takes the click off the element itself: `.self` / `|self`, Alpine's `.outside` / `.away` (a click
// elsewhere), `.window` / `.document` (the page's)
const RE_OFF_ELEMENT = /^(?:self|outside|away|window|document)$/;
// HTML's void elements (the spec's list; `embed` and `input` are focusable, never candidates): no content, no close tag — a
// click on one is judged at once as a self-closing element's (no body: a doubt), never left waiting for a close that never
// comes (review 1 of 1.37: `<img onclick>` was dropped 30 lines later and counted as a read past its bound)
const VOID = new Set(["area", "base", "br", "col", "hr", "img", "link", "meta", "source", "track", "wbr"]);
const RE_DISPLAY_NONE = /display\s*:\s*["'`]?none(?![\w-])/i;
const RE_DELEGATES = /\.focus\(|stopPropagation|target/i; // an inline click handler that forwards focus or reads the event's target
const RE_CANCELS = /preventDefault|return\s+false/;
// (the API — `e.clipboardData`, `navigator.clipboard`, `getData` —, never the word: review 2 of 1.37, a blocking handler's
// own message "Pasting from the clipboard is disabled" read as a read)
const RE_READS_CLIPBOARD = /clipboardData|navigator\s*\.\s*clipboard|getData/;
// An inline handler that hands its event on to a call — `(e) => { e.preventDefault(); onPasteCode(e); }`, Vue / Angular's
// `$event`, an HTML handler's `event` — is not followed, as a named one is not: the call may read the clipboard (review 1 of
// 1.37: the JSX spelling of Vue's excused `@paste.prevent="onPasteCode"` was a finding). Its event: the handler's parameter
// (an arrow's, a function's), else `$event` / `event`.
const RE_HANDLER_PARAM = /^[\s{"'`]*(?:async\s*)?(?:\(\s*([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)\s*=>|function\s*[\w$]*\s*\(\s*([A-Za-z_$][\w$]*))/;
function forwardsEvent(v) {
  const m = RE_HANDLER_PARAM.exec(v);
  const body = m ? v.slice(m[0].length) : v;
  return (m ? [m[1] || m[2] || m[3]] : ["$event", "event"]).some((id) => new RegExp("[(,]\\s*" + id.replace(/\$/g, "\\$") + "\\s*[,)]").test(body));
}
// → CONTROL (the tag is or may render a control: focusable by default, a component / custom element / member, `<slot>`, a tag
// not read — a click inside a candidate's body reaches the keyboard through it), a click candidate { value } (clickBodies
// judges it on its body) or nothing
function judgeTag(tag, add) {
  const attrs = attributesOf(tag.text, tag.name.length + 1);
  if (!attrs) return CONTROL;
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
  // or a bare `.prevent` / `|preventDefault`; a named handler is not followed, nor one that hands its event on (forwardsEvent)
  for (const e of events) {
    if (e.event !== "paste") continue;
    const v = e.value == null ? "" : e.value;
    const blocks = e.value == null ? e.mods.includes("prevent") || e.mods.includes("preventDefault") : RE_CANCELS.test(v);
    if (blocks && !RE_READS_CLIPBOARD.test(v) && !forwardsEvent(v)) { add("paste-blocked", tag.line, "<" + tag.name + " " + e.attr + ">"); break; }
  }
  const element = RE_ELEMENT.test(tag.name);
  const focusable = tag.name === "a" || tag.name === "area" ? named.has("href") || named.has("routerlink") : FOCUSABLE.has(tag.name);
  // (a `<label>` is no control in a body — never focused itself, the control it names is its own tag: review 2 of 1.37)
  const kind = !element || (focusable && tag.name !== "label") || tag.name === "slot" ? CONTROL : undefined;
  if (spread) return kind; // (a spread may hold any attribute)
  // img-no-alt: `<img` (as written) with no alt in any binding, no accessible name (a non-empty `title` names it too, as axe-core's
  // image-alt reads it — review 1 of 1.37), not decorative, rendered
  if (tag.name === "img" && !named.has("alt") && !named.has("aria-label") && !named.has("aria-labelledby") && literal(named.get("title")) === "" &&
    !["presentation", "none"].includes(literal(named.get("role"))) && !shown("aria-hidden") && !shown("hidden") &&
    !(named.has("style") && RE_DISPLAY_NONE.test(named.get("style") || ""))) add("img-no-alt", tag.line, "<img>");
  // click-no-keyboard: a click handler on an element the keyboard cannot reach — not focusable by default, no tabindex, no role
  // whose focus its container manages (ROLE_REACHED), not inert / aria-hidden: a role or a key handler alone reaches nothing
  // (review 1 of 1.37); never a listener off the element itself (`.self`, Alpine's `.outside` / `.away` / `.window` /
  // `.document`), a bare `@click.stop`, a delegating handler, a void element (a self-closing element — a modal's backdrop —
  // has no body either: clickBodies opens none)
  const click = events.find((e) => e.event === "click");
  if (!click || !element) return kind;
  const role = literal(named.get("role")).split(/\s+/)[0];
  if (focusable || named.has("tabindex") || ROLE_REACHED.has(role) || named.has("inert") || shown("aria-hidden")) return kind;
  if (click.mods.some((m) => RE_OFF_ELEMENT.test(m)) || (click.value == null && click.mods.includes("stop")) || RE_DELEGATES.test(click.value || "") || VOID.has(tag.name)) return kind;
  return { value: "<" + tag.name + " " + click.attr + ">" };
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
// utility: `transition-all` (any variants, `!`); an outline removal (`outline-none`, `outline-hidden`, `outline-0`) under a
// variant of the element's OWN focus (isOwnFocus) — a bare one is not judged (shadcn puts it on focus-managed containers and
// activedescendant options); and a FOCUS STYLE: any other utility under a focus variant (`focus-visible:ring-2`,
// `group-focus:…`) that draws something — never one valued `0` / `none` / `hidden` / `transparent` (`focus:ring-0`,
// `focus:shadow-none`: the forms plugin's ring removed — review 1 of 1.37). A FOCUS VARIANT: one holding `focus` as a part
// delimited by `-`, `[`, `]` or its ends — `focus`, `focus-visible`, `group-focus`, `peer-focus-within`, Headless UI's
// `data-[focus]` / `data-focus` / `ui-focus-visible`, Tailwind 4's `has-focus-visible` — never one a `not` part negates
// (`not-data-focus`), a group's name (`group-focus/item`) aside (review 1 of 1.37: Headless UI's documented Button warned). The
// element's OWN focus — what a removal is judged under, as the CSS reader judges `:focus` and never `:focus-within`: `focus`,
// `focus-visible` or an attribute form of them (`data-focus`, `data-[focus]`, `ui-focus-visible`); a relational one (a
// `group` / `peer` / `has` / `in` part, `focus-within`) is a doubt — the outline it removes is not the focused element's
// (review 2 of 1.37: a popover panel's `focus-within:outline-none` around its buttons was a candidate).
// → whether the text holds a focus style.
const RE_TW_PICK = /transition-all|outline-|focus/;
const RE_TW_SPLIT = /[\s"'`{}(),;=<>]+/;
const RE_TW_REMOVAL = /^outline-(?:none|hidden|0)$/;
const RE_TW_NOTHING = /(?:^|-)(?:0|none|hidden|transparent)$/;
const isFocusVariant = (v) => { const parts = v.replace(/\/[\w-]+$/, "").split(/[-[\]]/); return parts.includes("focus") && !parts.includes("not"); };
const isOwnFocus = (v) => /^(?:(?:data|ui)-)?focus(?:-visible)?$/.test(v.split(/[-[\]]/).filter(Boolean).join("-"));
function utilities(s, line, add) {
  if (!RE_TW_PICK.test(s)) return false;
  let focus = false;
  for (const tok of s.split(RE_TW_SPLIT)) {
    if (!tok) continue;
    const parts = tok.split(":");
    const util = parts.pop().replace(/^!|!$/g, "");
    if (util === "transition-all") { add("transition-all", line, tok); continue; }
    if (!util || !parts.some(isFocusVariant)) continue;
    if (RE_TW_REMOVAL.test(util)) { if (parts.some(isOwnFocus)) add("outline-removed", line, tok); } else if (!RE_TW_NOTHING.test(util)) focus = true;
  }
  return focus;
}

// --- a stylesheet's structure (the walker's events) ------------------------------------------------------------------------------
// outline-removed: an outline removal — `outline: none | 0`, `outline-style: none`, `outline-width: 0` (`!important` too; never
// `outline: 2px solid transparent`, which forced colours show: no candidate, no focus style either) — in a rule whose selector list holds
//   - "element": a selector whose last compound is `*` or an element focusable by default, with no pseudo-class / -element
//     (`button { outline: none }`, `* { outline: 0 }`) — a class alone is never judged (`.modal { outline: 0 }`), or
//   - "focus": a selector whose last compound holds `:focus` itself (never -visible / -within / -moz-focusring), of no type or
//     one focusable by default, never `[tabindex="-1"]` (`main:focus`, `h1:focus`: focus a script moves there, out of the tab
//     order — review 1 of 1.37) — and the rule, its nested blocks included, declares nothing else that draws (Bootstrap's
//     `outline: 0; box-shadow: …` replaces it);
// never a selector that names focus-visible (`:focus:not(:focus-visible)`), inside `@media print`, nor a rule that never
// closes. A CANDIDATE: any focus style of the file, the feature's files or the project's stylesheets excuses it (uiChecksReport).
// A FOCUS STYLE: a rule naming a focus pseudo-class (or inside one) that declares something that draws (drawsNothing; an
// `@apply` there by its bare utilities); a Tailwind focus utility in an `@apply`.
// transition-all: a `transition` / `transition-property` declaration (transitionAll), a Tailwind `transition-all` in an
// `@apply` — never inside `@media (prefers-reduced-motion: reduce)`.
const RE_REMOVAL = /^(?:outline\s*:\s*(?:none|0(?:px)?)|outline-style\s*:\s*none|outline-width\s*:\s*0(?:px)?)(?:\s*!\s*important)?$/i;
const RE_FOCUS_PSEUDO = /:focus(?:-visible|-within)?(?![\w-])/i;
const RE_FOCUS_ITSELF = /:focus(?![\w-])/i;
const RE_PRINT = /^@media\b.*\bprint\b/i;
const RE_REDUCED = /prefers-reduced-motion\s*(?:\)|:\s*reduce)/i;
const RE_DECLARATION = /^([A-Za-z-]+)\s*:\s*([\s\S]*)$/;
const RE_COMPOUND_TYPE = /^(\*|[A-Za-z][A-Za-z0-9]*)/;
const RE_TABINDEX_OFF = /\[\s*tabindex\s*=\s*["']?-1["']?\s*\]/i;
// A declaration that draws nothing: each of its comma items `transparent` as its colour, or nothing but `none` and zeros
// (`outline: none`, `box-shadow: none`, `border: 0`, `outline: 2px solid transparent`), or an `outline-offset` (it moves an
// outline: beside one that draws, that outline is the focus style — review 2 of 1.37: Tailwind v3's compiled `outline-none`,
// `outline: 2px solid transparent; outline-offset: 2px`, excused every removal of the project). It is neither a focus style
// nor what keeps a `:focus` rule from being a candidate (review 1 of 1.37: Bootstrap's `.btn:focus { outline: none;
// box-shadow: none }` override was a FOCUS STYLE excusing every removal of the project); an outline removal is one.
const RE_NOTHING_WORD = /^(?:none|[+-]?0(?:\.0+)?[a-z%]*)$/i;
function drawsNothing(text) {
  const d = RE_DECLARATION.exec(text);
  if (!d) return false;
  if (d[1].toLowerCase() === "outline-offset") return true;
  const v = d[2].replace(/\s*!\s*important\s*$/i, "").trim();
  return v !== "" && splitTop(v, isComma).every((item) => {
    const words = splitTop(item.trim(), isBlank).filter(Boolean);
    return words.some((w) => w.toLowerCase() === "transparent") || words.every((w) => RE_NOTHING_WORD.test(w));
  });
}
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
// s without what its parentheses hold (a pseudo-class's arguments: `:not(…)`, `:is(…)`), each character once
function outsideParens(s) {
  let depth = 0, out = "";
  for (const c of s) { if (c === "(") depth++; else if (c === ")") depth--; else if (depth === 0) out += c; }
  return out;
}
function outlineShape(prelude) {
  let shape = null;
  for (const raw of splitTop(prelude, isComma)) {
    const sel = raw.trim();
    if (!sel || /focus-visible/i.test(sel)) continue;
    const last = lastCompound(sel);
    const t = RE_COMPOUND_TYPE.exec(last), reached = !t || t[1] === "*" || FOCUSABLE.has(t[1].toLowerCase());
    // (`[tabindex="-1"]` the compound REQUIRES: outside a pseudo-class's arguments — review 2 of 1.37, `:not([tabindex="-1"])`)
    if (!last.includes(":")) { if (t && reached) return "element"; } else if (RE_FOCUS_ITSELF.test(last) && reached && !RE_TABINDEX_OFF.test(outsideParens(last))) shape = "focus";
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
      const apply = /^@apply\s/i.test(e.text);
      // (an `@apply` in a focus rule: its bare utilities read as declarations — `outline-none` / `-hidden` / `-0` a removal,
      // RE_TW_NOTHING's nothing, any other draws; one with a variant draws — review 2 of 1.37: `*:focus { @apply outline-none }`
      // was a focus style)
      const own = apply && b != null && b.focus ? e.text.replace(/\s*!\s*important$/i, "").split(/\s+/).slice(1).map((u) => u.replace(/^!|!$/g, "")) : null;
      const removal = own ? own.some((u) => RE_TW_REMOVAL.test(u)) : RE_REMOVAL.test(e.text);
      const draws = own ? own.some((u) => u.includes(":") || !(RE_TW_REMOVAL.test(u) || RE_TW_NOTHING.test(u))) : !drawsNothing(e.text);
      if (b != null && b.focus && draws) focus = true;
      // (a Tailwind `@apply`: its utilities, as a class list's — no motion rule inside a reduced-motion block)
      if (apply && utilities(e.text, e.from, (rule, line, value) => { if (add && !(reduced && rule === "transition-all")) add(rule, line, value); })) focus = true;
      if (!add) return;
      if (b != null) { if (removal && !b.print) b.removals.push({ line: e.from, text: e.text }); if (draws) b.other = true; }
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
// the rule ids a `ui-check-off:` comment names: ids (letters and `-`) separated by `,`, read up to the next marker (what
// follows the ids — a reason — is not read)
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
// One view / style file → { findings: [{ rule, line, value, silenced }], focus, past, cut }. lines: viewLines(text, rel)'s (n
// 1-based, src, l without its comments, css, cut). A finding is at its tag's or declaration's FIRST line (a class utility's:
// its class's line), one per rule and line; `silenced` when a `ui-check-off:` comment (in `src`, absent from `l`: a comment
// viewLines strips — `//`, `/* */`, `<!-- -->`, `{/* */}`; never a template engine's own) names its rule on that line or on
// the line above, whatever else that line holds (review 2 of 1.37: `button:focus { /* ui-check-off: … */` above its
// declaration — 1.37's first rule, back) — decided when it is found (the lines up to it are read). DS_CHECK_PER_FILE findings are kept; past them each is still
// COUNTED — past: { byRule (the unsilenced ones), silenced } — never kept (review 1 of 1.37: a file of 200 report-level
// findings hid its real ones, `total` read 200). cut: { lines (cut at DS_LINE_MAX), tags (tagReader's failed reads) }.
// outline-removed findings are CANDIDATES (focus: does the file hold a focus style — uiChecksReport decides).
function uiChecksOf(lines, rel) {
  const sheet = RE_STYLE_EXT.test(rel);
  const findings = [], seen = new Set(), marks = new Map(), css = [], past = { byRule: {}, silenced: 0 };
  let focus = false, anyCss = false, cutLines = 0;
  const add = (rule, line, value) => {
    const k = rule + ":" + line;
    if (seen.has(k)) return;
    seen.add(k);
    const here = marks.get(line), above = marks.get(line - 1);
    const silenced = (here != null && here.has(rule)) || (above != null && above.has(rule));
    if (findings.length < DS_CHECK_PER_FILE) findings.push({ rule, line, value: String(value).replace(/\s+/g, " ").trim().slice(0, DS_VALUE), silenced });
    else if (silenced) past.silenced++;
    else past.byRule[rule] = (past.byRule[rule] || 0) + 1;
  };
  const tags = sheet ? null : tagReader(RE_SCRIPT_FILE.test(rel), (tag) => judgeTag(tag, add), add);
  for (const { n, src, l, css: isCss, cut } of lines) {
    if (src.includes("ui-check-off:") && !l.includes("ui-check-off:")) marks.set(n, markIds(src));
    if (cut) cutLines++;
    css.push(isCss ? l : "");
    if (isCss) { anyCss = true; continue; }
    tags.line(n, l, cut);
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
  return { findings, focus, past, cut: { lines: cutLines, tags: tags ? tags.failed() : 0 } };
}

// --- the feature's files ---------------------------------------------------------------------------------------------------------
// Does any of the project's stylesheets hold a focus style (sheetChecks over the WHOLE file — never the name-ranked token
// candidates: `focus.css`, `_a11y.scss`, a .less file count)? sheets: [{rel, full}], read the shorter path first, each WHOLE,
// DS_FOCUS_SHEETS files read at most; it stops at the first that holds one. Only a sheet whose text names `focus` (any case)
// is parsed — every focus style does: `:focus`, `:focus-visible`, `:focus-within`, a focus variant in an `@apply` (review 1
// of 1.37: the parse of ~800 sheets was 8× the report) — and DS_FOCUS_CHARS bounds the characters PARSED: a sheet that names
// no focus costs an open and a read, never the parse budget. A sheet longer than DS_FOCUS_CHARS (not read whole), or one to
// parse past what is left of the budget, ends the search.
// → { focus, limits: [{code: focus-sheets | focus-chars, read, sheet (focus-chars: the sheet that ended the search)}] — a
// bound that cut the search }
const RE_FOCUS_WORD = /focus/i;
function uiFocusPass(sheets) {
  const list = sheets.slice().sort((a, b) => a.rel.length - b.rel.length || (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const heads = readFileHeads(list.slice(0, DS_FOCUS_SHEETS).map((s) => s.full), DS_FOCUS_CHARS + 1);
  let read = 0, parsed = 0;
  try {
    for (const s of list) {
      if (read >= DS_FOCUS_SHEETS) return { focus: false, limits: [{ code: "focus-sheets", read }] };
      const text = heads.next(), names = text != null && RE_FOCUS_WORD.test(text);
      if (text != null && (text.length > DS_FOCUS_CHARS || (names && parsed + text.length > DS_FOCUS_CHARS))) return { focus: false, limits: [{ code: "focus-chars", read, sheet: s.rel }] };
      read++;
      if (!names) continue;
      parsed += text.length;
      if (sheetChecks(text, s.rel, null)) return { focus: true, limits: [] };
    }
  } finally {
    heads.stop();
  }
  return { focus: false, limits: [] };
}
// The feature report's `uiChecks` → { findings (the first `cap`: rule, level, file, line, value — warn first, then by file
// and line), total, byRule, silenced, limits }. files: [{ rel, findings, focus, past, cut }] (uiChecksOf of each file read).
// The outline-removed candidates stand only while NO focus style exists — in the feature's files, else in the project's
// stylesheets (projectFocus(): uiFocusPass, called only then — no unsilenced candidate, no read); a search a bound cut judges
// none. A silenced finding is counted silenced whatever the pass says; a finding past a file's DS_CHECK_PER_FILE is counted,
// never listed. limits — each bound that cut a read or dropped a finding, with a count (review 1 of 1.37): tag-length
// ({read: DS_TAG_LINES, count: the tags read past the tag reader's bound, file: the first}), file-findings ({read:
// DS_CHECK_PER_FILE, count: the findings past it, file: the first}), then the pass's focus-sheets / focus-chars ({read,
// count: the unsilenced candidates it left unjudged, file and line: the first of them (no line: one past a file's cap),
// sheet: focus-chars' — a bound never hides a KNOWN candidate silently: review 2 of 1.37, an Angular app of 60 components
// lost its true finding).
function uiChecksReport(files, projectFocus, cap) {
  let focus = files.some((f) => f.focus), limits = [];
  if (!focus && files.some((f) => f.past.byRule["outline-removed"] || f.findings.some((x) => x.rule === "outline-removed" && !x.silenced))) ({ focus, limits } = projectFocus());
  const stands = (rule) => !(rule === "outline-removed" && (focus || limits.length));
  const list = [], unlisted = [];
  const tagCut = { code: "tag-length", read: DS_TAG_LINES, count: 0, file: null }, fileCut = { code: "file-findings", read: DS_CHECK_PER_FILE, count: 0, file: null };
  const cut = (c, n, rel) => { if (n && !c.count) c.file = rel; c.count += n; };
  const unjudged = { count: 0, file: null }; // (the candidates a cut pass left: limits non-empty means no focus style was found)
  let silenced = 0;
  for (const f of files) {
    for (const x of f.findings) {
      if (x.silenced) { silenced++; continue; }
      if (stands(x.rule)) list.push({ rule: x.rule, level: UI_RULES[x.rule], file: f.rel, line: x.line, value: x.value });
      else if (limits.length) { unjudged.count++; if (unjudged.line == null || f.rel < unjudged.file || (f.rel === unjudged.file && x.line < unjudged.line)) Object.assign(unjudged, { file: f.rel, line: x.line }); }
    }
    let more = f.past.silenced;
    silenced += f.past.silenced;
    for (const [rule, n] of Object.entries(f.past.byRule)) if (stands(rule)) { unlisted.push([rule, n]); more += n; } else if (limits.length) cut(unjudged, n, f.rel);
    cut(tagCut, f.cut.tags, f.rel);
    cut(fileCut, more, f.rel);
  }
  const rank = (x) => (x.level === "warn" ? 0 : 1);
  list.sort((a, b) => rank(a) - rank(b) || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.line - b.line);
  const byRule = {};
  let total = list.length;
  for (const x of list) byRule[x.rule] = (byRule[x.rule] || 0) + 1;
  for (const [rule, n] of unlisted) { byRule[rule] = (byRule[rule] || 0) + n; total += n; }
  const pass = limits.map((l) => Object.assign({ code: l.code, read: l.read }, unjudged, l.sheet ? { sheet: l.sheet } : {}));
  return { findings: list.slice(0, cap), total, byRule, silenced, limits: [tagCut, fileCut].filter((c) => c.count).concat(pass) };
}

// spec_finish's part of a feature report's uiChecks → { total, byRule, top (the first 3: rule, file, line, value), limits (the
// report's) } — the warn-level findings alone (the report sorts them first; a report-level rule is never a finish warning)
function uiFinishChecks(report) {
  const byRule = {};
  let total = 0;
  for (const [rule, n] of Object.entries(report.byRule)) if (UI_RULES[rule] === "warn") { byRule[rule] = n; total += n; }
  const top = report.findings.filter((x) => x.level === "warn").slice(0, 3).map((x) => ({ rule: x.rule, file: x.file, line: x.line, value: x.value }));
  return { total, byRule, top, limits: report.limits };
}

module.exports = { uiChecksOf, uiChecksReport, uiFinishChecks, uiFocusPass, __link };
