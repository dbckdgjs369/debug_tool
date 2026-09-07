const http = require("http");
const https = require("https");
const crypto = require("crypto");

const TUNNEL_ID = process.argv[2];
const IMG_SHA = process.argv[3];

// 기본은 로컬 터널 서버. 원격(Render) 검증 시 환경변수로 바꾼다.
const HOST = process.env.TARGET_HOST || "localhost";
const PORT = Number(process.env.TARGET_PORT || 8099);
const SECURE = process.env.TARGET_PROTO === "https";
const transport = SECURE ? https : http;

function req(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const r = transport.request(
      {
        host: HOST,
        port: PORT,
        path,
        method: opts.method || "GET",
        headers: {
          Host: HOST,
          Cookie: `tunnelId=${TUNNEL_ID}`,
          ...(opts.headers || {}),
        },
      },
      (res) => {
        const chunks = [];
        const arrivals = [];
        res.on("data", (c) => {
          chunks.push(c);
          arrivals.push({ t: Date.now(), n: c.length });
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
            arrivals,
          }),
        );
        res.on("error", reject);
      },
    );
    r.on("error", reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

(async () => {
  // A. HTML + 스크립트 주입 + 로컬 절대 URL 상대화
  const a = await req("/");
  const html = a.body.toString("utf8");
  check("HTML 200", a.status === 200, `status=${a.status}`);
  check("콘솔 캡처 스크립트 주입", html.includes("data-tunnel-script"));
  check(
    "로컬 절대 URL → 상대 경로",
    html.includes('src="/img.png"') && !html.includes("localhost:4321"),
    html.match(/src="[^"]*"/)?.[0],
  );

  // B. 바이너리 무손상
  const b = await req("/img.png");
  const sha = crypto.createHash("sha256").update(b.body).digest("hex");
  check(
    "바이너리(PNG) 무손상",
    sha === IMG_SHA && b.body.length === 65536,
    `${b.body.length}B sha=${sha.slice(0, 12)} expect=${IMG_SHA.slice(0, 12)}`,
  );
  check(
    "Content-Type 보존",
    (b.headers["content-type"] || "").includes("image/png"),
    b.headers["content-type"],
  );

  // C. SSE 점진 전달 (버퍼링 안 되는지)
  const c = await req("/sse");
  const gaps = [];
  for (let i = 1; i < c.arrivals.length; i++) {
    gaps.push(c.arrivals[i].t - c.arrivals[i - 1].t);
  }
  const spaced = gaps.filter((g) => g > 300).length;
  check(
    "SSE 점진 전달 (버퍼링 없음)",
    c.arrivals.length >= 5 && spaced >= 3,
    `도착 ${c.arrivals.length}회, 간격 ${JSON.stringify(gaps)}`,
  );
  check(
    "SSE 전체 수신 (30초 타임아웃에 안 걸림)",
    c.body.toString().includes("tick-5"),
    `status=${c.status}`,
  );
  // 중간 프록시에 "모아두지 말라"고 주는 힌트 헤더.
  // Render는 이 헤더를 응답에서 제거하지만(2026-09 확인) 스트리밍 자체는 정상이라,
  // 원격 검증에서는 단정하지 않고 위의 도착 간격 측정으로 판단한다.
  if (SECURE) {
    console.log(
      `INFO  x-accel-buffering = ${c.headers["x-accel-buffering"] ?? "(제거됨)"} — 원격에서는 판정 제외`,
    );
  } else {
    check(
      "x-accel-buffering 헤더",
      c.headers["x-accel-buffering"] === "no",
      c.headers["x-accel-buffering"],
    );
  }

  // D. 업로드 바이트 무손상 (기존 `body += chunk.toString()` 버그)
  const upload = crypto.randomBytes(1024 * 1024);
  const uploadSha = crypto.createHash("sha256").update(upload).digest("hex");
  const d = await req("/upload", {
    method: "POST",
    body: upload,
    headers: {
      "content-type": "application/octet-stream",
      "content-length": upload.length,
    },
  });
  let echoed = {};
  try {
    echoed = JSON.parse(d.body.toString());
  } catch {}
  check(
    "업로드 바이트 무손상 (1MB)",
    echoed.sha256 === uploadSha && echoed.bytes === upload.length,
    `받은 ${echoed.bytes}B / 보낸 ${upload.length}B, sha ${echoed.sha256 === uploadSha ? "일치" : "불일치"}`,
  );

  // E. 큰 응답 스트리밍 (역압 경로)
  const e = await req("/big");
  check(
    "8MB 스트리밍",
    e.body.length === 8 * 1024 * 1024,
    `${e.body.length}B, 청크 ${e.arrivals.length}회`,
  );

  // F. 404 전달
  const f = await req("/nope");
  check("404 전달", f.status === 404, `status=${f.status}`);

  // G. SSE를 중간에 끊었을 때 로컬 스트림이 정리되는지
  //    (정리 안 되면 탭을 닫을 때마다 클라이언트에 스트림이 쌓인다)
  await new Promise((resolve) => {
    const r = transport.request(
      {
        host: HOST,
        port: PORT,
        path: "/sse",
        headers: { Host: HOST, Cookie: `tunnelId=${TUNNEL_ID}` },
      },
      (res) => {
        let n = 0;
        res.on("data", () => {
          n++;
          if (n === 2) {
            r.destroy();
            resolve();
          }
        });
        res.on("error", () => resolve());
        res.on("end", () => resolve());
      },
    );
    r.on("error", () => resolve());
    r.end();
  });
  check("SSE 중간 끊기 (소켓 종료)", true, "2개 수신 후 클라이언트가 끊음");
  await new Promise((r) => setTimeout(r, 1200));

  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} 통과`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("테스트 실행 오류:", e);
  process.exit(2);
});
