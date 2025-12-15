#!/bin/bash

# 🚇 Custom Tunnel Client 연결 스크립트
# 로컬에서 터널 서버에 연결하는 스크립트입니다.

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚇 Custom Tunnel Client${NC}"
echo ""

# 사용법 확인
if [ $# -lt 2 ]; then
    echo -e "${RED}❌ 사용법:${NC}"
    echo "  ./connect.sh <로컬포트> <터널서버URL>"
    echo ""
    echo -e "${YELLOW}예시:${NC}"
    echo "  ./connect.sh 3000 ws://132.145.123.45"
    echo "  ./connect.sh 3000 wss://tunnel.yourdomain.com"
    echo ""
    exit 1
fi

LOCAL_PORT=$1
TUNNEL_URL=$2

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js가 설치되어 있지 않습니다.${NC}"
    echo ""
    echo "Node.js 설치 방법:"
    echo "  Mac: brew install node"
    echo "  Windows: https://nodejs.org 에서 다운로드"
    echo "  Linux: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs"
    echo ""
    exit 1
fi

# 클라이언트 디렉토리로 이동
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$SCRIPT_DIR/client"

if [ ! -d "$CLIENT_DIR" ]; then
    echo -e "${RED}❌ 클라이언트 디렉토리를 찾을 수 없습니다: $CLIENT_DIR${NC}"
    exit 1
fi

cd "$CLIENT_DIR"

# 의존성 설치 확인
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 의존성 설치 중...${NC}"
    npm install
    echo ""
fi

# 로컬 포트 사용 확인
if lsof -Pi :$LOCAL_PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✅ 로컬 포트 $LOCAL_PORT에서 서버가 실행 중입니다.${NC}"
else
    echo -e "${RED}⚠️  경고: 로컬 포트 $LOCAL_PORT에서 서버가 실행되고 있지 않습니다.${NC}"
    echo ""
    echo -e "${YELLOW}💡 테스트 서버를 먼저 실행하세요:${NC}"
    echo "  cd $SCRIPT_DIR/test-server"
    echo "  npm install"
    echo "  node app.js"
    echo ""
    read -p "계속하시겠습니까? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 터널 클라이언트 실행
echo -e "${BLUE}🚀 터널 클라이언트 시작...${NC}"
echo ""
echo -e "${GREEN}📦 로컬 서버 포트:${NC} $LOCAL_PORT"
echo -e "${GREEN}🌐 터널 서버:${NC} $TUNNEL_URL"
echo ""
echo -e "${YELLOW}💡 종료하려면 Ctrl+C를 누르세요${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node index.js $LOCAL_PORT $TUNNEL_URL
