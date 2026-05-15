import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";

const proxyPort = Number(process.env.HOLDEM_PUBLIC_PROXY_PORT ?? 8789);
const webHost = process.env.HOLDEM_WEB_HOST ?? "127.0.0.1";
const webPort = Number(process.env.HOLDEM_WEB_PORT ?? 3000);
const roomHost = process.env.HOLDEM_PROXY_ROOM_HOST ?? "127.0.0.1";
const roomPort = Number(process.env.HOLDEM_ROOM_PORT ?? 8788);
const roomListenHost = process.env.HOLDEM_ROOM_HOST ?? "0.0.0.0";
const roomStartTimeoutMs = 6500;
const roomHealthRetryDelayMs = 250;

let startingRoomServer: Promise<boolean> | null = null;

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (url.pathname.replace(/\/$/, "") === "/api/texas-holdem/ensure-room-server") {
    void handleEnsureRoomServer(request, response);
    return;
  }

  const target = {
    host: webHost,
    port: webPort,
  };
  const headers = getForwardHeaders(request, target);
  const proxy = http.request(
    {
      host: target.host,
      port: target.port,
      method: request.method,
      path: request.url,
      headers,
    },
    (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
      proxyResponse.pipe(response);
    },
  );

  proxy.on("error", (error) => {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Proxy error: ${error.message}`);
  });

  request.pipe(proxy);
});

server.on("upgrade", (request, socket, head) => {
  const target = request.url?.startsWith("/ws")
    ? { host: roomHost, port: roomPort }
    : { host: webHost, port: webPort };
  const targetSocket = net.connect(target.port, target.host, () => {
    targetSocket.write(
      `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${Object.entries(
        getForwardHeaders(request, target),
      )
        .map(([key, value]) => `${key}: ${value}`)
        .join("\r\n")}\r\n\r\n`,
    );
    targetSocket.write(head);
    socket.pipe(targetSocket);
    targetSocket.pipe(socket);
  });

  targetSocket.on("error", () => {
    socket.destroy();
  });
});

server.listen(proxyPort, "0.0.0.0", () => {
  console.log(
    `Texas Hold'em public proxy listening on http://0.0.0.0:${proxyPort} -> web ${webHost}:${webPort}, room ${roomHost}:${roomPort}`,
  );
});

async function handleEnsureRoomServer(
  request: http.IncomingMessage,
  response: http.ServerResponse,
) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const requestedPort = await getRequestedPort(request);

  if (await isRoomServerHealthy(requestedPort)) {
    sendJson(response, 200, { ok: true, port: requestedPort, status: "already-running" });
    return;
  }

  startingRoomServer ??= startRoomServer(requestedPort).finally(() => {
    startingRoomServer = null;
  });

  const started = await startingRoomServer;

  if (!started) {
    sendJson(response, 502, {
      ok: false,
      port: requestedPort,
      error: `房间服务没有在 ${requestedPort} 端口启动成功。`,
    });
    return;
  }

  sendJson(response, 200, { ok: true, port: requestedPort, status: "started" });
}

async function getRequestedPort(request: http.IncomingMessage) {
  try {
    const body = (await readBody(request)) as { port?: unknown };
    const port = Number(body.port);

    if (Number.isInteger(port) && port > 0 && port < 65536) {
      return port;
    }
  } catch {
    // Empty or invalid JSON falls back to the configured room port.
  }

  return roomPort;
}

async function startRoomServer(port: number) {
  const child = spawn("pnpm", ["run", "holdem:server"], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      HOLDEM_ROOM_HOST: roomListenHost,
      HOLDEM_ROOM_PORT: String(port),
    },
    stdio: "ignore",
  });

  child.unref();

  return waitForRoomServer(port);
}

async function waitForRoomServer(port: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < roomStartTimeoutMs) {
    if (await isRoomServerHealthy(port)) {
      return true;
    }

    await delay(roomHealthRetryDelayMs);
  }

  return false;
}

async function isRoomServerHealthy(port: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 700);

  try {
    const response = await fetch(`http://${roomHost}:${port}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function getForwardHeaders(
  request: http.IncomingMessage,
  target: { host: string; port: number },
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      headers[key] = value.join(", ");
    } else if (typeof value === "string") {
      headers[key] = value;
    }
  }

  headers.host = `${target.host}:${target.port}`;
  headers["x-forwarded-host"] = request.headers.host ?? "";
  headers["x-forwarded-proto"] = "https";

  return headers;
}

function setCors(response: http.ServerResponse) {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "POST, OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

function sendJson(response: http.ServerResponse, status: number, payload: object) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
