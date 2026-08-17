import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const app = express();
app.use(cors());
app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

interface UserRecord {
  userId: string;
  socketId: string;
  name: string;
  sharing: boolean;
}

const users = new Map<string, UserRecord>(); // userId -> record
const socketToUser = new Map<string, string>(); // socketId -> userId
// broadcasterUserId -> Set of viewerUserId currently watching
const watchers = new Map<string, Set<string>>();

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw.replace(/<[^>]*>?/g, "").trim();
  if (stripped.length < 2 || stripped.length > 24) return null;
  return stripped;
}

function publicState() {
  const broadcasters = Array.from(users.values())
    .filter((u) => u.sharing)
    .map((u) => ({ userId: u.userId, name: u.name }));
  return { onlineCount: users.size, broadcasters };
}

function broadcastState() {
  io.emit("presence-update", publicState());
}

function userSocket(userId: string): Socket | undefined {
  const rec = users.get(userId);
  if (!rec) return undefined;
  return io.sockets.sockets.get(rec.socketId);
}

function stopWatchingInternal(viewerUserId: string, broadcasterUserId: string) {
  const set = watchers.get(broadcasterUserId);
  if (set) {
    set.delete(viewerUserId);
    if (set.size === 0) watchers.delete(broadcasterUserId);
  }
  const broadcasterSock = userSocket(broadcasterUserId);
  broadcasterSock?.emit("viewer-left", { viewerId: viewerUserId });
}

io.on("connection", (socket: Socket) => {
  socket.on("user-join", (payload: { name?: string }, ack?: (res: any) => void) => {
    const name = sanitizeName(payload?.name);
    if (!name) {
      ack?.({ ok: false, error: "invalid_name" });
      return;
    }
    const userId = randomUUID();
    const record: UserRecord = { userId, socketId: socket.id, name, sharing: false };
    users.set(userId, record);
    socketToUser.set(socket.id, userId);

    ack?.({ ok: true, userId, name, ...publicState() });
    socket.broadcast.emit("presence-update", publicState());
  });

  socket.on("share-start", () => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    const rec = users.get(userId);
    if (!rec) return;
    rec.sharing = true;
    broadcastState();
  });

  socket.on("share-stop", () => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    const rec = users.get(userId);
    if (!rec) return;
    rec.sharing = false;

    const set = watchers.get(userId);
    if (set) {
      for (const viewerId of set) {
        const viewerSock = userSocket(viewerId);
        viewerSock?.emit("share-ended", { broadcasterId: userId });
      }
      watchers.delete(userId);
    }
    broadcastState();
  });

  socket.on("watch-request", ({ broadcasterId }: { broadcasterId: string }) => {
    const viewerId = socketToUser.get(socket.id);
    if (!viewerId || !broadcasterId) return;
    const broadcaster = users.get(broadcasterId);
    if (!broadcaster || !broadcaster.sharing) {
      socket.emit("share-ended", { broadcasterId });
      return;
    }
    if (!watchers.has(broadcasterId)) watchers.set(broadcasterId, new Set());
    watchers.get(broadcasterId)!.add(viewerId);

    const broadcasterSock = userSocket(broadcasterId);
    const viewer = users.get(viewerId);
    broadcasterSock?.emit("watch-request", { viewerId, viewerName: viewer?.name ?? "Alguém" });
  });

  socket.on("stop-watching", ({ broadcasterId }: { broadcasterId: string }) => {
    const viewerId = socketToUser.get(socket.id);
    if (!viewerId || !broadcasterId) return;
    stopWatchingInternal(viewerId, broadcasterId);
  });

  socket.on("webrtc-offer", ({ targetId, sdp }: { targetId: string; sdp: any }) => {
    const fromId = socketToUser.get(socket.id);
    if (!fromId || !targetId) return;
    const targetSock = userSocket(targetId);
    targetSock?.emit("webrtc-offer", { fromId, sdp });
  });

  socket.on("webrtc-answer", ({ targetId, sdp }: { targetId: string; sdp: any }) => {
    const fromId = socketToUser.get(socket.id);
    if (!fromId || !targetId) return;
    const targetSock = userSocket(targetId);
    targetSock?.emit("webrtc-answer", { fromId, sdp });
  });

  socket.on("ice-candidate", ({ targetId, candidate }: { targetId: string; candidate: any }) => {
    const fromId = socketToUser.get(socket.id);
    if (!fromId || !targetId) return;
    const targetSock = userSocket(targetId);
    targetSock?.emit("ice-candidate", { fromId, candidate });
  });

  socket.on("disconnect", () => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;
    socketToUser.delete(socket.id);
    const rec = users.get(userId);
    users.delete(userId);

    if (rec?.sharing) {
      const set = watchers.get(userId);
      if (set) {
        for (const viewerId of set) {
          const viewerSock = userSocket(viewerId);
          viewerSock?.emit("share-ended", { broadcasterId: userId });
        }
        watchers.delete(userId);
      }
    }

    for (const [broadcasterId, set] of watchers.entries()) {
      if (set.has(userId)) {
        set.delete(userId);
        if (set.size === 0) watchers.delete(broadcasterId);
        const broadcasterSock = userSocket(broadcasterId);
        broadcasterSock?.emit("viewer-left", { viewerId: userId });
      }
    }

    broadcastState();
  });
});

httpServer.listen(PORT, () => {
  console.log(`[disctela-server] listening on port ${PORT}`);
});
