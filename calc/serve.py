#!/usr/bin/env python3
"""Local preview server for the web calculator.

Adds the headers a cross-origin-isolated page needs (COOP/COEP) plus the wasm
MIME type, so the pthread engine can use SharedArrayBuffer locally exactly the
way the Service Worker makes it work on GitHub Pages.

It serves the *site root*, so the calculator lives at /calc/ exactly as it does
on GitHub Pages (the shared icon at ../assets/calc.png resolves correctly).

    python serve.py            # http://127.0.0.1:8123/calc/
    python serve.py 9000       # custom port
"""

import mimetypes
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/javascript", ".js")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path in ("/", ""):
            self.send_response(302)
            self.send_header("Location", "/calc/")
            self.end_headers()
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        if self.path.endswith((".wasm", ".data", ".js", ".css")):
            self.send_header("Cache-Control", "public, max-age=86400")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[calc] %s\n" % (fmt % args))


if __name__ == "__main__":
    print(f"calc preview: http://127.0.0.1:{PORT}/calc/")
    print("COOP/COEP enabled, Ctrl+C to stop")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
