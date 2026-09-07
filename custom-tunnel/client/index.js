const WebSocket = require("ws");
const axios = require("axios");
const https = require("https");
const http = require("http");

// 명령줄 인자에서 로컬 포트 가져오기
const localPort = process.argv[2] || 3000;
const tunnelServerUrl = process.argv[3] || "ws://localhost:8080";
const useHttps = process.argv[4] === "https" || process.argv[4] === "true";

// WebSocket URL을 HTTP URL로 변환 (로그 전송용)
const tunnelServerHttpUrl = tunnelServerUrl
  .replace("wss://", "https://")
  .replace("ws://", "http://");

console.log(`🔌 터널 클라이언트 시작...`);
console.log(
  `📍 로컬 서버: ${useHttps ? "https" : "http"}://localhost:${localPort}`,
);
console.log(`🌐 터널 서버: ${tunnelServerUrl}`);
console.log(`📡 로그 서버: ${tunnelServerHttpUrl}`);

// 터널 서버에 연결
const ws = new WebSocket(tunnelServerUrl);

// 서버(Render)와 이 클라이언트(VSIX 안)는 따로 배포되므로 버전이 어긋날 수 있다.
// server/index.js 의 PROTOCOL_VERSION 과 반드시 같아야 한다.
const PROTOCOL_VERSION = 2;

// 진행 중인 요청 (requestId -> { controller, flow })
// 서버의 abort/pause/resume 제어 메시지를 받아 처리하기 위해 유지한다.
const inflight = new Map();

// WS 송신 버퍼가 이만큼 쌓이면 로컬 스트림을 멈춘다.
// 없으면 큰 파일을 받을 때 메모리가 그대로 폭증한다.
const WS_HIGH_WATER = 4 * 1024 * 1024;
const WS_LOW_WATER = 1 * 1024 * 1024;

// 로컬 서버가 응답 헤더를 줄 때까지의 제한 시간.
// 헤더가 온 뒤에는 제한하지 않는다 (SSE 응답은 끝나지 않는 게 정상).
const TTFB_TIMEOUT_MS = 30000;

function sendJson(payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

// 응답 본문 청크는 바이너리 프레임으로 보낸다: [4바이트 BE requestId][페이로드]
// Base64로 감싸면 33% 커지고, 텍스트/바이너리 분기 로직이 필요해진다.
function sendChunk(requestId, chunk) {
  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32BE(requestId, 0);
  ws.send(Buffer.concat([header, chunk]), { binary: true });
}

// 취소(abort)와 실제 오류를 구분한다. axios는 취소 시점에 따라
// CanceledError를 catch로 던지기도 하고 스트림 error로 흘리기도 한다.
function isCanceled(error) {
  return (
    error?.name === "CanceledError" ||
    error?.name === "AbortError" ||
    error?.code === "ERR_CANCELED" ||
    error?.message === "canceled"
  );
}

// 스트림 일시정지 사유를 겹쳐 관리한다.
// 서버 역압("peer")과 WS 버퍼 역압("ws")이 동시에 걸릴 수 있으므로,
// 한쪽이 풀렸다고 바로 resume 하면 안 된다.
function makeFlow(stream) {
  const reasons = new Set();
  return {
    pause(reason) {
      reasons.add(reason);
      stream.pause();
    },
    resume(reason) {
      reasons.delete(reason);
      if (reasons.size === 0) {
        stream.resume();
      }
    },
    has(reason) {
      return reasons.has(reason);
    },
  };
}

// WS 송신 버퍼가 빠질 때까지 폴링한다. ws 모듈에는 drain 이벤트가 없다.
function waitForWsDrain(flow) {
  const check = () => {
    if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount < WS_LOW_WATER) {
      flow.resume("ws");
      return;
    }
    setTimeout(check, 20);
  };
  setTimeout(check, 20);
}

