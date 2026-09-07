// WebSocket 릴레이 검증 (프로토콜 v3)
// 사용법: node ws.js <tunnelId> [port]
const WebSocket = require("../client/node_modules/ws");
const crypto = require("crypto");
const http = require("http");

const tunnelId = process.argv[2];
const PORT = process.argv[3] || process.env.TARGET_PORT || "8099";
// 원격(Render) 검증에서는 호스트/스킴을 바꿔 같은 검증을 그대로 돌린다
const HOST = process.env.TARGET_HOST || "localhost";
const SECURE = process.env.TARGET_PROTO === "https";
const WS_SCHEME = SECURE ? "wss" : "ws";
const httpMod = SECURE ? require("https") : http;

if (!tunnelId) {
  console.error("tunnelId 인자가 필요합니다");
  process.exit(2);
}

let failed = 0;
function assert(name, pass, detail) {
  if (!pass) {
    failed++;
  }
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`,
  );
}

function get(path, headers = {}, override) {
  const target = override || { host: HOST, port: PORT, mod: httpMod };
  return new Promise((resolve) => {
    const req = target.mod.request(
      { host: target.host, port: target.port, path, headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString(),
          }),
        );
      },
    );
    req.on("error", () => resolve({ status: 0, body: "" }));
    req.end();
  });
}

// 메시지를 놓치지 않도록 생성 직후부터 모아둔다 (welcome이 곧바로 온다)
function connect(pathname, { cookie, protocols, headers } = {}) {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(
      `${WS_SCHEME}://${HOST}:${PORT}${pathname}`,
      protocols,
      { headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers } },
    );

    const queue = [];
    const waiters = [];
    client.on("message", (payload, isBinary) => {
      const item = { payload, isBinary };
      const waiter = waiters.shift();
      if (waiter) {
        waiter(item);
      } else {
        queue.push(item);
      }
    });
    client.next = (ms = 5000) =>
      new Promise((res, rej) => {
        if (queue.length) {
          return res(queue.shift());
        }
        const timer = setTimeout(() => rej(new Error("메시지 타임아웃")), ms);
        waiters.push((item) => {
          clearTimeout(timer);
          res(item);
        });
      });
    client.closedWith = new Promise((res) => {
      client.once("close", (code, reason) =>
        res({ code, reason: reason?.toString() || "" }),
      );
    });

    client.once("open", () => resolve(client));
    client.once("unexpected-response", (_req, res) => {
      res.resume();
      reject(
        Object.assign(new Error(`HTTP ${res.statusCode}`), {
          statusCode: res.statusCode,
        }),
      );
    });
    client.once("error", (err) => reject(err));
  });
}

// 관측 엔드포인트는 터널을 거치지 않고 가짜 앱에서 직접 읽는다
const appGet = (path) =>
  get(path, {}, { host: "localhost", port: "4321", mod: http });

