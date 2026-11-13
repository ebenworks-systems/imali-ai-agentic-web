#!/usr/bin/env node
// Run sample requests through the shop's agent network with a real model, in Node.
// It uses the browser runtime's own runner and LLM client, the site's own actions and an
// in-memory book, and approves every save, so it checks that a model can drive the tools.
//
//   LLM_BASE_URL=https://openrouter.ai/api/v1 LLM_MODEL=openai/gpt-4.1-mini LLM_API_KEY=... \
//     node tools/live-run.mjs "Nimeuza mikate 3 na maziwa 2" "How much did I make this week?"
//
// The key comes only from the environment and is never printed. The peer link to the
// supplier is resolved from shop/links.json unless PEER_URL is set.
import { readFile } from "node:fs/promises";
import { ActionRegistry } from "../shop/runtime/actions.js";
import { AgentNetwork } from "../shop/runtime/kernel.js";
import { LlmClient } from "../shop/runtime/llm.js";
import { runAgent } from "../shop/runtime/runner.js";
import { TraceBus } from "../shop/runtime/trace.js";
import { RemoteRegistry, fetchManifest, fetchText, resolveUrl } from "../shop/runtime/remote.js";

const BASE = "http://localhost:8080";
const { App } = await import("../shop/book.js");
const { registerActions } = await import("../shop/site-actions.js");

const baseUrl = process.env.LLM_BASE_URL;
const model = process.env.LLM_MODEL;
const apiKey = process.env.LLM_API_KEY;
if (!baseUrl || !model || !apiKey) {
  console.error("Set LLM_BASE_URL, LLM_MODEL and LLM_API_KEY.");
  process.exit(2);
}
const config = JSON.parse(await readFile(new URL("../shop/imali_shop_book.network.json", import.meta.url), "utf8"));
config.llm_config = { ...(config.llm_config || {}), model_name: model };
const manifest = JSON.parse(await readFile(new URL("../shop/agent-manifest.json", import.meta.url), "utf8"));
const links = JSON.parse(await readFile(new URL("../shop/links.json", import.meta.url), "utf8"));
const network = new AgentNetwork(config, "imali_shop_book");
const actions = new ActionRegistry();
await registerActions({ register: actions.register.bind(actions, { base: BASE, network: "imali_shop_book" }) });
const trace = new TraceBus();
const llm = new LlmClient({ baseUrl, apiKey, trace, mock: false });
const peerUrl = process.env.PEER_URL || links.networks.imali_shop_book.bonde_wholesale;
const history = [];
const tools = [];
trace.subscribe?.((event) => {
  if (event?.kind === "tool_call" || event?.type === "tool_call") tools.push(event.name || event.tool);
});

for (const request of process.argv.slice(2)) {
  const ctx = {
    network, manifest, actions, baseOrigin: BASE, displayOrigin: "localhost:8080", trace,
    isTop: true, frontMan: network.findFrontMan(), history, llm, model,
    confirmWebsiteActions: async (items) => {
      console.log(`  [confirm] ${items.map((item) => `${item.action} ${JSON.stringify(item.arguments)}`).join("; ")}`);
      return true;
    },
    resolveLink: async () => peerUrl,
    remote: new RemoteRegistry({ trace }),
    fetchManifest, fetchText, resolveUrl,
    approveThirdParty: async () => "allow",
  };
  const started = Date.now();
  let answer;
  try {
    const result = await runAgent(ctx, ctx.frontMan, request, null, []);
    answer = result.text ?? result.answer ?? result.content ?? JSON.stringify(result).slice(0, 600);
  } catch (error) {
    answer = `ERROR: ${error.message}`;
  }
  console.log(`\n> ${request}\n${answer}\n  (${((Date.now() - started) / 1000).toFixed(1)} s, book version ${App.page.getState().version})`);
  history.push({ role: "user", content: request }, { role: "assistant", content: String(answer) });
}
