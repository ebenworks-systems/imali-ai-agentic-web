#!/usr/bin/env python3
"""Serve the shop and the supplier on two local origins for development and tests.

    python3 tools/serve-local.py [--shop-port 8090] [--supplier-port 8091] [--proxy URL]

The shop is served on 127.0.0.1:<shop-port> and the supplier on 127.0.0.1:<supplier-port>,
so the shop's agents load the supplier's network from a second origin, as they do live.
Every shop file that names the live supplier's address is served with the local supplier's
address instead, so the shop's partner tool, allowed peer and page link all point here.

--proxy adds the spec's caller-site BYOK proxy (MVP Profile 0.2, section 4) for routers that
do not allow browser CORS: the shop forwards POST /llm/<path> to <URL>/<path> with the
visitor's own Authorization header and adds no key of its own. Set the router base URL in
the chat settings to http://127.0.0.1:<shop-port>/llm. Local development only.
"""

import argparse
import http.server
import threading
import urllib.error
import urllib.request
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AGENT_FILES = ("agent-manifest.json", "links.json", "agent-mcp.json")
LIVE_SUPPLIER = "https://imali-ai-agentic-supplier.vercel.app"
REWRITTEN = (".json", ".html", ".js")


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static files with CORS on the public agent files, plus the optional proxy."""

    supplier_origin = None
    proxy = None

    def end_headers(self):
        path = self.path.split("?")[0]
        if path.endswith(AGENT_FILES) or path.endswith(".network.json") or "/.well-known/" in path:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if self.supplier_origin and path.endswith(REWRITTEN):
            file = Path(self.directory) / path.lstrip("/")
            if file.is_file() and file.resolve().is_relative_to(Path(self.directory).resolve()):
                text = file.read_text(encoding="utf-8")
                if LIVE_SUPPLIER in text:
                    body = text.replace(LIVE_SUPPLIER, self.supplier_origin).encode()
                    self.send_response(200)
                    self.send_header("Content-Type", self.guess_type(str(file)))
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


def serve(folder, port, supplier_origin=None, proxy=None):
    """Start a threaded static server for one folder."""
    handler = type("SiteHandler", (Handler,), {"supplier_origin": supplier_origin, "proxy": proxy})
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
    serve(ROOT / "supplier", args.supplier_port)
    serve(ROOT / "shop", args.shop_port, supplier_origin=supplier, proxy=args.proxy)
    print(f"shop      http://127.0.0.1:{args.shop_port}/")
    print(f"supplier  {supplier}/")
    if args.proxy:
        print(f"proxy     http://127.0.0.1:{args.shop_port}/llm -> {args.proxy}")
    threading.Event().wait()


if __name__ == "__main__":
    main()
