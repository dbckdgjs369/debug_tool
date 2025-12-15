# ⚡ Oracle Cloud 빠른 배포 가이드

Oracle Cloud에 Custom Tunnel을 **10분 안에** 배포하는 가이드입니다.

---

## 📋 준비물

✅ Oracle Cloud 계정 (무료)  
✅ SSH 클라이언트 (터미널)  
✅ 로컬에 Node.js 설치됨

---

## 🚀 1단계: Oracle Cloud VM 생성 (5분)

### 1.1 Oracle Cloud 로그인

1. [Oracle Cloud Console](https://cloud.oracle.com) 접속
2. 로그인

### 1.2 VM 인스턴스 생성

1. **Compute → Instances → Create Instance**
2. 설정:
   ```
   Name: tunnel-server
   Image: Ubuntu 22.04
   Shape: VM.Standard.E2.1.Micro (Always Free ✅)
   ```
3. **SSH Key**: "Generate SSH key pair" → **Save Private Key** 다운로드
4. **Assign a public IPv4 address** 체크 ✅
5. **Create** 클릭
6. **Public IP** 메모 (예: 132.145.xxx.xxx)

### 1.3 방화벽 설정 (Security List)

1. 인스턴스 페이지 → **Primary VNIC** → **Subnet** 클릭
2. **Security Lists** → 기본 Security List 클릭
3. **Add Ingress Rules** 클릭
4. HTTP 규칙 추가:
   ```
   Source CIDR: 0.0.0.0/0
   IP Protocol: TCP
   Destination Port: 80
   ```
5. **Add Ingress Rule** 클릭

---

## 🖥️ 2단계: 서버에 코드 배포 (3분)

### 2.1 SSH 접속

```bash
# Mac/Linux
chmod 400 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_PUBLIC_IP
```

### 2.2 파일 업로드 (로컬 터미널에서)

**방법 1: SCP로 업로드 (권장)**

```bash
# 로컬 터미널에서 실행
cd /Users/yoochangheon/debug_tool
scp -i ~/Downloads/ssh-key-*.key -r custom-tunnel ubuntu@YOUR_PUBLIC_IP:~/
```

**방법 2: Git 클론 (GitHub에 푸시한 경우)**

```bash
# 서버에서 실행
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git custom-tunnel
```

### 2.3 배포 스크립트 실행 (서버에서)

```bash
# 파일 이동
sudo mv ~/custom-tunnel /opt/
sudo chown -R ubuntu:ubuntu /opt/custom-tunnel

# 배포 스크립트 실행
cd /opt/custom-tunnel
chmod +x deploy-oracle.sh
./deploy-oracle.sh
```

배포 스크립트가 자동으로:

- ✅ Node.js 설치
- ✅ 방화벽 설정
- ✅ 의존성 설치
- ✅ PM2로 서버 시작
- ✅ 자동 재시작 설정

---

## ✅ 3단계: 테스트 (2분)

### 3.1 서버 확인

브라우저에서 접속:

```
http://YOUR_PUBLIC_IP
```

서버 상태 페이지가 보이면 성공! 🎉

### 3.2 클라이언트 연결 (로컬에서)

**터미널 1: 테스트 서버 실행**

```bash
cd /Users/yoochangheon/debug_tool/custom-tunnel/test-server
npm install
node app.js
```

**터미널 2: 터널 클라이언트 실행**

```bash
cd /Users/yoochangheon/debug_tool/custom-tunnel
./connect.sh 3000 ws://YOUR_PUBLIC_IP
```

또는 직접 실행:

```bash
cd /Users/yoochangheon/debug_tool/custom-tunnel/client
node index.js 3000 ws://YOUR_PUBLIC_IP
```

### 3.3 공개 URL 접속

터널 클라이언트에서 출력된 URL로 접속:

```
http://YOUR_PUBLIC_IP/abc12345
```

로컬 서버 내용이 보이면 **완료!** 🎉

---

## 📝 요약 명령어

### 로컬에서 (한 번만 실행)

```bash
# 1. 코드 업로드
cd /Users/yoochangheon/debug_tool
scp -i ~/Downloads/ssh-key-*.key -r custom-tunnel ubuntu@YOUR_PUBLIC_IP:~/
```

### 서버에서 (한 번만 실행)

```bash
# 2. 배포
sudo mv ~/custom-tunnel /opt/
sudo chown -R ubuntu:ubuntu /opt/custom-tunnel
cd /opt/custom-tunnel
chmod +x deploy-oracle.sh
./deploy-oracle.sh
```

### 로컬에서 (매번 사용할 때)

```bash
# 3. 터널 연결
cd /Users/yoochangheon/debug_tool/custom-tunnel
./connect.sh 3000 ws://YOUR_PUBLIC_IP
```

---

## 🔧 유용한 명령어

### 서버 관리 (SSH 접속 후)

```bash
# 상태 확인
sudo pm2 status

# 로그 보기
sudo pm2 logs tunnel-server

# 재시작
sudo pm2 restart tunnel-server

# 중지
sudo pm2 stop tunnel-server

# 코드 업데이트 후 재배포
cd /opt/custom-tunnel
./deploy-oracle.sh
```

### 로컬 클라이언트

```bash
# 테스트 서버 실행
cd custom-tunnel/test-server
node app.js

# 터널 연결 (다른 터미널)
cd custom-tunnel
./connect.sh 3000 ws://YOUR_PUBLIC_IP

# 또는 다른 포트 사용
./connect.sh 8080 ws://YOUR_PUBLIC_IP
```

---

## ❓ 문제 해결

### 연결이 안 될 때

**1. Security List 확인**

- Oracle Cloud Console → Compute → Instances → Subnet → Security Lists
- Ingress Rule에 포트 80이 열려있는지 확인

**2. 서버 상태 확인**

```bash
ssh -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_PUBLIC_IP
sudo pm2 status
sudo pm2 logs tunnel-server
```

**3. 방화벽 확인**

```bash
# 서버에서
sudo iptables -L INPUT -n | grep 80
sudo netstat -tulpn | grep :80
```

### 자주 묻는 질문

**Q: 서버 재부팅 후에도 자동으로 시작되나요?**  
A: 네! `deploy-oracle.sh`가 PM2 auto-startup을 설정합니다.

**Q: 비용이 청구되나요?**  
A: 아니요! Always Free Tier는 평생 무료입니다.

**Q: 여러 터널을 동시에 사용할 수 있나요?**  
A: 네! 여러 클라이언트를 동시에 실행할 수 있습니다.

**Q: HTTPS를 사용하려면?**  
A: [ORACLE_CLOUD_GUIDE.md](ORACLE_CLOUD_GUIDE.md)의 8단계 참고 (Nginx + Let's Encrypt)

---

## 🎯 다음 단계

배포 완료 후 고려할 사항:

1. **도메인 연결**: Freenom 무료 도메인 + DNS 설정
2. **SSL 인증서**: Let's Encrypt (무료 HTTPS)
3. **모니터링**: UptimeRobot으로 서버 상태 모니터링
4. **백업**: 정기적으로 서버 백업

자세한 내용은 [ORACLE_CLOUD_GUIDE.md](ORACLE_CLOUD_GUIDE.md)를 참고하세요.

---

## 📚 관련 문서

- [ORACLE_CLOUD_GUIDE.md](ORACLE_CLOUD_GUIDE.md) - 상세 배포 가이드
- [DEPLOYMENT.md](DEPLOYMENT.md) - 다양한 배포 옵션
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - 문제 해결
- [README.md](README.md) - 프로젝트 개요

---

**축하합니다! 이제 무료로 영구 사용 가능한 터널 서버를 운영할 수 있습니다!** 🎉
