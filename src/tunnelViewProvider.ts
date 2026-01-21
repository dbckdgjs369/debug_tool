import * as vscode from "vscode";
import { TunnelManager, Tunnel } from "./tunnelManager";

export class TunnelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "tunnelView";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly tunnelManager: TunnelManager,
  ) {
    // 터널 이벤트 리스닝
    this.tunnelManager.on("tunnelStarted", () => {
      this.refresh();
    });

    this.tunnelManager.on("tunnelStopped", () => {
      this.refresh();
    });

    this.tunnelManager.on("logAdded", (tunnelId: string, log: any) => {
      if (this._view) {
        this._view.webview.postMessage({
          type: "logAdded",
          tunnelId: tunnelId,
          log: log,
        });
      }
    });

    this.tunnelManager.on("logsCleared", (tunnelId: string) => {
      if (this._view) {
        this._view.webview.postMessage({
          type: "logsCleared",
          tunnelId: tunnelId,
        });
      }
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
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
        case "addLog":
          this.tunnelManager.addLog(data.tunnelId, data.log);
          break;
        case "clearLogs":
          this.tunnelManager.clearLogs(data.tunnelId);
          vscode.window.showInformationMessage("콘솔 로그가 지워졌습니다");
          break;
        case "testLog":
          // 테스트용 로그 추가
          this.tunnelManager.addLog(data.tunnelId, {
            timestamp: new Date(),
            level: data.level || "log",
            message: data.message || "테스트 로그",
            source: "test",
          });
          break;
      }
    });
  }

  private async handleStartTunnel(port: number, useHttps: boolean) {
    try {
      const tunnel = await this.tunnelManager.startTunnel(port, useHttps);
      vscode.window.showInformationMessage(
        `터널이 시작되었습니다: ${tunnel.url}`,
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

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
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

    /* QR 코드 모달 */
    .qr-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .qr-modal.active {
      display: flex;
    }

    .qr-modal-content {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 20px;
      max-width: 320px;
      width: 90%;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .qr-modal-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 15px;
      color: var(--vscode-foreground);
    }

    .qr-code-container {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
      display: inline-block;
    }

    .qr-url {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      word-break: break-all;
      margin-bottom: 15px;
    }

    .qr-close-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .qr-close-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* 콘솔 패널 스타일 */
    .console-panel {
      margin-top: 10px;
      border-top: 1px solid var(--vscode-panel-border);
      padding-top: 10px;
    }

    .console-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .console-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-foreground);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .console-actions {
      display: flex;
      gap: 4px;
    }

    .console-actions button {
      padding: 2px 6px;
      font-size: 10px;
      min-width: auto;
    }

    .console-content {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px;
      max-height: 200px;
      overflow-y: auto;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 11px;
      display: none;
    }

    .console-content.expanded {
      display: block;
    }

    .console-empty {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      text-align: center;
      padding: 10px;
    }

    .console-log-item {
      margin-bottom: 4px;
      padding: 4px;
      border-radius: 2px;
      display: flex;
      gap: 6px;
      font-size: 10px;
      line-height: 1.4;
    }

    .console-log-item.log {
      background: rgba(78, 201, 176, 0.1);
      border-left: 2px solid #4ec9b0;
    }

    .console-log-item.info {
      background: rgba(75, 150, 255, 0.1);
      border-left: 2px solid #4b96ff;
    }

    .console-log-item.warn {
      background: rgba(255, 204, 0, 0.1);
      border-left: 2px solid #ffcc00;
    }

    .console-log-item.error {
      background: rgba(244, 135, 113, 0.1);
      border-left: 2px solid #f48771;
    }

    .console-log-time {
      color: var(--vscode-descriptionForeground);
      min-width: 60px;
      flex-shrink: 0;
    }

    .console-log-level {
      min-width: 40px;
      flex-shrink: 0;
      font-weight: 600;
    }

    .console-log-level.log {
      color: #4ec9b0;
    }

    .console-log-level.info {
      color: #4b96ff;
    }

    .console-log-level.warn {
      color: #ffcc00;
    }

    .console-log-level.error {
      color: #f48771;
    }

    .console-log-message {
      flex: 1;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .console-toggle-btn {
      cursor: pointer;
      user-select: none;
    }

    .btn-console {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      padding: 4px 8px;
      font-size: 10px;
    }

    .btn-console:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .script-info {
      background: rgba(75, 150, 255, 0.1);
      border: 1px solid rgba(75, 150, 255, 0.3);
      border-radius: 4px;
      padding: 8px;
      margin-top: 8px;
      font-size: 10px;
    }

    .script-info-title {
      font-weight: 600;
      margin-bottom: 4px;
      color: #4b96ff;
    }

    .script-code {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      padding: 6px;
      margin-top: 4px;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 9px;
      overflow-x: auto;
      word-break: break-all;
      white-space: pre-wrap;
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
        <div class="tunnel-item" data-tunnel-id="${tunnel.id}">
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
            <button class="btn-secondary" onclick="showQRCode('${
              tunnel.url
            }')">📱 QR</button>
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
          
          <!-- 콘솔 패널 -->
          <div class="console-panel">
            <div class="console-header">
              <div class="console-title console-toggle-btn" onclick="toggleConsole('${
                tunnel.id
              }')">
                <span id="console-toggle-icon-${
                  tunnel.id
                }">▶</span> <span>원격 콘솔 (${tunnel.logs.length})</span>
              </div>
              <div class="console-actions">
                <button class="btn-console" onclick="testLog('${
                  tunnel.id
                }', 'log')">Test</button>
                <button class="btn-console" onclick="clearConsole('${
                  tunnel.id
                }')">Clear</button>
              </div>
            </div>
            <div id="console-content-${tunnel.id}" class="console-content">
              ${
                tunnel.logs.length === 0
                  ? '<div class="console-empty">콘솔 로그가 없습니다</div>'
                  : tunnel.logs
                      .map(
                        (log: any) => `
                <div class="console-log-item ${log.level}">
                  <span class="console-log-time">${new Date(
                    log.timestamp,
                  ).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}</span>
                  <span class="console-log-level ${log.level}">${log.level.toUpperCase()}</span>
                  <span class="console-log-message">${this.escapeHtml(
                    log.message,
                  )}</span>
                </div>
              `,
                      )
                      .join("")
              }
            </div>
            
            <!-- 원격 콘솔 스크립트 안내 -->
            <div class="script-info">
              <div class="script-info-title">📱 모바일 콘솔 연결 방법</div>
              <div style="margin-bottom: 6px; color: var(--vscode-descriptionForeground);">
                웹페이지의 &lt;head&gt; 태그에 아래 스크립트를 추가하세요:
              </div>
              <div class="script-code" onclick="copyConsoleScript('${
                tunnel.id
              }')" title="클릭하여 복사" style="cursor: pointer;">
