import * as vscode from "vscode";
import { TunnelManager, Tunnel } from "./tunnelManager";
import { FlyServerManager, FlyServerStatus } from "./flyServerManager";

export class TunnelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "tunnelView";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly tunnelManager: TunnelManager,
    private readonly flyServerManager: FlyServerManager
  ) {
    // 터널 이벤트 리스닝
    this.tunnelManager.on("tunnelStarted", () => {
      this.refresh();
    });

    this.tunnelManager.on("tunnelStopped", () => {
      this.refresh();
    });

    // Fly 서버 이벤트 리스닝
    this.flyServerManager.on("statusChanged", () => {
      this.refresh();
    });

    // 초기 서버 상태 확인
    this.flyServerManager.checkStatus();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // 메시지 핸들러
    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "startTunnel":
          this.handleStartTunnel(data.port, data.useHttps);
          break;
        case "stopTunnel":
          this.handleStopTunnel(data.tunnelId);
          break;
        case "copyUrl":
          vscode.env.clipboard.writeText(data.url);
          vscode.window.showInformationMessage("URL이 복사되었습니다");
          break;
        case "openUrl":
          vscode.env.openExternal(vscode.Uri.parse(data.url));
          break;
        case "startFlyServer":
          this.handleStartFlyServer();
          break;
        case "stopFlyServer":
          this.handleStopFlyServer();
          break;
        case "refreshFlyServer":
          this.handleRefreshFlyServer();
          break;
      }
    });
  }

  private async handleStartFlyServer() {
    try {
      await this.flyServerManager.startServer();
      vscode.window.showInformationMessage("Fly.io 서버가 시작되었습니다");
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`서버 시작 실패: ${error}`);
    }
  }

  private async handleStopFlyServer() {
    try {
      await this.flyServerManager.stopServer();
      vscode.window.showInformationMessage("Fly.io 서버가 중지되었습니다");
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`서버 중지 실패: ${error}`);
    }
  }

  private async handleRefreshFlyServer() {
    try {
      await this.flyServerManager.checkStatus();
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`상태 확인 실패: ${error}`);
    }
  }

  private async handleStartTunnel(port: number, useHttps: boolean) {
    try {
      const tunnel = await this.tunnelManager.startTunnel(port, useHttps);
      vscode.window.showInformationMessage(
        `터널이 시작되었습니다: ${tunnel.url}`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`터널 시작 실패: ${error}`);
    }
  }

  private async handleStopTunnel(tunnelId: string) {
    try {
      await this.tunnelManager.stopTunnel(tunnelId);
      vscode.window.showInformationMessage("터널이 중지되었습니다");
    } catch (error) {
      vscode.window.showErrorMessage(`터널 중지 실패: ${error}`);
    }
  }

  public refresh() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const tunnels = this.tunnelManager.getTunnels();
    const flyServerStatus = this.flyServerManager.getStatus();

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Custom Tunnel</title>
  <style>
    body {
      padding: 10px;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    h2 {
      margin-top: 0;
      margin-bottom: 15px;
      font-size: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .status-dot.connected {
      background-color: #4ec9b0;
    }

    .status-dot.disconnected {
      background-color: #f48771;
    }

    .section {
      margin-bottom: 20px;
    }

    .quick-start {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 15px;
    }

    .input-group {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    input[type="number"] {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 6px 8px;
      border-radius: 2px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    input[type="number"]:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
    }

    input[type="checkbox"] {
      cursor: pointer;
    }

    label {
      cursor: pointer;
      font-size: 13px;
    }

    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 14px;
      border-radius: 2px;
      cursor: pointer;
      font-family: var(--vscode-font-family);
      font-size: 13px;
      width: 100%;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button:active {
      background: var(--vscode-button-activeBackground);
    }

    .tunnel-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .tunnel-item {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 10px;
    }

    .tunnel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .tunnel-id {
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
      font-size: 13px;
    }

    .tunnel-url {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      margin-bottom: 8px;
      word-break: break-all;
    }

    .tunnel-meta {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      margin-bottom: 8px;
    }

    .tunnel-actions {
      display: flex;
      gap: 6px;
    }

    .tunnel-actions button {
      flex: 1;
      padding: 4px 8px;
      font-size: 11px;
    }

    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .btn-danger {
      background: #f48771;
      color: #fff;
    }

    .btn-danger:hover {
      background: #d16969;
    }

    .empty-state {
      text-align: center;
      padding: 30px 10px;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }

    .dashboard-status {
      font-size: 12px;
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .dashboard-status.connected {
      background: rgba(78, 201, 176, 0.1);
      border: 1px solid rgba(78, 201, 176, 0.3);
    }

    .dashboard-status.disconnected {
      background: rgba(244, 135, 113, 0.1);
      border: 1px solid rgba(244, 135, 113, 0.3);
    }
  </style>
</head>
<body>
  <h2>🚇 Custom Tunnel</h2>

  <div class="section">
    <div class="quick-start">
      <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 13px;">⚡ 빠른 시작</h3>
      <div class="input-group">
        <input type="number" id="portInput" placeholder="포트 (예: 3000)" min="1" max="65535">
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="httpsCheckbox">
        <label for="httpsCheckbox">HTTPS 사용</label>
      </div>
      <button onclick="startTunnel()">🚇 터널 시작</button>
    </div>
  </div>

  <div class="section">
    <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 13px;">📋 활성 터널 (${
      tunnels.length
    })</h3>
    <div class="tunnel-list">
      ${
        tunnels.length === 0
          ? '<div class="empty-state">실행 중인 터널이 없습니다</div>'
          : tunnels
              .map(
                (tunnel) => `
        <div class="tunnel-item">
          <div class="tunnel-header">
            <span class="tunnel-id">🚇 ${tunnel.id}</span>
          </div>
          <div class="tunnel-url">${tunnel.url}</div>
          <div class="tunnel-meta">
            포트: ${tunnel.port} | 
            ${tunnel.useHttps ? "HTTPS 🔒" : "HTTP"} | 
            시작: ${new Date(tunnel.startTime).toLocaleTimeString("ko-KR")}
          </div>
          <div class="tunnel-actions">
            <button class="btn-secondary" onclick="copyUrl('${
              tunnel.url
            }')">📋 복사</button>
            <button class="btn-secondary" onclick="openUrl('${
              tunnel.url
            }')">🌐 열기</button>
            <button class="btn-danger" onclick="stopTunnel('${
              tunnel.id
            }')">⏹️ 중지</button>
          </div>
        </div>
      `
              )
              .join("")
      }
    </div>
  </div>

  <div class="section">
    <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 13px;">🖥️ Fly.io 서버</h3>
    <div class="quick-start">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="status-dot ${
            flyServerStatus === "running" ? "connected" : "disconnected"
          }"></span>
          <span style="font-size: 13px; font-weight: 500;">
            ${
              flyServerStatus === "running"
                ? "🟢 Running"
                : flyServerStatus === "stopped"
                ? "🔴 Stopped"
                : "⚪ Unknown"
            }
          </span>
        </div>
        <button class="btn-secondary" onclick="refreshFlyServer()" style="width: auto; padding: 4px 10px; font-size: 11px;">🔄</button>
      </div>
      <div style="display: flex; gap: 8px;">
        <button 
          class="btn-secondary" 
          onclick="startFlyServer()" 
          ${
            flyServerStatus === "running"
              ? 'disabled style="opacity: 0.5; cursor: not-allowed;"'
              : ""
          }>
          ▶️ 시작
        </button>
        <button 
          class="btn-danger" 
          onclick="stopFlyServer()"
          ${
            flyServerStatus === "stopped"
              ? 'disabled style="opacity: 0.5; cursor: not-allowed;"'
              : ""
          }>
          ⏹️ 중지
        </button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function startTunnel() {
      const port = document.getElementById('portInput').value;
      const useHttps = document.getElementById('httpsCheckbox').checked;

      if (!port) {
        return;
      }

      vscode.postMessage({
        type: 'startTunnel',
        port: parseInt(port),
        useHttps: useHttps
      });

      // 입력 초기화
      document.getElementById('portInput').value = '';
      document.getElementById('httpsCheckbox').checked = false;
    }

    function stopTunnel(tunnelId) {
      vscode.postMessage({
        type: 'stopTunnel',
        tunnelId: tunnelId
      });
    }

    function copyUrl(url) {
      vscode.postMessage({
        type: 'copyUrl',
        url: url
      });
    }

    function openUrl(url) {
      vscode.postMessage({
        type: 'openUrl',
        url: url
      });
    }

    function startFlyServer() {
      vscode.postMessage({
        type: 'startFlyServer'
      });
    }

    function stopFlyServer() {
      vscode.postMessage({
        type: 'stopFlyServer'
      });
    }

    function refreshFlyServer() {
      vscode.postMessage({
        type: 'refreshFlyServer'
      });
    }

    // Enter 키로 터널 시작
    document.getElementById('portInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        startTunnel();
      }
    });
  </script>
</body>
</html>`;
  }
}
