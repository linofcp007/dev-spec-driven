"use strict";

/**
 * dev-spec shell completion (1.25) — two jobs, both for cli/dev-spec.js:
 *
 *   complete(args)        `dev-spec __complete features|archived [--project <dir>]` — the hidden call the completion scripts
 *                         make on Tab where a command takes a feature: one slug per line, nothing else, exit 0 always. It runs
 *                         BEFORE the engine loads (cli/dev-spec.js hands it over first thing): Node core only, a small mirror of
 *                         the engine's resolveProjectDir (files.js) and listFeatures (doctor.js / state.js isFeatureFolder) —
 *                         cli/tests/16-conventions-completion.js checks that they agree on several layouts and that no module of
 *                         mcp/lib is loaded. It costs about Node's own startup (it runs on every Tab).
 *   script(shell, model)  the completion script `dev-spec completion <shell>` prints — the template in cli/completion/ filled
 *                         with the CLI's own tables (the model cli/dev-spec.js builds from COMMAND_OPTIONS, COMMAND_ARGS,
 *                         FLAG_VALUES and the facade's value lists): commands, their flags, flag values, positional values.
 *
 * Specs (a positional or a flag value): words to offer, space-separated, or a source the SCRIPT resolves on Tab — @feature /
 * @archived (this lister), @command (the command list), @file / @dir (the shell's own path completion). Every other @source
 * is resolved here, when the script is generated (the model's `sources`).
 */

const fs = require("fs");
const path = require("path");

const SHELLS = ["powershell", "bash", "zsh", "fish"];
const SHELL_ALIASES = { pwsh: "powershell", ps: "powershell" };
const SCRIPT_SOURCES = new Set(["@feature", "@archived", "@command", "@file", "@dir"]);

// ---- the hidden lister (no engine) ----------------------------------------------------------------------------------------

