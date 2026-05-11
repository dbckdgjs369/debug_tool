import * as vscode from "vscode";
import { TunnelViewProvider } from "./tunnelViewProvider";
import { TunnelManager } from "./tunnelManager";

let tunnelManager: TunnelManager;

export function activate(context: vscode.ExtensionContext) {
  console.log("[Tunnel] Custom Tunnel extension is now active!");

  // 터널 매니저 초기화
  tunnelManager = new TunnelManager();

  // Webview Provider 등록
  const provider = new TunnelViewProvider(context.extensionUri, tunnelManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      TunnelViewProvider.viewType,
      provider,
    ),
  );

  // 명령어 등록
  context.subscriptions.push(
    vscode.commands.registerCommand("tunnel.start", async () => {
      const port = await vscode.window.showInputBox({
        prompt: "터널을 시작할 포트 번호를 입력하세요",
        placeHolder: "3000",
        validateInput: (value) => {
          const num = parseInt(value);
          if (isNaN(num) || num < 1 || num > 65535) {
            return "유효한 포트 번호를 입력하세요 (1-65535)";
          }
          return undefined;
        },
      });

      if (port) {
        try {
          await tunnelManager.startTunnel(parseInt(port));
          vscode.window.showInformationMessage(
            `터널이 시작되었습니다: 포트 ${port}`,
          );
        } catch (error) {
          vscode.window.showErrorMessage(`터널 시작 실패: ${error}`);
        }
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tunnel.stop", async (tunnelId: string) => {
      try {
        await tunnelManager.stopTunnel(tunnelId);
        vscode.window.showInformationMessage("터널이 중지되었습니다");
      } catch (error) {
        vscode.window.showErrorMessage(`터널 중지 실패: ${error}`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tunnel.refresh", () => {
      provider.refresh();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tunnel.copyUrl", (url: string) => {
      vscode.env.clipboard.writeText(url);
      vscode.window.showInformationMessage("URL이 클립보드에 복사되었습니다");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tunnel.openUrl", (url: string) => {
      vscode.env.openExternal(vscode.Uri.parse(url));
    }),
  );

  // 확장이 비활성화될 때 정리
  context.subscriptions.push({
    dispose: () => {
      tunnelManager.dispose();
    },
  });
}

export function deactivate() {
  if (tunnelManager) {
    tunnelManager.dispose();
  }
}
