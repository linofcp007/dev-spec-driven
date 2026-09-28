#!/usr/bin/env bash
# A .specs/ as an older dev-spec (<= 1.12) left it: two PT features scaffolded but not implemented, then aged —
# no roadmap.json meta.specVersion, no tracks saved in .state.json, date-only approvals (no fingerprint, no
# approvalHistory, no .history/ snapshots) and no maintained .specs/.gitignore.
. "$(dirname "${BASH_SOURCE[0]}")/../fixtures/lib.sh"
copy_fixture orders-app
ds init core tdd --lang pt
ds create "exportar-csv" core --lang pt --summary "Exportar a lista de encomendas para CSV a partir da linha de comandos."
ds create "cupoes" core tdd --lang pt --summary "Cupões de desconto no carrinho, sem aplicar o mesmo cupão duas vezes."
node - <<'JS'
const fs = require("fs"), path = require("path");
const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const wr = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const roadmap = path.join(".specs", "roadmap.json");
const r = rd(roadmap);
if (r.meta) delete r.meta.specVersion;
wr(roadmap, r);
const approved = { "exportar-csv": ["classification"], cupoes: ["classification", "requirements"] };
for (const [feature, phases] of Object.entries(approved)) {
  const p = path.join(".specs", feature, ".state.json");
  const s = rd(p);
  delete s.tracks;
  delete s.approvalHistory;
  s.approvals = {};
  phases.forEach((ph, i) => { s.approvals[ph] = { at: `2026-03-0${2 + i}T10:00:00.000Z`, by: "Carlos" }; });
  wr(p, s);
  fs.rmSync(path.join(".specs", feature, ".history"), { recursive: true, force: true });
}
fs.rmSync(path.join(".specs", ".gitignore"), { force: true });
JS
git_init_main "chore: specs criadas com o dev-spec 1.10"
