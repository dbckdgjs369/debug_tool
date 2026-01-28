# debug_tool 프로젝트 구조 및 파일 역할 정리

## 📂 프로젝트 개요

VSCode 확장 프로그램으로, 로컬 개발 서버를 외부에서 접근 가능한 공개 URL로 공유하는 터널링 시스템입니다.

---

## 🗂️ 최상위 폴더 구조

### **1. `src/` - VSCode 확장 프로그램 소스**

VSCode 확장의 핵심 로직을 담고 있는 TypeScript 파일들

#### **`extension.ts`**

- 확장 프로그램의 진입점
- activate/deactivate 함수
- 명령어 등록 (startTunnel, stopTunnel, copyUrl, openUrl 등)
- TunnelManager와 TunnelViewProvider 초기화

#### **`tunnelManager.ts`**

- 터널 생성/중지/상태 관리
- Render.com 서버와의 WebSocket 통신
- 원격 콘솔 로그 수집 및 관리
- 로컬 터널 클라이언트 프로세스 관리

#### **`tunnelViewProvider.ts`**

- 사이드바 Webview UI 제공
- 실시간 이벤트 처리 (터널 상태, 로그 업데이트)
- UI와 백엔드 로직 간 메시지 전달

#### **`webview/` 폴더**

- **`template.html`**: Webview UI 템플릿
- **`style.css`**: UI 스타일시트
- **`main.js`**: 클라이언트 사이드 JavaScript (UI 상호작용)

---

### **2. `custom-tunnel/` - 터널 시스템**

실제 터널링을 담당하는 서버-클라이언트 아키텍처

#### **`custom-tunnel/server/` - 원격 터널 서버**

Render.com에 배포되는 공개 서버

- **`index.js`**
  - WebSocket + HTTP 서버
  - 터널 ID 생성 및 관리
  - 클라이언트 요청을 브라우저로 프록시
  - 원격 콘솔 로그 수집 및 전달
  - Base64 바이너리 데이터 처리

- **`package.json`**: 서버 의존성 (ws, express 등)
- **`Dockerfile`**: Docker 컨테이너 이미지 정의
- **`render.yaml`**: Render.com 배포 설정

#### **`custom-tunnel/client/` - 로컬 터널 클라이언트**

로컬 개발 서버와 원격 서버를 연결

- **`index.js`**
  - 로컬 서버로 요청 전달 (HTTP/HTTPS 지원)
  - 원격 서버로부터 받은 요청을 로컬 서버로 프록시
  - 응답 데이터 처리 (텍스트/바이너리)
  - HTML 응답에 원격 콘솔 캡처 스크립트 삽입
  - 타임스탬프 기반 캐싱 방지

- **`package.json`**: 클라이언트 의존성 (ws, axios 등)

#### **문서 파일들**

- **`QUICK_START.md`**: 빠른 시작 가이드
- **`README.md`**: 터널 시스템 상세 설명
- **`RENDER_DEPLOY.md`**: Render.com 배포 가이드

---

### **3. `out/` - 빌드 결과물**

TypeScript 컴파일 후 생성되는 JavaScript 파일들

- `extension.js`, `tunnelManager.js`, `tunnelViewProvider.js` 등

---

### **4. `.vscode/` - VSCode 프로젝트 설정**

- **`launch.json`**: 디버깅 설정
- **`tasks.json`**: 빌드 태스크 정의

---

## 📄 루트 파일들

### **설정 파일**

#### **`package.json`**

- VSCode 확장 메타데이터
- 확장 기능 정의 (commands, views, viewsContainers)
- 의존성 및 스크립트
- engines: vscode 버전 요구사항

#### **`tsconfig.json`**

- TypeScript 컴파일러 옵션
- 소스/출력 디렉토리 설정

#### **`.vscodeignore`**

- VSIX 패키징 시 제외할 파일 목록
- 소스 파일은 제외하고 컴파일된 파일만 포함

#### **`.gitignore`**

- Git에서 추적하지 않을 파일 목록

### **문서**

- **`README.md`**: 프로젝트 전체 문서
- **`ARCHITECTURE.md`**: 프로젝트 구조 및 아키텍처 설명 (본 문서)

---

## 🔄 데이터 흐름

### 1. **터널 시작 플로우**

