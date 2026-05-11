import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import { EventEmitter } from "events";
import { TUNNEL_SERVER_URL, TUNNEL_ENV } from "./config";

export interface ConsoleLog {
  timestamp: Date;
  level: "log" | "warn" | "error" | "info";
  message: string;
  source?: string;
}

export interface Tunnel {
  id: string;
  port: number;
  url: string;
  startTime: Date;
  useHttps: boolean;
  process?: ChildProcess;
  logs: ConsoleLog[];
}

export class TunnelManager extends EventEmitter {
  private activeTunnels: Map<string, Tunnel> = new Map();
  private clientPath: string;
  private serverUrl: string;
  private maxLogsPerTunnel: number = 500; // 터널당 최대 로그 개수
  private pendingTunnelProcess: ChildProcess | null = null; // 생성 중인 터널 프로세스

  constructor() {
    super();
    // client/index.js 경로
    this.clientPath = path.join(__dirname, "../custom-tunnel/client/index.js");
    // 터널 서버 URL (환경에 따라 자동 설정)
    this.serverUrl = TUNNEL_SERVER_URL;
    console.log(`[Tunnel] 환경: ${TUNNEL_ENV}, 서버: ${this.serverUrl}`);
  }

  async startTunnel(port: number, useHttps: boolean = false): Promise<Tunnel> {
    return new Promise((resolve, reject) => {
      // 초기 상태 emit
      this.emit("wakeupProgress", {
        status: "서버 연결 시도 중...",
        progress: 10,
      });

      const args = [
        this.clientPath,
        port.toString(),
        this.serverUrl
          .replace("https://", "wss://")
          .replace("http://", "ws://"),
      ];

      if (useHttps) {
        args.push("https");
      }

      // VS Code 내장 Electron(Node)을 재사용 — 사용자 PC에 Node 미설치/PATH 누락(nvm 등)이어도 동작
      const tunnelProcess = spawn(process.execPath, args, {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      });
      this.pendingTunnelProcess = tunnelProcess; // 생성 중인 프로세스 추적

      let tunnelId: string | null = null;
      let tunnelUrl: string | null = null;
      let resolved = false;
      let allOutput = ""; // 모든 출력 저장
      let allErrors = ""; // 모든 에러 저장
      let connectionStarted = false;
      let serverConnected = false;

      tunnelProcess.stdout.on("data", (data) => {
        const output = data.toString();
        allOutput += output;
        console.log(`[Tunnel] Tunnel output: ${output}`);

        // 연결 시작 감지
        if (
          output.includes("터널 클라이언트 시작") ||
          output.includes("로컬 서버")
        ) {
          connectionStarted = true;
          console.log("[Tunnel] ✅ 터널 클라이언트 초기화 완료");
          this.emit("wakeupProgress", {
            status: "터널 클라이언트 초기화 완료",
            progress: 30,
          });
        }

        // 서버 연결 성공 감지
        if (output.includes("터널 서버 연결 성공") && !serverConnected) {
          serverConnected = true;
          console.log("[Tunnel] ✅ 터널 서버 연결 완료");
          this.emit("wakeupProgress", {
            status: "서버 연결 완료! 터널 설정 중...",
            progress: 60,
          });
        }

        // 터널 ID 추출
        const idMatch = output.match(/🔑 터널 ID: ([a-f0-9]{8})/);
        if (idMatch && !tunnelId) {
          tunnelId = idMatch[1];
          console.log(`[Tunnel] ✅ 터널 ID 할당됨: ${tunnelId}`);
          this.emit("wakeupProgress", {
            status: "터널 ID 생성 완료",
            progress: 80,
          });
        }

        // URL 추출
        const urlMatch = output.match(/📎 터널 URL: (https:\/\/[^\s]+)/);
        if (urlMatch && !tunnelUrl) {
          tunnelUrl = urlMatch[1];
          console.log(`[Tunnel] ✅ 터널 URL 생성됨: ${tunnelUrl}`);
          this.emit("wakeupProgress", {
            status: "터널 URL 생성 완료! 🎉",
            progress: 95,
          });
        }

        // 원격 로그 파싱
        const remoteLogMatch = output.match(/🔍 \[REMOTE_LOG\] (.+)/);
        if (remoteLogMatch && tunnelId) {
          try {
            const logData = JSON.parse(remoteLogMatch[1]);
            const consoleLog: ConsoleLog = {
              timestamp: new Date(logData.timestamp),
              level: logData.level,
              message: logData.message,
              source: "remote",
            };
            this.addLog(tunnelId, consoleLog);
          } catch (error) {
            console.error("[Tunnel] Failed to parse remote log:", error);
          }
        }

        // 첫 접속 감지
        if (output.includes("[FIRST_ACCESS]") && tunnelId) {
          console.log(`[Tunnel] ✅ 첫 접속 감지됨: ${tunnelId}`);
          this.emit("firstAccess", tunnelId);
        }

        // 둘 다 추출되면 터널 등록
        if (tunnelId && tunnelUrl && !resolved) {
          const tunnel: Tunnel = {
            id: tunnelId,
            port: port,
            url: tunnelUrl,
            startTime: new Date(),
            useHttps: useHttps,
            process: tunnelProcess,
            logs: [],
          };

          this.activeTunnels.set(tunnelId, tunnel);
          this.pendingTunnelProcess = null; // 생성 완료
          this.emit("tunnelStarted", tunnel);
          resolved = true;
          console.log(`[Tunnel] ✅ 터널 시작 완료: ${tunnelId}`);
          resolve(tunnel);
        }
      });

      tunnelProcess.stderr.on("data", (data) => {
        const error = data.toString();
        allErrors += error;
        console.error(`[Tunnel] Tunnel error: ${error}`);
      });

      tunnelProcess.on("close", (code) => {
        console.log(`[Tunnel] Tunnel process exited with code ${code}`);
        if (tunnelId) {
          this.activeTunnels.delete(tunnelId);
          this.emit("tunnelStopped", tunnelId);
        }
        if (this.pendingTunnelProcess === tunnelProcess) {
          this.pendingTunnelProcess = null;
        }
      });

      tunnelProcess.on("error", (error: Error & { code?: string }) => {
        if (!resolved) {
          resolved = true;
          this.pendingTunnelProcess = null;
          if (error.code === "ENOENT") {
            reject(
              new Error(
                "Node 런타임 실행 실패 (ENOENT). VS Code를 완전히 종료 후 재시작해 주세요. " +
                  "문제가 지속되면 확장을 재설치하거나 개발자에게 문의 바랍니다."
              )
            );
          } else {
            reject(new Error(`Process error: ${error.message}`));
          }
        }
      });

      // 60초 후에도 URL이 없으면 실패 (Render.com 슬립 모드 고려)
      setTimeout(() => {
        if (!resolved) {
          tunnelProcess.kill();
          resolved = true;
          this.pendingTunnelProcess = null;

          // 상세한 에러 메시지 생성
          let errorMessage = "Tunnel failed to start within 60 seconds.\n\n";

          if (!connectionStarted) {
            errorMessage += "❌ 터널 클라이언트 초기화 실패\n";
            errorMessage += "- Node.js가 설치되어 있는지 확인하세요\n";
            errorMessage += `- 클라이언트 경로 확인: ${this.clientPath}\n`;
          } else if (!tunnelId || !tunnelUrl) {
            errorMessage += "❌ 터널 서버 연결 실패\n";
            errorMessage +=
              "- 서버가 슬립 모드일 수 있습니다 (최대 1분 대기)\n";
            errorMessage += "- 네트워크 연결을 확인하세요\n";
            errorMessage += `- 서버 URL: ${this.serverUrl}\n`;
          }

          if (allOutput) {
            errorMessage += "\n📋 출력 로그:\n" + allOutput;
          }

          if (allErrors) {
            errorMessage += "\n❌ 에러 로그:\n" + allErrors;
          }

          reject(new Error(errorMessage));
        }
      }, 60000);
    });
  }