// 로컬 절대 URL을 상대 경로로 바꾼다.
// 예: http://localhost:3000/foo → /foo
// 이렇게 하면 폰에서도 같은 터널을 거쳐 요청이 나간다.
// (기존 코드는 하드코딩된 `http://localhost:8080`으로 치환해서 오동작했다)
const LOCAL_ABSOLUTE_URL = new RegExp(
  `https?://(?:localhost|127\\.0\\.0\\.1):${localPort}`,
  "gi",
);

ws.on("open", () => {
  console.log("✅ 터널 서버 연결 성공!");
  sendJson({ type: "hello", protocol: PROTOCOL_VERSION });
});

ws.on("message", async (message) => {
  try {
    const data = JSON.parse(message);

    if (data.type === "connected") {
      // 구버전 서버는 protocol 필드를 보내지 않는다.
      // 그대로 진행하면 모든 요청이 조용히 멈추므로 여기서 끊는다.
      if (data.protocol !== PROTOCOL_VERSION) {
        console.error(
          `❌ 터널 서버 프로토콜 불일치 (서버 v${data.protocol ?? "1 이하"}, 클라이언트 v${PROTOCOL_VERSION})`,
        );
        console.error("   터널 서버를 최신 버전으로 배포해야 합니다.");
        ws.close();
        process.exit(1);
      }
      console.log("\n🎉 터널 생성 완료!");
      console.log(`📎 터널 URL: ${data.url}`);
      console.log(`🔑 터널 ID: ${data.tunnelId}`);
      console.log("\n이제 터널 URL로 접속하면 로컬 서버로 연결됩니다!\n");
    } else if (data.type === "log") {
      // 원격 콘솔 로그 수신
      const { level, message: logMessage, timestamp } = data;
      console.log(
        `🔍 [REMOTE_LOG] ${JSON.stringify({ level, message: logMessage, timestamp })}`,
      );

      // 페이지 로드 감지
      if (logMessage.includes("PAGE_LOADED")) {
        console.log("[FIRST_ACCESS]");
      }
    } else if (data.type === "abort") {
      // 브라우저가 먼저 끊었거나 서버에서 타임아웃된 경우.
      // 헤더 이후에 취소하면 axios가 catch가 아니라 stream error로 던지므로,
      // 스트림 핸들러가 "오류"와 구분할 수 있도록 표시를 남긴다.
      const entry = inflight.get(data.requestId);
      if (entry) {
        entry.aborted = true;
        inflight.delete(data.requestId);
        entry.controller.abort();
      }
    } else if (data.type === "pause") {
      inflight.get(data.requestId)?.flow?.pause("peer");
    } else if (data.type === "resume") {
      inflight.get(data.requestId)?.flow?.resume("peer");
    } else if (data.type === "request") {
      await handleRequest(data);
    }
  } catch (error) {
    console.error("❌ 메시지 처리 오류:", error);
  }
});

