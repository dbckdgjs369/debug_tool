#!/bin/bash

# 🌩️ Oracle Cloud Custom Tunnel 배포 스크립트
# 이 스크립트는 Oracle Cloud Ubuntu 서버에서 실행됩니다.

set -e  # 오류 발생 시 스크립트 중단

echo "🚀 Custom Tunnel Server 배포 시작..."
echo ""

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 시스템 업데이트
echo -e "${BLUE}📦 시스템 업데이트 중...${NC}"
sudo apt update
sudo apt upgrade -y

# 2. Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📥 Node.js 설치 중...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${GREEN}✅ Node.js 이미 설치됨: $(node --version)${NC}"
fi

# 3. Git 설치 확인
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}📥 Git 설치 중...${NC}"
    sudo apt install -y git
else
    echo -e "${GREEN}✅ Git 이미 설치됨${NC}"
fi

# 4. 방화벽 설정
echo -e "${BLUE}🔥 방화벽 설정 중...${NC}"

# iptables 규칙 추가
sudo iptables -C INPUT -m state --state NEW -p tcp --dport 80 -j ACCEPT 2>/dev/null || \
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT

sudo iptables -C INPUT -m state --state NEW -p tcp --dport 443 -j ACCEPT 2>/dev/null || \
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# netfilter-persistent가 설치되어 있지 않으면 설치
if ! command -v netfilter-persistent &> /dev/null; then
    echo -e "${YELLOW}📥 netfilter-persistent 설치 중...${NC}"
    sudo DEBIAN_FRONTEND=noninteractive apt install -y iptables-persistent
fi

# 규칙 저장
sudo netfilter-persistent save

echo -e "${GREEN}✅ 방화벽 설정 완료${NC}"

# 5. 작업 디렉토리 생성
echo -e "${BLUE}📁 작업 디렉토리 설정 중...${NC}"
sudo mkdir -p /opt/custom-tunnel
sudo chown $USER:$USER /opt/custom-tunnel

# 6. 의존성 설치
echo -e "${BLUE}📦 서버 의존성 설치 중...${NC}"
cd /opt/custom-tunnel/server
npm install --production

# 7. PM2 설치
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📥 PM2 설치 중...${NC}"
    sudo npm install -g pm2
else
    echo -e "${GREEN}✅ PM2 이미 설치됨${NC}"
fi

# 8. 환경 변수 설정
echo -e "${BLUE}⚙️  환경 변수 설정 중...${NC}"
cat > /opt/custom-tunnel/server/.env << 'EOF'
PORT=80
NODE_ENV=production
EOF

# 9. PM2로 서버 시작
echo -e "${BLUE}🚀 서버 시작 중...${NC}"

# 이미 실행 중이면 재시작
if sudo pm2 list | grep -q "tunnel-server"; then
    echo -e "${YELLOW}🔄 기존 서버 재시작 중...${NC}"
    sudo pm2 restart tunnel-server
else
    echo -e "${GREEN}▶️  새 서버 시작 중...${NC}"
    cd /opt/custom-tunnel/server
    sudo PORT=80 pm2 start index.js --name tunnel-server
fi

# 10. 자동 재시작 설정
echo -e "${BLUE}🔄 자동 재시작 설정 중...${NC}"
sudo pm2 startup systemd -u $USER --hp $HOME | grep -v PM2 | sudo bash || true
sudo pm2 save

# 11. 서버 상태 확인
echo ""
echo -e "${GREEN}✅ 배포 완료!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📊 서버 상태:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sudo pm2 list
echo ""

# 공인 IP 가져오기
PUBLIC_IP=$(curl -s ifconfig.me)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Custom Tunnel Server가 실행 중입니다!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}🌐 서버 URL:${NC} http://$PUBLIC_IP"
echo ""
echo -e "${YELLOW}💡 다음 단계:${NC}"
echo "  1. 브라우저에서 http://$PUBLIC_IP 접속하여 확인"
echo "  2. 로컬에서 클라이언트 실행:"
echo "     cd custom-tunnel/client"
echo "     node index.js 3000 ws://$PUBLIC_IP"
echo ""
echo -e "${BLUE}📝 유용한 명령어:${NC}"
echo "  - 로그 보기: sudo pm2 logs tunnel-server"
echo "  - 상태 확인: sudo pm2 status"
echo "  - 재시작: sudo pm2 restart tunnel-server"
echo "  - 중지: sudo pm2 stop tunnel-server"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
