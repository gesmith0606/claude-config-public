#!/usr/bin/env node
// Local MCP server: exposes ComfyUI image generation as a `generate_image` tool.
// Reuses the workflows proven by the comfyui-local-image skill. Runs natively on
// Windows Node (no Python). Everything stays local — never sends a likeness to a cloud API.
//
// Connect from any MCP-capable agent (Claude Code, Cline, ...) as a stdio server:
//   command: "node"   args: ["<home>/.claude/mcp-servers/comfyui-image/server.js"]
//
// Env overrides:
//   COMFYUI_URL      base url (default: auto-resolve WSL IP, else http://localhost:8188)
//   COMFYUI_OPEN     "0" to NOT open finished images in the default viewer (default: open)

import { execSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SKILL_DIR = join(homedir(), ".claude", "skills", "comfyui-local-image", "workflows");
const WF_TXT2IMG = join(SKILL_DIR, "sdxl_txt2img_api.json");
const WF_PERSONA = join(SKILL_DIR, "sdxl_persona_pulid_api.json");
const OUT_DIR = join(homedir(), "Pictures", "comfyui-mcp");

// --- Resolve the ComfyUI base URL (WSL IP changes on reboot) ---
function resolveBase() {
  if (process.env.COMFYUI_URL) return process.env.COMFYUI_URL.replace(/\/$/, "");
  // ComfyUI runs in WSL2; from Windows the reliable address is the WSL IP.
  try {
    const ip = execSync("wsl hostname -I", { encoding: "utf8" }).trim().split(/\s+/)[0];
    if (ip) return `http://${ip}:8188`;
  } catch { /* fall through */ }
  return "http://localhost:8188";
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET ${url} -> HTTP ${r.status}`);
  return r.json();
}

function nodeByTitle(wf, title) {
  for (const id of Object.keys(wf)) {
    const t = wf[id]?._meta?.title?.trim().toLowerCase();
    if (t === title.toLowerCase()) return wf[id];
  }
  return null;
}

async function uploadFace(base, path) {
  const buf = await readFile(path);
  const fd = new FormData();
  fd.append("image", new Blob([buf]), basename(path));
  fd.append("overwrite", "true");
  const r = await fetch(`${base}/upload/image`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`face upload failed: HTTP ${r.status}`);
  const j = await r.json();
  return j.subfolder ? `${j.subfolder}/${j.name}` : j.name;
}

async function generate({ prompt, reference_face_path, width, height, output_name }) {
  const base = resolveBase();

  // reachability check with an actionable error
  try { await getJson(`${base}/system_stats`); }
  catch { throw new Error(`Cannot reach ComfyUI at ${base}. Start it in WSL:\n  cd ~/ComfyUI && python3 main.py --listen 0.0.0.0 --port 8188 --cuda-device 0\n(or set COMFYUI_URL).`); }

  const usePersona = Boolean(reference_face_path);
  const wfPath = usePersona ? WF_PERSONA : WF_TXT2IMG;
  if (!existsSync(wfPath)) throw new Error(`Workflow not found: ${wfPath}`);
  const wf = JSON.parse(await readFile(wfPath, "utf8"));

  // inject prompt
  const pnode = nodeByTitle(wf, "PROMPT");
  if (!pnode) throw new Error(`Workflow ${basename(wfPath)} has no node titled PROMPT.`);
  pnode.inputs.text = prompt;

  // inject size if the workflow has an EmptyLatentImage
  for (const id of Object.keys(wf)) {
    if (wf[id].class_type === "EmptyLatentImage") {
      if (width) wf[id].inputs.width = width;
      if (height) wf[id].inputs.height = height;
    }
  }

  // inject + upload face for persona/likeness
  if (usePersona) {
    if (!existsSync(reference_face_path)) throw new Error(`reference_face_path not found: ${reference_face_path}`);
    const fnode = nodeByTitle(wf, "FACE");
    if (!fnode) throw new Error(`Persona workflow has no node titled FACE.`);
    fnode.inputs.image = await uploadFace(base, reference_face_path);
  }

  // submit
  const sub = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: wf, client_id: `mcp-${Date.now()}` }),
  });
  const subj = await sub.json();
  if (subj.node_errors && Object.keys(subj.node_errors).length)
    throw new Error("ComfyUI rejected the workflow:\n" + JSON.stringify(subj.node_errors, null, 2));
  const pid = subj.prompt_id;
  if (!pid) throw new Error(`No prompt_id returned: ${JSON.stringify(subj)}`);

  // poll history (persona first run is slow: EVA-CLIP load + InsightFace). ~10 min cap.
  const deadline = Date.now() + 600_000;
  let imgInfo = null;
  while (Date.now() < deadline) {
    const hist = await getJson(`${base}/history/${pid}`);
    const entry = hist[pid];
    if (entry?.outputs) {
      for (const out of Object.values(entry.outputs)) {
        if (out.images?.length) { imgInfo = out.images[0]; break; }
      }
      if (imgInfo) break;
      throw new Error("Workflow finished but produced no image (no SaveImage node?).");
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!imgInfo) throw new Error(`Timed out waiting for ComfyUI (prompt_id=${pid}).`);

  // fetch + save
  const q = new URLSearchParams({ filename: imgInfo.filename, subfolder: imgInfo.subfolder || "", type: imgInfo.type || "output" });
  const ir = await fetch(`${base}/view?${q}`);
  if (!ir.ok) throw new Error(`Could not download image: HTTP ${ir.status}`);
  const bytes = Buffer.from(await ir.arrayBuffer());
  await mkdir(OUT_DIR, { recursive: true });
  const safe = (output_name || "image").replace(/[^a-z0-9_\-]+/gi, "_");
  const outPath = join(OUT_DIR, `${safe}_${Date.now()}.png`);
  await writeFile(outPath, bytes);

  // open in default viewer (this user can't see inline images) unless disabled
  if (process.env.COMFYUI_OPEN !== "0") {
    try { execSync(`cmd /c start "" "${outPath}"`); } catch { /* non-fatal */ }
  }

  return { outPath, base, mode: usePersona ? "persona (PuLID)" : "txt2img" };
}

// --- MCP server ---
const server = new McpServer({ name: "comfyui-image", version: "1.0.0" });

server.registerTool(
  "generate_image",
  {
    title: "Generate image (local ComfyUI)",
    description:
      "Generate an image locally on the user's own GPU via ComfyUI (Juggernaut XL). " +
      "For a specific person's likeness/persona, pass reference_face_path — it uses PuLID face-consistency " +
      "and the image never leaves the machine. Saves the PNG and opens it in the default viewer. " +
      "Returns the saved file path.",
    inputSchema: {
      prompt: z.string().describe("What to draw (the positive prompt / scene description)."),
      reference_face_path: z.string().optional()
        .describe("Absolute path to a clear frontal face photo to preserve the person's likeness (persona mode). Omit for a plain image."),
      width: z.number().int().min(512).max(2048).optional().describe("Width in px (default 1024)."),
      height: z.number().int().min(512).max(2048).optional().describe("Height in px (default 1024)."),
      output_name: z.string().optional().describe("Base name for the saved file (default 'image')."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async (args) => {
    try {
      const { outPath, base, mode } = await generate(args);
      return { content: [{ type: "text", text: `Image generated locally (${mode}) via ${base}.\nSaved + opened: ${outPath}` }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: `Image generation failed: ${e.message}` }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[comfyui-image] MCP server ready (stdio).");
