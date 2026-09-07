// 앱 → 터널 서버 → 터널 클라이언트를 띄우고 검증까지 한 번에 수행
const { spawn } = require("child_process");
const path = require("path");

// custom-tunnel 루트 (이 파일은 custom-tunnel/test/ 안에 있다)
const DIR = path.resolve(__dirname, "..");

const procs = [];
function run(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
  p.buf = "";
  p.stdout.on("data", (d) => (p.buf += d.toString()));
  p.stderr.on("data", (d) => (p.buf += d.toString()));
  procs.push(p);
  return p;
}

function waitFor(p, re, label, ms = 20000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const m = p.buf.match(re);
      if (m) return resolve(m);
      if (Date.now() - started > ms) {
        return reject(
          new Error(`${label} 대기 실패 (${ms}ms). 출력:\n${p.buf.slice(-2000)}`),
        );
      }
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
  const app = run("node", [path.join(__dirname, "app.js")]);
  const m1 = await waitFor(app, /APP_READY img_sha256=([a-f0-9]+)/, "앱 시작");
  const imgSha = m1[1];
  console.log("앱 준비됨, img sha =", imgSha.slice(0, 12));

  const server = run("node", [path.join(DIR, "server/index.js")], {
    env: { ...process.env, PORT: "8099" },
  });
  await waitFor(server, /WebSocket 서버 준비 완료/, "터널 서버 시작");
  console.log("터널 서버 준비됨 (8099)");

  const client = run("node", [
    path.join(DIR, "client/index.js"),
    "4321",
    "ws://localhost:8099",
  ]);
  const m2 = await waitFor(client, /터널 ID: ([a-f0-9]{8})/, "터널 ID 발급");
  const tunnelId = m2[1];
  console.log("터널 ID =", tunnelId);
  console.log("=".repeat(50));

  const check = spawn(
    "node",
    [path.join(__dirname, "check.js"), tunnelId, imgSha],
    { stdio: "inherit" },
  );

  const code = await new Promise((resolve) => check.on("exit", resolve));

  console.log("=".repeat(50));
  const wsCheck = spawn("node", [path.join(__dirname, "ws.js"), tunnelId, "8099"], {
    stdio: "inherit",
  });
  const wsCode = await new Promise((resolve) => wsCheck.on("exit", resolve));

  console.log("=".repeat(50));
  const injCheck = spawn(
    "node",
    [path.join(__dirname, "inject.js"), tunnelId, "8099"],
    { stdio: "inherit" },
  );
  const injCode = await new Promise((resolve) => injCheck.on("exit", resolve));

  let extraFailed = 0;
  const assert = (name, pass, detail) => {
    if (!pass) extraFailed++;
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  };

  // G 검증: 브라우저가 끊으면 서버가 abort를 보내고 클라이언트가 로컬 스트림을 버리는지
  assert(
    "끊김 전파: 서버 → 클라이언트 abort",
    /🔌 클라이언트 연결 끊김/.test(server.buf),
  );
  assert("끊김 처리: 클라이언트가 요청 중단", /🚫 요청 중단됨/.test(client.buf));

  // H 검증: 터널이 죽으면 릴레이 중인 브라우저 WS도 끊기고, 대기 없이 즉시 503
  const WebSocketClient = require(path.join(DIR, "client/node_modules/ws"));
  const orphan = new WebSocketClient(`ws://localhost:8099/${tunnelId}/echo`);
  const orphanClosed = new Promise((resolve) => {
    orphan.once("close", (c) => resolve(c));
    orphan.once("error", () => resolve(-1));
  });
  await new Promise((resolve, reject) => {
    orphan.once("open", resolve);
    orphan.once("error", reject);
  });

  client.kill("SIGKILL");
  await waitFor(server, /터널 종료/, "터널 종료 감지", 10000);

  const orphanCode = await Promise.race([
    orphanClosed,
    new Promise((r) => setTimeout(() => r("타임아웃"), 5000)),
  ]);
  assert(
    "터널 사망 시 릴레이 중인 브라우저 WS도 종료",
    orphanCode === 1001,
    `code=${orphanCode}`,
  );

  const started = Date.now();
  const status = await new Promise((resolve) => {
    const r = require("http").request(
      {
        host: "localhost",
        port: 8099,
        path: "/",
        headers: { Cookie: `tunnelId=${tunnelId}` },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    r.on("error", () => resolve(0));
    r.end();
  });
  const elapsed = Date.now() - started;
  assert(
    "터널 사망 시 즉시 503 (30초 대기 없음)",
    status === 503 && elapsed < 3000,
    `status=${status}, ${elapsed}ms`,
  );

  console.log("=".repeat(50));
  console.log("--- 서버 로그 (마지막 12줄) ---");
  console.log(server.buf.trim().split("\n").slice(-12).join("\n"));
  console.log("--- 클라이언트 로그 (마지막 8줄) ---");
  console.log(client.buf.trim().split("\n").slice(-8).join("\n"));
  cleanup();
  process.exit(code || wsCode || injCode || extraFailed ? 1 : 0);
})().catch((e) => {
  console.error("오케스트레이션 실패:", e.message);
  cleanup();
  process.exit(2);
});
