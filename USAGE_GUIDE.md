# Remote Debug Tunnel 사용 가이드

## 익스텐션 설치 및 테스트

### 1. 개발 모드로 익스텐션 실행하기

#### 방법 1: VS Code에서 직접 실행

1. VS Code에서 이 프로젝트 폴더를 엽니다
2. `F5` 키를 누르거나 "실행 > 디버깅 시작"을 선택합니다
3. 새로운 VS Code 창(Extension Development Host)이 열립니다
4. 새 창에서 익스텐션을 사용할 수 있습니다

#### 방법 2: 명령어로 실행

```bash
cd /Users/yoochangheon/debug_tool
code --extensionDevelopmentPath=$(pwd)
```

### 2. 익스텐션 사용 예제

#### 예제 1: React 앱을 모바일에서 테스트하기

1. **React 앱 실행**

   ```bash
   # 다른 터미널에서
   npx create-react-app my-test-app
   cd my-test-app
   npm start
   # 포트 3000에서 실행됨
   ```

2. **터널 시작**

   - VS Code에서 `Cmd+Shift+P` (Mac) 또는 `Ctrl+Shift+P` (Windows/Linux)
   - `Remote Debug: 터널 시작` 입력 및 실행
   - 포트 번호: `3000` 입력
   - 서브도메인: 원하는 이름 입력 또는 Enter로 건너뛰기

3. **외부에서 접근**

   - 생성된 URL을 복사 (예: `https://your-app-xyz.loca.lt`)
   - 모바일 기기 브라우저에서 해당 URL 열기
   - QR 코드를 생성하여 모바일에서 스캔할 수도 있습니다

4. **터널 종료**
   - `Cmd+Shift+P` → `Remote Debug: 터널 중지`

#### 예제 2: Next.js 앱 디버깅

```bash
# Next.js 앱 실행
npx create-next-app@latest my-next-app
cd my-next-app
npm run dev
# 포트 3000에서 실행됨

# VS Code에서 터널 시작 (위와 동일)
```

#### 예제 3: 커스텀 포트 사용

```bash
# 포트 8080에서 서버 실행
python3 -m http.server 8080

# VS Code에서 터널 시작
# 포트: 8080 입력
```

### 3. 익스텐션 패키징 및 설치

#### VSIX 파일 생성

```bash
# vsce 설치 (한 번만 실행)
npm install -g @vscode/vsce

# VSIX 파일 생성
cd /Users/yoochangheon/debug_tool
vsce package
# remote-debug-tunnel-0.0.1.vsix 파일 생성됨
```

#### VSIX 파일 설치

1. VS Code에서 `Cmd+Shift+P` (Mac) 또는 `Ctrl+Shift+P` (Windows/Linux)
2. `Extensions: Install from VSIX...` 입력
3. 생성된 `.vsix` 파일 선택
4. VS Code 재시작

### 4. 상태 바 사용하기

익스텐션이 활성화되면 VS Code 하단 상태 바에 `$(globe) 터널: 꺼짐` 아이콘이 나타납니다.

- **터널 꺼짐 상태**: 클릭하면 터널 시작 옵션 표시
- **터널 켜짐 상태**: 클릭하면 URL 및 관리 옵션 표시

### 5. 설정 변경하기

VS Code 설정에서 다음을 구성할 수 있습니다:

1. `Cmd+,` (Mac) 또는 `Ctrl+,` (Windows/Linux)로 설정 열기
2. "Remote Debug Tunnel" 검색
3. 설정 변경:
   - **Default Port**: 기본 포트 번호 (기본값: 3000)
   - **Auto Start**: 워크스페이스 열 때 자동 시작 (기본값: false)

또는 `settings.json`에 직접 추가:

```json
{
  "remoteDebugTunnel.defaultPort": 8080,
  "remoteDebugTunnel.autoStart": false
}
```

### 6. 문제 해결

#### 터널 생성 실패

- 포트가 이미 사용 중인지 확인
- 로컬 서버가 실행 중인지 확인
- 방화벽 설정 확인

#### ⚠️ 터널 비밀번호가 필요할 때

localtunnel을 사용하면 **첫 접속 시 터널 비밀번호 입력 페이지**가 나타납니다. 이는 정상적인 동작입니다.

