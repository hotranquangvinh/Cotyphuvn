const app = document.querySelector("#app");
const MONEY_BURST_DURATION = 1650;

const tokenIcons = {
  rocket: "🚀",
  boat: "⛵",
  bike: "♿",
  briefcase: "💼",
  train: "🚆",
  plane: "✈",
  gem: "◆",
  flag: "⚑"
};

const tokenColors = {
  rocket: "#6e5c97",
  boat: "#4d88a8",
  bike: "#43aa8b",
  briefcase: "#26375f",
  train: "#b45a58",
  plane: "#d79d31",
  gem: "#7b65c8",
  flag: "#2f7d68"
};

const state = {
  mode: null,
  sessionId: getSessionId(),
  selectedToken: "rocket",
  room: null,
  events: null,
  error: "",
  rolling: false,
  closingRoom: false,
  displayPositions: {},
  moveTimers: {},
  movingPieces: {},
  turnNotice: null,
  chanceCardReveals: {},
  chanceCardAnimated: {},
  chanceEffectScheduled: {},
  chanceDeckPhases: {},
  moneyBursts: {},
  moneyBurstTimers: {},
  pendingMoneyBursts: {},
  deferredMoneyBursts: {},
  lastCurrentPlayerId: null,
  noticeTimer: null,
  startingPickerTimer: null,
  purchaseSelection: null,
  sellPromptTileId: null
};

function playerColor(player) {
  return player?.color || tokenColors[player?.token] || "#2f7d68";
}

function getSessionId() {
  const existing = localStorage.getItem("ctpv-session-id");
  if (existing) return existing;
  const next = `s_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  localStorage.setItem("ctpv-session-id", next);
  return next;
}

function html(strings, ...values) {
  return strings.reduce((result, item, index) => result + item + (values[index] ?? ""), "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function api(path, payload) {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, sessionId: state.sessionId })
  }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Lỗi kết nối.");
    return data;
  });
}

function setError(error) {
  state.error = error?.message || error || "";
  render();
}

function tokenButton(token) {
  return html`
    <button class="token-button ${state.selectedToken === token ? "selected" : ""}" data-token="${token}" title="${token}">
      ${tokenIcons[token]}
    </button>
  `;
}

function renderMode() {
  app.innerHTML = html`
    <section class="screen mode-screen">
      <div class="mode-shell">
        <div class="mode-header">
          <p class="eyebrow">Multiplayer board game</p>
          <h1>Cờ Tỷ Phú Việt Nam</h1>
          <p>Chọn chế độ, tạo mã phòng riêng rồi mời bạn bè tham gia cùng ván. Bản hiện tại chạy chế độ truyền thống 4 người với địa danh Việt Nam.</p>
          ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
        </div>
        <div class="mode-grid">
          <article class="mode-card">
            <div class="mode-art"></div>
            <h2>Truyền thống 4 người</h2>
            <p>40 ô, 4 góc lớn, cơ hội, thuế, bãi biển, điện lực, thủy điện, nhà đất, xây nhà và khách sạn.</p>
            <button data-mode="classic">Chọn chế độ</button>
          </article>
          <article class="mode-card disabled">
            <div class="mode-art"></div>
            <h2>Mở rộng 4-8 người</h2>
            <p>Thêm nhiều ô, địa danh Việt Nam và thế giới. Chế độ này đã để sẵn giao diện để cập nhật sau.</p>
            <button disabled>Sắp cập nhật</button>
          </article>
        </div>
      </div>
    </section>
  `;
  app.querySelector("[data-mode='classic']").addEventListener("click", () => {
    state.mode = "classic";
    state.error = "";
    renderLobby();
  });
}

function renderLobby() {
  const room = state.room;
  app.innerHTML = html`
    <section class="screen lobby-screen">
      <div class="lobby-card">
        <div class="lobby-top">
          <div>
            <p class="eyebrow">Chế độ truyền thống</p>
            <h2>${room ? "Phòng chờ" : "Tạo hoặc tham gia phòng"}</h2>
            <p>Chủ phòng tự đặt mã phòng. Bạn bè nhập đúng mã để vào cùng một ván.</p>
          </div>
          <button class="ghost" data-back>← Chọn lại</button>
        </div>

        ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}

        <div class="form-grid">
          <label class="field">
            <span>Tên người chơi</span>
            <input id="nameInput" maxlength="18" placeholder="Ví dụ: Vinh" value="${escapeHtml(localStorage.getItem("ctpv-name") || "")}">
          </label>
          <label class="field">
            <span>Mã phòng</span>
            <input id="roomInput" maxlength="12" placeholder="VD: VN2026" value="${escapeHtml(room?.code || "")}">
          </label>
          <label class="field">
            <span>Chế độ</span>
            <select disabled><option>Truyền thống 4 người</option></select>
          </label>
        </div>

        <div>
          <p class="eyebrow">Chọn token</p>
          <div class="token-grid">${Object.keys(tokenIcons).map(tokenButton).join("")}</div>
        </div>

        <div class="lobby-actions">
          <button data-create>Tạo phòng</button>
          <button class="ghost" data-join>Tham gia phòng</button>
          ${room ? `<button data-start ${room.youId !== room.hostId ? "disabled" : ""}>Bắt đầu ván</button>` : ""}
        </div>

        ${room ? renderRoomSummary(room) : ""}
      </div>
    </section>
  `;

  app.querySelector("[data-back]").addEventListener("click", () => {
    leaveCurrentRoom();
  });
  app.querySelectorAll("[data-token]").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedToken = button.dataset.token;
      renderLobby();
    });
  });
  app.querySelector("[data-create]").addEventListener("click", createRoom);
  app.querySelector("[data-join]").addEventListener("click", joinRoomFromForm);
  app.querySelector("[data-start]")?.addEventListener("click", () => action("start"));
}

function renderRoomSummary(room) {
  return html`
    <div class="room-strip">
      <div>
        <div class="meta">Mã phòng</div>
        <div class="room-code">${escapeHtml(room.code)}</div>
      </div>
      <div class="meta">${room.players.length}/4 người chơi</div>
    </div>
    <div class="players-list">
      ${room.players.map(player => html`
        <article class="player-card">
          <div class="token-avatar" style="background:${playerColor(player)}">${tokenIcons[player.token]}</div>
          <div class="name">${escapeHtml(player.name)} ${player.host ? "• Chủ phòng" : ""}</div>
          <div class="meta">${player.connected ? "Đang kết nối" : "Mất kết nối"}</div>
        </article>
      `).join("")}
      ${Array.from({ length: Math.max(0, 4 - room.players.length) }).map(() => html`
        <article class="player-card">
          <div class="meta">Đang chờ bạn bè...</div>
        </article>
      `).join("")}
    </div>
  `;
}

async function createRoom() {
  try {
    const { name, code } = lobbyValues();
    const room = await api("/api/rooms", { mode: "classic", name, roomCode: code, token: state.selectedToken });
    localStorage.setItem("ctpv-name", name);
    applyRoomUpdate(room);
    state.error = "";
    connectEvents(room.code);
    renderLobby();
  } catch (error) {
    setError(error);
  }
}

async function joinRoomFromForm() {
  try {
    const { name, code } = lobbyValues();
    if (!code) throw new Error("Hãy nhập mã phòng.");
    const room = await api(`/api/rooms/${encodeURIComponent(code)}/join`, { name, token: state.selectedToken });
    localStorage.setItem("ctpv-name", name);
    applyRoomUpdate(room);
    state.error = "";
    connectEvents(room.code);
    renderLobby();
  } catch (error) {
    setError(error);
  }
}

function lobbyValues() {
  const name = app.querySelector("#nameInput")?.value.trim() || "Người chơi";
  const code = app.querySelector("#roomInput")?.value.trim().toUpperCase() || "";
  return { name, code };
}

function connectEvents(code) {
  disconnectEvents();
  state.events = new EventSource(`/api/rooms/${encodeURIComponent(code)}/events?sessionId=${encodeURIComponent(state.sessionId)}`);
  state.events.addEventListener("state", event => {
    applyRoomUpdate(JSON.parse(event.data));
    state.error = "";
    if (state.room.phase === "playing") renderGame();
    else renderLobby();
  });
  state.events.addEventListener("roomClosed", event => {
    const payload = JSON.parse(event.data);
    disconnectEvents();
    state.room = null;
    state.mode = null;
    state.error = payload.reason || "Phòng đã đóng.";
    renderMode();
  });
  state.events.onerror = () => {
    if (!state.closingRoom) state.error = "Mất kết nối realtime, trình duyệt sẽ tự thử lại.";
  };
}

function disconnectEvents() {
  if (state.events) {
    state.events.close();
    state.events = null;
  }
}

function leaveCurrentRoom() {
  const room = state.room;
  if (room) {
    state.closingRoom = true;
    navigator.sendBeacon?.(
      `/api/rooms/${encodeURIComponent(room.code)}/leave`,
      JSON.stringify({ sessionId: state.sessionId })
    );
    fetch(`/api/rooms/${encodeURIComponent(room.code)}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId }),
      keepalive: true
    }).catch(() => {});
  }
  disconnectEvents();
  state.room = null;
  state.mode = null;
  state.error = "";
  state.closingRoom = false;
  renderMode();
}

