const WebSocket = require("ws");
const axios = require("axios");
const https = require("https");
const http = require("http");

// 명령줄 인자에서 로컬 포트 가져오기
const localPort = process.argv[2] || 3000;
const tunnelServerUrl = process.argv[3] || "ws://localhost:8080";
const useHttps = process.argv[4] === "https" || process.argv[4] === "true";

console.log(`🔌 터널 클라이언트 시작...`);
console.log(
  `📍 로컬 서버: ${useHttps ? "https" : "http"}://localhost:${localPort}`,
);
console.log(`🌐 터널 서버: ${tunnelServerUrl}`);

// 터널 서버에 연결
const ws = new WebSocket(tunnelServerUrl);

// 터널 ID 저장 변수
let tunnelId = null;
let firstAccessLogged = false; // 첫 접속 플래그

ws.on("open", () => {
  console.log("✅ 터널 서버 연결 성공!");
});

ws.on("message", async (message) => {
  try {
    const data = JSON.parse(message);

    if (data.type === "connected") {
      tunnelId = data.tunnelId; // 터널 ID 저장
      console.log("\n🎉 터널 생성 완료!");
      console.log(`📎 터널 URL: ${data.url}`);
      console.log(`🔑 터널 ID: ${data.tunnelId}`);
      console.log("\n이제 터널 URL로 접속하면 로컬 서버로 연결됩니다!\n");
    } else if (data.type === "log") {
      // 원격 콘솔 로그 수신
      const { level, message, timestamp } = data;
      console.log(
        `🔍 [REMOTE_LOG] ${JSON.stringify({ level, message, timestamp })}`,
      );
    } else if (data.type === "request") {
      const { requestId, method, url, headers, body } = data;

      console.log(`📥 요청 받음: ${method} ${url}`);

      // 첫 번째 접속 감지 (한 번만 로그)
      if (!firstAccessLogged) {
        firstAccessLogged = true;
        console.log("🌐 [FIRST_ACCESS]");
      }

      try {
        // 불필요한 헤더 제거 (프록시 문제 방지)
        const cleanHeaders = { ...headers };
        delete cleanHeaders["host"];
        delete cleanHeaders["connection"];
        delete cleanHeaders["content-length"];
        delete cleanHeaders["transfer-encoding"];
        delete cleanHeaders["accept-encoding"]; // gzip 문제 방지

        // 로컬 서버로 요청 전달
        const protocol = useHttps ? "https" : "http";
        const agent = useHttps
          ? new https.Agent({
              rejectUnauthorized: false, // 자체 서명 인증서 허용
              keepAlive: false,
              timeout: 25000,
              scheduling: "lifo",
            })
          : new http.Agent({
              keepAlive: false,
              timeout: 25000,
              scheduling: "lifo",
            });

        const response = await axios({
          method: method,
          url: `${protocol}://localhost:${localPort}${url}`,
          headers: cleanHeaders,
          data: body || undefined,
          validateStatus: () => true, // 모든 상태 코드 허용
          maxRedirects: 0,
          responseType: "arraybuffer", // 바이너리로 받아서 처리 (더 안정적)
          timeout: 25000, // 25초 타임아웃 (서버의 30초보다 짧게)
          decompress: true, // 자동 압축 해제 활성화 (gzip 처리)
          socketPath: undefined,
          httpAgent: !useHttps ? agent : undefined,
          httpsAgent: useHttps ? agent : undefined,
          // 소켓 타임아웃 설정
          onDownloadProgress: undefined,
          transitional: {
            silentJSONParsing: true,
            forcedJSONParsing: false,
            clarifyTimeoutError: true,
          },
        });

        // Content-Type에 따라 응답 데이터 처리
        const contentType = response.headers["content-type"] || "";
        const isBinary =
          contentType.includes("image/") ||
          contentType.includes("video/") ||
          contentType.includes("audio/") ||
          contentType.includes("application/pdf") ||
          contentType.includes("application/zip") ||
          contentType.includes("application/octet-stream") ||
          contentType.includes("font/");

        let responseBody;
        let isBase64 = false;

        if (isBinary) {
          // 바이너리 데이터는 Base64로 인코딩
          if (Buffer.isBuffer(response.data)) {
            responseBody = response.data.toString("base64");
            isBase64 = true;
          } else if (response.data instanceof ArrayBuffer) {
            responseBody = Buffer.from(response.data).toString("base64");
            isBase64 = true;
          } else {
            responseBody = "";
          }
        } else {
          // 텍스트 데이터는 UTF-8 문자열로
          if (Buffer.isBuffer(response.data)) {
            responseBody = response.data.toString("utf8");
          } else if (response.data instanceof ArrayBuffer) {
            responseBody = Buffer.from(response.data).toString("utf8");
          } else if (typeof response.data === "string") {
            responseBody = response.data;
          } else if (response.data === null || response.data === undefined) {
            responseBody = "";
          } else {
            // 객체는 JSON으로
            responseBody = JSON.stringify(response.data);
          }
        }

        // 응답 헤더 정리 (프록시 문제 방지)
        const cleanResponseHeaders = { ...response.headers };
        delete cleanResponseHeaders["transfer-encoding"];
        delete cleanResponseHeaders["connection"];
        delete cleanResponseHeaders["content-encoding"]; // gzip 디코딩 오류 방지
        delete cleanResponseHeaders["content-length"]; // 길이가 변경될 수 있음

        // HTTPS 관련 헤더 제거 (HTTP 터널로 전달 시 SSL 오류 방지)
        delete cleanResponseHeaders["strict-transport-security"];
        delete cleanResponseHeaders["content-security-policy"];
        delete cleanResponseHeaders["x-frame-options"];
        delete cleanResponseHeaders["upgrade"];
        delete cleanResponseHeaders["alt-svc"];

        // Location 헤더의 HTTPS를 HTTP로 변경 (리다이렉트 처리)
        if (cleanResponseHeaders["location"]) {
          const localhostPattern = new RegExp(
            `https://localhost:${localPort}`,
            "gi",
          );
          cleanResponseHeaders["location"] = cleanResponseHeaders["location"]
            .replace(localhostPattern, `http://localhost:8080`)
            .replace(/^https:\/\/localhost/i, "http://localhost");
        }

        // 응답 본문에서 localhost HTTPS URL만 HTTP로 변경 (외부 리소스는 유지)
        // 주의: import 경로나 상대 경로는 변경하지 않음
        const localhostPattern = new RegExp(
          `https://localhost:${localPort}`,
          "gi",
        );
        // HTML에서만 URL 변환 (JS 모듈이나 JSON은 그대로)
        if (cleanResponseHeaders["content-type"]?.includes("text/html")) {
          responseBody = responseBody.replace(
            localhostPattern,
            "http://localhost:8080",
          );
        }

        // HTML 응답의 경우 원격 콘솔 캡처 스크립트만 추가 (URL 조작 제거)
        if (
          response.status === 200 &&
          cleanResponseHeaders["content-type"]?.includes("text/html")
        ) {
          // 터널 ID 가져오기
          const tunnelIdFromClient = tunnelId || "unknown";

          // </head> 태그 직전에 스크립트 추가
          const script = `
<script>
  // 원격 콘솔 캡처 (쿠키에서 터널 ID 가져오기)
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
        
        fetch('https://debug-tool.onrender.com/log', {
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
    } else {
      console.log('[Tunnel] 터널 ID 없음 - 원격 콘솔 비활성화');
    }
  })();
</script>`;
          responseBody = responseBody.replace("</head>", script + "</head>");
        }

        // 터널 서버로 응답 전송
        ws.send(
          JSON.stringify({
            type: "response",
            requestId: requestId,
            statusCode: response.status,
            headers: cleanResponseHeaders,
            body: responseBody,
            isBase64: isBase64, // Base64 인코딩 여부 플래그
          }),
        );

        console.log(
          `📤 응답 전송: ${response.status} ${method} ${url}${
            isBase64 ? " (Base64)" : ""
          }`,
        );
      } catch (error) {
        console.error(`❌ 로컬 서버 요청 실패:`, error.message);

        // 에러 응답 전송
        ws.send(
          JSON.stringify({
            type: "response",
            requestId: requestId,
            statusCode: 502,
            headers: { "content-type": "text/plain" },
            body: `Bad Gateway: ${error.message}`,
          }),
        );
      }
    }
  } catch (error) {
    console.error("❌ 메시지 처리 오류:", error);
  }
});

ws.on("close", () => {
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
