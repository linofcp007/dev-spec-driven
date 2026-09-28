---
description: Show the dev-spec status line in Claude Code — the most active feature, its tasks, unverified ticks and the next step, one line under the prompt (writes the settings.json entry only after you confirm). PT - mostra a status line do dev-spec no Claude Code. ES - muestra la status line de dev-spec en Claude Code.
argument-hint: "[--user | --project] [--remove]"
---

Use the **dev-spec-driven** skill.

Args: $ARGUMENTS

**What it shows.** `dev-spec statusline` reads the session JSON Claude Code sends to a status line command, finds the
project's `.specs/` (the nearest one at or above the session's folder) and prints one line in the project language, e.g.
`◆ billing · 4/9 tasks · 1 unverified · next: approve tasks` — the feature with work under way that changed last (else the
most recently active one), its task progress, ticks without verification evidence and the next step (spec_next_action's
step, kept cheap: it never runs the doctor, scans the code or hashes the finished files — so a finished feature reads
"finished", never "clean"; drift is `/spec-drift`'s). Outside a dev-spec project (or in a network folder) it prints nothing;
it always exits 0, never writes anything and runs locally (no tokens).

**Steps**
1. Get the entry with this plugin's absolute path:
   `node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" statusline --print-config` (add `--json` for the bare JSON).
2. Target: `--user` (default) → `~/.claude/settings.json` (every project — it stays silent outside dev-spec projects);
   `--project` → the project's `.claude/settings.local.json` (this machine only — the command holds an absolute path of this
   machine, so never put it in the committed `.claude/settings.json`). Say which file and show the exact `"statusLine"`
   entry before writing anything.
3. Write only after the user says yes. Change only the `statusLine` key and keep every other setting as it is. If a
   `statusLine` is already there, show it and ask before replacing it (a custom script can also call ours and print both).
4. `--remove`: delete the `statusLine` key only when its command is this one (`dev-spec.js" statusline`); otherwise say
   what is there and leave it.
5. Tell the user: it appears after the next assistant message (Claude Code runs it after each one); it needs the folder's
   workspace trust, like hooks; test it with
   `echo '{"cwd": "<project>"}' | node "${CLAUDE_PLUGIN_ROOT}/cli/dev-spec.js" statusline`. A plugin installed from a git
   marketplace lives in a versioned cache folder (`…/plugins/cache/…/<version>/`): after a plugin update, run
   `/spec-statusline` again (Claude Code removes the old version 14 days after an update). A clone added as a local
   marketplace (or `--plugin-dir`) loads in place and keeps its path.

Respond in the user's language (EN/PT/ES).
