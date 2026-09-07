// 주입 스크립트의 주소 교정 검증
// 사용법: node inject.js <tunnelId> [port]
//
// 터널을 거쳐 받은 HTML에서 주입된 스크립트를 그대로 꺼내, 브라우저를 흉내낸
// 샌드박스에서 실행한다. 개발 서버가 번들에 박아둔 로컬 절대 주소
// (webpack-dev-server의 port=3001 같은 것)가 페이지 출처로 교정되는지 본다.
const http = require("http");
const vm = require("vm");

const tunnelId = process.argv[2];
const PORT = process.argv[3] || process.env.TARGET_PORT || "8099";
const HOST = process.env.TARGET_HOST || "localhost";
const SECURE = process.env.TARGET_PROTO === "https";
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

function get(path, headers = {}) {
  return new Promise((resolve) => {
    const req = httpMod.request(
      { host: HOST, port: PORT, path, headers },
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

// 주입 스크립트를 가짜 브라우저에서 실행하고, 앱이 쓰는 API들을 되돌려준다.
function runInFakeBrowser(source, location) {
  const wsCalls = [];
  const esCalls = [];
  const fetchCalls = [];
  const xhrCalls = [];
  const logs = [];

  function FakeWS(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    wsCalls.push({ url, protocols });
  }
  FakeWS.CONNECTING = 0;
  FakeWS.OPEN = 1;
  FakeWS.CLOSING = 2;
  FakeWS.CLOSED = 3;

  function FakeES(url, config) {
    this.url = url;
    esCalls.push({ url, config });
  }
  FakeES.CONNECTING = 0;
  FakeES.OPEN = 1;
  FakeES.CLOSED = 2;

  function FakeXHR() {}
  FakeXHR.prototype.open = function (method, url) {
    xhrCalls.push({ method, url });
  };

  const ctx = {
    location,
    WebSocket: FakeWS,
    EventSource: FakeES,
    XMLHttpRequest: FakeXHR,
    URL,
    Request: class Request {
      constructor(url, init) {
        this.url = url;
        this.init = init;
      }
    },
    fetch: (input, init) => {
      fetchCalls.push({ input, init });
      return Promise.resolve();
    },
    document: { cookie: `tunnelId=${tunnelId}` },
    console: {
      log: (...a) => logs.push(a.join(" ")),
      warn: () => {},
      error: () => {},
      info: () => {},
    },
  };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;

  vm.createContext(ctx);
  vm.runInContext(source, ctx);

  return {
    ctx,
    logs,
    wsCalls,
    esCalls,
    fetchCalls,
    xhrCalls,
    native: { FakeWS, FakeES },
  };
}

const RENDER_LOC = {
  protocol: "https:",
  hostname: "debug-tool.onrender.com",
  host: "debug-tool.onrender.com",
  port: "",
  href: "https://debug-tool.onrender.com/",
  origin: "https://debug-tool.onrender.com",
};

const LOCAL_LOC = {
  protocol: "http:",
  hostname: "localhost",
  host: "localhost:8099",
  port: "8099",
  href: "http://localhost:8099/",
  origin: "http://localhost:8099",
};

(async () => {
  // `/<id>/`는 쿠키를 심고 302를 주므로, 쿠키를 들고 루트를 요청한다
  const page = await get("/", { Cookie: `tunnelId=${tunnelId}` });
  assert("터널로 HTML 수신", page.status === 200, `status=${page.status}`);

  const m = page.body.match(
    /<script data-tunnel-script="\d+">([\s\S]*?)<\/script>/,
  );
  assert("주입 스크립트 추출", !!m, m ? "" : "스크립트 태그를 찾지 못했다");
  if (!m) {
    process.exit(1);
  }
  const source = m[1];

  // ── Render처럼 페이지 포트가 비어 있는 경우 ─────────────────────────────
  {
    const b = runInFakeBrowser(source, RENDER_LOC);
    const WS = b.ctx.WebSocket;

    // CRA(webpack-dev-server)가 실제로 만드는 주소.
    // hostname은 페이지 호스트로 치환되지만 port=3001이 그대로 남는다.
    new WS("wss://debug-tool.onrender.com:3001/ws");
    assert(
      "CRA가 박은 포트 제거",
      b.wsCalls[0].url === "wss://debug-tool.onrender.com/ws",
      b.wsCalls[0].url,
    );

    new WS("ws://localhost:3001/ws?token=abc");
    assert(
      "localhost 절대 주소 → 페이지 출처 (쿼리 보존)",
      b.wsCalls[1].url === "wss://debug-tool.onrender.com/ws?token=abc",
      b.wsCalls[1].url,
    );

    new WS("ws://0.0.0.0:3001/ws");
    assert(
      "0.0.0.0 절대 주소 → 페이지 출처",
      b.wsCalls[2].url === "wss://debug-tool.onrender.com/ws",
      b.wsCalls[2].url,
    );

    new WS("wss://api.example.com/socket");
    assert(
      "외부 호스트는 건드리지 않음",
      b.wsCalls[3].url === "wss://api.example.com/socket",
      b.wsCalls[3].url,
    );

    const same = "wss://debug-tool.onrender.com/ws";
    new WS(same);
    assert(
      "같은 출처는 그대로 통과",
      b.wsCalls[4].url === same &&
        !b.logs.some((l) => l.includes(same + " →")),
      b.wsCalls[4].url,
    );

    const inst = new WS("wss://debug-tool.onrender.com:3001/ws", "vite-hmr");
    assert(
      "서브프로토콜 보존",
      b.wsCalls[5].protocols === "vite-hmr",
      String(b.wsCalls[5].protocols),
    );
    assert("instanceof 유지", inst instanceof WS, "");
    assert(
      "상수 유지",
      WS.CONNECTING === 0 && WS.OPEN === 1 && WS.CLOSED === 3,
      "",
    );

    b.ctx.fetch("http://localhost:3001/api/x");
    assert(
      "fetch 로컬 절대 주소 교정",
      b.fetchCalls[b.fetchCalls.length - 1].input ===
        "https://debug-tool.onrender.com/api/x",
      String(b.fetchCalls[b.fetchCalls.length - 1].input),
    );

    new b.ctx.EventSource("http://localhost:3001/sse");
    assert(
      "EventSource 교정",
      b.esCalls[0].url === "https://debug-tool.onrender.com/sse",
      b.esCalls[0].url,
    );

    const x = new b.ctx.XMLHttpRequest();
    x.open("GET", "http://127.0.0.1:3001/api/y");
    assert(
      "XHR 교정",
      b.xhrCalls[0].url === "https://debug-tool.onrender.com/api/y",
      b.xhrCalls[0].url,
    );

    // 원격 콘솔은 터널 서버로 절대 주소로 보낸다. 이게 교정 대상이 되면
    // 로그 → fetch → 로그로 무한히 돈다. 한 번 찍으면 한 번만 나가야 한다.
    const before = b.fetchCalls.length;
    b.ctx.console.log("hello");
    const sent = b.fetchCalls.slice(before);
    assert(
      "원격 콘솔 전송이 재귀하지 않음",
      sent.length === 1,
      `${sent.length}건`,
    );
    assert(
      "원격 콘솔이 터널 서버 /log로 감",
      sent.length === 1 && String(sent[0].input).endsWith("/log"),
      sent.length ? String(sent[0].input) : "",
    );
  }

  // ── 로컬 터널처럼 페이지에 포트가 있는 경우 ─────────────────────────────
  {
    const b = runInFakeBrowser(source, LOCAL_LOC);
    const WS = b.ctx.WebSocket;

    // 앱이 HTTPS(3001)여도 페이지가 http면 ws로 내려야 한다
    new WS("wss://localhost:3001/ws");
    assert(
      "페이지가 http면 ws로 내림 + 포트 교체",
      b.wsCalls[0].url === "ws://localhost:8099/ws",
      b.wsCalls[0].url,
    );

    new WS("ws://localhost:8099/ws");
    assert(
      "이미 같은 출처면 그대로",
      b.wsCalls[1].url === "ws://localhost:8099/ws",
      b.wsCalls[1].url,
    );

    new WS("/ws");
    assert(
      "상대 경로는 그대로 넘김",
      b.wsCalls[2].url === "/ws",
      String(b.wsCalls[2].url),
    );
  }

  console.log(failed === 0 ? "\n주입 스크립트 검증 통과" : `\n${failed}건 실패`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("검증 실패:", e);
  process.exit(2);
});
