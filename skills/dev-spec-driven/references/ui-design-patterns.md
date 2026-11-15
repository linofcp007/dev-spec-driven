# UI Design Patterns — design systems, states, accessibility, performance

A user interface fails in ways a unit test rarely sees: a list that shows a spinner forever when the request
fails, a form that forgets everything after one invalid field, a button a keyboard user can't reach, a label that
overflows in German, a hero image that loads last. None of these is exotic; each is a decision nobody wrote
down. This reference covers those decisions for any user-facing feature: working through the design system,
the states every view needs, forms, responsiveness and dark mode, accessibility to WCAG 2.2 AA and how to test
it, internationalisation, performance budgets, analytics events and visual tests.

It is the reference for the `+ui` track and for any feature that adds or changes a screen, a component or a
flow — web first, with the principles carrying over to native apps.

See also: [api-design-patterns.md](api-design-patterns.md) (the error bodies a UI turns into field messages,
pagination, long-running operations), [privacy-track.md](privacy-track.md) (analytics, consent, personal data
in the UI), [security-track.md](security-track.md) (never trust the client; secrets never in the bundle),
[observability-patterns.md](observability-patterns.md) (real-user monitoring, front-end errors, feature flags),
[code-reuse-and-quality.md](code-reuse-and-quality.md) (search before you build a component),
[test-patterns.md](test-patterns.md) (test layers; snapshot tests only with review),
[load-testing-patterns.md](load-testing-patterns.md) (the back end behind the screen).

---

## Where the decisions go in a spec

- **requirements.md** — the states and the accessibility rules are behaviour, so they are criteria:

  ```markdown
  1. **US-2.AC-1** — WHEN the order list request fails, THE SYSTEM SHALL show an error message with a Retry
     action and keep any orders already shown.
  2. **US-2.AC-2** — IF a submitted form has invalid fields, THEN THE SYSTEM SHALL keep every value the user
     entered, list the errors in a summary and move focus to it.
  3. **US-2.AC-3** — THE SYSTEM SHALL make every action on the checkout page operable with the keyboard alone,
     with a visible focus indicator.
  ```

- **design.md** — the component inventory (reused, extended, new), a **state matrix** per view and the **reference**
  each view is built against (a design export, or an HTML prototype the user approved — its path), the form rules,
  breakpoints, the accessibility plan, i18n decisions and the performance budget.
- **Steering** — the **registry** `design-system.md` (the components and tokens every feature builds from — below),
  the design-system rules in a scoped `ui-components.md` (`dev-spec steering ui-components.md`,
  `inclusion: fileMatch` on the component folders), and the target level in `tech.md`'s Accessibility line
  (`WCAG 2.2 AA`) — see [steering-templates.md](steering-templates.md).
- **Tasks** — accessibility and visual checks are `_Verify:_` commands like any test; the manual keyboard and
  screen-reader passes are tasks of their own, with their findings in the report.

---

## The design system first

A design system is a contract between design and code: **tokens** (the values) and **components** (the
behaviour). A feature that bypasses it creates a fork every later change has to find.

**Tokens, in layers:**

| Layer | Example | Who uses it |
|---|---|---|
| Primitive | `--blue-600: #1d4ed8`, `--space-4: 16px` | only the semantic layer |
| Semantic | `--color-action-primary: var(--blue-600)`, `--space-inline-md: var(--space-4)` | components and pages |
| Component (optional) | `--button-primary-bg: var(--color-action-primary)` | one component |

- **Never a hard-coded colour, spacing, radius, font size, shadow or duration** in feature code where a token exists.
  `#1d4ed8` or `margin: 13px` in a diff is then a finding. A lint rule that rejects raw hex values and pixel literals outside the
  token files makes this mechanical.
- Pages and components use **semantic** tokens — that is what makes dark mode, theming and a rebrand a token
  change instead of a code search.
- **Components before markup.** Use the system's `Button`, `Dialog`, `TextField`: they carry focus handling, ARIA,
  states and tokens you would otherwise re-implement (and get wrong).

**When is a new component justified?**

| Situation | Do |
|---|---|
| An existing component fits | use it |
| It fits with one new visual option | add a **variant** to it (a documented prop), not a copy |
| It is a combination of existing ones | **compose** them in the feature; don't promote yet |
| No existing component can express it, and a second feature will need it | a **new system component** |
| Only this feature needs it | a **local** component in the feature folder — promote it on the third use (the rule of three, [code-reuse-and-quality.md](code-reuse-and-quality.md)) |