window.addEventListener("pagehide", () => {
  const room = state.room;
  const you = room?.players.find(player => player.id === room.youId);
  if (!room || !you?.host) return;
  navigator.sendBeacon?.(
    `/api/rooms/${encodeURIComponent(room.code)}/leave`,
    JSON.stringify({ sessionId: state.sessionId })
  );
});

async function action(type, payload = {}) {
  if (!state.room) return;
  try {
    if (type === "roll") {
      state.rolling = true;
      renderGame();
      await new Promise(resolve => setTimeout(resolve, 650));
    }
    const room = await api(`/api/rooms/${encodeURIComponent(state.room.code)}/action`, { type, payload });
    applyRoomUpdate(room);
    state.error = "";
    state.rolling = false;
    if (room.phase === "playing") renderGame();
    else renderLobby();
  } catch (error) {
    state.rolling = false;
    setError(error);
  }
}

async function confirmPurchase() {
  if (!state.room || !state.purchaseSelection) return;
  const selection = state.purchaseSelection;
  try {
    const firstType = selection.action === "build" ? "build" : "buy";
    const firstPayload = selection.action === "build" ? { level: selection.level } : {};
    await api(`/api/rooms/${encodeURIComponent(state.room.code)}/action`, { type: firstType, payload: firstPayload });
    const room = await api(`/api/rooms/${encodeURIComponent(state.room.code)}/action`, { type: "endTurn", payload: {} });
    state.purchaseSelection = null;
    applyRoomUpdate(room);
    state.error = "";
    if (room.phase === "playing") renderGame();
    else renderLobby();
  } catch (error) {
    setError(error);
  }
}

async function confirmSellProperty() {
  if (!state.room || state.sellPromptTileId === null) return;
  try {
    const room = await api(`/api/rooms/${encodeURIComponent(state.room.code)}/action`, {
      type: "sellProperty",
      payload: { tileId: state.sellPromptTileId }
    });
    state.sellPromptTileId = null;
    applyRoomUpdate(room);
    state.error = "";
    if (room.phase === "playing") renderGame();
    else renderLobby();
  } catch (error) {
    setError(error);
  }
}

function applyRoomUpdate(nextRoom) {
  const previousRoom = state.room;
  scheduleTurnNotice(previousRoom, nextRoom);
  scheduleStartingPickerEnd(nextRoom);
  trackCashChanges(previousRoom, nextRoom);
  preparePieceMovement(previousRoom, nextRoom);
  state.room = nextRoom;
  const you = nextRoom.players?.find(player => player.id === nextRoom.youId);
  const currentTileId = nextRoom.board?.[you?.position]?.id;
  if (!you || state.purchaseSelection?.tileId !== currentTileId || nextRoom.currentPlayerId !== you.id || !nextRoom.rolledThisTurn) {
    state.purchaseSelection = null;
  }
  const sellTile = nextRoom.board?.find(tile => tile.id === state.sellPromptTileId);
  const sellOwnership = sellTile ? nextRoom.ownership?.[sellTile.id] : null;
  if (!you || nextRoom.currentPlayerId !== you.id || !sellOwnership || sellOwnership.ownerId !== you.id || nextRoom.pending) {
    state.sellPromptTileId = null;
  }
}

function scheduleStartingPickerEnd(room) {
  window.clearTimeout(state.startingPickerTimer);
  const until = room?.startingPicker?.until;
  if (!until) return;
  const delay = Math.max(0, until - Date.now()) + 40;
  state.startingPickerTimer = window.setTimeout(() => {
    if (state.room?.phase === "playing") renderGame();
  }, delay);
}

function scheduleTurnNotice(previousRoom, nextRoom) {
  const previousCurrent = previousRoom?.currentPlayerId || null;
  if (nextRoom.phase !== "playing" || nextRoom.currentPlayerId === previousCurrent) return;
  const player = nextRoom.players.find(item => item.id === nextRoom.currentPlayerId);
  if (!player) return;
  state.turnNotice = {
    playerId: player.id,
    title: `Đến lượt ${player.name}`,
    text: "Người chơi hiện tại chuẩn bị thảy xúc xắc.",
    icon: tokenIcons[player.token] || "",
    until: Date.now() + 3000
  };
  window.clearTimeout(state.noticeTimer);
  state.noticeTimer = window.setTimeout(() => {
    state.turnNotice = null;
    if (state.room?.phase === "playing") renderGame();
  }, 3000);
}

