import http from "node:http";

import { WebSocket, WebSocketServer } from "ws";

import { createRoomStore } from "../lib/forest-shuffle/room-service";
import type {
  RoomClientMessage,
  RoomServerMessage,
  ViewerSeat,
} from "../lib/forest-shuffle/room";

interface SocketMeta {
  token?: string;
  roomId?: string;
}

const port = Number(process.env.FOREST_ROOM_PORT ?? 8787);
const host = process.env.FOREST_ROOM_HOST ?? "0.0.0.0";
const store = createRoomStore();
const sockets = new Map<WebSocket, SocketMeta>();

const server = http.createServer((request, response) => {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      rooms: store.getRoomCount(),
      clients: sockets.size,
      serverTime: Date.now(),
    });
    return;
  }

  const roomMatch = url.pathname.match(/^\/rooms\/([A-Za-z0-9-]+)$/);
  if (request.method === "GET" && roomMatch) {
    const snapshot = store.getSnapshot(roomMatch[1], url.searchParams.get("token") ?? "");

    if (!snapshot) {
      sendJson(response, 404, { error: "房间不存在。" });
      return;
    }

    sendJson(response, 200, snapshot);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
  sockets.set(socket, {});
  send(socket, { type: "hello", serverTime: Date.now() });

  socket.on("message", (raw) => {
    try {
      handleMessage(socket, JSON.parse(String(raw)) as RoomClientMessage);
    } catch (error) {
      send(socket, {
        type: "error",
        message: error instanceof Error ? error.message : "消息无法处理。",
      });
    }
  });

  socket.on("close", () => {
    const meta = sockets.get(socket);
    sockets.delete(socket);

    if (meta?.roomId && meta.token) {
      store.disconnect(meta.roomId, meta.token);
      broadcastRoom(meta.roomId);
    }
  });
});

server.listen(port, host, () => {
  console.log(`Forest Shuffle room server listening on http://${host}:${port}`);
});

function handleMessage(socket: WebSocket, message: RoomClientMessage) {
  const meta = sockets.get(socket) ?? {};

  if (message.type === "ping") {
    send(socket, { type: "pong", serverTime: Date.now() });
    return;
  }

  if (message.type === "create-room") {
    const snapshot = store.createRoom({
      token: message.token,
      name: message.name,
      seat: message.seat,
      library: message.library,
    });
    meta.token = message.token;
    meta.roomId = snapshot.roomId;
    sockets.set(socket, meta);
    broadcastRoom(snapshot.roomId);
    send(socket, {
      type: "notice",
      message: `你已创建房间，座位：${viewerSeatLabel(snapshot.viewerSeat)}。`,
    });
    return;
  }

  if (message.type === "join-room") {
    const snapshot = store.joinRoom({
      roomId: message.roomId,
      token: message.token,
      name: message.name,
      seat: message.seat,
    });
    meta.token = message.token;
    meta.roomId = snapshot.roomId;
    sockets.set(socket, meta);
    broadcastRoom(snapshot.roomId);
    send(socket, {
      type: "notice",
      message: `你已加入房间，座位：${viewerSeatLabel(snapshot.viewerSeat)}。`,
    });
    broadcastNotice(
      snapshot.roomId,
      `${viewerSeatLabel(snapshot.viewerSeat)} 已加入房间。`,
      message.token,
    );
    return;
  }

  if (message.type === "claim-seat") {
    const snapshot = store.claimSeat({
      roomId: message.roomId,
      token: message.token,
      name: message.name,
      seat: message.seat,
    });
    meta.token = message.token;
    meta.roomId = snapshot.roomId;
    sockets.set(socket, meta);
    broadcastRoom(snapshot.roomId);
    send(socket, {
      type: "notice",
      message: `你已入座为 ${viewerSeatLabel(snapshot.viewerSeat)}。`,
    });
    broadcastNotice(
      snapshot.roomId,
      `${viewerSeatLabel(snapshot.viewerSeat)} 已入座。`,
      message.token,
    );
    return;
  }

  if (message.type === "action") {
    const snapshot = store.applyAction({
      roomId: message.roomId,
      token: message.token,
      action: message.action,
    });
    meta.token = message.token;
    meta.roomId = snapshot.roomId;
    sockets.set(socket, meta);
    broadcastRoom(snapshot.roomId);
  }
}

function broadcastRoom(roomId: string) {
  for (const [socket, meta] of sockets) {
    if (meta.roomId !== roomId || !meta.token || socket.readyState !== WebSocket.OPEN) {
      continue;
    }

    const snapshot = store.getSnapshot(roomId, meta.token);

    if (snapshot) {
      send(socket, { type: "snapshot", snapshot });
    }
  }
}

function broadcastNotice(roomId: string, message: string, excludeToken?: string) {
  for (const [socket, meta] of sockets) {
    if (
      meta.roomId !== roomId ||
      !meta.token ||
      meta.token === excludeToken ||
      socket.readyState !== WebSocket.OPEN
    ) {
      continue;
    }

    send(socket, { type: "notice", message });
  }
}

function viewerSeatLabel(seat: ViewerSeat): string {
  if (seat === 0) {
    return "玩家一";
  }

  if (seat === 1) {
    return "玩家二";
  }

  return "旁观者";
}

function send(socket: WebSocket, message: RoomServerMessage) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function sendJson(response: http.ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function setCors(response: http.ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}