**How a component enters the system:** a short proposal (the need, the API — props, slots, events — and why
existing components can't do it) → review by whoever owns the system → built with tokens only, keyboard and
screen-reader support, every state (below) and both themes → documented with an example of each state (a story or
docs page) → visual and component tests → an owner. A component "detached" from the system and restyled in place
is a fork: flag it in review.

### The registry — `.specs/steering/design-system.md`

The contract above only holds when every feature reads the **same** inventory. The registry is that inventory: one
file, two tables — the **tokens** (name · value · use) and the **components** (name · path · variants · notes) —
plus markers kept in English: `_Token sources: tokens.json, src/styles/tokens.css_` (the files that define the
tokens), `_Libraries: @mui/material_` (third-party UI libraries whose components are not listed one by one — each
named as the designs will cite it: its package or its name, `Material UI`; a note that is its package or its acronym
names it too, `Material UI (@mui/material)` — a package or a short name of it wherever a row names it; an acronym
the name does not spell (`Lightning Design System (SLDS)`) and a framework (`Headless UI (react)`) only where a row
cites it — in parentheses or brackets, after a dash, before a colon: `Button (SLDS)`, `Button [SLDS]`,
`Button — SLDS`, `SLDS: Button` —; a version written as one, a range too, or a markdown link is dropped, `antd v5`,
`antd ^5.21`; a name with a bare number is cited without it too — anywhere in a cell when the shorter name is two
words, an acronym or the library's own package in a `package.json` of the project (the root's, a workspace
package's): a dependency of that name, one under a scope that begins with it, or the name joined to a framework's
name, `ui` or `components` (`antd Table` for `antd 5`; `flowbite-react`, `evergreen-ui`,
`carbon-components-svelte`). Else only where a row cites it: `Modal (Bootstrap)` for `Bootstrap 5` in a project
where no manifest it reads holds the package (a CDN, an undeclared sub-folder two levels down) — or say the short
name yourself, `Bootstrap 5 (Bootstrap)`. The name of a framework taken from a bare number or a note (`React 19`,
`Headless UI (react)`) cites only there too) and, in a component's row, `_From: checkout_` (the feature that built it).

| Moment | What happens |
|---|---|
| **Create it** | `steering_scaffold {file: "design-system.md"}` / `dev-spec steering design-system.md` writes it **from the code**: the components it finds, the tokens of the token files and the UI libraries of the project's `package.json` files — the root's and its workspace packages': the folders `workspaces` (package.json), `pnpm-workspace.yaml`, `lerna.json` or `rush.json` declare, or — when none does and the root is no package of its own (its `package.json` has no `dependencies`) — the folders one level down (`frontend/`, `client/`) (what it reads, and what it doesn't: below). Review the rows, then add each component's variants and when to use it — that part is yours. A project template for the file is used as it is instead. Do it before the first +ui feature; on an existing codebase, at adoption. |
| **Design** | `[UI] Design System Usage` lists one row per component: `Kind \| Component \| Why / notes` — **Reuse** (one the registry lists, used as is), **Extend** (a new variant of one it lists), **New** (none it lists fits — say why). A library's component is written `TextField (@mui/material)`; several components may share a cell, separated outside the parentheses, each naming its library (`TextField (@mui/material, outlined), Dialog (@mui/material)`) — a component's name is what stands outside its parentheses. A row whose first cell is none of the three kinds (EN / PT / ES) is no usage row: neither checked nor counted. The first 100 rows are read, and 4,000 characters of a cell. No component at all: one line, `n/a — <why, in four words or more>`. |
| **`spec_doctor`** | `ui-design-system` compares the rows with the registry: a Reuse / Extend the registry doesn't list (with a did-you-mean), a New that is already listed, a New whose name is a listed one's with an affix or an edit away (`ButtonV2`, `NewButton`, `CustomCard`, `Buton` — unless its notes say why that component doesn't fit), a New without a reason, a section with no row. A warning — and for a feature of size **m / l** a failing check the design approval refuses, like Reuse & Integration. No registry yet: a warning that says how to create it, never a refusal — and so for a registry that lists no component and declares no library that is one (a dependency of a `package.json` of the project, or a scoped package such as `@mui/material`); a registry that is library-only on purpose is checked like any other — name the library by its package for that (`@mui/material`, or `Material UI (@mui/material)`): a display name alone only warns, and the warning names the libraries it did not recognise. Saving design.md shows the disagreeing rows at once. |
| **Task brief** | A task that builds a view gets a **Design system** part: the registry's entry of each component the design names (path, variants, notes), the New ones to build *through the system*, the names the registry doesn't list, where the tokens live. |
| **Review** | `spec_scan {designSystem: true, name}` / `dev-spec design-system <feature>`: the rows that disagree with the registry and the **raw values** in the feature's view files (the first 50, with the total) — a hex or `rgb()` colour, a `margin: 13px`, a Tailwind `p-[13px]` — each a candidate finding ("use the token"; a colour equal to a token's value names that token). |
| **Finish** | In a project with a registry: the raw values are a warning of `spec_finish`, never a blocker — when the registry holds tokens or names token files. A READY written finish **adds the feature's New components to the registry** (their path and `_From: <feature>_`) — the next feature finds them there, and the feature's own design keeps saying New. |
| **Later** | `spec_scan {designSystem: true}` / `dev-spec design-system` says what the code holds and the registry doesn't (components and tokens, each as a row to paste; a component an unfinished feature declares New is listed apart — its finish adds it), which rows name a code file of the project that is gone (what is never "gone": the table below), and token files or libraries it doesn't name. "In sync" is said of names: a token whose value changed in the code, a token the code no longer declares and a token file that is gone are not reported — review the token rows when the tokens change. |

**What the check does not do.** It compares names. A new component under an unrelated name (`PrimaryAction` beside
`Button`) passes — finding that one is the reviewer's search ([code-reuse-and-quality.md](code-reuse-and-quality.md)).

**What the code scan reads — and what it doesn't.**