function trackCashChanges(previousRoom, nextRoom) {
  if (!previousRoom?.players || !nextRoom?.players || previousRoom.phase !== "playing") return;
  const awaitingChanceKey = nextRoom.notice?.type === "chance" && nextRoom.notice.awaitingConfirm
    ? chanceNoticeKey(nextRoom.notice)
    : "";
  const confirmedChanceKey = nextRoom.notice?.type === "chance" && nextRoom.notice.confirmed
    ? chanceNoticeKey(nextRoom.notice)
    : "";
  const confirmedDeferred = confirmedChanceKey ? state.deferredMoneyBursts[confirmedChanceKey] || {} : {};
  const remainingDeferred = new Set(Object.keys(confirmedDeferred));

  for (const player of nextRoom.players) {
    const previous = previousRoom.players.find(item => item.id === player.id);
    if (!previous || previous.cash === player.cash) continue;
    const amount = player.cash - previous.cash;
    if (awaitingChanceKey && player.id === nextRoom.notice.playerId) {
      queueDeferredMoneyBurst(awaitingChanceKey, player.id, amount);
      continue;
    }

    const deferredAmount = Number(confirmedDeferred[player.id] || 0);
    remainingDeferred.delete(player.id);
    const totalAmount = amount + deferredAmount;
    if (shouldDelayMoneyBurst(previous, player, totalAmount)) {
      queuePendingMoneyBurst(player.id, totalAmount);
      continue;
    }
    showMoneyBurst(player.id, totalAmount);
  }

  for (const playerId of remainingDeferred) {
    showMoneyBurst(playerId, Number(confirmedDeferred[playerId] || 0));
  }
  if (confirmedChanceKey) delete state.deferredMoneyBursts[confirmedChanceKey];
}

function shouldDelayMoneyBurst(previous, player, amount) {
  return amount > 0 && previous.position !== player.position;
}

function queuePendingMoneyBurst(playerId, amount) {
  if (!playerId || !amount) return;
  state.pendingMoneyBursts[playerId] = Number(state.pendingMoneyBursts[playerId] || 0) + amount;
}

function releasePendingMoneyBurst(playerId) {
  const amount = Number(state.pendingMoneyBursts[playerId] || 0);
  if (!amount) return false;
  delete state.pendingMoneyBursts[playerId];
  showMoneyBurst(playerId, amount);
  return true;
}

function maybeReleasePendingMoneyBurst(playerId, tileId, force = false) {
  if (!state.pendingMoneyBursts[playerId]) return false;
  if (force || tileId === 0) return releasePendingMoneyBurst(playerId);
  return false;
}

function queueDeferredMoneyBurst(key, playerId, amount) {
  if (!key || !amount) return;
  state.deferredMoneyBursts[key] = state.deferredMoneyBursts[key] || {};
  state.deferredMoneyBursts[key][playerId] = Number(state.deferredMoneyBursts[key][playerId] || 0) + amount;
}

function showMoneyBurst(playerId, amount) {
  if (!amount) return;
  const burst = { amount, id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, startedAt: Date.now() };
  state.moneyBursts[playerId] = burst;
  window.clearTimeout(state.moneyBurstTimers[playerId]);
  state.moneyBurstTimers[playerId] = window.setTimeout(() => {
    if (state.moneyBursts[playerId]?.id === burst.id) delete state.moneyBursts[playerId];
    if (state.room?.phase === "playing") renderGame();
  }, MONEY_BURST_DURATION + 80);
}

function visibleMoneyBurst(playerId) {
  const burst = state.moneyBursts[playerId];
  if (!burst) return null;
  const elapsed = Date.now() - (burst.startedAt || Date.now());
  if (elapsed >= MONEY_BURST_DURATION) {
    delete state.moneyBursts[playerId];
    return null;
  }
  return { ...burst, elapsed };
}

function pendingCashOffset(room, playerId) {
  const pending = Number(state.pendingMoneyBursts[playerId] || 0);
  if (room.notice?.type !== "chance" || !room.notice.awaitingConfirm) return pending;
  const key = chanceNoticeKey(room.notice);
  return pending + Number(state.deferredMoneyBursts[key]?.[playerId] || 0);
}

function preparePieceMovement(previousRoom, nextRoom) {
  if (!nextRoom?.players) return;
  for (const player of nextRoom.players) {
    if (state.displayPositions[player.id] === undefined) {
      state.displayPositions[player.id] = player.position;
    }
  }
  if (!previousRoom || nextRoom.phase !== "playing") {
    for (const player of nextRoom.players) state.displayPositions[player.id] = player.position;
    return;
  }
  const roll = nextRoom.lastRoll;
  for (const player of nextRoom.players) {
    const previous = previousRoom.players.find(item => item.id === player.id);
    const chanceNotice = nextRoom.notice?.type === "chance" && nextRoom.notice.playerId === player.id ? nextRoom.notice : null;
    if (!previous) continue;
    if (chanceNotice) {
      const firstStop = chanceNotice.drawTileId ?? previous.position;
      if (chanceNotice.awaitingConfirm) {
        if (previous.position !== firstStop) {
          animatePiece(player.id, [{ path: buildMovePath(previous.position, firstStop, nextRoom.board.length, 1), delay: 300 }]);
        }
        continue;
      }
      if (chanceNotice.confirmed) {
        const chanceMovement = chanceNotice.movement?.playerId === player.id ? chanceNotice.movement : null;
        if (chanceMovement && previous.position !== player.position) {
          const start = chanceMovement.from ?? previous.position;
          if (state.displayPositions[player.id] !== start) state.displayPositions[player.id] = start;
          const direction = chanceMovement.steps >= 0 ? 1 : -1;
          const chancePath = buildMovePath(start, player.position, nextRoom.board.length, direction);
          animatePiece(player.id, [{ path: chancePath, delay: 560 }]);
        } else if (previous.position !== player.position) {
          state.displayPositions[player.id] = player.position;
          releasePendingMoneyBurst(player.id);
        }
        scheduleChanceDeckEffect(chanceNotice, 350);
        continue;
      }
    }
    if (previous.position === player.position) continue;
    const isRolledMove = roll?.playerId === player.id && ((previous.position + roll.total) % nextRoom.board.length) === player.position;
    if (!isRolledMove) {
      state.displayPositions[player.id] = player.position;
      releasePendingMoneyBurst(player.id);
      continue;
    }
    animatePiece(player.id, [{ path: buildMovePath(previous.position, player.position, nextRoom.board.length, 1), delay: 300 }]);
  }
}

function scheduleChanceDeckEffect(notice, returnDelay) {
  const key = chanceNoticeKey(notice);
  if (!key || state.chanceEffectScheduled[key]) return;
  state.chanceEffectScheduled[key] = true;
  window.setTimeout(() => {
    state.chanceDeckPhases[key] = "returning";
    if (state.room?.phase === "playing") renderGame();
  }, Math.max(900, returnDelay));
  window.setTimeout(() => {
    state.chanceDeckPhases[key] = "shuffling";
    if (state.room?.phase === "playing") renderGame();
  }, Math.max(900, returnDelay) + 720);
  window.setTimeout(() => {
    state.chanceDeckPhases[key] = "done";
    if (state.room?.phase === "playing") renderGame();
  }, Math.max(900, returnDelay) + 1700);
}

