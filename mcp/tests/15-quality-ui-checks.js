"use strict";
// The UI checks (1.37) — engine/ui-checks.js: zoom-disabled, img-no-alt, outline-removed, click-no-keyboard, paste-blocked (warn)
// and transition-all (report) over one view / style file (uiChecksOf, on real-shaped files of each syntax), the tag reader,
// the stylesheet's structure through styleTokens' events, the inline `ui-check-off:` comment.

const path = require("path");

exports.run = async ({ all, require, __dirname }) => {
  const js = (v) => JSON.stringify(v);
  const T = require(path.join(__dirname, "lib", "engine", "index.js")).loadLazyTier();
  const run = (text, rel) => T.uiChecksOf(T.viewLines(text, rel), rel);
  // a file's findings as `rule@line` (a silenced one `~rule@line`), in the order found
  const got = (text, rel) => run(text, rel).findings.map((f) => (f.silenced ? "~" : "") + f.rule + "@" + f.line);
  const lines = (...l) => l.join("\n") + "\n";

  { // the shadcn kit as `shadcn add` writes it (v4): Button ships transition-all (report-level) and a BARE outline-none beside
    // its focus-visible ring (a focus style); Dialog's close button removes the outline on focus beside a focus:ring-2
    const button = lines("import * as React from \"react\"", "import { Slot } from \"@radix-ui/react-slot\"", "import { cva, type VariantProps } from \"class-variance-authority\"", "",
      "import { cn } from \"@/lib/utils\"", "", "const buttonVariants = cva(",
      "  \"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20\",",
      "  {", "    variants: {", "      variant: {", "        default: \"bg-primary text-primary-foreground shadow-xs hover:bg-primary/90\",", "        link: \"text-primary underline-offset-4 hover:underline\",",
      "      },", "    },", "  }", ")", "",
      "function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<\"button\"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {",
      "  const Comp = asChild ? Slot : \"button\"", "", "  return (", "    <Comp", "      data-slot=\"button\"", "      className={cn(buttonVariants({ variant, size, className }))}", "      {...props}",
      "    />", "  )", "}", "", "export { Button, buttonVariants }");
    const dialog = lines("function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {", "  return (", "    <DialogPrimitive.Overlay",
      "      data-slot=\"dialog-overlay\"", "      className={cn(\"data-[state=open]:animate-in data-[state=closed]:fade-out-0 fixed inset-0 z-50 bg-black/50\", className)}", "      {...props}", "    />", "  )", "}",
      "function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {", "  return (", "    <DialogPortal data-slot=\"dialog-portal\">",
      "      <DialogOverlay />", "      <DialogPrimitive.Content data-slot=\"dialog-content\" className={cn(\"bg-background fixed top-[50%] left-[50%] z-50 grid duration-200\", className)} {...props}>",
      "        {children}",
      "        <DialogPrimitive.Close className=\"ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden\">",
      "          <XIcon />", "          <span className=\"sr-only\">Close</span>", "        </DialogPrimitive.Close>", "      </DialogPrimitive.Content>", "    </DialogPortal>", "  )", "}");
    const b = run(button, "src/components/ui/button.tsx"), d = run(dialog, "src/components/ui/dialog.tsx");
    all("1.37 UI checks: shadcn's Button — transition-all is a REPORT-level finding at its line, a bare outline-none is no candidate, focus-visible:ring is a focus style, `React.ComponentProps<\"button\">` no tag; Dialog — focus:outline-hidden is an outline CANDIDATE beside focus:ring-2 (a focus style: the report excuses it), `transition-opacity` nothing (got " + js({ b, d }) + ")", {
      button: () => js(b.findings) === js([{ rule: "transition-all", line: 8, value: "transition-all", silenced: false }]) && b.focus === true,
      dialog: () => js(d.findings.map((f) => f.rule + "@" + f.line + " " + f.value)) === js(["outline-removed@16 focus:outline-hidden"]) && d.focus === true,
    });
  }

  { // zoom-disabled: a Next app's root layout — the viewport export AND a <meta> tag; and the values that are fine
    const layout = lines("import type { Metadata, Viewport } from \"next\";", "", "export const viewport: Viewport = {", "  width: \"device-width\",", "  initialScale: 1,",
      "  maximumScale: 1,", "  userScalable: false,", "};", "", "export default function RootLayout({ children }: { children: React.ReactNode }) {", "  return (", "    <html lang=\"en\">", "      <head>",
      "        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no\" />", "      </head>", "      <body>{children}</body>", "    </html>", "  );", "}");
    const fine = lines("export const viewport = { width: \"device-width\", initialScale: 1, maximumScale: 5, userScalable: true };",
      "const a = <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=2, user-scalable=yes\" />;",
      "// an old one: <meta name=\"viewport\" content=\"maximum-scale=1, user-scalable=no\">");
    const html = lines("<!-- <meta name=\"viewport\" content=\"user-scalable=no\"> -->", "<meta name=\"viewport\" content=\"width=device-width, maximum-scale=1.5\">",
      "<meta name=\"viewport\" content=\"width=device-width, user-scalable=0\">", "<meta name=\"viewport\" content=\"width=device-width, maximum-scale=1.0, user-scalable=no\">");
    const l = run(layout, "src/app/layout.tsx");
    all("1.37 UI checks: zoom-disabled — Next's viewport export (`maximumScale: 1`, `userScalable: false`) and a <meta>'s `maximum-scale=1, user-scalable=no` (ONE finding a line); never maximum-scale 2 / 5, user-scalable=yes / true, nor in a comment; `maximum-scale=1.5`, `user-scalable=0` are (got " +
      js({ layout: l.findings, fine: got(fine, "src/app/head.tsx"), html: got(html, "public/index.html") }) + ")", {
      layout: () => js(l.findings.map((f) => f.rule + "@" + f.line + " " + f.value)) === js(["zoom-disabled@6 maximumScale: 1", "zoom-disabled@7 userScalable: false", "zoom-disabled@14 user-scalable=no"]),
      fine: () => js(got(fine, "src/app/head.tsx")) === js([]),
      html: () => js(got(html, "public/index.html")) === js(["zoom-disabled@2", "zoom-disabled@3", "zoom-disabled@4"]),
    });
  }

  { // img-no-alt and click-no-keyboard in JSX: every alt form and every excuse, on real shapes; the tag reader's traps
    const jsx = lines("export function Gallery({ items, onClose, open, count, limit }) {",
      "  const help = 'Paste an image like <img src=\"a.png\"> here';", // 2: a string (A2)
      "  if (count<limit && open) {", // 3: a comparison, no tag (A1) — the div below is still read
      "    track();", "  }", "  return (", "    <>",
      "      <div className=\"fixed inset-0 bg-black/50\" onClick={onClose} />", // 8: self-closing (a backdrop)
      "      <div className=\"tile\" onClick={() => setOpen(true)}>", // 9: FINDING
      "        <img src={items[0].src} />", // 10: FINDING
      "        <img src={a > b ? x : y} onLoad={() => go()} alt=\"\" />", // 11: braces hold the `>` (A4)
      "        <img src=\"/logo.svg\" alt=\"Acme\" />", "        <img src=\"/x.png\" aria-label=\"chart\" />", "        <img src=\"/x.png\" aria-labelledby=\"cap\" />",
      "        <img src=\"/x.png\" role=\"presentation\" />", "        <img src=\"/x.png\" role=\"img\" />", // 16: FINDING (a role that is no decoration)
      "        <img src=\"/x.png\" aria-hidden=\"true\" />", "        <img src=\"/x.png\" aria-hidden={false} />", // 18: FINDING
      "        <img src=\"/x.png\" hidden />", "        <img src=\"/x.png\" style={{ display: \"none\" }} />", "        <img src=\"/x.png\" style={{ display: \"block\" }} />", // 21: FINDING
      "        <img src=\"/x.png\" data-alt=\"x\" />", // 22: FINDING
      "        <img {...imgProps} />", "        <Image src=\"/x.png\" />", "        <img-viewer src=\"/x.png\" />",
      "        <div title=\"1 > 0\" onClick={go}>more</div>", // 26: FINDING (the quotes hold the `>`, A3)
      "        <div onClick={go} role=\"button\" tabIndex={0} onKeyDown={key}>ok</div>", "        <div onClick={go} tabIndex={-1}>ok</div>", "        <div onClick={go} onKeyDown={key}>ok</div>",
      "        <div onClick={go} aria-hidden=\"true\">ok</div>", "        <div onClick={go} inert>ok</div>", "        <div {...getRootProps()} onClick={go}>ok</div>",
      "        <div onClick={go}></div>", // 33: empty
      "        <div onClick={() => inputRef.current?.focus()}>otp</div>", "        <div onClick={(e) => e.target === e.currentTarget && onClose()}>x</div>",
      "        <div onClick={(e) => { e.stopPropagation(); go(); }}>x</div>",
      "        <a onClick={go}>no href</a>", // 37: FINDING
      "        <a href=\"#top\" onClick={go}>top</a>", "        <button onClick={go}>b</button>", "        <summary onClick={go}>s</summary>", "        <label onClick={go}>l</label>",
      "        <motion.div onClick={go}>m</motion.div>", "        <my-el onClick={go}>m</my-el>", "        <Card onClick={go}>c</Card>",
      "        <Button icon={<img src=\"/a.svg\" />}>nested</Button>", // 45: a tag inside an attribute is not judged (A6)
      "        <div", "          className=\"row\"", "          data-x=\"1\"", "          onClick={go}", "        >", // 46: FINDING at the FIRST line (A5)
      "          row", "        </div>", "        <img", "          src=\"x\"", "          alt=\"multi", "          line\"", "        />", // 53: an alt over lines (B1)
      "        {count<limit && (", "          <div onClick={toggle}>more</div>", "        )}", // 59: FINDING (no tag after an identifier, A1)
      "        <li role=\"option\" aria-selected={sel} onClick={() => pick(o)}>o</li>",
      "      </div>", "    </>", "  );", "}");
    const g = got(jsx, "src/components/Gallery.tsx");
    all("1.37 UI checks: img-no-alt / click-no-keyboard in JSX — every alt form (aria-label / -labelledby, role presentation, aria-hidden, hidden, own display:none, a spread) and every click excuse (role, tabIndex, a key handler, aria-hidden, inert, a spread, self-closing, empty, a focus-forwarding / target / stopPropagation handler, focusable by default: button, a href, summary, label) excuse; `role=\"img\"`, `aria-hidden={false}`, `display: block`, `data-alt`, `<a>` without href do not; components, custom elements, members and a nested tag are not judged; a string's tag, a comparison, a `>` in quotes or braces never derail the reader; a multi-line tag is judged at its first line (got " + js(g) + ")", {
      exact: () => js(g) === js(["click-no-keyboard@9", "img-no-alt@10", "img-no-alt@16", "img-no-alt@18", "img-no-alt@21", "img-no-alt@22", "click-no-keyboard@26", "click-no-keyboard@37",
        "click-no-keyboard@46", "click-no-keyboard@59"]),
    });
  }

  { // the other syntaxes: a Vue SFC (@click, :alt, @paste.prevent, a <style scoped lang="scss"> judged as a sheet, a string in
    // its script), a Svelte component (on:click|self, a bare on:paste|preventDefault, {alt}), an Angular template ((click),
    // (keyup.enter), [attr.alt], routerLink), plain HTML with the Meta Pixel's <noscript> image and a <script> block
    const vue = lines("<template>", "  <div class=\"card\" @click=\"open = true\">", // 2: FINDING
      "    <img :src=\"cover\" />", // 3: FINDING
      "    <img :src=\"cover\" :alt=\"title\" />", "    <img :src=\"cover\" v-bind:alt=\"title\" />", "    <img :src=\"cover\" @click.alt=\"zoom\" />", // 6: FINDING (a key modifier is no alt)
      "    <span @click.stop>stop only</span>", "    <span @click.stop=\"toggle\">x</span>", // 8: FINDING (a handler)
      "    <div @click.self=\"close\">backdrop</div>", "    <li v-on:click=\"select(item)\" @keydown.enter=\"select(item)\" tabindex=\"0\">x</li>",
      "    <input @paste.prevent />", // 11: FINDING
      "    <input @paste.prevent=\"sanitize\" />", "    <p>Write outline: none in your CSS and transition: all if you must</p>", "    <router-link to=\"/x\" @click=\"go\">x</router-link>",
      "  </div>", "</template>", "<script setup>", "const html = '<img src=\"x.png\">'", "const style = { transition: 'opacity .3s' }", "</script>",
      "<style scoped lang=\"scss\">", ".card:focus { outline: none; }", // 22: FINDING (a candidate)
      ".card {", "  transition: all .3s ease;", "}", "</style>"); // 24: FINDING (report)
    const svelte = lines("<script>", "  export let open;", "  export let src, alt;", "</script>", "", "{#if open}", "  <div class=\"backdrop\" on:click|self={() => (open = false)}>",
      "    <div class=\"modal\" role=\"dialog\" aria-modal=\"true\">", "      <button on:click={() => (open = false)}>Close</button>", "      <div on:click={toggle}>More</div>", // 10: FINDING
      "      <div onclick={toggle}>More</div>", // 11: FINDING (Svelte 5)
      "      <img {src} {alt} />", "      <img {src} />", // 13: FINDING
      "      <input on:paste|preventDefault />", // 14: FINDING
      "      <input on:paste|preventDefault={sanitize} />", "      <svelte:window on:click={close} />", "    </div>", "  </div>", "{/if}");
    const ng = lines("<div class=\"row\" (click)=\"select(row)\">{{ row.name }}</div>", // 1: FINDING
      "<div class=\"row\" (click)=\"select(row)\" (keyup.enter)=\"select(row)\" tabindex=\"0\">{{ row.name }}</div>", "<a (click)=\"go()\">Go</a>", // 3: FINDING
      "<a routerLink=\"/home\" (click)=\"track()\">Home</a>", "<img [src]=\"logo\">", "<img [src]=\"logo\" [attr.alt]=\"name\">", "<img [src]=\"logo\" [alt]=\"name\">"); // 5: FINDING
    const html = lines("<!DOCTYPE html>", "<html lang=\"en\">", "<head>", "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">", "<!-- Meta Pixel Code -->", "<script>",
      "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};",
      "s=b.getElementsByTagName(e)[0];var tpl='<img src=\"x\">';}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');", "fbq('init', '123');", "</script>",
      "<noscript><img height=\"1\" width=\"1\" style=\"display:none\"", "src=\"https://www.facebook.com/tr?id=123&ev=PageView&noscript=1\"", "/></noscript>", "<!-- End Meta Pixel Code -->",
      "</head>", "<body>", "<a onclick=\"openMenu()\">Menu</a>", // 17: FINDING
      "<script src=\"/app.js\"></script>Next<img src=\"chevron.svg\">", // 18: FINDING (markup again after </script>, A10)
      "<input type=\"password\" onpaste=\"return false\">", // 19: FINDING
      "<input onpaste=\"handlePaste(event)\">", "</body>", "</html>");
    all("1.37 UI checks: the syntaxes — Vue (`@click`, `:alt` / `v-bind:alt`, `@click.alt` no alt, a bare `@click.stop` vs one with a handler, `.self`, `@paste.prevent` bare vs named, a kebab component, template TEXT never read as CSS, a <script> string, the <style scoped lang=\"scss\"> block judged as a sheet), Svelte (`on:click|self`, `on:click`, `onclick`, `{alt}`, a bare `on:paste|preventDefault`, `svelte:window`), Angular (`(click)`, `(keyup.enter)`, `[attr.alt]` / `[alt]`, `routerLink`), plain HTML (the Meta Pixel's hidden <noscript> image, a <script> block's string, markup again after </script>, `onpaste=\"return false\"` vs a named handler) (got " +
      js({ vue: got(vue, "src/components/Card.vue"), svelte: got(svelte, "src/lib/Modal.svelte"), ng: got(ng, "src/app/rows/rows.component.html"), html: got(html, "public/index.html") }) + ")", {
      vue: () => js(got(vue, "src/components/Card.vue")) === js(["click-no-keyboard@2", "img-no-alt@3", "img-no-alt@6", "click-no-keyboard@8", "paste-blocked@11", "outline-removed@22", "transition-all@24"]),
      svelte: () => js(got(svelte, "src/lib/Modal.svelte")) === js(["click-no-keyboard@10", "click-no-keyboard@11", "img-no-alt@13", "paste-blocked@14"]),
      angular: () => js(got(ng, "src/app/rows/rows.component.html")) === js(["click-no-keyboard@1", "click-no-keyboard@3", "img-no-alt@5"]),
      html: () => js(got(html, "public/index.html")) === js(["click-no-keyboard@17", "img-no-alt@18", "paste-blocked@19"]),
    });
  }

  { // a `<` whose name is followed by neither a blank, `/` nor `>` starts no tag — `count <limit)` (A12): read as one, it swallowed the lines
    // below it up to the next `>`, a real tag's
    const pager = lines("export function Pager({ count, limit, go }) {", "  if (count <limit) {", "    return (", "      <div onClick={go}>next</div>", "    );", "  }", "  return null;", "}");
    all("1.37 UI checks: `count <limit)` is no tag — the div below it is read (got " + js(got(pager, "src/Pager.tsx")) + ")", { exact: () => js(got(pager, "src/Pager.tsx")) === js(["click-no-keyboard@4"]) });
  }

  { // paste-blocked in JSX: an inline cancel, one that reads the clipboard, a named handler, on a component
    const form = lines("export const Login = () => (", "  <form>", "    <input type=\"password\" onPaste={(e) => e.preventDefault()} />", // 3: FINDING
      "    <input onPaste={(e) => { e.preventDefault(); setCode(e.clipboardData.getData(\"text\").trim()); }} />", "    <input onPaste={handlePaste} />",
      "    <Input name=\"confirm\" onPaste={(e) => { e.preventDefault(); return false; }} />", // 6: FINDING
      "  </form>", ");");
    all("1.37 UI checks: paste-blocked — an inline handler that cancels the paste (any tag, a component's too) and reads no clipboard; never one that reads `clipboardData`, nor a named handler (got " + js(got(form, "src/auth/Login.tsx")) + ")", {
      exact: () => js(got(form, "src/auth/Login.tsx")) === js(["paste-blocked@3", "paste-blocked@6"]),
    });
  }

  { // outline-removed in stylesheets (the walker's events): a reset's removal, Bootstrap's replaced one, a nested extent, the
    // focus-visible split, the Firefox internals, element vs class, print, each removal value, an unclosed rule, the first line
    const reset = lines("/* a reset */", "*:focus {", "  outline: 0;", "}", "button, [type=\"button\"] { outline: none; }", "a:hover { outline: none; }", ".modal { outline: 0; }",
      "input:focus { outline: none !important; }", "select:focus { outline-style: none; }", "textarea:focus { outline-width: 0; }", "summary { outline: 2px solid transparent; }",
      "@media print {", "  a:focus { outline: none; }", "}", ".nav a:focus {", "  outline:", "    none;", "}", "button::-moz-focus-inner { outline: 0; border: 0; }",
      ":-moz-focusring { outline: 1px dotted ButtonText; }", "* { outline: none; }", ".toolbar button { outline: none; }", ".toolbar>button { outline: none; }",
      "*, ::before { outline: 0", "");
    const bootstrap = lines(".btn:focus {", "  outline: 0;", "  box-shadow: 0 0 0 .25rem rgba(13, 110, 253, .25);", "}", ".form-range {", "  &:focus {", "    outline: 0;",
      "    &::-webkit-slider-thumb { box-shadow: $form-range-thumb-focus-box-shadow; }", "  }", "}", ".btn:focus:not(:focus-visible) { outline: 0; }",
      ".page-link:focus { z-index: 3; outline: 0; }");
    const r = run(reset, "src/styles/reset.css"), bs = run(bootstrap, "scss/_forms.scss");
    all("1.37 UI checks: outline-removed in a stylesheet — a removal (`outline: none | 0`, `!important`, `outline-style: none`, `outline-width: 0`) in a `:focus` rule that declares nothing else, or on `*` / an element focusable by default, is a CANDIDATE at the declaration's first line; never a class alone, `:hover`, `transparent`, `@media print`, `::-moz-focus-inner`, a rule that never closes; Bootstrap's replaced removals (box-shadow beside it, in a nested block, `:focus:not(:focus-visible)`, z-index) are none; a reset with no focus style holds none, `:-moz-focusring` is none either (got " +
      js({ reset: r, bootstrap: bs }) + ")", {
      reset: () => js(r.findings.map((f) => f.rule + "@" + f.line)) === js(["outline-removed@3", "outline-removed@5", "outline-removed@8", "outline-removed@9", "outline-removed@10", "outline-removed@16", "outline-removed@21", "outline-removed@22", "outline-removed@23"]),
      value: () => r.findings[0].value === "*:focus { outline: 0 }" && r.findings[5].value === ".nav a:focus { outline: none }",
      noFocus: () => r.focus === false,
      bootstrap: () => js(bs.findings) === js([]) && bs.focus === true,
    });
  }

  { // the focus fact a file gives: a rule naming :focus / :focus-visible / :focus-within that styles something (nested, inherited),
    // a Tailwind focus utility (a class list, an @apply) — never a removal alone
    const cases = [["focus.css", ":focus-visible {\n  outline: 2px solid var(--ring);\n}\n", true], ["a.css", "a:focus-visible, button:focus-visible { box-shadow: 0 0 0 2px #2563eb; }\n", true],
      ["b.scss", ".field {\n  &:focus-within { border-color: $ring; }\n}\n", true], ["c.scss", ":focus-visible {\n  .icon { color: $ring; }\n}\n", true],
      ["d.css", ":focus { outline: none; }\n:focus-visible { outline: none; }\n", false], ["e.css", ".btn { @apply focus-visible:ring-2; }\n", true],
      ["f.css", ".btn:hover { color: red; }\n.btn { @apply focus:outline-none; }\n", false], ["G.tsx", "<a className=\"group-focus:underline\" />\n", true],
      ["H.tsx", "<input className=\"focus:outline-none\" />\n", false], ["I.tsx", "<div className=\"hover:bg-muted [&:focus]:x\" />\n", false]];
    const facts = cases.map(([rel, text]) => run(text, "src/" + rel).focus);
    all("1.37 UI checks: a file's focus style — a :focus / :focus-visible / :focus-within rule that styles something (a list, nested, an inner rule), a Tailwind focus-variant utility (group-focus too, in an @apply too); never a removal alone, a hover style (got " + js(facts) + ")", {
      exact: () => js(facts) === js(cases.map((c) => c[2])),
    });
  }

  { // transition-all (report): the CSS forms, the values that animate nothing or are built, reduced motion, over lines;
    // Tailwind's token; a style object, an inline style, a styled-components template
    const sheet = lines(".a { transition: all .2s; }", ".b { transition: .3s ease; }", ".c { transition: opacity .2s, all .3s; }", ".d { transition: all 0s; }",
      ".e { transition: none; }", ".f { transition: all; }", ".g { transition: var(--t); }", ".h { transition: $btn-transition; }", ".i { transition: inherit; }",
      ".j { transition-property: all; }", ".k { transition-duration: .2s; }", ".l {", "  transition:", "    opacity .2s,", "    all .3s cubic-bezier(.2, 0, 0, 1);", "}",
      "@media (prefers-reduced-motion: reduce) {", "  *, ::before { transition: all .01ms !important; }", "  .m { .n { transition: .2s; } }", "}",
      "@media (prefers-reduced-motion: no-preference) { .o { transition: all .2s; } }", ".p { @apply transition-all duration-200; }", ".transition-all { color: red; }", "");
    const tsx = lines("const Box = styled.div`", "  padding: 8px;", "  transition: all 0.2s ease-in-out;", "  &:focus {", "    outline: none;", "  }", "`;",
      "export const A = () => (", "  <div className=\"hover:transition-all\" style={{ transition: \"all .3s\" }}>", "    <span style={{ transition: \"0.3s\" }} />",
      "    <span style={{ transition: \"opacity .3s\" }} />", "    <span style={{ transition: `all ${d}s` }} />",
      "    <i className=\"my-transition-all\" />", "    <i className=\"!transition-all\" />", "    <i className=\"transition-all!\" />", "  </div>", ");");
    const html = lines("<div style=\"color: red; transition: all .3s\">x</div>", "<div style=\"transition: opacity .3s\">y</div>", "<div style=\"transition-property: all\">z</div>");
    all("1.37 UI checks: transition-all — `all`, no property (the default), a later item, `transition-property: all`, over lines (its first line), an @apply, Tailwind's token with variants / `!`, a style object, an inline style, a styled-components line; never 0s, none, no time, a variable, a global keyword, the duration longhand, inside `prefers-reduced-motion: reduce` (nested too), `my-transition-all`, a `.transition-all` selector, opacity alone; `no-preference` is judged (got " +
      js({ sheet: got(sheet, "src/app.scss"), tsx: got(tsx, "src/Box.tsx"), html: got(html, "index.html") }) + ")", {
      sheet: () => js(got(sheet, "src/app.scss")) === js(["transition-all@1", "transition-all@2", "transition-all@3", "transition-all@10", "transition-all@13", "transition-all@21", "transition-all@22"]),
      tsx: () => js(got(tsx, "src/Box.tsx")) === js(["transition-all@3", "transition-all@9", "transition-all@10", "transition-all@14", "transition-all@15"]),
      html: () => js(got(html, "index.html")) === js(["transition-all@1", "transition-all@3"]),
      level: () => run(sheet, "src/app.scss").findings.every((f) => f.rule === "transition-all"),
      cssInJs: () => !got(tsx, "src/Box.tsx").some((f) => /outline/.test(f)),
    });
  }

  { // silencing: one inline comment, any syntax of the file, on the finding's line or the one above
    const jsx = lines("export const A = () => (", "  <>", "    {/* ui-check-off: img-no-alt */}", "    <img src=\"/spacer.gif\" />", // 4: silenced (above)
      "    <img src=\"/b.png\" /> {/* ui-check-off: click-no-keyboard, img-no-alt */}", // 5: silenced (same line)
      "    {/* ui-check-off: img-no-alt */}", "", "    <img src=\"/c.png\" />", // 8: two lines up — not
      "    {/* ui-check-off: click-no-keyboard */}", "    <img src=\"/d.png\" />", // 10: another rule — not
      "    <p title=\"ui-check-off: img-no-alt\" />", "    <img src=\"/e.png\" />", // 12: in a string — not
      "    {/* ui-check-off: */}", "    <img src=\"/f.png\" />", // 14: no id — not
      "  </>", ");");
    const html = lines("<!-- ui-check-off: zoom-disabled -->", "<meta name=\"viewport\" content=\"maximum-scale=1\">");
    const css = lines("/* ui-check-off: outline-removed */", "*:focus { outline: 0; }", ".x { transition: all .2s; } // ui-check-off: transition-all");
    all("1.37 UI checks: `ui-check-off: <id>` in a comment (JSX `{/* */}`, HTML `<!-- -->`, CSS `/* */`, `//`) silences that rule on its line or the line below it — never two lines down, another rule, a string's text, no id; a silenced finding is kept with `silenced` (got " +
      js({ jsx: got(jsx, "src/A.tsx"), html: got(html, "index.html"), css: got(css, "src/x.scss") }) + ")", {
      jsx: () => js(got(jsx, "src/A.tsx")) === js(["~img-no-alt@4", "~img-no-alt@5", "img-no-alt@8", "img-no-alt@10", "img-no-alt@12", "img-no-alt@14"]),
      html: () => js(got(html, "index.html")) === js(["~zoom-disabled@2"]),
      css: () => js(got(css, "src/x.scss")) === js(["~outline-removed@2", "~transition-all@3"]),
    });
  }

  { // the reader's bounds: an unclosed tag is not judged, nor what starts inside its read; the reader goes on below it; a long
    // tag inside the bounds is judged; DS_CHECK_PER_FILE findings a file
    const filler = (n) => Array.from({ length: n }, (_, i) => "      a" + i + ",");
    const unclosed = lines("export const A = () => (", "  <div onClick={() => go(", ...filler(4), "    <img src=\"inside.png\" />", ...filler(36), "  <img src=\"after.png\" />", ");");
    const open = lines("export const B = () => <img src=\"x.png\"", ...Array.from({ length: 40 }, (_, i) => "  data-k" + i + "=\"v\""));
    const tall = lines("export const C = () => (", "  <img", ...Array.from({ length: 24 }, (_, i) => "    data-k" + i + "=\"v\""), "  />", ");");
    const wide = lines("export const D = () => <img", "  data-a=\"" + "w-4 ".repeat(375) + "\"", "  data-b=\"" + "h-4 ".repeat(375) + "\"", "/>;");
    const many = lines(...Array.from({ length: 201 }, () => "<div onclick=\"go()\">x</div>"));
    all("1.37 UI checks: the tag reader's bounds — a tag with no `>` within 30 lines / 4,000 characters is not judged, nor is a tag that starts in the lines it read, and the reader goes on below them; a 26-line tag and a 3,000-character one (over lines: a line is read up to 2,000) are judged; a file keeps 200 findings (got " +
      js({ unclosed: got(unclosed, "src/A.tsx"), open: got(open, "src/B.tsx"), tall: got(tall, "src/C.tsx"), wide: got(wide, "src/D.tsx"), many: got(many, "x.html").length }) + ")", {
      unclosed: () => js(got(unclosed, "src/A.tsx")) === js(["img-no-alt@44"]),
      open: () => js(got(open, "src/B.tsx")) === js([]),
      tall: () => js(got(tall, "src/C.tsx")) === js(["img-no-alt@2"]),
      wide: () => js(got(wide, "src/D.tsx")) === js(["img-no-alt@1"]),
      many: () => got(many, "x.html").length === 200,
    });
  }

  { // the readers' finer shapes: a quoted value that holds a `>` over lines, a brace in a string or a block inside a handler, a
    // capitalised IMG (a component), :focus-within, Tailwind's other removals and variants, an easing with no property, styled-jsx
    const jsx = lines("export const Toolbar = ({ open, close, inputRef, src }) => (", "  <>", "    <div", "      title=\"first", "      second > third\"", "      onClick={go}", "    >", // 3: FINDING
      "      x", "    </div>", "    <img src={src} title={\"press { to zoom\"} alt=\"zoom\" />",
      "    <div onClick={() => { if (open) { close(); } inputRef.current?.focus(); }}>otp</div>", "    <IMG src=\"/x.png\" />",
      "    <input className=\"focus:outline-0 rounded\" />", // 13: a candidate
      "    <input className=\"focus-visible:outline-none border\" />", // 14: a candidate
      "    <span className=\"hover:outline-none\" />", "    <style jsx>{`", "      button:focus { outline: none; }", "      .q { transition: .2s cubic-bezier(.2, 0, 0, 1); }", // 17, 18
      "      .field:focus-within { outline: none; }", "    `}</style>", "  </>", ");");
    all("1.37 UI checks: a quoted value with a `>` read over lines keeps the tag open (its onClick judged); a `{` in a string and a block inside a handler never cut a brace value (the alt, the focus call after it are read); `<IMG>` is a component; `focus:outline-0`, `focus-visible:outline-none` are candidates, `hover:outline-none` none; a styled-jsx block is a sheet: `button:focus` a candidate, an easing with no property is transition-all, `:focus-within` is never the focus a removal is judged on (got " +
      js(got(jsx, "src/Toolbar.tsx")) + ")", {
      exact: () => js(got(jsx, "src/Toolbar.tsx")) === js(["click-no-keyboard@3", "outline-removed@13", "outline-removed@14", "outline-removed@17", "transition-all@18"]),
    });
  }
};
