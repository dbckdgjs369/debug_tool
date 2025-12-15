const express = require("express");
const { exec, spawn } = require("child_process");
const path = require("path");
const QRCode = require("qrcode");
const WebSocket = require("ws");

const app = express();
const PORT = 3030;

app.use(express.json());
app.use(express.static("public"));

// 활성 터널 저장
const activeTunnels = new Map();
let flyServerStatus = "unknown";

// WebSocket 서버
const wss = new WebSocket.Server({ noServer: true });

// WebSocket 브로드캐스트
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Fly.io 서버 상태 확인
async function checkFlyStatus() {
  return new Promise((resolve) => {
    exec("cd ../server && flyctl status --json", (error, stdout) => {
      if (error) {
        resolve("stopped");
        return;
      }
      try {
        const status = JSON.parse(stdout);
        const machines = status.Machines || [];
        const runningMachines = machines.filter(
          (m) => m.state === "started" || m.state === "running"
        );
        resolve(runningMachines.length > 0 ? "running" : "stopped");
      } catch (e) {
        resolve("unknown");
      }
    });
  });
}

// Fly.io 서버 시작
function startFlyServer() {
  return new Promise((resolve, reject) => {
    exec(
      "cd ../server && flyctl machine start 286e236c03d7d8",
      (error, stdout, stderr) => {
        if (error) {
          reject(error.message);
          return;
        }
        resolve("Server started successfully");
      }
    );
  });
}

// Fly.io 서버 중지
function stopFlyServer() {
  return new Promise((resolve, reject) => {
    exec(
      "cd ../server && flyctl machine stop 286e236c03d7d8",
      (error, stdout, stderr) => {
        if (error) {
          reject(error.message);
          return;
        }
        resolve("Server stopped successfully");
      }
    );
  });
}

// 터널 시작
function startTunnel(port) {
  return new Promise((resolve, reject) => {
    const tunnelProcess = spawn(
      "node",
      ["../client/index.js", port, "wss://custom-tunnel.fly.dev"],
      {
        cwd: path.join(__dirname),
      }
    );

    let tunnelUrl = "";
    let tunnelId = "";

    tunnelProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`Tunnel output: ${output}`);

      // URL 추출
      const urlMatch = output.match(
        /https:\/\/custom-tunnel\.fly\.dev\/([a-f0-9]{8})/
      );
      if (urlMatch) {
        tunnelUrl = urlMatch[0];
        tunnelId = urlMatch[1];

        activeTunnels.set(tunnelId, {
          id: tunnelId,
          port: port,
          url: tunnelUrl,
          process: tunnelProcess,
          startTime: new Date(),
        });

        broadcast({
          type: "tunnelStarted",
          tunnel: {
            id: tunnelId,
            port: port,
            url: tunnelUrl,
          },
        });

        resolve({ tunnelId, url: tunnelUrl });
      }
    });

    tunnelProcess.stderr.on("data", (data) => {
      console.error(`Tunnel error: ${data}`);
    });

    tunnelProcess.on("close", (code) => {
      console.log(`Tunnel process exited with code ${code}`);
      if (tunnelId) {
        activeTunnels.delete(tunnelId);
        broadcast({
          type: "tunnelStopped",
          tunnelId: tunnelId,
        });
      }
    });

    // 10초 후에도 URL이 없으면 실패
    setTimeout(() => {
      if (!tunnelUrl) {
        tunnelProcess.kill();
        reject("Tunnel failed to start");
      }
    }, 10000);
  });
}

// 터널 중지
function stopTunnel(tunnelId) {
  const tunnel = activeTunnels.get(tunnelId);
  if (tunnel && tunnel.process) {
    tunnel.process.kill();
    activeTunnels.delete(tunnelId);
    broadcast({
      type: "tunnelStopped",
      tunnelId: tunnelId,
    });
    return true;
  }
  return false;
}

// API 엔드포인트

// 서버 상태 확인
app.get("/api/status", async (req, res) => {
  flyServerStatus = await checkFlyStatus();
  res.json({
    flyServer: flyServerStatus,
    tunnels: Array.from(activeTunnels.values()).map((t) => ({
      id: t.id,
      port: t.port,
      url: t.url,
      startTime: t.startTime,
    })),
  });
});

// Fly 서버 시작
app.post("/api/fly/start", async (req, res) => {
  try {
    const message = await startFlyServer();
    flyServerStatus = "running";
    broadcast({ type: "flyServerStarted" });
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
});

// Fly 서버 중지
app.post("/api/fly/stop", async (req, res) => {
  try {
    const message = await stopFlyServer();
    flyServerStatus = "stopped";
    broadcast({ type: "flyServerStopped" });
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
});

// 터널 시작
app.post("/api/tunnel/start", async (req, res) => {
  const { port } = req.body;

  if (!port) {
    return res.status(400).json({ success: false, error: "Port is required" });
  }

  try {
    const result = await startTunnel(port);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
});

// 터널 중지
app.post("/api/tunnel/stop/:tunnelId", (req, res) => {
  const { tunnelId } = req.params;
  const success = stopTunnel(tunnelId);

  if (success) {
    res.json({ success: true, message: "Tunnel stopped" });
  } else {
    res.status(404).json({ success: false, error: "Tunnel not found" });
  }
});

// QR 코드 생성
app.get("/api/qrcode/:url(*)", async (req, res) => {
  const url = req.params.url;
  try {
    const qr = await QRCode.toDataURL(url);
    res.json({ success: true, qrCode: qr });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// HTTP 서버
const server = app.listen(PORT, () => {
  console.log(`🎨 Dashboard running at http://localhost:${PORT}`);
});

// WebSocket 업그레이드
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// WebSocket 연결
wss.on("connection", (ws) => {
  console.log("🔌 Dashboard client connected");

  // 초기 상태 전송
  checkFlyStatus().then((status) => {
    flyServerStatus = status;
    ws.send(
      JSON.stringify({
        type: "initialState",
        flyServer: flyServerStatus,
        tunnels: Array.from(activeTunnels.values()).map((t) => ({
          id: t.id,
          port: t.port,
          url: t.url,
          startTime: t.startTime,
        })),
      })
    );
  });

  ws.on("close", () => {
    console.log("❌ Dashboard client disconnected");
  });
});

// 주기적으로 서버 상태 체크 (30초마다)
setInterval(async () => {
  const newStatus = await checkFlyStatus();
  if (newStatus !== flyServerStatus) {
    flyServerStatus = newStatus;
    broadcast({
      type: "flyServerStatusChanged",
      status: flyServerStatus,
    });
  }
}, 30000);