function buildMovePath(from, to, boardLength, direction = 1) {
  const path = [];
  let cursor = from;
  while (cursor !== to && path.length < boardLength) {
    cursor = direction >= 0 ? (cursor + 1) % boardLength : (boardLength + cursor - 1) % boardLength;
    path.push(cursor);
  }
  return path;
}

function animatePiece(playerId, segments) {
  window.clearTimeout(state.moveTimers[playerId]);
  state.movingPieces[playerId] = true;
  const queue = Array.isArray(segments?.[0]?.path) ? segments : [{ path: segments, delay: 300 }];
  let segmentIndex = 0;
  let stepIndex = 0;
  const step = () => {
    const segment = queue[segmentIndex];
    if (!segment) {
      delete state.movingPieces[playerId];
      const released = releasePendingMoneyBurst(playerId);
      if (state.room?.phase === "playing") renderGame();
      return;
    }
    if (stepIndex >= segment.path.length) {
      segmentIndex += 1;
      stepIndex = 0;
      state.moveTimers[playerId] = window.setTimeout(step, segment.pauseAfter ?? 260);
      return;
    }
    state.displayPositions[playerId] = segment.path[stepIndex];
    maybeReleasePendingMoneyBurst(playerId, state.displayPositions[playerId]);
    stepIndex += 1;
    if (state.room?.phase === "playing") renderGame();
    state.moveTimers[playerId] = window.setTimeout(step, segment.delay);
  };
  step();
}

function renderGame() {
  const room = state.room;
  const current = room.players.find(player => player.id === room.currentPlayerId);
  const you = room.players.find(player => player.id === room.youId);
  const startingPicker = activeStartingPicker(room);
  const huds = arrangeHuds(room.players, room.youId);
  const purchase = purchasePanelState(room, you, current);
  const sell = sellPanelState(room, you, current);
  const notice = purchase || sell ? null : boardNotice(room, current, you);

  app.innerHTML = html`
    <section class="screen game-screen">
      <div class="top-bar">
        <button class="ghost" data-lobby>← Phòng</button>
        <button class="icon-btn" data-copy title="Sao chép mã phòng">⧉</button>
        <span class="pill">Phòng ${escapeHtml(room.code)}</span>
        <span class="pill">Vòng ${room.round}</span>
      </div>

      ${huds.map((entry, index) => entry ? renderHud(entry, index, room) : "").join("")}

      <div class="board-wrap">
        <div class="board">
          ${room.board.map(tile => renderTile(tile, room)).join("")}
          <div class="center">
            ${sell ? renderSellPanel(sell) : purchase ? renderPurchasePanel(purchase, room) : ""}
            <div class="center-title ${notice ? "notice" : ""} ${notice?.fade ? "fade-out" : ""}">
              ${notice?.type === "chance" ? html`
                ${renderChanceCard(notice)}
              ` : notice ? html`
                <div class="notice-icon">${notice.icon}</div>
                <p class="eyebrow">${escapeHtml(notice.label)}</p>
                <h2>${escapeHtml(notice.title)}</h2>
                <p>${escapeHtml(notice.text)}</p>
              ` : ""}
            </div>
            <div class="dice-zone">
              <div class="dice-row">
                <div class="dice-pair">
                <div class="die ${state.rolling ? "rolling" : ""}">${room.dice[0]}</div>
                <div class="die ${state.rolling ? "rolling" : ""}">${room.dice[1]}</div>
                </div>
                <div class="chance-deck ${chanceDeckClass(room.notice)}" title="Bộ bài Cơ hội">
                  ${Array.from({ length: 5 }).map((_, index) => `<span style="--i:${index}">?</span>`).join("")}
                </div>
              </div>
              ${you?.id === current?.id ? `<button data-roll ${room.rolledThisTurn || Boolean(room.pending) ? "disabled" : ""}>Thảy xúc xắc</button>` : ""}
            </div>
          </div>
        </div>
      </div>

      ${startingPicker ? renderStartingPicker(room, startingPicker) : ""}
    </section>
  `;

  if (startingPicker) app.querySelector("[data-roll]")?.setAttribute("disabled", "");
  app.querySelector("[data-roll]")?.addEventListener("click", () => action("roll"));
  app.querySelector("[data-confirm-chance]")?.addEventListener("click", () => action("confirmChance"));
  app.querySelector("[data-lobby]")?.addEventListener("click", () => leaveCurrentRoom());
  app.querySelector("[data-copy]")?.addEventListener("click", () => navigator.clipboard?.writeText(room.code));
  app.querySelectorAll("[data-festival-tile]").forEach(tile => {
    tile.addEventListener("click", () => action("festival", { tileId: Number(tile.dataset.festivalTile) }));
  });
  app.querySelectorAll("[data-travel-tile]").forEach(tile => {
    tile.addEventListener("click", () => action("travel", { tileId: Number(tile.dataset.travelTile) }));
  });
  app.querySelectorAll("[data-sell-tile]").forEach(tile => {
    tile.addEventListener("click", () => {
      const tileId = Number(tile.dataset.sellTile);
      state.sellPromptTileId = state.sellPromptTileId === tileId ? null : tileId;
      state.purchaseSelection = null;
      renderGame();
    });
  });
  bindActionControls(room, you);
}

function activeStartingPicker(room) {
  return room?.startingPicker && Date.now() < room.startingPicker.until ? room.startingPicker : null;
}

function renderStartingPicker(room, picker) {
  const playerIds = picker.playerIds?.length ? picker.playerIds : room.players.map(player => player.id);
  const orderedPlayers = playerIds.map(playerId => room.players.find(player => player.id === playerId)).filter(Boolean);
  const selected = room.players.find(player => player.id === picker.playerId);
  const selectedIndex = Math.max(0, orderedPlayers.findIndex(player => player.id === picker.playerId));
  const count = Math.max(1, orderedPlayers.length);
  const selectedAngle = `${-(selectedIndex * 360 / count)}deg`;
  return html`
    <div class="starting-picker" role="status" aria-live="polite">
      <div class="starting-wheel" style="--selected-angle:${selectedAngle}">
        ${orderedPlayers.map((player, index) => html`
          <div class="starting-wheel-item ${player.id === picker.playerId ? "selected" : ""}" style="--angle:${index * 360 / count}deg;--reverse-angle:${-(index * 360 / count)}deg;--player:${playerColor(player)}">
            <span>${tokenIcons[player.token]}</span>
          </div>
        `).join("")}
        <div class="starting-wheel-core">
          <span style="background:${playerColor(selected)}">${selected ? tokenIcons[selected.token] : "?"}</span>
        </div>
      </div>
      <div class="starting-result">
        <p class="eyebrow">Người đi trước</p>
        <h2>${escapeHtml(selected?.name || "")}</h2>
        <p>Lượt kế tiếp đi theo chiều kim đồng hồ.</p>
      </div>
    </div>
  `;
}

