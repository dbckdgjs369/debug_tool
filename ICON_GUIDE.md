# 익스텐션 아이콘 가이드

VS Code 마켓플레이스에서 익스텐션을 돋보이게 하려면 아이콘이 필수입니다.

## 📐 아이콘 요구사항

### 크기 및 형식

- **크기**: 128x128 픽셀 (정확히)
- **형식**: PNG (권장) 또는 SVG
- **배경**: 투명 배경 권장
- **색상**: 16비트 이상의 컬러

### 디자인 가이드라인

- 단순하고 명확한 디자인
- VS Code의 전반적인 디자인 언어와 어울리는 스타일
- 작은 크기에서도 식별 가능해야 함
- 익스텐션의 기능을 시각적으로 표현

## 🎨 아이콘 아이디어 (Custom Tunnel용)

### 추천 콘셉트

1. **지구본 + 터널**: 글로벌 연결을 상징
2. **연결선**: 로컬과 원격 연결을 표현
3. **공유 아이콘**: 공유 기능 강조
4. **네트워크 노드**: 네트워킹 개념

### 색상 추천

- **주 색상**: 파란색 계열 (신뢰성, 기술)
- **보조 색상**: 녹색 (활성화, 연결됨)
- **강조 색상**: 주황색 또는 보라색

## 🔧 아이콘 생성 방법

### 방법 1: 온라인 도구 사용 (가장 쉬움)

#### Canva (무료)

1. [Canva](https://www.canva.com) 접속
2. "Custom dimensions" → 128 x 128 픽셀 입력
3. 디자인 요소를 사용하여 아이콘 제작
4. 투명 배경으로 PNG 다운로드 (Pro 기능이지만 무료 체험 가능)

#### Figma (무료)

1. [Figma](https://www.figma.com) 접속
2. 새 파일 생성
3. 128x128px 프레임 생성
4. 디자인 후 Export → PNG, 2x 해상도 선택

#### GIMP (무료, 오픈소스)

1. [GIMP 다운로드](https://www.gimp.org/)
2. 새 이미지: 128x128px, Fill with: Transparency
3. 디자인 작업
4. Export As → PNG, Save background color 체크 해제

### 방법 2: AI 도구 사용

#### DALL-E, Midjourney 등

프롬프트 예시:

```
A simple, minimalist icon for a VS Code extension.
Shows a tunnel connecting local and remote servers.
Blue and green colors. Transparent background.
Icon style, flat design, 128x128px
```

### 방법 3: 아이콘 라이브러리 사용

무료 아이콘 사이트:

- [Flaticon](https://www.flaticon.com/) - 무료 아이콘 (저작권 표시 필요)
- [Icons8](https://icons8.com/) - 일부 무료
- [The Noun Project](https://thenounproject.com/) - 무료/유료 혼합

⚠️ **주의**: 라이선스를 반드시 확인하고, 필요시 크레딧 표시

## 📁 아이콘 추가하기

### 1. 파일 구조 생성

```bash
# 프로젝트 루트에서
mkdir images
```

### 2. 아이콘 파일 배치

생성한 아이콘을 `images/icon.png`로 저장

### 3. package.json 업데이트

이미 추가되어 있으므로 별도 작업 불필요.
아이콘 파일만 추가하면 됩니다.

```json
{
  "icon": "images/icon.png"
}
```

### 4. 확인

```bash
# VSIX 패키지 생성
npm run compile
npx @vscode/vsce package

# 생성된 VSIX 파일 설치하여 아이콘 확인
code --install-extension custom-tunnel-1.0.0.vsix
```

## 🖼️ 간단한 아이콘 예제 (SVG)

아이콘이 없다면 임시로 간단한 SVG를 PNG로 변환하여 사용할 수 있습니다:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <!-- 배경 원 -->
  <circle cx="64" cy="64" r="60" fill="#007ACC" />

  <!-- 터널 표시 (2개의 연결선) -->
  <line x1="20" y1="50" x2="50" y2="50" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <line x1="78" y1="50" x2="108" y2="50" stroke="white" stroke-width="6" stroke-linecap="round"/>

  <!-- 중앙 노드 -->
  <circle cx="64" cy="50" r="12" fill="white" />

  <!-- 하단 텍스트 또는 장식 -->
  <line x1="40" y1="78" x2="88" y2="78" stroke="white" stroke-width="4" stroke-linecap="round"/>
</svg>
```

이 SVG를 온라인 변환기([CloudConvert](https://cloudconvert.com/svg-to-png))를 사용하여 128x128 PNG로 변환하세요.

## ✅ 아이콘 체크리스트

아이콘 추가 전 확인사항:

- [ ] 크기가 정확히 128x128 픽셀
- [ ] PNG 또는 SVG 형식
- [ ] 투명 배경 (선택사항이지만 권장)
- [ ] 작은 크기에서도 명확하게 보임
- [ ] 라이선스 문제 없음
- [ ] `images/` 폴더에 `icon.png`로 저장
- [ ] package.json에 "icon" 필드 있음
- [ ] 로컬에서 테스트 완료

## 🚀 아이콘 없이 게시하기

아이콘이 필수는 아닙니다. 아이콘 없이도 게시할 수 있지만:

- 마켓플레이스에서 덜 전문적으로 보임
- 다운로드율이 낮을 수 있음
- 나중에 언제든 추가 가능

아이콘 없이 게시하려면 package.json에서 `"icon"` 필드를 제거하거나 추가하지 않으면 됩니다.

---

**팁**: 처음 게시할 때는 간단한 아이콘으로 시작하고, 나중에 전문 디자이너에게 의뢰하거나 더 나은 디자인으로 업데이트할 수 있습니다.
