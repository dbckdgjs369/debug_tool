const WebSocket = require("ws");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");

const app = express();
app.use(cookieParser());

// CORS 설정 (모든 출처 허용)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight 요청 처리
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// HTTPS 지원 (자체 서명 인증서)
const USE_HTTPS = process.env.USE_HTTPS === "true";
let server;

if (USE_HTTPS) {
  // 자체 서명 인증서 생성 (개발 환경용)
  // 실제로는 인증서 파일이 필요하지만, 여기서는 간단히 HTTP 폴백
  console.log("⚠️  HTTPS 모드는 인증서 파일이 필요합니다.");
  console.log("HTTP 모드로 실행합니다. HTTPS를 원하시면 인증서를 설정하세요.");
  server = http.createServer(app);
} else {
  server = http.createServer(app);
}

const wss = new WebSocket.Server({ server });

// 연결된 터널 클라이언트들을 저장
const tunnels = new Map();
// 대기 중인 HTTP 요청들 (응답을 기다리는 중)
const pendingRequests = new Map();

console.log("🚀 Custom Tunnel Server Starting...");

// JSON body parser 미들웨어 추가
app.use(express.json());

// 로그 수신 엔드포인트 (GET은 상태 확인용)
app.get("/log", (req, res) => {
  res.json({
    status: "active",
    message: "Remote console log endpoint is ready",
    activeTunnels: tunnels.size,
    usage: "POST to this endpoint with {tunnelId, level, message}",
  });
});

// 로그 수신 엔드포인트 (POST는 실제 로그 전송)
app.post("/log", (req, res) => {
  const { tunnelId, level, message } = req.body;

  console.log(`📝 로그 수신: [${tunnelId}] ${level}: ${message}`);

  // 해당 터널의 WebSocket 연결 찾기
  const ws = tunnels.get(tunnelId);

  if (ws && ws.readyState === WebSocket.OPEN) {
    // 클라이언트(VS Code)에게 로그 전송
    try {
      ws.send(
        JSON.stringify({
          type: "log",
          level: level,
          message: message,
          timestamp: new Date().toISOString(),
        }),
      );
      console.log(`✅ 로그 전달: ${tunnelId}`);
      res.json({ success: true });
    } catch (error) {
      console.error(`❌ 로그 전달 실패: ${tunnelId}`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  } else {
    console.warn(`⚠️  터널을 찾을 수 없음: ${tunnelId}`);
    res.status(404).json({ success: false, error: "Tunnel not found" });
  }
});

// WebSocket 연결 처리 (터널 클라이언트가 연결)
wss.on("connection", (ws, req) => {
  const tunnelId = uuidv4().substring(0, 8);

  console.log(`✅ 새 터널 연결: ${tunnelId}`);

  tunnels.set(tunnelId, ws);

  // 실제 서버 URL 생성 (배포 환경 고려)
  const host = req.headers.host || "localhost:8080";
  const protocol = host.includes("localhost") ? "http" : "https";
  const serverUrl = `${protocol}://${host}/${tunnelId}`;

  // 클라이언트에게 터널 ID 전송
  ws.send(
    JSON.stringify({
      type: "connected",
      tunnelId: tunnelId,
      url: serverUrl,
    }),
  );

  // 클라이언트로부터 응답 받기
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "response") {
        const { requestId, statusCode, headers, body, isBase64 } = data;

        // 대기 중인 요청에 응답 전송
        const pendingReq = pendingRequests.get(requestId);
        if (pendingReq) {
          pendingReq.res.writeHead(statusCode, headers);

          // Base64로 인코딩된 바이너리 데이터는 디코딩하여 전송
          if (isBase64) {
            const binaryData = Buffer.from(body, "base64");
            pendingReq.res.end(binaryData);
            console.log(`📤 응답 전송 (바이너리): ${requestId}`);
          } else {
            // 텍스트 데이터는 그대로 전송
            pendingReq.res.end(body);
            console.log(`📤 응답 전송: ${requestId}`);
          }

          pendingRequests.delete(requestId);
        }
      }
    } catch (error) {
      console.error("❌ 메시지 처리 오류:", error);
    }
  });

  ws.on("close", () => {
    console.log(`❌ 터널 종료: ${tunnelId}`);
    tunnels.delete(tunnelId);
  });

  ws.on("error", (error) => {
    console.error(`❌ WebSocket 오류 (${tunnelId}):`, error);
  });
});

