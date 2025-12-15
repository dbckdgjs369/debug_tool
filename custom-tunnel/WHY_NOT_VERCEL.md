# 🤔 왜 Vercel로 배포하면 안 되나요?

## TL;DR

**Vercel은 터널 서버 배포에 부적합합니다** ❌

- ❌ WebSocket 지속 연결 불가 (Serverless 제한)
- ❌ 최대 실행 시간 제한 (무료: 10초, Pro: 60초)
- ❌ Stateful 서버 불가능 (터널 상태 유지 필요)

**하지만 다른 무료 옵션들이 있습니다!** ✅

---

## 🎯 Custom Tunnel이 VPS가 필요한 이유

### 1. 지속적인 WebSocket 연결 필요

```
[로컬 클라이언트] ←→ WebSocket (계속 연결됨!) ←→ [터널 서버]
```

- 터널 클라이언트는 터널 서버와 **24/7 WebSocket 연결**을 유지해야 합니다
- 외부 사용자 요청이 들어오면 이 WebSocket을 통해 즉시 전달
- **연결이 끊기면 터널이 작동하지 않습니다**

### 2. Stateful 서버 필요

```javascript
// 서버에서 터널 연결 상태를 메모리에 저장
const tunnels = new Map();
tunnels.set("abc12345", websocketConnection);
```

- 어떤 터널 ID가 어떤 클라이언트와 연결되어 있는지 기억해야 함
- Serverless는 요청마다 새로운 인스턴스가 생성되므로 상태 유지 불가

---

## ❌ Vercel의 제한사항

### Vercel Serverless Functions

| 항목             | 제한                             | 터널 서버 요구사항    |
| ---------------- | -------------------------------- | --------------------- |
| **실행 시간**    | 무료: 10초, Pro: 60초            | 무제한 (24/7)         |
| **WebSocket**    | 제한적 (실행 시간 내에만)        | 지속적 연결 필요      |
| **Stateful**     | 불가능 (매 요청마다 새 인스턴스) | 연결 상태 메모리 유지 |
| **Long-running** | 불가능                           | 필수                  |

### Vercel Edge Functions

- WebSocket 미지원
- 실행 시간: 30초 제한
- 여전히 Stateful 불가능

---

## ✅ 대안: 무료로 배포 가능한 플랫폼

### 1. Railway.app (추천 🌟)

```bash
npm install -g @railway/cli
railway login
cd custom-tunnel/server
railway init
railway up
```

**장점:**

- ✅ WebSocket 완전 지원
- ✅ 지속적 실행 가능
- ✅ 무료 월 $5 크레딧 (약 500시간)
- ✅ 자동 HTTPS/WSS
- ✅ 배포 매우 간단

**단점:**

- ⚠️ 무료 크레딧 소진 후 중지
- ⚠️ 비활성 시 슬립 없음 (항상 실행 = 크레딧 소모)

### 2. Fly.io

```bash
flyctl launch
flyctl deploy
```

**장점:**

- ✅ WebSocket 지원
- ✅ 무료 3개 VM (256MB)
- ✅ 전 세계 리전

**단점:**

- ⚠️ 메모리 제한 (256MB)
- ⚠️ 신용카드 필요

### 3. Render.com

**장점:**

- ✅ WebSocket 지원
- ✅ 무료 티어 있음
- ✅ 자동 HTTPS

**단점:**

- ❌ 15분 비활성 시 슬립 모드
- ❌ 슬립 해제에 ~30초 소요
- ❌ **터널에 치명적!** (연결 끊김)

### 4. Oracle Cloud Always Free (최고 추천! 🏆)

**장점:**

- ✅ **완전 무료 영구 사용**
- ✅ 실제 VPS (VM)
- ✅ 제한 없음
- ✅ 2개 VM 평생 무료

**단점:**

- ⚠️ 초기 설정이 약간 복잡
- ⚠️ 방화벽 설정 필요

---

## 📊 플랫폼 비교

| 플랫폼           | WebSocket | 24/7 실행 | 무료 기간 | 슬립 모드 | 추천도     |
| ---------------- | --------- | --------- | --------- | --------- | ---------- |
| **Vercel**       | ❌ 제한적 | ❌        | 영구      | -         | ❌         |
| **Railway**      | ✅        | ✅        | $5/월     | 없음      | ⭐⭐⭐     |
| **Fly.io**       | ✅        | ✅        | 영구      | 없음      | ⭐⭐⭐     |
| **Render**       | ✅        | ⚠️        | 영구      | 15분 후   | ⭐         |
| **Oracle Cloud** | ✅        | ✅        | 영구      | 없음      | ⭐⭐⭐⭐⭐ |
| **Heroku**       | ✅        | ⚠️        | 없음      | 30분 후   | ❌         |

