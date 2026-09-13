import http from "http";
import express from "express";
import cors from "cors";
import colyseus from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { SpaceRoom } from "./rooms/SpaceRoom.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "..", "dist");

const { Server } = colyseus;

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", name: "Multiverse Magic Server", uptime: process.uptime() });
});

// Web Surfing Proxy for the Flying Cosmic TV
app.get("/api/proxy", async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== "string") {
    return res.status(400).send("Missing url query param");
  }
  targetUrl = targetUrl.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const parsed = new URL(targetUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 CosmicTV/1.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "text/html";

    // Strip frame headers so the 3D TV screen iframe can render it seamlessly
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", contentType);

    if (contentType.includes("text/html")) {
      let html = await response.text();
      const baseTag = `<base href="${parsed.origin}${parsed.pathname}">`;
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${baseTag}\n`);
      } else {
        html = `${baseTag}\n${html}`;
      }
      return res.send(html);
    } else {
      const buffer = await response.arrayBuffer();
      return res.send(Buffer.from(buffer));
    }
  } catch (err) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { background: #070b14; color: #00f0ff; font-family: 'Courier New', monospace; padding: 30px; text-align: center; }
          .error-box { border: 1px solid #ff0055; padding: 20px; border-radius: 8px; max-width: 600px; margin: 40px auto; background: rgba(255,0,85,0.05); }
          h2 { color: #ff0055; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="error-box">
          <h2>📺 COSMIC TV // SIGNAL WEAK</h2>
          <p>Unable to tune quantum antenna to: <b>${targetUrl}</b></p>
          <p style="color:#94a3b8; font-size:12px;">(${err.message || "Connection timed out"})</p>
          <p style="margin-top:20px; color:#e0f2fe;">Try another station, or explore via Wikipedia or DuckDuckGo!</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Open Federation Manifest: Allows any creator's solar system to discover and link into this galaxy
app.get(["/galaxy.json", "/system.json"], (req, res) => {
  const host = `${req.protocol}://${req.get("host")}`;
  res.json({
    systemId: "sol",
    name: "Sol Prime // Nexus Sector",
    creator: "Multiverse Magic",
    description: "Central interstellar spaceport with federated hyperlane jump gates.",
    url: host,
    wsUrl: host.replace(/^http/, "ws"),
    theme: "nexus",
    version: "1.0.0",
    hyperlanes: [
      { name: "Vega Outpost", destination: `${host}/?system=vega`, distanceLy: 14.2 },
      { name: "Kepler Void", destination: `${host}/?system=kepler`, distanceLy: 48.7 },
      { name: "Alpha Centauri", destination: `${host}/?system=centauri`, distanceLy: 4.3 },
    ],
  });
});

// Serve static frontend build in production
if (fs.existsSync(distPath)) {
  console.log(`[Server] Serving production client from ${distPath}`);
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/matchmake") && !req.path.startsWith("/colyseus")) {
      return res.sendFile(path.join(distPath, "index.html"));
    }
    next();
  });
}

// Create HTTP and Colyseus Server with WebSocketTransport
const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
});

// Register the space room
gameServer.define("space", SpaceRoom);
gameServer.define("SpaceRoom", SpaceRoom);

gameServer.listen(port).then(() => {
  console.log(`\n======================================================`);
  console.log(`🌌 OpenSpace Server is running!`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${port}`);
  console.log(`🔗 HTTP endpoint:      http://localhost:${port}`);
  console.log(`======================================================\n`);
});
