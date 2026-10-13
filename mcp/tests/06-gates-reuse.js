"use strict";
// The design's Reuse & Integration as an approval check at size m / l (1.28) — the gate, doctor, a forced approval, spec_upgrade.

const fs = require("fs");
const path = require("path");

exports.run = async ({ all, rpc, payload, S, tmp, approveBefore }) => {
  const js = (v) => JSON.stringify(v);
  const call = (name, args) => rpc("tools/call", { name, arguments: args });

  // --- the gate: a size m / l design's Reuse & Integration is an approval check; a warning for s / unsized ---
  {
    const REQ = "# Feature: Orders\n\n## Summary\nPlace an order.\n\n## User Stories\n### US-1 (P1): Place an order\nAs a buyer I want to order.\n**Independent Test:** place one order.\n\n" +
      "#### Acceptance Criteria (EARS)\n1. **US-1.AC-1** — WHEN the buyer submits a cart THE SYSTEM SHALL store the order.\n" +
      "2. **US-1.AC-2** — IF the cart is empty THEN THE SYSTEM SHALL reject it.\n\n## Success Criteria\n- **SC-001** — 95% of orders placed in under 2 s.\n\n" +
      "## Edge Cases & Error Handling\n- **EC-1** — WHEN stock runs out THE SYSTEM SHALL refuse the order.\n\n## Non-Functional Requirements\n- **NFR-1** — p95 < 2 s.\n\n## Out of Scope\n- Refunds.\n";
    const REUSE = "## Reuse & Integration\n| Kind | What | Where (path) | Why / notes |\n|---|---|---|---|\n| Reuse | the order repository | `src/orders/repo.js` | it reads and writes orders |\n\n";
    const design = (reuse) => "# Design: Orders\n\n## Overview\nOrders are stored.\n\n## Architecture\n```mermaid\ngraph TD\n  A[API] --> S[Store]\n```\n\n" + reuse +
      "## Alternatives & Trade-offs\n| Decision | Option | Pros | Cons | Cost if wrong | Chosen |\n|---|---|---|---|---|---|\n" +
      "| Storage | One table | Simple | Wide rows | A migration later | ✓ |\n| Storage | Two tables | Normalized | A join per read | Slower reads | ✗ |\n\n" +
      "## Data Models\nOrder {id, total}.\n\n## Error Handling\nSee the IF…THEN criteria.\n\n## Testing Strategy\nUnit tests.\n\n" +
      "## Risks\n- Lost order on a crash — low — one transaction per order.\n\n## Constitution Check\n- [x] Small functions — complies.\n\n## Complexity Tracking\nNone.\n";
    const mk = (tag, size) => {
      const gp = path.join(tmp, "proj-reuse-gate-" + tag);
      S.initProject(gp, ["core"], "en");
      const f = S.createFeature(gp, { name: "Orders", tracks: ["core"], summary: "x", ...(size ? { size } : {}) });
      fs.writeFileSync(path.join(f.dir, "requirements.md"), REQ);
      approveBefore(gp, f.slug, "design");
      return { gp, f, slug: f.slug, dir: f.dir };
    };
    const reuseCheck = (gp, slug) => (S.specDoctor(gp, slug).checks || []).find((c) => c.id === "design-reuse") || {};
    const res = {};
    for (const size of ["m", "l"]) {
      const g = mk(size, size);
      fs.writeFileSync(path.join(g.dir, "design.md"), design(""));
      const doc = reuseCheck(g.gp, g.slug);
      const refused = S.approvePhase(g.gp, g.slug, "design", "t");
      fs.writeFileSync(path.join(g.dir, "design.md"), design("## Reuse & Integration\n\n"));
      const empty = S.approvePhase(g.gp, g.slug, "design", "t");
      fs.writeFileSync(path.join(g.dir, "design.md"), design(REUSE));
      const passed = S.approvePhase(g.gp, g.slug, "design", "t");
      const st = JSON.parse(fs.readFileSync(path.join(g.dir, ".state.json"), "utf8"));
      res[size] = { doc, refused: [refused.ok, refused.failing, (refused.checks || []).find((c) => c.id === "design-reuse")], empty: [empty.ok, empty.failing], passed: passed.ok,
        stamp: st.approvals.design.reuseGate, record: st.approvalHistory.filter((h) => h.phase === "design").pop().reuseGate, after: reuseCheck(g.gp, g.slug).status };
    }
    // forced: recorded with design-reuse among its failing checks — doctor then FAILS it (the gate and doctor agree)
    const fg = mk("forced", "m");
    fs.writeFileSync(path.join(fg.dir, "design.md"), design(""));
    const forced = S.approvePhase(fg.gp, fg.slug, "design", "t", { force: true, reason: "the user accepted it" });
    const forcedDoc = reuseCheck(fg.gp, fg.slug);
    // size s and unsized: a warning, never a refusal on design-reuse
    const sg = mk("s", "s"), ug = mk("unsized", null);
    fs.writeFileSync(path.join(sg.dir, "design.md"), design(""));
    fs.writeFileSync(path.join(ug.dir, "design.md"), design(""));
    const sAp = S.approvePhase(sg.gp, sg.slug, "design", "t"), uAp = S.approvePhase(ug.gp, ug.slug, "design", "t");
    // over MCP the refusal names the check too
    const mg = mk("mcp", "m");
    fs.writeFileSync(path.join(mg.dir, "design.md"), design(""));
    const mcpRef = payload(await call("spec_approve", { projectDir: mg.gp, name: mg.slug, phase: "design" }));
    const m = res.m;
    all("1.28 gate: a size m / l design's Reuse & Integration is an approval check — doctor FAILS design-reuse (missing / empty), the design approval refuses it (MCP too), passes once filled and stamps `reuseGate` (approval + history); forced, it is recorded among the failing checks and doctor still fails it; size s and an unsized feature only warn (got " +
      js({ res, forced: [forced.ok, forced.approvals && forced.approvals.design.failing, forcedDoc.status], s: [sAp.ok, sAp.failing, reuseCheck(sg.gp, sg.slug).status], unsized: [uAp.ok, uAp.failing], mcp: mcpRef.failing }) + ")", {
      ...Object.fromEntries(["m", "l"].map((size) => [size, () => res[size].doc.status === "fail" && /— a size (m|l) design needs it before its approval$/.test(res[size].doc.detail) &&
        res[size].refused[0] === false && js(res[size].refused[1]) === js(["design-reuse"]) && /^no Reuse & Integration section/.test(res[size].refused[2].detail) &&
        res[size].empty[0] === false && js(res[size].empty[1]) === js(["design-reuse"]) && res[size].passed === true && res[size].stamp === true && res[size].record === true && res[size].after === "pass"])),
      forced: () => forced.ok === true && js(forced.approvals.design.failing) === js(["design-reuse"]) && forced.approvals.design.reuseGate === true && forcedDoc.status === "fail",
      small: () => sAp.ok === true && !(sAp.failing || []).length && reuseCheck(sg.gp, sg.slug).status !== "fail",
      unsized: () => uAp.ok === true && reuseCheck(ug.gp, ug.slug).status === "warn",
      mcp: () => mcpRef.ok === false && js(mcpRef.failing) === js(["design-reuse"]),
      template: () => m.doc.status === "fail",
    });

    // a design approved before 1.28 (no reuseGate stamp) without the section: never failed retroactively — doctor keeps the warning
    // (naming what its next approval needs), spec_upgrade lists it (attention design-reuse, the item), apply touches no approval
    const lg = mk("legacy", "m");
    fs.writeFileSync(path.join(lg.dir, "design.md"), design(""));
    S.approvePhase(lg.gp, lg.slug, "design", "t", { force: true });
    const sp = path.join(lg.dir, ".state.json");
    const st = JSON.parse(fs.readFileSync(sp, "utf8"));
    for (const k of ["reuseGate", "forced", "failing"]) delete st.approvals.design[k];
    for (const h of st.approvalHistory) for (const k of ["reuseGate", "forced", "failing"]) delete h[k];
    fs.writeFileSync(sp, JSON.stringify(st, null, 2));
    const before = fs.readFileSync(sp, "utf8");
    const legacyDoc = reuseCheck(lg.gp, lg.slug);
    const up = payload(await call("spec_upgrade", { projectDir: lg.gp }));
    const upF = up.features.find((x) => x.name === lg.slug);
    const lines = S.upgradeLines(up).join("\n");
    S.specUpgrade(lg.gp, { apply: true });
    const after = JSON.parse(fs.readFileSync(sp, "utf8"));
    const upFilled = (() => { fs.writeFileSync(path.join(lg.dir, "design.md"), design(REUSE)); return S.specUpgrade(lg.gp).features.find((x) => x.name === lg.slug); })();
    all("1.28 gate: a size m design approved before 1.28 without its Reuse & Integration — doctor warns (approved before 1.28, its next approval needs it), spec_upgrade lists it (attention `design-reuse`, designReuseDue, the item), apply edits no approval; once written the item goes (got " +
      js({ legacyDoc, attention: upF.attention, due: upF.designReuseDue, item: lines.split("\n").filter((l) => /Reuse & Integration/.test(l)), after: after.approvals.design.reuseGate, filled: upFilled.attention }) + ")", {
      doctor: () => legacyDoc.status === "warn" && /— approved before 1\.28: a size m design needs it at its next approval$/.test(legacyDoc.detail),
      attention: () => upF.attention.includes("design-reuse") && upF.designReuseDue === true && upF.group === "attention",
      item: () => lines.includes(S.msg("en").upgrade.item.designReuse(lg.slug)),
      untouched: () => after.approvals.design.reuseGate === undefined && js(after.approvals.design) === js(JSON.parse(before).approvals.design),
      filled: () => upFilled.designReuseDue === false && !upFilled.attention.includes("design-reuse"),
    });
  }

};
