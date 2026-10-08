"use strict";
// tasks.md written back as its own bytes on the CLI — done / undone on an ANSI code page file, append-tasks refused (review 5, P3).

const fs = require("fs");
const path = require("path");

// Review 5 (P3): a tasks.md in Windows' ANSI code page (Windows PowerShell 5.1's Set-Content) lost every accented letter to
// U+FFFD on one tick. done / undone change the checkbox's byte only; append-tasks is refused (exit 1, PT message, nothing written)
// — the same engine calls as spec_complete_task / spec_append_tasks.
exports.run = ({ ok, run, tmp, require, __dirname }) => {
  const SB = require(path.join(__dirname, "..", "mcp", "lib", "spec.js"));
  const p = path.join(tmp, "r5-bytes");
  SB.initProject(p, ["core"], "pt");
  const f = SB.createFeature(p, "Bytes", ["core"], "", undefined, "pt");
  const file = path.join(f.dir, "tasks.md");
  const ansi = Buffer.from("## Fase 1\r\n- [ ] 1. Validar a sessão\r\n- [ ] 2. Página de início\r\n", "latin1");
  fs.writeFileSync(file, ansi);
  const d = run(["done", f.slug, "1", "--project", p]);
  const afterDone = fs.readFileSync(file);
  const u = run(["undone", f.slug, "1", "--project", p]);
  const afterUndone = fs.readFileSync(file);
  const a = run(["append-tasks", f.slug, "--task", "Nova tarefa", "--project", p]);
  const afterAppend = fs.readFileSync(file);
  const changed = [...afterDone].filter((b, i) => b !== ansi[i]).length;
  ok(d.code === 0 && changed === 1 && afterDone.includes(Buffer.from("- [x] 1.", "latin1")) && u.code === 0 && afterUndone.equals(ansi) &&
    a.code === 1 && /não está gravado em UTF-8/.test(a.out) && afterAppend.equals(ansi),
    "review 5 (P3): done / undone on a tasks.md in an ANSI code page change only the checkbox's byte (accents and CRLF kept); append-tasks refuses it in the feature's language, nothing written (got " +
    JSON.stringify([d.code, changed, u.code, afterUndone.equals(ansi), a.code, a.out.slice(0, 120)]) + ")");
};
