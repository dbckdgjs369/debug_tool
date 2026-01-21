# Custom Tunnel

로컬 개발 서버를 외부에서 접근 가능한 공개 URL로 공유할 수 있는 VSCode 확장 프로그램입니다.

## 기능

- 🌐 **로컬 서버 터널링**: 로컬 포트를 공개 URL로 즉시 공유
- 🎯 **간편한 관리**: VSCode 사이드바에서 터널 상태를 한눈에 확인
- 📋 **URL 복사**: 생성된 공개 URL을 클릭 한 번으로 클립보드에 복사
- 🔗 **브라우저 열기**: 공개 URL을 바로 브라우저에서 확인
- ⚡ **빠른 시작/중지**: 명령어 또는 UI 버튼으로 터널 제어

## 설치 방법

### VSIX 파일로 설치

1. `custom-tunnel-1.0.0.vsix` 파일 다운로드
2. VSCode 실행
3. Extensions 뷰 열기 (Ctrl+Shift+X / Cmd+Shift+X)
4. 우측 상단 "..." 메뉴 클릭 → "Install from VSIX..." 선택
5. 다운로드한 .vsix 파일 선택

### 명령어로 설치

```bash
code --install-extension custom-tunnel-1.0.0.vsix
```

## 사용 방법

### 1. 터널 시작

**방법 1: 명령 팔레트**

- `Ctrl+Shift+P` (Windows/Linux) 또는 `Cmd+Shift+P` (Mac)
- "Tunnel: Start Tunnel" 입력
- 공유할 로컬 포트 번호 입력 (예: 3000)

**방법 2: 사이드바**

- Activity Bar에서 "Custom Tunnel" 아이콘 클릭
- "Start Tunnel" 버튼 클릭
- 포트 번호 입력

### 2. URL 복사 및 공유

생성된 터널의 공개 URL을:

- 클립보드에 복사하거나
- 브라우저에서 바로 열 수 있습니다

### 3. 터널 중지

- 사이드바에서 실행 중인 터널의 "Stop" 버튼 클릭
- 또는 명령 팔레트에서 "Tunnel: Stop Tunnel" 실행

## 주요 명령어

| 명령어                 | 설명                |
| ---------------------- | ------------------- |
| `Tunnel: Start Tunnel` | 새 터널 시작        |
| `Tunnel: Stop Tunnel`  | 실행 중인 터널 중지 |
| `Tunnel: Refresh`      | 터널 목록 새로고침  |

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
│   ├── tunnelManager.ts      # 터널 관리 로직
│   ├── tunnelViewProvider.ts # Webview UI 제공
│   └── flyServerManager.ts   # 서버 통신 관리
├── out/                      # 컴파일된 JavaScript 파일
├── package.json              # 확장 프로그램 설정
├── tsconfig.json             # TypeScript 설정
└── .vscodeignore             # VSIX 빌드 제외 파일
```

### 주요 파일 설명

- **extension.ts**: 확장 프로그램의 활성화/비활성화 및 명령어 등록
- **tunnelManager.ts**: 터널 생성, 중지, 상태 관리
- **tunnelViewProvider.ts**: 사이드바 Webview UI 렌더링
- **flyServerManager.ts**: 외부 터널 서버와의 통신

## 문제 해결

### 터널이 시작되지 않는 경우

- 입력한 포트가 이미 사용 중인지 확인
- 방화벽 설정 확인
- VSCode 출력 패널에서 에러 로그 확인

### URL이 접속되지 않는 경우

- 로컬 서버가 정상적으로 실행 중인지 확인
- 올바른 포트 번호를 입력했는지 확인

## 라이선스

MIT License

## 작성자

dbckdgjs369

---

**버전**: 1.0.0  
**카테고리**: Development Tools  
**언어**: TypeScript