function arrangeHuds(players, youId) {
  const you = players.find(player => player.id === youId);
  const others = players.filter(player => player.id !== youId);
  return [others[0], others[1], you, others[2]];
}

function renderHud(player, index, room) {
  const classes = ["hud-left-top", "hud-right-top", "hud-left-bottom", "hud-right-bottom"];
  const isYou = player.id === room.youId;
  const active = player.id === room.currentPlayerId;
  const burst = visibleMoneyBurst(player.id);
  const displayCash = player.cash - pendingCashOffset(room, player.id);
  return html`
    <article class="hud-card ${classes[index]} ${isYou ? "you" : ""} ${active ? "active" : ""}" style="--player:${playerColor(player)}">
      ${burst ? `<div class="money-burst ${burst.amount >= 0 ? "gain" : "loss"}" style="animation-delay:-${Math.max(0, Math.floor(burst.elapsed))}ms">${burst.amount >= 0 ? "+" : "-"}${Math.abs(burst.amount).toLocaleString("vi-VN")} tr</div>` : ""}
      <div class="hud-head">
        <div class="token-avatar" style="background:${playerColor(player)}">${tokenIcons[player.token]}</div>
        <div>
          <div class="name">${escapeHtml(player.name)}</div>
          <div class="cash">${displayCash.toLocaleString("vi-VN")} tr</div>
        </div>
      </div>
    </article>
  `;
}

function renderTile(tile, room) {
  const pos = boardPosition(tile.id);
  const edge = edgeClass(tile.id);
  const players = room.players.filter(player => displayPosition(player) === tile.id);
  const owner = tileOwner(tile, room);
  const ownership = room.ownership[tile.id];
  const level = ownership?.level || 0;
  const festivalTurns = ownership?.festivalTurns || 0;
  const pendingPlayer = room.pending?.playerId ? room.players.find(item => item.id === room.pending.playerId) : null;
  const pendingPlayerArrived = !pendingPlayer || playerHasArrived(pendingPlayer);
  const canChooseFestival = pendingPlayerArrived && room.pending?.type === "festival" && room.pending.playerId === room.youId && canHostFestivalOnTile(tile);
  const canChooseTravel = pendingPlayerArrived && room.pending?.type === "travel" && room.pending.playerId === room.youId && canTravelToTile(tile);
  const canSellTile = canSellProperty(tile, room);
  const visual = tileVisual(tile);

  return html`
    <div class="tile tile-${visual.className} ${tile.corner ? "corner" : ""} ${edge} ${canChooseFestival ? "festival-selectable" : ""} ${canChooseTravel ? "travel-selectable" : ""} ${canSellTile ? "sell-selectable" : ""}" ${canChooseFestival ? `data-festival-tile="${tile.id}"` : ""} ${canChooseTravel ? `data-travel-tile="${tile.id}"` : ""} ${canSellTile ? `data-sell-tile="${tile.id}"` : ""} style="grid-row:${pos.row};grid-column:${pos.col}">
      ${visual.symbol ? `<div class="tile-symbol ${visual.className}">${visual.symbol}</div>` : `<div class="tile-name">${tile.id === 0 ? "← " : ""}${escapeHtml(tile.name)}</div>`}
      ${visual.bar ? `<div class="color-bar color-${tile.color}"></div>` : ""}
      ${owner ? renderPropertyIcon(tile, owner, level) : ""}
      ${festivalTurns ? `<div class="festival-ribbon" title="Còn ${festivalTurns} vòng">Lễ hội</div>` : ""}
      <div class="players-on-tile">${players.map(player => html`
        <div class="piece ${state.movingPieces[player.id] ? "moving" : ""}" title="${escapeHtml(player.name)}" style="background:${playerColor(player)}">${tokenIcons[player.token]}</div>
      `).join("")}</div>
    </div>
  `;
}

function canTravelToTile(tile) {
  return ["land", "beach", "utility"].includes(tile.type);
}

function canHostFestivalOnTile(tile) {
  return tile.type === "land";
}

function canSellProperty(tile, room) {
  if (room.pending || room.phase !== "playing") return false;
  if (room.currentPlayerId !== room.youId) return false;
  const ownership = room.ownership[tile.id];
  return Boolean(ownership?.ownerId && ownership.ownerId === room.youId && ["land", "beach", "utility"].includes(tile.type));
}

function displayPosition(player) {
  return state.displayPositions[player.id] ?? player.position;
}

function renderPropertyIcon(tile, owner, level) {
  const color = playerColor(owner);
  if (tile.type === "beach") {
    return `<div class="property-icon palm" style="--owner:${color}" title="${escapeHtml(owner.name)}">${palmIcon()}</div>`;
  }
  if (tile.type === "land" && level === 4) {
    return `<div class="property-icon hotel" style="--owner:${color}" title="Khách sạn của ${escapeHtml(owner.name)}"><i></i><i></i><i></i><i></i></div>`;
  }
  if (tile.type === "land" && level <= 0) {
    return `<div class="property-icon flag" style="--owner:${color}" title="${escapeHtml(owner.name)}">${purchaseFlagIcon()}</div>`;
  }
  if (tile.type === "land" || tile.type === "utility") {
    return `<div class="property-icon house size-${Math.max(0, level)}" style="--owner:${color}" title="${escapeHtml(owner.name)}">${houseIcon()}</div>`;
  }
  return `<div class="owner-mark" title="${escapeHtml(owner.name)}">${escapeHtml(owner.name.slice(0, 2).toUpperCase())}</div>`;
}

function houseIcon() {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M7 32.5 28.4 11a5.1 5.1 0 0 1 7.2 0L57 32.5c3 3 1 8.2-3.3 8.2H48v13.5c0 2.7-2.1 4.8-4.8 4.8h-7.7V43.7h-7V59h-7.7c-2.7 0-4.8-2.1-4.8-4.8V40.7h-5.7C6 40.7 4 35.5 7 32.5Z"/></svg>`;
}

function palmIcon() {
  return `<svg viewBox="0 0 64 80" aria-hidden="true"><path d="M28 30C18 18 6 18 0 30c11-5 19-2 27 6C15 36 5 43 0 55c12-9 22-10 30-4-4 10-8 21-9 29h9c1-9 3-20 6-30 9 4 17 10 22 21 2-16-5-28-18-33 10-6 18-5 24 2-3-13-13-19-28-13 3-12 0-21-10-27 2 11 0 20-6 30Z"/></svg>`;
}