async function handleRequest(data) {
  const { requestId, method, url, headers, bodyBase64 } = data;

  console.log(`📥 요청 받음: ${method} ${url}`);

  const controller = new AbortController();
  inflight.set(requestId, { controller, flow: null });

  // 헤더가 도착할 때까지만 걸어두는 타이머.
  // axios 자체 timeout은 소켓 무활동 타임아웃이라 SSE 스트림을 죽인다.
  let ttfbTimer = setTimeout(() => {
    console.warn(`⏰ 로컬 응답 헤더 지연으로 중단: ${method} ${url}`);
    controller.abort();
  }, TTFB_TIMEOUT_MS);

  try {
    // 불필요한 헤더 제거 (프록시 문제 방지)
    const cleanHeaders = { ...headers };
    delete cleanHeaders["host"];
    delete cleanHeaders["connection"];
    delete cleanHeaders["content-length"];
    delete cleanHeaders["transfer-encoding"];
    delete cleanHeaders["accept-encoding"]; // gzip 문제 방지

    const requestBody = bodyBase64
      ? Buffer.from(bodyBase64, "base64")
      : undefined;

    // 로컬 서버로 요청 전달
    const protocol = useHttps ? "https" : "http";
    // agent timeout 은 소켓 무활동 타임아웃이다. 0 이 아니면 SSE 연결이 끊긴다.
    const agent = useHttps
      ? new https.Agent({
          rejectUnauthorized: false, // 자체 서명 인증서 허용
          keepAlive: false,
          timeout: 0,
          scheduling: "lifo",
        })
      : new http.Agent({
          keepAlive: false,
          timeout: 0,
          scheduling: "lifo",
        });

    const response = await axios({
      method: method,
      url: `${protocol}://localhost:${localPort}${url}`,
      headers: cleanHeaders,
      data: requestBody,
      validateStatus: () => true, // 모든 상태 코드 허용
      maxRedirects: 0,
      responseType: "stream", // 헤더 도착 시점에 resolve → 본문은 흘려보낸다
      timeout: 0, // 직접 만든 TTFB 타이머로 대체
      signal: controller.signal,
      decompress: true, // 자동 압축 해제 활성화 (gzip 처리)
      httpAgent: !useHttps ? agent : undefined,
      httpsAgent: useHttps ? agent : undefined,
      transitional: {
        silentJSONParsing: true,
        forcedJSONParsing: false,
        clarifyTimeoutError: true,
      },
    });

    // 헤더가 도착했으므로 TTFB 타이머 해제
    clearTimeout(ttfbTimer);
    ttfbTimer = null;

    // 서버가 이미 요청을 포기했으면(브라우저가 끊김) 더 진행하지 않는다
    if (!inflight.has(requestId)) {
      response.data.destroy();
      return;
    }

    const contentType = response.headers["content-type"] || "";
    const correctedContentType = correctContentType(url, contentType);

    // 응답 헤더 정리 (프록시 문제 방지)
    const cleanResponseHeaders = { ...response.headers };

    if (correctedContentType !== contentType) {
      cleanResponseHeaders["content-type"] = correctedContentType;
    }

    delete cleanResponseHeaders["transfer-encoding"];
    delete cleanResponseHeaders["connection"];
    delete cleanResponseHeaders["content-encoding"]; // axios가 이미 압축 해제함
    delete cleanResponseHeaders["content-length"]; // 길이가 변경될 수 있음

    // HTTPS 관련 헤더 제거 (HTTP 터널로 전달 시 SSL 오류 방지)
    delete cleanResponseHeaders["strict-transport-security"];
    delete cleanResponseHeaders["content-security-policy"];
    delete cleanResponseHeaders["x-frame-options"];
    delete cleanResponseHeaders["upgrade"];
    delete cleanResponseHeaders["alt-svc"];

    // Location 헤더가 로컬 절대 URL이면 상대 경로로 바꿔 터널을 타게 한다
    if (cleanResponseHeaders["location"]) {
      cleanResponseHeaders["location"] = cleanResponseHeaders[
        "location"
      ].replace(LOCAL_ABSOLUTE_URL, "");
    }

    const isHtml = correctedContentType.includes("text/html");

    if (isHtml) {
      // HTML은 스크립트를 주입해야 하므로 전체 본문이 필요하다.
      // 나머지는 모두 스트리밍한다.
      await sendBufferedHtml(requestId, response, cleanResponseHeaders);
    } else {
      sendStreamed(requestId, response, cleanResponseHeaders, method, url);
    }
  } catch (error) {
    if (ttfbTimer) {
      clearTimeout(ttfbTimer);
    }

    if (isCanceled(error)) {
      // 브라우저가 끊었거나 TTFB 초과. 서버는 이미 정리했으므로 조용히 종료.
      console.log(`🚫 요청 중단됨: ${method} ${url}`);
    } else {
      console.error(`❌ 로컬 서버 요청 실패:`, error.message);
      sendJson({
        type: "response_error",
        requestId: requestId,
        statusCode: 502,
        message: `Bad Gateway: ${error.message}`,
      });
    }
    inflight.delete(requestId);
  }
}

