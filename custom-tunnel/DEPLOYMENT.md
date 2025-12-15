# 🚀 커스텀 터널 배포 가이드

커스텀 터널 서버를 실제 외부에 공개하기 위한 배포 가이드입니다.

## 📋 목차

1. [배포 요구사항](#배포-요구사항)
2. [VPS 서버 배포](#vps-서버-배포)
3. [Docker 배포](#docker-배포)
4. [무료 배포 옵션](#무료-배포-옵션)
5. [도메인 및 SSL 설정](#도메인-및-ssl-설정)

---

## 배포 요구사항

### 필수 사항

- **VPS 서버** (AWS EC2, DigitalOcean, Azure, Vultr 등)
- **Node.js** v14 이상
- **공인 IP** 주소
- **방화벽 오픈**: 포트 80 (HTTP) 또는 443 (HTTPS)

### 권장 사항

- **도메인**: 예) `tunnel.yourdomain.com`
- **SSL 인증서**: Let's Encrypt (무료)
- **프로세스 관리자**: PM2
- **리버스 프록시**: Nginx (선택)

---

## VPS 서버 배포

### 1단계: VPS 서버 준비

#### 추천 VPS 제공업체

| 제공업체         | 최소 사양      | 월 비용 | 특징             |
| ---------------- | -------------- | ------- | ---------------- |
| **DigitalOcean** | 1GB RAM, 1 CPU | $6      | 초보자 친화적    |
| **AWS EC2**      | t2.micro       | $8      | 무료 티어 12개월 |
| **Vultr**        | 1GB RAM        | $5      | 저렴함           |
| **Linode**       | 1GB RAM        | $5      | 안정적           |

#### Ubuntu 서버 생성

```bash
# Ubuntu 20.04 LTS 또는 22.04 LTS 권장
```

### 2단계: 서버 접속 및 설정

```bash
# SSH로 서버 접속
ssh root@your-server-ip

# 시스템 업데이트
apt update && apt upgrade -y

# Node.js 설치 (v18 LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Git 설치
apt install -y git

# 방화벽 설정
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

### 3단계: 코드 배포

```bash
# 작업 디렉토리 생성
mkdir -p /opt/custom-tunnel
cd /opt/custom-tunnel

# Git으로 코드 가져오기 (방법 1)
git clone https://github.com/your-username/your-repo.git .

# 또는 파일 직접 업로드 (방법 2)
# 로컬에서: scp -r custom-tunnel/server root@your-server-ip:/opt/custom-tunnel/

# 서버 디렉토리로 이동
cd /opt/custom-tunnel/server

# 의존성 설치
npm install
```

### 4단계: 환경 설정

```bash
# 환경 변수 파일 생성
cat > .env << EOF
PORT=80
NODE_ENV=production
EOF
```

서버 코드의 `PORT` 상수를 수정하거나 환경 변수로 변경:

```javascript
// server/index.js
const PORT = process.env.PORT || 80;
```

### 5단계: PM2로 프로세스 관리

```bash
# PM2 설치
npm install -g pm2

# 서버 시작
pm2 start index.js --name tunnel-server

# 자동 재시작 설정 (서버 재부팅 시)
pm2 startup systemd
pm2 save

# 상태 확인
pm2 status
pm2 logs tunnel-server

# 재시작/중지
pm2 restart tunnel-server
pm2 stop tunnel-server
```

### 6단계: 테스트

```bash
# 서버에서 테스트
curl http://localhost

# 로컬에서 테스트
curl http://your-server-ip
```

브라우저에서 `http://your-server-ip` 접속하여 확인!

---

## Docker 배포

### Dockerfile 생성

```dockerfile
# custom-tunnel/server/Dockerfile
FROM node:18-alpine

WORKDIR /app

# 의존성 복사 및 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 포트 노출
EXPOSE 8080

# 서버 실행
CMD ["node", "index.js"]
```

### Docker Compose 설정

```yaml
# custom-tunnel/docker-compose.yml
version: "3.8"

services:
  tunnel-server:
    build: ./server
    ports:
      - "80:8080"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    volumes:
      - ./server:/app
      - /app/node_modules
```

### 배포 실행

```bash
# Docker 설치 (Ubuntu)
curl -fsSL https://get.docker.com | sh

# Docker Compose 설치
apt install -y docker-compose

# 서버 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down
```

---

## 무료 배포 옵션

### 1. Oracle Cloud (무료 티어)

- **무료 제공**: 2개의 VM (1GB RAM, 1 CPU) 평생 무료
- **장점**: 진짜 무료, VPS처럼 사용
- **단점**: 신청 절차 복잡

```bash
# Oracle Cloud VM 생성 후 위의 VPS 배포 단계 동일하게 진행
```

### 2. Railway.app

- **무료 제공**: 월 $5 크레딧 (약 500시간)
- **장점**: 배포 매우 간단, 자동 SSL
- **단점**: 제한된 무료 크레딧

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

# 도메인 자동 생성됨!
```

### 3. Render.com

- **무료 제공**: 무료 티어 (제한적)
- **장점**: 간단한 배포, 자동 SSL
- **단점**: 15분 비활성 시 슬립 모드

웹 UI에서:

1. GitHub 연동
2. `custom-tunnel/server` 디렉토리 선택
3. Start Command: `node index.js`
4. 배포 클릭!

### 4. Fly.io

- **무료 제공**: 3개의 VM (256MB RAM)
- **장점**: 전 세계 리전, 빠른 속도
- **단점**: 메모리 제한

```bash
# Fly CLI 설치
curl -L https://fly.io/install.sh | sh

# 로그인
flyctl auth login

# 앱 초기화
cd custom-tunnel/server
flyctl launch

# 배포
flyctl deploy
```

---

## 도메인 및 SSL 설정

### 도메인 연결

1. **도메인 구입** (Namecheap, GoDaddy, Cloudflare 등)
2. **DNS A 레코드 추가**:
   ```
   Type: A
   Name: tunnel (또는 @)
   Value: your-server-ip
   TTL: 300
   ```
3. **확인** (전파까지 최대 24시간):
   ```bash
   ping tunnel.yourdomain.com
   ```

### Nginx 리버스 프록시 (권장)

```bash
# Nginx 설치
apt install -y nginx

# 설정 파일 생성
cat > /etc/nginx/sites-available/tunnel << 'EOF'
server {
    listen 80;
    server_name tunnel.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# 심볼릭 링크 생성
ln -s /etc/nginx/sites-available/tunnel /etc/nginx/sites-enabled/

# 기본 사이트 제거
rm /etc/nginx/sites-enabled/default

# Nginx 테스트 및 재시작
nginx -t
systemctl restart nginx
```

### Let's Encrypt SSL 인증서 (무료 HTTPS)

```bash
# Certbot 설치
apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급 및 자동 설정
certbot --nginx -d tunnel.yourdomain.com

# 자동 갱신 테스트
certbot renew --dry-run

# 이제 HTTPS로 접속 가능!
# https://tunnel.yourdomain.com
```

Nginx 설정이 자동으로 업데이트되어 HTTPS 지원!

### WebSocket SSL 지원 확인

Nginx 설정에 WebSocket 관련 부분이 포함되어 있는지 확인:

```nginx
# /etc/nginx/sites-available/tunnel
location / {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # WebSocket
    proxy_set_header Connection "upgrade";        # WebSocket
    # ... 나머지 설정
}
```

---

## 클라이언트 연결 설정

### HTTP 배포 (공인 IP만)

```bash
# 클라이언트에서
cd custom-tunnel/client
node index.js 3000 ws://your-server-ip
```

### HTTPS 배포 (도메인 + SSL)

```bash
# 클라이언트에서
cd custom-tunnel/client
node index.js 3000 wss://tunnel.yourdomain.com
```

**주의**: `wss://` (WebSocket Secure)를 사용해야 합니다!

---

## 모니터링 및 관리

### PM2 모니터링

```bash
# 실시간 모니터링
pm2 monit

# CPU/메모리 사용량
pm2 list

# 로그 확인
pm2 logs tunnel-server --lines 100
```

### 서버 상태 확인

```bash
# 활성 연결 확인
netstat -an | grep :80 | grep ESTABLISHED | wc -l

# 메모리 사용량
free -h

# 디스크 사용량
df -h
```

### 로그 관리

```bash
# 로그 로테이션 설정
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 보안 설정 (선택)

### 기본 보안 강화

```bash
# SSH 포트 변경
sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
systemctl restart sshd
ufw allow 2222

# 비밀번호 로그인 비활성화 (SSH 키 사용)
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Fail2ban 설치 (무차별 대입 공격 방지)
apt install -y fail2ban
systemctl enable fail2ban
```

### Rate Limiting (Nginx)

```nginx
# /etc/nginx/sites-available/tunnel
limit_req_zone $binary_remote_addr zone=tunnel_limit:10m rate=10r/s;

server {
    # ...
    location / {
        limit_req zone=tunnel_limit burst=20 nodelay;
        # ... 나머지 프록시 설정
    }
}
```

---

## 비용 예측

### 월간 예상 비용

| 항목           | 비용         | 설명               |
| -------------- | ------------ | ------------------ |
| **VPS 서버**   | $5-10        | 기본 서버          |
| **도메인**     | $1-2         | 연간 $12-24        |
| **SSL 인증서** | $0           | Let's Encrypt 무료 |
| **총계**       | **$6-12/월** |                    |

### 무료 옵션 사용 시

- Oracle Cloud: **$0** (평생 무료)
- Cloudflare 도메인: **$0.99/월**
- Let's Encrypt SSL: **$0**
- **총계: $1/월** 🎉

---

## 문제 해결

### 연결이 안 될 때

```bash
# 방화벽 확인
ufw status

# 포트 리스닝 확인
netstat -tulpn | grep :80

# PM2 상태 확인
pm2 status

# 로그 확인
pm2 logs tunnel-server
tail -f /var/log/nginx/error.log
```

### WebSocket 연결 실패

```bash
# Nginx WebSocket 설정 확인
cat /etc/nginx/sites-available/tunnel | grep -A5 "Upgrade"

# 브라우저 개발자 도구에서 WebSocket 연결 확인
# ws:// 또는 wss://로 제대로 연결되는지 확인
```

---

## 업데이트 및 유지보수

### 코드 업데이트

```bash
# 서버에서
cd /opt/custom-tunnel
git pull

cd server
npm install

# PM2 재시작
pm2 restart tunnel-server
```

### 백업

```bash
# 서버 설정 백업
tar -czf tunnel-backup-$(date +%Y%m%d).tar.gz /opt/custom-tunnel

# 로컬로 다운로드
scp root@your-server-ip:/root/tunnel-backup-*.tar.gz ./
```

---

## 다음 단계

✅ **서버 배포 완료!**

이제 다음을 고려해보세요:

1. **서브도메인 자동 생성**: 각 터널마다 고유 서브도메인
   - 예: `abc12345.tunnel.yourdomain.com`
2. **인증 시스템**: API 키 또는 OAuth
3. **사용량 제한**: Rate limiting, 동시 연결 제한
4. **대시보드**: 활성 터널, 통계 모니터링
5. **커스텀 도메인**: 사용자가 자신의 도메인 사용

---

## 요약

| 방법             | 난이도   | 비용     | 추천          |
| ---------------- | -------- | -------- | ------------- |
| **VPS + PM2**    | ⭐⭐⭐   | $6-12/월 | 프로덕션      |
| **Docker**       | ⭐⭐⭐⭐ | $6-12/월 | 컨테이너화    |
| **Railway**      | ⭐       | $0-5/월  | 테스트/개발   |
| **Fly.io**       | ⭐⭐     | $0/월    | 개인 프로젝트 |
| **Oracle Cloud** | ⭐⭐⭐   | $0/월    | 무료 선호     |

---

**축하합니다! 이제 전 세계 어디서나 로컬 서버를 공유할 수 있습니다!** 🎉

문제가 있으면 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)를 참고하세요.