| | Read | Not read |
|---|---|---|
| Components | `.tsx` `.jsx` `.vue` `.svelte` `.astro`, Angular `*.component.ts`, a PascalCase `.js` — under `components/`, `ui/`, `design-system/`, `widgets/`, `atoms/`… (its file's name, or its folder's for an `index`; Next's `_components/` too) — **and every further component a `.tsx` / `.jsx` / `.js` / `.mjs` file exports**: a kit's `card.tsx` is Card, CardHeader, CardTitle, CardContent, each with that file's path (a component with a file of its own keeps its own). What tells one is its declaration and what its statement holds, never its name: an exported function, a class that extends React's `Component` / `PureComponent` (or a component class the file declares above it) or that renders itself — a `render` and JSX in its body, whatever it extends; a decorator on its line or above it aside —, or an exported const whose value is a function (an arrow, typed or generic, on its line or below it), one of React's wrappers (`forwardRef`, `memo`, `lazy` — under the name the file imports React by too: `R.forwardRef`), a `styled` one, a context's `Provider` / `Consumer`, another component under a new name — a name the file imports, declares or borrows (`= DialogPrimitive.Root`; `const { Root } = DialogPrimitive`; `= Origin as Compound`) —, or a call of any other function that shows what it wraps: it renders — JSX in its statement (`observer(() => <div />)`, under another wrapper, after another argument), its last argument list (a later line may open it: `})((props) => …`) beginning with no object, list or element — or loads on demand (`dynamic(() => import("./chart"))`), it is given a `render` that is defined and JSX (`createReactClass({ … })`), or its last argument list is one component the file declares (`withRouter(Nav)`, a cast after it aside) or, curried, imports (`withStyles(styles)(TableCell)`); and a part hung on a component, under the component's name — `Card.Header = …`, the capitalised keys of `Object.assign(Card, { Header })` (around a HOC's call too): the row `Card.Header` — on its declaration (an indented `export` of one too), in an `export { … }` list, as the default or with CommonJS (`exports.X = …`, `module.exports = { … }`) — two parts on one line too; the first 1,000 component files and 4 MB are read for it, the shorter path first, 500 names a file (past a bound the report says `component-files`). **And what the project's other files settle** (1.35.3): a name a file exports that its declaration does not settle — made by a call that shows nothing (`motion(Box)`, `createComponent(config)`, `createSvgIcon(<path />, "Home")`, `createIcon({ … })`, `contextConnect(Menu, "Menu")`), a class that renders through its imported base, a component the rules take for a helper, `export const { Header } = Layout`, a part hung on an imported component, an element whose text at the margin ended its statement, a component folder's barrel (`index.ts`) re-exporting under a name of its own or a package's — is a component when a file of the project RENDERS it (`<MotionBox />`, `<UI.Card.Header>`, `Press <Kbd /> to save`), followed through its imports: a relative path, a workspace package by its manifest's `name` (every folder named like it that bears the name — never an example of the same name —, a subpath below its `src/` too), `@/…`, `~/…`, `#…` or a path of two segments or more from each folder above the file that holds a `package.json` / `tsconfig.json` / `jsconfig.json` (and the project's own folder), its `src/` and `app/` (a tsconfig's `paths` are not read); a namespace, a default import — never another package, even one whose last segment is a folder of the project; and one the rules took on weaker grounds — a call, a function or a class that renders nothing of its own, a part that stands on an import (never a top-level alias of one) — is none when the project CALLS it and never renders it (`FormatPrice(3)`, `new Renderer()`; a story's or a test's call is no sign), gives it to `useContext` / `use` or provides it (`<X.Provider>` — a part of the component named `Provider` is that part), or reads a part as an object (`Button.Sizes.Large`). A context is never a component (`createContext(…)`). The other script files are read up to 5,000 and 32 MB, the ones that may hold JSX first — a `.ts` one only when there is a weak name to settle: it renders nothing —; the search ends there without a word: past it a name stays as its file's rules have it. A call given no function (an arrow, `function`, a method's shorthand) hands an element over and is no component — unless it is given a component's name or a string first (a HOC, an element factory) | a test, a story, a hook (`useToggle`, `use-mobile`), a helper or an entry file (`utils.tsx`, `types.tsx`, `config/index.tsx`, a `main.tsx` / `app.tsx` right inside the component folder, `src/` looked through (`packages/ui/src/main.tsx`) — deeper, `components/layout/main.tsx` IS the component Main; and under a component folder `loading.tsx`, `layout/index.tsx` and Angular's `loading.component.ts` ARE the components Loading and Layout), a framework's special file in a route segment of Next's app router — in a project that depends on `next` or holds a `next.config.*`, a folder between the `app/` that holds the root layout (under a route group or a dynamic segment too: `app/[locale]/layout.tsx`) and a `page.*` / `route.*` at or below it, and its parallel slots: `app/components/page.tsx` and the `loading.tsx` / `error.tsx` / `layout.tsx` beside it are pages (a private `_components/` is no segment; a project without that router has none) —, a barrel (`packages/ui/src/index.tsx`, `icons/index.tsx`), a file whose nearest such folder is a page folder (`components/pages/Home.tsx` — `pages/` `routes/` `views/` `screens/`), a lower-case `.js`; **what a file exports that is no component by its declaration** — a type, a context (`createContext(…)`), an object, a schema, `cva(…)`, any other call, a hook, a re-export of another file of the project under its own name (`export { X } from "./x"`, `export *`) — a PascalCase function that shows it is none — it takes a component (`function WithTheme(Component)`) or three parameters, or the file calls it as a function (`FormatPrice(value)`) and it renders nothing itself —, a call given an object, a list or an element first, whatever JSX it holds (a table's columns, a router's routes, `renderToString(<p />)`), a call given no function and no component's name or string first — its JSX is an element handed over: `mount(root, <App />)`, `createRoot(el).render(<App />)` —, an element in parentheses (`const Logo = (` then `<svg />`), a function called at once, the lines of a template literal (a code sample) — unless the project renders it, above; a literal (a string, an object, a number) never; and a component the reader cannot tell: one of those NO file of the project renders where the reader sees it (a kit whose apps live in another repository; a name rendered only past the bound, or by a default import under another local name in a file that writes none of the names asked; rendered through a re-export outside a component folder's `index.ts` — `export * as Tooltip from "./namespace"` —, a tsconfig `paths` alias spelled like a scope (`@components/*`) or pointing elsewhere than a root's own folder, its `src/` or its `app/` (Laravel's `./resources/js/*`), or a package's `exports` map; rendered only in `.mdx` / `.vue` / `.svelte` or with `React.createElement(X)`), one in a lower-case `.js` file or in a `.ts` file other than a component folder's barrel — add its row by hand, or cite it as `Card (CardHeader)`. (The other way, taken for a component: a PascalCase helper, a part on an imported name that is none (`Button.Sizes = Sizes`), a call whose function renders (`memoize((n) => <Icon />)`) — each while the project never calls it nor reads it as an object —; a top-level alias of an imported name that is none; a call given a string or a capitalised name first whose JSX is an element handed over (`t("hint", { link: <a /> })`, `cloneElement(Base, { icon: <Icon /> })`), one given a method beside an element, given an object with a `render` method, curried around an import (`configureStore(options)(Reducers)`); a class with a `render` that returns JSX the project never constructs. A stray backtick — in an element's text — hides what stands up to the next one, and a template inside another's `${ … }` over lines is read as code; since 1.35.3 a regular expression's backtick is the regex's and a string right after `return` / `case` is a string) |
| Libraries | the UI libraries among the `dependencies`, `devDependencies` and `peerDependencies` of the project's `package.json` files — the root's and its workspace packages': the folders it declares in `workspaces` (package.json), in `packages` of `pnpm-workspace.yaml` / `lerna.json` (Lerna's default `packages/*` only when nothing declares a workspace) or in `projects` of `rush.json` (each `projectFolder`), and the ones a workspace package declares for its own folder (its `workspaces`, two levels deep, as many as can be asked) — a name, a `*` within one, `**` two levels deep, never inside a folder that is a package itself, a brace list expanded (`{apps,libs}/*`, 20 patterns a list), a `!negation` taking out the folders the patterns before it give in `package.json` (npm's order) and wherever it stands in `pnpm-workspace.yaml` (pnpm's; a name, `*`, `**`, a brace list; a workspace package's own for its folder; 200 alternatives, past them said) — or, when it declares none and its root is no app of its own (its `dependencies`), the folders one level down (`frontend/`, `client/`) and, when that level holds no package and the root does not look like a library (not `private`, with a `name`, `peerDependencies`, `main`, `module` or `exports`), the next (`apps/web/`); a bound of that guess is never said — and a workspace file that names nothing it can read is looked through one level. The first 100 workspace manifests, 50 patterns that hold a `*` and 1,000 folders named in full (200 characters and 12 segments each), 200 folders listed, 2,000 asked: past a bound — or for what is declared and not followed (a brace list of one, a `rush.json` that is no JSON, a third level of nesting) — the report says `workspace-manifests` | a manifest three levels below a root that declares no workspace (two, when the first level holds a package), a folder beside the declared ones, a sub-folder of a root that is an app itself (its `docs/`), two levels below one that looks like a library (its `examples/`); a link, a dot folder, `node_modules` |
| Tokens | CSS custom properties, Sass variables and Less variables of `tokens.css`, `_variables.scss`, `variables.less`, `theme.css`…; the leaves of `design-tokens.json` / `*.tokens.json` anywhere, of `theme.json` anywhere but under a folder — at any depth — that holds something else by that name (`store/`, `models/`, `server/`, `types/`, `hooks/`, `scripts/`…), and of a plain `tokens.json` at the project's root or in a `styles/` `theme/` `design/` `tokens/` `ui/` folder (`packages/ui/src/tokens.json` counts: `src/` is looked through); a global stylesheet, wherever it lies (`app/globals.css`, `src/index.css`, a Django `static/` folder, a WordPress theme's `style.css`), with five or more custom properties: every one of a sheet named `globals` / `global`; in a sheet named `index`, `main`, `app`, `styles` / `style`, `base`, `root`, `site`, `application`, `tailwind`, `custom` or `input` (`.css` / `.scss`) those declared FOR THE WHOLE PAGE — on `:root`, `html`, `body` (alone, qualified or in a list, under `@layer` / `@media` too), in Tailwind's `@theme` or a theme plugin's `@plugin`, in a block at least half of which overrides them (`.dark`) or a mixin `:root` includes. A Sass partial of one of those names counts (`_base.scss`). **Only a design value is read out of a file** — a colour, a number with or without a unit, a keyword, a `{reference}`, a function whose arguments are design values themselves (`rgb()` `var()` `calc()` `map-get()`), Sass arithmetic and `#{…}`, alone or as a list. A declaration with no `;` is read when its block or its file ends there, and line by line in an indented `.sass` file | values kept in a JS / TS / YAML file (`tailwind.config.ts` anywhere, `theme.ts`, a `tokens.ts` in those places): the file is listed as a source, its values are not. A plain `tokens.*` anywhere else (`src/tokens.json`, `src/auth/tokens.ts`) and the singular `token.json` are no token files. A stylesheet under any other name (`brand.css`, `card.component.scss`: name a global one in `_Token sources:_`); one that declares its custom properties on a selector of its own (a component's `.card { --card-bg: … }`, in any folder), on `:host`, on a descendant (`body .card`) or — unless it is named `globals` — on a class or an attribute alone with no `:root` block beside it; a CSS module; a sheet with fewer than five such properties; a component rule that re-points one page-wide token beside its own variables — a block is a theme when at least half of what it declares overrides page-wide tokens, and the threshold has two edges: a theme that adds more names of its own than it overrides is not read either (add those rows by hand), a rule of two variables that re-points one is; a twin that brings no name of its own (`main.min.css`, a second app's identical `globals.css` — no further source, still a token file; of identical sheets the source is the likeliest name, then the root-most, then the first by path, which may be a built copy — `public/css/app.css` beside `resources/css/app.css`: `_Token sources:_` is in sync when it names that one). Past 100 candidate files the search ends, the likeliest names (`globals.css`, then `main.css` / `styles.css`…, then `index.css`) and the root-most first. A parameter or a map's key inside parentheses (`@mixin x($border: …)`) is no token. **Any value that is no design value** — a font stack, any `url(…)`, a quoted string, free text, a function holding any of them, and so any credential a file named for tokens may hold: never printed or written (a stylesheet's token, a `$value` or a `value` beside a token `type` is listed by its name alone — so is a composite token, a shadow or a typography, and a declaration that goes on below its line —, any other JSON leaf not at all). **A JSON file that does not show it is a design file** — no design-tokens format (`$value`, with a `$type` of one word when it has one; `value` beside a token `type` that is no word any data holds, such as `time`) and no 3 / 6 / 8-digit hex, functional colour, length or `{reference.path}` in it: a map of numbers (its key names would be printed), a plain `{"spacing": {"sm": 4}}` — is not read: add its rows by hand. **A JSON key that is not words** — a key is printed too: letters, digits, or the two with at most two switches between them (`gray900`, `2xl`, `a11y`; a colour's own 6-digit hex counts), no word of 40 characters —, so a key shaped like a GUID, an API key, a hash or a JWT is left out with everything under it, and so is a token keyed `w1280h720`: add that row by hand. A second layer, not a guarantee — some keys shaped like an API key still pass, the shorter the more often: keep credentials out of files named for tokens. (A stylesheet's own identifiers are listed as written.) Beneath a credential key (`…token`, `…secret`, `…password`, `api_key`…, and `pin` / `otp` / `passcode`) nothing but a literal that says design or a `{reference.path}` is listed, and a free string right under one (those last three aside) makes the file no token file. What stays printed: an identifier the author chose — a function's, a variable's or a reference's NAME — with the value it is part of. Past a bound that cut something — 20 token files, 100 files named like one, a token file longer than 256K characters, 1,000 tokens — the report names it and never says the two are in sync |
| Registry paths (a stale row) | a path cell naming a code file of the project — with a blank, behind a markdown link, beside a note, with a `:12` anchor: gone when no file it names is there | a package (`next/link`), an alias (`~/components/…`), prose or `n/a`, a glob, a path without a file extension, a root-level file, a path whose first folder no longer exists, a document or an image a note cites; a row that also names a file that is there is not stale |
| Raw values | a hex or functional colour in a string, an attribute or a Tailwind `[#…]`; `margin` / `padding` / `gap` / `font-size` / `border-radius` in px / rem / em in a stylesheet, a `<style>` block (a `.vue` / `.svelte` / `.astro` / `.html` file's, styled-jsx's in a `.jsx` / `.tsx`) or a CSS-in-JS declaration line; a Tailwind arbitrary size | a size in a JSX `style={{…}}` object; a token file — a source or its twin —, whole (a rule with a raw value written in the sheet that holds the tokens is not reported); the further lines of a value written over several (`box-shadow: …,` is read by its first line); an anchor or a selector target (`href="#abcdef"`, `data-bs-target="#add"`, `querySelector("#add")`, a 3 / 4-digit `gsap.to("#face")`), a comment, a selector, `rgb(var(--x))`, a 1px hairline, a value built from a variable or `calc()` |

