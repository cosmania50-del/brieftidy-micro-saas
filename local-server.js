const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = process.env.PORT || 3000;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function send(res, status, body, type = "text/plain; charset=utf-8", headers = {}) {
  res.writeHead(status, { "content-type": type, ...headers });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.replace("/api/", "");
      const modPath = path.join(root, "api", `${name}.js`);
      if (!fs.existsSync(modPath)) return send(res, 404, JSON.stringify({ error: "Not found" }), "application/json");
      req.query = Object.fromEntries(url.searchParams.entries());
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => send(res, res.statusCode || 200, JSON.stringify(data), "application/json", res.getHeaders?.() || {});
      res.setHeader = res.setHeader.bind(res);
      await require(modPath)(req, res);
      return;
    }

    let filePath = path.join(root, url.pathname === "/" || url.pathname === "/success" || url.pathname === "/cancel" ? "index.html" : url.pathname);
    if (!filePath.startsWith(root)) return send(res, 403, "Forbidden");
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, "Not found");
    const ext = path.extname(filePath);
    send(res, 200, fs.readFileSync(filePath), mime[ext] || "application/octet-stream");
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message }), "application/json");
  }
});

server.listen(port, () => {
  console.log(`BriefTidy running at http://localhost:${port}`);
});
