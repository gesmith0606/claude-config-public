#!/usr/bin/env node
// test-resolve-secret.js — exercises the REAL resolve-secret.js against a stubbed
// `bw` binary. No vault, no master password, no network.
//
// Why a stub rather than a unit test of the picker: the shipped code path is
// resolve-secret.js -> spawnSync("bw") -> field selection. Re-implementing the
// selection logic in a test proves only that the test agrees with itself; it
// passes happily while the shipped function is broken. This drives the real CLI.
//
// Run: node scripts/test-resolve-secret.js
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bwtest-"));
const binDir = path.join(tmp, "bin");
const homeDir = path.join(tmp, "home");
fs.mkdirSync(binDir);
fs.mkdirSync(homeDir);

// Pin the backend so env/keychain/op cannot satisfy the lookup and mask a bug.
fs.writeFileSync(
  path.join(homeDir, "machine.json"),
  JSON.stringify({ secrets: { backend: "bitwarden" } })
);

// The stub reads its scripted responses from BWSTUB (a JSON file).
fs.writeFileSync(
  path.join(binDir, "bw"),
  `#!/usr/bin/env node
const fs = require("fs");
const s = JSON.parse(fs.readFileSync(process.env.BWSTUB, "utf8"));
const args = process.argv.slice(2);
if (args[0] === "status") { process.stdout.write(JSON.stringify({status: s.state || "unlocked"})); process.exit(0); }
if (s.state && s.state !== "unlocked") {
  process.stderr.write(s.state === "unauthenticated" ? "You are not logged in." : "Vault is locked.");
  process.exit(1);
}
if (args[0] === "get" && args[1] === "password") {
  const pw = s.item && s.item.login && s.item.login.password;
  if (!pw) { process.stderr.write("Not found."); process.exit(1); }
  process.stdout.write(pw); process.exit(0);
}
if (args[0] === "get" && args[1] === "item") {
  if (!s.item) { process.stderr.write("Not found."); process.exit(1); }
  process.stdout.write(JSON.stringify(s.item)); process.exit(0);
}
process.stderr.write("unsupported"); process.exit(1);
`
);
fs.chmodSync(path.join(binDir, "bw"), 0o755);

const NAME = "MY_KEY";
const cases = [
  ["login password field",      { item: { type: 1, login: { password: "pw-val" }, fields: [] } },                                    "pw-val"],
  ["custom field, exact name",  { item: { type: 1, fields: [{ name: "OTHER", value: "no" }, { name: "MY_KEY", value: "yes" }] } },   "yes"],
  ["custom field, conventional",{ item: { type: 1, fields: [{ name: "token", value: "tok" }] } },                                    "tok"],
  ["lone custom field",         { item: { type: 1, fields: [{ name: "whatever", value: "solo" }] } },                                "solo"],
  ["single-line secure note",   { item: { type: 2, notes: "note-secret", fields: [] } },                                             "note-secret"],
  ["multi-line note refused",   { item: { type: 2, notes: "line one\nline two", fields: [] } },                                      null],
  ["ambiguous fields refused",  { item: { type: 1, fields: [{ name: "a", value: "1" }, { name: "b", value: "2" }] } },               null],
  ["missing item",              {},                                                                                                  null],
  ["vault locked",              { state: "locked" },                                                                                 null],
  ["not logged in",             { state: "unauthenticated" },                                                                        null],
];

let pass = 0, fail = 0;
for (const [label, stub, want] of cases) {
  const stubFile = path.join(tmp, "stub.json");
  fs.writeFileSync(stubFile, JSON.stringify(stub));
  const r = spawnSync(process.execPath, [path.join(__dirname, "resolve-secret.js"), NAME], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH}`, CLAUDE_HOME: homeDir, BWSTUB: stubFile,
           // ensure the env backend cannot answer
           [NAME]: "" },
  });
  const got = r.status === 0 ? r.stdout : null;
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(28)} -> ${JSON.stringify(got)}${ok ? "" : `  (want ${JSON.stringify(want)})`}`);
  // The diagnostics are load-bearing: a locked vault must say so, not just fail.
  if (stub.state === "locked" && !/vault is locked/i.test(r.stderr)) { console.log("       FAIL: locked vault did not emit its diagnostic"); fail++; }
  if (stub.state === "unauthenticated" && !/not logged in/i.test(r.stderr)) { console.log("       FAIL: logged-out vault did not emit its diagnostic"); fail++; }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