function tileVisual(tile) {
  if (tile.type === "chance") return { className: "chance", symbol: `<span class="card-icon">?</span>`, bar: false };
  if (tile.type === "travel") return { className: "travel", symbol: "✈", bar: false };
  if (tile.type === "beach") return { className: "beach", symbol: "", bar: false };
  if (tile.type === "tax") return { className: "tax", symbol: "", bar: false };
  if (tile.type === "utility" && tile.name.includes("điện lực")) return { className: "electric", symbol: "", bar: false };
  if (tile.type === "utility") return { className: "hydro", symbol: "", bar: false };
  if (["start", "jail", "festival"].includes(tile.type)) return { className: tile.type, symbol: "", bar: false };
  return { className: tile.type || "land", symbol: "", bar: tile.type === "land" };
}

function boardNotice(room, current, you) {
  if (!current) return null;
  if (room.notice && room.notice.type === "chance" && (room.notice.awaitingConfirm || Date.now() - room.notice.at < 12000)) {
    if (!chanceCardCanShow(room.notice)) return null;
    if (["shuffling", "done"].includes(chanceDeckPhase(room.notice))) return null;
    return {
      icon: room.notice.icon || "",
      label: "Cơ hội",
      title: room.notice.title,
      text: room.notice.text,
      result: room.notice.result,
      drawTileId: room.notice.drawTileId,
      playerId: room.notice.playerId,
      at: room.notice.at,
      chanceId: room.notice.chanceId,
      awaitingConfirm: room.notice.awaitingConfirm,
      confirmed: room.notice.confirmed,
      canConfirm: room.notice.awaitingConfirm && room.notice.playerId === you?.id,
      type: room.notice.type
    };
  }
  if (!playerHasArrived(current)) return null;
  const tile = room.board[current.position];
  const pendingForCurrent = room.pending?.playerId === current.id ? room.pending : null;
  if (pendingForCurrent?.type === "festival") {
    return {
      icon: "🎉",
      label: "Ô lễ hội",
      title: "Chọn 1 địa điểm tổ chức lễ hội",
      text: current.id === you?.id ? "Bấm trực tiếp vào một ô đất có thể mua hoặc xây nhà." : `${current.name} đang chọn địa điểm tổ chức lễ hội.`
    };
  }
  if (pendingForCurrent?.type === "travel") {
    return {
      icon: "✈",
      label: "Ô du lịch",
      title: "Chọn 1 địa điểm bất kì để bay đến",
      text: current.id === you?.id ? "Bấm trực tiếp vào một ô đất, bãi biển hoặc công ty trên bàn cờ." : `${current.name} đang chọn điểm đến.`
    };
  }
  if (current.inJail) {
    return {
      icon: "⛓",
      label: "Nhà tù",
      title: "Bạn là tù nhân",
      text: "Cần thảy 2 xúc xắc giống nhau để ra tù."
    };
  }
  if (room.notice && Date.now() - room.notice.at < 5000) {
    return {
      icon: room.notice.icon || "",
      label: "Thông báo",
      title: room.notice.title,
      text: room.notice.text,
      type: room.notice.type
    };
  }
  if (state.turnNotice && Date.now() < state.turnNotice.until) {
    return {
      icon: state.turnNotice.icon,
      label: "Lượt hiện tại",
      title: state.turnNotice.title,
      text: state.turnNotice.text,
      fade: true
    };
  }
  if (!room.rolledThisTurn && tile.type !== "start") return null;
  const notices = {
    start: ["←", "Bắt đầu", "Đi qua hoặc dừng tại đây nhận 300 tr."],
    jail: ["⛓", "Nhà tù", "Bạn là tù nhân, cần thảy 2 xúc xắc giống nhau để ra tù."],
    festival: ["🎉", "Lễ hội", "Chọn 1 địa điểm tổ chức lễ hội"],
    travel: ["✈", "Du lịch", "Chọn 1 địa điểm bất kì để bay đến"],
    tax: ["₫", "Đóng thuế", "Tất cả người chơi cùng bị trừ tiền thuế."]
  };
  const data = notices[tile.type];
  if (!data) return null;
  return { icon: data[0], label: "Ô chức năng", title: data[1], text: data[2] };
}

function chanceCardCanShow(notice) {
  if (notice.drawTileId === undefined || !notice.playerId) return true;
  const key = chanceNoticeKey(notice);
  if (state.chanceCardReveals[key]) return true;
  if (state.displayPositions[notice.playerId] !== notice.drawTileId) return false;
  state.chanceCardReveals[key] = true;
  return true;
}

function renderChanceCard(notice) {
  const key = chanceNoticeKey(notice);
  const phase = chanceDeckPhase(notice);
  const shouldDeal = key && !state.chanceCardAnimated[key];
  if (shouldDeal) state.chanceCardAnimated[key] = true;
  if (phase === "shuffling" || phase === "done") return "";
  return html`
    <article class="drawn-card ${shouldDeal ? "deal" : "settled"} ${phase === "returning" ? "returning" : ""}" aria-label="Lá bài Cơ hội ${escapeHtml(notice.title)}">
      <h2>${escapeHtml(notice.title)}</h2>
      <p class="chance-card-text">${escapeHtml(notice.text)}</p>
      ${notice.result ? `<p class="chance-card-result">${escapeHtml(notice.result)}</p>` : ""}
      ${notice.awaitingConfirm ? `<button class="chance-confirm" data-confirm-chance ${notice.canConfirm ? "" : "disabled"}>Xác nhận</button>` : ""}
    </article>
  `;
}

function chanceNoticeKey(notice) {
  if (notice?.chanceId) return notice.chanceId;
  return notice?.playerId && notice?.at ? `${notice.playerId}:${notice.at}` : "";
}

function chanceDeckPhase(notice) {
  const key = chanceNoticeKey(notice);
  return key ? state.chanceDeckPhases[key] || "shown" : "shown";
}

function chanceDeckClass(notice) {
  return notice?.type === "chance" && chanceDeckPhase(notice) === "shuffling" ? "shuffling" : "";
}

function playerHasArrived(player) {
  return Boolean(player && state.displayPositions[player.id] === player.position);
}

function boardPosition(index) {
  if (index === 0) return { row: 11, col: 11 };
  if (index > 0 && index < 10) return { row: 11, col: 11 - index };
  if (index === 10) return { row: 11, col: 1 };
  if (index > 10 && index < 20) return { row: 21 - index, col: 1 };
  if (index === 20) return { row: 1, col: 1 };
  if (index > 20 && index < 30) return { row: 1, col: index - 19 };
  if (index === 30) return { row: 1, col: 11 };
  return { row: index - 29, col: 11 };
}

function edgeClass(index) {
  if (index > 0 && index < 10) return "bottom-edge";
  if (index > 10 && index < 20) return "left-edge";
  if (index > 20 && index < 30) return "top-edge";
  if (index > 30 && index < 40) return "right-edge";
  return "";
}