The registry is steering the team owns: edit it by hand at any time (a variant added, a component deprecated in its
notes, a row for a component a feature is still building — with `_From: <feature>_`). It is not part of an approval's
fingerprint, so a new row never asks an approved feature to be re-reviewed; and a design approved under the check is
never *failed* later because the registry moved on (a row renamed, another feature's finish) — doctor warns, until the
design itself is edited and approved again.

---

## The states every view needs

A view that only designs the happy path shows a blank page, a frozen spinner or a raw error the first time
something is slow or wrong. Design each state and write the matrix in design.md:

| State | When | What the user sees | Common mistake |
|---|---|---|---|
| **Loading** | first fetch | skeleton or indicator (below) | a spinner that never ends when the request fails |
| **Empty** — first use | nothing exists yet | what this is for + the primary action ("Create your first invoice") | a bare "No data" |
| **Empty** — no results | a filter or search matched nothing | what was searched + how to broaden it / clear filters | the same text as first use |
| **Error** — recoverable | a request failed | what happened in plain words + **Retry**; keep what was already shown | a toast that disappears while the list stays empty |
| **Partial** | one region failed, others loaded | the failed region shows its own error; the rest works | the whole page failing for one widget |
| **Offline** | no connection | an offline notice; queued or disabled actions; cached data marked as such | silent failures on submit |
| **Permission denied** | signed in, not allowed (403) | why and what to do (ask an admin) — not a 404 look-alike unless hiding existence is the point | a broken page |
| **Signed out / expired** | 401 | a sign-in prompt that returns the user to where they were, input kept | losing the draft |
| **Success** | an action completed | confirmation proportional to the action; the result visible | no feedback, so users click again |
| **Stale** | data may be out of date (cache, eventual consistency) | a timestamp or "updating…" | showing old data as current |

**Loading — pick by duration and certainty.** The classic response-time limits (Nielsen): about **0.1 s** feels
instant, about **1 s** keeps the user's flow, about **10 s** is the limit of attention.

| Technique | Use when | Trade-off |
|---|---|---|
| Nothing | the result arrives in well under a second | an indicator that flashes for 150 ms is noise — many teams delay any indicator by a few hundred milliseconds and, once shown, keep it long enough not to flicker |
| **Skeleton** | the layout is known (lists, cards, profiles) | feels faster and prevents layout shift; costs a skeleton per layout and lies if the real layout differs |
| **Spinner** | a short wait with an unknown shape (a button action, a small panel) | simple; says nothing about progress; put it where the result will appear, not over the whole page |
| **Progress bar** | long, measurable work (upload, export) — past about 10 s | needs real progress data; show what continues in the background |
| **Optimistic update** | the action almost always succeeds and is reversible (like, rename, reorder) | instant; you must roll back visibly and explain when the server says no |

Optimistic updates are wrong for payments, irreversible deletes and anything with a server-side validation that
often fails.

---

## Forms

- **A visible label for every field** — a placeholder is not a label (it disappears as you type and is often too faint
  to meet contrast). Mark required *or* optional fields, consistently.
- **Validation timing**: validate a field when the user **leaves it** (blur), not on every keystroke; once a field
  shows an error, re-validate it **as the user types** so the error disappears as soon as it's fixed. On submit,
  validate everything.
- **Error messages** say what's wrong and how to fix it ("Enter a date in the future", not "Invalid input"), sit
  next to the field, are text (not colour alone), and are tied to the field (`aria-describedby`,
  `aria-invalid="true"`). On submit with errors, show an **error summary** at the top linking to each field and
  move focus to it.
- **Never lose input.** An error — client-side, server-side, a timeout, an expired session — keeps every value
  entered. Server validation errors map back to their fields: a problem+json `errors[].pointer` (`#/email`)
  names the field ([api-design-patterns.md](api-design-patterns.md) → Error format).
- **Double submit**: disable the submit button (or show it busy) while the request is in flight **and** send an
  Idempotency-Key — the button stops the second click, the key stops the retried request.
- **Help the browser help the user**: the right `type` / `inputmode` (`email`, `tel`, `numeric`), `autocomplete`
  tokens for personal data (`email`, `given-name`, `postal-code`, `one-time-code`) — that is WCAG 1.3.5 — and
  never block paste or password managers (3.3.8 Accessible Authentication).
- Don't ask twice for what the user already gave in the same process (3.3.7 Redundant Entry); for legal,
  financial or data-deleting submissions, let the user review, confirm or undo (3.3.4 Error Prevention).

---

## Responsiveness

- **Mobile first, content-driven breakpoints**: add a breakpoint where the layout breaks, not per device model.
  Container queries let a component respond to its own space instead of the viewport.
- **Reflow**: content works at a width of **320 CSS pixels** without horizontal scrolling (WCAG 1.4.10), except
  content that needs two dimensions (maps, data tables, diagrams).
- **Zoom and text size**: usable at 200% text size (1.4.4) and with increased letter / line / paragraph spacing
  (1.4.12) — no fixed-height boxes around text.
- **Touch targets**: design for **44 × 44** (Apple's Human Interface Guidelines use 44 pt, Material 48 dp, WCAG's
  AAA criterion 2.5.5 44 × 44 CSS px); never go below **24 × 24 CSS px** — WCAG 2.2's AA minimum (2.5.8), which
  also accepts a smaller target with enough spacing around it.
- **No hover-only interactions**: touch has no hover. Anything revealed on hover or focus must be dismissible,
  hoverable and persistent (1.4.13).
- **Dragging has an alternative** — a single-pointer way to do the same (buttons to reorder, a menu to move) (2.5.7).
- Don't lock orientation unless it's essential (1.3.4).

## Dark mode through tokens

- Dark mode is a **second set of semantic token values**, never a second stylesheet of overrides. A component
  that only uses semantic tokens gets dark mode for free.
- Follow the system setting (`prefers-color-scheme`), offer an explicit override, persist the choice, and set the
  CSS `color-scheme` property so form controls and scrollbars match.
- **Check contrast in both themes** — a pair that passes on white often fails on dark grey. Avoid pure black
  backgrounds with pure white body text (glare); express elevation with lighter surfaces rather than shadows.
- Images and illustrations: provide dark variants or transparent backgrounds; charts need their own palette.
- Visual tests run in **both** themes.

---

## Accessibility — WCAG 2.2 AA

Target **WCAG 2.2 Level AA** unless steering says otherwise. The criteria that most often decide a feature:

| Area | Criterion (level) | What it asks |
|---|---|---|
| Structure | 1.3.1 Info and Relationships (A) | headings, lists, tables, labels in the markup, not only in the looks |
| | 2.4.1 Bypass Blocks (A) · 2.4.2 Page Titled (A) · 2.4.6 Headings and Labels (AA) | landmarks / skip link, a unique title per page, descriptive headings |
| | 3.1.1 Language of Page (A) | `<html lang="…">` (and `lang` on passages in another language) |
| Text alternatives | 1.1.1 Non-text Content (A) | `alt` that says what the image means; `alt=""` for decoration |
| Colour and contrast | 1.4.1 Use of Color (A) | never colour alone (errors, required fields, chart series, links in text) |
| | 1.4.3 Contrast (Minimum) (AA) | **4.5:1** for text; **3:1** for large text (at least 18 pt, or 14 pt bold) |
| | 1.4.11 Non-text Contrast (AA) | **3:1** for control boundaries, focus indicators, icons, chart elements |
| Keyboard and focus | 2.1.1 Keyboard (A) · 2.1.2 No Keyboard Trap (A) | everything works with the keyboard; focus can always leave |
| | 2.4.3 Focus Order (A) · 2.4.7 Focus Visible (AA) | a logical order; a visible indicator — never `outline: none` without a replacement |
| | 2.4.11 Focus Not Obscured (Minimum) (AA) — new in 2.2 | a sticky header or cookie banner never hides the focused element entirely |
| Pointer | 2.5.7 Dragging Movements (AA) · 2.5.8 Target Size (Minimum) (AA) — both new in 2.2 | a non-drag alternative; targets at least 24 × 24 CSS px |
| Names | 4.1.2 Name, Role, Value (A) · 2.5.3 Label in Name (A) | every control exposes a name and role; the visible label is part of the accessible name |
| Motion | 2.2.2 Pause, Stop, Hide (A) · 2.3.1 Three Flashes (A) | moving or auto-updating content can be paused; nothing flashes more than three times a second |
| Forms and errors | 3.3.1 Error Identification (A) · 3.3.2 Labels or Instructions (A) · 3.3.3 Error Suggestion (AA) | the Forms section above |
| | 3.3.7 Redundant Entry (A) · 3.3.8 Accessible Authentication (Minimum) (AA) — new in 2.2 | don't re-ask; no cognitive tests to sign in (allow paste and password managers) |
| Status | 4.1.3 Status Messages (AA) | "Saved", "3 results", "Upload failed" are announced without moving focus |
| Help | 3.2.6 Consistent Help (A) — new in 2.2 | help links / contact in the same place on every page |

WCAG 2.2 also removed 4.1.1 Parsing. **2.3.3 Animation from Interactions is AAA**, but honouring
`prefers-reduced-motion` costs little: disable parallax, large transitions and auto-playing motion when the user
asks for reduced motion.

**How to build it:**

- **Semantic HTML first.** A `<button>` is focusable, activates on Enter and Space, and announces itself; a
  `<div onclick>` is none of those. The first rule of ARIA (W3C): if a native element has the semantics and
  behaviour you need, use it. ARIA fixes what HTML can't express (tabs, comboboxes, live regions) — and a wrong
  ARIA role is worse than none.
- **Dialogs**: focus moves into the dialog on open, stays inside while it's modal, Escape closes it, and focus
  returns to the element that opened it.
- **Live regions** for status messages: `role="status"` (polite) for "Saved" and result counts, `role="alert"`
  only for what needs immediate attention. The region must exist in the DOM before the text changes.
- **Headings and landmarks**: one `<h1>`, no skipped levels for styling, `<main>`, `<nav>`, `<header>`,
  `<footer>` — screen-reader users navigate by them.
- **Names for icon buttons**: `<button aria-label="Delete invoice INV-114">` — "Delete" alone is ambiguous in a
  list of fifty.

### Testing accessibility

Automated checks find only part of the problems. In a 2017 test by the UK Government Digital Service, the best of
13 tools found 40% of 142 deliberate barriers; Deque's 2021 study of its own audit data reports its axe rules
covering 57% of issues by volume. Either way, the rest needs a person:

| Pass | How | Catches |
|---|---|---|
| **Automated** | axe-core in component and end-to-end tests; an accessibility lint for your framework | missing names and labels, contrast, invalid ARIA, duplicate IDs, missing `lang` |
| **Keyboard** | unplug the mouse: Tab through the flow, operate every control, open and close every dialog | traps, invisible focus, unreachable controls, illogical order, focus lost after an action |
| **Screen reader** | NVDA with Firefox or Chrome (Windows), VoiceOver with Safari (macOS / iOS), TalkBack (Android) — one per platform you ship | meaningless names, missing announcements, reading order, noisy decoration |
| **Zoom and reflow** | 200% text, 400% zoom at 1280 px (≈ 320 px), increased text spacing | clipped text, overlaps, horizontal scrolling |
| **Contrast and motion** | a contrast checker on each theme; the OS reduced-motion setting | failing pairs in dark mode, motion that ignores the setting |

The automated pass is a `_Verify:_`; the manual passes are tasks with a short scripted checklist, and their
findings go in the task report:

```markdown
- [ ] 7. [US2] Keyboard and screen-reader pass of the checkout flow (NVDA + Firefox, VoiceOver + Safari)
  - _Requirements: US-2.AC-3_
- [ ] 8. [US2] Automated accessibility checks on every checkout state
  - _Requirements: US-2.AC-3_
  - _Verify: npx playwright test tests/a11y/checkout.spec.ts_
```

---

## Internationalisation

- **Externalise every user-visible string** — including `alt`, `aria-label`, page titles, emails and error
  messages. Never build sentences by concatenation (`"You have " + n + " items"`): word order differs between
  languages.
- **Plurals and variants with ICU MessageFormat**:

  ```text
  {count, plural,
    =0    {No items in your cart}
    one   {# item in your cart}
    other {# items in your cart}}
  ```

  Languages have different plural categories (CLDR: `zero`, `one`, `two`, `few`, `many`, `other`): English uses
  `one` / `other`, Russian and Polish `one` / `few` / `many` / `other`, Arabic all six, Japanese only `other`. Use
  `select` for grammatical gender or other variants.
- **Right-to-left** (Arabic, Hebrew, Persian, Urdu): set `dir="rtl"` (or `dir="auto"` for user content), use CSS
  **logical properties** (`margin-inline-start`, `padding-block`, `inset-inline-end`) instead of left / right,
  mirror directional icons (back arrows, progress), not universal ones (a play button, a checkmark).
- **Text expansion**: translations are longer. The W3C's summary of IBM guidance: text over 70 characters grows to
  about 130% of the English length; strings up to 10 characters can reach 200–300%. No fixed widths on text
  containers; let buttons and labels wrap; test with **pseudo-localization** (accented, padded strings such as
  `[Ŝåvé çhåñĝéš ~~~~~]`) to find truncation and hard-coded text before translators do.
- **Locale-aware formatting** through the platform (`Intl.DateTimeFormat`, `Intl.NumberFormat`,
  `Intl.RelativeTimeFormat`, `Intl.ListFormat`, `Intl.Collator` for sorting): dates, numbers, currencies, lists.
  Store instants in UTC and display them in the user's time zone; never format a date by string surgery.
- Don't assume name or address shapes (one given name, a family name, a state, a postcode). Fonts must cover the
  scripts you ship.

---

## Performance budgets

**Core Web Vitals** — measured in the field at the **75th percentile** of page loads, mobile and desktop
separately:

| Metric | Measures | Good | Poor |
|---|---|---|---|
| **LCP** — Largest Contentful Paint | loading: when the main content is visible | ≤ 2.5 s | > 4 s |
| **INP** — Interaction to Next Paint | responsiveness to clicks, taps and key presses (replaced FID in 2024) | ≤ 200 ms | > 500 ms |
| **CLS** — Cumulative Layout Shift | visual stability | ≤ 0.1 | > 0.25 |

Lab tools (a local Lighthouse run, a throttled browser profile) find regressions before release; field data (a
real-user monitoring library reporting these metrics) tells you what users get. Budget both.

**Set budgets per route** and fail the local check when a change exceeds them: JavaScript (compressed bytes),
images, fonts, request count, and the three vitals in a lab run on a throttled mobile profile. The numbers are the
team's — write them in steering and enforce them with a size-check script as a `_Verify:_` or a project check
(`dev-spec init --check bundle-size="npm run size"`).

| To improve | Do |
|---|---|
| **LCP** | render the main content on the server or early; preload / `fetchpriority="high"` the LCP image and **never lazy-load it**; compress and size it; avoid render-blocking scripts and styles |
| **INP** | break long tasks (yield to the main thread), avoid re-rendering large trees on each keystroke, move heavy work off the main thread, give instant visual feedback before the slow part |
| **CLS** | `width` / `height` (or `aspect-ratio`) on images and video; reserve space for banners and late content; font fallbacks with matched metrics; never insert content above what the user is reading |
| **Images** | responsive `srcset` / `sizes`, modern formats (AVIF, WebP) with fallbacks, lazy-load below the fold |
| **Bundle** | split by route, tree-shake, audit every new dependency's size before adding it, don't ship polyfills modern browsers don't need |

## Perceived performance

- **Respond within about 0.1 s** to every interaction — a pressed state, a spinner in the button — even when the
  work takes longer.
- **Keep the old content** on screen while the next page loads, instead of a blank page.
- **Skeletons and progressive rendering** (stream the shell, fill regions as data arrives) beat one late,
  complete page.
- **Prefetch on intent** (hover, focus, a link entering the viewport) for the likely next page — within the
  budget and never for heavy resources on metered connections.
- **Optimistic UI** for reliable, reversible actions (the table above).

---

## Analytics events

- **One naming convention**, written in steering — for example `object_action` in the past tense, snake_case:
  `checkout_started`, `invoice_downloaded`, `plan_upgraded`. Consistent names are what make events queryable a
  year later.
- **An event catalogue** (a file in the repository): name, when it fires, properties with types, owner, the
  question it answers. An event nobody can name a question for shouldn't exist.
- **Events are a contract**: renaming one breaks every dashboard built on it — add a new event and retire the old,
  as with API fields ([api-design-patterns.md](api-design-patterns.md) → Compatibility rules).
- **No personal data in event properties**: no emails, names, free-text input, full URLs with query strings that
  carry tokens or search terms; a pseudonymous user ID only if the purpose needs it. Non-essential tracking needs
  the user's consent where the law requires it — the lawful basis, the consent mechanism and the retention are
  [privacy-track.md](privacy-track.md) decisions, recorded in the spec.
- **Test that events fire** with the right properties (a component or end-to-end test asserting the call), and
  delete events that no longer answer a question.

---

## Visual regression and component tests

- **Component tests query like a user**: by role and accessible name (`getByRole("button", { name: "Pay now" })`),
  not by CSS class or test ID — they break on real regressions and double as a check that names exist.
- **Every state is a fixture**: a story or test case per state of the matrix above (loading, empty, error,
  partial…), so none is only reachable by breaking the network.
- **Visual snapshots** for the system's components and key screens, in both themes, at the key breakpoints and in
  one RTL locale. Render them in a pinned environment (a container image with fixed fonts) — the same screenshot
  differs across operating systems and font versions, and a flaky visual suite gets ignored.
- **A human reviews every snapshot diff**; updating snapshots in bulk to make the run green defeats them
  ([test-patterns.md](test-patterns.md) → anti-patterns).
- Don't snapshot everything: snapshots of whole pages with live data fail on every content change and hide real
  regressions in the noise.

**Matching the design — the visual review.** A snapshot only says the screen didn't change since last time. Whether
it is the screen the design asked for is the visual review's question ([ui-review.md](ui-review.md)): each state a
task built is captured beside the view's reference, in the same state and settings, and a reviewer that sees only
the two images lists every difference with its severity and place on screen. No design to compare with? An HTML
prototype the user clicks through and approves before the UI is built is the cheapest reference — and the first
place to settle what the screen should be.

---

## Design checklist

Before the design gate, the design names:

1. **Components** — one row each in `[UI] Design System Usage` (Reuse · Extend · New), agreeing with the registry
   (`.specs/steering/design-system.md`); a new system component's API and owner, and why no listed one fits; tokens
   only, no hard-coded values.
2. **The state matrix** — loading (and which technique), empty (first use and no results), error, partial,
   offline, permission denied, signed out, success, stale — per view.
3. **Forms** — labels, validation timing, messages, the error summary and focus, input kept on every error,
   server errors mapped to fields, double-submit prevention, `autocomplete` tokens.
4. **Layout** — breakpoints, reflow at 320 CSS px, 200% text, touch targets (44 × 44 designed, never under 24 × 24),
   no hover-only or drag-only interactions.
5. **Themes** — semantic tokens for light and dark, the system setting followed, contrast checked in both.
6. **Accessibility** — WCAG 2.2 AA; native elements first; keyboard order and visible focus; names; contrast
   4.5:1 / 3:1; live regions for status messages; dialogs' focus handling; reduced motion.
7. **Accessibility tests** — the automated `_Verify:_`, plus keyboard, screen-reader, zoom and contrast passes as
   tasks.
8. **i18n** — every string externalised, ICU plurals, RTL with logical properties, room for expansion, a
   pseudo-locale run, locale-aware dates, numbers and currencies.
9. **Performance** — the route's budgets (JS, images, fonts, requests) and the Core Web Vitals targets (LCP ≤ 2.5 s,
   INP ≤ 200 ms, CLS ≤ 0.1 at p75), how they're checked locally, the LCP element and how it loads.
10. **Perceived performance** — feedback within 0.1 s, optimistic updates only where reversible.
11. **Analytics** — the events added (catalogue entries), no personal data, consent (with `+privacy`).
12. **Tests** — component tests by role and name, a fixture per state, visual snapshots (themes, breakpoints, RTL)
    in a pinned environment, reviewed by a person.
13. **References** — per view (and per state where it differs), the design export or the approved HTML prototype the
    visual review compares the build with, and its path.
