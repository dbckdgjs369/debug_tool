# VS Code 익스텐션 마켓플레이스 게시 가이드

이 가이드는 Custom Tunnel 익스텐션을 Visual Studio Code Marketplace에 게시하는 전체 과정을 안내합니다.

## 📋 사전 준비사항

### 1. Microsoft 계정 생성 (필수)

- [Microsoft 계정](https://account.microsoft.com/) 필요
- 이미 있다면 기존 계정 사용 가능

### 2. Azure DevOps 조직 생성 (필수)

1. [Azure DevOps](https://dev.azure.com/) 접속
2. "Start free" 클릭하여 무료 계정 생성
3. 새 조직(Organization) 생성
   - 조직 이름은 원하는 대로 설정 (예: "custom-tunnel-org")

### 3. Personal Access Token (PAT) 생성 (필수)

1. Azure DevOps에 로그인
2. 오른쪽 상단 사용자 아이콘 클릭 → **"Personal access tokens"** 선택
3. **"+ New Token"** 클릭
4. 토큰 설정:
   - **Name**: `vscode-marketplace` (원하는 이름)
   - **Organization**: "All accessible organizations" 선택
   - **Expiration**: 만료 기간 설정 (최대 1년, Custom date로 더 길게 가능)
   - **Scopes**: "Custom defined" 선택 후 **"Marketplace"** 섹션에서:
     - ✅ **Marketplace: Acquire** (체크)
     - ✅ **Marketplace: Publish** (체크)
     - ✅ **Marketplace: Manage** (체크)
5. **"Create"** 클릭
6. **⚠️ 중요**: 생성된 토큰을 **즉시 복사**하여 안전한 곳에 보관
   - 이 토큰은 다시 확인할 수 없습니다!
   - 분실 시 새로 생성해야 합니다

### 4. Publisher 생성 (필수)

1. [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage) 접속
2. Microsoft 계정으로 로그인
3. **"Create publisher"** 클릭
4. Publisher 정보 입력:
   - **Publisher Name (ID)**: `dbckdgjs369` (이미 package.json에 설정된 것과 동일해야 함)
   - **Display Name**: 원하는 표시 이름 (예: "Custom Tunnel")
   - **Description**: Publisher 설명
5. 생성 완료

## 🔧 익스텐션 준비

### 1. package.json 보완 (권장)

현재 package.json에 다음 필드들을 추가하는 것이 좋습니다:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/dbckdgjs369/debug_tool.git"
  },
  "homepage": "https://github.com/dbckdgjs369/debug_tool#readme",
  "bugs": {
    "url": "https://github.com/dbckdgjs369/debug_tool/issues"
  },
  "license": "MIT",
  "icon": "images/icon.png"
}
```

### 2. 아이콘 추가 (강력 권장)

마켓플레이스에서 더 전문적으로 보이려면 아이콘이 필수입니다:

1. 128x128 픽셀 PNG 이미지 준비
2. 프로젝트 루트에 `images` 폴더 생성
3. 아이콘 파일을 `images/icon.png`로 저장
4. package.json에 `"icon": "images/icon.png"` 추가

### 3. LICENSE 파일 추가 (권장)

```bash
# MIT 라이선스 파일 생성 (예시)
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2026 dbckdgjs369

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

### 4. CHANGELOG.md 생성 (권장)

```bash
cat > CHANGELOG.md << 'EOF'
# Change Log

## [1.0.0] - 2026-01-29

### 초기 릴리즈
- 로컬 서버 터널링 기능
- 실시간 콘솔 모니터링
- QR 코드 생성
- URL 복사 및 공유
- HTTPS 지원
EOF
```

## 📦 빌드 및 패키징

### 1. 프로젝트 빌드

```bash
# 의존성 설치 (아직 안 했다면)
npm install

# TypeScript 컴파일
npm run compile

# 또는 vscode:prepublish 스크립트 실행
npm run vscode:prepublish
```

### 2. VSIX 패키지 생성

```bash
# vsce가 전역으로 설치되지 않았다면
npm install -g @vscode/vsce

# VSIX 파일 생성
vsce package
```

성공하면 `custom-tunnel-1.0.0.vsix` 파일이 생성됩니다.

### 3. 로컬 테스트

게시하기 전에 반드시 로컬에서 테스트하세요:

```bash
# VSIX 파일 설치
code --install-extension custom-tunnel-1.0.0.vsix

# VS Code 재시작 후 익스텐션 테스트
```

## 🚀 마켓플레이스에 게시

### 방법 1: vsce CLI 사용 (권장)

```bash
# Personal Access Token으로 로그인
vsce login dbckdgjs369

# 토큰 입력 프롬프트가 나타나면 복사한 PAT 붙여넣기

# 익스텐션 게시
vsce publish
```

#### 버전 업데이트와 함께 게시

```bash
# 패치 버전 증가 (1.0.0 → 1.0.1)
vsce publish patch

# 마이너 버전 증가 (1.0.0 → 1.1.0)
vsce publish minor

# 메이저 버전 증가 (1.0.0 → 2.0.0)
vsce publish major

# 특정 버전으로 게시
vsce publish 1.2.3
```

### 방법 2: 웹 인터페이스 사용

1. [Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers/dbckdgjs369) 접속
2. Publisher 선택
3. **"+ New extension"** 클릭
4. **"Visual Studio Code"** 선택
5. 생성한 `.vsix` 파일을 드래그 앤 드롭 또는 업로드
6. **"Upload"** 클릭

## ✅ 게시 후 확인

### 1. 마켓플레이스에서 확인

게시 후 몇 분 내로 확인 가능:

- URL: `https://marketplace.visualstudio.com/items?itemName=dbckdgjs369.custom-tunnel`
- VS Code 내 Extensions 탭에서 "Custom Tunnel" 검색

### 2. 설치 테스트

```bash
# 마켓플레이스에서 직접 설치
code --install-extension dbckdgjs369.custom-tunnel
```

## 🔄 업데이트 게시

기존 익스텐션을 업데이트하려면:

1. 코드 수정
2. `package.json`의 `version` 업데이트
3. `CHANGELOG.md`에 변경 사항 추가
4. 빌드 및 테스트
5. 게시:

```bash
# 자동으로 버전 증가 및 게시
vsce publish patch  # 또는 minor, major
```

## 🛠️ 문제 해결

### "Error: Personal Access Token verification failed"

- PAT가 올바른지 확인
- Marketplace 권한이 있는지 확인
- 만료되지 않았는지 확인

### "Error: The publisher 'xxx' is not registered"

- Publisher가 생성되었는지 확인
- package.json의 publisher 이름이 정확한지 확인

### "Error: Make sure to edit the README.md file"

- README.md가 의미 있는 내용을 포함하는지 확인
- 최소 200자 이상 권장

### VSIX 파일이 너무 큼

- `.vscodeignore` 파일에서 불필요한 파일 제외
- `node_modules`의 dev dependencies 확인

## 📊 익스텐션 관리

### 통계 확인

[Publisher Management](https://marketplace.visualstudio.com/manage/publishers/dbckdgjs369)에서:

- 설치 수
- 다운로드 수
- 평점 및 리뷰
- 버전별 통계

### 익스텐션 제거

```bash
vsce unpublish dbckdgjs369.custom-tunnel
```

⚠️ **주의**: 제거는 되돌릴 수 없으므로 신중하게 결정하세요.

## 📚 추가 자료

- [VS Code 익스텐션 게시 공식 가이드](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI 문서](https://github.com/microsoft/vscode-vsce)
- [마켓플레이스 정책](https://aka.ms/vsmarketplace-ToU)

## 🎯 빠른 체크리스트

게시 전 확인사항:

- [ ] Microsoft 계정 생성
- [ ] Azure DevOps 조직 생성
- [ ] Personal Access Token 생성 및 저장
- [ ] Publisher 생성
- [ ] package.json 메타데이터 완성 (repository, icon, license 등)
- [ ] README.md 작성 (상세한 설명 포함)
- [ ] LICENSE 파일 추가
- [ ] CHANGELOG.md 생성
- [ ] 아이콘 이미지 추가 (128x128 PNG)
- [ ] 로컬에서 빌드 및 테스트
- [ ] VSIX 파일 생성
- [ ] VSIX 파일로 로컬 설치 테스트
- [ ] vsce를 통해 게시
- [ ] 마켓플레이스에서 확인

---

**도움이 필요하시면 언제든지 문의하세요!**
