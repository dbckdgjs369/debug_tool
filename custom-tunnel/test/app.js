// 터널 검증용 가짜 dev 서버
const http = require("http");
const crypto = require("crypto");
const WebSocket = require("../client/node_modules/ws");

// WS 릴레이 검증용 관측값. /wsstat 으로 읽는다.
const wsStat = {
  opened: 0,
  closed: 0,
  lastCloseCode: null,
  lastHeaders: {},
  lastProtocol: null,
  lastUrl: null,
};

// 결정적 바이너리 (PNG 시그니처 + 랜덤 아닌 패턴)
const IMG = Buffer.alloc(64 * 1024);
IMG.write("\x89PNG\r\n\x1a\n", 0, "binary");
for (let i = 8; i < IMG.length; i++) {
  IMG[i] = i % 256;
}
const IMG_SHA = crypto.createHash("sha256").update(IMG).digest("hex");

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/") {
    const html =
      "<!doctype html><html><head><title>t</title></head>" +
      "<body><img src=\"http://localhost:4321/img.png\"><p>hello</p></body></html>";
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (url === "/img.png") {
    res.writeHead(200, { "content-type": "image/png" });
    res.end(IMG);
    return;
  }

  if (url === "/sse") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    });
    let n = 0;
    const timer = setInterval(() => {
      n++;
      res.write(`data: tick-${n} at ${Date.now()}\n\n`);
      if (n >= 5) {
        clearInterval(timer);
        res.end();
      }
    }, 700);
    req.on("close", () => clearInterval(timer));
    return;
  }

  if (url === "/upload" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const sha = crypto.createHash("sha256").update(body).digest("hex");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ bytes: body.length, sha256: sha }));
    });
    return;
  }

  if (url === "/big") {
    // 8MB 스트리밍 — 역압 경로 확인
    res.writeHead(200, { "content-type": "application/octet-stream" });
    let sent = 0;
    const block = Buffer.alloc(64 * 1024, 7);
    const pump = () => {
      while (sent < 8 * 1024 * 1024) {
        sent += block.length;
        if (!res.write(block)) {
          res.once("drain", pump);
          return;
        }
      }
      res.end();
    };
    pump();
    return;
  }

  if (url === "/wsstat") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(wsStat));
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("nope");
});

// --- WebSocket 에코 엔드포인트 ---
// 실제 dev 서버처럼 같은 포트에서 /echo 만 업그레이드를 받는다.
const appWss = new WebSocket.Server({
  noServer: true,
  // Vite HMR처럼 서브프로토콜을 골라서 돌려준다
  handleProtocols: (protocols) =>
    protocols.has("vite-hmr") ? "vite-hmr" : false,
});

server.on("upgrade", (req, socket, head) => {
  const path = req.url.split("?")[0];
  if (path !== "/echo") {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  appWss.handleUpgrade(req, socket, head, (client) => {
    wsStat.opened++;
    wsStat.lastHeaders = req.headers;
    wsStat.lastProtocol = client.protocol || "";
    wsStat.lastUrl = req.url;

    client.send("welcome");

    client.on("message", (payload, isBinary) => {
      if (isBinary) {
        client.send(payload, { binary: true });
        return;
      }
      const text = payload.toString();
      if (text === "__close__") {
        // 로컬이 먼저 끊는 경우를 만들기 위한 트리거
        client.close(4321, "app initiated");
        return;
      }
      client.send("echo:" + text);
    });

    client.on("close", (code) => {
      wsStat.closed++;
      wsStat.lastCloseCode = code;
    });
  });
});

server.listen(4321, () => {
  console.log("APP_READY img_sha256=" + IMG_SHA);
});
