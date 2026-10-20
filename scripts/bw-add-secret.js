#!/usr/bin/env node
// bw-add-secret.js — create (or update) a Bitwarden login item that
// scripts/resolve-secret.js can resolve BY NAME.
//
// Usage:   node scripts/bw-add-secret.js <SECRET_NAME>
//          (the value is read from STDIN, never from argv)
//
//   printf '%s' "$TOKEN" | node scripts/bw-add-secret.js GITHUB_PERSONAL_ACCESS_TOKEN
//   node scripts/bw-add-secret.js DISCORD_WEBHOOK_CLAUDE     # prompts, input hidden
//
// Reading from stdin is deliberate: a value passed as an argv would land in the
// shell history and in the process table for every user on the box.
//
// Requires an UNLOCKED vault — run `bwu` first (exports BW_SESSION).
// NEVER prints the secret value. Verifies by re-reading the item and comparing
// lengths only.
"use strict";

const { spawnSync } = require("child_process");

const NAME_RE = /^[A-Z][A-Z0-9_]*$/;

function bw(args, input) {
  return spawnSync("bw", args, { encoding: "utf8", input, timeout: 20000 });
}

function die(msg, code = 1) {
  process.stderr.write(`bw-add-secret: ${msg}\n`);
  process.exit(code);
}

function readStdin() {
  try {
    return require("fs").readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const name = process.argv[2];
if (!name) die("usage: bw-add-secret.js <SECRET_NAME>   (value on stdin)");
if (!NAME_RE.test(name)) {
  die(`"${name}" should be SCREAMING_SNAKE_CASE — it stands in for an env var of the same name`);
}

// Vault must be usable before we bother collecting the value.
const status = bw(["status"]);
if (status.status !== 0) die("`bw` not available or failed — is the Bitwarden CLI installed?");
let state = "";
try { state = (JSON.parse(status.stdout) || {}).status || ""; } catch { /* ignore */ }
if (state === "unauthenticated") die("not logged in — run: bw login");
if (state !== "unlocked") die("vault is locked — run: bwu   (exports BW_SESSION into your shell)");

const value = readStdin().replace(/\r?\n$/, "");
if (!value) die("no value on stdin — pipe it in, e.g. printf '%s' \"$TOKEN\" | bw-add-secret.js NAME");

// Refuse to silently create a duplicate: resolve-secret.js takes the first match,
// so two items with one name is an ambiguity that bites later, not now.
const existing = bw(["get", "item", name]);
if (existing.status === 0) {
  die(`an item named "${name}" already exists — delete or rename it first, or edit it in Bitwarden`);
}

const tpl = bw(["get", "template", "item"]);
if (tpl.status !== 0) die("could not read item template from bw");

let item;
try { item = JSON.parse(tpl.stdout); } catch { die("bw returned an unparseable item template"); }

item.type = 1;                 // login
item.name = name;
item.notes = "Machine secret resolved by ~/.claude/scripts/resolve-secret.js";
item.login = { username: null, password: value, totp: null };
delete item.secureNote;
delete item.card;
delete item.identity;

const encoded = bw(["encode"], JSON.stringify(item));
if (encoded.status !== 0 || !encoded.stdout.trim()) die("bw encode failed");

// Pipe the encoded item (it carries the password) on stdin, not argv — argv is
// visible in the process table for as long as `bw create` runs.
const created = bw(["create", "item"], encoded.stdout.trim());
if (created.status !== 0) {
  die(`bw create failed: ${(created.stderr || "").trim().split("\n")[0] || "unknown error"}`);
}

// Verify through the SAME path resolve-secret.js will use, so a success here
// means the resolver will actually find it.
const check = bw(["get", "password", name]);
if (check.status !== 0 || check.stdout.trim().length !== value.length) {
  die(`created, but "${name}" did not read back correctly — inspect it in Bitwarden`);
}

process.stderr.write(
  `bw-add-secret: created "${name}" (${value.length} chars) — verified via \`bw get password\`\n` +
  `               resolve with: node ~/.claude/scripts/resolve-secret.js ${name}\n`
);
