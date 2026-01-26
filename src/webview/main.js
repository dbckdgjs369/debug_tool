const vscode = acquireVsCodeApi();

// Wake-up 타이머
let wakeupTimer = null;
let wakeupStartTime = null;

function startTunnel() {
  const port = document.getElementById("portInput").value;
  const useHttps = document.getElementById("httpsCheckbox").checked;

  if (!port) {
    return;
  }

  // 로딩 오버레이 표시
  showWakeupOverlay();

  vscode.postMessage({
    type: "startTunnel",
    port: parseInt(port),
    useHttps: useHttps,
  });

  // 입력 초기화
  document.getElementById("portInput").value = "";
  document.getElementById("httpsCheckbox").checked = false;
}

// Wake-up 오버레이 표시
function showWakeupOverlay() {
  const overlay = document.getElementById("wakeupOverlay");
  overlay.classList.add("active");

  // 초기 상태 설정
  updateWakeupStatus("서버 연결을 시작합니다...", 0);

  // 경과 시간 타이머 시작
  wakeupStartTime = Date.now();
  wakeupTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - wakeupStartTime) / 1000);
    document.getElementById("elapsedTime").textContent = elapsed;
  }, 1000);
}

// Wake-up 오버레이 숨기기
function hideWakeupOverlay() {
  const overlay = document.getElementById("wakeupOverlay");
  overlay.classList.remove("active");

  // 타이머 정리
  if (wakeupTimer) {
    clearInterval(wakeupTimer);
    wakeupTimer = null;
  }
  wakeupStartTime = null;

  // 초기화
  updateWakeupStatus("서버 연결을 시작합니다...", 0);
  document.getElementById("elapsedTime").textContent = "0";
}

// Wake-up 상태 업데이트
function updateWakeupStatus(message, progress) {
  document.getElementById("wakeupStatus").textContent = message;
  document.getElementById("progressFill").style.width = progress + "%";
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

  // Wake-up 진행 상황 업데이트
  if (message.type === "wakeupProgress") {
    updateWakeupStatus(message.status, message.progress);
  }

  // Wake-up 완료
  if (message.type === "wakeupComplete") {
    hideWakeupOverlay();
  }

  // Wake-up 실패
  if (message.type === "wakeupFailed") {
    hideWakeupOverlay();
  }

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

      // 현재 필터 상태 가져오기
      const select = document.getElementById(`filter-select-${tunnelId}`);
      const searchInput = document.getElementById(`search-input-${tunnelId}`);
      const activeLevel = select ? select.value : "all";
      const searchTerm = searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";

      // 새로 추가된 로그에 필터 적용
      const message_text = log.message.toLowerCase();
      const level_text = log.level.toLowerCase();

      let shouldHide = false;

      // 레벨 필터 체크
      if (activeLevel !== "all" && log.level !== activeLevel) {
        shouldHide = true;
      }

      // 검색어 필터 체크
      if (searchTerm && !shouldHide) {
        const matchesSearch =
          message_text.includes(searchTerm) || level_text.includes(searchTerm);
        if (!matchesSearch) {
          shouldHide = true;
        }
      }

      // 필터에 맞지 않으면 숨김
      if (shouldHide) {
        logItem.classList.add("hidden");
      }

      // 로그 카운트 업데이트
      updateLogCount(tunnelId);

      // 자동 스크롤 (콘솔이 열려있을 때만)
      if (content.classList.contains("expanded")) {
        content.scrollTop = content.scrollHeight;
      }
    }
  }

  if (message.type === "restoreLogs") {
    const tunnelId = message.tunnelId;
    const logs = message.logs;
    const content = document.getElementById(`console-content-${tunnelId}`);

    if (content && logs && logs.length > 0) {
      // 빈 상태 메시지 제거
      const emptyState = content.querySelector(".console-empty");
      if (emptyState) {
        emptyState.remove();
      }

      // 기존 로그 제거
      content.innerHTML = "";

      // 모든 로그 추가
      logs.forEach((log) => {
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
      });

      // 로그 카운트 업데이트
      updateLogCount(tunnelId);

      // 현재 필터 재적용
      const select = document.getElementById(`filter-select-${tunnelId}`);
      if (select && select.value !== "all") {
        filterLogsFromSelect(tunnelId);
      }

      const searchInput = document.getElementById(`search-input-${tunnelId}`);
      if (searchInput && searchInput.value.trim()) {
        searchLogs(tunnelId);
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

// 로그 카운트 업데이트 함수
function updateLogCount(tunnelId) {
  const content = document.getElementById(`console-content-${tunnelId}`);
  if (!content) {
    return;
  }

  const panel = content.closest(".console-panel");
  const titleSpan = panel
    ? panel.querySelector(".console-title span:last-child")
    : null;
  if (!titleSpan) {
    return;
  }

  const select = document.getElementById(`filter-select-${tunnelId}`);
  const searchInput = document.getElementById(`search-input-${tunnelId}`);
  const activeLevel = select ? select.value : "all";
  const searchTerm = searchInput ? searchInput.value.trim() : "";

  const logItems = content.querySelectorAll(".console-log-item");
  const totalCount = logItems.length;
  const visibleCount = Array.from(logItems).filter(
    (item) => !item.classList.contains("hidden"),
  ).length;

  // 카운트 텍스트 결정
  if (searchTerm) {
    titleSpan.textContent = `원격 콘솔 (${visibleCount}/${totalCount}) 🔍`;
  } else if (activeLevel === "all") {
    titleSpan.textContent = `원격 콘솔 (${totalCount})`;
  } else {
    titleSpan.textContent = `원격 콘솔 (${visibleCount}/${totalCount})`;
  }
}

// HTML 이스케이프 함수
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