const cookie = `tunnelId=${tunnelId}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 조건이 만족될 때까지 폴링한다. 원격은 왕복 지연이 있어 고정 대기로는 부족하다.
async function until(fn, ms = 10000) {
  const t0 = Date.now();
  for (;;) {
    const value = await fn();
    if (value !== null && value !== undefined && value !== false) {
      return value;
    }
    if (Date.now() - t0 > ms) {
      return null;
    }
    await sleep(200);
  }
}

async function tunnelCount() {
  const page = await get("/");
  const m = page.body.match(/활성 터널: (\d+)개/);
  return m ? Number(m[1]) : null;
}

(async () => {
  // 원격에는 다른 터널이 함께 살아 있을 수 있으므로 절대값이 아니라 증가분을 본다
  const countBefore = await tunnelCount();

  // A. 쿠키로 터널을 찾아 릴레이되는지 + 로컬이 먼저 보낸 메시지가 유실되지 않는지
  const a = await connect("/echo", { cookie });
  const welcome = await a.next();
  assert(
    "쿠키 기반 릴레이 + 로컬 선발신 메시지 도달",
    welcome.payload.toString() === "welcome",
    welcome.payload.toString(),
  );

  a.send("hi");
  const echoed = await a.next();
  assert("텍스트 에코 왕복", echoed.payload.toString() === "echo:hi", echoed.payload.toString());
  assert("텍스트 프레임 종류 유지", echoed.isBinary === false);

  // B. 바이너리 무손상 (1MB)
  const blob = crypto.randomBytes(1024 * 1024);
  a.send(blob, { binary: true });
  const back = await a.next(10000);
  const sameBytes =
    back.isBinary === true &&
    crypto.createHash("sha256").update(back.payload).digest("hex") ===
      crypto.createHash("sha256").update(blob).digest("hex");
  assert("바이너리 1MB 에코 무손상", sameBytes, `${back.payload.length}B`);

  // C. 경로 기반 터널 지정 (/<id>/echo) + 서브프로토콜 협상 + 커스텀 헤더
  const b = await connect(`/${tunnelId}/echo`, {
    protocols: ["vite-hmr"],
    headers: { "x-probe": "abc123" },
  });
  await b.next(); // welcome
  assert(
    "경로 기반 터널 지정 (/<id>/echo)",
    b.readyState === WebSocket.OPEN,
  );
  assert(
    "서브프로토콜 협상 전달 (vite-hmr)",
    b.protocol === "vite-hmr",
    `protocol=${b.protocol || "(없음)"}`,
  );

  const stat2 = JSON.parse((await appGet("/wsstat")).body);
  assert(
    "커스텀 헤더가 로컬 서버까지 전달",
    stat2.lastHeaders["x-probe"] === "abc123",
    stat2.lastHeaders["x-probe"],
  );
  assert(
    "터널 ID 접두사가 로컬 경로에서 제거됨",
    stat2.lastUrl === "/echo",
    stat2.lastUrl,
  );

  // E. 브라우저 WS가 터널을 새로 발급하지 않는지 (예전 버그 회귀 방지)
  const countAfter = await tunnelCount();
  // 원격에는 남의 터널이 만료되며 줄어들 수 있다. 늘어나지 않는 것만 본다.
  assert(
    "브라우저 WS가 새 터널을 발급하지 않음",
    countBefore !== null && countAfter <= countBefore,
    `${countBefore}개 → ${countAfter}개 (WS 2개 연결 후)`,
  );

  // F. 브라우저가 끊으면 로컬 WS도 닫히는지
  const closedBefore = stat2.closed;
  b.close(4000, "browser initiated");
  await b.closedWith;
  const stat3 = await until(async () => {
    const s = JSON.parse((await appGet("/wsstat")).body);
    return s.closed > closedBefore ? s : null;
  });
  assert(
    "브라우저 종료 → 로컬 WS 종료 전파",
    stat3 !== null,
    stat3 ? `closed=${stat3.closed}` : "전파 안 됨",
  );
  // Render의 WS 프록시는 close 코드를 전달하지 않는다(연결 종료 자체는 전파된다).
  // 우리 코드 경로의 문제가 아니므로 로컬에서만 코드 일치를 판정한다.
  if (SECURE) {
    console.log(
      `INFO  종료 코드 보존 = ${stat3?.lastCloseCode} (4000 기대) — 원격 프록시가 코드를 유실시킴, 판정 제외`,
    );
  } else {
    assert(
      "브라우저 종료 코드 보존 (4000)",
      stat3?.lastCloseCode === 4000,
      `code=${stat3?.lastCloseCode}`,
    );
  }

  // G. 로컬이 끊으면 브라우저에 코드가 전달되는지
  assert(
    "장시간 유지된 릴레이가 살아 있음 (G 전제)",
    a.readyState === WebSocket.OPEN,
    `readyState=${a.readyState}`,
  );
  a.send("__close__");
  const aClosed = await a.closedWith;
  assert(
    "로컬 종료 → 브라우저 연결 종료 전파",
    typeof aClosed.code === "number",
    `code=${aClosed.code}`,
  );
  if (SECURE) {
    console.log(
      `INFO  종료 코드 보존 = ${aClosed.code} (4321 기대) — 원격 프록시가 코드를 유실시킴, 판정 제외`,
    );
  } else {
    assert(
      "로컬 종료 코드 보존 (4321)",
      aClosed.code === 4321,
      `code=${aClosed.code}, reason=${aClosed.reason}`,
    );
  }

  // H. 로컬에 없는 경로는 502로 끊기는지 (101 먼저 주고 침묵하면 안 된다)
  let hStatus = null;
  try {
    const c = await connect("/nope", { cookie });
    c.close();
  } catch (error) {
    hStatus = error.statusCode || error.message;
  }
  assert("로컬이 거절한 WS → 502", hStatus === 502, `결과=${hStatus}`);

  // I. 없는 터널 ID → 503
  let iStatus = null;
  try {
    const c = await connect("/echo", { cookie: "tunnelId=deadbeef" });
    c.close();
  } catch (error) {
    iStatus = error.statusCode || error.message;
  }
  assert("없는 터널로의 WS → 503", iStatus === 503, `결과=${iStatus}`);

  console.log(`\nWS 릴레이: ${failed === 0 ? "전부 통과" : failed + "개 실패"}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("WS 테스트 실패:", e.message);
  process.exit(2);
});
