# Custom Tunnel

로컬 개발 서버를 외부에서 접근 가능한 공개 URL로 공유할 수 있는 VSCode 확장 프로그램입니다.

<img src="images/screenshots/00-overview.png" alt="VSCode 사이드바 TUNNEL DASHBOARD 패널 전체 화면. 빠른 시작 폼과 활성 터널 목록(URL, 포트, HTTPS, 시작 시각, QR/복사/열기/중지 버튼), 원격 콘솔 영역이 함께 보이는 개요 스크린샷" width="320" />

## 기능

- 🌐 **로컬 서버 터널링**: 로컬 포트를 공개 URL로 즉시 공유
- 🎯 **간편한 관리**: VSCode 사이드바에서 터널 상태를 한눈에 확인
- 📋 **URL 복사**: 생성된 공개 URL을 클릭 한 번으로 클립보드에 복사
- 🔗 **브라우저 열기**: 공개 URL을 바로 브라우저에서 확인
- ⚡ **빠른 시작/중지**: 명령어 또는 UI 버튼으로 터널 제어
- 🖥️ **원격 콘솔 모니터링**: 실시간 로그 확인 및 레벨별 필터링 (LOG, INFO, WARN, ERROR)
- 🔍 **로그 검색 및 필터링**: 키워드 검색으로 원하는 로그만 빠르게 찾기
- 📱 **QR 코드 생성**: 모바일 기기에서 쉽게 접속할 수 있는 QR 코드 제공
- ⏳ **Wake-up 진행 상황**: 서버 깨우기 단계별 진행률 표시
- 🔒 **HTTPS 지원**: HTTPS 로컬 서버도 터널링 가능

## 설치 방법

### VSIX 파일로 설치

1. `custom-tunnel-2.1.0.vsix` 파일 다운로드
2. VSCode 실행
3. Extensions 뷰 열기 (Ctrl+Shift+X / Cmd+Shift+X)
4. 우측 상단 "..." 메뉴 클릭 → "Install from VSIX..." 선택
5. 다운로드한 .vsix 파일 선택

### 명령어로 설치

```bash
code --install-extension custom-tunnel-2.1.0.vsix
```

## 사용 방법

### 1. 사이드바 열기

Activity Bar에서 "Custom Tunnel" 아이콘을 클릭하면 "TUNNEL DASHBOARD" 패널이 열립니다.

### 2. 터널 시작

"⚡ 빠른 시작" 영역에서:

- **포트** 입력창에 공유할 로컬 포트 번호 입력 (예: 3000)
- HTTPS로 동작하는 로컬 서버라면 **HTTPS 사용** 체크박스 체크
- **🚇 터널 시작** 버튼 클릭

무료 서버가 Sleep 상태였다면 Wake-up 진행률이 표시된 뒤 연결됩니다.

### 3. 활성 터널 확인 및 제어

터널이 시작되면 "📋 활성 터널" 목록에 항목이 추가되며, 아래 정보와 버튼이 표시됩니다:

- 터널 ID와 공개 URL (예: `https://debug-tool.onrender.com/57725512`)
- 포트 / HTTPS 여부 / 시작 시각
- **📱 QR**: QR 코드 팝업으로 모바일 접속 URL 표시
- **📋 복사**: 공개 URL을 클립보드에 복사
- **🌐 열기**: 공개 URL을 브라우저에서 열기
- **⏹ 중지**: 해당 터널 중지

<img src="images/screenshots/01-active-tunnel.png" alt="활성 터널 목록에 표시된 터널 ID, 공개 URL, 포트/HTTPS/시작 시각 정보와 QR·복사·열기·중지 버튼이 있는 화면" width="320" />

QR 버튼을 누르면 모바일 카메라로 스캔할 수 있는 QR 코드가 팝업으로 나타납니다.

<img src="images/screenshots/02-qr-modal.png" alt="QR 버튼을 클릭했을 때 나타나는 모바일 접속용 QR 코드 팝업 화면" width="320" />

### 4. 원격 콘솔 모니터링

