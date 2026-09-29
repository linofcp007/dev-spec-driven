"use strict";
// `dev-spec prompts [name] [--args "…"]` = MCP prompts/list · prompts/get (the same module).

const fs = require("fs");
const path = require("path");

exports.run = ({ ok, run, tmp, CLI, require, __dirname }) => {
  // `dev-spec prompts [name] [--args "…"]` = MCP prompts/list · prompts/get (the same module, mcp/lib/prompts-resources.js).
  const PRa1 = require(path.join(__dirname, "..", "mcp", "lib", "prompts-resources.js"));
  const stemsA1 = fs.readdirSync(path.join(__dirname, "..", "commands")).filter((f) => /\.md$/.test(f)).map((f) => f.slice(0, -3));
  const jsonA1 = (r) => { try { return JSON.parse(r.out); } catch { return null; } };

  const listA1 = run(["prompts", "--json"]);
  const listA1j = jsonA1(listA1);
  ok(listA1.code === 0 && listA1j && listA1j.ok === true && listA1j.prompts.length === stemsA1.length && stemsA1.length >= 44 &&
    listA1j.prompts.map((p) => p.name).sort().join() === stemsA1.slice().sort().join() && listA1j.prompts.every((p) => p.description && p.arguments[0].name === "args") &&
    JSON.stringify(listA1j.prompts) === JSON.stringify(PRa1.listPrompts({ lang: "en" })),
    "prompts --json: one prompt per commands/*.md with its description and `args` argument — the list MCP prompts/list sends (+ argumentHint)");
  const humanA1 = run(["prompts"]);
  ok(humanA1.code === 0 && new RegExp("^" + stemsA1.length + " prompt\\(s\\) — one per plugin command").test(humanA1.out) &&
    /^ {2}spec-impact \[feature name\] \[requirements\|design\|test-plan\|eval-plan\|tasks\|steering\] \[--reopen\]$/m.test(humanA1.out) && /^ {2}coverage$/m.test(humanA1.out),
    "prompts: a header, then each prompt with its argument hint and description");

  const getA1 = run(["prompts", "spec-impact", "--args", "login design"]);
  const posA1 = run(["prompts", "spec-impact", "login", "design"]);
  const getA1j = jsonA1(run(["prompts", "spec-impact", "--args", "login design", "--json"]));
  const mcpA1 = PRa1.getPrompt("spec-impact", "login design", { lang: "en" });
  ok(getA1.code === 0 && /^Note for the agent: if no dev-spec-driven skill is available/.test(getA1.out) && /\nArgs: login design\n/.test(getA1.out) && !/\$ARGUMENTS/.test(getA1.out) &&
    posA1.code === 0 && posA1.out === getA1.out && getA1.out === mcpA1.messages[0].content.text && getA1j && JSON.stringify(getA1j) === JSON.stringify(mcpA1),
    "prompts <name> --args \"…\" prints the prompt prompts/get returns ($ARGUMENTS ← args); the words after the name do the same; --json is the MCP-shaped result");
  const noArgA1 = run(["prompts", "spec-impact"]);
  ok(noArgA1.code === 0 && /\nArgs: \n/.test(noArgA1.out), "prompts <name> without arguments: $ARGUMENTS is empty");

  const unkA1 = run(["prompts", "nope"]);
  const unkA1j = run(["prompts", "nope", "--json"]);
  const bothA1 = run(["prompts", "spec", "x", "--args", "y"]);
  const missA1 = run(["prompts", "spec", "--args"]);
  ok(unkA1.code === 1 && /^dev-spec: Unknown prompt 'nope' — one of: .*spec-impact/.test(unkA1.out) && unkA1j.code === 1 && (jsonA1(unkA1j) || {}).ok === false &&
    bothA1.code === 1 && /usage: dev-spec prompts \[name\] \[--args "…"\]/.test(bothA1.out) && missA1.code === 1 && /--args/.test(missA1.out),
    "prompts: an unknown name exits 1 (--json: {ok:false} on stdout); --args plus extra words is a usage error; --args needs a value");

  const ptA1 = path.join(tmp, "pa1-pt");
  run(["init", "--lang", "pt", "--project", ptA1]);
  const ptListA1 = run(["prompts", "--project", ptA1]);
  const ptGetA1 = run(["prompts", "coverage", "--project", ptA1]);
  ok(/^\d+ prompt\(s\) — um por comando do plugin/.test(ptListA1.out) && /^Nota para o agente: se não houver uma skill dev-spec-driven/.test(ptGetA1.out) &&
    /Prompt desconhecido 'x'/.test(run(["prompts", "x", "--project", ptA1]).out),
    "prompts in a PT project: header, preamble and errors in European Portuguese");

  const helpA1 = run(["help"]).out;
  const docA1 = fs.readFileSync(CLI, "utf8").split("*/")[0];
  ok(/prompts \[name\] \[--args "…"\]/.test(helpA1) && /--args "…" \(prompts\)/.test(helpA1) && /prompts \[name\] \[--args "…"\]/.test(docA1) && /prompts: --args "…"/.test(docA1),
    "help and the header docblock list prompts [name] [--args \"…\"] and the --args flag");
};
