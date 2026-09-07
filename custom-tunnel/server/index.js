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

// CORS 설정 (모든 출처 허용 + 쿠키 지원)
app.use((req, res, next) => {
  // Origin 헤더가 있으면 그것을 사용, 없으면 와일드카드
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie",
  );
  res.header("Access-Control-Allow-Credentials", "true"); // 쿠키 전송 허용

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

// 요청 ID는 바이너리 프레임 헤더(4바이트)에 실리므로 uint32 정수를 쓴다.
let nextRequestId = 1;
function allocRequestId() {
  const id = nextRequestId++;
  if (nextRequestId > 0xffffffff) {
    nextRequestId = 1;
  }
  return id;
}

// 서버와 클라이언트(VSIX 안에 들어 있음)는 따로 배포되므로 버전이 어긋날 수 있다.
// 어긋난 걸 알려주지 않으면 "모든 요청이 조용히 멈춤"으로 나타나 원인을 못 찾는다.
// 프로토콜을 바꿀 때마다 이 숫자를 올린다.
//   1: response 단일 프레임 (Base64)
//   2: response_head + 바이너리 청크 + response_end (스트리밍)
const PROTOCOL_VERSION = 2;
// 클라이언트가 hello를 보낼 때까지 기다리는 시간
const HELLO_GRACE_MS = 5000;

// 요청 바디 상한 (터널은 개발용이므로 넉넉히, 단 무제한은 아님)
const MAX_REQUEST_BODY = 50 * 1024 * 1024;
// 첫 바이트까지의 제한 시간. 이후에는 타임아웃을 걸지 않는다 (SSE는 끝나지 않음).
const TTFB_TIMEOUT_MS = 30000;

function sendControl(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // 연결이 이미 끊긴 경우는 무시 (close 핸들러가 정리한다)
    }
  }
}

function finishRequest(requestId) {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timeout);
  pendingRequests.delete(requestId);
  pending.ownRequests?.delete(requestId);
}

