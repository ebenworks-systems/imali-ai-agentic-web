#!/usr/bin/env node
// Check a live or local open agentic website against the public-file rules of the
// Minimum Viable Specification for a Worldwide Agentic Web (MVP Profile 0.2,
// sections 2, 3.2, 3.3, 3.4 and 4).
//
// Usage:
//   node tools/check-site.mjs <site base URL> [--runtime <folder with kernel.js>] [--json]
//
// It fetches the site's agent-manifest.json, every network it lists, links.json and the
// runtime entry, validates each network with the browser runtime's own validator, follows
// each published peer link to the peer's manifest and network, and checks the CORS header
// a caller on another origin needs. It sends no key and calls no model.
// Exit code 0 when every required check passes, 1 otherwise.

import path from "node:path";
import { pathToFileURL } from "node:url";

const CALLER_ORIGIN = "https://caller.example";
const KEY_SHAPES = /\bsk-[A-Za-z0-9_-]{16,}|sk-or-v1-[a-f0-9]{20,}|sk-ant-[A-Za-z0-9_-]{16,}|Bearer [A-Za-z0-9._-]{20,}|AKIA[0-9A-Z]{16}/;

/**
 * Runs the checks for one site and keeps the results.
 */
class SiteCheck {
  /**
   * :param base: The site base URL, the folder that holds agent-manifest.json.
   * :param runtimeDir: A folder with the runtime's kernel.js and hocon.js.
   */
  constructor(base, runtimeDir) {
    this.base = base.endsWith("/") ? base : `${base}/`;
    this.runtimeDir = runtimeDir;
    this.results = [];
  }

  /**
   * Record one check.
   *
   * :param ok: Whether it passed.
   * :param rule: The rule, with the spec section.
   * :param detail: What was found.
   * :param required: False for a recommendation.
   */
  note(ok, rule, detail, required = true) {
    this.results.push({ ok, rule, detail, required });
  }

  /**
   * Fetch a URL as another origin's browser would, without credentials.
   *
   * :param url: The URL.
   * :return: {response, text} or {error}.
   */
  static async get(url) {
    try {
      const response = await fetch(url, { headers: { Origin: CALLER_ORIGIN }, redirect: "follow" });
      return { response, text: await response.text() };
    } catch (error) {
      return { error: String(error.message || error) };
    }
  }

  /**
   * Check one public artifact: reachable, JSON and readable from another origin.
   *
   * :param label: A name for the report.
   * :param url: The URL.
   * :param section: The spec section.
   * :return: The parsed JSON, or null.
   */
  async artifact(label, url, section) {
    const got = await SiteCheck.get(url);
    if (got.error || !got.response.ok) {
      this.note(false, `${label} is published (${section})`, `${url}: ${got.error || `HTTP ${got.response.status}`}`);
      return null;
    }
    this.note(true, `${label} is published (${section})`, `${url}: HTTP ${got.response.status}`);
    const allow = got.response.headers.get("access-control-allow-origin");
    const sameOrigin = new URL(url).origin === new URL(this.base).origin;
    this.note(allow === "*" || allow === CALLER_ORIGIN, `${label} can be read by a caller on another origin (3.3, 3.4)`,
      allow ? `Access-Control-Allow-Origin: ${allow}` : `no Access-Control-Allow-Origin header${sameOrigin ? "; only same-origin callers can load it" : ""}`);
    this.note(!KEY_SHAPES.test(got.text), `${label} holds no key-shaped text (4)`, KEY_SHAPES.test(got.text) ? "a key-shaped string was found" : "none found");
    try {
      return JSON.parse(got.text);
    } catch (error) {
      this.note(false, `${label} is valid JSON (2.2)`, String(error.message));
      return null;
    }
  }

