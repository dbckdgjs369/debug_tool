# 테스트 배포 가이드

## 🧪 develop 브랜치 테스트 배포

### 방법 1: Render.com에서 새 테스트 서비스 생성 (권장)

1. **Render.com Dashboard** 접속
2. **New +** → **Web Service** 클릭
3. GitHub 저장소 연결: `dbckdgjs369/debug_tool`
4. 설정:
   - **Name**: `custom-tunnel-server-dev` (또는 원하는 이름)
   - **Branch**: `develop` 선택
   - **Root Directory**: `custom-tunnel/server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `PORT`: `10000`

5. **Create Web Service** 클릭

### 방법 2: 기존 서비스 브랜치 임시 변경

⚠️ **주의**: 프로덕션 사용자에게 영향을 줄 수 있음!

1. Render.com Dashboard에서 기존 서비스 선택
2. **Settings** → **Branch** 섹션
3. 브랜치를 `develop`로 변경
4. 자동으로 재배포됨
5. 테스트 완료 후 다시 `main`으로 변경

### 방법 3: 로컬에서 테스트

```bash
# 터널 서버 로컬 실행
cd /Users/yoochangheon/debug_tool/custom-tunnel/server
npm install
npm start

# VS Code Extension에서 로컬 서버(http://localhost:8080) 사용
```

## 📋 테스트 체크리스트

테스트 서버 배포 후:

- [ ] VS Code Extension에서 새 테스트 서버 URL로 연결 설정
- [ ] user-admin (포트 3200) 터널 생성
- [ ] 터널 URL로 접속
- [ ] 로고 SVG가 정상적으로 표시되는지 확인
- [ ] 브라우저 콘솔에 에러가 없는지 확인
- [ ] 다른 기능들도 정상 작동하는지 확인

## ✅ 테스트 성공 후

```bash
# main 브랜치로 머지
git checkout main
git merge develop
git push origin main
```

## 🔗 유용한 링크

- GitHub PR: https://github.com/dbckdgjs369/debug_tool/pull/new/develop
- Render Dashboard: https://dashboard.render.com/
