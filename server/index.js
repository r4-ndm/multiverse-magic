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
