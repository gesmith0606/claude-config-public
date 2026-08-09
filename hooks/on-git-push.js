#!/usr/bin/env node
// PostToolUse(Bash) hook: when a real `git push` runs, nudge a lightweight memory
// consolidation into the knowledge-vault. Fires only on push (a deliberate, infrequent
// checkpoint), so token cost stays low. Silent for every other Bash command.
//
// Injects context back to the model via hookSpecificOutput.additionalContext — the
// documented mechanism for PostToolUse to add guidance the model will act on.

const { getKnowledgeVaultPath } = require("../scripts/claude-paths");

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  const vaultRoot = getKnowledgeVaultPath();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    process.exit(0); // not parseable — do nothing
  }

  const cmd = (data && data.tool_input && data.tool_input.command) || "";

  // Match an actual git push; ignore dry-runs and incidental mentions of "push".
  const isPush = /(^|[;&|]|\s)git(\s+-\S+)*\s+push\b/.test(cmd);
  const isDryRun = /--dry-run\b/.test(cmd);
  if (!isPush || isDryRun) process.exit(0);

  const nudge =
    "You just ran `git push` — a natural checkpoint to consolidate memory. Do a QUICK, " +
    "lightweight save into the knowledge-vault (" +
    vaultRoot +
    "): if " +
    "anything durable or non-obvious was learned or decided this session, add/update an " +
    "atomic note, refresh the 'Now' section of hot.md, and append one dated line to log.md. " +
    "Keep it brief and skip anything already captured in the code, the commit message, or " +
    "project docs. Only spawn the memory-orchestrator agent if this was a large multi-topic " +
    "session worth a fuller consolidation.";

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: nudge,
      },
    })
  );
  process.exit(0);
});