&lt;script&gt;
(function() {
  const tunnelId = '${tunnel.id}';
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  
  function sendLog(level, args) {
    const message = Array.from(args).map(arg => {
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); }
        catch { return String(arg); }
      }
      return String(arg);
    }).join(' ');
    
    fetch('https://debug-tool.onrender.com/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tunnelId, level, message })
    }).catch(() => {});
  }
  
  console.log = function() {
    originalLog.apply(console, arguments);
    sendLog('log', arguments);
  };
  console.warn = function() {
    originalWarn.apply(console, arguments);
    sendLog('warn', arguments);
  };
  console.error = function() {
    originalError.apply(console, arguments);
    sendLog('error', arguments);
  };
  console.info = function() {
    originalInfo.apply(console, arguments);
    sendLog('info', arguments);
  };
})();
&lt;/script&gt;
              </div>
            </div>
          </div>
        </div>
      `,
              )
              .join("")
      }
    </div>
  </div>

  <!-- QR 코드 모달 -->
  <div id="qrModal" class="qr-modal" onclick="closeQRModal(event)">
    <div class="qr-modal-content" onclick="event.stopPropagation()">
      <div class="qr-modal-title">📱 모바일로 접속하기</div>
      <div class="qr-code-container">
        <canvas id="qrCanvas"></canvas>
      </div>
      <div id="qrUrl" class="qr-url"></div>
      <button class="qr-close-btn" onclick="closeQRModal()">닫기</button>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
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

    // Enter 키로 터널 시작
    document.getElementById('portInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        startTunnel();
      }
    });

    // QR 코드 표시
    function showQRCode(url) {
      const modal = document.getElementById('qrModal');
      const qrContainer = document.querySelector('.qr-code-container');
      const qrUrl = document.getElementById('qrUrl');
      
      // URL 표시
      qrUrl.textContent = url;
      
      // 기존 QR 코드 제거
      qrContainer.innerHTML = '';
      
      // QR 코드 이미지 생성 (Google Charts API 사용)
      const qrSize = 200;
      const qrImg = document.createElement('img');
      qrImg.src = \`https://api.qrserver.com/v1/create-qr-code/?size=\${qrSize}x\${qrSize}&data=\${encodeURIComponent(url)}\`;
      qrImg.alt = 'QR Code';
      qrImg.style.width = qrSize + 'px';
      qrImg.style.height = qrSize + 'px';
      qrImg.style.display = 'block';
      
      qrContainer.appendChild(qrImg);
      
      // 모달 표시
      modal.classList.add('active');
    }
    
    // QR 코드 모달 닫기
    function closeQRModal(event) {
      const modal = document.getElementById('qrModal');
      
      // 이벤트가 있고 모달 배경을 클릭한 경우나 버튼을 클릭한 경우
      if (!event || event.target === modal || event.type === 'click') {
        modal.classList.remove('active');
      }
    }
    
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeQRModal();
      }
    });

    // 콘솔 토글
    function toggleConsole(tunnelId) {
      const content = document.getElementById(\`console-content-\${tunnelId}\`);
      const icon = document.getElementById(\`console-toggle-icon-\${tunnelId}\`);
      
      if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        icon.textContent = '▶';
      } else {
        content.classList.add('expanded');
        icon.textContent = '▼';
        // 스크롤을 맨 아래로
        setTimeout(() => {
          content.scrollTop = content.scrollHeight;
        }, 50);
      }
    }

    // 테스트 로그 추가
    function testLog(tunnelId, level) {
      const levels = ['log', 'info', 'warn', 'error'];
      const randomLevel = level || levels[Math.floor(Math.random() * levels.length)];
      const messages = [
        '테스트 로그 메시지입니다',
        'Hello from mobile device!',
        'API 호출 성공',
        '데이터 로딩 완료',
        '사용자 이벤트 발생'
      ];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      
      vscode.postMessage({
        type: 'testLog',
        tunnelId: tunnelId,
        level: randomLevel,
        message: randomMessage
      });
    }

    // 콘솔 클리어
    function clearConsole(tunnelId) {
      vscode.postMessage({
        type: 'clearLogs',
        tunnelId: tunnelId
      });
    }

    // 콘솔 스크립트 복사
    function copyConsoleScript(tunnelId) {
      const script = '<script>' +
        '(function() {' +
        '  const tunnelId = "' + tunnelId + '";' +
        '  const originalLog = console.log;' +
        '  const originalWarn = console.warn;' +
        '  const originalError = console.error;' +
        '  const originalInfo = console.info;' +
        '  ' +
        '  function sendLog(level, args) {' +
        '    const message = Array.from(args).map(arg => {' +
        '      if (typeof arg === "object") {' +
        '        try { return JSON.stringify(arg); }' +
        '        catch { return String(arg); }' +
        '      }' +
        '      return String(arg);' +
        '    }).join(" ");' +
        '    ' +
        '    fetch("https://debug-tool.onrender.com/log", {' +
        '      method: "POST",' +
        '      headers: { "Content-Type": "application/json" },' +
        '      body: JSON.stringify({ tunnelId, level, message })' +
        '    }).catch(() => {});' +
        '  }' +
        '  ' +
        '  console.log = function() {' +
        '    originalLog.apply(console, arguments);' +
        '    sendLog("log", arguments);' +
        '  };' +
        '  console.warn = function() {' +
        '    originalWarn.apply(console, arguments);' +
        '    sendLog("warn", arguments);' +
        '  };' +
        '  console.error = function() {' +
        '    originalError.apply(console, arguments);' +
        '    sendLog("error", arguments);' +
        '  };' +
        '  console.info = function() {' +
        '    originalInfo.apply(console, arguments);' +
        '    sendLog("info", arguments);' +
        '  };' +
        '})();' +
        '<' + '/script>';
      
      navigator.clipboard.writeText(script).then(() => {
        vscode.postMessage({
          type: 'copyUrl',
          url: '콘솔 스크립트가 복사되었습니다'
        });
      });
    }

    // 로그 추가 이벤트 리스너
    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.type === 'logAdded') {
        const tunnelId = message.tunnelId;
        const log = message.log;
        const content = document.getElementById(\`console-content-\${tunnelId}\`);
        
        if (content) {
          // 빈 상태 메시지 제거
          const emptyState = content.querySelector('.console-empty');
          if (emptyState) {
            emptyState.remove();
          }
          
          // 새 로그 아이템 생성
          const logItem = document.createElement('div');
          logItem.className = \`console-log-item \${log.level}\`;
          
          const time = new Date(log.timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          
          logItem.innerHTML = \`
            <span class="console-log-time">\${time}</span>
            <span class="console-log-level \${log.level}">\${log.level.toUpperCase()}</span>
            <span class="console-log-message">\${escapeHtml(log.message)}</span>
          \`;
          
          content.appendChild(logItem);
          
          // 로그 카운트 업데이트
          const titleSpan = content.previousElementSibling.querySelector('.console-title span:last-child');
          if (titleSpan) {
            const currentCount = content.querySelectorAll('.console-log-item').length;
            titleSpan.textContent = \`원격 콘솔 (\${currentCount})\`;
          }
          
          // 자동 스크롤 (콘솔이 열려있을 때만)
          if (content.classList.contains('expanded')) {
            content.scrollTop = content.scrollHeight;
          }
        }
      }
      
      if (message.type === 'logsCleared') {
        const tunnelId = message.tunnelId;
        const content = document.getElementById(\`console-content-\${tunnelId}\`);
        
        if (content) {
          content.innerHTML = '<div class="console-empty">콘솔 로그가 없습니다</div>';
          
          // 로그 카운트 업데이트
          const titleSpan = content.previousElementSibling.querySelector('.console-title span:last-child');
          if (titleSpan) {
            titleSpan.textContent = '원격 콘솔 (0)';
          }
        }
      }
    });

    // HTML 이스케이프 함수
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
  }
}