터널 항목의 "▶ 원격 콘솔" 을 클릭해 펼치면 원격 서버의 콘솔 로그를 실시간으로 확인할 수 있습니다:

- **ALL** 드롭다운으로 로그 레벨별 필터링 (ALL, LOG, INFO, WARN, ERROR)
- **필터...** 검색창에 키워드를 입력해 원하는 로그만 표시 (✕로 검색어 초기화)
- 🗑️ 아이콘으로 콘솔 로그 전체 지우기

<img src="images/screenshots/03-remote-console.png" alt="펼쳐진 원격 콘솔 패널. ALL 로그 레벨 드롭다운과 필터 검색창, 지우기 아이콘이 보이는 화면" width="320" />

### 5. 터널 중지

활성 터널 항목의 **⏹ 중지** 버튼을 클릭하면 해당 터널이 중지되고 목록에서 제거됩니다.

## 주요 명령어

| 명령어                          | 설명                         |
| ------------------------------- | ---------------------------- |
| `Tunnel: Start Tunnel`          | 새 터널 시작                 |
| `Tunnel: Stop Tunnel`           | 실행 중인 터널 중지          |
| `Tunnel: Refresh`               | 터널 목록 새로고침           |
| `Tunnel: Copy URL to Clipboard` | 터널 URL을 클립보드에 복사   |
| `Tunnel: Open URL in Browser`   | 터널 URL을 브라우저에서 열기 |

## 요구사항

- Visual Studio Code 1.74.0 이상
- Node.js 16.x 이상 (개발 시)

## 개발자 가이드

### 환경 설정

```bash
# 의존성 설치
npm install

# TypeScript 컴파일
npm run compile

# 개발 모드 (Watch)
npm run watch
```

### 빌드

```bash
# TypeScript 컴파일
npm run compile

# VSIX 파일 생성
npm install -g @vscode/vsce
vsce package
```

### 프로젝트 구조

```
debug_tool/
├── src/
│   ├── extension.ts          # 확장 프로그램 진입점
│   ├── tunnelManager.ts      # 터널 관리 및 서버 통신
│   ├── tunnelViewProvider.ts # Webview UI 제공
│   └── webview/              # Webview 리소스
│       ├── template.html     # UI 템플릿
│       ├── style.css         # 스타일시트
│       └── main.js           # 클라이언트 스크립트
├── custom-tunnel/            # 터널 시스템
│   ├── server/               # Render 배포 서버
│   │   ├── index.js          # WebSocket + HTTP 서버
│   │   ├── Dockerfile        # Docker 이미지
│   │   └── render.yaml       # Render 설정
│   └── client/               # 로컬 터널 클라이언트
│       └── index.js          # 로컬 서버 연결
├── out/                      # 컴파일된 JavaScript 파일
├── package.json              # 확장 프로그램 설정
├── tsconfig.json             # TypeScript 설정
└── .vscodeignore             # VSIX 빌드 제외 파일
```

### 주요 파일 설명

- **extension.ts**: 확장 프로그램의 활성화/비활성화 및 명령어 등록 (startTunnel, stopTunnel, copyUrl, openUrl)
- **tunnelManager.ts**: 터널 생성/중지/상태 관리 및 Render 서버 통신, 콘솔 로그 수집 및 관리
- **tunnelViewProvider.ts**: 사이드바 Webview UI 렌더링 및 실시간 이벤트 처리
- **webview/**: 사용자 인터페이스 (터널 목록, 콘솔 로그, QR 코드, Wake-up 진행 상황)

## 문제 해결

### 서버 연결이 느린 경우

- **무료 서버 Sleep 모드**: Render.com 무료 플랜은 비활성 상태에서 Sleep 모드로 전환됩니다
- **대기 시간**: 첫 연결 시 최대 30-60초 정도 소요될 수 있습니다
- **진행 상황**: Wake-up 오버레이에서 단계별 진행 상황을 확인하세요

## 라이선스

MIT License

## 작성자

dbckdgjs369

---

**버전**: 2.1.0  
**카테고리**: Development Tools  
**언어**: TypeScript
