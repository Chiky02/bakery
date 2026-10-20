/**
 * Equipo de cocina en la red del local.
 * Recibe comandas aunque no haya internet y las muestra en este mismo equipo.
 *
 *   npm run cocina-hub
 * Luego en Configuración de cada tablet: http://IP-DE-ESTE-EQUIPO:8787
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.COCINA_HUB_PORT || 8787);
const HOST = process.env.COCINA_HUB_HOST || "0.0.0.0";
const dir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(dir, "data");
const dataFile = process.env.COCINA_HUB_FILE || path.join(dataDir, "comandas.json");

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return Array.isArray(parsed.comandas) ? parsed.comandas : [];
  } catch {
    return [];
  }
}

function save(comandas) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify({ comandas }, null, 2));
}

let chain = Promise.resolve();
function locked(fn) {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => {},
    () => {},
  );
  return run;
}

function cors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function visible(row) {
  if (row.estado === "cancelado") return false;
  if (row.synced && (row.estado === "listo" || row.estado === "entregado")) return false;
  return true;
}

const page = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cocina local</title>
  <style>
    body { font-family: sans-serif; margin: 0; background: #f7f4ef; color: #1c1917; }
    header { padding: 16px 20px; border-bottom: 1px solid #e7e5e4; }
    main { display: grid; gap: 12px; padding: 16px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
    article { background: white; border: 1px solid #e7e5e4; border-radius: 16px; padding: 12px; }
    h2 { margin: 0 0 8px; font-size: 18px; }
    li { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f5f5f4; }
    button { border: 0; border-radius: 8px; padding: 6px 10px; background: #f59e0b; color: white; font-weight: 600; }
    button.ghost { background: #e7e5e4; color: #1c1917; }
    .empty { padding: 32px; text-align: center; color: #78716c; }
  </style>
</head>
<body>
  <header>
    <h1>Cocina del local</h1>
    <p>Pedidos que llegan por el WiFi, sin internet. Al volver la señal, el panel los sube a la nube.</p>
  </header>
  <main id="board"><p class="empty">Sin pedidos</p></main>
  <script>
    function esc(s) {
      return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    }
    async function patch(id, estado) {
      await fetch("/comandas/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      load();
    }
    function imprimir(nombre, items) {
      const filas = items.map((i) => "<tr><td>" + i.cantidad + "×</td><td>" + esc(i.nombre) + "</td></tr>").join("");
      const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=640");
      if (!w) return;
      w.document.write("<!doctype html><title>Comanda " + esc(nombre) + "</title><body><h1>" + esc(nombre) + "</h1><p>" + new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }) + "</p><table>" + filas + "</table></body>");
      w.document.close();
      w.focus();
      w.print();
    }
    async function load() {
      const res = await fetch("/comandas");
      const body = await res.json();
      const rows = (body.comandas || []).filter((c) => c.pasa_cocina !== false && c.estado !== "listo" && c.estado !== "cancelado");
      const groups = new Map();
      for (const row of rows) {
        const key = row.mesa_nombre || "Mesa";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      }
      const board = document.getElementById("board");
      if (!groups.size) {
        board.innerHTML = '<p class="empty">Sin pedidos</p>';
        return;
      }
      board.innerHTML = "";
      for (const [nombre, items] of groups) {
        const art = document.createElement("article");
        const list = items.map((i) => "<li><span>" + i.cantidad + "× " + esc(i.nombre) + "</span><span><button data-id='" + i.id + "' data-estado='en_preparacion'>Prep</button> <button data-id='" + i.id + "' data-estado='listo'>Listo</button></span></li>").join("");
        art.innerHTML = "<h2>" + esc(nombre) + "</h2><ul>" + list + "</ul><p><button class='ghost' data-print='1'>Imprimir</button></p>";
        art.querySelector("[data-print]").onclick = () => imprimir(nombre, items);
        art.querySelectorAll("button[data-id]").forEach((btn) => {
          btn.onclick = () => patch(btn.dataset.id, btn.dataset.estado);
        });
        board.appendChild(art);
      }
    }
    load();
    setInterval(load, 2000);
  </script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/cocina")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/comandas") {
    const panaderiaId = url.searchParams.get("panaderia_id");
    const comandas = await locked(async () => {
      const all = load().filter(visible);
      return panaderiaId ? all.filter((c) => c.panaderia_id === panaderiaId) : all;
    });
    send(res, 200, { comandas });
    return;
  }

  if (req.method === "POST" && url.pathname === "/comandas") {
    try {
      const body = await readBody(req);
      if (!body?.id || !body.panaderia_id || !body.producto_id) {
        send(res, 400, { error: "Faltan datos de la comanda" });
        return;
      }
      const saved = await locked(async () => {
        const all = load();
        const next = {
          id: String(body.id),
          panaderia_id: String(body.panaderia_id),
          mesa_id: String(body.mesa_id || ""),
          mesa_nombre: String(body.mesa_nombre || "Mesa"),
          cuenta_id: String(body.cuenta_id || ""),
          producto_id: String(body.producto_id),
          nombre: String(body.nombre || "Producto"),
          cantidad: Math.max(1, Math.floor(Number(body.cantidad) || 1)),
          precio: Number(body.precio) || 0,
          estado: "pendiente",
          pasa_cocina: body.pasa_cocina !== false,
          created_at: body.created_at || new Date().toISOString(),
          status: "pending",
          synced: false,
          cloud_item_id: null,
        };
        const idx = all.findIndex((c) => c.id === next.id);
        if (idx >= 0) all[idx] = { ...all[idx], ...next, estado: all[idx].estado };
        else all.push(next);
        save(all);
        return idx >= 0 ? all[idx] : next;
      });
      send(res, 200, saved);
    } catch {
      send(res, 400, { error: "JSON inválido" });
    }
    return;
  }

  const patchMatch = url.pathname.match(/^\/comandas\/([^/]+)$/);
  if (req.method === "PATCH" && patchMatch) {
    try {
      const id = decodeURIComponent(patchMatch[1]);
      const body = await readBody(req);
      const updated = await locked(async () => {
        const all = load();
        const idx = all.findIndex((c) => c.id === id);
        if (idx < 0) return null;
        const row = all[idx];
        if (body.estado) row.estado = String(body.estado);
        if (body.cantidad != null) row.cantidad = Math.max(1, Math.floor(Number(body.cantidad) || 1));
        if (body.synced != null) row.synced = !!body.synced;
        if (body.cloud_item_id !== undefined) row.cloud_item_id = body.cloud_item_id;
        all[idx] = row;
        save(all);
        return row;
      });
      if (!updated) {
        send(res, 404, { error: "No está en la cola local" });
        return;
      }
      send(res, 200, updated);
    } catch {
      send(res, 400, { error: "JSON inválido" });
    }
    return;
  }

  send(res, 404, { error: "No encontrado" });
});

server.listen(PORT, HOST, () => {
  console.log(`Cocina local en http://${HOST}:${PORT}`);
});