---

## 🔧 간단한 배포 옵션 (Railway)

Railway가 가장 쉽습니다:

### 1. Railway 배포 (3분)

```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login

# 프로젝트 초기화
cd custom-tunnel/server
railway init

# 배포
railway up

# 자동으로 도메인 생성됨!
# 예: https://custom-tunnel-production.up.railway.app
```

### 2. 클라이언트 연결

```bash
# HTTP URL을 WSS로 변경
# https:// → wss://
cd custom-tunnel/client
node index.js 3000 wss://custom-tunnel-production.up.railway.app
```

---

## 💰 비용 비교

### 개발/테스트용

| 옵션    | 월 비용 | 특징                      |
| ------- | ------- | ------------------------- |
| Railway | $0-5    | 간단, 크레딧 소진 시 중지 |
| Fly.io  | $0      | 무료 영구 사용 가능       |
| Render  | $0      | 슬립 모드 있음 (비추천)   |

### 프로덕션용

| 옵션         | 월 비용          | 특징                |
| ------------ | ---------------- | ------------------- |
| Oracle Cloud | **$0**           | 평생 무료! 🏆       |
| DigitalOcean | $6               | 안정적              |
| AWS EC2      | $8 (t2.micro 후) | 12개월 무료 후 유료 |

---

## 🎯 추천 시나리오

### 빠르게 테스트하고 싶다면

👉 **Railway.app** (3분 배포)

```bash
railway login
cd custom-tunnel/server
railway up
```

### 장기적으로 무료로 사용하고 싶다면

👉 **Oracle Cloud** (30분 설정, 평생 무료)

- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) 참고

### 가장 쉽게 무료로 사용하고 싶다면

👉 **Fly.io** (10분 배포, 무료)

```bash
flyctl launch
flyctl deploy
```

---

## 🤔 자주 묻는 질문

**Q: 그럼 Vercel은 아예 못 쓰나요?**  
A: Vercel은 정적 사이트, Next.js 앱, API Routes에는 최고입니다. 하지만 지속적인 WebSocket 연결이 필요한 터널 서버에는 부적합합니다.

**Q: Vercel + 외부 WebSocket 서버를 조합하면?**  
A: 가능하지만, 그럼 WebSocket 서버를 어딘가에 배포해야 하는데... 결국 VPS나 다른 플랫폼이 필요합니다. 😅

**Q: Next.js API Routes로 WebSocket 만들 수 없나요?**  
A: Vercel의 Serverless Functions는 실행 시간 제한이 있어서 지속적인 WebSocket 연결을 유지할 수 없습니다.

**Q: 그럼 왜 다른 사람들은 Vercel에 WebSocket 배포했다고 하나요?**  
A: 대부분은:

1. 짧은 시간 동안만 연결 유지 (채팅 앱 등)
2. Edge Runtime 사용 (여전히 30초 제한)
3. 실제로는 외부 WebSocket 서버 사용

**Q: Railway $5 크레딧은 얼마나 가나요?**  
A:

- 메모리 1GB 서버: 약 500시간 (20일)
- 메모리 512MB 서버: 약 1000시간 (41일)
- **추천:** Oracle Cloud 무료 사용

---

## 📚 관련 문서

- [⚡ QUICK_DEPLOY.md](./QUICK_DEPLOY.md) - Oracle Cloud 10분 배포
- [🌩️ ORACLE_CLOUD_GUIDE.md](./ORACLE_CLOUD_GUIDE.md) - 상세 가이드
- [🚀 DEPLOYMENT.md](./DEPLOYMENT.md) - 모든 배포 옵션

---

## 요약

**Vercel로는 안 되는 이유:**

1. ❌ WebSocket 지속 연결 불가
2. ❌ 실행 시간 제한 (10초-60초)
3. ❌ Stateful 서버 불가능

**추천 대안:**

1. 🥇 **Oracle Cloud** - 완전 무료 영구 사용
2. 🥈 **Railway** - 가장 쉬운 배포
3. 🥉 **Fly.io** - 무료 + 간단

**결론:** 터널 서버는 **24/7 실행되는 Stateful 서버**가 필요하므로, Vercel 같은 Serverless 플랫폼으로는 구현할 수 없습니다. 대신 Oracle Cloud, Railway, Fly.io 등을 사용하세요! 🚀
