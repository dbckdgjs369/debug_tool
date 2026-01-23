const vscode = acquireVsCodeApi();

function startTunnel() {
  const port = document.getElementById("portInput").value;
  const useHttps = document.getElementById("httpsCheckbox").checked;

  if (!port) {
    return;
  }

  vscode.postMessage({
    type: "startTunnel",
    port: parseInt(port),
    useHttps: useHttps,
  });

  // 입력 초기화
  document.getElementById("portInput").value = "";
  document.getElementById("httpsCheckbox").checked = false;
}

function stopTunnel(tunnelId) {
  vscode.postMessage({
    type: "stopTunnel",
    tunnelId: tunnelId,
  });
}

function copyUrl(url) {
  vscode.postMessage({
    type: "copyUrl",
    url: url,
  });
}

function openUrl(url) {
  vscode.postMessage({
    type: "openUrl",
    url: url,
  });
}

// Enter 키로 터널 시작
document.getElementById("portInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    startTunnel();
  }
});

// QR 코드 표시
function showQRCode(url) {
  const modal = document.getElementById("qrModal");
  const qrContainer = document.querySelector(".qr-code-container");
  const qrUrl = document.getElementById("qrUrl");

  // URL 표시
  qrUrl.textContent = url;

  // 기존 QR 코드 제거
  qrContainer.innerHTML = "";

  // QR 코드 이미지 생성 (Google Charts API 사용)
  const qrSize = 200;
  const qrImg = document.createElement("img");
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(url)}`;
  qrImg.alt = "QR Code";
  qrImg.style.width = qrSize + "px";
  qrImg.style.height = qrSize + "px";
  qrImg.style.display = "block";

  qrContainer.appendChild(qrImg);

  // 모달 표시
  modal.classList.add("active");
}

// QR 코드 모달 닫기
function closeQRModal(event) {
  const modal = document.getElementById("qrModal");

  // 이벤트가 있고 모달 배경을 클릭한 경우나 버튼을 클릭한 경우
  if (!event || event.target === modal || event.type === "click") {
    modal.classList.remove("active");
  }
}

// ESC 키로 모달 닫기
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeQRModal();
  }
});

// 콘솔 토글
function toggleConsole(tunnelId) {
  const content = document.getElementById(`console-content-${tunnelId}`);
  const icon = document.getElementById(`console-toggle-icon-${tunnelId}`);

  if (content.classList.contains("expanded")) {
    content.classList.remove("expanded");
    icon.textContent = "▶";
  } else {
    content.classList.add("expanded");
    icon.textContent = "▼";
    // 스크롤을 맨 아래로
    setTimeout(() => {
      content.scrollTop = content.scrollHeight;
    }, 50);
  }
}

// 콘솔 클리어
function clearConsole(tunnelId) {
  vscode.postMessage({
    type: "clearLogs",
    tunnelId: tunnelId,
  });
}

// 로그 추가 이벤트 리스너
window.addEventListener("message", (event) => {
  const message = event.data;

  if (message.type === "logAdded") {
    const tunnelId = message.tunnelId;
    const log = message.log;
    const content = document.getElementById(`console-content-${tunnelId}`);

    if (content) {
      // 빈 상태 메시지 제거
      const emptyState = content.querySelector(".console-empty");
      if (emptyState) {
        emptyState.remove();
      }

      // 새 로그 아이템 생성
      const logItem = document.createElement("div");
      logItem.className = `console-log-item ${log.level}`;

      const time = new Date(log.timestamp).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      logItem.innerHTML = `
        <span class="console-log-time">${time}</span>
        <span class="console-log-level ${log.level}">${log.level.toUpperCase()}</span>
        <span class="console-log-message">${escapeHtml(log.message)}</span>
      `;

      content.appendChild(logItem);

      // 로그 카운트 업데이트
      const panel = content.closest(".console-panel");
      const titleSpan = panel
        ? panel.querySelector(".console-title span:last-child")
        : null;
      if (titleSpan) {
        const currentCount =
          content.querySelectorAll(".console-log-item").length;
        titleSpan.textContent = `원격 콘솔 (${currentCount})`;
      }

      // 자동 스크롤 (콘솔이 열려있을 때만)
      if (content.classList.contains("expanded")) {
        content.scrollTop = content.scrollHeight;
      }
    }
  }

  if (message.type === "logsCleared") {
    const tunnelId = message.tunnelId;
    const content = document.getElementById(`console-content-${tunnelId}`);

    if (content) {
      content.innerHTML =
        '<div class="console-empty">콘솔 로그가 없습니다</div>';

      // 로그 카운트 업데이트
      const panel = content.closest(".console-panel");
      const titleSpan = panel
        ? panel.querySelector(".console-title span:last-child")
        : null;
      if (titleSpan) {
        titleSpan.textContent = "원격 콘솔 (0)";
      }
    }
  }
});

// Select에서 필터 함수
function filterLogsFromSelect(tunnelId) {
  const select = document.getElementById(`filter-select-${tunnelId}`);
  const level = select.value;
  const content = document.getElementById(`console-content-${tunnelId}`);
  const logItems = content.querySelectorAll(".console-log-item");

  let visibleCount = 0;

  // 로그 아이템 필터링
  logItems.forEach((item) => {
    if (level === "all") {
      item.classList.remove("hidden");
      visibleCount++;
    } else {
      if (item.classList.contains(level)) {
        item.classList.remove("hidden");
        visibleCount++;
      } else {
        item.classList.add("hidden");
      }
    }
  });

  // 로그 카운트 업데이트
  const panel = content.closest(".console-panel");
  if (panel) {
    const titleSpan = panel.querySelector(".console-title span:last-child");
    if (titleSpan) {
      const totalCount = logItems.length;
      if (level === "all") {
        titleSpan.textContent = `원격 콘솔 (${totalCount})`;
      } else {
        titleSpan.textContent = `원격 콘솔 (${visibleCount}/${totalCount})`;
      }
    }
  }

  // 검색도 다시 적용
  searchLogs(tunnelId);
}

// 로그 검색 함수
function searchLogs(tunnelId) {
  const searchInput = document.getElementById(`search-input-${tunnelId}`);
  const searchTerm = searchInput.value.toLowerCase().trim();
  const content = document.getElementById(`console-content-${tunnelId}`);
  const panel = content.closest(".console-panel");
  const logItems = content.querySelectorAll(".console-log-item");

  let visibleCount = 0;

  // select에서 현재 선택된 레벨 가져오기
  const select = document.getElementById(`filter-select-${tunnelId}`);
  const activeLevel = select ? select.value : "all";

  logItems.forEach((item) => {
    const message = item
      .querySelector(".console-log-message")
      .textContent.toLowerCase();
    const level = item
      .querySelector(".console-log-level")
      .textContent.toLowerCase();

    // 검색어가 비어있으면 레벨 필터만 적용
    if (!searchTerm) {
      if (activeLevel === "all" || item.classList.contains(activeLevel)) {
        item.classList.remove("hidden");
        visibleCount++;
      } else {
        item.classList.add("hidden");
      }
    } else {
      // 검색어가 있으면 검색어 + 레벨 필터 모두 적용
      const matchesSearch =
        message.includes(searchTerm) || level.includes(searchTerm);
      const matchesFilter =
        activeLevel === "all" || item.classList.contains(activeLevel);

      if (matchesSearch && matchesFilter) {
        item.classList.remove("hidden");
        visibleCount++;
      } else {
        item.classList.add("hidden");
      }
    }
  });

  // 로그 카운트 업데이트
  if (panel) {
    const titleSpan = panel.querySelector(".console-title span:last-child");
    if (titleSpan) {
      const totalCount = logItems.length;
      if (searchTerm) {
        titleSpan.textContent = `원격 콘솔 (${visibleCount}/${totalCount}) 🔍`;
      } else {
        if (activeLevel === "all") {
          titleSpan.textContent = `원격 콘솔 (${totalCount})`;
        } else {
          titleSpan.textContent = `원격 콘솔 (${visibleCount}/${totalCount})`;
        }
      }
    }
  }
}

// 검색 초기화 함수
function clearSearch(tunnelId) {
  const searchInput = document.getElementById(`search-input-${tunnelId}`);
  searchInput.value = "";
  searchLogs(tunnelId);
}

// HTML 이스케이프 함수
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