function tileOwner(tile, room) {
  const ownerId = room.ownership[tile.id]?.ownerId;
  return room.players.find(player => player.id === ownerId);
}

function rentText(tile, room) {
  if (!room.ownership[tile.id]?.ownerId) return `${tile.rent || 0} tr`;
  return `${estimateRent(tile, room)} tr`;
}

function estimateRent(tile, room) {
  const own = room.ownership[tile.id];
  if (!own?.ownerId) return tile.rent || 0;
  if (tile.type === "beach") {
    const count = room.board.filter(item => item.type === "beach" && room.ownership[item.id]?.ownerId === own.ownerId).length;
    return [0, 25, 55, 110, 220][count] || 25;
  }
  if (tile.type === "utility") {
    const count = room.board.filter(item => item.type === "utility" && room.ownership[item.id]?.ownerId === own.ownerId).length;
    const roll = room.lastRoll?.total || 7;
    return roll * (count >= 2 ? 30 : 12);
  }
  const multiplier = [1, 1.8, 2.8, 4.2, 6.5][own.level || 0] || 1;
  const festival = own.festivalTurns > 0 ? 2 : 1;
  return Math.ceil((tile.rent || 0) * multiplier * festival);
}

function purchasePanelState(room, you, current) {
  if (!you || you.id !== current?.id || !room.rolledThisTurn || room.pending) return null;
  if (!playerHasArrived(you)) return null;
  const tile = room.board[you.position];
  const ownership = room.ownership[tile.id];
  const owner = tileOwner(tile, room);
  const ownedByYou = owner?.id === you.id;
  if (tile.type === "land" && ownedByYou && (ownership?.level || 0) >= 4) {
    return null;
  }
  if (tile.type === "land" && ownedByYou && (ownership?.level || 0) >= 3 && ownership?.hotelReady && canBuildLevelForPlayer(you, 4)) {
    return { tile, ownership, owner, ownedByYou, you, kind: "hotel" };
  }
  if (tile.type === "land" && (!ownership?.ownerId || ownedByYou)) {
    return { tile, ownership, owner, ownedByYou, you, kind: "land" };
  }
  if (isBuyable(tile, ownership) && ["beach", "utility"].includes(tile.type)) {
    return { tile, ownership, owner, ownedByYou, you, kind: tile.type };
  }
  return null;
}

function sellPanelState(room, you, current) {
  if (!you || you.id !== current?.id || state.sellPromptTileId === null || room.pending) return null;
  const tile = room.board.find(item => item.id === state.sellPromptTileId);
  if (!tile || !isBuyableOwnedByYou(tile, room, you)) return null;
  return { tile, ownership: room.ownership[tile.id], you };
}

function isBuyableOwnedByYou(tile, room, you) {
  const ownership = room.ownership[tile.id];
  return Boolean(ownership?.ownerId === you.id && ["land", "beach", "utility"].includes(tile.type));
}

function renderPurchasePanel(panel, room) {
  const { tile, ownership, you, kind } = panel;
  const selected = currentPurchaseSelection(tile);
  const isHotelUpgrade = kind === "hotel";
  return html`
    <aside class="purchase-panel">
      <h3>Bạn đã đến ${escapeHtml(tile.name)}</h3>
      <p class="meta">${escapeHtml(tile.region || tile.description || "")}</p>
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
      <div class="action-list">
        ${isHotelUpgrade ? renderHotelUpgradeOption(tile, ownership, you) : kind === "land" ? renderLandMainOptions(tile, ownership, you) : renderPurchaseChoice(tile, { action: "buy", label: buyLabel(tile), cost: tile.price }, you)}
        <div class="purchase-actions">
          <button class="ghost" data-end>${isHotelUpgrade ? "Không xây" : "Không mua"}</button>
          <button data-confirm-purchase ${selected ? "" : "disabled"}>${isHotelUpgrade ? "Xây" : "Mua"}</button>
        </div>
      </div>
    </aside>
  `;
}

function renderSellPanel(panel) {
  const { tile, ownership } = panel;
  const amount = sellValue(tile, ownership);
  return html`
    <aside class="purchase-panel sell-panel">
      <h3>${sellTitle(tile, ownership)}</h3>
      <p class="meta">${escapeHtml(tile.name)} • nhận lại ${amount} tr</p>
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
      <div class="action-list">
        <button class="sell-summary" disabled>
          <span>${sellIcon(tile, ownership)}</span>
          <strong>${amount} tr</strong>
        </button>
        <div class="purchase-actions">
          <button class="ghost" data-cancel-sell>Không bán</button>
          <button data-confirm-sell>Bán</button>
        </div>
      </div>
    </aside>
  `;
}

function sellTitle(tile, ownership) {
  if (tile.type === "land" && (ownership?.level || 0) >= 4) return "Bạn có muốn bán khách sạn này?";
  if (tile.type === "land" && (ownership?.level || 0) > 0) return "Bạn có muốn bán nhà này?";
  if (tile.type === "land") return "Bạn có muốn bán đất này?";
  return "Bạn có muốn bán tài sản này?";
}

function sellIcon(tile, ownership) {
  if (tile.type === "land" && (ownership?.level || 0) >= 4) return purchaseHotelIcon();
  if (tile.type === "land" && (ownership?.level || 0) > 0) return purchaseHouseIcon(ownership.level);
  if (tile.type === "beach") return palmIcon();
  return purchaseFlagIcon();
}

function renderHotelUpgradeOption(tile, ownership, player) {
  const cost = buildCost(tile.price, ownership?.level || 3, 4);
  return html`
    <div class="purchase-grid hotel-grid">
      ${renderPurchaseChoice(tile, { action: "build", level: 4, label: "Xây khách sạn", cost }, player)}
    </div>
  `;
}

function canBuildLevelForPlayer(player, targetLevel) {
  return targetLevel < 3 || (player?.laps || 0) >= 1;
}

function renderLandMainOptions(tile, ownership, player) {
  const level = ownership?.level || 0;
  if (!ownership?.ownerId) {
    const options = [1, 2, 3].filter(target => canBuildLevelForPlayer(player, target)).map(target => {
      const label = ["", "Xây nhà nhỏ", "Xây nhà vừa", "Xây nhà lớn"][target];
      const cost = tile.price + buildCost(tile.price, 0, target);
      return renderPurchaseChoice(tile, { action: "build", level: target, label, cost }, player);
    });
    return html`
      <div class="purchase-grid">
        ${renderPurchaseChoice(tile, { action: "buy", label: `Mua đất ${tile.name}`, cost: tile.price }, player)}
        ${options.join("")}
      </div>
    `;
  }
  const options = [1, 2, 3, 4].map(target => {
    const label = ["", "Xây nhà nhỏ", "Xây nhà vừa", "Xây nhà lớn", "Xây khách sạn"][target];
    const canBuild = target > level && canBuildLevelForPlayer(player, target) && (target < 4 || (level >= 3 && ownership?.hotelReady));
    const cost = canBuild ? buildCost(tile.price, level, target) : 0;
    return renderPurchaseChoice(tile, { action: "build", level: target, label, cost, disabled: !canBuild }, player);
  });
  return `<div class="purchase-grid">${options.join("")}</div>`;
}

