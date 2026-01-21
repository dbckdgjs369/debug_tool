# Render 배포 가이드 🚀

Render.com에 무료로 터널 서버를 배포하는 방법입니다.

---

## 준비사항

- GitHub 계정
- Render.com 계정 (GitHub로 가입 가능)

---

## Step 1: GitHub에 푸시

```bash
# 현재 디렉토리에서
git add .
git commit -m "Add custom tunnel server"
git push origin main
```

---

## Step 2: Render 가입 및 배포

### 1. Render.com 접속

```
https://render.com
```

### 2. Sign Up (GitHub로 가입 추천)

```
Sign in with GitHub 클릭
→ 권한 허용
```

### 3. New Web Service 생성

```
Dashboard → New → Web Service
```

### 4. Repository 연결

```
1. "Connect a repository" 섹션에서
2. 당신의 GitHub 저장소 찾기 (debug_tool)
3. "Connect" 클릭
```

### 5. 서비스 설정

```yaml
Name: custom-tunnel-server
Region: Singapore (가장 가까운 지역)
Branch: main
Root Directory: custom-tunnel/server
Runtime: Node
Build Command: npm install
Start Command: npm start
Plan: Free
```

### 6. Environment Variables (선택사항)

```
PORT: 10000 (자동 설정됨)
NODE_ENV: production
```

### 7. Create Web Service 클릭!

---

## Step 3: 배포 완료 대기

```
배포 로그 확인:
✓ Installing dependencies...
✓ Building...
✓ Starting server...
✓ Deploy live at https://custom-tunnel-server-xxxx.onrender.com
```

**배포 완료! 🎉**

---

## Step 4: URL 확인 및 테스트

### URL 복사

```
Dashboard에서 URL 확인:
https://custom-tunnel-server-xxxx.onrender.com
```

### 브라우저에서 테스트

```
위 URL 접속 시:
┌────────────────────────────────┐
│ 🚇 Custom Tunnel Server        │
│ 활성 터널: 0개                  │
│ 대기 중인 요청: 0개             │
└────────────────────────────────┘
```

**서버 정상 작동!** ✅

---

## Step 5: VS Code 익스텐션에서 사용

### 방법 1: tunnelManager.ts 수정

```typescript
// src/tunnelManager.ts 파일에서
const args = [
  this.clientPath,
  port.toString(),
  "wss://custom-tunnel-server-xxxx.onrender.com", // ← 여기!
];
```

### 방법 2: 환경 변수 사용

```typescript
// src/tunnelManager.ts
const TUNNEL_SERVER =
  process.env.TUNNEL_SERVER || "wss://custom-tunnel-server-xxxx.onrender.com";

const args = [this.clientPath, port.toString(), TUNNEL_SERVER];
```

---

## Render 무료 플랜 제한

### ✅ 포함 사항

- 750시간/월 (충분함)
- 자동 HTTPS
- 무제한 대역폭

### ⚠️ 제한 사항

- 15분 비활성 시 슬립 모드
- 첫 요청 시 30초 웜업 시간
- 월 750시간 초과 시 중지

### 💡 슬립 해결 방법

```javascript
// 5분마다 핑 (선택사항)
setInterval(() => {
  fetch("https://custom-tunnel-server-xxxx.onrender.com");
}, 5 * 60 * 1000);
```

---

## 배포 후 확인 사항

### 1. 서버 상태 확인

```bash
curl https://custom-tunnel-server-xxxx.onrender.com
# 응답이 오면 OK
```

### 2. WebSocket 테스트

```bash
# wscat 설치 (선택)
npm install -g wscat

# WebSocket 연결 테스트
wscat -c wss://custom-tunnel-server-xxxx.onrender.com
```

### 3. 터널 클라이언트 테스트

```bash
cd custom-tunnel/client
node index.js 3000 wss://custom-tunnel-server-xxxx.onrender.com
```

---

## 문제 해결

### 배포 실패 시

```
Render Dashboard → Logs 확인
- npm install 오류: package.json 확인
- 포트 오류: PORT 환경변수 확인
- 시작 오류: index.js 경로 확인
```

### 서버 느림

```
무료 플랜은 슬립 모드 있음
→ 첫 요청 시 30초 대기 정상
→ 이후 빠름
```

### WebSocket 연결 실패

```
- wss:// 사용하는지 확인 (ws:// 아님)
- URL 끝에 슬래시(/) 없는지 확인
- Render 로그에서 WebSocket 오류 확인
```

---

## 다음 단계

1. ✅ Render 배포 완료
2. 📝 URL을 VS Code 익스텐션에 설정
3. 🧪 터널 테스트
4. 🎉 팀원들과 공유!

---

## 유용한 링크

- Render Dashboard: https://dashboard.render.com
- Render Docs: https://render.com/docs
- WebSocket 가이드: https://render.com/docs/web-services#websocket-support

---

## 비용

**완전 무료!** 💰

- 신용카드 필요 없음
- 월 750시간 무료
- 이후 자동 중지 (과금 없음)

---

**배포 완료 후 VS Code에서 F5를 눌러 테스트하세요!** 🚀
