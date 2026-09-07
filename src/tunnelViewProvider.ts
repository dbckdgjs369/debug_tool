import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { TunnelManager } from "./tunnelManager";

export class TunnelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "tunnelView";

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly tunnelManager: TunnelManager,
    // 설치된 확장 매니페스트의 버전. 헤더 표시에 쓰이며 하드코딩하지 않는다.
    private readonly _version: string,
  ) {
    // 터널 이벤트 리스닝
    this.tunnelManager.on("tunnelStarted", () => {
      // 터널 시작 완료 - 로딩 UI 숨기기
      if (this._view) {
        this._view.webview.postMessage({
          type: "wakeupComplete",
        });
      }
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

    // Wake-up 진행 상황 전달
    this.tunnelManager.on("wakeupProgress", (data: any) => {
      if (this._view) {
        this._view.webview.postMessage({
          type: "wakeupProgress",
          status: data.status,
          progress: data.progress,
        });
      }
    });

    // 첫 접속 감지 시 QR 팝업 자동 닫기
    this.tunnelManager.on("firstAccess", () => {
      if (this._view) {
        this._view.webview.postMessage({
          type: "closeQRModal",
        });
      }
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // 웹뷰 가시성 변경 이벤트 (탭 전환 시)
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        // 웹뷰가 다시 보일 때 현재 상태 복원
        this.restoreWebviewState();
      }
    });

    // 메시지 핸들러
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case "startTunnel":
          this.handleStartTunnel(data.port, data.useHttps);
          break;
        case "stopTunnel":
          this.handleStopTunnel(data.tunnelId);
          break;
        case "cancelTunnel":
          this.tunnelManager.cancelPendingTunnel();
          break;
        case "copyUrl":
          vscode.env.clipboard.writeText(data.url);
          vscode.window.showInformationMessage("URL이 복사되었습니다");
          break;
        case "openUrl":
          vscode.env.openExternal(vscode.Uri.parse(data.url));
          break;
        case "clearLogs":
          this.tunnelManager.clearLogs(data.tunnelId);
          vscode.window.showInformationMessage("콘솔 로그가 지워졌습니다");
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
      // 로딩 UI 숨기기
      if (this._view) {
        this._view.webview.postMessage({
          type: "wakeupFailed",
        });
      }
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

  private restoreWebviewState() {
    const view = this._view;
    if (!view) {
      return;
    }

    // 각 터널의 로그를 웹뷰에 전달
    for (const tunnel of this.tunnelManager.getTunnels()) {
      view.webview.postMessage({
        type: "restoreLogs",
        tunnelId: tunnel.id,
        logs: tunnel.logs,
      });
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

    // 파일 경로 설정
    const templatePath = path.join(
      this._extensionUri.fsPath,
      "src",
      "webview",
      "template.html",
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src", "webview", "style.css"),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src", "webview", "main.js"),
    );
    // QR 라이브러리는 확장에 포함해 둔다. CDN을 쓰면 오프라인에서 QR이 안 뜬다.
    const qrcodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "src",
        "webview",
        "vendor",
        "qrcode.min.js",
      ),
    );

    // HTML 템플릿 읽기
    let html = fs.readFileSync(templatePath, "utf8");

    // CSP 소스 설정
    const cspSource = webview.cspSource;

    // 터널 리스트 HTML 생성
    const tunnelListContent =
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
            <button class="btn-secondary" onclick="showQRCode('${tunnel.url}')">📱 QR</button>
            <button class="btn-secondary" onclick="copyUrl('${tunnel.url}')">📋 복사</button>
            <button class="btn-secondary" onclick="openUrl('${tunnel.url}')">🌐 열기</button>
            <button class="btn-danger" onclick="stopTunnel('${tunnel.id}')">⏹️ 중지</button>
          </div>
          
          <!-- 콘솔 패널 -->
          <div class="console-panel">
            <div class="console-header">
              <div class="console-title console-toggle-btn" onclick="toggleConsole('${tunnel.id}')">
                <span id="console-toggle-icon-${tunnel.id}">▶</span> <span>원격 콘솔 (${tunnel.logs.length})</span>
              </div>
            </div>
            <div class="console-toolbar">
              <select id="filter-select-${tunnel.id}" class="console-filter-select" onchange="filterLogsFromSelect('${tunnel.id}')">
                <option value="all">⚪ ALL</option>
                <option value="log">🟢 LOG</option>
                <option value="info">🔵 INFO</option>
                <option value="warn">🟡 WARN</option>
                <option value="error">🔴 ERROR</option>
              </select>
              <div class="console-search-wrapper">
                <input type="text" id="search-input-${tunnel.id}" class="console-search-input" placeholder="필터..." oninput="searchLogs('${tunnel.id}')">
                <button class="icon-btn" onclick="clearSearch('${tunnel.id}')" title="지우기">✕</button>
                <button class="icon-btn" onclick="clearConsole('${tunnel.id}')" title="콘솔 지우기">🗑️</button>
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
                  <span class="console-log-message">${this.escapeHtml(log.message)}</span>
                </div>
              `,
                      )
                      .join("")
              }
            </div>
          </div>
        </div>
      `,
            )
            .join("");

    // 템플릿 변수 치환
    html = html
      .replace(/\{\{cspSource\}\}/g, cspSource)
      .replace(/\{\{styleUri\}\}/g, styleUri.toString())
      .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
      .replace(/\{\{qrcodeUri\}\}/g, qrcodeUri.toString())
      .replace(/\{\{version\}\}/g, this.escapeHtml(this._version))
      .replace(/\{\{tunnelCount\}\}/g, tunnels.length.toString())
      .replace(/\{\{tunnelListContent\}\}/g, tunnelListContent);

    return html;
  }
}