// HTTP 요청 처리 (터널 프록시 - /log는 위에서 이미 처리됨)
app.all("*", (req, res) => {
  // 기본 페이지는 쿠키가 없을 때만 표시
  if (req.path === "/" && !req.cookies.tunnelId) {
    return res.send(`
      <h1>🚇 Custom Tunnel Server</h1>
      <p>활성 터널: ${tunnels.size}개</p>
      <p>대기 중인 요청: ${pendingRequests.size}개</p>
      <hr>
      <h2>사용 방법:</h2>
      <ol>
        <li>터널 클라이언트를 실행하세요</li>
        <li>생성된 URL로 접속하세요</li>
      </ol>
    `);
  }
  let tunnelId;
  let fullPath;

  // 경로에서 터널 ID 추출하거나 쿠키에서 가져오기
  // 슬래시 유무 모두 허용: /abc12345 또는 /abc12345/
  const pathMatch = req.path.match(/^\/([a-f0-9]{8})(\/.*)?$/);

  if (pathMatch) {
    // URL에 터널 ID가 있는 경우: /abc12345/path
    tunnelId = pathMatch[1];
    fullPath = pathMatch[2] || "/";

    // 쿠키에 터널 ID 저장
    res.cookie("tunnelId", tunnelId, { httpOnly: true, path: "/" });

    // fullPath는 이미 / 로 설정됨 (React Router가 / 를 인식)
    // 리다이렉트 없이 바로 처리
  } else if (req.cookies.tunnelId) {
    // 쿠키에 터널 ID가 있는 경우: 모든 요청 처리
    tunnelId = req.cookies.tunnelId;
    fullPath = req.path;
  } else {
    // 터널 ID를 찾을 수 없음
    return res.status(404).send("Tunnel ID not found");
  }

  console.log(`📥 요청 받음: ${tunnelId} → ${fullPath}`);

  const ws = tunnels.get(tunnelId);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return res.status(503).send("Tunnel not available");
  }

  // 요청 ID 생성
  const requestId = uuidv4();

  // 요청을 대기 목록에 추가
  pendingRequests.set(requestId, { req, res });

  // 바디 수집
  let body = "";
  let bodyError = false;

  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    if (bodyError) {
      return;
    }

    // 터널 클라이언트에게 요청 전송
    try {
      ws.send(
        JSON.stringify({
          type: "request",
          requestId: requestId,
          method: req.method,
          url: fullPath,
          headers: req.headers,
          body: body,
        }),
      );

      console.log(`📨 터널로 전송: ${req.method} ${fullPath}`);
    } catch (error) {
      console.error(`❌ 전송 실패: ${requestId}`, error.message);
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        if (!res.headersSent) {
          res.status(502).send("Bad Gateway: Failed to send request to tunnel");
        }
      }
    }
  });

  req.on("error", (error) => {
    bodyError = true;
    console.error(`❌ 요청 오류: ${requestId}`, error.message);
    if (pendingRequests.has(requestId)) {
      pendingRequests.delete(requestId);
      if (!res.headersSent) {
        res.status(502).send(`Bad Gateway: ${error.message}`);
      }
    }
  });

  res.on("close", () => {
    // 클라이언트가 연결을 끊은 경우
    if (pendingRequests.has(requestId)) {
      pendingRequests.delete(requestId);
      console.log(`🔌 클라이언트 연결 끊김: ${requestId}`);
    }
  });

  // 타임아웃 설정 (30초)
  const timeout = setTimeout(() => {
    if (pendingRequests.has(requestId)) {
      pendingRequests.delete(requestId);
      if (!res.headersSent) {
        res.status(504).send("Gateway Timeout");
      }
      console.log(`⏰ 타임아웃: ${requestId}`);
    }
  }, 30000);

  // 응답이 완료되면 타임아웃 취소
  res.on("finish", () => {
    clearTimeout(timeout);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🌐 터널 서버 실행 중: http://localhost:${PORT}`);
  console.log(`WebSocket 서버 준비 완료`);
  console.log(`환경: ${process.env.NODE_ENV || "development"}`);
});