```
사용자 클릭 "Start Tunnel"
  ↓
extension.ts (명령어 처리)
  ↓
tunnelManager.ts (터널 생성)
  ↓
custom-tunnel/client/index.js 실행 (자식 프로세스)
  ↓
WebSocket 연결 → custom-tunnel/server/index.js
  ↓
터널 ID 발급 및 공개 URL 생성
  ↓
tunnelViewProvider.ts (UI 업데이트)
```

### 2. **HTTP 요청 프록시 플로우**

```
브라우저 (공개 URL 접속)
  ↓
custom-tunnel/server/index.js (HTTP 요청 수신)
  ↓
WebSocket으로 요청 전달
  ↓
custom-tunnel/client/index.js (WebSocket 메시지 수신)
  ↓
axios로 로컬 서버 호출 (http://localhost:포트)
  ↓
응답 데이터 처리 (텍스트/바이너리)
  ↓
WebSocket으로 응답 전송
  ↓
custom-tunnel/server/index.js (브라우저로 응답)
```

### 3. **원격 콘솔 로그 플로우**

```
브라우저에서 console.log 실행
  ↓
주입된 스크립트가 감지 (custom-tunnel/client/index.js에서 삽입)
  ↓
fetch로 로그 전송 → custom-tunnel/server/index.js
  ↓
WebSocket으로 로그 전달
  ↓
custom-tunnel/client/index.js (stdout으로 출력)
  ↓
tunnelManager.ts (stdout 파싱 및 로그 저장)
  ↓
tunnelViewProvider.ts (UI 업데이트)
  ↓
webview/main.js (콘솔에 표시)
```

### 4. **QR 코드 생성 플로우**

```
사용자 클릭 "📱 QR"
  ↓
webview/main.js (메시지 전송)
  ↓
tunnelViewProvider.ts (showQRCode 처리)
  ↓
터널 서버로 QR 코드 요청
  ↓
SVG QR 코드 수신
  ↓
Webview에 팝업으로 표시
```

---

## 🏗️ 주요 기술 스택

### **VSCode 확장**

- TypeScript
- VSCode Extension API
- Webview API
- Child Process (터널 클라이언트 실행)

### **터널 서버 (Render.com)**

- Node.js
- WebSocket (ws)
- Express
- QRCode (qrcode)

### **터널 클라이언트 (로컬)**

- Node.js
- WebSocket (ws)
- Axios (HTTP 클라이언트)
- HTTP/HTTPS Agent

---

## 🔑 핵심 개념

### **터널 ID**

- 각 터널에 고유한 ID 부여
- 공개 URL: `https://debug-tool.onrender.com/:tunnelId/*`
- 쿠키에 저장하여 원격 콘솔 추적

### **WebSocket 양방향 통신**

- 서버 ↔ 클라이언트 실시간 통신
- 메시지 타입: `connected`, `request`, `response`, `log`

### **프록시 처리**

- HTTP 헤더 정리 (Host, Connection 등 제거)
- HTTPS → HTTP 변환
- 바이너리 데이터 Base64 인코딩
- gzip 압축 해제

### **캐싱 방지**

- 타임스탬프 기반 스크립트 버전 관리

---

## 📊 확장 기능

### **명령어 (Commands)**

- `tunnel.start`: 터널 시작
- `tunnel.stop`: 터널 중지
- `tunnel.refresh`: 새로고침
- `tunnel.copyUrl`: URL 복사
- `tunnel.openUrl`: 브라우저에서 열기

### **뷰 (Views)**

- `tunnel-explorer`: Activity Bar 아이콘
- `tunnelView`: Webview 패널

### **UI 기능**

- 터널 목록 표시
- 실시간 콘솔 로그 모니터링
- 로그 레벨 필터링 (ALL, LOG, INFO, WARN, ERROR)
- 로그 검색
- QR 코드 생성
- Wake-up 진행 상황 표시

---

## 🚀 배포 및 빌드

### **VSCode 확장 빌드**

```bash
npm run compile  # TypeScript → JavaScript
npm run package  # VSIX 파일 생성
```

### **터널 서버 배포**

- Render.com에 자동 배포
- `render.yaml` 설정 사용
- Docker 컨테이너 또는 Node.js 환경

---

이 구조를 통해 로컬 개발 서버를 외부에서 안전하게 접근하고, 실시간 콘솔 모니터링까지 제공합니다! 🎯
