const express = require("express");
const app = express();

app.use(express.json());

// 홈 페이지
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🚇 Custom Tunnel Test Server</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          padding: 30px;
          border-radius: 10px;
          backdrop-filter: blur(10px);
        }
        h1 { font-size: 2.5em; margin-bottom: 10px; }
        p { font-size: 1.2em; line-height: 1.6; }
        .emoji { font-size: 3em; }
        .info { background: rgba(255, 255, 255, 0.2); padding: 15px; border-radius: 5px; margin: 15px 0; }
        button {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 10px 20px;
          font-size: 16px;
          border-radius: 5px;
          cursor: pointer;
          margin: 5px;
        }
        button:hover { background: #45a049; }
        #result { margin-top: 20px; padding: 15px; background: rgba(255, 255, 255, 0.2); border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="emoji">🎉</div>
        <h1>Custom Tunnel 작동 중!</h1>
        <p>축하합니다! 커스텀 터널이 정상적으로 작동하고 있습니다.</p>
        
        <div class="info">
          <h3>📊 서버 정보</h3>
          <p>포트: 3000</p>
          <p>시간: ${new Date().toLocaleString("ko-KR")}</p>
          <p>요청 IP: ${req.ip}</p>
        </div>

        <h3>🧪 API 테스트</h3>
        <button onclick="testApi()">API 호출 테스트</button>
        <button onclick="testPost()">POST 요청 테스트</button>
        <div id="result"></div>

        <script>
          async function testApi() {
            const result = document.getElementById('result');
            result.innerHTML = '⏳ API 호출 중...';
            
            try {
              const response = await fetch('/api/test');
              const data = await response.json();
              result.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
              result.innerHTML = '❌ 오류: ' + error.message;
            }
          }

          async function testPost() {
            const result = document.getElementById('result');
            result.innerHTML = '⏳ POST 요청 중...';
            
            try {
              const response = await fetch('/api/echo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Hello from tunnel!' })
              });
              const data = await response.json();
              result.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            } catch (error) {
              result.innerHTML = '❌ 오류: ' + error.message;
            }
          }
        </script>
      </div>
    </body>
    </html>
  `);
});

// API 엔드포인트 - GET
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Custom Tunnel API가 정상적으로 작동합니다!",
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  });
});

// API 엔드포인트 - POST
app.post("/api/echo", (req, res) => {
  res.json({
    success: true,
    echo: req.body,
    receivedAt: new Date().toISOString(),
  });
});

// 404 처리
app.use((req, res) => {
  res.status(404).send(`
    <h1>404 - Not Found</h1>
    <p>요청한 페이지를 찾을 수 없습니다: ${req.path}</p>
    <a href="/">홈으로 돌아가기</a>
  `);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 테스트 서버 실행 중: http://localhost:${PORT}`);
  console.log(`\n이 서버를 터널로 공개하려면:`);
  console.log(`cd ../client && npm start 3000\n`);
});
