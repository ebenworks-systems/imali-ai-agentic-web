#!/usr/bin/env python3
"""Serve the shop and the supplier on two local origins for development and tests.

    python3 tools/serve-local.py [--shop-port 8090] [--supplier-port 8091] [--proxy URL]

The shop is served on 127.0.0.1:<shop-port> and the supplier on 127.0.0.1:<supplier-port>,
so the shop's agents load the supplier's network from a second origin, as they do live.
The shop's links.json is rewritten to point at the local supplier.

--proxy adds the spec's caller-site BYOK proxy (MVP Profile 0.2, section 4) for routers that
do not allow browser CORS: the shop forwards POST /llm/<path> to <URL>/<path> with the
visitor's own Authorization header and adds no key of its own. Set the router base URL in
the chat settings to http://127.0.0.1:<shop-port>/llm. Local development only.
"""

import argparse
import http.server
import json
import threading
import urllib.error
import urllib.request
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AGENT_FILES = ("agent-manifest.json", "links.json", "agent-mcp.json")


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static files with CORS on the public agent files, plus the optional proxy."""

    links_override = None
    proxy = None

    def end_headers(self):
        path = self.path.split("?")[0]
        if path.endswith(AGENT_FILES) or path.endswith(".network.json") or "/.well-known/" in path:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if self.links_override is not None and self.path.split("?")[0] == "/links.json":
            body = json.dumps(self.links_override, indent=2).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        if not self.proxy or not self.path.startswith("/llm/"):
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length)
        target = self.proxy.rstrip("/") + self.path[len("/llm"):]
        headers = {"Content-Type": "application/json"}
        if self.headers.get("Authorization"):
            headers["Authorization"] = self.headers["Authorization"]
        request = urllib.request.Request(target, data=body, headers=headers, method="POST")
        try:
            response = urllib.request.urlopen(request, timeout=180)
        except urllib.error.HTTPError as error:
            response = error
        self.send_response(response.status)
        self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
        self.end_headers()
        while True:
            chunk = response.read(4096)
            if not chunk:
                break
            self.wfile.write(chunk)
            self.wfile.flush()

    def log_message(self, fmt, *args):
        pass


def serve(folder, port, links_override=None, proxy=None):
    """Start a threaded static server for one folder."""
    handler = type("SiteHandler", (Handler,), {"links_override": links_override, "proxy": proxy})
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), partial(handler, directory=str(folder)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--shop-port", type=int, default=8090)
    parser.add_argument("--supplier-port", type=int, default=8091)
    parser.add_argument("--proxy", default=None)
    args = parser.parse_args()
    supplier = f"http://127.0.0.1:{args.supplier_port}"
    links = {"version": 1, "networks": {"imali_shop_book": {"bonde_wholesale": f"{supplier}/bonde_wholesale"}}}
    serve(ROOT / "supplier", args.supplier_port)
    serve(ROOT / "shop", args.shop_port, links_override=links, proxy=args.proxy)
    print(f"shop      http://127.0.0.1:{args.shop_port}/")
    print(f"supplier  {supplier}/")
    if args.proxy:
        print(f"proxy     http://127.0.0.1:{args.shop_port}/llm -> {args.proxy}")
    threading.Event().wait()


if __name__ == "__main__":
    main()
