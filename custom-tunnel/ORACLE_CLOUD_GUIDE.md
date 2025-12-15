# 🌩️ Oracle Cloud 무료 배포 가이드

Oracle Cloud Always Free Tier를 사용하여 Custom Tunnel을 **완전 무료**로 영구 배포하는 방법입니다.

## 📋 목차

1. [Oracle Cloud 계정 생성](#1-oracle-cloud-계정-생성)
2. [VM 인스턴스 생성](#2-vm-인스턴스-생성)
3. [방화벽 설정](#3-방화벽-설정)
4. [서버 접속 및 환경 설정](#4-서버-접속-및-환경-설정)
5. [코드 배포](#5-코드-배포)
6. [PM2로 프로세스 관리](#6-pm2로-프로세스-관리)
7. [클라이언트 테스트](#7-클라이언트-테스트)
8. [도메인 및 SSL 설정](#8-도메인-및-ssl-설정-선택)

---

## 1. Oracle Cloud 계정 생성

### 1.1 회원가입

1. [Oracle Cloud 무료 가입](https://www.oracle.com/cloud/free/) 페이지 접속
2. "Start for free" 클릭
3. 이메일, 국가 선택 (한국 선택)
4. 계정 정보 입력
   - 이름, 이메일
   - **신용카드 필요** (본인 확인용, 청구 없음)
5. 휴대폰 인증

⚠️ **주의**:

- 신용카드는 본인 확인용이며 Always Free 서비스는 **절대 청구되지 않습니다**
- 회원가입 승인까지 몇 분~몇 시간 소요될 수 있습니다

### 1.2 리전 선택

- **권장 리전**: Seoul (ap-seoul-1) 또는 Tokyo (ap-tokyo-1)
- 한국과 가까워 속도가 빠릅니다

---

## 2. VM 인스턴스 생성

### 2.1 Compute 인스턴스 생성

1. Oracle Cloud 콘솔 로그인
2. 좌측 메뉴 → **Compute** → **Instances** 클릭
3. **Create Instance** 클릭

### 2.2 인스턴스 설정

#### 기본 정보

```
Name: tunnel-server (원하는 이름)
Compartment: (root) - 기본값 그대로
```

#### Image and Shape

```
Image: Canonical Ubuntu 22.04
Shape: VM.Standard.E2.1.Micro (Always Free)
  - 1GB RAM
  - 1 Core OCPU
  - 0.48 Gbps 네트워크
```

⚠️ **중요**: **Always Free-eligible** 표시가 있는 Shape를 선택하세요!

#### Networking

**Virtual Cloud Network (VCN)**:

- 기본 VCN 사용 또는 새로 생성
- "Assign a public IPv4 address" 체크 ✅

**SSH Keys**:

- **Generate SSH key pair** 선택
- **Save Private Key** 클릭하여 프라이빗 키 다운로드
  - 파일명: `ssh-key-*.key`
  - 나중에 SSH 접속에 필요합니다!

#### Boot Volume

```
기본값 사용 (50GB - Always Free)
```

### 2.3 인스턴스 생성 완료

- **Create** 클릭
- 인스턴스가 "Running" 상태가 될 때까지 대기 (약 1-2분)
- **Public IP Address**를 메모하세요! (예: 132.145.xxx.xxx)

---

## 3. 방화벽 설정

Oracle Cloud는 3단계 방화벽이 있어서 모두 열어줘야 합니다.

### 3.1 Security List 설정 (클라우드 방화벽)

1. 인스턴스 상세 페이지 → **Primary VNIC** → **Subnet** 클릭
2. **Security Lists** → 기본 Security List 클릭
3. **Add Ingress Rules** 클릭
4. 규칙 추가:

#### HTTP 규칙

```
Source Type: CIDR
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 80
Description: HTTP for tunnel
```

#### HTTPS 규칙 (나중에 SSL 사용 시)

```
Source Type: CIDR
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 443
Description: HTTPS for tunnel
```

5. **Add Ingress Rule** 클릭

### 3.2 인스턴스 방화벽 설정 (iptables)

나중에 SSH로 접속한 후 실행할 명령어들입니다 (4단계에서 진행).

---

## 4. 서버 접속 및 환경 설정

### 4.1 SSH 키 권한 설정 (로컬에서)

**Mac/Linux:**

```bash
# 다운로드한 SSH 키 권한 변경
chmod 400 ~/Downloads/ssh-key-*.key
```

**Windows (Git Bash 또는 WSL):**

```bash
chmod 400 /c/Users/YourName/Downloads/ssh-key-*.key
```

### 4.2 SSH 접속

```bash
# Mac/Linux
ssh -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_PUBLIC_IP

# Windows (Git Bash)
ssh -i /c/Users/YourName/Downloads/ssh-key-*.key ubuntu@YOUR_PUBLIC_IP
```

예시:

```bash
ssh -i ~/Downloads/ssh-key-2024-01-15.key ubuntu@132.145.123.45
```

### 4.3 인스턴스 방화벽 설정 (iptables)

SSH 접속 후 실행:

```bash
# 포트 80 (HTTP) 열기
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT

# 포트 443 (HTTPS) 열기
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT

# 규칙 저장
sudo netfilter-persistent save

# 확인
sudo iptables -L INPUT -n --line-numbers
```

### 4.4 시스템 업데이트

```bash
# 패키지 목록 업데이트
sudo apt update

# 시스템 업그레이드
sudo apt upgrade -y
```

### 4.5 Node.js 설치

```bash
# Node.js 18 LTS 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 버전 확인
node --version  # v18.x.x
npm --version   # 9.x.x
```

### 4.6 Git 설치

```bash
sudo apt install -y git
```

---

## 5. 코드 배포

### 방법 1: Git으로 배포 (권장)

```bash
# 작업 디렉토리 생성
sudo mkdir -p /opt/custom-tunnel
sudo chown ubuntu:ubuntu /opt/custom-tunnel
cd /opt/custom-tunnel

# GitHub에서 코드 클론
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .

# 또는 직접 파일 구조 생성 (다음 섹션 참고)
```

### 방법 2: 로컬에서 파일 업로드

**로컬 터미널에서 실행:**

```bash
# custom-tunnel/server 디렉토리를 서버로 업로드
scp -i ~/Downloads/ssh-key-*.key -r custom-tunnel ubuntu@YOUR_PUBLIC_IP:~/

# 서버에서 이동
# (SSH 접속 후)
sudo mv ~/custom-tunnel /opt/
sudo chown -R ubuntu:ubuntu /opt/custom-tunnel
```

### 5.1 서버 디렉토리 구조 확인

```bash
cd /opt/custom-tunnel/server
ls -la

# 필요한 파일들:
# - index.js
# - package.json
# - package-lock.json (있으면)
```

### 5.2 의존성 설치

```bash
cd /opt/custom-tunnel/server
npm install
```

### 5.3 환경 변수 설정

```bash
# .env 파일 생성
cat > .env << 'EOF'
PORT=80
NODE_ENV=production
EOF
```

---

## 6. PM2로 프로세스 관리

### 6.1 PM2 설치

```bash
sudo npm install -g pm2
```

### 6.2 서버 시작

```bash
cd /opt/custom-tunnel/server

# PM2로 서버 시작 (포트 80이므로 sudo 필요)
sudo pm2 start index.js --name tunnel-server --env production

# 또는 포트를 명시적으로 지정
sudo PORT=80 pm2 start index.js --name tunnel-server
```

### 6.3 자동 재시작 설정

```bash
# 시스템 부팅 시 자동 시작 설정
sudo pm2 startup systemd -u ubuntu --hp /home/ubuntu

# 현재 PM2 프로세스 목록 저장
sudo pm2 save
```

### 6.4 PM2 상태 확인

```bash
# 프로세스 목록
sudo pm2 list

# 실시간 로그 보기
sudo pm2 logs tunnel-server

# 최근 로그 100줄
sudo pm2 logs tunnel-server --lines 100

# 모니터링
sudo pm2 monit
```

### 6.5 PM2 관리 명령어

```bash
# 재시작
sudo pm2 restart tunnel-server

# 중지
sudo pm2 stop tunnel-server

# 시작
sudo pm2 start tunnel-server

# 삭제
sudo pm2 delete tunnel-server

# 모든 프로세스 재시작
sudo pm2 restart all
```

---

## 7. 클라이언트 테스트

### 7.1 서버 작동 확인

**서버에서 테스트:**

```bash
curl http://localhost
# 출력: <h1>🚇 Custom Tunnel Server</h1> ...
```

**로컬 브라우저에서 테스트:**

```
http://YOUR_PUBLIC_IP
```

예: `http://132.145.123.45`

서버 상태 페이지가 보이면 성공! ✅

### 7.2 로컬 클라이언트 연결

**로컬 컴퓨터에서:**

#### 1) 테스트 서버 실행 (터미널 1)

```bash
cd custom-tunnel/test-server
npm install
node app.js
# 포트 3000에서 실행됨
```

#### 2) 터널 클라이언트 실행 (터미널 2)

```bash
cd custom-tunnel/client
npm install
node index.js 3000 ws://YOUR_PUBLIC_IP
```

예:

```bash
node index.js 3000 ws://132.145.123.45
```

#### 3) 출력 확인

```
🚇 Tunnel Client 시작...
📦 로컬 서버 포트: 3000
🌐 터널 서버: ws://132.145.123.45

✅ 터널 연결 성공!
📋 터널 ID: abc12345
🌍 공개 URL: http://132.145.123.45/abc12345

이제 이 URL로 접속하면 로컬 서버로 연결됩니다!
```

#### 4) 브라우저에서 테스트

```
http://YOUR_PUBLIC_IP/abc12345
```

로컬 서버 내용이 보이면 성공! 🎉

---

## 8. 도메인 및 SSL 설정 (선택)

무료 도메인 + SSL 인증서로 `https://tunnel.yourdomain.com` 형태로 사용할 수 있습니다.

### 8.1 도메인 준비

**무료 도메인 옵션:**

- [Freenom](https://www.freenom.com) (.tk, .ml, .ga 등 - 무료)
- [DuckDNS](https://www.duckdns.org) (무료 서브도메인)
- Cloudflare Pages (cloudflare.pages.dev)

**유료 도메인:**

- Namecheap, GoDaddy, Cloudflare Registrar ($8-12/년)

### 8.2 DNS 설정

도메인 관리 페이지에서 A 레코드 추가:

```
Type: A
Name: tunnel (또는 @)
Value: YOUR_PUBLIC_IP
TTL: 300
```

### 8.3 Nginx 설치 및 설정

```bash
# Nginx 설치
sudo apt install -y nginx

# 설정 파일 생성
sudo nano /etc/nginx/sites-available/tunnel
```

**설정 내용:**

```nginx
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
```

**Nginx 활성화:**

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/tunnel /etc/nginx/sites-enabled/

# 기본 사이트 제거
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
```

**서버 포트 변경:**

```bash
# PM2 중지
sudo pm2 stop tunnel-server

# 포트 8080으로 변경
sudo PORT=8080 pm2 start /opt/custom-tunnel/server/index.js --name tunnel-server

# 저장
sudo pm2 save
```

### 8.4 Let's Encrypt SSL 설치

```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급 및 자동 설정
sudo certbot --nginx -d tunnel.yourdomain.com

# 입력 사항:
# - 이메일 주소 입력
# - 약관 동의: Y
# - 뉴스레터: N
# - HTTP → HTTPS 리다이렉트: 2 (Redirect)

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

**이제 HTTPS로 접속 가능!**

```
https://tunnel.yourdomain.com
```

### 8.5 클라이언트에서 WSS 사용

```bash
# WSS (WebSocket Secure) 프로토콜 사용
node index.js 3000 wss://tunnel.yourdomain.com
```

---

## 9. 모니터링 및 유지보수

### 9.1 서버 상태 확인

```bash
# PM2 프로세스
sudo pm2 list
sudo pm2 monit

# 시스템 리소스
free -h       # 메모리
df -h         # 디스크
top           # CPU

# 네트워크 연결
sudo netstat -tulpn | grep :80
```

### 9.2 로그 확인

```bash
# PM2 로그
sudo pm2 logs tunnel-server

# Nginx 로그
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 시스템 로그
sudo journalctl -u pm2-ubuntu -f
```

### 9.3 코드 업데이트

```bash
cd /opt/custom-tunnel

# Git에서 최신 코드 가져오기
git pull

# 의존성 업데이트
cd server
npm install

# PM2 재시작
sudo pm2 restart tunnel-server
```

### 9.4 백업

```bash
# 백업 생성
sudo tar -czf /home/ubuntu/tunnel-backup-$(date +%Y%m%d).tar.gz /opt/custom-tunnel

# 로컬로 다운로드 (로컬에서 실행)
scp -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_PUBLIC_IP:~/tunnel-backup-*.tar.gz ./
```

---

## 10. 문제 해결

### 연결이 안 될 때

```bash
# 1. PM2 상태 확인
sudo pm2 status

# 2. 프로세스가 실행 중인지 확인
sudo netstat -tulpn | grep :80

# 3. 방화벽 확인
sudo iptables -L INPUT -n

# 4. Security List 확인 (웹 콘솔에서)
# Compute → Instances → Subnet → Security Lists

# 5. 로그 확인
sudo pm2 logs tunnel-server --lines 100
```

### 포트 80 권한 오류

```bash
# sudo 없이 실행 시 "Permission denied" 오류 발생
# 해결: sudo로 PM2 실행
sudo pm2 start index.js --name tunnel-server

# 또는 포트 8080 사용 + Nginx 리버스 프록시
```

### WebSocket 연결 실패

```bash
# 1. 서버에서 WebSocket 지원 확인
# Nginx 설정에 Upgrade 헤더가 있는지 확인

# 2. 클라이언트 프로토콜 확인
# HTTP: ws://
# HTTPS: wss://

# 3. 방화벽에서 WebSocket 포트 열려있는지 확인
```

---

## 11. 비용 및 제한사항

### Always Free 제한

| 항목            | 제한                 |
| --------------- | -------------------- |
| **VM 인스턴스** | 2개 (E2.1.Micro)     |
| **메모리**      | 1GB per VM           |
| **CPU**         | 1 Core per VM        |
| **스토리지**    | 100GB 블록 볼륨      |
| **네트워크**    | 10TB 아웃바운드 / 월 |
| **공인 IP**     | 2개                  |

### 예상 트래픽

```
10TB / 월 = 약 333GB / 일
= 약 13.9GB / 시간
= 약 238MB / 분
```

일반적인 개발 용도로는 **충분합니다**! ✅

---

## 12. 다음 단계

✅ **Oracle Cloud 배포 완료!**

이제 다음을 고려해보세요:

1. **커스텀 도메인**: Freenom 무료 도메인 + Cloudflare DNS
2. **모니터링**: UptimeRobot (무료 모니터링)
3. **자동 배포**: GitHub Actions로 코드 푸시 시 자동 배포
4. **보안 강화**: Rate limiting, API 키 인증
5. **다중 터널**: 여러 개의 터널 동시 운영

---

## 요약

```bash
# 1. Oracle Cloud VM 생성 (Ubuntu 22.04)
# 2. Security List에서 포트 80, 443 열기
# 3. SSH 접속
# 4. 환경 설정
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# 5. 방화벽 설정
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save

# 6. 코드 배포
sudo mkdir -p /opt/custom-tunnel
sudo chown ubuntu:ubuntu /opt/custom-tunnel
# (파일 업로드)

# 7. PM2로 실행
cd /opt/custom-tunnel/server
npm install
sudo npm install -g pm2
sudo PORT=80 pm2 start index.js --name tunnel-server
sudo pm2 startup systemd -u ubuntu --hp /home/ubuntu
sudo pm2 save

# 8. 클라이언트 연결 (로컬에서)
cd custom-tunnel/client
node index.js 3000 ws://YOUR_PUBLIC_IP
```

**축하합니다! 이제 무료로 영구 사용 가능한 터널 서버를 운영할 수 있습니다!** 🎉

---

## 참고 자료

- [Oracle Cloud Always Free](https://www.oracle.com/cloud/free/)
- [Oracle Cloud 문서](https://docs.oracle.com/en-us/iaas/Content/home.htm)
- [PM2 문서](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Nginx 문서](https://nginx.org/en/docs/)
