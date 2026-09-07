// 실제 Render 서버를 거쳐 검증한다.
// 로컬 테스트와 달리 "중간 프록시가 스트리밍을 버퍼링하는지"를 확인하는 것이 목적이다.
//
//   node custom-tunnel/test/run-remote.js
//   node custom-tunnel/test/run-remote.js wss://my-server.onrender.com
const { spawn } = require("child_process");
const path = require("path");

const DIR = path.resolve(__dirname, "..");
const WS_URL = process.argv[2] || "wss://debug-tool.onrender.com";
const HTTP_HOST = WS_URL.replace(/^wss?:\/\//, "").replace(/\/$/, "");

const procs = [];
function run(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
  p.buf = "";
  p.stdout.on("data", (d) => (p.buf += d.toString()));
  p.stderr.on("data", (d) => (p.buf += d.toString()));
  procs.push(p);
  return p;
}

function waitFor(p, re, label, ms = 90000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const m = p.buf.match(re);
      if (m) return resolve(m);
      if (Date.now() - t0 > ms)
        return reject(new Error(`${label} 대기 실패:\n${p.buf.slice(-1500)}`));
      setTimeout(tick, 200);
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
  console.log("로컬 앱 준비됨 (4321)");

  // Render 무료 티어는 콜드 스타트가 있어 첫 연결이 느릴 수 있다
  console.log(`터널 서버 연결 중: ${WS_URL} (콜드 스타트면 최대 90초)`);
  const client = run("node", [
    path.join(DIR, "client/index.js"),
    "4321",
    WS_URL,
  ]);
  const m2 = await waitFor(client, /터널 ID: ([a-f0-9]{8})/, "터널 ID 발급");
  const tunnelId = m2[1];
  console.log(`터널 ID = ${tunnelId}`);
  console.log(`검증 대상 = https://${HTTP_HOST}`);
  console.log("=".repeat(50));

  const check = spawn(
    "node",
    [path.join(__dirname, "check.js"), tunnelId, m1[1]],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        TARGET_HOST: HTTP_HOST,
        TARGET_PORT: "443",
        TARGET_PROTO: "https",
      },
    },
  );

  const code = await new Promise((resolve) => check.on("exit", resolve));

  console.log("=".repeat(50));
  const wsCheck = spawn("node", [path.join(__dirname, "ws.js"), tunnelId], {
    stdio: "inherit",
    env: {
      ...process.env,
      TARGET_HOST: HTTP_HOST,
      TARGET_PORT: "443",
      TARGET_PROTO: "https",
    },
  });
  const wsCode = await new Promise((resolve) => wsCheck.on("exit", resolve));

  console.log("=".repeat(50));
  const injCheck = spawn("node", [path.join(__dirname, "inject.js"), tunnelId], {
    stdio: "inherit",
    env: {
      ...process.env,
      TARGET_HOST: HTTP_HOST,
      TARGET_PORT: "443",
      TARGET_PROTO: "https",
    },
  });
  const injCode = await new Promise((resolve) => injCheck.on("exit", resolve));

  console.log("=".repeat(50));
  console.log("--- 클라이언트 로그 (마지막 15줄) ---");
  console.log(client.buf.trim().split("\n").slice(-15).join("\n"));
  cleanup();
  process.exit(code || wsCode || injCode || 0);
})().catch((e) => {
  console.error("오케스트레이션 실패:", e.message);
  cleanup();
  process.exit(2);
});
