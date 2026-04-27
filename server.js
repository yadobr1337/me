const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD || "101112";
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "items.json");

const server = http.createServer(async (request, response) => {
  if (request.url !== "/api/items") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (request.method === "GET") {
    sendJson(response, 200, await readItems());
    return;
  }

  if (request.method === "PUT") {
    if (request.headers["x-admin-password"] !== PASSWORD) {
      sendJson(response, 403, { error: "Forbidden" });
      return;
    }

    try {
      const body = await readBody(request);
      const payload = JSON.parse(body || "{}");
      const items = Array.isArray(payload.items) ? payload.items : [];
      await writeItems(items);
      sendJson(response, 200, { ok: true });
    } catch {
      sendJson(response, 400, { error: "Bad request" });
    }
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Watch list API listening on http://127.0.0.1:${PORT}`);
});

async function readItems() {
  try {
    const content = await fs.readFile(DATA_FILE, "utf8");
    const items = JSON.parse(content);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function writeItems(items) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Body too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}
