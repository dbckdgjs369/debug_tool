# Cloudflare Tunnel 배포 가이드 (100% 무료)

이 가이드는 Fly.io 대신 자신의 컴퓨터를 서버로 사용하여 **완전 무료**로 터널 서버를 배포하는 방법입니다.

## 장점

✅ **완전 무료** - 카드 등록 불필요  
✅ **HTTPS 자동 적용** - 보안 인증서 자동  
✅ **외부 접속 가능** - 인터넷 어디서든 접속  
✅ **간단한 설정** - 5분이면 완료

## 단점

❌ 컴퓨터를 24시간 켜두어야 함  
❌ 컴퓨터가 꺼지면 서버도 다운  
❌ 재시작 시 URL이 바뀜 (임시 URL 방식)

---

## 1단계: cloudflared 설치

### macOS (Homebrew)

```bash
brew install cloudflare/cloudflare/cloudflared
```

### 설치 확인

```bash
cloudflared --version
```

---

## 2단계: 터널 서버 실행 방법

### 방법 A: 수동 실행 (간단)

**터미널 1 - 터널 서버 실행:**

```bash
cd custom-tunnel/server
node index.js
```

**터미널 2 - Cloudflare Tunnel 실행:**

```bash
cloudflared tunnel --url http://localhost:8080
```

실행하면 이런 식으로 URL이 생성됩니다:

```
https://random-name-1234.trycloudflare.com
```

이 URL로 외부에서 접속할 수 있습니다!

### 방법 B: 자동 실행 스크립트 (편리)

`start-cloudflare.sh` 스크립트를 사용:

```bash
cd custom-tunnel
chmod +x start-cloudflare.sh
./start-cloudflare.sh
```

종료하려면: `Ctrl + C`

---

## 3단계: 사용 방법

### 1. Dashboard 접속

```
https://your-tunnel-url.trycloudflare.com/dashboard
```

Dashboard에서 터널 상태를 실시간으로 모니터링할 수 있습니다.

### 2. 터널 클라이언트 실행

```bash
cd custom-tunnel/client
node index.js 5173 wss://your-tunnel-url.trycloudflare.com
```

**주의:** `wss://` 사용 (HTTPS이므로 WebSocket도 secure)

### 3. 로컬 앱 공유

터널 클라이언트가 생성한 URL로 로컬 앱을 전 세계와 공유할 수 있습니다!

---

## 4단계: 고정 URL 설정 (선택사항)

임시 URL 대신 고정 URL을 원하면:

### Cloudflare 계정 생성 (무료)

1. https://dash.cloudflare.com 가입
2. 무료 도메인 또는 본인 도메인 연결
3. Cloudflare Tunnel 설정에서 Named Tunnel 생성
4. 고정 URL 할당

**설정 방법:**

```bash
# 1. Cloudflare 로그인
cloudflared tunnel login

# 2. Named Tunnel 생성
cloudflared tunnel create my-tunnel

# 3. 설정 파일 생성
# config.yml 작성 (예제는 아래 참고)

# 4. Named Tunnel 실행
cloudflared tunnel run my-tunnel
```

**config.yml 예제:**

```yaml
tunnel: <tunnel-id>
credentials-file: ~/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: tunnel.yourdomain.com
    service: http://localhost:8080
  - service: http_status:404
```

---

## 백그라운드 실행 (선택사항)

### macOS/Linux - screen 사용

```bash
# screen 세션 시작
screen -S tunnel

# 터널 서버 + Cloudflare 실행
cd custom-tunnel
./start-cloudflare.sh

# 세션에서 나가기: Ctrl + A, D
# 다시 돌아오기: screen -r tunnel
```

### macOS - launchd 사용

시스템 재시작 시 자동 실행하려면 launchd plist 파일 생성 가능

---

## 문제 해결

### 포트 충돌

```bash
# 8080 포트를 사용하는 프로세스 찾기
lsof -i :8080

# 프로세스 종료
kill -9 <PID>
```

### Cloudflare Tunnel 연결 실패

```bash
# cloudflared 재설치
brew reinstall cloudflare/cloudflare/cloudflared

# 방화벽 확인
# 시스템 환경설정 > 보안 및 개인 정보 보호 > 방화벽
```

### URL이 계속 바뀜

- 임시 URL 방식(`--url`)은 매번 새로운 URL 생성
- 고정 URL을 원하면 Named Tunnel 설정 필요

---

## 비교: Fly.io vs Cloudflare Tunnel

| 항목        | Fly.io              | Cloudflare Tunnel               |
| ----------- | ------------------- | ------------------------------- |
| 비용        | 무료 티어 제한 있음 | 완전 무료                       |
| 24시간 운영 | ✅ 자동             | ❌ 컴퓨터 켜두어야 함           |
| URL         | 고정                | 임시 (Named Tunnel로 고정 가능) |
| 설정        | 배포 필요           | 실행만 하면 됨                  |
| 성능        | CDN, 글로벌         | 로컬 네트워크 속도              |

---

## 추가 팁

### Dashboard 로컬 실행

```bash
cd custom-tunnel/dashboard
npm start
```

→ http://localhost:3030 에서 Dashboard 사용  
→ Fly.io 서버 제어 기능 포함

### 여러 터널 동시 실행

```bash
# 터미널 1: Server 1 (포트 8080)
cd custom-tunnel/server
PORT=8080 node index.js

# 터미널 2: Cloudflare Tunnel 1
cloudflared tunnel --url http://localhost:8080

# 터미널 3: Server 2 (포트 8081)
PORT=8081 node index.js

# 터미널 4: Cloudflare Tunnel 2
cloudflared tunnel --url http://localhost:8081
```

---

## 다음 단계

1. ✅ cloudflared 설치
2. ✅ 터널 서버 실행
3. ✅ Cloudflare Tunnel 실행
4. ✅ 생성된 URL로 접속 테스트
5. ✅ 터널 클라이언트로 로컬 앱 공유

궁금한 점이 있으면 TROUBLESHOOTING.md를 참고하세요!