async function sendBufferedHtml(requestId, response, responseHeaders) {
  const chunks = [];
  for await (const chunk of response.data) {
    chunks.push(chunk);
  }

  let html = Buffer.concat(chunks).toString("utf8");

  // 로컬 절대 URL을 상대 경로로 (외부 리소스는 건드리지 않는다)
  html = html.replace(LOCAL_ABSOLUTE_URL, "");

  if (response.status === 200) {
    html = injectConsoleCapture(html);
  }

  const body = Buffer.from(html, "utf8");

  sendJson({
    type: "response_head",
    requestId: requestId,
    statusCode: response.status,
    headers: responseHeaders,
  });
  if (body.length) {
    sendChunk(requestId, body);
  }
  sendJson({ type: "response_end", requestId: requestId });
  inflight.delete(requestId);

  console.log(`📤 응답 전송 (HTML ${body.length}B): ${response.status}`);
}

function sendStreamed(requestId, response, responseHeaders, method, url) {
  sendJson({
    type: "response_head",
    requestId: requestId,
    statusCode: response.status,
    headers: responseHeaders,
  });

  const stream = response.data;
  const flow = makeFlow(stream);
  const entry = inflight.get(requestId);
  if (entry) {
    entry.flow = flow;
  }

  let bytes = 0;

  stream.on("data", (chunk) => {
    bytes += chunk.length;
    sendChunk(requestId, chunk);

    // WS 버퍼가 차오르면 로컬에서 읽기를 멈춘다
    if (ws.bufferedAmount > WS_HIGH_WATER && !flow.has("ws")) {
      flow.pause("ws");
      waitForWsDrain(flow);
    }
  });

  stream.on("end", () => {
    sendJson({ type: "response_end", requestId: requestId });
    inflight.delete(requestId);
    console.log(`📤 응답 전송 (${bytes}B): ${response.status} ${method} ${url}`);
  });

  stream.on("error", (error) => {
    inflight.delete(requestId);

    if (entry?.aborted || isCanceled(error)) {
      // 정상적인 탭 닫기/이탈. 서버는 이미 요청을 정리했으므로 응답을 보내지 않는다.
      console.log(`🚫 요청 중단됨: ${method} ${url}`);
      return;
    }

    console.error(`❌ 응답 스트림 오류: ${method} ${url}`, error.message);
    sendJson({
      type: "response_error",
      requestId: requestId,
      statusCode: 502,
      message: `Bad Gateway: ${error.message}`,
    });
  });
}

// 파일 확장자와 빌드 도구 쿼리를 보고 Content-Type을 보정한다.
// (로컬 dev 서버가 잘못된 타입을 주는 경우가 잦다)
function correctContentType(url, contentType) {
  const [urlPath, queryString] = url.split("?");

  // Vite/Webpack 특수 쿼리 파라미터 체크 (?import, ?url, ?raw, ?react 등)
  // 이런 경우 빌드 도구가 파일을 변환하므로 JavaScript로 처리
  const hasSpecialQuery =
    queryString &&
    (queryString.includes("import") ||
      queryString.includes("url") ||
      queryString.includes("raw") ||
      queryString.includes("inline") ||
      queryString.includes("worker") ||
      queryString.includes("react")); // SVG를 React 컴포넌트로 변환

  if (hasSpecialQuery) {
    return "application/javascript";
  }

  // 로컬 서버(Vite)가 이미 JavaScript를 반환한 경우 그대로 사용
  if (
    contentType &&
    (contentType.includes("application/javascript") ||
      contentType.includes("text/javascript") ||
      contentType.includes("application/typescript") ||
      contentType.includes("text/typescript"))
  ) {
    return contentType;
  }

  // SVG, 이미지, 폰트는 항상 강제 수정
  if (urlPath.endsWith(".svg")) return "image/svg+xml";
  if (urlPath.endsWith(".png")) return "image/png";
  if (urlPath.endsWith(".jpg") || urlPath.endsWith(".jpeg"))
    return "image/jpeg";
  if (urlPath.endsWith(".gif")) return "image/gif";
  if (urlPath.endsWith(".webp")) return "image/webp";
  if (urlPath.endsWith(".ico")) return "image/x-icon";
  if (urlPath.endsWith(".woff") || urlPath.endsWith(".woff2"))
    return "font/woff2";
  if (urlPath.endsWith(".ttf")) return "font/ttf";

  // JavaScript/CSS/JSON은 Content-Type이 비어있거나 잘못된 경우에만 수정
  if (
    !contentType ||
    contentType === "application/octet-stream" ||
    contentType === "text/html"
  ) {
    if (urlPath.endsWith(".js") || urlPath.endsWith(".mjs"))
      return "application/javascript";
    if (urlPath.endsWith(".jsx")) return "text/javascript";
    if (urlPath.endsWith(".ts")) return "application/typescript";
    if (urlPath.endsWith(".tsx")) return "text/typescript";
    if (urlPath.endsWith(".css")) return "text/css";
    if (urlPath.endsWith(".json")) return "application/json";
  }

  return contentType;
}

