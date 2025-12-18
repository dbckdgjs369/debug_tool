# 🚇 Custom Tunnel System

로컬에서 개발 중인 웹 애플리케이션을 외부에서 접속 가능하도록 만드는 터널링 시스템입니다.

## ✨ 주요 기능

- 🌐 **로컬 서버 공개**: localhost를 인터넷에 공유
- 🔒 **HTTPS 지원**: 자체 서명 인증서 자동 허용
- 🖼️ **바이너리 파일 지원**: 이미지, 폰트, 비디오 등 완벽 지원
- ⚛️ **React Router 지원**: SPA 자동 라우팅 패치
- 🎨 **웹 대시보드**: 터널 관리 UI 제공
- ☁️ **Fly.io 배포**: 프로덕션 서버 운영 중

## 🏗️ 시스템 구조

```
[로컬 서버]  ←→  [터널 클라이언트]
  :3000            (WebSocket)
                      ↕
              [Fly.io 터널 서버]
               custom-tunnel.fly.dev
                      ↕
                [외부 사용자]
```

### 프로젝트 구조

```
custom-tunnel/
├── server/              # Fly.io 배포 서버
│   ├── index.js         # 터널 서버 (WebSocket + HTTP)
│   ├── Dockerfile       # Docker 이미지
│   └── fly.toml         # Fly.io 설정
├── client/              # 로컬 터널 클라이언트
│   └── index.js         # 로컬 서버 연결
├── dashboard/           # 관리 대시보드
│   ├── server.js        # 대시보드 서버
│   └── public/          # 웹 UI
├── README.md
└── QUICK_START.md       # 빠른 시작 가이드
```

## 🚀 빠른 시작

### 방법 1: 대시보드 사용 (권장)

**1. 의존성 설치**

```bash
cd custom-tunnel/dashboard
npm install
```

**2. 대시보드 실행**

```bash
npm start
```

**3. 브라우저에서 접속**

```
http://localhost:3030
```

**4. 터널 시작**

- 포트 번호 입력 (예: 3000)
- HTTPS 사용 여부 선택
- "🚇 터널 시작" 버튼 클릭

**5. 생성된 URL로 접속**

```
https://custom-tunnel.fly.dev/abc12345
```

### 방법 2: CLI 사용

**1. 클라이언트 의존성 설치**

```bash
cd custom-tunnel/client
npm install
```

**2. 로컬 서버 실행**

```bash
# 예: React 개발 서버
npm start  # http://localhost:3000
```

**3. 터널 클라이언트 실행**

```bash
# HTTP 서버 (기본)
npm start 3000

# HTTPS 서버
npm start 3001 wss://custom-tunnel.fly.dev https
```

**4. 터널 URL 사용**

```
출력된 URL로 접속: https://custom-tunnel.fly.dev/[터널ID]
```

## 💡 사용 예시

### React/Vue/Next.js 개발 서버 공유

```bash
# 1. 개발 서버 실행
npm run dev  # localhost:3000

# 2. 터널 시작 (새 터미널)
cd custom-tunnel/client
npm start 3000

# 3. 모바일이나 다른 기기에서 접속
https://custom-tunnel.fly.dev/abc12345
```

### HTTPS 로컬 서버 공유

```bash
# HTTPS 서버가 localhost:3001에서 실행 중일 때
cd custom-tunnel/client
npm start 3001 wss://custom-tunnel.fly.dev https
```

### 대시보드로 여러 터널 관리

```bash
# 대시보드 실행
cd custom-tunnel/dashboard
npm start

# 브라우저에서 여러 터널을 동시에 관리
http://localhost:3030
```

## 🎯 주요 기능 상세

### 1. 바이너리 파일 지원

**지원 파일 타입:**

- 🖼️ 이미지: JPG, PNG, GIF, WebP, SVG
- 🔠 폰트: WOFF, WOFF2, TTF, OTF
- 🎬 비디오: MP4, WebM
- 🎵 오디오: MP3, WAV, OGG
- 📄 문서: PDF, ZIP

**작동 방식:**

- Content-Type 자동 감지
- Base64 인코딩/디코딩
- 원본 품질 유지

### 2. React Router 자동 지원

**SPA 라우팅 문제 해결:**

```javascript
// 터널 URL: https://custom-tunnel.fly.dev/abc12345/about
// React Router가 /about 경로를 정상 인식
```

**자동으로 처리되는 것:**

- 브라우저 히스토리 API 패치
- 상대 경로 → 절대 경로 변환
- 페이지 새로고침 시 경로 유지

### 3. HTTPS 로컬 서버 지원

**자체 서명 인증서 자동 허용:**

```bash
# Next.js HTTPS 개발 서버
npm run dev -- --experimental-https

# 터널 연결 (인증서 오류 없음)
npm start 3000 wss://custom-tunnel.fly.dev https
```

### 4. 웹 대시보드

**제공 기능:**

- ✅ Fly.io 서버 상태 확인
- ✅ 서버 시작/중지
- ✅ 터널 생성 (포트, HTTPS 설정)
- ✅ 활성 터널 목록
- ✅ QR 코드 생성
- ✅ URL 복사
- ✅ 실시간 상태 업데이트

### 대시보드 포트 변경

`dashboard/server.js`:

```javascript
const PORT = 3030; // 원하는 포트로 변경
```

### 서버 재배포

```bash
cd custom-tunnel/server
flyctl deploy
```

## 시스템 요구사항

- **Node.js**: 18.x 이상
- **OS**: macOS, Linux, Windows
- **네트워크**: 인터넷 연결 필요

## 🤝 기여

이슈나 개선 사항은 GitHub Issues로 제보해주세요.

## 📚 참고 문서

- [QUICK_START.md](./QUICK_START.md) - 빠른 시작 가이드

## 📜 라이선스

MIT License

---

**💡 Tip**: 대시보드(`http://localhost:3030`)를 사용하면 터널 관리가 훨씬 쉽습니다!
