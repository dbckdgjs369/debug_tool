import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import { EventEmitter } from "events";

export interface Tunnel {
  id: string;
  port: number;
  url: string;
  startTime: Date;
  useHttps: boolean;
  process?: ChildProcess;
}

export class TunnelManager extends EventEmitter {
  private activeTunnels: Map<string, Tunnel> = new Map();
  private clientPath: string;

  constructor() {
    super();
    // client/index.js 경로
    this.clientPath = path.join(__dirname, "../custom-tunnel/client/index.js");
  }

  async startTunnel(port: number, useHttps: boolean = false): Promise<Tunnel> {
    return new Promise((resolve, reject) => {
      const args = [
        this.clientPath,
        port.toString(),
        "wss://custom-tunnel.fly.dev",
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
    }));
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
