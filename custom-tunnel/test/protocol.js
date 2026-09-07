// 프로토콜 버전 불일치가 "조용한 멈춤"이 아니라 명확한 실패로 나오는지 검증한다.
// 서버(Render)와 클라이언트(VSIX)는 따로 배포되므로 롤아웃 중 반드시 불일치가 생긴다.
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const WebSocket = require(path.join(__dirname, "../client/node_modules/ws"));

const DIR = path.resolve(__dirname, "..");
const procs = [];
const results = [];

function check(name, pass, detail) {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

function run(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
  p.buf = "";
  p.stdout.on("data", (d) => (p.buf += d.toString()));
  p.stderr.on("data", (d) => (p.buf += d.toString()));
  procs.push(p);
  return p;
}

function waitFor(p, re, label, ms = 15000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const m = p.buf.match(re);
      if (m) return resolve(m);
      if (Date.now() - t0 > ms)
        return reject(new Error(`${label} 대기 실패:\n${p.buf.slice(-1500)}`));
      setTimeout(tick, 100);
    };
    tick();
  });
}

function cleanup() {
  for (const p of procs) {
    try {
      p.kill("SIGKILL");
    } catch {}
  }
}

(async () => {
  // ── 방향 1: 옛 클라이언트 + 새 서버 ────────────────────────────
  // hello를 보내지 않는 구버전 클라이언트를 흉내낸다.
  const server = run("node", [path.join(DIR, "server/index.js")], {
    env: { ...process.env, PORT: "8098" },
  });
  await waitFor(server, /WebSocket 서버 준비 완료/, "서버 시작");

  const closeInfo = await new Promise((resolve) => {
    const w = new WebSocket("ws://localhost:8098/");
    const timer = setTimeout(
      () => resolve({ code: null, reason: "타임아웃 (끊기지 않음)" }),
      9000,
    );
    // 일부러 hello를 보내지 않는다
    w.on("close", (code, reason) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
    w.on("error", () => {});
  });
  check(
    "옛 클라이언트 → 새 서버: 4001로 거부",
    closeInfo.code === 4001,
    `code=${closeInfo.code}, reason=${closeInfo.reason}`,
  );
  check(
    "거부 사유가 확장 콘솔로도 전달됨 (log 프레임)",
    /구버전 클라이언트/.test(server.buf),
  );

  // ── 방향 2: 새 클라이언트 + 옛 서버 ────────────────────────────
  // protocol 필드가 없는 connected 프레임을 보내는 구버전 서버를 흉내낸다.
  const legacy = http.createServer();
  const lwss = new WebSocket.Server({ server: legacy });
  lwss.on("connection", (ws) => {
    ws.send(
      JSON.stringify({
        type: "connected",
        tunnelId: "deadbeef",
        url: "http://localhost:8097/deadbeef",
      }),
    );
  });
  await new Promise((r) => legacy.listen(8097, r));

  const client = run("node", [
    path.join(DIR, "client/index.js"),
    "4321",
    "ws://localhost:8097",
  ]);
  const exitCode = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve("타임아웃"), 10000);
    client.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  check(
    "새 클라이언트 → 옛 서버: 즉시 실패 종료",
    exitCode === 1,
    `exit=${exitCode}`,
  );
  check(
    "실패 사유 출력",
    /프로토콜 불일치/.test(client.buf),
    client.buf.split("\n").find((l) => l.includes("프로토콜")) || "(없음)",
  );
  legacy.close();

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} 통과`);
  cleanup();
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("테스트 오류:", e.message);
  cleanup();
  process.exit(2);
});