// files.js: RE_UNEXPANDED_VAR / PROJECT_MAX_UP / resolveProjectDir / nearestProject / isNetworkPath; doctor.js isDevSpecDir.
const RE_UNEXPANDED_VAR = /\$\{|^\$[A-Za-z_]|%[A-Za-z_][A-Za-z0-9_]*%/;
const PROJECT_MAX_UP = 64;
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const exists = (p) => { try { fs.statSync(p); return true; } catch { return false; } };
const readdir = (p) => { try { return fs.readdirSync(p); } catch { return []; } };
function isNetworkPath(p) {
  const s = String(p).trim();
  if (!/^[\\/]{2}/.test(s)) return false;
  let rest = s.slice(2);
  if (/^[?.][\\/]/.test(rest)) {
    rest = rest.slice(2);
    if (/^[A-Za-z]:(?:[\\/]|$)/.test(rest)) return false;
    if (!/^UNC[\\/]/i.test(rest)) return true;
    rest = rest.slice(4);
  }
  const host = rest.split(/[\\/]/)[0].toLowerCase();
  return host !== "wsl$" && host !== "wsl.localhost";
}
function isDevSpecDir(dir) {
  const root = path.join(dir, ".specs");
  if (!isDir(root)) return false;
  if (exists(path.join(root, "roadmap.json")) || isDir(path.join(root, "steering"))) return true;
  return readdir(root).some((n) => !n.startsWith(".") && exists(path.join(root, n, ".state.json")));
}
function nearestProject(start) {
  if (isNetworkPath(start)) return null;
  let dir = path.resolve(start);
  for (let i = 0; i < PROJECT_MAX_UP; i++) {
    if ((i === 0 && isDir(path.join(dir, ".specs"))) || isDevSpecDir(dir)) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return null;
}
// files.js expandHome (1.25.1): a leading ~ (alone, ~/ or ~ and a backslash) is the home folder — the CLI expands --project with it.
const RE_HOME_PREFIX = /^~(?=$|[\\/])/;
function expandHome(p) {
  const s = String(p == null ? "" : p);
  return RE_HOME_PREFIX.test(s) ? path.join(require("os").homedir(), s.slice(1)) : s;
}
// --project > SPEC_PROJECT_DIR > CLAUDE_PROJECT_DIR > the nearest folder at or above the working one with a dev-spec .specs/ >
// the working folder (an empty value or one holding an unexpanded variable falls through) — the CLI's resolution.
function resolveProject(arg, env) {
  const e = env || process.env;
  const usable = (v) => (v != null && String(v).trim() && !RE_UNEXPANDED_VAR.test(String(v).trim()) ? String(v).trim() : null);
  // Windows: `--project "C:\dir\"` reaches node as `C:\dir"` — the CLI drops the trailing quote (1.23 review L14)
  const flag = typeof arg === "string" && process.platform === "win32" ? arg.replace(/"+$/, "") : arg;
  const dir = usable(flag) || usable(e.SPEC_PROJECT_DIR) || usable(e.CLAUDE_PROJECT_DIR);
  if (dir) return path.resolve(expandHome(dir));
  const cwd = path.resolve(process.cwd());
  return nearestProject(cwd) || cwd;
}
// doctor.js statusLineProject's null rule (1.25.1, review 7) — the status line's pre-check, before the engine loads: is there a
// folder holding a dev-spec .specs/ at or above one of the candidates (STATUS_MAX_UP levels; an empty / non-string / whole-${VAR} /
// over-long / network candidate skipped)? false → the engine would answer null (an empty line): nothing to load. true → the engine
// decides (it also maps a worktree to its checkout, which only ever starts from a folder this walk finds).
const STATUS_MAX_UP = 40;
function statusProbe(candidates) {
  for (const c of Array.isArray(candidates) ? candidates : []) {
    if (typeof c !== "string" || !c.trim() || /^\$\{[^}]*\}$/.test(c.trim()) || c.length > 4096 || isNetworkPath(c)) continue;
    let dir = path.resolve(expandHome(c.trim()));
    for (let i = 0; i < STATUS_MAX_UP; i++) {
      if (isDevSpecDir(dir)) return true;
      const up = path.dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return false;
}

// 1.25.1 (review 7) — the status line command `statusline --print-config` prints (and /spec-statusline writes into settings.json).
// In a plugin's versioned folder (…/dev-spec-driven/<version>/cli/dev-spec.js) the plain `node "<that path>" statusline` broke at the
// first plugin update (Claude Code removes the old folder 14 days later): the command finds the newest installed <version> holding
// cli/dev-spec.js at each run — the completion scripts' rule (numeric parts, a missing part 0) — in a node one-liner that holds no
// shell syntax but its two double-quoted arguments (no ", $, `, %, !, backslash): cmd.exe, PowerShell, sh and bash pass it alike.
// It sets argv[1] to the CLI it found and requires it (dev-spec.js reads argv.slice(2): `statusline`). A plugin folder whose path
// holds one of those characters, or any other CLI (a clone), gets the plain command.
const STATUSLINE_LAUNCHER = "const f=require('fs'),p=require('path'),b=process.argv[1],k=(s)=>s.split('.').map((x)=>parseInt(x,10)||0)," +
  "c=(x,y)=>{const a=k(x),d=k(y);for(let i=0;i<Math.max(a.length,d.length);i++){const e=(a[i]||0)-(d[i]||0);if(e)return e}return 0};" +
  "let v=[];try{v=f.readdirSync(b).filter((d)=>f.existsSync(p.join(b,d,'cli','dev-spec.js'))).sort(c)}catch(e){}" +
  "if(v.length){process.argv[1]=p.join(b,v[v.length-1],'cli','dev-spec.js');require(process.argv[1])}";
function statuslineCommand(cli) {
  const p = String(cli).split(path.sep).join("/").replace(/\\/g, "/");
  const m = /^(.*\/dev-spec-driven)\/[^/]+\/cli\/dev-spec\.js$/.exec(p);
  if (!m || /["$`%!\\]/.test(m[1])) return { command: `node "${p}" statusline`, follows: false };
  return { command: `node -e "${STATUSLINE_LAUNCHER}" "${m[1]}" statusline`, follows: true };
}

// state.js: slugify, RE_WIN_RESERVED-free (a listing shows what is there), RESERVED_SLUGS / reservedSlug, isFeatureFolder.
const RESERVED_SLUGS = new Set(["steering", "exports", "templates", "tracks"]);
function slugify(name) {
  return String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").replace(/-+$/, "").slice(0, 64).replace(/-+$/, "");
}
function reservedSlug(name, root) {
  const s = String(name).toLowerCase();
  if (!RESERVED_SLUGS.has(s)) return false;
  return !(s !== "steering" && exists(path.join(root, s, ".state.json"))); // a feature made before the name was reserved stays one
}
function isFeatureFolder(name, root) {
  if (name.startsWith(".") || name.startsWith("_") || reservedSlug(name, root)) return false;
  if (slugify(name) === name) return true;
  if (slugify(name) !== name.toLowerCase()) return false;
  try { return fs.realpathSync.native(path.join(root, name.toLowerCase())) === fs.realpathSync.native(path.join(root, name)); } catch { return false; }
}
// The feature folders of a .specs/ (or of its _archive/) as listFeatures lists them: folders (never a link), addressable names.
function featureFolders(base) {
  let ents;
  try { ents = fs.readdirSync(base, { withFileTypes: true }); } catch { return []; }
  return ents.filter((d) => d.isDirectory() && isFeatureFolder(d.name, base)).map((d) => d.name).sort();
}
const featureNames = (projectDir) => featureFolders(path.join(projectDir, ".specs"));
const archivedNames = (projectDir) => featureFolders(path.join(projectDir, ".specs", "_archive"));

// `dev-spec __complete <what> [--project <dir>]` → the names on stdout, one per line. Never an error, never a refusal: a Tab
// gets names or nothing (an unknown <what>, a project without .specs/, anything unreadable).
function complete(args) {
  let out = "";
  try {
    const a = Array.isArray(args) ? args.map(String) : [];
    let project;
    const words = [];
    for (let i = 0; i < a.length; i++) {
      if (a[i] === "--project") project = a[++i];
      else if (a[i].startsWith("--project=")) project = a[i].slice("--project=".length);
      else words.push(a[i]);
    }
    const lister = words[0] === "features" ? featureNames : words[0] === "archived" ? archivedNames : null;
    if (lister && words.length === 1) {
      const names = lister(resolveProject(project));
      if (names.length) out = names.join("\n") + "\n";
    }
  } catch { out = ""; }
  if (out) process.stdout.write(out);
}

// ---- the scripts ------------------------------------------------------------------------------------------------------------

const shellName = (s) => {
  const k = String(s == null ? "" : s).trim().toLowerCase();
  return SHELLS.includes(k) ? k : Object.prototype.hasOwnProperty.call(SHELL_ALIASES, k) ? SHELL_ALIASES[k] : null;
};

// The model's specs → the tables every script holds (keys and words only; @feature / @archived / @command / @file / @dir stay
// sources the script resolves on Tab, every other @source becomes its words here). Positional keys: "<cmd>#<n>" (n = 1 is the
// first word after the command), "<cmd>#*" (every later position, from a spec ending in "..."), "<cmd> <word>#<n>" (the first
// word picks the rest — feature restore, milestone add…). Value keys: "<cmd> --<flag>", or "--<flag>" for every command.
function tables(model) {
  const words = (spec) => {
    if (spec == null) return "";
    const out = [];
    for (const t of String(spec).trim().split(/\s+/).filter(Boolean)) {
      if (!t.startsWith("@") || SCRIPT_SOURCES.has(t)) { out.push(t); continue; }
      const src = Object.prototype.hasOwnProperty.call(model.sources, t.slice(1)) ? model.sources[t.slice(1)] : null;
      if (!Array.isArray(src)) throw new Error("completion: unknown source " + t);
      out.push(...src.map(String));
    }
    return [...new Set(out)].join(" ");
  };
  const args = [];
  for (const [key, list] of Object.entries(model.args)) {
    list.forEach((spec, i) => {
      const s = spec == null ? "" : String(spec);
      const repeat = s.endsWith("...");
      if (repeat && i !== list.length - 1) throw new Error("completion: only the last spec repeats (" + key + ")");
      args.push([key + "#" + (repeat ? "*" : i + 1), words(repeat ? s.slice(0, -3) : s)]);
    });
  }
  const values = Object.entries(model.values).map(([key, spec]) => [key, words(spec)]);
  const flags = model.commands.map((c) => [c, (model.flags[c] || model.globalFlags).join(" ")]);
  return { flags, args, values };
}

// Quoting a literal for each shell: one single-quoted word. PowerShell: text beyond printable ASCII is embedded as base64 —
// Windows PowerShell 5.1 decodes a native command's output (`node … completion powershell > file.ps1`) with the console's OEM
// code page, so a path or a message with an accented letter would reach the script garbled.
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;
const QUOTE = {
  bash: (s) => "'" + String(s).replace(/'/g, "'\\''") + "'",
  zsh: (s) => "'" + String(s).replace(/'/g, "'\\''") + "'",
  fish: (s) => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'",
  powershell: (s) => (PRINTABLE_ASCII.test(String(s)) ? "'" + String(s).replace(/'/g, "''") + "'"
    : "[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + Buffer.from(String(s), "utf8").toString("base64") + "'))"),
};

// One table as the shell's own lookup — bash / zsh: a `case` in a function (bash 3.2 has no associative array) setting
// __dev_spec_r, status 1 for a key it doesn't hold; fish: two parallel lists read with `contains -i` (literal: a `case` pattern
// would read the "*" of "init#*" as a wildcard), the words printed; PowerShell: a hashtable.
function caseTable(shell, fn, rows) {
  const q = QUOTE[shell];
  if (shell === "fish") {
    const keys = fn + "_keys", vals = fn + "_vals";
    return ["set -g " + keys + " " + rows.map((r) => q(r[0])).join(" "), "set -g " + vals + " " + rows.map((r) => q(r[1])).join(" "),
      // (`string join` of ONE word prints it but returns 1 — nothing was joined: the lookup's status is set apart)
      "function " + fn, "    set -l i (contains -i -- $argv[1] $" + keys + "); or return 1", "    string join '' -- $" + vals + "[$i]", "    return 0", "end"].join("\n");
  }
  if (shell === "powershell") return "@{\n" + rows.map(([k, v]) => "        " + q(k) + " = " + q(v)).join("\n") + "\n    }";
  return [fn + "() {", "    case $1 in", ...rows.map(([k, v]) => "        " + q(k) + ") __dev_spec_r=" + q(v) + " ;;"), "        *) return 1 ;;", "    esac", "}"].join("\n");
}

const TEMPLATE_FILE = { bash: "dev-spec.bash", zsh: "dev-spec.zsh", fish: "dev-spec.fish", powershell: "dev-spec.ps1" };

// The script for one shell: its template (cli/completion/dev-spec.<ext>; the lines starting "#@" are notes for maintainers, never
// printed) with each @@NAME@@ filled in one pass. LF line ends whatever the checkout has (bash refuses a CR).
function script(shell, model) {
  const sh = shellName(shell);
  if (!sh) throw new Error("completion: unknown shell " + shell);
  const t = tables(model);
  const q = QUOTE[sh];
  const list = (items) => (sh === "powershell" ? "@(" + items.map(q).join(", ") + ")" : q(items.join(" ")));
  const fill = {
    VERSION: model.version,
    CLI: q(model.cli),
    // the install line in the header comment: the path as it is — in the PowerShell script only while it is plain ASCII (5.1 would
    // read anything else garbled: the line then names the file instead)
    CLI_TEXT: sh !== "powershell" || PRINTABLE_ASCII.test(model.cli) ? model.cli : "<path to cli/dev-spec.js>",
    GONE: q(model.gone),
    COMMANDS: list(model.commands),
    GLOBAL: list(model.rootFlags),
    CMD_GLOBAL: list(model.globalFlags),
    VALUE_FLAGS: sh === "powershell" ? list(model.valueFlags) : model.valueFlags.join(sh === "fish" ? " " : "|"),
    FLAGS: caseTable(sh, "__dev_spec_flags", t.flags),
    ARGS: caseTable(sh, "__dev_spec_arg", t.args),
    VALUES: caseTable(sh, "__dev_spec_val", t.values),
  };
  const raw = fs.readFileSync(path.join(__dirname, "completion", TEMPLATE_FILE[sh]), "utf8").replace(/\r\n?/g, "\n");
  const body = raw.split("\n").filter((l) => !l.startsWith("#@")).join("\n");
  return body.replace(/@@([A-Z_]+)@@/g, (m, k) => (Object.prototype.hasOwnProperty.call(fill, k) ? fill[k] : m));
}

module.exports = { SHELLS, shellName, complete, script, tables, resolveProject, expandHome, statusProbe, STATUSLINE_LAUNCHER, statuslineCommand, featureNames, archivedNames };