console.log("🚀 Custom Tunnel Server Starting...");

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
app.post("/log", express.json(), (req, res) => {
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

  // 클라이언트가 구버전이면 hello가 오지 않는다. 그 상태로 두면 모든 요청이
  // 조용히 멈추므로, 유예 시간 뒤에 이유를 알려주고 끊는다.
  let helloSeen = false;
  const helloTimer = setTimeout(() => {
    if (helloSeen) {
      return;
    }
    console.warn(`⚠️  구버전 클라이언트 (hello 없음): ${tunnelId}`);
    // 구버전 클라이언트도 type:"log"는 처리하므로 확장 콘솔에 이유가 남는다
    sendControl(ws, {
      type: "log",
      level: "error",
      message: `터널 클라이언트가 구버전입니다. 서버 프로토콜 v${PROTOCOL_VERSION}. VSIX를 다시 설치하세요.`,
      timestamp: new Date().toISOString(),
    });
    ws.close(4001, `protocol mismatch: server v${PROTOCOL_VERSION}`);
  }, HELLO_GRACE_MS);

  // 클라이언트에게 터널 ID 전송
  ws.send(
    JSON.stringify({
      type: "connected",
      protocol: PROTOCOL_VERSION,
      tunnelId: tunnelId,
      url: serverUrl,
    }),
  );

  // 이 터널을 기다리는 요청들. 연결이 끊기면 전부 실패 처리해야 한다.
  const ownRequests = new Set();
  ws.ownRequests = ownRequests;

  // 클라이언트로부터 응답 받기
  // - 텍스트 프레임: 제어 메시지(JSON)
  // - 바이너리 프레임: 응답 본문 청크 [4바이트 BE requestId][페이로드]
  ws.on("message", (message, isBinary) => {
    if (isBinary) {
      if (message.length < 4) {
        return;
      }
      const requestId = message.readUInt32BE(0);
      const pending = pendingRequests.get(requestId);
      // head가 아직 안 왔으면 쓸 수 없다 (순서가 깨진 경우 방어)
      if (!pending || !pending.headSent) {
        return;
      }

      const flushed = pending.res.write(message.subarray(4));
      if (!flushed && !pending.paused) {
        // 브라우저가 받아가지 못하는 중 → 로컬 스트림을 멈춰 메모리 폭증을 막는다
        pending.paused = true;
        sendControl(ws, { type: "pause", requestId });
        pending.res.once("drain", () => {
          pending.paused = false;
          sendControl(ws, { type: "resume", requestId });
        });
      }
      return;
    }

    try {
      const data = JSON.parse(message);

      if (data.type === "hello") {
        helloSeen = true;
        clearTimeout(helloTimer);
        if (data.protocol !== PROTOCOL_VERSION) {
          console.warn(
            `⚠️  프로토콜 불일치: 클라이언트 v${data.protocol} ↔ 서버 v${PROTOCOL_VERSION}`,
          );
          ws.close(
            4001,
            `protocol mismatch: server v${PROTOCOL_VERSION}, client v${data.protocol}`,
          );
        } else {
          console.log(`🤝 프로토콜 v${data.protocol} 확인: ${tunnelId}`);
        }
        return;
      }

      const pending = pendingRequests.get(data.requestId);

      if (data.type === "response_head") {
        if (!pending) {
          return;
        }
        // 첫 바이트가 도착했으므로 TTFB 타임아웃을 해제한다.
        // 이후로는 시간 제한을 두지 않는다 — SSE 응답은 원래 끝나지 않는다.
        clearTimeout(pending.timeout);
        pending.timeout = null;

        const headers = { ...data.headers };
        // 중간 프록시가 응답을 모아두면 SSE가 폰까지 도달하지 않는다
        headers["x-accel-buffering"] = "no";

        pending.res.writeHead(data.statusCode, headers);
        pending.res.flushHeaders();
        pending.res.socket?.setNoDelay(true);
        pending.headSent = true;
      } else if (data.type === "response_end") {
        if (!pending) {
          return;
        }
        pending.res.end();
        finishRequest(data.requestId);
        console.log(`📤 응답 완료: ${data.requestId}`);
      } else if (data.type === "response_error") {
        if (!pending) {
          return;
        }
        if (!pending.res.headersSent) {
          pending.res
            .status(data.statusCode || 502)
            .send(data.message || "Bad Gateway");
        } else {
          // 이미 스트리밍이 시작된 뒤라면 상태 코드를 바꿀 수 없다. 끊는 게 최선.
          pending.res.end();
        }
        finishRequest(data.requestId);
      }
    } catch (error) {
      console.error("❌ 메시지 처리 오류:", error);
    }
  });

  ws.on("close", () => {
    clearTimeout(helloTimer);
    console.log(`❌ 터널 종료: ${tunnelId}`);
    tunnels.delete(tunnelId);

    // 이 터널의 응답을 기다리던 요청을 즉시 끊는다.
    // 정리하지 않으면 TTFB 타임아웃(30초)까지 브라우저가 매달려 있게 된다.
    for (const requestId of [...ownRequests]) {
      const pending = pendingRequests.get(requestId);
      if (!pending) {
        continue;
      }
      clearTimeout(pending.timeout);
      if (!pending.res.headersSent) {
        pending.res.status(503).send("Tunnel closed");
      } else {
        pending.res.end();
      }
      pendingRequests.delete(requestId);
    }
    ownRequests.clear();
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

  // 경로에서 터널 ID 추출하거나 쿠키/query parameter/referer에서 가져오기
  // 슬래시 유무 모두 허용: /abc12345 또는 /abc12345/
  const pathMatch = req.path.match(/^\/([a-f0-9]{8})(\/.*)?$/);

  // 호스트 정보 가져오기 (쿠키 설정용)
  const host = req.headers.host || "localhost:8080";
  const isProduction = !host.includes("localhost");

  if (pathMatch) {
    // URL에 터널 ID가 있는 경우: /abc12345/path
    tunnelId = pathMatch[1];
    const pathWithoutTunnelId = pathMatch[2] || "/";

    // 쿼리 파라미터 추출 (req.url에서 가져옴)
    const queryString = req.url.includes("?")
      ? req.url.substring(req.url.indexOf("?"))
      : "";
    fullPath = pathWithoutTunnelId + queryString;

    // 쿠키에 터널 ID 저장 (크로스 도메인 지원)
    const cookieOptions = {
      httpOnly: false, // 클라이언트 JavaScript에서도 접근 가능하도록
      path: "/",
      sameSite: isProduction ? "none" : "lax", // 프로덕션: none, 로컬: lax
      secure: isProduction, // HTTPS에서만 전송 (프로덕션)
      maxAge: 24 * 60 * 60 * 1000, // 24시간
    };

    res.cookie("tunnelId", tunnelId, cookieOptions);
    console.log(
      `🍪 쿠키 설정: tunnelId=${tunnelId}, path=${req.url}, sameSite=${cookieOptions.sameSite}, secure=${isProduction}`,
    );

    // URL에서 tunnelID 제거하고 리다이렉트 (쿠키로 처리)
    console.log(
      `↪️  리다이렉트: ${fullPath} (tunnelID 제거, 쿼리 파라미터 유지)`,
    );
    return res.redirect(302, fullPath);
  } else if (req.cookies.tunnelId) {
    // 쿠키에 터널 ID가 있는 경우: 모든 요청 처리
    tunnelId = req.cookies.tunnelId;
    fullPath = req.url; // 쿼리 파라미터 포함
    console.log(`🍪 쿠키에서 터널 ID 가져옴: ${tunnelId}, path=${fullPath}`);
  } else if (req.query.tunnelId) {
    // Query parameter에서 터널 ID 가져오기 (fallback)
    tunnelId = req.query.tunnelId;
    fullPath = req.url; // 쿼리 파라미터 포함
    console.log(
      `🔗 Query parameter에서 터널 ID 가져옴: ${tunnelId}, path=${fullPath}`,
    );

    // 쿠키도 설정해서 다음 요청부터는 쿠키 사용
    const cookieOptions = {
      httpOnly: false,
      path: "/",
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
    };
    res.cookie("tunnelId", tunnelId, cookieOptions);
  } else if (req.headers.referer) {
    // Referer 헤더에서 터널 ID 추출 (manifest.json 등 쿠키가 전달되지 않는 경우)
    const refererMatch = req.headers.referer.match(/\/([a-f0-9]{8})(\/|$)/);
    if (refererMatch) {
      tunnelId = refererMatch[1];
      fullPath = req.url; // 쿼리 파라미터 포함
      console.log(
        `🔗 Referer 헤더에서 터널 ID 추출: ${tunnelId}, path=${fullPath}, referer=${req.headers.referer}`,
      );

      // 쿠키도 설정해서 다음 요청부터는 쿠키 사용
      const cookieOptions = {
        httpOnly: false,
        path: "/",
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction,
        maxAge: 24 * 60 * 60 * 1000,
      };
      res.cookie("tunnelId", tunnelId, cookieOptions);
    } else {
      // Referer에서도 터널 ID를 찾을 수 없음
      console.warn(
        `⚠️  터널 ID를 찾을 수 없음: path=${req.path}, cookies=${JSON.stringify(req.cookies)}, query=${JSON.stringify(req.query)}, referer=${req.headers.referer}`,
      );
      return res.status(404).send("Tunnel ID not found");
    }
  } else {
    // 터널 ID를 찾을 수 없음
    console.warn(
      `⚠️  터널 ID를 찾을 수 없음: path=${req.path}, cookies=${JSON.stringify(req.cookies)}, query=${JSON.stringify(req.query)}, headers.cookie=${req.headers.cookie}, referer=${req.headers.referer}`,
    );
    return res.status(404).send("Tunnel ID not found");
  }

  console.log(`📥 요청 받음: ${tunnelId} → ${fullPath}`);

  const ws = tunnels.get(tunnelId);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return res.status(503).send("Tunnel not available");
  }

  const requestId = allocRequestId();
  ws.ownRequests.add(requestId);

  const pending = {
    req,
    res,
    ws,
    ownRequests: ws.ownRequests,
    headSent: false,
    paused: false,
    timeout: null,
  };
  pendingRequests.set(requestId, pending);

  // 바디 수집 — Buffer로 모은다.
  // 이전에는 `body += chunk.toString()` 이어서 UTF-8로 디코딩되며
  // 이미지·파일 업로드 바이트가 손상됐다.
  const bodyChunks = [];
  let bodyBytes = 0;
  let bodyError = false;

  req.on("data", (chunk) => {
    if (bodyError) {
      return;
    }
    bodyBytes += chunk.length;
    if (bodyBytes > MAX_REQUEST_BODY) {
      bodyError = true;
      console.warn(`⚠️  요청 바디 상한 초과: ${requestId} (${bodyBytes}B)`);
      if (!res.headersSent) {
        res.status(413).send("Payload Too Large");
      }
      finishRequest(requestId);
      req.destroy();
      return;
    }
    bodyChunks.push(chunk);
  });

  req.on("end", () => {
    if (bodyError || !pendingRequests.has(requestId)) {
      return;
    }

    const body = Buffer.concat(bodyChunks);
    try {
      ws.send(
        JSON.stringify({
          type: "request",
          requestId: requestId,
          method: req.method,
          url: fullPath,
          headers: req.headers,
          bodyBase64: body.length ? body.toString("base64") : "",
        }),
      );

      console.log(`📨 터널로 전송: ${req.method} ${fullPath} (${body.length}B)`);
    } catch (error) {
      console.error(`❌ 전송 실패: ${requestId}`, error.message);
      if (!res.headersSent) {
        res.status(502).send("Bad Gateway: Failed to send request to tunnel");
      }
      finishRequest(requestId);
    }
  });

  req.on("error", (error) => {
    bodyError = true;
    console.error(`❌ 요청 오류: ${requestId}`, error.message);
    if (pendingRequests.has(requestId)) {
      if (!res.headersSent) {
        res.status(502).send(`Bad Gateway: ${error.message}`);
      }
      finishRequest(requestId);
    }
  });

  res.on("close", () => {
    // 브라우저가 먼저 끊은 경우 (SSE 탭을 닫는 등).
    // 알려주지 않으면 클라이언트 쪽 로컬 스트림이 계속 살아서 누적된다.
    if (pendingRequests.has(requestId)) {
      console.log(`🔌 클라이언트 연결 끊김: ${requestId}`);
      sendControl(ws, { type: "abort", requestId });
      finishRequest(requestId);
    }
  });

  // 첫 바이트까지만 제한한다. 응답이 시작된 뒤에는 제한을 두지 않는다.
  // (기존엔 "응답 완료까지 30초"여서 SSE가 항상 504로 끊겼다)
  pending.timeout = setTimeout(() => {
    const current = pendingRequests.get(requestId);
    if (!current || current.headSent) {
      return;
    }
    console.log(`⏰ 타임아웃 (첫 바이트 미도달): ${requestId}`);
    sendControl(ws, { type: "abort", requestId });
    if (!res.headersSent) {
      res.status(504).send("Gateway Timeout");
    }
    finishRequest(requestId);
  }, TTFB_TIMEOUT_MS);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🌐 터널 서버 실행 중: http://localhost:${PORT}`);
  console.log(`WebSocket 서버 준비 완료`);
  console.log(`환경: ${process.env.NODE_ENV || "development"}`);
});
