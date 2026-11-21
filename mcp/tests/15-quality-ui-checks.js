"use strict";
// The UI checks (1.37) — engine/ui-checks.js: zoom-disabled, img-no-alt, outline-removed, click-no-keyboard, paste-blocked (warn)
// and transition-all (report) over one view / style file (uiChecksOf, on real-shaped files of each syntax), the tag reader,
// the stylesheet's structure through styleTokens' events, the inline `ui-check-off:` comment; the feature report's `uiChecks`
// (the focus pass over the project's stylesheets and its bounds, the token files, the order and the cap), spec_finish's warning
// with and without a registry, the hostile inputs' cost as ratios.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, rpc, payload, remeasure, S, tmp, require, __dirname }) => {
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
      "      <div className=\"tile\" onClick={() => setOpen(true)}>Open</div>", // 9: FINDING (text, no control in its body)
      "        <img src={items[0].src} />", // 10: FINDING
      "        <img src={a > b ? x : y} onLoad={() => go()} alt=\"\" />", // 11: braces hold the `>` (A4)
      "        <img src=\"/logo.svg\" alt=\"Acme\" />", "        <img src=\"/x.png\" aria-label=\"chart\" />", "        <img src=\"/x.png\" aria-labelledby=\"cap\" />",
      "        <img src=\"/x.png\" role=\"presentation\" />", "        <img src=\"/x.png\" role=\"img\" />", // 16: FINDING (a role that is no decoration)
      "        <img src=\"/x.png\" aria-hidden=\"true\" />", "        <img src=\"/x.png\" aria-hidden={false} />", // 18: FINDING
      "        <img src=\"/x.png\" hidden />", "        <img src=\"/x.png\" style={{ display: \"none\" }} />", "        <img src=\"/x.png\" style={{ display: \"block\" }} />", // 21: FINDING
      "        <img src=\"/x.png\" data-alt=\"x\" />", // 22: FINDING
      "        <img {...imgProps} />", "        <Image src=\"/x.png\" />", "        <img-viewer src=\"/x.png\" />",
      "        <div title=\"1 > 0\" onClick={go}>more</div>", // 26: FINDING (the quotes hold the `>`, A3)
      "        <div onClick={go} role=\"button\" tabIndex={0} onKeyDown={key}>ok</div>", "        <div onClick={go} tabIndex={-1}>ok</div>", "        <div onClick={go} onKeyDown={key}>ok</div>", // 29: FINDING (a key handler alone: never focused)
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
      "      <p>end</p>", "    </>", "  );", "}");
    const g = got(jsx, "src/components/Gallery.tsx");
    all("1.37 UI checks: img-no-alt / click-no-keyboard in JSX — every alt form (aria-label / -labelledby, role presentation, aria-hidden, hidden, own display:none, a spread) and every click excuse (tabIndex, a composite item's role, aria-hidden, inert, a spread, self-closing, empty, a focus-forwarding / target / stopPropagation handler, focusable by default: button, a href, summary, label) excuse — a key handler alone does not; `role=\"img\"`, `aria-hidden={false}`, `display: block`, `data-alt`, `<a>` without href do not; components, custom elements, members and a nested tag are not judged; a string's tag, a comparison, a `>` in quotes or braces never derail the reader; a multi-line tag is judged at its first line (got " + js(g) + ")", {
      exact: () => js(g) === js(["click-no-keyboard@9", "img-no-alt@10", "img-no-alt@16", "img-no-alt@18", "img-no-alt@21", "img-no-alt@22", "click-no-keyboard@26", "click-no-keyboard@29", "click-no-keyboard@37",
        "click-no-keyboard@46", "click-no-keyboard@59"]),
    });
  }

  { // the other syntaxes: a Vue SFC (@click, :alt, @paste.prevent, a <style scoped lang="scss"> judged as a sheet, a string in
    // its script), a Svelte component (on:click|self, a bare on:paste|preventDefault, {alt}), an Angular template ((click),
    // (keyup.enter), [attr.alt], routerLink), plain HTML with the Meta Pixel's <noscript> image and a <script> block
    const vue = lines("<template>", "  <div class=\"card\" @click=\"open = true\">Open the card</div>", // 2: FINDING
      "    <img :src=\"cover\" />", // 3: FINDING
      "    <img :src=\"cover\" :alt=\"title\" />", "    <img :src=\"cover\" v-bind:alt=\"title\" />", "    <img :src=\"cover\" @click.alt=\"zoom\" />", // 6: FINDING (a key modifier is no alt)
      "    <span @click.stop>stop only</span>", "    <span @click.stop=\"toggle\">x</span>", // 8: FINDING (a handler)
      "    <div @click.self=\"close\">backdrop</div>", "    <li v-on:click=\"select(item)\" @keydown.enter=\"select(item)\" tabindex=\"0\">x</li>",
      "    <input @paste.prevent />", // 11: FINDING
      "    <input @paste.prevent=\"sanitize\" />", "    <p>Write outline: none in your CSS and transition: all if you must</p>", "    <router-link to=\"/x\" @click=\"go\">x</router-link>",
      "  <p>end</p>", "</template>", "<script setup>", "const html = '<img src=\"x.png\">'", "const style = { transition: 'opacity .3s' }", "</script>",
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

  { // click-no-keyboard by its body (review 1 of 1.37, Laravel's starter kits): a click candidate is judged only when its body —
    // read to its matching close tag within 30 lines / 4,000 characters — holds content a user reads (text, an expression that is
    // no slot outlet) and nothing that is or may render a control (focusable by default, a component / custom element, <slot>,
    // `{children}`, `{@render}`, a Blade `{{ $slot }}`); Alpine's `.outside` / `.away` / `.window` / `.document` are no click on the
    // element; a role or a key handler alone reaches nothing (D1) — a composite item's role, presentation / none do
    const alpine = lines("<div x-data=\"{ open: false }\">", "    <button @click=\"open = ! open\">Toggle</button>", "    <div x-show=\"open\" @click.outside=\"open = false\">Contents...</div>",
      "    <div x-show=\"open\" @click.away=\"open = false\">Contents...</div>", "    <div x-show=\"open\" x-on:click.outside=\"open = false\">Contents...</div>",
      "    <div x-on:click.window=\"track($event)\">Page</div>", "    <div x-on:click.document=\"track($event)\">Page</div>", "    <div @click=\"open = ! open\">Contents...</div>", // 8: FINDING
      "</div>");
    const breeze = lines("<div class=\"relative\" x-data=\"{ open: false }\" @click.outside=\"open = false\" @close.stop=\"open = false\">", "    <div @click=\"open = ! open\">", "        {{ $trigger }}", "    </div>", "",
      "    <div x-show=\"open\" class=\"absolute z-50 mt-2 rounded-md shadow-lg\" style=\"display: none;\" @click=\"open = false\">", "        <div class=\"rounded-md ring-1 ring-black ring-opacity-5\">",
      "            {{ $content }}", "        </div>", "    </div>", "</div>", "<div x-show=\"show\" class=\"fixed inset-0 transform transition-all\" x-on:click=\"show = false\" x-transition:enter=\"ease-out duration-300\">",
      "    <div class=\"absolute inset-0 bg-gray-500 opacity-75\"></div>", "</div>", "<div @click=\"open = true\">{{ __('Profile') }}</div>"); // 15: FINDING (an echo that is no bare variable)
    const vue = lines("<template>", "  <div class=\"relative\">", "    <div @click=\"open = !open\">", "      <slot name=\"trigger\" />", "    </div>", "    <div @click=\"open = !open\">",
      "      <button type=\"button\">Menu</button>", "    </div>", "    <div @click=\"toggle\">More <slot /></div>", "    <div @click=\"pick\">{{ item.name }}</div>", // 10: FINDING
      "    <div class=\"fixed inset-0\" @click=\"close\">", "      <div class=\"absolute inset-0 bg-gray-500 opacity-75\" />", "    </div>", "  </div>", "</template>");
    const jsx = lines("export const Trigger = ({ children, toggle, open, pick, label, save, props }) => (", "  <>", "    <div onClick={toggle}>", "      {children}", "    </div>",
      "    <div onClick={toggle}>{props.children}</div>", "    <div onClick={open}>Open <ChevronIcon /></div>", "    <div onClick={pick}>{label}</div>", // 8: FINDING
      "    <div onClick={save}>Save</div>", // 9: FINDING
      "    <div onClick={toggle}>{/* an icon */}<svg viewBox=\"0 0 24 24\"><path d=\"M0 0h24v24H0z\" /></svg></div>", "    <div onClick={toggle}>", "      <div onClick={pick}>", // 12: FINDING (and 11, its text)
      "        Pick", "      </div>", "    </div>", "    <div onClick={toggle}>", ...Array.from({ length: 31 }, (_, i) => "      line " + i), "    </div>", // 16: past 30 lines — not judged, counted
      "    <div onClick={toggle}>", "      " + "w".repeat(2100), "    </div>", // a cut line — not judged
      "    <div role=\"button\" onClick={save}>Save</div>", "    <div role=\"switch\" onClick={toggle}>On</div>", // 52, 53: FINDING (a widget role alone)
      ...["option", "menuitem", "menuitemcheckbox", "menuitemradio", "treeitem", "gridcell", "row", "tab", "columnheader", "rowheader", "presentation", "none"].map((r) => "    <div role=\"" + r + "\" onClick={pick}>" + r + "</div>"),
      // (the mutation pass's fixtures: an outlet beside text, a self-closing element of the candidate's name, an empty candidate
      // after a judged sibling, a body past 4,000 characters within 30 lines, a tag of more than 100 attributes in a body)
      "    <div onClick={toggle}>Open {children}</div>", "    <div onClick={save}>Save <div className=\"sep\" /></div>", // 67: FINDING
      "    <div onClick={toggle}>", "      <div onClick={pick}>Pick</div>", "      <div onClick={toggle}></div>", "    </div>", // 68, 69: FINDING
      "    <div onClick={save}>", ...Array.from({ length: 3 }, () => "      " + "x".repeat(1500)), "    </div>", // 72: past 4,000 characters — counted
      "    <div onClick={save}>Pick <span" + Array.from({ length: 101 }, (_, i) => " data-k" + i + "=\"v\"").join("") + " /></div>",
      "  </>", ");");
    const svelte = lines("<div onclick={toggle}>{@render trigger()}</div>", "<div on:click={toggle}>{#if open}{/if}</div>", "<div on:click={toggle}>{count}</div>", // 3: FINDING
      "<div on:click={toggle}>{$count}</div>"); // 4: FINDING (a store's value: `$` names a bare echo's outlet in `{{ }}` alone)
    const ng = lines("<div (click)=\"toggle()\">Pick <ng-content></ng-content></div>", "<div (click)=\"toggle()\">{{ row.name }}</div>"); // 2: FINDING
    const html = lines("<div onclick=\"go()\"><p>a<p>b</div>", "<div onclick=\"go()\">x</span></div>", "<div onclick=\"go()\">x<!-- the end --></div>"); // 1, 2, 3: FINDING
    const r = run(jsx, "src/components/Trigger.tsx");
    const G = { alpine: got(alpine, "resources/views/components/menu.blade.php"), breeze: got(breeze, "resources/views/components/dropdown.blade.php").filter((x) => x.startsWith("click")), vue: got(vue, "src/components/Dropdown.vue"),
      jsx: r.findings.map((f) => f.rule + "@" + f.line), svelte: got(svelte, "src/lib/Menu.svelte"), ng: got(ng, "src/app/menu/menu.component.html"), html: got(html, "public/menu.html") };
    all("1.37 UI checks: click-no-keyboard by the element's body — text or a non-outlet expression with no control is judged; a slot / {children} / {@render} / {{ $slot }} / <ng-content> / a component / a button, an empty overlay layer, an icon, a body past 30 lines (counted) or a cut line is not; Alpine's .outside / .away / .window / .document are no click on the element; a widget role alone is judged, a composite item's role / presentation / none is not; nested candidates both judged; a close tag pops to its own name (got " +
      js(Object.assign({ cut: r.cut }, G)) + ")", {
      alpine: () => js(G.alpine) === js(["click-no-keyboard@8"]),
      breeze: () => js(G.breeze) === js(["click-no-keyboard@15"]),
      vue: () => js(G.vue) === js(["click-no-keyboard@10"]),
      jsx: () => js(G.jsx) === js(["click-no-keyboard@8", "click-no-keyboard@9", "click-no-keyboard@12", "click-no-keyboard@11", "click-no-keyboard@52", "click-no-keyboard@53",
        "click-no-keyboard@67", "click-no-keyboard@69", "click-no-keyboard@68"]),
      counted: () => js(r.cut) === js({ lines: 1, tags: 2 }),
      svelte: () => js(G.svelte) === js(["click-no-keyboard@3", "click-no-keyboard@4"]),
      ng: () => js(G.ng) === js(["click-no-keyboard@2"]),
      html: () => js(G.html) === js(["click-no-keyboard@1", "click-no-keyboard@2", "click-no-keyboard@3"]),
    });
  }

  { // a spread of attributes is never judged (ITEM_1's M30–M37, review 1 of 1.37): `{...props}`, Svelte's `{...$$restProps}`, a
    // template engine's `{{ $attributes }}`, and a binding with no argument — Vue's `v-bind="$attrs"` (an inheritAttrs: false
    // wrapper), Alpine's `x-bind="obj"`; a binding WITH one names its attribute (`v-bind:alt`) or not (`v-bind:src`, `x-bind:src`)
    const vue = lines("<template>", "  <figure class=\"frame\">", "    <img :src=\"src\" v-bind=\"$attrs\" loading=\"lazy\" />", "    <img v-bind:src=\"src\" />", // 4: FINDING
      "    <img :src=\"src\" v-bind:alt=\"title\" />", "    <div v-bind=\"$attrs\" @click=\"open = true\">Open</div>", "  </figure>", "</template>");
    const alpine = lines("<img x-bind=\"imageAttrs\" src=\"/a.png\">", "<div x-bind=\"trigger\" @click=\"open = !open\">Open</div>", "<img x-bind:src=\"logo\">", // 3: FINDING
      "<img {{ $attributes }} src=\"/b.png\">");
    const jsx = lines("export const Img = (props) => <img {...props} />;", "export const Box = ({ go, ...rest }) => <div {...rest} onClick={go}>Box</div>;");
    const svelte = lines("<img {...$$restProps} />", "<div {...$$restProps} on:click={go}>x</div>");
    const S2 = { vue: got(vue, "src/components/BaseImage.vue"), alpine: got(alpine, "resources/views/components/img.blade.php"), jsx: got(jsx, "src/Img.tsx"), svelte: got(svelte, "src/lib/Img.svelte") };
    all("1.37 UI checks: a spread is never judged — `{...props}`, `{...$$restProps}`, `{{ $attributes }}`, Vue's `v-bind=\"$attrs\"`, Alpine's `x-bind=\"obj\"`; `v-bind:src` / `x-bind:src` alone are judged, `v-bind:alt` names the alt (got " + js(S2) + ")", {
      vue: () => js(S2.vue) === js(["img-no-alt@4"]),
      alpine: () => js(S2.alpine) === js(["img-no-alt@3"]),
      others: () => js(S2.jsx) === js([]) && js(S2.svelte) === js([]),
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
      // (an arbitrary variant holding `focus` between its brackets is a focus variant: review 1 of 1.37, S4's one predicate)
      ["H.tsx", "<input className=\"focus:outline-none\" />\n", false], ["I.tsx", "<div className=\"hover:bg-muted [&:focus]:x\" />\n", true],
      // (S4: Headless UI's and Tailwind 4's focus variants are focus variants; a `not` part negates one; `focused` is no part)
      ["Q.tsx", "<button className=\"focus:outline-none data-[focus]:outline-1 data-[focus]:outline-white\" />\n", true], ["R.tsx", "<button className=\"focus:not-data-focus:outline-none data-focus:outline\" />\n", true],
      ["S.tsx", "<button className=\"focus:outline-hidden ui-focus-visible:ring-2\" />\n", true], ["T.tsx", "<label className=\"has-focus-visible:ring-2\" />\n", true],
      ["U.tsx", "<a className=\"group-focus/item:underline\" />\n", true], ["V.tsx", "<a className=\"not-focus:ring-2 data-[state=focused]:ring-2\" />\n", false],
      // (review 1 of 1.37, S3: a declaration or a utility that draws nothing — `none`, a zero, `transparent` — is no focus style)
      ["j.css", ".btn:focus { outline: none; box-shadow: none; }\n", false], ["k.css", ".y:focus { outline: 2px solid transparent; }\n", false],
      ["l.css", ".z:focus { box-shadow: 0 0 0 2px transparent, 0 0 0 4px #2563eb; }\n", true], ["m.css", ".w:focus { border: 0 none; box-shadow: none !important; }\n", false],
      ["N.tsx", "<input className=\"border-0 focus:ring-0 focus:outline-none\" />\n", false], ["O.tsx", "<input className=\"focus:shadow-none focus:ring-transparent\" />\n", false],
      ["P.tsx", "<input className=\"focus:outline-none focus:ring-2\" />\n", true],
      // (review 2 of 1.37, S3's remainder: an `outline-offset` draws nothing — Tailwind v3's compiled `outline-none` is no focus
      // style, a drawing outline beside an offset is; an `@apply` in a focus rule is read by its bare utilities — a removal, one
      // that draws nothing, one that draws; a utility with a variant draws, as before)
      ["W.css", ".focus\\:outline-none:focus { outline: 2px solid transparent; outline-offset: 2px; }\n", false], ["X.css", ":focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }\n", true],
      ["Y.css", "*:focus {\n  @apply outline-none;\n}\n", false], ["Z.css", "button:focus { @apply outline-none ring-2 ring-blue-500; }\n", true],
      ["aa.css", "button:focus { @apply ring-0 shadow-none !important; }\n", false], ["ab.css", "button:focus { @apply hover:ring-0; }\n", true],
      // (review 3 of 1.37: a relational variant's bracket spelling is a focus variant, as its dash spelling — the focus-style
      // side kept as it was)
      ["AC.tsx", "<div className=\"has-[:focus-visible]:ring-2\" />\n", true], ["AD.tsx", "<span className=\"group-[:focus]:ring-2\" />\n", true]];
    const facts = cases.map(([rel, text]) => run(text, "src/" + rel).focus);
    const removed = { bs: got(".form-control:focus,\n.btn:focus {\n  outline: none;\n  box-shadow: none;\n}\n", "src/styles/overrides.css"),
      important: got("*:focus {\n  outline: none !important;\n  box-shadow: none !important;\n}\n", "src/styles/overrides.scss"), transparent: got(".close:focus { outline: 2px solid transparent; }\n", "src/close.css"),
      // (review 2 of 1.37: an @apply's removal in a focus rule is a candidate while nothing else there draws — `!important`, a
      // leading `!` read; a removal beside an offset alone too; an @apply outside a focus rule, `@media print`: none, as before)
      apply: got(lines("*:focus {", "  @apply outline-none;", "}", "button:focus { @apply outline-none ring-2; }", "a:focus { @apply outline-0 ring-0 !important; }",
        "input:focus { @apply !outline-hidden; }", "select:focus { outline: none; @apply hover:outline-none; }", ".x:focus { outline: none; outline-offset: 2px; }", "button { @apply outline-none; }",
        "@media print { textarea:focus { @apply outline-none; } }", ".btn { @apply focus:outline-none; }"), "src/styles/globals.css"),
      // (S4: a removal under a variant of the element's own focus is a candidate, under a negated one it is not; review 2 of 1.37:
      // under a RELATIONAL one — group / peer / has / in, focus-within — it is a doubt, as `:focus-within` in a sheet; 9–15 the
      // shapes both earlier rules judged and keep; review 3 of 1.37: the variants cut at `:` outside brackets — 15–17 a named
      // variant's arbitrary value read whole, relational: a doubt; 18–21 kept — an arbitrary `[&…]` by its pieces, a token the
      // split cut inside its brackets at a quote read as before)
      variants: got(lines("<i className=\"data-[focus]:outline-none\" />", "<i className=\"focus-within:outline-hidden\" />", "<i className=\"not-focus:outline-none\" />", "<i className=\"hover:outline-none\" />",
        "<i className=\"group-focus:outline-none peer-focus-visible:outline-none\" />", "<i className=\"has-focus:outline-none in-focus:outline-0\" />", "<i className=\"group-focus-within:outline-none group-data-[focus]:outline-none\" />",
        "<i className=\"data-focus:outline-hidden\" />", "<i className=\"ui-focus-visible:outline-none\" />", "<i className=\"data-focus-visible:outline-none\" />", "<i className=\"focus:outline-none\" />",
        "<i className=\"focus-visible:outline-0\" />", "<i className=\"md:group-hover:focus:outline-none\" />", "<i className=\"[&:focus]:outline-none\" />",
        "<i className=\"has-[:focus-visible]:outline-none\" />", "<i className=\"group-[:focus]:outline-none peer-[:focus]:outline-none\" />", "<i className=\"has-[:focus]:outline-none in-[:focus]:outline-0\" />",
        "<i className=\"[&_*:focus]:outline-none\" />", "<i className=\"dark:focus:outline-none\" />", "<i className=\"md:focus-visible:outline-none\" />",
        "<i className=\"[&[data-state='open']:focus]:outline-none\" />"), "src/V.tsx") };
    all("1.37 UI checks: a file's focus style — a :focus / :focus-visible / :focus-within rule that styles something (a list, nested, an inner rule), a Tailwind focus-variant utility (group-focus too, in an @apply too); never a removal alone, a hover style, a declaration or utility that draws nothing (`box-shadow: none`, a transparent outline, `focus:ring-0`, `focus:shadow-none`); Bootstrap's `outline: none; box-shadow: none` override is a candidate (got " + js({ facts, removed }) + ")", {
      exact: () => js(facts) === js(cases.map((c) => c[2])),
      candidates: () => js(removed.bs) === js(["outline-removed@3"]) && js(removed.important) === js(["outline-removed@2"]) && js(removed.transparent) === js([]),
      variants: () => js(removed.variants) === js(["outline-removed@1", ...[8, 9, 10, 11, 12, 13, 14, 18, 19, 20, 21].map((n) => "outline-removed@" + n)]),
      apply: () => js(removed.apply) === js(["outline-removed@2", "outline-removed@5", "outline-removed@6", "outline-removed@8", "outline-removed@11"]),
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

  { // 1.38.0 F0c: font-size-viewport (warn — WCAG 1.4.4, failure F94): text sized in viewport units ALONE does not grow when the
    // page is zoomed. F94's note — "if media queries were used to adjust the size of text … it may not be a failure" — is held
    // by three narrowings (CRIT_3 must-fix 1–3): outside a stylesheet only an element's OWN `style` attribute is read (never a
    // free `fontSize:` line: CSS-in-JS, `sx`, `css()` nest their media queries where no line reader sees them); a stylesheet's
    // viewport-only size is judged only when the FILE declares no font size inside a conditional block (`@media`, `@container`,
    // `@supports`, a Sass `@include`, a nested `@media`); a bare Tailwind `text-[…vw]` only when its file's class lists (review 1
    // of 1.38: its line's, before) hold no variant `text-` utility. The real shapes are CRIT_3's (its probe's shapes/ folder).
    const PLAIN = lines(".hero h1 { font-size: 6vw; }", "@media (min-width: 900px) { .hero h1 { font-size: 4rem; } }");
    const NESTING = lines(".hero h1 {", "  font-size: 6vw;", "  @media (width >= 48rem) {", "    font-size: 3rem;", "  }", "}");
    const SASS = lines(".hero-title {", "  font-size: 6vw;", "  @include media-breakpoint-up(md) {", "    font-size: 3rem;", "  }", "}");
    const VANILLA = lines("import { style } from \"@vanilla-extract/css\";", "export const title = style({", "  fontSize: \"8vw\",",
      "  \"@media\": { \"screen and (min-width: 768px)\": { fontSize: \"4rem\" } },", "});");
    const EMOTION = lines("const title = css({", "  fontSize: '6vw',", "  '@media (min-width: 768px)': { fontSize: '3rem' },", "});",
      "export const Hero = () => <h1 css={title}>Hello</h1>;");
    const MUI = lines("export function Hero() {", "  return (", "    <Typography", "      sx={(theme) => ({", "        fontSize: \"7vw\",",
      "        [theme.breakpoints.up(\"md\")]: { fontSize: \"3rem\" },", "      })}", "    >", "      Ship faster", "    </Typography>", "  );", "}");
    const TW = lines("export const A = () => <h1 className=\"text-[6vw] font-bold md:text-6xl\">Big</h1>;", // 1: a variant text- — silent
      "export const B = () => <h1 className=\"text-[5vw] sm:text-[1.2vw]\">Big</h1>;", // 2: silent (R16, flipped)
      "export const B2 = () => <h1 className=\"sm:text-[1.2vw] text-[5vw]\">Big</h1>;", // 3: silent (the other order)
      "export const C = () => <p className=\"text-[5vw]\">404</p>;", // 4: FINDING (a lone text-[5vw])
      "export const D = () => <h1 style={{ fontSize: \"5vw\" }}>Inline</h1>;", // 5: FINDING (the element's own style)
      "export const E = () => <h1 className=\"sm:text-[5vw]\">x</h1>;", // 6: a variant one — never judged
      "export const F1 = () => <i className=\"text-[length:5vw]\" />;", // 7: FINDING (a length: hint)
      "export const F2 = () => <i className=\"text-[4dvw]/7\" />;", // 8: FINDING (a /line-height)
      "export const F3 = () => <i className=\"!text-[3vmax]\" />;", // 9: FINDING
      "export const F4 = () => <i className=\"text-[2vw]!\" />;", // 10: FINDING
      "export const G = () => <i className=\"text-[2rem] text-[5vw] hover:text-red-500\" />;", // 11: silent (a variant text-)
      "export const H = () => <i className=\"text-[0] text-[5px] text-[var(--h)] text-[calc(1vw_+_1rem)] text-[vw]\" />;", // 12: nothing viewport
      "export const I = () => <Heading style={{ fontSize: \"5vw\" }} />;", // 13: a component's style prop — silent
      "export const J = () => <h1 {...p} style={{ fontSize: \"5vw\" }} />;", // 14: a spread — silent
      "export const K = () => <h1 style={{ fontSize: \"5vw\", padding: \"1rem\" }} />;", // 15: FINDING (read to its quote)
      "export const L = () => <h1 style={{ fontSize: \"1rem\", width: \"5vw\" }} />;", // 16: silent (another property's vw)
      "export const M = () => <h1 style={{ fontSize: { xs: \"8vw\", md: \"3rem\" } }} />;", // 17: silent (an object value)
      "export const N = () => <h1 style={{ fontSize: big ? \"5vw\" : \"2rem\" }} />;", // 18: silent (no one literal)
      "export const O = () => <p style={{ fontSize: \"5vmin\" }} />;", // 19: FINDING (vmin)
      "const Box = styled.h1`", "  font-size: 5vw;", "`;", // 20-22: a CSS-in-JS template line — silent
      "export const Q = () => <i className=\"text-[5vw] md:text-6xl\" />;"); // 23: silent
    // (review 1 of 1.38: the bare sizes are decided per FILE — TW's variant lines drop every one of its bare sizes, its inline
    // styles stand; the same bare sizes in a file of no variant text- utility warn, the first viewport one a line)
    const TW_LONE = lines("export const C = () => <p className=\"text-[5vw]\">404</p>;", // 1: FINDING
      "export const F1 = () => <i className=\"text-[length:5vw]\" />;", "export const F2 = () => <i className=\"text-[4dvw]/7\" />;", // 2, 3: FINDINGS
      "export const F3 = () => <i className=\"!text-[3vmax]\" />;", "export const F4 = () => <i className=\"text-[2vw]!\" />;", // 4, 5: FINDINGS
      "export const H = () => <i className=\"text-[0] text-[5px] text-[var(--h)] text-[calc(1vw_+_1rem)] text-[vw]\" />;", // 6: nothing viewport
      "export const G = () => <i className=\"text-[2rem] text-[5vw] text-red-500\" />;"); // 7: FINDING (a colour with no variant is none)
    const VUE = lines("<template>", "  <h1 style=\"font-size: 5vw\">a</h1>", "  <h2 :style=\"{ 'font-size': '5vw' }\">b</h2>", "  <h3 :style=\"{ fontSize: size }\">c</h3>",
      "  <p style=\"color: red; font-size:4vw !important\">d</p>", "  <p style=\"font-size: clamp(1rem, 0.5rem + 2vw, 2.5rem)\">e</p>", "</template>");
    const SVELTE = lines("<h1 style=\"font-size: 8vw\">Hello</h1>", "<style>", "  .lead { font-size: 3vw; }", "</style>");
    const BLADE = lines("<h1 style=\"font-size:4vw\">{{ $title }}</h1>");
    // a stylesheet's values: numbers, viewport lengths, calc / clamp / min / max and arithmetic only — one a viewport length
    const VALUES = lines(":root { font-size: calc(1vw + 1vh + .5vmin); }", // 1: FINDING
      ".a { font-size: 0; }", ".b { font-size: calc(1.375rem + 1.5vw); }", ".c { font-size: calc(12px + 1vw); }", ".d { font-size: max(1em, 4vw); }",
      ".e { font-size: calc(var(--s) * 1vw); }", ".f { font-size: math.div(16, 375) * 100vw; }", ".g { font: 5vw/1 sans-serif; }",
      ".h { --font-size-fluid-3: clamp(2rem, 9vw, 3.5rem); }", // 2-9: silent
      ".i { font-size: 5vw !important; }", ".j { font-size: 4dvw; }", ".k {", "  font-size:", "    clamp(2vw, 3svw, 4lvh);", "}", // 10, 11, 13: FINDINGS
      ".l { font-size: 5VW; }", "@layer base { h1 { font-size: 5vw; } }", // 16, 17: FINDINGS (a layer is no condition)
      ".m { font-size: 5vw !importantly; }", ".n { font-size: vw; }", ".o { font-size: 5 vw; }", // 18-20: silent
      // (the mutation pass: a function outside calc / clamp / min / max is a doubt; a custom property is never a font size)
      ".p { font-size: round(5vw, 1vw); }", ".q { --font-size-hero: 8vw; }"); // 21, 22: silent
    const COND = { // one conditional font size anywhere in the file: every viewport-only size of the file is a doubt
      below: lines("h1 { font-size: 5vw; }", "@media (min-width: 60rem) { h2 { font-size: 2rem; } }"),
      above: lines("@supports (font-size: 1cqi) { h2 { font-size: 2rem; } }", "h1 { font-size: 5vw; }"),
      container: lines("h1 { font-size: 5vw; }", "@container (min-width: 30rem) { h1 { font-size: 3rem; } }"),
      nestedDeep: lines("h1 { font-size: 5vw; }", "@media (min-width: 60rem) { .a { .b { font-size: 2rem; } } }"),
      shorthand: lines("h1 { font-size: 5vw; }", "@media (min-width: 60rem) { h1 { font: 2rem/1 serif; } }"),
      inside: lines("@media (min-width: 60rem) { h1 { font-size: 3vw; } }"),
      applyCond: lines("h1 { @apply text-[5vw]; }", "@media (min-width: 60rem) { h1 { @apply text-6xl; } }"),
      applyIn: lines("@media (min-width: 60rem) { h1 { @apply text-[4vw]; } }"),
      // (a block nested past DS_BLOCK_DEPTH is not read: what it holds may be a conditional size — a doubt)
      deep: lines("h1 { font-size: 5vw; }", ...Array.from({ length: 65 }, () => ".w {"), "x: y;", ...Array.from({ length: 65 }, () => "}")),
    };
    const NOCOND = { // what is no condition: a layer, an at-rule block that sizes no text, an @apply alone
      layerOnly: lines("@layer base { h1 { font-size: 5vw; } }", "@layer components { h2 { font-size: 2rem; } }"),
      mediaOther: lines("h1 { font-size: 5vw; }", "@media (min-width: 60rem) { h1 { color: red; } }"),
      shallow: lines("h1 { font-size: 5vw; }", ...Array.from({ length: 63 }, () => ".w {"), "x: y;", ...Array.from({ length: 63 }, () => "}")),
      apply: lines("h1 { @apply text-[5vw] font-bold; }"),
      applyVariant: lines("h1 { @apply text-[5vw] md:text-6xl; }"),
    };
    const SILENCED = lines("/* ui-check-off: font-size-viewport (a hero sized to the screen on purpose) */", "h1 { font-size: 5vw; }");
    const SILENCED_TW = lines("export const P = () => (", "  // ui-check-off: font-size-viewport (decorative 404 digits)", "  <p className=\"text-[30vw]\">404</p>", ");");
    const g = (text, rel) => got(text, rel).filter((f) => /font-size-viewport/.test(f));
    const at = (...ns) => ns.map((n) => "font-size-viewport@" + n);
    const R = {
      plain: g(PLAIN, "src/plain.css"), nesting: g(NESTING, "src/nesting.css"), sass: g(SASS, "src/_hero.scss"), vanilla: g(VANILLA, "src/vanilla-hero.css.ts"),
      emotion: g(EMOTION, "src/EmotionHero.tsx"), mui: g(MUI, "src/MuiHero.tsx"), tw: g(TW, "src/TwHero.tsx"), twLone: run(TW_LONE, "src/TwLone.tsx").findings.map((f) => f.rule + "@" + f.line + " " + f.value),
      vue: g(VUE, "src/Hero.vue"), svelte: g(SVELTE, "src/Hero.svelte"),
      blade: g(BLADE, "resources/views/hero.blade.php"), values: g(VALUES, "src/values.css"),
      cond: Object.fromEntries(Object.entries(COND).map(([k, t]) => [k, g(t, "src/" + k + ".css")])),
      nocond: Object.fromEntries(Object.entries(NOCOND).map(([k, t]) => [k, g(t, "src/" + k + ".css")])),
      silenced: g(SILENCED, "src/s.css"), silencedTw: g(SILENCED_TW, "src/S.tsx"),
    };
    // a warn rule: listed before the report-level ones and counted in finish's warning
    const files = [["src/Hero.svelte", SVELTE], ["src/Box.tsx", lines("export const B = () => <div className=\"transition-all\" />;")]].map(([rel, t]) => Object.assign({ rel }, run(t, rel)));
    const rep = T.uiChecksReport(files, () => ({ focus: false, limits: [] }), 50), fin = T.uiFinishChecks(rep);
    all("1.38.0 F0c: font-size-viewport (warn) — a stylesheet's viewport-only font size when the file declares no font size in a conditional block (CRIT_3's plain, nesting and Sass shapes silent; a layer is no condition), an element's own `style` attribute (JSX, HTML, Vue, Svelte, Blade — never a component's, never past a spread, never a free `fontSize:` line: vanilla-extract, emotion, MUI's sx), a bare `text-[…vw]` whose FILE holds no variant `text-` utility (R16 silent; review 1 of 1.38); values of numbers, viewport lengths and calc / clamp / min / max only (got " +
      js({ R, report: rep.findings.map((f) => f.rule + ":" + f.level), finish: fin.byRule }) + ")", {
      plain: () => js(R.plain) === "[]" && js(R.nesting) === "[]" && js(R.sass) === "[]",
      cssInJs: () => js(R.vanilla) === "[]" && js(R.emotion) === "[]" && js(R.mui) === "[]",
      tw: () => js(R.tw) === js(at(5, 15, 19)),
      twLone: () => js(R.twLone) === js(["font-size-viewport@1 text-[5vw]", "font-size-viewport@2 text-[length:5vw]", "font-size-viewport@3 text-[4dvw]/7",
        "font-size-viewport@4 !text-[3vmax]", "font-size-viewport@5 text-[2vw]!", "font-size-viewport@7 text-[5vw]"]),
      markup: () => js(R.vue) === js(at(2, 3, 5)) && js(R.svelte) === js(at(1, 3)) && js(R.blade) === js(at(1)),
      values: () => js(R.values) === js(at(1, 10, 11, 13, 16, 17)),
      cond: () => Object.values(R.cond).every((x) => js(x) === "[]"),
      nocond: () => js(R.nocond.layerOnly) === js(at(1)) && js(R.nocond.mediaOther) === js(at(1)) && js(R.nocond.shallow) === js(at(1))
        && js(R.nocond.apply) === js(at(1)) && js(R.nocond.applyVariant) === "[]",
      silenced: () => js(R.silenced) === js(["~font-size-viewport@2"]) && js(R.silencedTw) === js(["~font-size-viewport@3"]),
      warn: () => js(rep.findings.map((f) => f.rule + ":" + f.level)) === js(["font-size-viewport:warn", "font-size-viewport:warn", "transition-all:report"])
        && js(fin.byRule) === js({ "font-size-viewport": 2 }),
    });
  }

  { // 1.38: MOTION declared (the project fact no-reduced-motion's — uiChecksOf's `motion`, never a finding): `@keyframes`, an
    // animation naming one, a transform's transition for a literal time, smooth scrolling, Tailwind's animate-* /
    // transition-transform / scroll-smooth under any variant — never an opacity / colour / `all` transition, `animation: none`,
    // a global keyword, a lone var(), `animate-none`, a time of 0, a transition-property; one count a line, its first line
    const mo = (text, rel) => { const r = run(text, rel); return [r.motion.count, r.motion.line]; };
    const M = {
      // (a shadcn dialog: tailwindcss-animate's animate-in under a data variant)
      dialog: mo(lines("export const O = () => (", "  <DialogPrimitive.Overlay className=\"data-[state=open]:animate-in data-[state=closed]:animate-out fixed inset-0\" />", ");"), "src/components/ui/dialog.tsx"),
      // (a Vue SFC: its <style scoped> keyframes after a template animate-spin — the first line is the smallest)
      vue: mo(lines("<template>", "  <i class=\"animate-spin\" />", "</template>", "<style scoped>", ".pop { animation: pop .2s ease-out; }", "@keyframes pop {", "  from { transform: scale(.9) }", "}", "</style>"), "src/Pop.vue"),
      keyframes: mo(lines("@-webkit-keyframes spin { to { transform: rotate(1turn) } }", ".a { color: red; }"), "src/spin.css"),
      // (the first rule of a <style> block: its prelude carries the `<style scoped>` line before it)
      vueFirst: mo(lines("<template>", "  <p>hi</p>", "</template>", "<style scoped>", "@keyframes pop {", "  from { transform: scale(.9) }", "}", "</style>"), "src/P.vue"),
      // (a <style> before the template: its keyframes, found after the template's utility, is still the first line)
      vueStyleFirst: mo(lines("<style>", ".a { animation: pop 1s; }", "</style>", "<template>", "  <i class=\"animate-spin\" />", "</template>"), "src/Q.vue"),
      // (an HTML inline style: smooth scrolling on a markup line)
      inline: mo(lines("<main style=\"scroll-behavior: smooth\">x</main>"), "src/a.html"),
      svelte: mo(lines("<button class=\"transition-transform hover:scale-105\">a</button>", "<main class=\"md:scroll-smooth\">b</main>"), "src/Card.svelte"),
      sheet: mo(lines("html { scroll-behavior: smooth; }", ".a { transition: transform 150ms ease, opacity 1s; }", ".b { transition: translate .2s; }", ".c { animation-name: fade; }"), "src/a.css"),
      // (a style object and an inline style: a line each — two on one line count once)
      script: mo(lines("const s = { transition: \"transform .3s\", animation: \"spin 1s linear infinite\" };", "const t = <div style={{ animation: \"pulse 2s\" }} />;"), "src/S.tsx"),
      none: mo(lines(".a { transition: opacity .2s; }", ".b { transition: color .2s, background-color .2s; }", ".c { transition: all .3s; }", ".d { animation: none; }", ".e { animation: inherit; }",
        ".f { animation-name: var(--anim); }", ".g { transition: transform 0s 1s; }", ".h { transition: transform var(--d); }", ".i { transition-property: transform; transition-duration: .2s; }",
        ".j { scroll-behavior: auto; }"), "src/none.css"),
      noneTw: mo(lines("<div class=\"motion-reduce:animate-none transition-opacity transition-colors\">x</div>"), "src/N.vue"),
      apply: mo(lines(".btn { @apply animate-bounce; }"), "src/apply.css"),
    };
    // (an `animation:` value is no transition: `animation: 1s` never reads as transition-all — and a transition-all stays one)
    const anim = got(lines("const s = { animation: \"1s ease\" };", "const t = { transition: \"all .3s\" };"), "src/A.tsx");
    all("1.38: motion declared — keyframes (a vendor prefix too), an animation naming one, a transform's transition for a literal time, smooth scrolling, Tailwind's animate-* / transition-transform / scroll-smooth under a variant (an @apply's too), a style object's; never opacity / colour / all transitions, animation none / inherit / a lone var(), animate-none, a 0s duration, a var() time, transition-property; one a line, the first line (got " +
      js({ M, anim }) + ")", {
      dialog: () => js(M.dialog) === js([1, 2]),
      vue: () => js(M.vue) === js([3, 2]),
      keyframes: () => js(M.keyframes) === js([1, 1]) && js(M.vueFirst) === js([1, 5]) && js(M.vueStyleFirst) === js([2, 2]) && js(M.inline) === js([1, 1]),
      svelte: () => js(M.svelte) === js([2, 1]),
      sheet: () => js(M.sheet) === js([4, 1]),
      script: () => js(M.script) === js([2, 1]),
      none: () => js(M.none) === js([0, 0]) && js(M.noneTw) === js([0, 0]),
      apply: () => js(M.apply) === js([1, 1]),
      anim: () => js(anim) === js(["transition-all@2"]),
    });
  }

  { // 1.38 (found by chain P): a markup file's <style> block — its opening tag's line is a CSS line, so its FIRST rule read the
    // tag in its prelude and an at-rule there read as none since 1.37: a print / reduced-motion / conditional block — the same
    // sheet as a .css file is silent; a first rule's value holds no tag; a later block is read as before
    const sfc = (body, rel) => got("<template><h1>x</h1></template>\n<style scoped>\n" + body + "</style>\n", rel);
    const S1 = { print: "@media print { button { outline: none; } }\n", reduced: "@media (prefers-reduced-motion: reduce) { .a { transition: all .2s; } }\n",
      cond: "@media (min-width: 600px) { h1 { font-size: 2rem; } }\nh1 { font-size: 5vw; }\n" };
    const R1 = Object.fromEntries(Object.entries(S1).map(([k, b]) => [k, [sfc(b, "src/A.vue"), sfc(b, "src/A.svelte"), got(b, "src/a.css")]]));
    const first = run("<style>\nbutton:focus { outline: none; }\n</style>\n<template><b>x</b></template>\n", "src/P.vue").findings.map((f) => f.value);
    const later = got("<style>\n.a { color: red; }\n@media print { button { outline: none; } }\nbutton { outline: none; }\n</style>\n", "src/L.vue");
    all("1.38: a <style> block's first rule is read without its tag — an at-rule there is one (print, reduced motion, a condition: silent, as in a .css file), a first rule's value names no tag; later blocks as before (got " + js({ R1, first, later }) + ")", {
      atRule: () => Object.values(R1).every((x) => x.every((y) => js(y) === "[]")),
      value: () => js(first) === js(["button:focus { outline: none }"]),
      later: () => js(later) === js(["outline-removed@4"]),
    });
  }

  { // 1.38.0 review 1 (UP-5): a SECOND <style> block (Vue's global + scoped pair) — its first rule's prelude carried the first
    // block's `</style>` line and its own tag: an at-rule there read as none (print, a condition, keyframes) — read as the first
    // block's is; a first SELECTOR rule's value names no tag. (Astro's `define:vars` braces are not: the 1.39 backlog.)
    const two = (first, second, close = "</style>") => lines("<template><h1 class=\"t\"><button>x</button></h1></template>", "<style>", first, close, "<style scoped>", ...second, "</style>");
    const T2 = {
      print: got(two(".b { color: red; }", ["@media print {", "  button { outline: none; }", "}"]), "src/TwoPrint.vue"),
      size: got(two("h1 { font-size: 5vw; }", ["@media (min-width: 900px) {", "  .t { font-size: 4rem; }", "}"]), "src/TwoSize.vue"),
      spaced: got(two(".b { color: red; }", ["@media print {", "  button { outline: none; }", "}"], "</style >"), "src/TwoSpaced.vue"),
      svelte: got(two(".b { color: red; }", ["@media print {", "  button { outline: none; }", "}"]), "src/Two.svelte"),
    };
    const kf = run(two(".p { color: red; }", ["@keyframes pop { to { opacity: 1 } }"]), "src/TwoKf.vue").motion;
    const sel = run(two(".b { color: red; }", ["button { outline: none; }"]), "src/TwoSel.vue").findings.map((f) => f.rule + "@" + f.line + " " + f.value);
    all("1.38.0 review 1: a second <style> block's first rule is read without the first block's `</style>` and its own tag — an at-rule there is one (print, a condition: silent; keyframes: motion), `</style >` too; a selector rule's value names no tag (got " + js({ T2, kf, sel }) + ")", {
      atRule: () => Object.values(T2).every((x) => js(x) === "[]"),
      keyframes: () => js(kf) === js({ count: 1, line: 6 }),
      selector: () => js(sel) === js(["outline-removed@6 button { outline: none }"]),
    });
  }

  { // 1.38.0 review 1 (UP-3): the bare `text-[…vw]` is decided per FILE, as a stylesheet's size is — its candidates kept and
    // dropped when ANY class list of the file held a `text-` utility under a variant. Per line, a class list split over lines
    // warned: the reviewer's cn() / cva / clsx() / a wrapped class attribute (JSX, Vue). Still warning: a lone bare size in a
    // file of no variant `text-` (JSX, an HTML class), an element's own style beside a variant one (decided on its tag), a
    // sheet's declaration beside an `@apply` of a colour variant (the @apply's variant drops the @apply sizes alone).
    const S3 = {
      cn: ["src/Hero.tsx", lines("export function Hero() {", "  return (", "    <h1", "      className={cn(", "        \"text-[8vw] font-bold leading-none\",", "        \"md:text-7xl\"", "      )}", "    >", "      Ship", "    </h1>", "  );", "}")],
      cva: ["src/heading.tsx", lines("const heading = cva(\"text-[6vw] font-bold\", {", "  variants: { size: { lg: \"md:text-7xl\" } },", "});")],
      clsx: ["src/T.tsx", lines("export const T = ({ big }) => (", "  <h1", "    className={clsx(", "      'text-[9vw]',", "      'lg:text-8xl',", "      big && 'font-black'", "    )}", "  >", "    x", "  </h1>", ");")],
      attr: ["src/A.tsx", lines("export const T = () => (", "  <h1", "    className=\"text-[9vw] font-black", "      lg:text-8xl\"", "  >x</h1>", ");")],
      vue: ["src/H.vue", lines("<template>", "  <h1", "    class=\"text-[9vw] font-black", "           lg:text-8xl\">x</h1>", "</template>")],
      // (the variant anywhere in the file: above, another element's; Tailwind 3's important `lg:!text-7xl`; a colour's)
      above: ["src/B.tsx", lines("export const A = () => <p className=\"md:text-6xl\">a</p>;", "export const B = () => <p className=\"text-[5vw]\">b</p>;")],
      important: ["src/I.tsx", lines("export const B = () => <p className=\"text-[5vw]\">b</p>;", "export const A = () => <p className=\"lg:!text-7xl\">a</p>;")],
      dark: ["src/D.tsx", lines("export const B = () => <p className=\"text-[5vw]\">b</p>;", "export const A = () => <p className=\"dark:text-white\">a</p>;")],
      // (a sheet: an @apply's variant drops the @apply sizes of the file, in another rule too)
      applyTwo: ["src/apply.css", lines("h1 { @apply text-[5vw]; }", ".lead { @apply md:text-6xl; }")],
    };
    const W3 = {
      html: ["public/404.html", lines("<p class=\"text-[5vw] font-bold\">404</p>", "<p class=\"text-red-500\">x</p>")],
      styleBeside: ["src/S.tsx", lines("export const A = () => <h1 className=\"md:text-6xl\" style={{ fontSize: \"5vw\" }}>a</h1>;")],
      declColour: ["src/decl.css", lines("h1 { font-size: 5vw; }", ".btn { @apply hover:text-white; }")],
    };
    const g3 = (o) => Object.fromEntries(Object.entries(o).map(([k, [rel, t]]) => [k, got(t, rel).filter((f) => /font-size-viewport/.test(f))]));
    const silent = g3(S3), warns = g3(W3);
    all("1.38.0 review 1: a bare `text-[…vw]` is decided per FILE — silent when any class list of the file holds a variant `text-` utility (cn() / cva / clsx() / a wrapped class attribute in JSX and Vue, the variant above or below, `lg:!text-7xl`, `dark:text-white`; a sheet's @apply in another rule); a lone one, an element's own style beside a variant, a sheet's declaration beside a colour-variant @apply still warn (got " + js({ silent, warns }) + ")", {
      silent: () => Object.values(silent).every((x) => js(x) === "[]"),
      warns: () => js(warns) === js({ html: ["font-size-viewport@1"], styleBeside: ["font-size-viewport@1"], declColour: ["font-size-viewport@1"] }),
    });
  }

  { // 1.38.0 review 1 (UP-4): a file read only in part — past the read (`over`: the caller read DS_READ_CHARS of a longer file)
    // or a line cut at DS_LINE_MAX — judges none of the sizes the REST of the file decides: a sheet's (its override may sit past
    // the cut — the reviewer's min.css, a theme's 270K style.css) and the bare `text-[…vw]` of its class lines; an element's own
    // style is decided on its tag and still warns, as do the other rules; a file read whole as before
    const one = (text, rel, over) => T.uiChecksOf(T.viewLines(text, rel), rel, over).findings.map((f) => f.rule + "@" + f.line);
    const LONG = "const svg = \"" + "x".repeat(2100) + "\";"; // (a line viewLines cuts)
    const P4 = {
      overSheet: one("h1 { font-size: 5vw; }\n", "src/a.css", true), wholeSheet: one("h1 { font-size: 5vw; }\n", "src/a.css", false),
      min: one(".hero{font-size:5vw}" + ".x{color:red}".repeat(170) + "@media (min-width:768px){.hero{font-size:3rem}}\n", "src/min.css"),
      cutTsx: one(lines("export const C = () => <p className=\"text-[5vw]\">404</p>;", LONG), "src/C.tsx"),
      overTsx: one(lines("export const C = () => <p className=\"text-[5vw]\">404</p>;"), "src/C.tsx", true),
      wholeTsx: one(lines("export const C = () => <p className=\"text-[5vw]\">404</p>;"), "src/C.tsx"),
      // (a markup file: its cut template line leaves its <style> block's sizes unjudged too — the file is read in part)
      cutVue: one(lines("<template><p>" + "x".repeat(2100) + "</p></template>", "<style>", "h1 { font-size: 5vw; }", "</style>"), "src/C.vue"),
      inline: one(lines("export const D = () => <h1 style={{ fontSize: \"5vw\" }}>x</h1>;", "export const I = () => <img src=\"/a.png\" />;", LONG), "src/D.tsx", true),
    };
    all("1.38.0 review 1: a file read only in part (past the read, a line cut) judges none of the font sizes the rest of the file decides — a sheet's, a bare text-[…vw]; an element's own style and the other rules still warn; read whole, as before (got " + js(P4) + ")", {
      part: () => [P4.overSheet, P4.min, P4.cutTsx, P4.overTsx, P4.cutVue].every((x) => js(x) === "[]"),
      whole: () => js(P4.wholeSheet) === js(["font-size-viewport@1"]) && js(P4.wholeTsx) === js(["font-size-viewport@1"]),
      inline: () => js(P4.inline) === js(["font-size-viewport@1", "img-no-alt@2"]),
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

  { // a click on an HTML VOID element has no body: judged at once as a self-closing one (a doubt) — never waiting for a close
    // tag that never comes, never counted as a read past the bound (review 1 of 1.37's follow-up); in HTML, Vue and Svelte, each
    // void element of the spec's list that can be a candidate
    const filler = Array.from({ length: 40 }, (_, i) => "  para " + i);
    const html = lines("<body>", "<img onclick=\"zoom()\" src=\"a.png\" alt=\"A\">", ...filler, "</body>");
    const vue = lines("<template>", "  <img @click=\"zoom\" src=\"a.png\" alt=\"A\">", ...filler, "</template>");
    const svelte = lines("<img onclick={zoom} src=\"a.png\" alt=\"A\">", ...filler);
    const each = lines(...["<br onclick=\"x()\">", "<hr onclick=\"x()\">", "<area onclick=\"x()\" alt=\"a\">", "<col onclick=\"x()\">", "<source onclick=\"x()\">",
      "<track onclick=\"x()\">", "<wbr onclick=\"x()\">", "<base onclick=\"x()\">", "<link onclick=\"x()\">", "<meta onclick=\"x()\">"], ...filler);
    const V = { html: run(html, "public/gallery.html"), vue: run(vue, "src/components/Zoom.vue"), svelte: run(svelte, "src/lib/Zoom.svelte"), each: run(each, "public/void.html") };
    const vp = path.join(tmp, "proj-uic-void");
    S.initProject(vp, ["ui"], "en");
    const vf = S.createFeature(vp, { name: "Gallery", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(vf.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build\n  - _Requirements: US-1.AC-1_\n  - _Implements: public/gallery.html_\n  - _Verify: npm test_\n");
    fs.mkdirSync(path.join(vp, "public"), { recursive: true });
    fs.writeFileSync(path.join(vp, "public", "gallery.html"), html);
    const vr = S.designSystemReport(vp, { name: vf.slug });
    all("1.37 UI checks: a click on a void element (<img onclick>, its Vue / Svelte forms, br, hr, area without href, col, source, track, wbr, base, link, meta) is no finding and no read past a bound — not in `cut`, not in the report's `limits` (got " +
      js(Object.assign({ report: [vr.uiChecks.total, vr.uiChecks.limits] }, Object.fromEntries(Object.entries(V).map(([k, r]) => [k, [r.findings.length, r.cut]])))) + ")", {
      none: () => Object.values(V).every((r) => r.findings.length === 0 && js(r.cut) === js({ lines: 0, tags: 0 })),
      report: () => vr.uiChecks.total === 0 && js(vr.uiChecks.limits) === js([]),
    });
  }

  { // review 1 of 1.37's LOWs: ids `,`-separated (a TRAILING marker silences its own line and the one below whatever its line
    // holds — review 2 of 1.37 took S5's narrowing out: `button:focus { /* ui-check-off: … */` above its declaration); an
    // inline paste handler that hands its event on is not followed, a `navigator.clipboard` read is a read (S6); a non-empty title names an <img> (S7, axe-core's image-alt); a `:focus` removal on a type no keyboard
    // reaches by default or on `[tabindex="-1"]` is no candidate (S9)
    const trailing = { jsx: got(lines("export const Logos = () => (", "  <div>", "    <img src=\"/spacer.gif\" /> {/* ui-check-off: img-no-alt */}", "    <img src=\"/logo-acme.png\" />", "  </div>", ");"), "src/Logos.tsx"),
      html: got(lines("<img src=\"/spacer.gif\"> <!-- ui-check-off: img-no-alt -->", "<img src=\"/logo.png\">"), "index.html"),
      css: got(lines("*:focus { outline: 0; } /* ui-check-off: outline-removed */", "button { outline: none; }"), "src/reset.css"),
      blank: got(lines("export const Row = ({ go }) => (", "  // ui-check-off: img-no-alt click-no-keyboard", "  <div onClick={go}>Pick <img src=\"/a.png\" /></div>", ");"), "src/Row.tsx"),
      rule: got(lines(".menu-item:focus { /* ui-check-off: outline-removed — the ring is drawn by box-shadow in JS */", "  outline: none;", "}", ".x:focus {", "  outline: none;", "}"), "src/menu.css"),
      tag: got(lines("export const F = () => (", "  <figure> {/* ui-check-off: img-no-alt */}", "    <img src=\"/a.png\" />", "    <img src=\"/b.png\" />", "  </figure>", ");"), "src/F.tsx") };
    const paste = got(lines("export const Code = ({ onPasteCode, set, other }) => (", "  <form>", "    <input onPaste={(e) => { e.preventDefault(); onPasteCode(e); }} />",
      "    <input onPaste={function (ev) { ev.preventDefault(); handle(ev, 6); }} />", "    <input onPaste={(e) => { e.preventDefault(); navigator.clipboard.readText().then(set); }} />",
      "    <input onPaste={(e) => { e.preventDefault(); log(other); }} />", // 6: FINDING (what it hands on is not the event)
      "    <input onPaste={(e) => e.preventDefault()} />", // 7: FINDING
      "  </form>", ");"), "src/Code.tsx");
    const pasteNg = got(lines("<input (paste)=\"$event.preventDefault(); onPaste($event)\">", "<input onpaste=\"event.preventDefault(); handle(event)\">", "<input onpaste=\"event.preventDefault(); return false\">"), "src/app/code/code.component.html"); // 3: FINDING
    const titled = got(lines("<img title=\"Andorra\" class=\"CountryFlag\" src=\"./AD.svg\"/>", "<img title=\"\" src=\"./x.svg\"/>", "<img title src=\"./y.svg\"/>"), "public/flags.html"); // 2, 3: FINDING
    const programmatic = got(lines("[tabindex=\"-1\"]:focus {", "  outline: 0 !important;", "}", "main:focus { outline: none; }", "h1:focus { outline: none; }", "div:focus { outline: none; }",
      ".btn:focus { outline: none; }", "a:focus { outline: none; }", "#main [tabindex='-1']:focus { outline: none; }"), "src/a11y.css"); // 7, 8: FINDING
    all("1.37 UI checks: a trailing ui-check-off silences its own line and the one below (after a rule's `{`, an opening tag), never two below; blank-separated ids are not read past the first; a paste handler that hands its event on (an arrow's, a function's, $event, event) is not followed, a navigator.clipboard read is a read; a non-empty title names an <img>; `[tabindex=\"-1\"]:focus`, `main:focus`, `h1:focus`, `div:focus` are no candidates (got " +
      js({ trailing, paste, pasteNg, titled, programmatic }) + ")", {
      trailing: () => js(trailing.jsx) === js(["~img-no-alt@3", "~img-no-alt@4"]) && js(trailing.html) === js(["~img-no-alt@1", "~img-no-alt@2"]) && js(trailing.css) === js(["~outline-removed@1", "~outline-removed@2"]),
      after: () => js(trailing.rule) === js(["~outline-removed@2", "outline-removed@5"]) && js(trailing.tag) === js(["~img-no-alt@3", "img-no-alt@4"]),
      blank: () => js(trailing.blank) === js(["~img-no-alt@3", "click-no-keyboard@3"]),
      paste: () => js(paste) === js(["paste-blocked@6", "paste-blocked@7"]) && js(pasteNg) === js(["paste-blocked@3"]),
      title: () => js(titled) === js(["img-no-alt@2", "img-no-alt@3"]),
      focusShape: () => js(programmatic) === js(["outline-removed@7", "outline-removed@8"]),
    });
  }

  { // review 2 of 1.37's LOWs, by subtraction: a clipboard read is the API, never the word (S3); `[tabindex="-1"]` skips a
    // `:focus` removal only where the compound REQUIRES it — outside a pseudo-class's arguments (S4); a `<label>` in a body is no
    // control, a candidate whose close tag never comes is counted (S5); a render prop's `{children(…)}` / `{children?.()}` and
    // Blade's raw `{!! $slot !!}` are slot outlets (S7); a tag read past the bound is counted only when it could have held a
    // finding — an element, a click or paste handler named (D4). Each with the shapes the earlier rules judged right
    const paste = got(lines("export const P = ({ set, fill }) => (", "  <form>",
      "    <input onPaste={(e) => { e.preventDefault(); toast.error(\"Pasting from the clipboard is disabled\"); }} />", // 3: FINDING
      "    <input onPaste={(e) => { e.preventDefault(); const d = e.clipboardData; set(d); }} />", "    <input onPaste={(e) => { e.preventDefault(); fill(e.nativeEvent.getData(\"text\")); }} />",
      "    <input", "      onPaste={(e) => {", "        e.preventDefault();", "        navigator", "          .clipboard", "          .readText()", "          .then(set);", "      }}", "    />",
      "  </form>", ");"), "src/P.tsx");
    const htmlPaste = got(lines("<input type=\"password\" onpaste=\"alert('No clipboard pasting'); return false\">"), "public/login.html"); // 1: FINDING
    const tabindex = got(lines(":not([tabindex=\"-1\"]):focus { outline: none; }", "button:not([tabindex=\"-1\"]):focus { outline: none; }", // 1, 2: FINDING
      "a:not(:where([tabindex=\"-1\"], [disabled])):focus { outline: none; }", // 3: FINDING
      "[tabindex=\"-1\"]:not(.x):focus { outline: none; }", "[tabindex = '-1']:focus { outline: none; }", "a:not(.btn)[tabindex=\"-1\"]:focus { outline: none; }"), "src/a11y.css");
    const body = got(lines("export const B = ({ toggle, children, render, open }) => (", "  <>", "    <div className=\"option\" onClick={toggle}><label>Dark mode</label></div>", // 3: FINDING
      "    <div onClick={toggle}><label><input type=\"checkbox\" /> Dark</label></div>", "    <div onClick={toggle}>{children({ open })}</div>", "    <div onClick={toggle}>{children?.()}</div>",
      "    <div onClick={toggle}>{renderChildren(open)}</div>", // 7: FINDING (no outlet)
      "    <label onClick={toggle}>Pick</label>", "  </>", ");"), "src/B.tsx");
    const blade = got(lines("<div @click=\"open = ! open\">{!! $slot !!}</div>", "<div @click=\"open = ! open\">{!! __('Profile') !!}</div>"), "resources/views/components/menu.blade.php"); // 2: FINDING
    const unclosed = run(lines("<ul><li onclick=\"a()\">One<li onclick=\"b()\">Two</ul>"), "public/list.html");
    // (an outer candidate past the bound — counted then — and an inner one still waiting at the end: each counted once; the
    // file's last, empty line is the outer one's 30th)
    const nested = run(lines("<div onclick=\"a()\">", "<div onclick=\"b()\">", ...Array.from({ length: 28 }, (_, i) => "text " + i)), "public/nested.html");
    const props = (name, attr) => lines("export const C = () => (", "  <" + name, "    " + attr, ...Array.from({ length: 34 }, (_, i) => "    data-k" + i + "=\"v\""), "  />", ");");
    const D4 = { comp: run(props("DayPicker", "mode=\"single\""), "src/C.tsx").cut.tags, paste: run(props("Input", "onPaste={block}"), "src/C.tsx").cut.tags,
      click: run(props("Card", "onClick={go}"), "src/C.tsx").cut.tags, element: run(props("section", "role=\"region\""), "src/C.tsx").cut.tags,
      // (a closed component tag past the characters bound — its props alone — is not counted either)
      wide: run(lines("export const W = () => <Chart", "  data-a=\"" + "x".repeat(1980) + "\"", "  data-b=\"" + "y".repeat(1980) + "\"", "  data-c=\"" + "z".repeat(1980) + "\" />;"), "src/W.tsx").cut.tags };
    all("1.37 UI checks (review 2's LOWs): a paste handler's own message naming the clipboard reads nothing, `clipboardData` / `getData` / `navigator.clipboard` (over lines too) do; `:not([tabindex=\"-1\"]):focus` is a candidate, a compound requiring the tabindex is not; a `<label>` in a body is no control, an `<input>` in it is; `{children(…)}`, `{children?.()}`, `{!! $slot !!}` are outlets; an `<li onclick>` whose end tag is omitted is counted; a long component tag of props is not counted, one naming a click or paste handler is, an element is (got " +
      js({ paste, htmlPaste, tabindex, body, blade, unclosed: [unclosed.findings.length, unclosed.cut], D4 }) + ")", {
      paste: () => js(paste) === js(["paste-blocked@3"]) && js(htmlPaste) === js(["paste-blocked@1"]),
      tabindex: () => js(tabindex) === js(["outline-removed@1", "outline-removed@2", "outline-removed@3"]),
      body: () => js(body) === js(["click-no-keyboard@3", "click-no-keyboard@7"]),
      blade: () => js(blade) === js(["click-no-keyboard@2"]),
      unclosed: () => unclosed.findings.length === 0 && js(unclosed.cut) === js({ lines: 0, tags: 2 }) && js(nested.cut) === js({ lines: 0, tags: 2 }),
      tagLength: () => js(D4) === js({ comp: 0, paste: 1, click: 1, element: 1, wide: 0 }),
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

  { // the bounds that cut a read say so (review 1 of 1.37): a line viewLines cut at 2,000 ends the tag being read on it — no quote
    // carried into the lines below (an inline data-URI logo hid the <img> under it), a tag reaching the cut is not judged on the
    // attributes before it (minified HTML); a read past the tag reader's bound is counted (cut.tags), a closed tag past its
    // characters too; past a file's 200 findings each is still counted (past: by rule, silenced) — never kept
    const logo = "<img src=\"data:image/svg+xml;utf8," + "%3Cpath d='M0 0h24v24H0z'/%3E".repeat(80) + "\" alt=\"Acme\" />";
    const header = lines("export const Header = ({ photo }) => (", "  <header>", "    " + logo, "    <p className=\"x\">text</p>", "    <img src={photo} />", "  </header>", ");");
    const minified = "<main><p>" + "x".repeat(1975) + "</p><img src=\"/hero.jpg\" alt=\"Our team at work\"><p>more</p></main>\n<footer>f</footer>\n";
    const unclosed = lines("export const A = () => (", "  <div onClick={() => go(", ...Array.from({ length: 40 }, (_, i) => "      a" + i + ","), "  <img src=\"after.png\" />", ");");
    const wide = lines("export const W = () => <img", "  data-a=\"" + "x".repeat(1980) + "\"", "  data-b=\"" + "y".repeat(1980) + "\"", "  data-c=\"" + "z".repeat(1980) + "\" />;",
      "export const V = () => <img src=\"v.png\" />;");
    const cap = lines("export const List = () => (", "  <ul>", ...Array.from({ length: 200 }, (_, i) => "    <li className=\"transition-all\">Row " + i + "</li>"),
      "    <img src=\"/hero.png\" />", "    {/* ui-check-off: img-no-alt */}", "    <img src=\"/spacer.gif\" />", "  </ul>", ");");
    const h = run(header, "src/Header.tsx"), m = run(minified, "public/index.html"), u = run(unclosed, "src/A.tsx"), w = run(wide, "src/W.tsx"), c = run(cap, "src/List.tsx");
    all("1.37 UI checks: a line cut at 2,000 ends the tag being read (the <img> two lines below a cut data-URI line is judged; a tag the cut reaches is not, its alt past it), and is counted; a tag read past 30 lines, or a closed one past 4,000 characters, is counted; past a file's 200 findings each is counted by rule (silenced apart), never kept (got " +
      js({ h: [h.findings.map((f) => f.rule + "@" + f.line), h.cut], m: [m.findings, m.cut], u: [u.findings.map((f) => f.rule + "@" + f.line), u.cut], w: [w.findings.map((f) => f.rule + "@" + f.line), w.cut], c: [c.findings.length, c.past, c.cut] }) + ")", {
      cutLine: () => js(h.findings.map((f) => f.rule + "@" + f.line)) === js(["img-no-alt@5"]) && js(h.cut) === js({ lines: 1, tags: 0 }),
      minified: () => js(m.findings) === js([]) && js(m.cut) === js({ lines: 1, tags: 0 }),
      tagLines: () => js(u.findings.map((f) => f.rule + "@" + f.line)) === js(["img-no-alt@43"]) && js(u.cut) === js({ lines: 0, tags: 1 }),
      tagChars: () => js(w.findings.map((f) => f.rule + "@" + f.line)) === js(["img-no-alt@5"]) && js(w.cut) === js({ lines: 0, tags: 1 }),
      past: () => c.findings.length === 200 && c.findings.every((f) => f.rule === "transition-all") && js(c.past) === js({ byRule: { "img-no-alt": 1 }, silenced: 1 }),
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

  // --- the feature report's uiChecks, finish --------------------------------------------------------------------------------------
  const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  // a project with one +ui feature whose tasks name `files` in _Implements: (no registry unless `registry`)
  const feature = (tag, files, registry) => {
    const p = path.join(tmp, "proj-uic-" + tag);
    S.initProject(p, ["ui"], "en");
    if (registry != null) write(p, ".specs/steering/design-system.md", registry);
    const f = S.createFeature(p, { name: "Checkout", tracks: ["ui"], summary: "x" });
    fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build the checkout\n  - _Requirements: US-1.AC-1_\n  - _Implements: " + files.join(", ") + "_\n  - _Verify: npm test_\n");
    return { p, slug: f.slug, dir: f.dir };
  };
  const CHECKOUT = lines("export const Checkout = ({ items, go }) => (", "  <div className=\"grid transition-all\" onClick={go}>",
    "    {/* ui-check-off: img-no-alt */}", "    <img src=\"/spacer.gif\" />", "    {items.map((i) => <img key={i.id} src={i.src} />)}", "  </div>", ");");
  const GLOBALS = lines(":root {", "  --background: #ffffff;", "  --foreground: #0a0a0a;", "  --primary: #1d4ed8;", "  --radius: 0.5rem;", "  --ring: #2563eb;", "}",
    "* { transition: all .2s; }", ".legacy { color: #123456; margin: 13px; }");
  const RESET = lines("/* the team's reset */", "*:focus {", "  outline: 0;", "}");

  { // the feature report: its files' findings (warn first, then file, then line), byRule, silenced; its token file (globals.css, a
    // source by its custom properties) read for the checks alone — never for raw values, never in viewFiles; MCP = engine
    const g = feature("report", ["src/checkout/Checkout.tsx", "src/checkout/reset.css", "src/app/globals.css"]);
    write(g.p, "src/checkout/Checkout.tsx", CHECKOUT);
    write(g.p, "src/checkout/reset.css", RESET);
    write(g.p, "src/app/globals.css", GLOBALS);
    const r = S.designSystemReport(g.p, { name: g.slug });
    const viaMcp = payload(await rpc("tools/call", { name: "spec_scan", arguments: { projectDir: g.p, designSystem: true, name: g.slug } }));
    all("1.37 UI checks: the feature report's `uiChecks` — {findings (rule, level, file, line, value: warn first, then by file and line), total, byRule, silenced, limits}; the feature's token file (globals.css) is read for the checks (its transition-all) and never for raw values (its #123456 is not listed) nor counted in viewFiles; a reset's `*:focus { outline: 0 }` with no focus style anywhere stands; the MCP result is the engine's (got " +
      js({ ui: r.uiChecks, raw: r.raw.map((x) => x.file + ":" + x.line), viewFiles: r.viewFiles, limits: r.limits }) + ")", {
      findings: () => js(r.uiChecks.findings.map((x) => [x.rule, x.level, x.file, x.line])) === js([["click-no-keyboard", "warn", "src/checkout/Checkout.tsx", 2],
        ["img-no-alt", "warn", "src/checkout/Checkout.tsx", 5], ["outline-removed", "warn", "src/checkout/reset.css", 3], ["transition-all", "report", "src/app/globals.css", 8],
        ["transition-all", "report", "src/checkout/Checkout.tsx", 2]]),
      counts: () => r.uiChecks.total === 5 && js(r.uiChecks.byRule) === js({ "click-no-keyboard": 1, "img-no-alt": 1, "outline-removed": 1, "transition-all": 2 }) && r.uiChecks.silenced === 1,
      tokenFile: () => r.viewFiles === 2 && !r.raw.some((x) => x.file === "src/app/globals.css") && js(r.uiChecks.limits) === js([]) && js(r.limits) === js([]),
      mcp: () => js(viaMcp.uiChecks) === js(r.uiChecks),
    });
  }

  { // 1.38.0 review 1 (UP-4): a sheet the feature report reads only in part — the reviewer's theme style.css of 270K (its
    // responsive section past the read), a token file the feature edits (globals.css) the same — judges none of its font sizes:
    // `view-size` says the bound, finish warns of none; the same sheet read whole warns
    const past = (head) => { let s = head; for (let i = 0; s.length < 270 * 1024; i++) s += ".block-" + i + " { margin: 0 0 1.5rem; padding: 1rem 2rem; }\n"; return s + "@media (max-width: 768px) {\n  .hero-title { font-size: 2rem; }\n}\n"; };
    const HERO = ".hero-title { font-size: 4.5vw; line-height: 1.1; }\n";
    const g = feature("part", ["src/styles/style.css", "src/app/globals.css"]);
    write(g.p, "src/styles/style.css", past("/* Theme */\n" + HERO));
    write(g.p, "src/app/globals.css", past(GLOBALS + HERO));
    const r = S.designSystemReport(g.p, { name: g.slug }), fin = T.designSystemFinish(g.p, g.slug);
    const w = feature("part-whole", ["src/styles/style.css"]);
    write(w.p, "src/styles/style.css", "/* Theme */\n" + HERO);
    const rw = S.designSystemReport(w.p, { name: w.slug }).uiChecks;
    all("1.38.0 review 1: a sheet the feature report reads in part (270K: a view file, a token file) judges no font size — view-size names both, finish warns of none; read whole it warns (got " +
      js({ ui: r.uiChecks, fin: fin && fin.uiChecks, whole: rw.byRule }) + ")", {
      part: () => !("font-size-viewport" in r.uiChecks.byRule) && r.uiChecks.byRule["transition-all"] === 1
        && js(r.uiChecks.limits.map((l) => [l.code, l.count])) === js([["view-size", 2]]) && r.viewFiles === 1,
      finish: () => !(fin && fin.uiChecks && fin.uiChecks.byRule["font-size-viewport"]),
      whole: () => js(rw.byRule) === js({ "font-size-viewport": 1 }),
    });
  }

  { // the focus facts (CRIT_1 must-fix 4): ANY focus style excuses an outline removal — in the feature's own files (a Vue <style>),
    // else in any of the project's stylesheets, a .less or an `_a11y.scss` no name ranks; read only when a candidate exists
    const mk = (tag, extra) => {
      const g = feature("focus-" + tag, ["src/checkout/reset.css"].concat(extra.mine || []));
      write(g.p, "src/checkout/reset.css", RESET);
      for (const [rel, text] of extra.files || []) write(g.p, rel, text);
      return g;
    };
    const verdict = (g) => S.designSystemReport(g.p, { name: g.slug }).uiChecks.findings.map((x) => x.rule + "@" + x.file);
    const cases = {
      none: mk("none", {}),
      focusCss: mk("css", { files: [["src/styles/focus.css", ":focus-visible {\n  outline: 2px solid var(--ring);\n  outline-offset: 2px;\n}\n"]] }),
      a11y: mk("a11y", { files: [["src/styles/_a11y.scss", "a:focus-visible, button:focus-visible { box-shadow: 0 0 0 2px $ring; }\n"]] }),
      less: mk("less", { files: [["styles/site.less", ".btn { &:focus { border-color: @brand; } }\n"]] }),
      vue: mk("vue", { mine: ["src/checkout/Field.vue"], files: [["src/checkout/Field.vue", "<template>\n  <input class=\"field\" />\n</template>\n<style scoped>\n.field:focus-visible { box-shadow: 0 0 0 2px #2563eb; }\n</style>\n"]] }),
      removalOnly: mk("removal", { files: [["src/styles/focus.css", ":focus { outline: none; }\n:focus:not(:focus-visible) { outline: none; }\n"]] }),
      // (S3: Bootstrap's ring-killing override in a project sheet, and a feature SearchBox's `focus:ring-0`, excuse nothing)
      bsOverride: mk("bs", { files: [["src/styles/vendor-overrides.css", ".form-control:focus,\n.btn:focus {\n  outline: none;\n  box-shadow: none;\n}\n"]] }),
      ring0: mk("ring0", { mine: ["src/checkout/SearchBox.tsx"], files: [["src/checkout/SearchBox.tsx", "export const SearchBox = () => (\n  <input className=\"w-full border-0 focus:ring-0 focus:outline-none\" />\n);\n"]] }),
      // (review 2 of 1.37: the Tailwind v3 CLI's compiled sheet in src/ — its `outline-none` — and a project `@apply outline-none`
      // in a focus rule excuse nothing)
      tw3: mk("tw3", { files: [["src/output.css", ".focus\\:outline-none:focus {\n  outline: 2px solid transparent;\n  outline-offset: 2px;\n}\n"]] }),
      apply: mk("apply", { files: [["src/styles/base.css", "button:focus {\n  @apply outline-none;\n}\n"]] }),
    };
    const got1 = Object.fromEntries(Object.entries(cases).map(([k, g]) => [k, verdict(g)]));
    // no candidate → no stylesheet of the project is read for the facts (an open counted on the one that holds one)
    const quiet = feature("focus-quiet", ["src/checkout/Checkout.tsx"]);
    write(quiet.p, "src/checkout/Checkout.tsx", "export const C = () => <button>ok</button>;\n");
    write(quiet.p, "src/styles/focus.css", ":focus-visible { outline: 2px solid; }\n");
    const opens = (g, file) => {
      const real = fs.openSync;
      let n = 0;
      fs.openSync = function (p) { if (path.resolve(String(p)) === path.resolve(g.p, file)) n++; return real.apply(this, arguments); };
      try { S.designSystemReport(g.p, { name: g.slug }); } finally { fs.openSync = real; }
      return n;
    };
    const reads = { quiet: opens(quiet, "src/styles/focus.css"), asked: opens(cases.focusCss, "src/styles/focus.css"), own: opens(cases.none, "src/checkout/reset.css") };
    all("1.37 UI checks: an outline removal stands only while NO focus style exists — a focus.css elsewhere, an `_a11y.scss` (never a name-ranked sheet), a .less file, a .vue <style> among the feature's files each excuse it; a sheet that only removes does not; with no candidate no stylesheet is read for the facts, and a file the report read is never read again (got " + js({ got1, reads }) + ")", {
      stands: () => js(got1.none) === js(["outline-removed@src/checkout/reset.css"]) && js(got1.removalOnly) === js(got1.none) && js(got1.bsOverride) === js(got1.none) &&
        js(got1.tw3) === js(got1.none) && js(got1.apply) === js(got1.none) &&
        js(got1.ring0) === js(["outline-removed@src/checkout/SearchBox.tsx", "outline-removed@src/checkout/reset.css"]),
      excused: () => ["focusCss", "a11y", "less", "vue"].every((k) => js(got1[k]) === js([])),
      lazy: () => reads.quiet === 0 && reads.asked === 1 && reads.own === 1,
    });
  }

  { // the focus pass's bounds: the project's 48 first stylesheets read (the shorter path first) and 384K characters PARSED —
    // only a sheet whose text names `focus` is parsed, so a focus-free one costs no parse budget; each sheet read WHOLE: one
    // longer than the bound, or one to parse past what is left, ends the search. Past either bound the removal is NOT judged
    // and `uiChecks.limits` says so (focus-sheets / focus-chars), never the report's own `limits`
    const proj = (tag, files) => { const g = feature("focus-" + tag, ["src/checkout/reset.css"]); write(g.p, "src/checkout/reset.css", RESET); for (const [rel, text] of files) write(g.p, rel, text); return S.designSystemReport(g.p, { name: g.slug }); };
    const sheets = (n) => Array.from({ length: n }, (_, i) => ["src/sheets/s" + String(i).padStart(4, "0") + ".css", ".s" + i + " { color: red; }\n"]);
    const FOCUS = ":focus-visible { outline: 2px solid; }\n", NAMES = ":focus { outline: none; }\n"; // a focus style · a sheet naming focus, no focus style
    const fill = (k) => ".b { color: red; }\n".repeat(Math.ceil(k * 1024 / 19)); // ~k K characters, no focus named
    const rm = proj("sheets", [...sheets(48), ["src/sheets/zz/late-focus.css", FOCUS]]); // the 49th by path length
    const ru = proj("under", [...sheets(47), ["src/sheets/zz/late-focus.css", FOCUS]]);
    const rr = proj("root", [...sheets(48), ["z-focus.css", FOCUS]]); // the shortest path, the last by name
    const rb = proj("chars", [["src/big/b0.css", NAMES + fill(150)], ["src/big/b1.css", NAMES + fill(150)], ["src/big/b2.css", NAMES + fill(150)], ["src/big/zz-focus.css", FOCUS]]);
    // focus-free sheets past the bound in all, each under it, cost no parse budget: the focus sheet after them is read
    const free = proj("free", [["src/big/b0.css", fill(150)], ["src/big/b1.css", fill(150)], ["src/big/b2.css", fill(150)], ["src/big/b3.css", fill(150)], ["src/big/zz-focus.css", FOCUS]]);
    // a sheet is read whole within the bound: its focus rule at its end, past what a head would hold, counts
    const whole = proj("whole", [["src/styles/app.css", fill(300) + "a:focus-visible { outline: 2px solid; }\n"]]);
    // a sheet to parse past what is left ends the search, even with its focus rule first: never judged on a head
    const past = proj("past", [["src/big/b0.css", NAMES + fill(250)], ["src/big/b1.css", FOCUS + fill(250)]]);
    const alone = proj("alone", [["src/styles/app.css", FOCUS + fill(470)]]);
    // a sheet longer than the bound that names no focus in its head is not read whole: the search ends there too
    const long = proj("long", [["src/styles/app.css", fill(470)], ["src/styles/zz-focus.css", FOCUS]]);
    // (review 3 of 1.37: `alone` is the sheet's own length past the bound — after a sheet parsed too)
    const after = proj("after", [["src/big/b0.css", NAMES + fill(100)], ["src/big/b1.css", FOCUS + fill(470)]]);
    // (a sheet of exactly 384K characters is read and parsed whole: its focus style counts)
    const exact = proj("exact", [["src/styles/app.css", FOCUS + "/*" + "x".repeat(384 * 1024 - FOCUS.length - 5) + "*/\n"]]);
    const L = (r) => [r.uiChecks.findings.length, r.uiChecks.limits];
    // (review 2 of 1.37: a bound never hides a KNOWN candidate silently — the pass's limit names the removals it left unjudged:
    // their count, the first file:line; focus-chars, the sheet that ended the search; review 3: the bound, `chars`, and whether
    // that sheet ALONE is longer, `alone`)
    const at = { count: 1, file: "src/checkout/reset.css", line: 3 };
    const ended = (sheet, alone) => ({ sheet, chars: 393216, alone });
    all("1.37 UI checks: the focus pass stops at a bound — 48 stylesheets read (focus-sheets) or 384K characters parsed (focus-chars: a focus-free sheet costs none), each sheet WHOLE (a 300K one's last rule counts; one longer than the bound, or one to parse past what is left, ends the search, whatever its head holds): the removal is then not judged and `uiChecks.limits` says which, naming the removals left unjudged (their count, the first file:line; focus-chars: the sheet that ended it — never the report's `limits` / `truncated`); 48 sheets with the focus style last read it; the shorter path first — a root sheet beside 48 deeper ones is read (got " +
      js({ root: L(rr), many: [...L(rm), rm.limits, rm.truncated], big: L(rb), free: L(free), under: L(ru), whole: L(whole), past: L(past), alone: L(alone), long: L(long), after: L(after), exact: L(exact) }) + ")", {
      sheets: () => rm.uiChecks.findings.length === 0 && js(rm.uiChecks.limits) === js([Object.assign({ code: "focus-sheets", read: 48 }, at)]) && js(rm.limits) === js([]) && rm.truncated === false,
      chars: () => rb.uiChecks.findings.length === 0 && js(rb.uiChecks.limits) === js([Object.assign({ code: "focus-chars", read: 2 }, at, ended("src/big/b2.css", false))]),
      parsedOnly: () => js(L(free)) === js([0, []]),
      under: () => ru.uiChecks.findings.length === 0 && js(ru.uiChecks.limits) === js([]),
      shorterFirst: () => rr.uiChecks.findings.length === 0 && js(rr.uiChecks.limits) === js([]),
      whole: () => whole.uiChecks.findings.length === 0 && js(whole.uiChecks.limits) === js([]),
      past: () => past.uiChecks.findings.length === 0 && js(past.uiChecks.limits) === js([Object.assign({ code: "focus-chars", read: 1 }, at, ended("src/big/b1.css", false))]),
      alone: () => alone.uiChecks.findings.length === 0 && js(alone.uiChecks.limits) === js([Object.assign({ code: "focus-chars", read: 0 }, at, ended("src/styles/app.css", true))]),
      long: () => long.uiChecks.findings.length === 0 && js(long.uiChecks.limits) === js([Object.assign({ code: "focus-chars", read: 0 }, at, ended("src/styles/app.css", true))]),
      after: () => after.uiChecks.findings.length === 0 && js(after.uiChecks.limits) === js([Object.assign({ code: "focus-chars", read: 1 }, at, ended("src/big/b1.css", true))]),
      exact: () => js(L(exact)) === js([0, []]),
    });
  }

  { // the pass is asked for an UNSILENCED candidate alone, and a silenced finding is counted whatever the pass says; a sheet's
    // text is tested for `focus` in any case before it is parsed (review 1 of 1.37)
    const SILENCED = lines("/* the team's reset */", "*:focus {", "  /* ui-check-off: outline-removed */", "  outline: 0;", "}");
    const quiet = feature("pass-silenced", ["src/checkout/reset.css"]);
    write(quiet.p, "src/checkout/reset.css", SILENCED);
    write(quiet.p, "src/styles/focus.css", ":focus-visible { outline: 2px solid; }\n");
    const real = fs.openSync;
    let opened = 0;
    fs.openSync = function (p) { if (path.resolve(String(p)) === path.resolve(quiet.p, "src/styles/focus.css")) opened++; return real.apply(this, arguments); };
    let rq;
    try { rq = S.designSystemReport(quiet.p, { name: quiet.slug }); } finally { fs.openSync = real; }
    const own = feature("pass-own", ["src/checkout/reset.css", "src/checkout/focus.css"]);
    write(own.p, "src/checkout/reset.css", SILENCED);
    write(own.p, "src/checkout/focus.css", ":focus-visible { outline: 2px solid; }\n");
    const ro = S.designSystemReport(own.p, { name: own.slug });
    const upper = feature("pass-upper", ["src/checkout/reset.css"]);
    write(upper.p, "src/checkout/reset.css", RESET);
    write(upper.p, "src/styles/legacy.css", "A:FOCUS-VISIBLE { OUTLINE: 2PX SOLID; }\n");
    const rup = S.designSystemReport(upper.p, { name: upper.slug });
    all("1.37 UI checks: a silenced candidate alone never reads the project's stylesheets and is counted silenced; one beside a focus style of the feature's own files is counted silenced too; a project sheet naming FOCUS in capitals is a focus style (got " +
      js({ opened, quiet: [rq.uiChecks.total, rq.uiChecks.silenced], own: [ro.uiChecks.total, ro.uiChecks.silenced], upper: rup.uiChecks.findings.length }) + ")", {
      noPass: () => opened === 0 && rq.uiChecks.total === 0 && rq.uiChecks.silenced === 1 && js(rq.uiChecks.limits) === js([]),
      ownFocus: () => ro.uiChecks.total === 0 && ro.uiChecks.silenced === 1,
      anyCase: () => rup.uiChecks.findings.length === 0 && js(rup.uiChecks.limits) === js([]),
    });
  }

  { // the order, the cap (DS_LIST = 50 listed, `total` all) and the feature's file cap: 200 files read in all — a token file past
    // it is not read for the checks and `uiChecks.limits` says view-files while the report's own limits do not (its views were read)
    const g = feature("cap", ["src/rows/"]);
    for (let i = 0; i < 30; i++) write(g.p, "src/rows/Row" + String(i).padStart(2, "0") + ".tsx", "export const R = () => (\n  <li onClick={go}>\n    <img src=\"x.png\" /> Row\n  </li>\n);\n");
    const r = S.designSystemReport(g.p, { name: g.slug });
    const full = feature("cap-files", ["src/views/", "src/app/globals.css"]);
    for (let i = 0; i < 200; i++) write(full.p, "src/views/V" + String(i).padStart(3, "0") + ".tsx", "export const V = () => <b>v</b>;\n");
    write(full.p, "src/app/globals.css", GLOBALS);
    const rf = S.designSystemReport(full.p, { name: full.slug });
    const over = feature("cap-over", ["src/views/"]);
    for (let i = 0; i < 201; i++) write(over.p, "src/views/V" + String(i).padStart(3, "0") + ".tsx", "export const V = () => <b>v</b>;\n");
    const ro = S.designSystemReport(over.p, { name: over.slug });
    const vue = feature("cap-order", ["src/checkout/Panel.vue"]);
    write(vue.p, "src/checkout/Panel.vue", "<style>\nbutton:focus { outline: none; }\n</style>\n<template>\n  <div class=\"panel\">\n    <div @click=\"open = !open\">more</div>\n  </div>\n</template>\n");
    const rv = S.designSystemReport(vue.p, { name: vue.slug });
    all("1.37 UI checks: 60 findings → the first 50 listed (by file, then line), `total` 60; a feature of 200 view files and a token file: the token file is not read for the checks (uiChecks.limits: view-files) while the report's limits stay empty; 201 view files: both say it; a Vue <style> before its template: its findings sorted by line (got " +
      js({ order: rv.uiChecks.findings.map((x) => x.rule + "@" + x.line), over: [ro.uiChecks.limits, ro.limits], listed: r.uiChecks.findings.length, total: r.uiChecks.total, first: r.uiChecks.findings.slice(0, 3).map((x) => x.file + ":" + x.line), cap: [rf.viewFiles, rf.uiChecks.total, rf.uiChecks.limits, rf.limits] }) + ")", {
      cap: () => r.uiChecks.findings.length === 50 && r.uiChecks.total === 60 && js(r.uiChecks.byRule) === js({ "click-no-keyboard": 30, "img-no-alt": 30 }),
      order: () => js(r.uiChecks.findings.slice(0, 3).map((x) => x.file.slice(-9) + ":" + x.line)) === js(["Row00.tsx:2", "Row00.tsx:3", "Row01.tsx:2"]),
      files: () => rf.viewFiles === 200 && rf.uiChecks.total === 0 && js(rf.uiChecks.limits) === js([{ code: "view-files", read: 200 }]) && js(rf.limits) === js([]),
      viewCut: () => ro.viewFiles === 200 && js(ro.uiChecks.limits) === js([{ code: "view-files", read: 200 }]) && js(ro.limits) === js([{ code: "view-files", read: 200 }]),
      byLine: () => js(rv.uiChecks.findings.map((x) => x.rule + "@" + x.line)) === js(["outline-removed@2", "click-no-keyboard@6"]),
    });
  }

  { // spec_finish: ONE warning for the warn-level findings nobody silenced, never a blocker, after the raw values' — with or without a
    // registry (without: `designSystem` = {uiChecks, registered: [], unregistered: []}, no `raw`); report-level findings alone say
    // nothing; a feature without +ui reads nothing
    const REGISTRY = "# Design System\n\n| Token | Value | Use |\n|---|---|---|\n| --primary | #1d4ed8 | actions |\n\n| Component | Path | Variants | Notes |\n|---|---|---|---|\n| Button | `src/components/Button.tsx` |  |  |\n";
    const with1 = feature("finish-reg", ["src/checkout/Checkout.tsx", "src/checkout/reset.css"], REGISTRY);
    write(with1.p, "src/checkout/Checkout.tsx", CHECKOUT.replace("className=\"grid transition-all\"", "className=\"grid transition-all\" style={{ color: \"#ff0000\" }}"));
    write(with1.p, "src/checkout/reset.css", RESET);
    const without = feature("finish-noreg", ["src/checkout/Checkout.tsx"]);
    write(without.p, "src/checkout/Checkout.tsx", CHECKOUT);
    const reportOnly = feature("finish-report", ["src/checkout/Grid.tsx"]);
    write(reportOnly.p, "src/checkout/Grid.tsx", "export const G = () => <div className=\"transition-all\">g</div>;\n");
    const plainP = path.join(tmp, "proj-uic-finish-plain");
    S.initProject(plainP, ["core"], "en");
    const plain = S.createFeature(plainP, { name: "Checkout", tracks: ["core"], summary: "x" });
    fs.writeFileSync(path.join(plain.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build\n  - _Implements: src/A.tsx_\n  - _Verify: npm test_\n");
    write(plainP, "src/A.tsx", "export const A = () => <div onClick={go}><img src=\"x\" /></div>;\n");
    const F = (p, slug) => S.finishFeature(p, slug);
    const fw = F(with1.p, with1.slug), fn = F(without.p, without.slug), fr = F(reportOnly.p, reportOnly.slug), fp = F(plainP, plain.slug);
    const M = S.msg("en").finish;
    const uiLine = (w) => (w.warnings || []).filter((x) => / UI anti-patterns? — /.test(x));
    const rawAt = (w) => (w.warnings || []).findIndex((x) => /raw value/.test(x)), uiAt = (w) => (w.warnings || []).findIndex((x) => /UI anti-pattern/.test(x));
    all("1.37 UI checks: spec_finish — one warning for the warn-level findings (silenced and report-level ones never), after the raw values', never a blocker; with a registry `designSystem` gains `uiChecks` {total, byRule, top}; without one it is {uiChecks, registered: [], unregistered: []} and holds no `raw`; a feature whose only finding is report-level, and a feature without +ui, carry none (got " +
      js({ with1: [fw.designSystem, uiLine(fw)], without: [fn.designSystem, uiLine(fn)], report: fr.designSystem, plain: fp.designSystem }) + ")", {
      warning: () => uiLine(fw).length === 1 && uiLine(fw)[0] === M.uiChecks(3, "src/checkout/Checkout.tsx:2 click-no-keyboard; src/checkout/Checkout.tsx:5 img-no-alt; src/checkout/reset.css:3 outline-removed", with1.slug),
      order: () => rawAt(fw) !== -1 && uiAt(fw) === rawAt(fw) + 1,
      result: () => fw.designSystem.raw.total === 1 && js(fw.designSystem.uiChecks) === js({ total: 3, byRule: { "click-no-keyboard": 1, "img-no-alt": 1, "outline-removed": 1 },
        top: [{ rule: "click-no-keyboard", file: "src/checkout/Checkout.tsx", line: 2, value: "<div onClick>" }, { rule: "img-no-alt", file: "src/checkout/Checkout.tsx", line: 5, value: "<img>" },
          { rule: "outline-removed", file: "src/checkout/reset.css", line: 3, value: "*:focus { outline: 0 }" }], limits: [] }),
      noRegistry: () => js(fn.designSystem) === js({ uiChecks: { total: 2, byRule: { "click-no-keyboard": 1, "img-no-alt": 1 }, top: [{ rule: "click-no-keyboard", file: "src/checkout/Checkout.tsx", line: 2, value: "<div onClick>" },
        { rule: "img-no-alt", file: "src/checkout/Checkout.tsx", line: 5, value: "<img>" }], limits: [] }, registered: [], unregistered: [] }) && uiLine(fn).length === 1,
      neverBlocks: () => ![fw, fn].some((x) => (x.blockers || []).some((b) => /anti-pattern|ui-check/.test(b))),
      reportOnly: () => fr.designSystem === undefined && uiLine(fr).length === 0,
      plain: () => fp.designSystem === undefined && uiLine(fp).length === 0,
    });
  }

  { // 1.38: the project's `_UI checks off:_` marker hides a rule PROJECT-WIDE — the feature report's findings, total, byRule never
    // hold it (counted in `off`, the rules alone: the fact is the inventory's), an inline-silenced one stays `silenced`, a finding
    // past a file's cap is counted there too, the focus search never runs for an off outline-removed (49 sheets: no focus-sheets),
    // and finish never warns of it; a registry without the marker keeps the 1.37 shape (no off keys)
    const OFF = "# Design System\n\n_UI checks off: outline-removed (what-input: mouse and touch only), transition-all (kit code), no-reduced-motion (our own setting), img-no-alt_\n";
    const QUIET = lines("*:focus {", "  /* ui-check-off: outline-removed */", "  outline: 0;", "}");
    const LIST = lines("export const L = () => (", "  <ul>", ...Array.from({ length: 201 }, (_, i) => "    <li className=\"transition-all\">Row " + i + "</li>"), "  </ul>", ");");
    const mk = (tag, registry) => {
      const g = feature("off-" + tag, ["src/checkout/Checkout.tsx", "src/checkout/reset.css", "src/checkout/quiet.css", "src/checkout/List.tsx"], registry);
      write(g.p, "src/checkout/Checkout.tsx", CHECKOUT);
      write(g.p, "src/checkout/reset.css", RESET);
      write(g.p, "src/checkout/quiet.css", QUIET);
      write(g.p, "src/checkout/List.tsx", LIST);
      for (let i = 0; i < 49; i++) write(g.p, "src/sheets/s" + String(i).padStart(3, "0") + ".css", ".s" + i + " { color: red; }\n");
      return Object.assign(g, { r: S.designSystemReport(g.p, { name: g.slug }), fin: S.finishFeature(g.p, g.slug) });
    };
    const on = mk("on", OFF), plain = mk("plain", "# Design System\n");
    const u = on.r.uiChecks, M = S.msg("en").finish;
    const ui = (x) => (x.fin.warnings || []).filter((w) => /UI anti-pattern|outline removals? not judged/.test(w));
    all("1.38: `_UI checks off:_` hides a rule project-wide — the feature report counts its findings in `off` (an inline-silenced one stays silenced, one past a file's cap counted too), never in findings / total / byRule; the focus search is not run for it; finish never warns of it; the fact and an entry without a reason are no rule off here; without the marker the 1.37 shape (got " +
      js({ u, plainKeys: Object.keys(plain.r.uiChecks), fin: [on.fin.designSystem, ui(on)], plainFin: ui(plain) }) + ")", {
      listed: () => js(u.findings.map((x) => x.rule)) === js(["click-no-keyboard", "img-no-alt"]) && u.total === 2 && js(u.byRule) === js({ "click-no-keyboard": 1, "img-no-alt": 1 }),
      off: () => js(u.off) === js([{ rule: "outline-removed", reason: "what-input: mouse and touch only", count: 1 }, { rule: "transition-all", reason: "kit code", count: 202 }]),
      ignored: () => js(u.offIgnored) === js([{ entry: "img-no-alt", why: "no-reason" }]),
      silenced: () => u.silenced === 2,
      noSearch: () => js(u.limits) === js([]) && plain.r.uiChecks.limits.some((l) => l.code === "focus-sheets"),
      finish: () => js(on.fin.designSystem.uiChecks.byRule) === js({ "click-no-keyboard": 1, "img-no-alt": 1 }) && js(ui(on)) === js([M.uiChecks(2, "src/checkout/Checkout.tsx:2 click-no-keyboard; src/checkout/Checkout.tsx:5 img-no-alt", on.slug)]),
      plain: () => js(Object.keys(plain.r.uiChecks)) === js(["findings", "total", "byRule", "silenced", "limits"]) && plain.r.uiChecks.byRule["transition-all"] === 202,
    });
  }

  { // every bound that cut what the checks read, or dropped a finding, is named in `uiChecks.limits` with a count and the first
    // file — in the report and in finish's designSystem.uiChecks (review 1 of 1.37: a long line, a file's 200 findings and its
    // 256K read dropped real findings with `limits` empty); a finding past a file's cap is still counted in total / byRule
    const R = (tag, files) => { const g = feature("bounds-" + tag, Object.keys(files)); for (const [rel, text] of Object.entries(files)) write(g.p, rel, text); return Object.assign(g, { r: S.designSystemReport(g.p, { name: g.slug }) }); };
    const b64 = "iVBORw0KGgo" + "A".repeat(2600) + "=";
    const page = lines("<!doctype html>", "<html lang=\"en\">", "<body>", "  <header><img src=\"data:image/png;base64," + b64 + "\" alt=\"Acme\"></header>", "  <main>", "    <h1>Welcome</h1>",
      "    <img src=\"/team.jpg\">", "  </main>", "</body>", "</html>");
    const filler = (k) => Array.from({ length: Math.ceil(k * 1024 / 100) }, () => "x".repeat(99)).join("\n");
    const big = "<!doctype html>\n<!--\n" + filler(270) + "\n-->\n<img src=\"/late.jpg\">\n";
    const exact = (() => { const head = "<!doctype html>\n<!--\n", tail = "\n-->\n<img src=\"/x.jpg\">", pad = 256 * 1024 - head.length - tail.length; return head + ("y".repeat(99) + "\n").repeat(Math.floor(pad / 100)) + "y".repeat(pad % 100) + tail; })();
    const rows = Array.from({ length: 200 }, (_, i) => "    <li className=\"transition-all\">Row " + i + "</li>");
    const list = lines("export const List = () => (", "  <ul>", ...rows, "    <img src=\"/hero.png\" />", "    {/* ui-check-off: img-no-alt */}", "    <img src=\"/spacer.gif\" />", "  </ul>", ");");
    const sheet200 = (focus) => lines(...Array.from({ length: 200 }, (_, i) => ".t" + i + " { transition: all .2s; }"), focus ? ":focus-visible { outline: 2px solid; }" : "", "button { outline: none; }");
    const tokens = ":root {\n" + Array.from({ length: 3000 }, (_, i) => "  --space-" + i + ": " + i + "px; /* " + "s".repeat(60) + " */").join("\n") + "\n}\n* { transition: all .2s; }\n";
    const longline = R("line", { "src/landing/index.html": page });
    const size = R("size", { "src/landing/big.html": big });
    const sizeExact = R("size-exact", { "src/landing/exact.html": exact });
    const capped = R("cap", { "src/landing/List.tsx": list });
    const ownFocus = R("cap-focus", { "src/landing/big.css": sheet200(true) });
    const passFocus = R("cap-pass", { "src/landing/big.css": sheet200(false) });
    write(passFocus.p, "src/styles/focus.css", ":focus-visible { outline: 2px solid; }\n");
    passFocus.r = S.designSystemReport(passFocus.p, { name: passFocus.slug });
    const tagged = R("tag", { "src/landing/A.tsx": lines("export const A = () => (", "  <div onClick={() => go(", ...Array.from({ length: 40 }, (_, i) => "      a" + i + ","), "  <img src=\"after.png\" />", ");") });
    const tokenBig = R("token", { "src/landing/Hero.tsx": "export const Hero = () => <b>hi</b>;\n", "src/app/globals.css": tokens });
    const fin = S.finishFeature(capped.p, capped.slug), finLine = S.finishFeature(longline.p, longline.slug);
    const M = S.msg("en").finish;
    const L = (x) => x.r.uiChecks.limits;
    all("1.37 UI checks: the bounds named in `uiChecks.limits` — line-length (a cut line, the <img> below it judged), view-size (a file past 256K; one of exactly 256K is not), file-findings (past a file's 200: counted in total / byRule / silenced, never listed), tag-length (a read past 30 lines), a token file's view-size; a past-cap removal excused by the file's or the project's focus style is no finding; finish's designSystem.uiChecks carries the same limits, its warning `…` when no warn finding is listed (got " +
      js({ line: [longline.r.uiChecks.total, L(longline)], size: [size.r.uiChecks.total, L(size)], exact: L(sizeExact), cap: [capped.r.uiChecks.total, capped.r.uiChecks.byRule, capped.r.uiChecks.silenced, L(capped)],
        own: [ownFocus.r.uiChecks.total, L(ownFocus)], pass: [passFocus.r.uiChecks.total, L(passFocus)], tag: L(tagged), token: L(tokenBig), fin: fin.designSystem, finLine: finLine.designSystem }) + ")", {
      lineLength: () => longline.r.uiChecks.findings.some((x) => x.rule === "img-no-alt" && x.line === 7) && js(L(longline)) === js([{ code: "line-length", read: 2000, count: 1, file: "src/landing/index.html" }]),
      viewSize: () => size.r.uiChecks.total === 0 && js(L(size)) === js([{ code: "view-size", read: 262144, count: 1, file: "src/landing/big.html" }]) && js(L(sizeExact)) === js([]),
      perFile: () => capped.r.uiChecks.total === 201 && js(capped.r.uiChecks.byRule) === js({ "transition-all": 200, "img-no-alt": 1 }) && capped.r.uiChecks.silenced === 1 &&
        capped.r.uiChecks.findings.length === 50 && js(L(capped)) === js([{ code: "file-findings", read: 200, count: 2, file: "src/landing/List.tsx" }]),
      pastExcused: () => ownFocus.r.uiChecks.total === 200 && js(L(ownFocus)) === js([]) && passFocus.r.uiChecks.total === 200 && js(L(passFocus)) === js([]),
      tagLength: () => js(L(tagged)) === js([{ code: "tag-length", read: 30, count: 1, file: "src/landing/A.tsx" }]),
      tokenFile: () => tokens.length > 262144 && tokenBig.r.viewFiles === 1 && js(L(tokenBig).map((x) => x.code + ":" + x.file)) === js(["view-size:src/app/globals.css"]),
      finish: () => js(fin.designSystem.uiChecks) === js({ total: 1, byRule: { "img-no-alt": 1 }, top: [], limits: L(capped) }) && (fin.warnings || []).includes(M.uiChecks(1, "", capped.slug))
        && js(finLine.designSystem.uiChecks.limits) === js(L(longline)),
    });
  }

  { // review 2 of 1.37 (R2-E1 + R2-E2): a bound never hides a KNOWN candidate silently — when the focus search ends at a bound
    // with unsilenced removals standing, its limit names them (their count — past a file's cap too, never a silenced one — and
    // the first by file then line: a markup file's <style> removal is found after its class list's) and spec_finish says it,
    // alone (no finding) or as the UI warning's last clause; the report's other bounds hide no known candidate: report only
    const PANEL = lines("<style>", "button:focus { outline: none; }", "</style>", "<template>", "  <button class=\"px-2 focus:outline-none\">x</button>", "</template>");
    const QUIET = lines("*:focus {", "  /* ui-check-off: outline-removed */", "  outline: 0;", "}");
    const mk = (tag, files, project) => {
      const g = feature("unjudged-" + tag, Object.keys(files));
      for (const [rel, text] of Object.entries(files)) write(g.p, rel, text);
      for (const [rel, text] of project) write(g.p, rel, text);
      return Object.assign(g, { r: S.designSystemReport(g.p, { name: g.slug }), fin: S.finishFeature(g.p, g.slug) });
    };
    const sheets = Array.from({ length: 49 }, (_, i) => ["src/sheets/s" + String(i).padStart(3, "0") + ".css", ".s" + i + " { color: red; }\n"]);
    const alone = mk("alone", { "src/checkout/Panel.vue": PANEL, "src/checkout/reset.css": RESET, "src/checkout/quiet.css": QUIET }, sheets);
    const withF = mk("with", { "src/checkout/Gallery.tsx": "export const G = () => <img src=\"/a.png\" />;\n", "src/checkout/reset.css": RESET }, sheets);
    const chars = mk("chars", { "src/checkout/reset.css": RESET }, [["src/big/app.css", ".b { color: red; }\n".repeat(21000)]]);
    const past = mk("past", { "src/landing/big.css": lines(...Array.from({ length: 200 }, (_, i) => ".t" + i + " { transition: all .2s; }"), "button { outline: none; }") }, sheets);
    const size = mk("size", { "src/landing/big.html": "<!doctype html>\n<!--\n" + ("y".repeat(99) + "\n").repeat(2800) + "-->\n<img src=\"/late.jpg\">\n" }, []);
    // (R2-D3: every warn finding past a file's cap — the warning reads `— …:`, one ellipsis, in each language)
    const capped = mk("cap5", { "src/landing/List.tsx": lines("export const L = () => (", "  <ul>", ...Array.from({ length: 200 }, (_, i) => "    <li className=\"transition-all\">Row " + i + "</li>"),
      ...Array.from({ length: 5 }, () => "    <img src=\"/x.png\" />"), "  </ul>", ");") }, []);
    const ellipsis = ["en", "pt", "es"].map((l) => S.msg(l).finish.uiChecks(5, "", "x"));
    const M = S.msg("en").finish;
    const ui = (x) => (x.fin.warnings || []).filter((w) => /UI anti-pattern|outline removals? not judged/.test(w));
    const pass = (x) => x.r.uiChecks.limits.find((l) => /^focus-/.test(l.code));
    all("1.37 UI checks: the removals a focus search left unjudged at its bound are named — the limit's count (a silenced one never), the first file:line by file then line (one past a file's cap: its file alone), focus-chars' sheet — and finish says it, alone or as the UI warning's last clause, its designSystem.uiChecks carrying the limit; a view-size cut alone says nothing at finish (got " +
      js({ alone: [pass(alone), ui(alone)], withF: ui(withF), chars: [pass(chars), ui(chars)], past: [pass(past), ui(past)], size: [size.r.uiChecks.limits.map((l) => l.code), ui(size), size.fin.designSystem] }) + ")", {
      limit: () => js(pass(alone)) === js({ code: "focus-sheets", read: 48, count: 3, file: "src/checkout/Panel.vue", line: 2 }) && alone.r.uiChecks.total === 0 && alone.r.uiChecks.silenced === 1,
      alone: () => js(ui(alone)) === js([M.uiUnjudged(3, "src/checkout/Panel.vue:2", 48)]) &&
        js(alone.fin.designSystem.uiChecks) === js({ total: 0, byRule: {}, top: [], limits: alone.r.uiChecks.limits }),
      clause: () => js(ui(withF)) === js([M.uiChecks(1, "src/checkout/Gallery.tsx:1 img-no-alt", withF.slug, M.uiUnjudged(1, "src/checkout/reset.css:3", 48))]),
      chars: () => js(pass(chars)) === js({ code: "focus-chars", read: 0, count: 1, file: "src/checkout/reset.css", line: 3, sheet: "src/big/app.css", chars: 393216, alone: true }) &&
        js(ui(chars)) === js([M.uiUnjudged(1, "src/checkout/reset.css:3", 0, "src/big/app.css", 393216, true)]) && js(chars.fin.designSystem.uiChecks.limits) === js(chars.r.uiChecks.limits),
      pastCap: () => js(pass(past)) === js({ code: "focus-sheets", read: 48, count: 1, file: "src/landing/big.css" }) && js(ui(past)) === js([M.uiUnjudged(1, "src/landing/big.css", 48)]),
      reportOnly: () => js(size.r.uiChecks.limits.map((l) => l.code)) === js(["view-size"]) && js(ui(size)) === js([]) && size.fin.designSystem === undefined,
      noUndefined: () => ![alone, withF, chars, past].some((x) => ui(x).some((w) => /undefined|null|NaN/.test(w))),
      ellipsis: () => js(ui(capped)) === js([M.uiChecks(5, "", capped.slug)]) && ellipsis.every((w) => w.includes(" — …:") && !w.includes("…; …")),
    });
  }

  // --- bounds and cost (step 4: the hostile inputs, as ratios measured at the same moment) -------------------------------------------
  { // a tag's attributes (DS_TAG_ATTRS = 100) and a sheet's depth (DS_BLOCK_DEPTH = 64): past either, not judged
    // (ten attributes a line: the tag stays within its 30 lines)
    const attrs = (n) => lines("export const P = () => (", "  <img src=\"/pixel.gif\"", ...Array.from({ length: Math.ceil((n - 1) / 10) }, (_, l) => "   " + Array.from({ length: Math.min(10, n - 1 - l * 10) }, (_, i) => " data-k" + (l * 10 + i) + "=\"v\"").join("")), "  />", ");");
    const wrap = (n, inner) => lines(...Array.from({ length: n }, () => ".w {"), ...inner, ...Array.from({ length: n }, () => "}"));
    const depth = { judged: got(wrap(63, ["button { outline: none; }"]), "src/deep.scss"), deeper: got(wrap(64, ["button { outline: none; }"]), "src/deep.scss"),
      extent: got(wrap(63, [":focus { outline: none;", "  .x { outline: none; }", "}"]), "src/deep.scss"), near: got(wrap(2, [":focus { outline: none;", "  .x { outline: none; }", "}"]), "src/deep.scss"),
      // what a too-deep block holds is not judged either (its transition), and once it closes the sheet is judged again (130: `a`)
      inside: got(wrap(64, [".t { transition: all .2s; }"]), "src/deep.scss"), after: got(wrap(64, [".t { transition: all .2s; }"]) + "a { outline: none; }\n", "src/deep.scss") };
    all("1.37 UI checks: a tag holding more than 100 attributes is not judged (100: judged); a sheet's block nested past 64 is not, nor what it holds, and a rule whose extent holds one is never a `:focus` candidate; the sheet is judged again after it (got " +
      js({ a100: got(attrs(100), "src/P.tsx"), a101: got(attrs(101), "src/P.tsx"), depth }) + ")", {
      attrs: () => js(got(attrs(100), "src/P.tsx")) === js(["img-no-alt@2"]) && js(got(attrs(101), "src/P.tsx")) === js([]),
      depth: () => js(depth.judged) === js(["outline-removed@64"]) && js(depth.deeper) === js([]),
      extent: () => js(depth.extent) === js([]) && js(depth.near) === js(["outline-removed@3"]),
      inside: () => js(depth.inside) === js([]) && js(depth.after) === js(["outline-removed@130"]),
    });
  }

  { // the cost of hostile inputs (CRIT_1 must-fix 1, the decisions' ruling): each 256K file within 3× plain JSX of the same size —
    // unclosed tags, a line of tag starts one `>` closes (a reader that looked again from each `<` was quadratic: 1,230× on CRIT_1's
    // probe), braces and quotes that never close, a string's tags, runs of focus variants and of `ui-check-off:`, a transition of
    // endless items, a sheet of nothing but `{` (the walker's every block)
    const SIZE = 256 * 1024;
    const fill = (unit) => unit.repeat(Math.ceil(SIZE / unit.length)).slice(0, SIZE);
    const plain = fill(lines("export const Card = ({ title, items, onOpen }) => (", "  <section className=\"card grid gap-2 p-4\">", "    <h2 className=\"text-lg font-medium\">{title}</h2>", "    <ul>",
      "      {items.map((i) => (", "        <li key={i.id}>", "          <a href={i.href} onClick={onOpen}>{i.label}</a>", "        </li>", "      ))}", "    </ul>", "  </section>", ");"));
    const hostile = {
      imgLines: [fill("<img ".repeat(400) + "\n"), "x.tsx"], starts: [fill("<b ".repeat(600) + ">\n"), "x.tsx"], clickOpen: [fill("<div onClick={\n"), "x.tsx"],
      braces: [fill("<img src={a ? (b ? {c: {d: 1}} : x) : y} " + "{".repeat(100) + "\n"), "x.tsx"], quotes: [fill("<img alt=\"" + "'".repeat(200) + "\n"), "x.html"],
      strings: [fill("const s = '<img src=x>' + \"<div onClick={go}>\" + `<a>`;\n"), "x.tsx"], focusRun: [fill("focus:".repeat(400) + "outline-none\n"), "x.tsx"],
      marks: [fill("{/* " + "ui-check-off:".repeat(150) + " */}\n<img src=\"x\" />\n"), "x.tsx"], transition: ["a { transition:\n" + fill("  all .2s,\n") + "}\n", "x.css"],
      nested: [fill("{".repeat(1999) + "\n"), "x.css"],
      // (review 1 of 1.37: the click bodies — nested candidates never closed, unmatched close tags, a control in each body, an
      // expression that never closes in a body)
      clickNest: [fill("<div onClick={go}>".repeat(100) + "x\n"), "x.tsx"], clickClose: [fill("<div onClick={go}>x" + "</b>".repeat(200) + "</div>\n"), "x.tsx"],
      clickControl: [fill("<div onClick={go}>x<button>b</button>\n"), "x.tsx"], clickBrace: [fill("<div onClick={go}>" + "{ (".repeat(300) + "<i>\n"), "x.tsx"],
      // (1.38.0 F0c, font-size-viewport — ITEM_3's K2: runs of `text-[` the pick lets through, a class list of bare viewport sizes
      // ended by a variant one, a sheet of `calc(1vw + 1vw + …)` values each as long as a line is read — the walker keeps a
      // statement's last 2,000 characters —, styles of non-viewport font sizes read to their end)
      textRun: [fill("text-[".repeat(300) + "\n"), "x.tsx"], textList: [fill("<p className=\"" + "text-[5vw] ".repeat(150) + "md:text-[2vw]\">x</p>\n"), "x.tsx"],
      vwCalc: [fill("a { font-size: calc(" + "1vw + ".repeat(300) + "1vw); }\n"), "x.css"], styleRun: [fill("<h1 style=\"" + "font-size: 1rem; ".repeat(100) + "\">x</h1>\n"), "x.html"],
      // (1.38, motion — CRIT_X D4's combined line: `animate-` widens the pick too; runs of it, class lists of motion utilities, a
      // transition of endless transform items, a sheet of keyframes, a style object's endless animation list)
      animRun: [fill("animate-".repeat(300) + "\n"), "x.tsx"], animList: [fill("<i className=\"" + "data-[state=open]:animate-in ".repeat(60) + "\">x</i>\n"), "x.tsx"],
      motionSheet: ["a { transition:\n" + fill("  transform 1s,\n") + "}\n", "x.css"], keyframesRun: [fill("@keyframes k { }\n"), "x.css"],
      animStyle: [fill("const s = { animation: \"" + "spin 1s, ".repeat(100) + "\" };\n"), "x.tsx"],
    };
    const time = (f) => { const ts = []; for (let k = 0; k < 5; k++) { const t0 = process.hrtime.bigint(); f(); ts.push(Number(process.hrtime.bigint() - t0) / 1e6); } ts.sort((a, b) => a - b); return ts[2]; };
    // (a stylesheet is read through the ONE CSS walk the registry's token reader already makes — styleTokens —: its ratio is to
    // the larger of plain JSX and that walk of the same text with an observer that does nothing, so it measures what the
    // checks add; on Node 18's V8 the walk of a sheet of nothing but `{` is itself ~3× plain JSX — the 1.37 Docker run, the
    // same at 457d3da. `raw` ≤ 10× plain JSX still catches a walk that stopped being linear.)
    const noop = { block() {}, statement() {}, close() {} };
    const round = (x) => Math.round(x * 100) / 100;
    run(plain, "x.tsx");
    const sample = remeasure(() => {
      const base = time(() => run(plain, "x.tsx"));
      const ratios = {}, raw = {};
      for (const [k, [text, rel]] of Object.entries(hostile)) {
        run(text, rel);
        const t = time(() => run(text, rel)), walk = /\.css$/.test(rel) ? time(() => T.styleTokens(text, rel, noop)) : 0;
        ratios[k] = round(t / Math.max(base, walk));
        raw[k] = round(t / base);
      }
      return { base: Math.round(base * 10) / 10, ratios, raw };
    }, (s) => Object.keys(s.ratios).every((k) => s.ratios[k] <= 3 && s.raw[k] <= 10));
    all("1.37 UI checks: every hostile 256K input costs at most 3× plain JSX of the same size — a stylesheet 3× the CSS walk it shares, and 10× plain JSX —, measured at the same moment (got " + js(sample) + ")",
      Object.fromEntries(Object.keys(hostile).map((k) => [k, () => sample.ratios[k] <= 3 && sample.raw[k] <= 10])));
  }

  { // the checks against the read they share a text with: uiChecksOf over real-shaped files costs at most 3× rawValuesOf over the
    // same texts (CRIT_X decision 6: the text read once feeds both); finish without a registry costs at most 1.5× the feature
    // report — it IS one (CRIT_X decision 5: measured as a ratio)
    const texts = [];
    for (let k = 0; k < 40; k++) {
      texts.push(["src/components/ui/button.tsx", lines("const v = cva(\"inline-flex transition-all outline-none focus-visible:ring-[3px] rounded-md\", { variants: {} })",
        "export function Button({ asChild, ...props }) {", "  const Comp = asChild ? Slot : \"button\"", "  return <Comp data-slot=\"button\" className={cn(v({ className }))} {...props} />", "}")]);
      texts.push(["src/components/Card.vue", lines("<template>", "  <div class=\"card\" @click=\"open = true\">", "    <img :src=\"cover\" :alt=\"title\" />", "  </div>", "</template>",
        "<style scoped>", ".card { padding: 13px; color: #123456; transition: opacity .2s; }", ".card:focus-visible { outline: 2px solid; }", "</style>")]);
      texts.push(["src/styles/app.scss", lines(":root { --gap: 8px; }", ".nav {", "  a { color: #0a0a0a; &:hover { color: #1d4ed8; } }", "  &:focus-within { box-shadow: 0 0 0 2px $ring; }", "}")]);
    }
    const time = (f) => { const ts = []; for (let k = 0; k < 7; k++) { const t0 = process.hrtime.bigint(); f(); ts.push(Number(process.hrtime.bigint() - t0) / 1e6); } ts.sort((a, b) => a - b); return ts[3]; };
    const checks = () => { for (const [rel, t] of texts) run(t, rel); }, raw = () => { for (const [rel, t] of texts) T.rawValuesOf(t, rel); };
    checks(); raw();
    const g = feature("cost", ["src/checkout/"]);
    for (let i = 0; i < 60; i++) write(g.p, "src/checkout/V" + i + ".tsx", CHECKOUT.repeat(20));
    for (let i = 0; i < 200; i++) write(g.p, "src/other/O" + i + ".tsx", CHECKOUT);
    S.designSystemReport(g.p, { name: g.slug });
    const s = remeasure(() => {
      const c = time(checks), r = time(raw);
      const fin = time(() => T.designSystemFinish(g.p, g.slug)), rep = time(() => S.designSystemReport(g.p, { name: g.slug }));
      return { checks: Math.round(c / r * 100) / 100, finish: Math.round(fin / rep * 100) / 100 };
    }, (x) => x.checks <= 3 && x.finish <= 1.5);
    all("1.37 UI checks: the checks cost at most 3× the raw-value read of the same 120 real-shaped files, and a finish without a registry at most 1.5× the feature report it runs (got " + js(s) + ")", {
      checks: () => s.checks <= 3,
      finish: () => s.finish <= 1.5,
    });
  }

  { // the focus pass's cost (review 1 of 1.37: bounded at 1,000 sheets / 4 MB it made the report 8× slower on 3,000 CSS modules,
    // for nothing — at its bound no removal is judged): the report with the pass AT its bound costs at most 2.5× the same report
    // with no candidate — one project, two features reading the same 80 view files, measured interleaved; the project's 1,000
    // sheets name no focus (a pass bounded past 48 opens more of them; the owner's bar after the follow-up: 2.5×)
    const p = path.join(tmp, "proj-uic-pass-cost");
    S.initProject(p, ["ui"], "en");
    const mk = (name, own) => {
      const f = S.createFeature(p, { name, tracks: ["ui"], summary: "x" });
      fs.writeFileSync(path.join(f.dir, "tasks.md"), "# Tasks\n\n- [ ] 1. [US1] Build\n  - _Requirements: US-1.AC-1_\n  - _Implements: src/views/, " + own + "_\n  - _Verify: npm test_\n");
      return f.slug;
    };
    const A = mk("With", "src/a/reset.css"), B = mk("Without", "src/b/plain.css");
    write(p, "src/a/reset.css", RESET);
    write(p, "src/b/plain.css", ".plain { color: red; }\n");
    for (let i = 0; i < 80; i++) write(p, "src/views/V" + String(i).padStart(3, "0") + ".tsx", CHECKOUT.repeat(5));
    const sheet = (i) => Array.from({ length: 12 }, (_, r) => ".c" + i + "_" + r + " { display: grid; gap: var(--gap); }\n.c" + i + "_" + r + ":hover { color: var(--fg); }\n").join("");
    for (let i = 0; i < 1000; i++) write(p, "src/sheets/d" + String(i % 20).padStart(2, "0") + "/s" + String(i).padStart(4, "0") + ".css", sheet(i));
    const ra = S.designSystemReport(p, { name: A }), rb = S.designSystemReport(p, { name: B });
    const pair = () => { const xa = [], xb = []; for (let k = 0; k < 7; k++) { for (const [xs, slug] of [[xa, A], [xb, B]]) { const t0 = process.hrtime.bigint(); S.designSystemReport(p, { name: slug }); xs.push(Number(process.hrtime.bigint() - t0) / 1e6); } } const med = (xs) => xs.sort((x, y) => x - y)[3]; return { a: Math.round(med(xa)), b: Math.round(med(xb)), ratio: Math.round(med(xa) / med(xb) * 100) / 100 }; };
    const s = remeasure(pair, (x) => x.ratio <= 2.5);
    all("1.37 UI checks: the feature report with the focus pass at its bound (48 of 1,000 project sheets, none naming focus) costs at most 2.5× the same report with no candidate, measured interleaved (got " + js({ s, limits: [ra.uiChecks.limits, rb.uiChecks.limits] }) + ")", {
      atBound: () => js(ra.uiChecks.limits) === js([{ code: "focus-sheets", read: 48, count: 1, file: "src/a/reset.css", line: 3 }]) && js(rb.uiChecks.limits) === js([]),
      ratio: () => s.ratio <= 2.5,
    });
  }

  { // tooling-reference.md names the result keys: spec_scan {designSystem, name}'s `uiChecks` (its keys, the rule ids and levels,
    // the limit codes) and spec_finish's `designSystem.uiChecks` with or without a registry
    const ref = fs.readFileSync(path.join(__dirname, "..", "skills", "dev-spec-driven", "references", "tooling-reference.md"), "utf8");
    const row = (tool) => (ref.split("\n").find((l) => l.startsWith("| `" + tool)) || "");
    const scan = row("spec_scan {designSystem: true}"), finish = row("spec_finish");
    all("1.37 UI checks: tooling-reference's spec_scan {designSystem} row names `uiChecks` — findings (each rule id, its level, file / line / value), total, byRule, silenced, limits (view-files, focus-sheets, focus-chars) — and its spec_finish row `designSystem.uiChecks`, with or without a registry (got " +
      js({ scan: scan.length, finish: finish.length }) + ")", {
      scanKeys: () => ["`uiChecks`", "`total`", "`byRule`", "`silenced`", "`limits`", "`view-files`", "`focus-sheets`", "`focus-chars`", "`rule`", "`level`"].every((k) => scan.includes(k)),
      rules: () => ["zoom-disabled", "img-no-alt", "outline-removed", "click-no-keyboard", "paste-blocked", "transition-all"].every((id) => scan.includes(id)) && /`level` warn/.test(scan) && /`level` report/.test(scan),
      finish: () => finish.includes("`designSystem.uiChecks`") && /with or without a registry/.test(finish) && /no `raw`/.test(finish),
    });
  }
};