function injectConsoleCapture(html) {
  // </head> 태그 직전에 스크립트 추가 (타임스탬프로 캐싱 방지)
  const timestamp = Date.now();
  const script = `
<!-- Tunnel Script v${timestamp} -->
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
<script data-tunnel-script="${timestamp}">
  // 원격 콘솔 캡처 (쿠키에서 터널 ID 가져오기) - v${timestamp}
  (function() {
    // 쿠키에서 터널 ID 읽기 함수
    function getCookie(name) {
      var value = '; ' + document.cookie;
      var parts = value.split('; ' + name + '=');
      if (parts.length === 2) return parts.pop().split(';').shift();
      return '';
    }

    // 터널 ID 감지 (쿠키에서만)
    var detectedTunnelId = getCookie('tunnelId');

    // 원격 콘솔 캡처
    if (detectedTunnelId) {
      var originalLog = console.log;
      var originalWarn = console.warn;
      var originalError = console.error;
      var originalInfo = console.info;

      function sendLog(level, args) {
        var message = Array.from(args).map(function(arg) {
          if (typeof arg === 'object') {
            try { return JSON.stringify(arg); }
            catch { return String(arg); }
          }
          return String(arg);
        }).join(' ');

        fetch('${tunnelServerHttpUrl}/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tunnelId: detectedTunnelId,
            level: level,
            message: message
          })
        }).catch(function() {});
      }

      console.log = function() {
        originalLog.apply(console, arguments);
        sendLog('log', arguments);
      };
      console.warn = function() {
        originalWarn.apply(console, arguments);
        sendLog('warn', arguments);
      };
      console.error = function() {
        originalError.apply(console, arguments);
        sendLog('error', arguments);
      };
      console.info = function() {
        originalInfo.apply(console, arguments);
        sendLog('info', arguments);
      };

      console.log('[Tunnel] 원격 콘솔 활성화됨 - ID:', detectedTunnelId);

      console.log('[Tunnel] PAGE_LOADED');
    } else {
      console.log('[Tunnel] 터널 ID 없음 - 원격 콘솔 비활성화');
    }
  })();
</script>`;

  return html.replace("</head>", script + "</head>");
}

ws.on("close", (code, reason) => {
  if (code === 4001) {
    console.error(`❌ 프로토콜 불일치로 서버가 연결을 거부했습니다: ${reason}`);
    console.error("   VSIX를 다시 설치하거나 터널 서버를 배포하세요.");
    process.exit(1);
  }
  console.log("❌ 터널 서버 연결 종료");
  process.exit(0);
});

ws.on("error", (error) => {
  console.error("❌ WebSocket 오류:", error.message);
  if (error.code === "ECONNREFUSED") {
    console.error("\n⚠️  터널 서버가 실행되고 있지 않습니다!");
    console.error(
      "먼저 server 디렉토리에서 'npm start'로 서버를 실행하세요.\n",
    );
  }
  process.exit(1);
});

// Ctrl+C 처리
process.on("SIGINT", () => {
  console.log("\n\n👋 터널 클라이언트 종료 중...");
  ws.close();
  process.exit(0);
});

console.log("\n대기 중... (종료하려면 Ctrl+C)\n");
