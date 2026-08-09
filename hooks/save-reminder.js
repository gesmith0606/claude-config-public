#!/usr/bin/env node
// PreCompact hook: fires only when a long session is about to be compacted.
// Nudges Claude to persist durable learnings before context is lost. Low cost —
// it only injects a short reminder; the actual save happens only if there's
// something worth saving.
const { getKnowledgeVaultPath } = require("../scripts/claude-paths");

const vaultRoot = getKnowledgeVaultPath();

process.stdout.write(
  "Before this context is compacted: persist any durable, non-obvious learnings or " +
    "decisions from this session into the knowledge-vault at " +
    vaultRoot +
    " — add atomic notes, update hot.md and log.md. " +
    "Skip anything already captured in code, git history, or project docs. For a larger " +
    "consolidation, spawn the memory-orchestrator agent."
);
