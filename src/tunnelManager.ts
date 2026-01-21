import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import { EventEmitter } from "events";
import axios from "axios";

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

export interface ServerStatus {
  isOnline: boolean;
  status?: string;
  timestamp?: string;
  activeTunnels?: number;
  error?: string;
}

export class TunnelManager extends EventEmitter {
  private activeTunnels: Map<string, Tunnel> = new Map();
  private clientPath: string;
  private serverUrl: string;
  private maxLogsPerTunnel: number = 500; // 터널당 최대 로그 개수

  constructor() {
    super();
    // client/index.js 경로
    this.clientPath = path.join(__dirname, "../custom-tunnel/client/index.js");
    // 터널 서버 URL
    this.serverUrl = "https://debug-tool.onrender.com";
  }

  async checkServerStatus(): Promise<ServerStatus> {
    try {
      const response = await axios.get(`${this.serverUrl}/health`, {
        timeout: 10000,
      });
      return {
        isOnline: true,
        status: response.data.status,
        timestamp: response.data.timestamp,
        activeTunnels: response.data.activeTunnels,
      };
    } catch (error: any) {
      return {
        isOnline: false,
        error: error.message || "서버에 연결할 수 없습니다",
      };
    }
  }

  async wakeServer(): Promise<ServerStatus> {
    try {
      const response = await axios.get(`${this.serverUrl}/wake`, {
        timeout: 30000, // wake는 더 긴 타임아웃
      });
      return {
        isOnline: true,
        status: response.data.status,
        timestamp: response.data.timestamp,
      };
    } catch (error: any) {
      return {
        isOnline: false,
        error: error.message || "서버를 깨울 수 없습니다",
      };
    }
  }

  async startTunnel(port: number, useHttps: boolean = false): Promise<Tunnel> {
    return new Promise((resolve, reject) => {
      const args = [
        this.clientPath,
        port.toString(),
        "wss://debug-tool.onrender.com",
      ];

      if (useHttps) {
        args.push("https");
      }

      const tunnelProcess = spawn("node", args);

      let tunnelId: string | null = null;
      let tunnelUrl: string | null = null;
      let resolved = false;

      tunnelProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`Tunnel output: ${output}`);

        // 터널 ID 추출
        const idMatch = output.match(/🔑 터널 ID: ([a-f0-9]{8})/);
        if (idMatch && !tunnelId) {
          tunnelId = idMatch[1];
        }

        // URL 추출
        const urlMatch = output.match(/📎 터널 URL: (https:\/\/[^\s]+)/);
        if (urlMatch && !tunnelUrl) {
          tunnelUrl = urlMatch[1];
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
          this.emit("tunnelStarted", tunnel);
          resolved = true;
          resolve(tunnel);
        }
      });

      tunnelProcess.stderr.on("data", (data) => {
        console.error(`Tunnel error: ${data}`);
      });

      tunnelProcess.on("close", (code) => {
        console.log(`Tunnel process exited with code ${code}`);
        if (tunnelId) {
          this.activeTunnels.delete(tunnelId);
          this.emit("tunnelStopped", tunnelId);
        }
      });

      tunnelProcess.on("error", (error) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });

      // 10초 후에도 URL이 없으면 실패
      setTimeout(() => {
        if (!resolved) {
          tunnelProcess.kill();
          resolved = true;
          reject(new Error("Tunnel failed to start within 10 seconds"));
        }
      }, 10000);
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

  dispose(): void {
    // 모든 터널 중지
    for (const [tunnelId, tunnel] of this.activeTunnels) {
      if (tunnel.process) {
        tunnel.process.kill();
      }
    }
    this.activeTunnels.clear();
    this.removeAllListeners();
  }
}
