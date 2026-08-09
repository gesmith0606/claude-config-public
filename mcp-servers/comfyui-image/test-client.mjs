// Quick end-to-end test of the comfyui-image MCP server over stdio.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "node", args: ["server.js"] });
const client = new Client({ name: "test", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

console.log("Calling generate_image (txt2img)...");
const res = await client.callTool({
  name: "generate_image",
  arguments: { prompt: "a friendly robot waving hello, vibrant 3d render, studio lighting", output_name: "mcp_test" },
});
console.log("RESULT:", JSON.stringify(res.content, null, 2), "isError:", res.isError ?? false);

await client.close();