  /**
   * Validate a resolved network with the runtime's own validator.
   *
   * :param label: A name for the report.
   * :param config: The parsed network.
   * :param name: The network name from the manifest.
   * :param frontMan: The front agent the manifest names.
   */
  async network(label, config, name, frontMan) {
    const kernel = await import(pathToFileURL(path.join(this.runtimeDir, "kernel.js")).href);
    const network = new kernel.AgentNetwork(config, name);
    const { errors } = kernel.validateNetwork(network);
    this.note(errors.length === 0, `${label} passes the runtime's network validator (2.1, 3.1)`, errors.length ? errors.join("; ") : `${(config.tools || []).length} agents, no errors`);
    let found = null;
    try {
      found = network.findFrontMan();
    } catch (error) {
      found = `error: ${error.message}`;
    }
    this.note(found === frontMan, `${label}: the manifest's front_man is the network's front agent (2.1)`, `manifest ${frontMan}, network ${found}`);
    const agents = config.tools || [];
    const described = agents.every((agent) => agent.name && agent.function?.description);
    this.note(described, `${label}: every agent has a name and a function description (2.1)`, `${agents.length} agents`);
    const schemas = agents.every((agent) => !agent.function?.parameters || agent.function.parameters.type === "object");
    this.note(schemas, `${label}: invocation schemas are JSON Schema objects (2.1)`, schemas ? "yes" : "an agent's parameters are not an object schema");
    const text = JSON.stringify(config);
    const portable = !/\$\{|include\s*"|"class"\s*:/.test(text);
    this.note(portable, `${label} is declarative data with no includes, substitutions or coded tools (2.2)`, portable ? "yes" : "found an include, a substitution or a coded tool");
    this.note(Boolean(config.metadata?.description), `${label} has a description (2.1)`, config.metadata?.description ? "yes" : "metadata.description is missing", false);
  }

  /**
   * Run every check.
   */
  async run() {
    const manifestUrl = new URL("agent-manifest.json", this.base).href;
    const manifest = await this.artifact("agent-manifest.json", manifestUrl, "3.3");
    if (!manifest) return;
    const networks = Array.isArray(manifest.networks) ? manifest.networks : [];
    this.note(networks.length > 0, "the manifest lists at least one network (3.3)", `${networks.length} listed`);
    for (const entry of networks) {
      const fields = ["name", "front_man", "hocon"].filter((key) => typeof entry[key] !== "string" || !entry[key]);
      this.note(fields.length === 0, `network ${entry.name || "?"} has name, front_man and hocon (3.3)`, fields.length ? `missing ${fields.join(", ")}` : "yes");
      if (fields.length) continue;
      const config = await this.artifact(`network ${entry.name}`, new URL(entry.hocon, this.base).href, "3.3");
      if (config) await this.network(`network ${entry.name}`, config, entry.name, entry.front_man);
    }
    const router = manifest.llm_router;
    this.note(Boolean(router && (router.base_url || router.byok_router)), "the manifest names an LLM router (3.3, 4)", router ? `base_url ${router.base_url || "none"}, byok_router ${router.byok_router || "none"}` : "llm_router is missing");
    this.note(Boolean(manifest.peer_policy || manifest.allowed_peers), "the manifest states a peer policy (3.3)", manifest.peer_policy ? `mode ${manifest.peer_policy.mode}` : "no peer_policy");

    const linksUrl = new URL("links.json", this.base).href;
    const links = await this.artifact("links.json", linksUrl, "3.3");
    if (links) {
      for (const [networkName, map] of Object.entries(links.networks || {})) {
        for (const [reference, target] of Object.entries(map || {})) {
          await this.peer(networkName, reference, target);
        }
      }
    }

    const runtimeUrl = new URL("runtime/index.js", this.base).href;
    const runtime = await SiteCheck.get(runtimeUrl);
    const runtimeOk = !runtime.error && runtime.response.ok && /export\s+(async\s+)?function\s+boot|export\s*\{[^}]*boot/.test(runtime.text);
    this.note(runtimeOk, "a browser runtime is served with the site (3)", runtimeOk ? `${runtimeUrl} exports boot()` : `${runtimeUrl}: ${runtime.error || `HTTP ${runtime.response.status}`}`, false);

    const page = await SiteCheck.get(this.base);
    if (!page.error && page.response.ok) {
      this.note(!KEY_SHAPES.test(page.text), "the page holds no key-shaped text (4)", KEY_SHAPES.test(page.text) ? "a key-shaped string was found" : "none found");
      this.note(/data-ns-slot="settings"|byok|api key/i.test(page.text), "the page has a place to set the model and key (4)", "looked for a settings slot or key setup in the HTML", false);
    }
    const isHttps = new URL(this.base).protocol === "https:";
    const isLoopback = ["127.0.0.1", "localhost", "[::1]"].includes(new URL(this.base).hostname);
    this.note(isHttps || isLoopback, "the site is served over HTTPS (3.3)", isHttps ? "https" : isLoopback ? "loopback http, allowed for local development" : "plain http");
  }

  /**
   * Follow a published peer link: the peer's manifest must list the exact network name.
   *
   * :param networkName: The local network that uses the link.
   * :param reference: The symbolic name.
   * :param target: The peer network URL.
   */
  async peer(networkName, reference, target) {
    let url;
    try {
      url = new URL(target);
    } catch {
      this.note(false, `link ${reference} is a full URL (3.2)`, String(target));
      return;
    }
    const requested = url.pathname.split("/").filter(Boolean).pop() || "";
    const peerBase = new URL("./", url).href;
    const peerManifest = await this.artifact(`peer manifest for ${reference}`, new URL("agent-manifest.json", peerBase).href, "3.2");
    if (!peerManifest) return;
    const entry = (peerManifest.networks || []).find((item) => item.name === requested);
    this.note(Boolean(entry), `link ${networkName}.${reference} resolves to an exact network name at the peer (3.2)`, entry ? `${peerBase} lists ${requested}` : `${peerBase} has no network named ${requested}`);
    if (!entry) return;
    const config = await this.artifact(`peer network ${requested}`, new URL(entry.hocon, peerBase).href, "3.2");
    if (config) await this.network(`peer network ${requested}`, config, entry.name, entry.front_man);
  }
}

/**
 * Parse arguments, run the check and print the report.
 */
async function main() {
  const args = process.argv.slice(2);
  const base = args.find((arg) => /^https?:\/\//.test(arg));
  if (!base) {
    console.error("Usage: node tools/check-site.mjs <site base URL> [--runtime <folder>] [--json]");
    process.exit(2);
  }
  const runtimeAt = args.indexOf("--runtime");
  const here = path.dirname(new URL(import.meta.url).pathname);
  const runtimeDir = runtimeAt >= 0 ? path.resolve(args[runtimeAt + 1]) : path.resolve(here, "../shop/runtime");
  const check = new SiteCheck(base, runtimeDir);
  await check.run();
  const failed = check.results.filter((result) => result.required && !result.ok);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ site: check.base, checked: new Date().toISOString(), passed: failed.length === 0, results: check.results }, null, 2));
  } else {
    console.log(`Open agentic website check: ${check.base}`);
    for (const result of check.results) {
      const mark = result.ok ? "PASS" : result.required ? "FAIL" : "WARN";
      console.log(`${mark}  ${result.rule}\n      ${result.detail}`);
    }
    const required = check.results.filter((result) => result.required).length;
    console.log(`\n${required - failed.length} of ${required} required checks passed${failed.length ? `; ${failed.length} failed` : ""}.`);
  }
  process.exit(failed.length ? 1 : 0);
}

await main();
