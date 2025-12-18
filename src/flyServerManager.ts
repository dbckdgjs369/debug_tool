import { exec } from "child_process";
import { EventEmitter } from "events";

export type FlyServerStatus = "running" | "stopped" | "unknown";

export class FlyServerManager extends EventEmitter {
  private status: FlyServerStatus = "unknown";
  private flyctl: string;

  constructor() {
    super();
    this.flyctl = process.env.FLYCTL_PATH || "flyctl";
  }

  async checkStatus(): Promise<FlyServerStatus> {
    return new Promise((resolve) => {
      exec(`${this.flyctl} status --json -a custom-tunnel`, (error, stdout) => {
        if (error) {
          this.status = "stopped";
          this.emit("statusChanged", this.status);
          resolve("stopped");
          return;
        }
        try {
          const status = JSON.parse(stdout);
          const machines = status.Machines || [];
          const runningMachines = machines.filter(
            (m: any) => m.state === "started" || m.state === "running"
          );
          this.status = runningMachines.length > 0 ? "running" : "stopped";
          this.emit("statusChanged", this.status);
          resolve(this.status);
        } catch (e) {
          this.status = "unknown";
          this.emit("statusChanged", this.status);
          resolve("unknown");
        }
      });
    });
  }

  async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(
        `${this.flyctl} machine start 286e236c03d7d8 -a custom-tunnel`,
        (error, stdout, stderr) => {
          if (error) {
            reject(error.message);
            return;
          }
          this.status = "running";
          this.emit("statusChanged", this.status);
          resolve();
        }
      );
    });
  }

  async stopServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(
        `${this.flyctl} machine stop 286e236c03d7d8 -a custom-tunnel`,
        (error, stdout, stderr) => {
          if (error) {
            reject(error.message);
            return;
          }
          this.status = "stopped";
          this.emit("statusChanged", this.status);
          resolve();
        }
      );
    });
  }

  getStatus(): FlyServerStatus {
    return this.status;
  }

  dispose(): void {
    this.removeAllListeners();
  }
}
