// Boots the browser runtime for the sales desk. The network has no site actions: it
// answers from its published price list, so any other agentic website can load it.

/**
 * Boot the runtime and report the result in the status line.
 *
 * :return: The runtime engine, or null when boot failed.
 */
async function start() {
  const status = document.querySelector("#assistant-status");
  const siteBase = new URL("./", import.meta.url).href;
  try {
    const { boot } = await import("./runtime/index.js");
    const booted = await boot("#agent-app", {
      originUrl: siteBase,
      sandboxWorkerUrl: new URL("runtime/sandbox-worker.js", siteBase).href,
    });
    const needsKey = !booted.engine.mockLLM && (!booted.engine.byokKey || booted.engine.byokKey === "demo");
    status.textContent = needsKey
      ? "The sales desk needs your model key. Add it in the settings below."
      : "Sales desk connected.";
    return booted.engine;
  } catch (error) {
    status.textContent = "The sales desk could not load. The price list still works.";
    console.error("Assistant startup failed", error);
    return null;
  }
}

await start();
