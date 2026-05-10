import http from "node:http";
import net from "node:net";

const proxyPort = Number(process.env.HOLDEM_PUBLIC_PROXY_PORT ?? 8789);
const webHost = process.env.HOLDEM_WEB_HOST ?? "127.0.0.1";
const webPort = Number(process.env.HOLDEM_WEB_PORT ?? 3000);
const roomHost = process.env.HOLDEM_PROXY_ROOM_HOST ?? "127.0.0.1";
const roomPort = Number(process.env.HOLDEM_ROOM_PORT ?? 8788);

const server = http.createServer((request, response) => {
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