  async stopTunnel(tunnelId: string): Promise<void> {
    const tunnel = this.activeTunnels.get(tunnelId);
    if (tunnel && tunnel.process) {
      tunnel.process.kill();
      this.activeTunnels.delete(tunnelId);
      this.emit("tunnelStopped", tunnelId);
    } else {
      throw new Error(`Tunnel not found: ${tunnelId}`);
    }
  }

  getTunnels(): Tunnel[] {
    return Array.from(this.activeTunnels.values()).map((t) => ({
      id: t.id,
      port: t.port,
      url: t.url,
      startTime: t.startTime,
      useHttps: t.useHttps,
      logs: t.logs,
    }));
  }

  // 터널에 로그 추가
  addLog(tunnelId: string, log: ConsoleLog): void {
    const tunnel = this.activeTunnels.get(tunnelId);
    if (tunnel) {
      tunnel.logs.push(log);
      // 최대 로그 개수 제한
      if (tunnel.logs.length > this.maxLogsPerTunnel) {
        tunnel.logs.shift();
      }
      this.emit("logAdded", tunnelId, log);
    }
  }

  // 터널 로그 가져오기
  getLogs(tunnelId: string): ConsoleLog[] {
    const tunnel = this.activeTunnels.get(tunnelId);
    return tunnel ? tunnel.logs : [];
  }

  // 터널 로그 초기화
  clearLogs(tunnelId: string): void {
    const tunnel = this.activeTunnels.get(tunnelId);
    if (tunnel) {
      tunnel.logs = [];
      this.emit("logsCleared", tunnelId);
    }
  }

  getTunnel(tunnelId: string): Tunnel | undefined {
    return this.activeTunnels.get(tunnelId);
  }

  // 터널 생성 취소
  cancelPendingTunnel(): void {
    if (this.pendingTunnelProcess) {
      console.log("[Tunnel] 🚫 터널 생성 요청 취소됨");
      this.pendingTunnelProcess.kill();
      this.pendingTunnelProcess = null;
      this.emit("tunnelCancelled");
    }
  }

  dispose(): void {
    // 생성 중인 터널 취소
    if (this.pendingTunnelProcess) {
      this.pendingTunnelProcess.kill();
      this.pendingTunnelProcess = null;
    }

    // 모든 터널 중지
    for (const tunnel of this.activeTunnels.values()) {
      if (tunnel.process) {
        tunnel.process.kill();
      }
    }
    this.activeTunnels.clear();
    this.removeAllListeners();
  }
}
