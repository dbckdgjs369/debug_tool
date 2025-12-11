# 터널 디버깅 가이드

## Pending/Timeout 문제 해결

### 1. 클라이언트 로그 확인

터널 클라이언트 터미널에서 다음을 확인하세요:

```
📥 요청 받음: GET /locales/ko/translation.json
📤 응답 전송: 200 GET /locales/ko/translation.json
```

#### 요청은 받았지만 응답이 없는 경우

- 로컬 서버(3001)가 응답하지 않음
- 로컬 서버에서 직접 확인: `curl https://localhost:3001/locales/ko/translation.json -k`

#### 로그가 아예 없는 경우

- 터널 클라이언트가 요청을 받지 못함
- 쿠키 문제일 가능성: 브라우저에서 쿠키 확인

### 2. 직접 테스트

```bash
# 로컬 서버 직접 테스트
curl -k https://localhost:3001/locales/ko/translation.json

# 터널을 통한 테스트
curl http://localhost:8080/{tunnel-id}/locales/ko/translation.json
```

### 3. 타임아웃 증가

현재 타임아웃: 25초 (클라이언트), 30초 (서버)

긴 요청이 필요한 경우 `custom-tunnel/client/index.js` 수정:

```javascript
timeout: 60000, // 60초로 증가
```

### 4. 상세 로깅 추가

클라이언트 코드에 로깅 추가:

```javascript
console.log(`📥 요청 받음: ${method} ${url}`);
console.log(`   헤더:`, cleanHeaders);

// 응답 후
console.log(`📤 응답 전송: ${response.status}`);
console.log(`   크기: ${responseBody.length} bytes`);
```

### 5. 일반적인 원인

#### A. 로컬 서버 응답 없음

```bash
# 로컬 서버 로그 확인
# 3001 포트 프로세스 상태 확인
lsof -i:3001
```

#### B. CORS 문제

로컬 서버가 CORS 헤더를 보내지 않는 경우

#### C. 파일이 실제로 존재하지 않음

```bash
# 파일 경로 확인 (프로젝트 루트에서)
ls -la public/locales/ko/translation.json
```

#### D. 대용량 파일

매우 큰 JSON 파일은 처리 시간이 오래 걸림

### 6. 임시 해결 방법

#### 특정 경로 제외

문제되는 리소스를 로컬에서 직접 로드:

- 로컬 서버(https://localhost:3001)에서 직접 접근
- 또는 CDN 사용

#### 타임아웃 무시

중요하지 않은 리소스라면 무시하고 진행

### 7. 재시작

```bash
# 1. 모든 프로세스 중지
pkill -f "node index.js"

# 2. 서버 재시작
cd custom-tunnel/server
npm start

# 3. 클라이언트 재시작 (로그 확인 가능하도록)
cd custom-tunnel/client
node index.js 3001 ws://localhost:8080 https

# 4. 브라우저 새로고침 (캐시 완전 삭제)
Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
```

### 8. 브라우저 개발자 도구 확인

1. F12 → Network 탭
2. 실패한 요청 클릭
3. Headers, Response, Timing 탭 확인
4. 오류 메시지 확인

**Timing 탭에서:**

- Stalled: 요청이 대기열에 있음
- Waiting (TTFB): 서버 응답 대기 중
- Content Download: 다운로드 중

Waiting이 길면 → 서버/클라이언트 처리 시간 문제
Stalled가 길면 → 브라우저 연결 제한

### 9. 문제가 계속되면

1. 터널 서버 로그 확인
2. 터널 클라이언트 로그 확인
3. 로컬 서버(3001) 로그 확인
4. 브라우저 콘솔 로그 확인

모든 로그를 함께 보면 어디서 멈췄는지 알 수 있습니다.
