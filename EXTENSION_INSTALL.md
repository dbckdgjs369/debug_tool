# VS Code 익스텐션 설치 가이드 📦

VSIX 파일 생성 없이 바로 사용할 수 있는 방법입니다!

---

## 방법 1: 개발 모드로 사용 (가장 간단) ⭐

### 현재 VS Code에서 바로 실행

```bash
1. 현재 VS Code에서 F5 누르기
2. 새 VS Code 창이 열림 (Extension Development Host)
3. 좌측 사이드바에서 🌐 (Custom Tunnel) 클릭
4. 터널 시작!
```

**장점:**

- ✅ 즉시 사용 가능
- ✅ 수정 후 바로 테스트
- ✅ 아무 설정 필요 없음

**단점:**

- ⚠️ 다른 프로젝트에서 사용 불가
- ⚠️ 매번 F5로 실행해야 함

---

## 방법 2: VSIX 파일 생성 (권장)

### Node 버전 업그레이드 후 생성

```bash
# 1. Node 버전 확인
node --version
# 현재: v16.19.0
# 필요: v20 이상

# 2. nvm으로 Node 20 설치
nvm install 20
nvm use 20

# 3. VSIX 생성
npx @vscode/vsce package

# 결과:
# ✅ custom-tunnel-1.0.0.vsix 생성!
```

### VSIX 설치

```bash
1. VS Code 열기
2. Extensions (Cmd+Shift+X)
3. ... (더보기) 클릭
4. "Install from VSIX..." 선택
5. custom-tunnel-1.0.0.vsix 선택
6. 설치 완료!
```

---

## 방법 3: GitHub에서 다운로드 (팀 공유)

### GitHub Release 만들기

```bash
# 1. VSIX 생성 (위 방법 2)
npx @vscode/vsce package

# 2. GitHub에 커밋
git add custom-tunnel-1.0.0.vsix
git commit -m "Add extension package"
git push

# 3. GitHub Release 생성
# https://github.com/dbckdgjs369/debug_tool/releases
# - "Create new release"
# - custom-tunnel-1.0.0.vsix 업로드
# - Publish!

# 4. 팀원들이 다운로드
# - Release 페이지에서 .vsix 다운로드
# - VS Code에 설치
```

---

## 방법 4: 수동 설치 (현재 가능)

컴파일된 파일을 직접 복사하는 방법:

```bash
# 1. VS Code 익스텐션 폴더 위치
macOS: ~/.vscode/extensions/
Windows: %USERPROFILE%\.vscode\extensions\
Linux: ~/.vscode/extensions/

# 2. 폴더 생성
mkdir ~/.vscode/extensions/custom-tunnel-1.0.0

# 3. 필요한 파일 복사
cd /Users/yoochangheon/debug_tool
cp -r out package.json node_modules ~/.vscode/extensions/custom-tunnel-1.0.0/

# 4. VS Code 재시작
# Cmd+Shift+P → "Reload Window"

# 5. 좌측 사이드바에서 🌐 확인!
```

---

## 추천 순서

### 지금 당장 사용하려면:

```
👉 방법 1: F5로 개발 모드 실행
```

### 팀원과 공유하려면:

```
1️⃣ Node 20으로 업그레이드
2️⃣ VSIX 생성 (방법 2)
3️⃣ GitHub Release (방법 3)
4️⃣ 팀원들이 다운로드 설치
```

### Node 업그레이드 안 하고 싶으면:

```
👉 방법 4: 수동 복사
(하지만 번거로움)
```

---

## Node 버전 업그레이드 방법

### nvm 사용 중이면:

```bash
# Node 20 설치
nvm install 20

# Node 20으로 전환
nvm use 20

# 확인
node --version
# v20.x.x

# VSIX 생성
npx @vscode/vsce package
```

### nvm 없으면:

```bash
# nvm 설치
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 터미널 재시작 후
nvm install 20
nvm use 20
```

---

## VSIX 파일 생성 후

### 설치 방법

```
방법 A: VS Code UI
1. Cmd+Shift+X (Extensions)
2. ... 클릭
3. "Install from VSIX..."
4. custom-tunnel-1.0.0.vsix 선택

방법 B: 명령어
code --install-extension custom-tunnel-1.0.0.vsix
```

### 확인

```
1. 좌측 사이드바에서 🌐 아이콘 확인
2. 클릭하면 Custom Tunnel 패널 열림
3. 포트 입력 → 터널 시작!
```

---

## 문제 해결

### "Extension not found" 에러

```
→ VS Code 재시작
→ Cmd+Shift+P → "Reload Window"
```

### 아이콘이 안 보임

```
→ View → Appearance → Activity Bar 체크
→ 좌측 사이드바 확인
```

### 터널이 안 생김

```
→ Render 서버 확인: https://debug-tool.onrender.com
→ 30초 대기 (서버 웜업)
→ 재시도
```

---

## 현재 상황

```
✅ 코드 완성
✅ 컴파일 완료
✅ Render 서버 배포 완료
⚠️ Node v16 → VSIX 생성 불가

해결책:
1. F5로 개발 모드 사용 (지금 바로!)
2. Node 20으로 업그레이드 후 VSIX 생성
3. 수동 설치
```

---

## 요약

### 지금 바로 사용:

```bash
# VS Code에서
F5 → 새 창 열림 → 좌측 🌐 클릭 → 터널 시작!
```

### 정식 설치:

```bash
# Node 20 설치
nvm install 20
nvm use 20

# VSIX 생성
npx @vscode/vsce package

# 설치
Extensions → ... → Install from VSIX
```

---

**제일 간단한 방법: 지금 F5 눌러서 사용하세요!** 🚀
