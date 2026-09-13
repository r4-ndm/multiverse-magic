import http from "http";
import express from "express";
import cors from "cors";
import colyseus from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { SpaceRoom } from "./rooms/SpaceRoom.js";

const { Server } = colyseus;

const port = Number(process.env.PORT || 2567);
const app = express();

app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", name: "OpenSpace Server", uptime: process.uptime() });
});

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