function currentPurchaseSelection(tile) {
  return state.purchaseSelection?.tileId === tile.id ? state.purchaseSelection : null;
}

function renderPurchaseChoice(tile, option, player) {
  const selected = currentPurchaseSelection(tile);
  const disabled = option.disabled || player.cash < option.cost;
  const isSelected = selected?.action === option.action && (option.action !== "build" || selected.level === option.level);
  const attrs = option.action === "build"
    ? `data-purchase-action="build" data-purchase-level="${option.level}"`
    : `data-purchase-action="buy"`;
  const icon = option.action === "buy" ? purchaseFlagIcon() : option.level >= 4 ? purchaseHotelIcon() : purchaseHouseIcon(option.level);
  return html`
    <button
      class="purchase-choice ${isSelected ? "selected-choice" : ""}"
      style="--choice-color:#0c0d0f"
      title="${escapeHtml(option.label)}"
      aria-label="${escapeHtml(`${option.label} ${option.cost} triệu`)}"
      ${attrs}
      ${disabled ? "disabled" : ""}
    >
      <span class="purchase-icon">${icon}</span>
      <span class="purchase-price">${option.cost} tr</span>
    </button>
  `;
}

function purchaseFlagIcon() {
  return `
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <path d="M35 18h6v60h-6z"/>
      <path d="M41 20 76 34 41 48z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="miter"/>
      <path d="M28 62h35l8 20H20z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="miter"/>
    </svg>
  `;
}

function purchaseHouseIcon(level = 1) {
  const sizeClass = `house-level-${Math.max(1, Math.min(3, level))}`;
  return `
    <svg class="${sizeClass}" viewBox="0 0 96 96" aria-hidden="true">
      <path d="M16 46 45 21a5 5 0 0 1 6.5 0L80 46c2.3 2 1 6-2.3 6H72v27H56V57H40v22H24V52h-5.7c-3.2 0-4.7-4-2.3-6Z"/>
    </svg>
  `;
}

function purchaseHotelIcon() {
  return `
    <svg class="hotel-level" viewBox="0 0 96 96" aria-hidden="true">
      <path d="M24 39h48v47H24z"/>
      <path d="M13 48h18v38H13zM65 48h18v38H65z"/>
      <path d="M31 25h34v16H31z"/>
      <path d="M40 13h16l4 8 9 2-7 6 2 9-8-5-8 5 2-9-7-6 9-2z"/>
      <path d="M39 51h7v7h-7zM50 51h7v7h-7zM39 63h7v7h-7zM50 63h7v7h-7zM42 76h12v10H42z" fill="#fff"/>
      <path d="M38 31h20v4H38z" fill="#fff"/>
    </svg>
  `;
}

function isBuyable(tile, ownership) {
  return ["land", "beach", "utility"].includes(tile.type) && !ownership?.ownerId;
}

function buyLabel(tile) {
  if (tile.type === "land") return `Mua đất ${escapeHtml(tile.name)}`;
  if (tile.type === "beach") return `Mua bãi biển ${escapeHtml(tile.name)}`;
  return `Mua ${escapeHtml(tile.name)}`;
}

function renderBuildButtons(tile, ownership, player) {
  const level = ownership?.level || 0;
  const options = [1, 2, 3, 4].filter(target => target > level && (target < 4 || (level >= 3 && ownership?.hotelReady)));
  if (!options.length) {
    return `<button disabled>${level >= 4 ? "Đã là khách sạn" : "Quay lại ô này để xây khách sạn"}</button>`;
  }
  return options.map(target => {
    const cost = buildCost(tile.price, level, target);
    const label = ["", "Xây nhà nhỏ", "Xây nhà vừa", "Xây nhà lớn", "Xây khách sạn"][target];
    return renderPurchaseChoice(tile, { action: "build", level: target, label, cost }, player);
  }).join("");
}

function buildCost(price, currentLevel, targetLevel) {
  const multipliers = { 1: 0.45, 2: 0.7, 3: 0.95, 4: 1.25 };
  let total = 0;
  for (let level = currentLevel + 1; level <= targetLevel; level += 1) {
    total += Math.ceil(price * multipliers[level] / 10) * 10;
  }
  return total;
}

function propertyValue(tile, ownership = {}) {
  const level = ownership.level || 0;
  return tile.price + (tile.type === "land" && level > 0 ? buildCost(tile.price, 0, level) : 0);
}

function sellValue(tile, ownership = {}) {
  return Math.ceil(propertyValue(tile, ownership) * 0.75 / 10) * 10;
}

function renderOfferForm(tile, player) {
  const suggested = Math.min(player.cash, Math.ceil((tile.price || 100) * 1.35));
  return html`
    <div class="inline-form">
      <input data-offer-input="${tile.id}" type="number" min="1" step="10" value="${suggested}" aria-label="Giá đề nghị">
      <button data-offer="${tile.id}">Đề nghị mua</button>
    </div>
  `;
}

function renderIncomingOffer(offer, room) {
  const buyer = room.players.find(player => player.id === offer.fromPlayerId);
  const tile = room.board[offer.tileId];
  return html`
    <button class="ghost" data-accept-offer="${offer.id}">
      Bán ${escapeHtml(tile.name)} cho ${escapeHtml(buyer?.name || "người chơi")} • ${offer.amount} tr
    </button>
  `;
}

function bindActionControls(room, you) {
  app.querySelectorAll("[data-purchase-action]").forEach(button => {
    button.addEventListener("click", () => {
      const tile = room.board[you.position];
      state.purchaseSelection = {
        tileId: tile.id,
        action: button.dataset.purchaseAction,
        level: button.dataset.purchaseLevel ? Number(button.dataset.purchaseLevel) : null
      };
      renderGame();
    });
  });
  app.querySelector("[data-confirm-purchase]")?.addEventListener("click", confirmPurchase);
  app.querySelector("[data-confirm-sell]")?.addEventListener("click", confirmSellProperty);
  app.querySelector("[data-cancel-sell]")?.addEventListener("click", () => {
    state.sellPromptTileId = null;
    renderGame();
  });
  app.querySelector("[data-end]")?.addEventListener("click", () => action("endTurn"));
  app.querySelectorAll("[data-offer]").forEach(button => {
    button.addEventListener("click", () => {
      const tileId = Number(button.dataset.offer);
      const amount = Number(app.querySelector(`[data-offer-input="${tileId}"]`).value);
      action("offer", { tileId, amount });
    });
  });
  app.querySelectorAll("[data-accept-offer]").forEach(button => {
    button.addEventListener("click", () => action("acceptOffer", { offerId: button.dataset.acceptOffer }));
  });
}

renderMode();
