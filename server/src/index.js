import "dotenv/config";
import http from "node:http";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { Server } from "socket.io";
import Game from "./models/Game.js";
import { listPublicRooms, registerGameHandlers } from "./game.js";

const app = express();
const httpServer = http.createServer(app);
const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";
const io = new Server(httpServer, {
  cors: { origin: allowedOrigin, methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e6
});

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: "100kb" }));
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "doodle-dash" }));
app.get("/api/rooms", (_req, res) => res.json({ rooms: listPublicRooms() }));
app.get("/api/stats", (_req, res) => res.json({ online: io.engine.clientsCount }));

io.on("connection", (socket) => registerGameHandlers(io, socket, Game));

const port = Number(process.env.PORT) || 3001;
httpServer.listen(port, () => console.log(`Doodle Dash server listening on :${port}`));

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((error) => console.error("MongoDB connection failed:", error.message));
}
