const { spawnSync } = require("child_process");
const path = require("path");
const { getClaudeHome } = require("./claude-paths");

function main(argv = process.argv.slice(2)) {
  const [relativeScript, ...rest] = argv;
  if (!relativeScript) {
    console.error("Usage: run-claude-entry.js <relative-script> [args...]");
    process.exit(1);
  }

  const target = path.join(getClaudeHome(), relativeScript);
  const result = spawnSync(process.execPath, [target, ...rest], {
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status === null ? 1 : result.status);
}

module.exports = { main };

if (require.main === module) {
  main();
}