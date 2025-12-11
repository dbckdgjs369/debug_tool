"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const localtunnel_1 = __importDefault(require("localtunnel"));
const https = __importStar(require("https"));
let currentTunnel = null;
let statusBarItem;
let publicIP = null;
// 공개 IP 주소 가져오기 (ipify API 사용)
async function getPublicIPFromIpify() {
    return new Promise((resolve, reject) => {
        https
            .get("https://api.ipify.org?format=json", (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.ip);
                }
                catch (e) {
                    reject(e);
                }
            });
        })
            .on("error", (err) => {
            reject(err);
        });
    });
}
// localtunnel 서버에서 정확한 터널 비밀번호 가져오기
async function getTunnelPassword() {
    return new Promise((resolve, reject) => {
        https
            .get("https://loca.lt/mytunnelpassword", (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                try {
                    // HTML 응답에서 IP 주소 추출
                    const ipMatch = data.match(/your tunnel password is: <b>([^<]+)<\/b>/i);
                    if (ipMatch && ipMatch[1]) {
                        resolve(ipMatch[1].trim());
                    }
                    else {
                        reject(new Error("비밀번호를 찾을 수 없습니다"));
                    }
                }
                catch (e) {
                    reject(e);
                }
            });
        })
            .on("error", (err) => {
            reject(err);
        });
    });
}
function activate(context) {
    console.log("Remote Debug Tunnel 익스텐션이 활성화되었습니다");
    // 상태 바 아이템 생성
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(globe) 터널: 꺼짐";
    statusBarItem.tooltip = "Remote Debug Tunnel";
    statusBarItem.command = "remote-debug-tunnel.showStatus";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // 터널 시작 명령
    let startTunnel = vscode.commands.registerCommand("remote-debug-tunnel.startTunnel", async () => {
        if (currentTunnel) {
            vscode.window.showWarningMessage("터널이 이미 실행 중입니다.");
            return;
        }
        // 포트 번호 입력받기
        const config = vscode.workspace.getConfiguration("remoteDebugTunnel");
        const defaultPort = config.get("defaultPort", 3000);
        const portInput = await vscode.window.showInputBox({
            prompt: "로컬 포트 번호를 입력하세요",
            value: defaultPort.toString(),
            validateInput: (value) => {
                const port = parseInt(value);
                if (isNaN(port) || port < 1 || port > 65535) {
                    return "유효한 포트 번호를 입력하세요 (1-65535)";
                }
                return null;
            },
        });
        if (!portInput) {
            return;
        }
        const port = parseInt(portInput);
        // 서브도메인 입력받기 (선택사항)
        const subdomain = await vscode.window.showInputBox({
            prompt: "서브도메인을 입력하세요 (선택사항, 비워두면 랜덤 생성)",
            placeHolder: "my-app (선택사항)",
        });
        try {
            vscode.window.showInformationMessage(`포트 ${port}에서 터널을 시작하는 중...`);
            const tunnelOptions = {
                port: port,
            };
            if (subdomain && subdomain.trim() !== "") {
                tunnelOptions.subdomain = subdomain.trim();
            }
            currentTunnel = await (0, localtunnel_1.default)(tunnelOptions);
            const url = currentTunnel.url;
            // 터널 비밀번호 가져오기 (localtunnel 서버에서 정확한 비밀번호 우선 시도)
            try {
                try {
                    publicIP = await getTunnelPassword();
                }
                catch (tunnelPwError) {
                    // localtunnel에서 실패하면 ipify API 사용
                    publicIP = await getPublicIPFromIpify();
                }
                statusBarItem.text = `$(globe) 터널: 켜짐`;
                statusBarItem.tooltip = `터널 URL: ${url}\n터널 비밀번호: ${publicIP}\n클릭하여 상세 정보 보기`;
                const action = await vscode.window.showInformationMessage(`터널이 생성되었습니다!\n\nURL: ${url}\n\n⚠️ 중요: 터널 비밀번호\n다른 사람이 접속하려면 비밀번호가 필요합니다.\n비밀번호: ${publicIP}\n\n이 비밀번호를 함께 공유하세요!`, "URL+비밀번호 복사", "브라우저에서 열기", "QR 코드 생성");
                if (action === "URL+비밀번호 복사") {
                    const shareText = `터널 URL: ${url}\n터널 비밀번호: ${publicIP}`;
                    vscode.env.clipboard.writeText(shareText);
                    vscode.window.showInformationMessage("URL과 비밀번호가 클립보드에 복사되었습니다!");
                }
                else if (action === "브라우저에서 열기") {
                    vscode.env.openExternal(vscode.Uri.parse(url));
                }
                else if (action === "QR 코드 생성") {
                    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
                    vscode.env.openExternal(vscode.Uri.parse(qrCodeUrl));
                }
            }
            catch (ipError) {
                // IP를 가져오지 못한 경우에도 터널은 작동
                statusBarItem.text = `$(globe) 터널: 켜짐`;
                statusBarItem.tooltip = `터널 URL: ${url}\n클릭하여 상세 정보 보기`;
                const action = await vscode.window.showInformationMessage(`터널이 생성되었습니다!\n\nURL: ${url}\n\n⚠️ 주의: 다른 사람이 접속하려면 터널 비밀번호(공개 IP)가 필요합니다.\nhttps://loca.lt/mytunnelpassword 에서 확인하세요.`, "URL 복사", "브라우저에서 열기", "QR 코드 생성");
                if (action === "URL 복사") {
                    vscode.env.clipboard.writeText(url);
                    vscode.window.showInformationMessage("URL이 클립보드에 복사되었습니다!");
                }
                else if (action === "브라우저에서 열기") {
                    vscode.env.openExternal(vscode.Uri.parse(url));
                }
                else if (action === "QR 코드 생성") {
                    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
                    vscode.env.openExternal(vscode.Uri.parse(qrCodeUrl));
                }
            }
            // 터널 에러 핸들링
            currentTunnel.on("error", (err) => {
                vscode.window.showErrorMessage(`터널 오류: ${err.message}`);
                stopTunnel();
            });
            currentTunnel.on("close", () => {
                vscode.window.showInformationMessage("터널이 종료되었습니다.");
                stopTunnel();
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`터널 생성 실패: ${error.message}`);
            currentTunnel = null;
            statusBarItem.text = "$(globe) 터널: 꺼짐";
        }
    });
    // 터널 중지 명령
    let stopTunnelCommand = vscode.commands.registerCommand("remote-debug-tunnel.stopTunnel", () => {
        if (!currentTunnel) {
            vscode.window.showWarningMessage("실행 중인 터널이 없습니다.");
            return;
        }
        stopTunnel();
        vscode.window.showInformationMessage("터널이 중지되었습니다.");
    });
    // 상태 확인 명령
    let showStatus = vscode.commands.registerCommand("remote-debug-tunnel.showStatus", () => {
        if (currentTunnel) {
            const url = currentTunnel.url;
            const statusMessage = publicIP
                ? `터널 활성화 중\nURL: ${url}\n\n터널 비밀번호: ${publicIP}\n\n다른 사람이 접속하려면 이 비밀번호가 필요합니다.`
                : `터널 활성화 중\nURL: ${url}\n\n⚠️ 다른 사람이 접속하려면 터널 비밀번호(공개 IP)가 필요합니다.`;
            vscode.window
                .showInformationMessage(statusMessage, publicIP ? "URL+비밀번호 복사" : "URL 복사", "브라우저에서 열기", "터널 중지")
                .then((action) => {
                if (action === "URL+비밀번호 복사" && publicIP) {
                    const shareText = `터널 URL: ${url}\n터널 비밀번호: ${publicIP}`;
                    vscode.env.clipboard.writeText(shareText);
                    vscode.window.showInformationMessage("URL과 비밀번호가 클립보드에 복사되었습니다!");
                }
                else if (action === "URL 복사") {
                    vscode.env.clipboard.writeText(url);
                    vscode.window.showInformationMessage("URL이 클립보드에 복사되었습니다!");
                }
                else if (action === "브라우저에서 열기") {
                    vscode.env.openExternal(vscode.Uri.parse(url));
                }
                else if (action === "터널 중지") {
                    vscode.commands.executeCommand("remote-debug-tunnel.stopTunnel");
                }
            });
        }
        else {
            vscode.window
                .showInformationMessage("실행 중인 터널이 없습니다.", "터널 시작")
                .then((action) => {
                if (action === "터널 시작") {
                    vscode.commands.executeCommand("remote-debug-tunnel.startTunnel");
                }
            });
        }
    });
    context.subscriptions.push(startTunnel);
    context.subscriptions.push(stopTunnelCommand);
    context.subscriptions.push(showStatus);
}
function stopTunnel() {
    if (currentTunnel) {
        currentTunnel.close();
        currentTunnel = null;
    }
    statusBarItem.text = "$(globe) 터널: 꺼짐";
    statusBarItem.tooltip = "Remote Debug Tunnel";
}
function deactivate() {
    stopTunnel();
}
//# sourceMappingURL=extension.js.map