**터널 비밀번호란?**

- 터널 비밀번호는 **localtunnel 클라이언트를 실행하는 컴퓨터의 공개 IP 주소**입니다
- 이 확장 프로그램은 자동으로 공개 IP를 조회하여 알려줍니다
- 터널 생성 시 "URL+비밀번호 복사" 버튼을 클릭하면 URL과 비밀번호를 함께 복사할 수 있습니다

**해결 방법:**

1. 터널을 시작하면 메시지에 **터널 비밀번호(공개 IP)**가 표시됩니다
2. "URL+비밀번호 복사" 버튼을 클릭하여 URL과 비밀번호를 함께 복사하세요
3. 다른 사람과 공유할 때는 URL과 비밀번호를 모두 전달하세요
4. 접속 시 비밀번호 입력 페이지에서 받은 공개 IP를 입력하고 "Click to Submit" 버튼을 클릭하세요

**예시:**

```
터널 URL: https://agent.loca.lt
터널 비밀번호: 123.456.78.90

다른 사람에게 전달:
"https://agent.loca.lt 에 접속하시고,
비밀번호는 123.456.78.90 입니다"
```

**참고:**

- 본인이 로컬 컴퓨터에서 같은 네트워크의 브라우저로 접속하면 비밀번호 없이 바로 접속됩니다
- 다른 네트워크나 다른 사람이 접속할 때만 비밀번호가 필요합니다
- 이는 localtunnel의 보안 기능으로, 악의적인 사용을 방지하기 위한 것입니다
- 공개 IP는 동적으로 변경될 수 있으므로, 재접속 시 다시 확인이 필요할 수 있습니다

#### 연결 속도가 느림

- 터널 서비스는 프록시를 통해 작동하므로 약간의 지연이 있을 수 있습니다
- 프로덕션 환경에서는 사용하지 마세요

### 7. 실전 활용 시나리오

#### 모바일 반응형 테스트

```bash
# 웹 앱 실행
npm start

# 터널 시작
# VS Code: Remote Debug: 터널 시작 → 포트 3000

# 생성된 URL을 모바일 기기에서 테스트
# - iPhone Safari
# - Android Chrome
# - 태블릿 등
```

#### 팀원과 공유

```bash
# 로컬 개발 서버 실행
npm run dev

# 터널 시작 (서브도메인 지정)
# VS Code: Remote Debug: 터널 시작
# 포트: 3000
# 서브도메인: my-feature-demo

# 생성된 URL을 팀원과 공유
# https://my-feature-demo.loca.lt
```

#### 외부 API 웹훅 테스트

```bash
# 웹훅을 받을 서버 실행
node webhook-server.js  # 포트 4000

# 터널 시작
# VS Code: Remote Debug: 터널 시작 → 포트 4000

# 생성된 URL을 외부 서비스의 웹훅 URL로 등록
# 예: https://your-webhook-abc.loca.lt/webhook
```

## 보안 주의사항

⚠️ **주의**: 이 익스텐션은 로컬 서버를 인터넷에 공개합니다.

- 개발 목적으로만 사용하세요
- 민감한 데이터가 있는 환경에서는 사용하지 마세요
- 사용 후 반드시 터널을 중지하세요
- 프로덕션 환경에서는 절대 사용하지 마세요

## 유용한 팁

1. **QR 코드 활용**: "QR 코드 생성" 버튼을 클릭하면 모바일에서 스캔하기 쉬운 QR 코드가 생성됩니다

2. **URL 복사**: "URL 복사" 버튼으로 빠르게 클립보드에 복사할 수 있습니다

3. **여러 포트 사용**: 동시에 여러 터널을 실행할 수는 없지만, 하나를 중지하고 다른 포트로 새로 시작할 수 있습니다

4. **커스텀 서브도메인**: 서브도메인을 지정하면 기억하기 쉬운 URL을 만들 수 있습니다 (사용 가능한 경우)

## 다음 단계

- 익스텐션을 마켓플레이스에 퍼블리시하기
- 추가 기능 개발 (멀티 터널 지원 등)
- 이슈 리포트 및 기여

즐거운 디버깅 되세요! 🚀
