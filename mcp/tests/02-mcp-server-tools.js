"use strict";
// MCP server — the 1.26 tool surface: spec_roadmap_edit, spec_export catalog / changelog / preview, spec_scan coverage, spec_status
// without a name, the hidden aliases (the old names), plugin mode's list, and the CLI's --json for each (the same result).

const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

exports.run = async ({ ok, rpc, S, root, tmp, SERVER, abort, list }) => {
  const js = JSON.stringify;
  const call = async (name, args) => {
    const r = await rpc("tools/call", { name, arguments: args });
    let p = null;
    try { p = JSON.parse(r.result.content[0].text); } catch { p = { raw: r }; }
    return { isError: !!(r.result && r.result.isError), p, error: r.error };
  };
  const CLI = path.join(root, "cli", "dev-spec.js");
  const cli = (args, dir) => {
    const r = spawnSync(process.execPath, [CLI, ...args, "--project", dir], { encoding: "utf8", env: { ...process.env, SPEC_PROJECT_DIR: dir } });
    return { out: r.stdout || "", err: r.stderr || "", code: r.status };
  };
  const cliJson = (args, dir) => { try { return JSON.parse(cli([...args, "--json"], dir).out); } catch { return null; } };
  const drop = (o, ...keys) => { const c = Object.assign({}, o); for (const k of keys) delete c[k]; return c; };
  const removed = ["spec_list", "spec_backlog", "spec_depend", "spec_milestone", "spec_catalog", "spec_changelog", "spec_coverage"];

  const p = path.join(tmp, "proj-126-tools");
  S.initProject(p, ["core", "tdd"], "en");
  S.createFeature(p, "Login", ["core", "tdd"], "Users sign in");
  S.createFeature(p, "Billing", ["core"], "Invoices");
  fs.mkdirSync(path.join(p, "src"), { recursive: true });
  fs.writeFileSync(path.join(p, "src", "app.js"), "module.exports = 1;\n");

  { // the list: 32 tools, none of the folded names; the new and widened schemas
    const names = list.result.tools.map((t) => t.name);
    const tool = (n) => list.result.tools.find((t) => t.name === n) || { inputSchema: { properties: {} } };
    const re = tool("spec_roadmap_edit"), ex = tool("spec_export"), sc = tool("spec_scan"), st = tool("spec_status");
    ok(names.length === 32 && !removed.some((n) => names.includes(n)) && names.includes("spec_roadmap_edit") && names.includes("spec_stop_check") && names.includes("spec_log") &&
      js(re.inputSchema.required) === js(["kind"]) && js(re.inputSchema.properties.kind.enum) === js(["backlog", "depend", "milestone"]) &&
      ["catalog", "changelog"].every((f) => ex.inputSchema.properties.format.enum.includes(f)) && ["since", "milestone", "includeBody"].every((k) => ex.inputSchema.properties[k]) &&
      sc.inputSchema.properties.coverage.type === "boolean" && !st.inputSchema.required && re.annotations.destructiveHint === true && re.annotations.readOnlyHint === false,
      "1.26: tools/list has 32 tools — spec_list / spec_backlog / spec_depend / spec_milestone / spec_catalog / spec_changelog / spec_coverage folded into spec_status, spec_roadmap_edit {kind}, spec_export {format: catalog | changelog} and spec_scan {coverage} (got " + js(names) + ")");
  }

  { // spec_status without a name = spec_list's result (the CLI's `status` without a feature = `list`)
    const all = await call("spec_status", { projectDir: p });
    const blank = await call("spec_status", { name: "  ", projectDir: p });
    const old = await call("spec_list", { projectDir: p });
    const eng = S.listFeatures(p);
    ok(!all.isError && js(all.p) === js(eng) && js(blank.p) === js(eng) && js(old.p) === js(eng) && all.p.features.length === 2 &&
      js(cliJson(["status"], p)) === js(eng) && js(cliJson(["list"], p)) === js(eng),
      "1.26: spec_status without name lists every feature — exactly spec_list's result (the alias too), = `status --json` / `list --json` (got " + js(all.p).slice(0, 200) + ")");
  }

  { // the hidden aliases: the same result as the new tool, validated against the OLD schema, never listed
    const pairs = [
      ["spec_backlog", { action: "add", name: "Later", note: "after launch" }, "spec_roadmap_edit", null],
      ["spec_backlog", { action: "list" }, "spec_roadmap_edit", { kind: "backlog", action: "list" }],
      ["spec_depend", { name: "login", add: ["billing"] }, "spec_roadmap_edit", null],
      ["spec_depend", { name: "login" }, "spec_roadmap_edit", { kind: "depend", name: "login" }],
      ["spec_milestone", { action: "add", name: "M1", date: "2099-01-01", features: ["login"] }, "spec_roadmap_edit", null],
      ["spec_milestone", {}, "spec_roadmap_edit", { kind: "milestone" }],
      ["spec_catalog", {}, "spec_export", { format: "catalog" }],
      ["spec_changelog", { since: "all" }, "spec_export", { format: "changelog", since: "all" }],
      ["spec_coverage", {}, "spec_scan", { coverage: true }],
      ["spec_list", {}, "spec_status", {}],
    ];
    const bad = [];
    for (const [oldName, oldArgs, newName, newArgs] of pairs) {
      const a = await call(oldName, { ...oldArgs, projectDir: p });
      if (!newArgs) { if (a.isError || a.p.ok === false) bad.push(oldName + " " + js(a.p).slice(0, 160)); continue; } // a write through the alias: it ran
      const b = await call(newName, { ...newArgs, projectDir: p });
      if (a.isError || js(drop(a.p, "generatedAt")) !== js(drop(b.p, "generatedAt"))) bad.push(oldName + " ≠ " + newName + ": " + js(a.p).slice(0, 120) + " / " + js(b.p).slice(0, 120));
    }
    const dep = S.setDependency(p, "login");
    const bl = S.backlog(p, "list");
    const ms = S.milestone(p, "list");
    ok(!bad.length && dep.dependsOn.join() === "billing" && bl.backlog.map((x) => x.name).join() === "Later" && ms.milestones.map((m) => m.name).join() === "M1",
      "1.26: each hidden alias (spec_list, spec_backlog, spec_depend, spec_milestone, spec_catalog, spec_changelog, spec_coverage) answers what the new tool answers, and its writes land (got " + js(bad) + ")");
    // the OLD schema decides the refusals: the old required key, an argument only the new tool takes, an old enum
    const depNoName = await call("spec_depend", { projectDir: p });
    const blKind = await call("spec_backlog", { kind: "backlog", action: "list", projectDir: p });
    const catBody = await call("spec_catalog", { includeBody: true, projectDir: p });
    const msBad = await call("spec_milestone", { action: "nope", projectDir: p });
    const unknownTool = await rpc("tools/call", { name: "spec_lists", arguments: {} });
    ok(depNoName.isError && depNoName.p.code === "missing-arguments" && js(depNoName.p.missing) === js(["name"]) &&
      blKind.isError && blKind.p.code === "unknown-argument" && /^Unknown argument for spec_backlog: kind/.test(blKind.p.error) &&
      catBody.isError && catBody.p.code === "unknown-argument" && /spec_catalog takes: write, projectDir/.test(catBody.p.error) &&
      msBad.isError && msBad.p.code === "invalid-arguments" && js(msBad.p.invalid) === js(["action"]) && unknownTool.error && unknownTool.error.code === -32602,
      "1.26: an alias is validated against its OLD schema — spec_depend without name is missing-arguments, spec_backlog {kind} / spec_catalog {includeBody} unknown arguments named by the old tool, spec_milestone's old enum; a mistyped name is still an unknown tool (got " +
      js([depNoName.p.code, blKind.p.error, catBody.p.error, msBad.p.code, unknownTool.error]) + ")");
    // never listed — in either mode — and the prompts / completions know no tool
    const comp = await rpc("completion/complete", { ref: { type: "ref/prompt", name: "spec_backlog" }, argument: { name: "args", value: "" } });
    ok(!list.result.tools.some((t) => removed.includes(t.name)) && !!comp.error,
      "1.26: the aliases are not in tools/list and completion/complete offers nothing for them (got " + js(comp.error || comp.result) + ")");
  }

  { // spec_roadmap_edit: the kind's arguments only — another kind's is refused, nothing runs; a kind's required ones
    const before = fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8");
    const noKind = await call("spec_roadmap_edit", { projectDir: p });
    const badKind = await call("spec_roadmap_edit", { kind: "roadmap", projectDir: p });
    const depNoName = await call("spec_roadmap_edit", { kind: "depend", add: ["billing"], projectDir: p });
    const blDep = await call("spec_roadmap_edit", { kind: "backlog", action: "add", name: "X", dependsOn: ["login"], projectDir: p });
    const msNote = await call("spec_roadmap_edit", { kind: "milestone", action: "add", name: "M2", date: "2099-01-01", features: ["login"], note: "n", projectDir: p });
    const depAction = await call("spec_roadmap_edit", { kind: "depend", name: "login", action: "rm", date: "2099-01-01", projectDir: p });
    const after = fs.readFileSync(path.join(p, ".specs", "roadmap.json"), "utf8");
    const pt = path.join(tmp, "proj-126-tools-pt");
    S.initProject(pt, ["core"], "pt");
    const ptOff = await call("spec_roadmap_edit", { kind: "backlog", order: 2, projectDir: pt });
    const esOff = S.msg("es").args.inapplicable("spec_roadmap_edit", "kind: \"backlog\"", "order", "action, name, note");
    ok(noKind.p.code === "missing-arguments" && js(noKind.p.missing) === js(["kind"]) && badKind.p.code === "invalid-arguments" &&
      depNoName.p.code === "missing-arguments" && js(depNoName.p.missing) === js(["name"]) &&
      blDep.isError && blDep.p.code === "inapplicable-arguments" && js(blDep.p.inapplicable) === js(["dependsOn"]) &&
      /^spec_roadmap_edit \{kind: "backlog"\} does not take dependsOn — nothing was done\. With kind: "backlog" it takes: action, name, note\.$/.test(blDep.p.error) &&
      msNote.p.code === "inapplicable-arguments" && js(msNote.p.inapplicable) === js(["note"]) && depAction.p.code === "inapplicable-arguments" && js(depAction.p.inapplicable) === js(["action", "date"]) &&
      before === after && ptOff.p.code === "inapplicable-arguments" && /não aceita order — nada foi feito/.test(ptOff.p.error) && /no admite order — no se hizo nada/.test(esOff),
      "1.26: spec_roadmap_edit takes its kind's arguments only — another kind's is refused (inapplicable-arguments + `inapplicable`, localized EN / PT / ES), depend needs name, kind is required and an enum; nothing is written (got " +
      js([noKind.p.code, badKind.p.code, depNoName.p.missing, blDep.p.error, msNote.p.inapplicable, depAction.p.inapplicable, ptOff.p.error]) + ")");
    // each kind = the engine call of the CLI command it replaces
    const bl = await call("spec_roadmap_edit", { kind: "backlog", projectDir: p });
    const dp = await call("spec_roadmap_edit", { kind: "depend", name: "login", projectDir: p });
    const ms = await call("spec_roadmap_edit", { kind: "milestone", action: "list", projectDir: p });
    ok(js(bl.p) === js(S.backlog(p, "list")) && js(bl.p) === js(cliJson(["backlog"], p)) && js(dp.p) === js(S.setDependency(p, "login")) &&
      js(dp.p) === js(cliJson(["depend", "login"], p)) && js(ms.p) === js(S.milestone(p, "list")) && js(ms.p) === js(cliJson(["milestone"], p)),
      "1.26: spec_roadmap_edit backlog / depend / milestone = the engine's backlog / setDependency / milestone and the CLI's `backlog` / `depend` / `milestone` --json");
  }

  { // spec_export: catalog and changelog as formats; html / md a preview unless includeBody; another format's argument refused
    const cat = await call("spec_export", { format: "catalog", projectDir: p });
    const catBody = await call("spec_export", { format: "catalog", includeBody: true, projectDir: p });
    const catName = await call("spec_export", { format: "catalog", name: "login", projectDir: p });
    const eng = S.catalog(p);
    ok(!cat.isError && cat.p.ok && cat.p.features.length === 2 && cat.p.markdown === undefined && catBody.p.markdown === eng.markdown &&
      js(drop(catBody.p, "markdown")) === js(cat.p) && catName.p.code === "inapplicable-arguments" && js(catName.p.inapplicable) === js(["name"]) &&
      js(cat.p) === js(cliJson(["catalog"], p)) && js(catBody.p) === js(cliJson(["catalog", "--include-body"], p)) && cli(["catalog"], p).out === eng.markdown,
      "1.26: spec_export {format: catalog} = the old spec_catalog without its markdown (includeBody adds it) = `catalog --json` (--include-body); the human `catalog` still prints the markdown; name is refused (got " +
      js([cat.p.markdown === undefined, catName.p.code]) + ")");
    const catW = await call("spec_export", { format: "catalog", write: true, projectDir: p });
    const ch = await call("spec_export", { format: "changelog", since: "all", projectDir: p });
    const chBody = await call("spec_export", { format: "changelog", since: "all", includeBody: true, projectDir: p });
    const chOff = await call("spec_export", { format: "html", since: "all", milestone: "M1", projectDir: p });
    const csvBody = await call("spec_export", { format: "csv", includeBody: true, projectDir: p });
    const chCli = cliJson(["changelog", "--since", "all"], p);
    ok(catW.p.wrote === true && fs.existsSync(path.join(p, ".specs", "SPECS.md")) && ch.p.ok && ch.p.markdown === undefined && typeof chBody.p.markdown === "string" &&
      js(drop(ch.p, "generatedAt")) === js(drop(chCli || {}, "generatedAt")) && chOff.p.code === "inapplicable-arguments" && js(chOff.p.inapplicable) === js(["since", "milestone"]) &&
      csvBody.p.code === "inapplicable-arguments" && /With format: "csv" it takes: name, write\./.test(csvBody.p.error),
      "1.26: spec_export {format: changelog} = the old spec_changelog (the markdown with includeBody) = `changelog --json`; catalog writes SPECS.md; since / milestone only for changelog, includeBody not for csv (got " +
      js([ch.p.counts, chOff.p.inapplicable, csvBody.p.error]) + ")");
    // html / md: a markdown preview (+ bytes, hint) without write — the whole document only with includeBody (or written)
    const full = S.exportSpecs(p, { name: "login" });
    const fullMd = S.exportSpecs(p, { name: "login", format: "md" });
    const prev = await call("spec_export", { name: "login", projectDir: p });
    const prevRaw = await rpc("tools/call", { name: "spec_export", arguments: { name: "login", projectDir: p } });
    const whole = await call("spec_export", { name: "login", includeBody: true, projectDir: p });
    const md = await call("spec_export", { name: "login", format: "md", projectDir: p });
    const wrote = await call("spec_export", { name: "login", write: true, projectDir: p });
    ok(prev.p.ok && prev.p.content === undefined && prev.p.bytes === Buffer.byteLength(full.content, "utf8") && prev.p.preview.length <= 1500 && prev.p.truncated === true &&
      prev.p.preview === fullMd.content.slice(0, prev.p.preview.length) && /includeBody: true/.test(prev.p.hint) && /\.specs\/exports\/login\.html/.test(prev.p.hint) &&
      prevRaw.result.content[0].text.length < 3000 && full.content.length > 10000 && whole.p.content === full.content && md.p.preview === fullMd.content.slice(0, 1500) &&
      wrote.p.wrote === true && wrote.p.bytes > 0 && js(md.p) === js(cliJson(["export", "login", "--md"], p)) && js(whole.p) === js(cliJson(["export", "login", "--include-body"], p)) &&
      cli(["export", "login", "--md"], p).out === fullMd.content,
      "1.26: spec_export html / md without write return {bytes, preview (≤ 1,500 characters of the markdown), truncated, hint} — the whole document with includeBody or write; = `export --json` (--include-body); the human `export` prints the document (got " +
      js([prev.p.bytes, prev.p.preview && prev.p.preview.length, prevRaw.result.content[0].text.length, full.content.length]) + ")");
  }

  { // spec_scan {coverage: true} = the old spec_coverage = `coverage --json`; cap is the inventory's
    const cov = await call("spec_scan", { coverage: true, projectDir: p });
    const covCap = await call("spec_scan", { coverage: true, cap: 5, projectDir: p });
    const scan = await call("spec_scan", { cap: 50, projectDir: p });
    ok(cov.p.ok && js(cov.p) === js(S.coverage(p)) && js(cov.p) === js(cliJson(["coverage"], p)) && typeof cov.p.coveragePercent === "number" &&
      covCap.p.code === "inapplicable-arguments" && js(covCap.p.inapplicable) === js(["cap"]) && /With coverage: true it takes: no other argument\./.test(covCap.p.error) &&
      scan.p.ok && Array.isArray(scan.p.stack) && scan.p.coveragePercent === undefined,
      "1.26: spec_scan {coverage: true} = S.coverage = `coverage --json`; cap belongs to the inventory (refused with coverage) (got " + js([cov.p.coveragePercent, covCap.p.error]) + ")");
  }

  { // lean replies: spec_upgrade and spec_templates carry no `lines` (the CLI renders them from the structure — --json is the MCP result)
    const up = await call("spec_upgrade", { projectDir: p });
    const tp = await call("spec_templates", { projectDir: p });
    const upCli = cli(["upgrade"], p), tpCli = cli(["templates"], p);
    ok(up.p.ok && up.p.lines === undefined && tp.p.ok && tp.p.lines === undefined && js(up.p) === js(cliJson(["upgrade"], p)) && js(tp.p) === js(cliJson(["templates"], p)) &&
      upCli.out.split("\n")[0] === S.upgradeLines(up.p)[0] && tpCli.out === S.templatesLines(tp.p).join("\n") + "\n" && S.upgradeLines(up.p).length > 3,
      "1.26: spec_upgrade / spec_templates return their structure without `lines` (= `upgrade --json` / `templates --json`); the CLI prints the report rendered from it (upgradeLines / templatesLines) (got " +
      js([Object.keys(up.p), Object.keys(tp.p)]) + ")");
  }

  { // Claude Code plugin mode (SPEC_MCP_APPROVAL_HOOK=on — mcp/servers.json): spec_stop_check and spec_log are not listed, still callable
    const kid = spawn(process.execPath, [SERVER], { env: { ...process.env, SPEC_PROJECT_DIR: p, SPEC_MCP_APPROVAL_HOOK: "on", SPEC_MCP_PROMPTS: "off" }, stdio: ["pipe", "pipe", "inherit"] });
    const waiting = new Map();
    let buf = "", n = 0;
    kid.stdout.on("data", (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const m = JSON.parse(line);
        if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
      }
    });
    const req = (method, params) => new Promise((resolve) => {
      const id = "pm-" + ++n;
      const t = setTimeout(() => abort("1.26 plugin mode: no reply to " + method + " within 15s"), 15000);
      waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
      kid.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
    await req("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    const pl = (await req("tools/list", {})).result.tools;
    const stop = await req("tools/call", { name: "spec_stop_check", arguments: { message: "All done." } });
    const log = await req("tools/call", { name: "spec_log", arguments: { name: "login", gitLog: "" } });
    await new Promise((resolve) => { kid.on("exit", resolve); kid.stdin.end(); });
    const stopP = JSON.parse(stop.result.content[0].text), logP = JSON.parse(log.result.content[0].text);
    const size = (tools) => js(tools).length;
    ok(pl.length === 30 && !pl.some((t) => t.name === "spec_stop_check" || t.name === "spec_log") && list.result.tools.length === 32 &&
      !stop.result.isError && stopP.block === false && typeof stopP.why === "string" && !log.result.isError && logP.ok === true && size(pl) < size(list.result.tools) - 1500,
      "1.26: in Claude Code plugin mode (SPEC_MCP_APPROVAL_HOOK=on) tools/list leaves out spec_stop_check and spec_log (30 tools) — both still answer tools/call (got " +
      js([pl.length, size(pl), stopP.why, logP.ok]) + ")");
  }
};
