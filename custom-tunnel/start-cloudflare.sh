#!/bin/bash

# Cloudflare Tunnel을 사용한 터널 서버 실행 스크립트
# 이 스크립트는 터널 서버와 Cloudflare Tunnel을 동시에 실행합니다.

set -e

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}🚇 Custom Tunnel - Cloudflare${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# cloudflared 설치 확인
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ cloudflared가 설치되어 있지 않습니다.${NC}"
    echo ""
    echo -e "${YELLOW}설치 방법:${NC}"
    echo "brew install cloudflare/cloudflare/cloudflared"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ cloudflared 설치 확인됨${NC}"
echo ""

# 서버 디렉토리로 이동
cd "$(dirname "$0")/server"

# 포트 사용 확인
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}⚠️  포트 8080이 이미 사용 중입니다.${NC}"
    echo "다른 프로세스를 종료하거나 다른 포트를 사용하세요."
    echo ""
    read -p "계속하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 임시 파일 생성
TUNNEL_LOG=$(mktemp)
SERVER_PID_FILE=$(mktemp)

# 정리 함수
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 서버를 종료합니다...${NC}"
    
    # 서버 프로세스 종료
    if [ -f "$SERVER_PID_FILE" ]; then
        SERVER_PID=$(cat "$SERVER_PID_FILE")
        if ps -p $SERVER_PID > /dev/null 2>&1; then
            kill $SERVER_PID 2>/dev/null || true
        fi
        rm -f "$SERVER_PID_FILE"
    fi
    
    # Cloudflare Tunnel 종료
    pkill -f "cloudflared tunnel" 2>/dev/null || true
    
    # 임시 파일 삭제
    rm -f "$TUNNEL_LOG"
    
    echo -e "${GREEN}✅ 종료 완료${NC}"
    exit 0
}

# Ctrl+C 처리
trap cleanup INT TERM

echo -e "${BLUE}🚀 터널 서버를 시작합니다...${NC}"
echo ""

# 터널 서버 시작 (백그라운드)
node index.js > /dev/null 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$SERVER_PID_FILE"

# 서버가 시작될 때까지 대기
sleep 2

# 서버 확인
if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    echo -e "${RED}❌ 터널 서버 시작 실패${NC}"
    rm -f "$SERVER_PID_FILE"
    exit 1
fi

echo -e "${GREEN}✅ 터널 서버 시작 (PID: $SERVER_PID)${NC}"
echo -e "${BLUE}   http://localhost:8080${NC}"
echo ""

echo -e "${BLUE}🌐 Cloudflare Tunnel을 시작합니다...${NC}"
echo -e "${YELLOW}   (URL 생성까지 약 5-10초 소요)${NC}"
echo ""

# Cloudflare Tunnel 시작 (포그라운드)
cloudflared tunnel --url http://localhost:8080 2>&1 | while IFS= read -r line; do
    echo "$line"
    
    # URL 추출 및 강조 표시
    if echo "$line" | grep -q "https://.*\.trycloudflare\.com"; then
        TUNNEL_URL=$(echo "$line" | grep -oE 'https://[^[:space:]]+\.trycloudflare\.com')
        echo ""
        echo -e "${GREEN}================================${NC}"
        echo -e "${GREEN}✅ Cloudflare Tunnel 준비 완료!${NC}"
        echo -e "${GREEN}================================${NC}"
        echo ""
        echo -e "${BLUE}🌍 외부 접속 URL:${NC}"
        echo -e "${GREEN}   $TUNNEL_URL${NC}"
        echo ""
        echo -e "${BLUE}📊 Dashboard:${NC}"
        echo -e "${GREEN}   $TUNNEL_URL/dashboard${NC}"
        echo ""
        echo -e "${YELLOW}💡 터널 클라이언트 실행 예시:${NC}"
        echo -e "   cd custom-tunnel/client"
        echo -e "   node index.js 5173 wss://$(echo $TUNNEL_URL | sed 's/https:\/\///')"
        echo ""
        echo -e "${YELLOW}종료하려면 Ctrl+C를 누르세요${NC}"
        echo ""
    fi
done

# 스크립트 종료 시 정리
cleanup
