import http from "http";
import express from "express";
import cors from "cors";
import colyseus from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { SpaceRoom } from "./rooms/SpaceRoom.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "..", "dist");

const { Server } = colyseus;

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const AVATAR_DIR = path.join(DATA_DIR, "avatars");
fs.mkdirSync(AVATAR_DIR, { recursive: true });

app.post("/api/avatar", (req, res) => {
  const image = req.body?.image;
  if (typeof image !== "string" || !image.startsWith("data:image/jpeg;base64,")) {
    return res.status(400).json({ error: "Send a JPEG portrait" });
  }
  const raw = image.slice("data:image/jpeg;base64,".length);
  if (raw.length > 1_400_000) return res.status(413).json({ error: "Picture is too large" });
  let buf;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    return res.status(400).json({ error: "Bad picture" });
  }
  if (buf.length < 32 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return res.status(400).json({ error: "Not a JPEG" });
  }
  const id = crypto.randomBytes(12).toString("hex");
  fs.writeFileSync(path.join(AVATAR_DIR, `${id}.jpg`), buf);
  res.json({ url: `/avatars/${id}.jpg` });
});

app.get("/avatars/:id", (req, res) => {
  if (!/^[a-f0-9]{24}\.jpg$/.test(req.params.id)) return res.status(404).end();
  const file = path.join(AVATAR_DIR, req.params.id);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.type("image/jpeg");
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(file);
});

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", name: "Multiverse Magic Server", uptime: process.uptime() });
});

app.get(["/galaxy.json", "/system.json"], (req, res) => {
  const host = `${req.protocol}://${req.get("host")}`;
  res.json({
    systemId: "sol",
    name: "Open Space",
    creator: "Multiverse Magic",
    description: "A single shared Open Space. Connected galaxies are disabled.",
    url: `${host}/?system=sol`,
    wsUrl: host.replace(/^http/, "ws"),
    theme: "nexus",
    version: "1.0.0",
    hyperlanes: [],
  });
});

// Serve static frontend build in production
if (fs.existsSync(distPath)) {
  console.log(`[Server] Serving production client from ${distPath}`);
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith("/matchmake") &&
      !req.path.startsWith("/colyseus") &&
      !req.path.startsWith("/avatars") &&
      !req.path.startsWith("/api")
    ) {
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
