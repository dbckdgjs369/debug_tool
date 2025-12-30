import * as vscode from "vscode";
import { TunnelManager, Tunnel } from "./tunnelManager";

export class TunnelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "tunnelView";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly tunnelManager: TunnelManager
  ) {
    // 터널 이벤트 리스닝
    this.tunnelManager.on("tunnelStarted", () => {
      this.refresh();
    });

    this.tunnelManager.on("tunnelStopped", () => {
      this.refresh();
    });
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
    webviewView.webview.onDidReceiveMessage(async (data) => {
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
        case "checkServerStatus":
          await this.handleCheckServerStatus();
          break;
        case "wakeServer":
          await this.handleWakeServer();
          break;
      }
    });
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

  private async handleCheckServerStatus() {
    try {
      const status = await this.tunnelManager.checkServerStatus();
      if (this._view) {
        this._view.webview.postMessage({
          type: "serverStatus",
          status: status,
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`서버 상태 확인 실패: ${error}`);
    }
  }

  private async handleWakeServer() {
    try {
      vscode.window.showInformationMessage("서버를 깨우는 중입니다...");
      const status = await this.tunnelManager.wakeServer();
      if (status.isOnline) {
        vscode.window.showInformationMessage("서버가 활성화되었습니다!");
      } else {
        vscode.window.showWarningMessage(
          `서버 활성화 실패: ${status.error || "알 수 없는 오류"}`
        );
      }
      // 상태 업데이트
      await this.handleCheckServerStatus();
    } catch (error) {
      vscode.window.showErrorMessage(`서버 깨우기 실패: ${error}`);
    }
  }

  public refresh() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const tunnels = this.tunnelManager.getTunnels();

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

    .server-status-section {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 15px;
    }

    .server-status-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .server-status-title {
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .server-status-info {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 10px;
    }

    .server-status-actions {
      display: flex;
      gap: 6px;
    }

    .server-status-actions button {
      flex: 1;
      padding: 6px 12px;
      font-size: 12px;
    }

    .btn-success {
      background: #4ec9b0;
      color: #000;
    }

    .btn-success:hover {
      background: #5fd4bb;
    }

    .status-loading {
      color: var(--vscode-descriptionForeground);
    }

    .status-online {
      color: #4ec9b0;
    }

    .status-offline {
      color: #f48771;
    }

    .btn-icon {
      padding: 4px 8px;
      min-width: auto;
    }
  </style>
</head>
<body>
  <h2>🚇 Custom Tunnel</h2>

  <!-- 서버 상태 섹션 -->
  <div class="section">
    <div class="server-status-section">
      <div class="server-status-header">
        <div class="server-status-title">
          <span>🖥️ 터널 서버</span>
          <span id="serverStatusDot" class="status-dot"></span>
        </div>
        <button class="btn-secondary btn-icon" onclick="refreshServerStatus()" title="새로고침">
          🔄
        </button>
      </div>
      <div id="serverStatusInfo" class="server-status-info status-loading">
        상태 확인 중...
      </div>
      <div class="server-status-actions">
        <button id="wakeServerBtn" class="btn-success" onclick="wakeServer()" disabled>
          ⚡ 서버 깨우기
        </button>
      </div>
    </div>
  </div>

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

    // 서버 상태 확인
    function refreshServerStatus() {
      const statusInfo = document.getElementById('serverStatusInfo');
      const statusDot = document.getElementById('serverStatusDot');
      const wakeBtn = document.getElementById('wakeServerBtn');

      statusInfo.textContent = '상태 확인 중...';
      statusInfo.className = 'server-status-info status-loading';
      statusDot.className = 'status-dot';
      
      vscode.postMessage({
        type: 'checkServerStatus'
      });
    }

    // 서버 깨우기
    function wakeServer() {
      const wakeBtn = document.getElementById('wakeServerBtn');
      wakeBtn.disabled = true;
      wakeBtn.textContent = '⏳ 깨우는 중...';
      
      vscode.postMessage({
        type: 'wakeServer'
      });
    }

    // 서버 상태 업데이트 받기
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'serverStatus') {
        updateServerStatus(message.status);
      }
    });

    // 서버 상태 UI 업데이트
    function updateServerStatus(status) {
      const statusInfo = document.getElementById('serverStatusInfo');
      const statusDot = document.getElementById('serverStatusDot');
      const wakeBtn = document.getElementById('wakeServerBtn');

      if (status.isOnline) {
        statusInfo.innerHTML = '<span class="status-online">✅ 온라인</span>' + 
          (status.activeTunnels !== undefined ? ' | 활성 터널: ' + status.activeTunnels + '개' : '');
        statusDot.className = 'status-dot connected';
        wakeBtn.disabled = true;
        wakeBtn.textContent = '⚡ 서버 깨우기';
      } else {
        statusInfo.innerHTML = '<span class="status-offline">❌ 오프라인</span>' + 
          (status.error ? '<br>' + status.error : ' (서버가 Sleep 모드일 수 있습니다)');
        statusDot.className = 'status-dot disconnected';
        wakeBtn.disabled = false;
        wakeBtn.textContent = '⚡ 서버 깨우기';
      }
    }

    // Enter 키로 터널 시작
    document.getElementById('portInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        startTunnel();
      }
    });

    // 페이지 로드시 서버 상태 확인
    refreshServerStatus();
  </script>
</body>
</html>`;
  }
}
