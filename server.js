const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const START_CASH = 3200;
const PASS_START_BONUS = 300;
const TAX_AMOUNT = 180;
const MAX_LOGS = 80;

const rooms = new Map();

const tokens = ["rocket", "boat", "bike", "briefcase", "train", "plane", "gem", "flag"];
const playerColors = ["#2f9e44", "#228be6", "#e03131", "#f2c94c"];

const boardTemplate = [
  corner(0, "Bắt đầu", "start", "Đi qua nhận 300 tr"),
  land(1, "Đất Mũi", "Cà Mau", 600, 120, "green"),
  land(2, "Thành phố Cà Mau", "Cà Mau", 560, 112, "green"),
  special(3, "Cơ hội", "chance", "?"),
  land(4, "Bạc Liêu", "Bạc Liêu", 520, 104, "green"),
  beach(5, "Bãi biển Phú Quốc", "Kiên Giang", 200),
  land(6, "Cần Thơ", "Miền Tây", 500, 100, "teal"),
  land(7, "Sóc Trăng", "Sóc Trăng", 400, 78, "purple"),
  land(8, "Mỹ Tho", "Tiền Giang", 360, 72, "purple"),
  land(9, "Vũng Tàu", "Bà Rịa - Vũng Tàu", 360, 72, "purple"),
  corner(10, "Nhà tù", "jail", "Mắc kẹt đến khi đổ đôi"),
  land(11, "TP. Hồ Chí Minh", "Miền Nam", 200, 40, "pink"),
  utility(12, "Nhà máy thủy điện", "Sông Đà", 160),
  land(13, "Tây Ninh", "Tây Ninh", 220, 44, "pink"),
  land(14, "Đà Lạt", "Lâm Đồng", 240, 48, "pink"),
  beach(15, "Bãi biển Mũi Né", "Bình Thuận", 200),
  land(16, "Phan Thiết", "Bình Thuận", 260, 52, "orange"),
  special(17, "Cơ hội", "chance", "?"),
  land(18, "Nha Trang", "Khánh Hòa", 280, 56, "orange"),
  land(19, "Quy Nhơn", "Bình Định", 300, 60, "orange"),
  corner(20, "Lễ hội", "festival", "Chọn một đất để mở lễ hội 4 vòng"),
  land(21, "Phố cổ Hội An", "Quảng Nam", 320, 64, "red"),
  land(22, "Đà Nẵng", "Miền Trung", 340, 68, "red"),
  special(23, "Cơ hội", "chance", "?"),
  land(24, "Kinh Thành Huế", "Huế", 360, 72, "red"),
  beach(25, "Bãi biển Mỹ Khê", "Đà Nẵng", 200),
  land(26, "Phong Nha - Kẻ Bàng", "Quảng Bình", 380, 76, "gold"),
  land(27, "Vinh", "Nghệ An", 400, 80, "gold"),
  utility(28, "Công ty điện lực", "Toàn quốc", 160),
  land(29, "Tràng An", "Ninh Bình", 420, 84, "gold"),
  corner(30, "Du lịch", "travel", "Di chuyển đến một ô bất kỳ"),
  land(31, "Hà Nội", "Miền Bắc", 440, 88, "lime"),
  land(32, "Hồ Gươm", "Hà Nội", 460, 92, "lime"),
  land(33, "Vịnh Hạ Long", "Quảng Ninh", 480, 96, "lime"),
  beach(34, "Bãi biển Cát Bà", "Hải Phòng", 200),
  land(35, "Mộc Châu", "Sơn La", 540, 108, "teal"),
  special(36, "Đóng thuế", "tax", `Mỗi người trừ ${TAX_AMOUNT} tr`),
  land(37, "Sa Pa", "Lào Cai", 580, 116, "teal"),
  land(38, "Fansipan", "Lào Cai", 600, 120, "teal"),
  land(39, "Lũng Cú", "Hà Giang", 620, 124, "teal")
];

const chanceCards = [
  { title: "Gặp đường tắt", text: "Tiến 3 ô.", effect: "moveRelative", steps: 3 },
  { title: "Lạc hẻm", text: "Lùi 3 ô.", effect: "moveRelative", steps: -3 },
  { title: "Xe khách chạy nhanh", text: "Tiến 6 ô.", effect: "moveRelative", steps: 6 },
  { title: "Quên hành lý", text: "Lùi 5 ô.", effect: "moveRelative", steps: -5 },
  { title: "Bay về cực Nam", text: "Đến Đất Mũi.", effect: "moveTo", tileId: 1 },
  { title: "Chuyến bay thủ đô", text: "Đến Hà Nội.", effect: "moveTo", tileId: 31 },
  { title: "Nghỉ dưỡng Phú Quốc", text: "Đến bãi biển Phú Quốc.", effect: "moveTo", tileId: 5 },
  { title: "Gần biển thì ghé", text: "Đến bãi biển gần nhất.", effect: "nearestType", tileType: "beach" },
  { title: "Trúng hợp đồng", text: "Nhận 250 tr.", effect: "money", amount: 250 },
  { title: "Tiền thưởng nhỏ", text: "Nhận 120 tr.", effect: "money", amount: 120 },
  { title: "Sửa xe khẩn cấp", text: "Trả 180 tr.", effect: "money", amount: -180 },
  { title: "Mất ví du lịch", text: "Trả 100 tr.", effect: "money", amount: -100 },
  { title: "Sinh nhật tưng bừng", text: "Mỗi người chơi trả bạn 80 tr.", effect: "collectFromAll", amount: 80 },
  { title: "Mời cả bàn ăn", text: "Trả mỗi người chơi 70 tr.", effect: "payAll", amount: 70 },
  { title: "Lì xì đầu vòng", text: "Tất cả người chơi nhận 100 tr.", effect: "allMoney", amount: 100 },
  { title: "Bão tài chính", text: "Tất cả người chơi mất 80 tr.", effect: "allMoney", amount: -80 },
  { title: "Đòi nợ người giàu", text: "Người giàu nhất trả bạn 150 tr.", effect: "targetRichestPays", amount: 150 },
  { title: "Giúp người khó khăn", text: "Bạn trả người ít tiền nhất 120 tr.", effect: "payPoorest", amount: 120 },
  { title: "Xui rủi", text: "Tung vận may, có thể được hoặc mất tiền.", effect: "randomLuck" },
  { title: "Bán bớt nhà", text: "Bán 1 cấp công trình cao nhất để lấy tiền.", effect: "sellHighestBuilding" },
  { title: "Sang nhượng bắt buộc", text: "Chuyển 1 đất/nhà của bạn cho người khác và nhận bồi hoàn.", effect: "transferOwnProperty" },
  { title: "Thâu tóm bất ngờ", text: "Nhận chuyển nhượng 1 đất/nhà của người khác và trả phí.", effect: "takeOtherProperty" },
  { title: "Bảo trì công trình", text: "Trả phí theo số nhà/khách sạn đang sở hữu.", effect: "repairCosts" },
  { title: "Lễ hội bất chợt", text: "Một đất của bạn được tăng tiền thuê 4 vòng.", effect: "festivalOwned" }
];

function land(id, name, region, price, rent, color) {
  return { id, name, region, type: "land", price, rent, color };
}

function beach(id, name, region, price) {
  return { id, name, region, type: "beach", price, rent: 25, color: "aqua" };
}

function utility(id, name, region, price) {
  return { id, name, region, type: "utility", price, rent: 0, color: "emerald" };
}

function special(id, name, type, description) {
  return { id, name, type, description, color: type };
}

function corner(id, name, type, description) {
  return { id, name, type, description, corner: true, color: type };
}

function id(prefix = "") {
  return `${prefix}${crypto.randomBytes(6).toString("hex")}`;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function closeRoom(room, reason = "Chủ phòng đã rời phòng.") {
  if (!room || !rooms.has(room.code)) return;
  const payload = JSON.stringify({ code: room.code, reason });
  for (const res of room.subscribers) {
    try {
      res.write(`event: roomClosed\ndata: ${payload}\n\n`);
      res.end();
    } catch {
      // Connection is already closed.
    }
  }
  room.subscribers.clear();
  rooms.delete(room.code);
}

function leaveRoom(room, sessionId) {
  const player = room.players.find(item => item.sessionId === sessionId);
  if (!player) return;
  if (player.id === room.hostId) {
    closeRoom(room, "Chủ phòng đã rời phòng, phòng đã đóng.");
    return;
  }
  player.connected = false;
  addLog(room, `${player.name} đã rời phòng.`);
  touch(room);
}

function createRoom({ mode, name, roomCode, token, sessionId }) {
  const code = normalizeCode(roomCode || randomRoomCode());
  if (rooms.has(code)) {
    const error = new Error("Mã phòng đã tồn tại.");
    error.status = 409;
    throw error;
  }
  if (mode !== "classic") {
    const error = new Error("Chế độ 4-8 người đang để sẵn giao diện và sẽ cập nhật sau.");
    error.status = 400;
    throw error;
  }

  const player = makePlayer({ name, token, sessionId, host: true });
  const room = {
    code,
    mode,
    phase: "lobby",
    hostId: player.id,
    players: [player],
    currentPlayerIndex: 0,
    dice: [1, 1],
    lastRoll: null,
    rolledThisTurn: false,
    logs: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    passesThisRound: 0,
    round: 1,
    pending: null,
    notice: null,
    offers: [],
    subscribers: new Set(),
    board: cloneBoard(),
    deck: shuffle(chanceCards.map((card, index) => ({ ...card, id: index }))),
    discard: [],
    festivals: []
  };
  addLog(room, `${player.name} đã tạo phòng ${code}.`);
  rooms.set(code, room);
  return room;
}

function makePlayer({ name, token, sessionId, host = false }) {
  return {
    id: id("p_"),
    sessionId: sessionId || id("s_"),
    name: String(name || "Người chơi").trim().slice(0, 18),
    token: tokens.includes(token) ? token : "rocket",
    color: null,
    cash: START_CASH,
    position: 0,
    inJail: false,
    jailCards: 0,
    skippedTurns: 0,
    bankrupt: false,
    connected: true,
    host
  };
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
}

function cloneBoard() {
  return boardTemplate.map(tile => ({ ...tile, level: 0 }));
}

function randomRoomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function joinRoom(code, body) {
  const room = rooms.get(normalizeCode(code));
  if (!room) {
    const error = new Error("Không tìm thấy phòng.");
    error.status = 404;
    throw error;
  }

  const existing = room.players.find(player => player.sessionId === body.sessionId);
  if (existing) {
    existing.connected = true;
    existing.name = String(body.name || existing.name).trim().slice(0, 18);
    existing.token = tokens.includes(body.token) ? body.token : existing.token;
    addLog(room, `${existing.name} đã kết nối lại.`);
    touch(room);
    return room;
  }

  if (room.phase !== "lobby") {
    const error = new Error("Ván đã bắt đầu, không thể tham gia mới.");
    error.status = 400;
    throw error;
  }
  if (room.players.length >= 4) {
    const error = new Error("Chế độ truyền thống chỉ nhận tối đa 4 người chơi.");
    error.status = 400;
    throw error;
  }
  if (room.players.some(player => player.token === body.token)) {
    const error = new Error("Token này đã có người chọn.");
    error.status = 400;
    throw error;
  }

  const player = makePlayer(body);
  room.players.push(player);
  addLog(room, `${player.name} đã vào phòng.`);
  touch(room);
  return room;
}

function serialize(room, sessionId) {
  const you = room.players.find(player => player.sessionId === sessionId);
  return {
    code: room.code,
    mode: room.mode,
    phase: room.phase,
    hostId: room.hostId,
    youId: you?.id || null,
    board: room.board,
    players: room.players.map(player => ({
      id: player.id,
      name: player.name,
      token: player.token,
      color: player.color,
      cash: player.cash,
      position: player.position,
      inJail: player.inJail,
      jailCards: player.jailCards,
      bankrupt: player.bankrupt,
      host: player.id === room.hostId,
      connected: player.connected,
      properties: ownedTileIds(room, player.id)
    })),
    ownership: ownership(room),
    currentPlayerId: currentPlayer(room)?.id || null,
    dice: room.dice,
    lastRoll: room.lastRoll,
    rolledThisTurn: room.rolledThisTurn,
    logs: room.logs,
    pending: room.pending,
    notice: room.notice,
    offers: room.offers,
    festivals: room.festivals,
    round: room.round
  };
}

function ownership(room) {
  const map = {};
  for (const tile of room.board) {
    const festivalTurns = activeFestivalTurns(room, tile.id);
    if (tile.ownerId || tile.level || festivalTurns) {
      map[tile.id] = {
        ownerId: tile.ownerId || null,
        level: tile.level || 0,
        hotelReady: Boolean(tile.hotelReady),
        festivalTurns
      };
    }
  }
  return map;
}

function ownedTileIds(room, playerId) {
  return room.board.filter(tile => tile.ownerId === playerId).map(tile => tile.id);
}

function activeFestivalTurns(room, tileId) {
  return room.festivals.find(festival => festival.tileId === tileId)?.turnsLeft || 0;
}

function addLog(room, message) {
  room.logs.unshift({ id: id("l_"), message, at: Date.now() });
  room.logs = room.logs.slice(0, MAX_LOGS);
}

function setNotice(room, type, player, title, text, icon = "", extra = {}) {
  room.notice = {
    type,
    playerId: player?.id || null,
    title,
    text,
    icon,
    at: Date.now(),
    ...extra
  };
}

function touch(room) {
  room.updatedAt = Date.now();
  broadcast(room);
}

function broadcast(room) {
  for (const res of room.subscribers) {
    try {
      res.write(`event: state\ndata: ${JSON.stringify(serialize(room, res.sessionId))}\n\n`);
    } catch {
      room.subscribers.delete(res);
    }
  }
}

function currentPlayer(room) {
  if (!room.players.length) return null;
  return room.players[room.currentPlayerIndex % room.players.length];
}

function assertPlayer(room, sessionId) {
  const player = room.players.find(item => item.sessionId === sessionId);
  if (!player) {
    const error = new Error("Bạn chưa ở trong phòng này.");
    error.status = 403;
    throw error;
  }
  return player;
}

function assertCurrent(room, player) {
  if (currentPlayer(room)?.id !== player.id) {
    const error = new Error("Chưa đến lượt của bạn.");
    error.status = 403;
    throw error;
  }
}

function handleAction(room, sessionId, type, payload = {}) {
  const player = assertPlayer(room, sessionId);
  if (type === "start") return startGame(room, player);
  if (room.phase !== "playing") {
    const error = new Error("Ván chưa bắt đầu.");
    error.status = 400;
    throw error;
  }

  switch (type) {
    case "roll":
      assertCurrent(room, player);
      return rollDice(room, player);
    case "buy":
      assertCurrent(room, player);
      return buyTile(room, player);
    case "build":
      assertCurrent(room, player);
      return buildOnTile(room, player, Number(payload.level));
    case "sellProperty":
      assertCurrent(room, player);
      return sellProperty(room, player, Number(payload.tileId));
    case "travel":
      assertCurrent(room, player);
      return resolveTravel(room, player, Number(payload.tileId));
    case "festival":
      assertCurrent(room, player);
      return resolveFestival(room, player, Number(payload.tileId));
    case "confirmChance":
      assertCurrent(room, player);
      return confirmChance(room, player);
    case "offer":
      return makeOffer(room, player, Number(payload.tileId), Number(payload.amount));
    case "acceptOffer":
      return acceptOffer(room, player, String(payload.offerId));
    case "endTurn":
      assertCurrent(room, player);
      return endTurn(room);
    default: {
      const error = new Error("Hành động không hợp lệ.");
      error.status = 400;
      throw error;
    }
  }
}

function startGame(room, player) {
  if (player.id !== room.hostId) {
    const error = new Error("Chỉ chủ phòng được bắt đầu.");
    error.status = 403;
    throw error;
  }
  if (room.phase === "playing") return;
  room.phase = "playing";
  room.currentPlayerIndex = 0;
  const colors = shuffle(playerColors);
  room.players.forEach((item, index) => {
    item.position = 0;
    item.cash = START_CASH;
    item.bankrupt = false;
    item.inJail = false;
    item.skippedTurns = 0;
    item.host = item.id === room.hostId;
    item.color = colors[index % colors.length];
  });
  for (const tile of room.board) {
    delete tile.ownerId;
    delete tile.hotelReady;
    tile.level = 0;
  }
  room.offers = [];
  room.festivals = [];
  room.pending = null;
  room.notice = null;
  room.rolledThisTurn = false;
  addLog(room, `Ván bắt đầu với ${room.players.length} người chơi.`);
  touch(room);
}

function rollDice(room, player) {
  if (room.rolledThisTurn) {
    const error = new Error("Bạn đã thảy xúc xắc trong lượt này.");
    error.status = 400;
    throw error;
  }
  if (room.pending) {
    const error = new Error("Hãy xử lý lựa chọn hiện tại trước.");
    error.status = 400;
    throw error;
  }

  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  room.dice = [d1, d2];
  room.lastRoll = { playerId: player.id, dice: [d1, d2], total: d1 + d2, at: Date.now() };
  room.rolledThisTurn = true;
  room.notice = null;
  addLog(room, `${player.name} thảy ${d1} + ${d2}.`);

  if (player.inJail) {
    if (d1 === d2 || player.jailCards > 0) {
      if (d1 !== d2 && player.jailCards > 0) player.jailCards -= 1;
      player.inJail = false;
      addLog(room, `${player.name} đã ra tù và tiếp tục di chuyển.`);
      movePlayer(room, player, d1 + d2);
    } else {
      setNotice(room, "jail", player, "Bạn là tù nhân", "Cần thảy 2 xúc xắc giống nhau để ra tù.", "⛓");
      addLog(room, `${player.name} chưa đổ đôi nên vẫn ở tù.`);
    }
  } else {
    movePlayer(room, player, d1 + d2);
  }

  touch(room);
}

function movePlayer(room, player, steps) {
  const previous = player.position;
  let next = (previous + steps) % room.board.length;
  if (steps > 0 && previous + steps >= room.board.length) {
    player.cash += PASS_START_BONUS;
    room.passesThisRound += 1;
    addLog(room, `${player.name} đi qua Bắt đầu và nhận ${PASS_START_BONUS} tr.`);
    if (room.passesThisRound >= room.players.length) {
      room.passesThisRound = 0;
      room.round += 1;
      tickFestivals(room);
    }
  }
  if (steps < 0) {
    next = (room.board.length + ((previous + steps) % room.board.length)) % room.board.length;
  }
  player.position = next;
  addLog(room, `${player.name} đến ${room.board[next].name}.`);
  resolveTile(room, player, room.board[next]);
}

function resolveTile(room, player, tile) {
  if (tile.type === "jail") {
    player.inJail = true;
    setNotice(room, "jail", player, "Bạn là tù nhân", "Cần thảy 2 xúc xắc giống nhau để ra tù.", "⛓");
    addLog(room, `${player.name} vào tù. Lượt sau phải đổ đôi để ra.`);
    return;
  }
  if (tile.type === "tax") {
    setNotice(room, "tax", player, "Đóng thuế", "Tất cả người chơi cùng bị trừ tiền thuế.", "₫");
    for (const item of room.players) item.cash -= TAX_AMOUNT;
    addLog(room, `Tất cả người chơi đóng thuế ${TAX_AMOUNT} tr.`);
    return;
  }
  if (room.resolvingChance && tile.type === "chance") {
    addLog(room, `${player.name} đến ${tile.name} bằng thẻ Cơ hội.`);
    return;
  }
  if (tile.type === "chance") {
    drawChance(room, player);
    return;
  }
  if (tile.type === "travel") {
    room.pending = { type: "travel", playerId: player.id, source: room.resolvingChance ? "chance" : null };
    setNotice(room, "travel", player, "Chọn 1 địa điểm bất kì để bay đến", "Người chơi được chọn một ô trên bàn cờ để di chuyển tới.", "✈");
    addLog(room, `${player.name} được chọn một điểm đến.`);
    return;
  }
  if (tile.type === "festival") {
    room.pending = { type: "festival", playerId: player.id, source: room.resolvingChance ? "chance" : null };
    setNotice(room, "festival", player, "Chọn 1 địa điểm tổ chức lễ hội", "Bấm trực tiếp vào một ô bất kỳ trên bàn cờ để đặt băng rôn Lễ hội.", "🎉");
    addLog(room, `${player.name} được mở lễ hội trên một ô.`);
    return;
  }
  if (isOwnable(tile) && tile.ownerId && tile.ownerId !== player.id) {
    chargeRent(room, player, tile);
  }
  if (tile.type === "land" && tile.ownerId === player.id && (tile.level || 0) >= 3) {
    tile.hotelReady = true;
  }
}

function drawChance(room, player) {
  if (!room.deck.length) {
    room.deck = shuffle(room.discard);
    room.discard = [];
  }
  const card = room.deck.shift();
  const drawTileId = player.position;
  const chanceId = id("c_");
  room.discard.push(card);
  addLog(room, `${player.name} rút Cơ hội: ${card.title}.`);
  room.pending = { type: "chance", playerId: player.id, card, drawTileId, chanceId };
  setNotice(room, "chance", player, card.title, card.text, "?", {
    awaitingConfirm: true,
    cardEffect: card.effect,
    drawTileId,
    chanceId
  });
}

function confirmChance(room, player) {
  if (room.pending?.type !== "chance" || room.pending.playerId !== player.id) {
    throwAction("Không có lá Cơ hội cần xác nhận.");
  }
  const { card, drawTileId, chanceId } = room.pending;
  room.pending = null;
  room.resolvingChance = true;
  room.chanceMovement = null;
  let result = "";
  try {
    result = applyChanceCard(room, player, card);
  } finally {
    delete room.resolvingChance;
  }
  const outcome = result || card.text;
  setNotice(room, "chance", player, card.title, card.text, "?", {
    result: outcome,
    cardEffect: card.effect,
    drawTileId,
    movement: room.chanceMovement,
    confirmed: true,
    chanceId
  });
  delete room.chanceMovement;
  addLog(room, outcome);
  if (!room.pending) {
    advanceTurn(room, { preserveNotice: true });
  }
  touch(room);
}

function applyChanceCard(room, player, card) {
  switch (card.effect) {
    case "moveRelative":
      room.chanceMovement = {
        playerId: player.id,
        from: player.position,
        to: (room.board.length + ((player.position + card.steps) % room.board.length)) % room.board.length,
        steps: card.steps
      };
      movePlayer(room, player, card.steps);
      return `${player.name} ${card.steps > 0 ? "tiến" : "lùi"} ${Math.abs(card.steps)} ô.`;
    case "moveTo": {
      const tile = room.board[card.tileId];
      room.chanceMovement = {
        playerId: player.id,
        from: player.position,
        to: card.tileId,
        steps: distanceForward(room.board.length, player.position, card.tileId)
      };
      teleportPlayer(room, player, card.tileId);
      return `${player.name} bay đến ${tile.name}.`;
    }
    case "nearestType": {
      const nearest = nearestTileByType(room, player.position, card.tileType);
      if (!nearest) {
        player.cash += 100;
        return `${player.name} không tìm thấy điểm phù hợp nên nhận 100 tr.`;
      }
      room.chanceMovement = {
        playerId: player.id,
        from: player.position,
        to: nearest.tileId,
        steps: nearest.steps
      };
      movePlayer(room, player, nearest.steps);
      return `${player.name} đi đến ${room.board[player.position].name}.`;
    }
    case "money":
      player.cash += card.amount;
      return `${player.name} ${card.amount >= 0 ? "nhận" : "trả"} ${Math.abs(card.amount)} tr.`;
    case "collectFromAll": {
      let total = 0;
      for (const other of otherPlayers(room, player)) {
        other.cash -= card.amount;
        total += card.amount;
      }
      player.cash += total;
      return `${player.name} nhận ${total} tr từ các người chơi khác.`;
    }
    case "payAll": {
      let total = 0;
      for (const other of otherPlayers(room, player)) {
        other.cash += card.amount;
        total += card.amount;
      }
      player.cash -= total;
      return `${player.name} trả tổng ${total} tr cho các người chơi khác.`;
    }
    case "allMoney":
      for (const item of room.players) item.cash += card.amount;
      return `Tất cả người chơi ${card.amount >= 0 ? "nhận" : "trả"} ${Math.abs(card.amount)} tr.`;
    case "targetRichestPays": {
      const target = richestOtherPlayer(room, player);
      if (!target) return fallbackMoney(player, 100, "Không có người chơi khác, bạn nhận 100 tr.");
      target.cash -= card.amount;
      player.cash += card.amount;
      return `${target.name} trả ${player.name} ${card.amount} tr.`;
    }
    case "payPoorest": {
      const target = poorestOtherPlayer(room, player);
      if (!target) return fallbackMoney(player, 80, "Không có người chơi khác, bạn nhận 80 tr.");
      player.cash -= card.amount;
      target.cash += card.amount;
      return `${player.name} trả ${target.name} ${card.amount} tr.`;
    }
    case "randomLuck": {
      const amount = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.floor(Math.random() * 6) * 40);
      player.cash += amount;
      return `${player.name} ${amount >= 0 ? "may mắn nhận" : "xui rủi mất"} ${Math.abs(amount)} tr.`;
    }
    case "sellHighestBuilding":
      return sellHighestBuilding(room, player);
    case "transferOwnProperty":
      return transferOwnProperty(room, player);
    case "takeOtherProperty":
      return takeOtherProperty(room, player);
    case "repairCosts":
      return payRepairCosts(room, player);
    case "festivalOwned":
      return festivalOwnedTile(room, player);
    default:
      return fallbackMoney(player, 100, `${player.name} nhận 100 tr.`);
  }
}

function teleportPlayer(room, player, tileId) {
  const tile = room.board[tileId];
  if (!tile) return;
  player.position = tileId;
  addLog(room, `${player.name} bay đến ${tile.name}.`);
  resolveTile(room, player, tile);
}

function nearestTileByType(room, fromPosition, tileType) {
  let nearest = null;
  for (let tileId = 0; tileId < room.board.length; tileId += 1) {
    const tile = room.board[tileId];
    if (tileId === fromPosition || tile.type !== tileType) continue;
    const forward = distanceForward(room.board.length, fromPosition, tileId);
    const backward = forward - room.board.length;
    const steps = forward <= Math.abs(backward) ? forward : backward;
    const distance = Math.abs(steps);
    if (!nearest || distance < nearest.distance) {
      nearest = { tileId, steps, distance };
    }
  }
  return nearest;
}

function distanceForward(boardLength, fromPosition, toPosition) {
  return (toPosition - fromPosition + boardLength) % boardLength;
}

function otherPlayers(room, player) {
  return room.players.filter(item => item.id !== player.id && !item.bankrupt);
}

function richestOtherPlayer(room, player) {
  return otherPlayers(room, player).sort((a, b) => b.cash - a.cash)[0] || null;
}

function poorestOtherPlayer(room, player) {
  return otherPlayers(room, player).sort((a, b) => a.cash - b.cash)[0] || null;
}

function fallbackMoney(player, amount, message) {
  player.cash += amount;
  return message;
}

function playerProperties(room, playerId) {
  return room.board.filter(tile => isOwnable(tile) && tile.ownerId === playerId);
}

function propertyValue(tile) {
  const level = tile.level || 0;
  return tile.price + (tile.type === "land" && level > 0 ? buildCost(tile, level, 0) : 0);
}

function highestValueProperty(room, playerId, requireBuilding = false) {
  return playerProperties(room, playerId)
    .filter(tile => !requireBuilding || (tile.type === "land" && (tile.level || 0) > 0))
    .sort((a, b) => propertyValue(b) - propertyValue(a))[0] || null;
}

function sellHighestBuilding(room, player) {
  const tile = highestValueProperty(room, player.id, true);
  if (!tile) return fallbackMoney(player, 120, `${player.name} chưa có nhà để bán nên nhận hỗ trợ 120 tr.`);
  const level = tile.level || 0;
  const refund = Math.ceil(buildCost(tile, level, level - 1) * 0.6 / 10) * 10;
  player.cash += refund;
  tile.level = Math.max(0, level - 1);
  tile.hotelReady = false;
  return `${player.name} bán bớt công trình tại ${tile.name} và nhận ${refund} tr.`;
}

function transferOwnProperty(room, player) {
  const target = randomItem(otherPlayers(room, player));
  const tile = highestValueProperty(room, player.id);
  if (!target || !tile) return fallbackMoney(player, 100, `${player.name} không có tài sản để sang nhượng nên nhận 100 tr.`);
  const compensation = Math.ceil(propertyValue(tile) * 0.4 / 10) * 10;
  target.cash -= compensation;
  player.cash += compensation;
  tile.ownerId = target.id;
  tile.hotelReady = false;
  room.offers = room.offers.filter(offer => offer.tileId !== tile.id);
  return `${player.name} sang nhượng ${tile.name} cho ${target.name} và nhận ${compensation} tr.`;
}

function takeOtherProperty(room, player) {
  const pool = room.board.filter(tile => isOwnable(tile) && tile.ownerId && tile.ownerId !== player.id);
  const tile = randomItem(pool);
  if (!tile) return fallbackMoney(player, 120, `${player.name} không tìm thấy tài sản để nhận chuyển nhượng nên nhận 120 tr.`);
  const seller = room.players.find(item => item.id === tile.ownerId);
  const fee = Math.ceil(propertyValue(tile) * 0.5 / 10) * 10;
  player.cash -= fee;
  if (seller) seller.cash += fee;
  tile.ownerId = player.id;
  tile.hotelReady = false;
  room.offers = room.offers.filter(offer => offer.tileId !== tile.id);
  return `${player.name} nhận chuyển nhượng ${tile.name}${seller ? ` từ ${seller.name}` : ""} với ${fee} tr.`;
}

function payRepairCosts(room, player) {
  const builtLands = playerProperties(room, player.id).filter(tile => tile.type === "land" && (tile.level || 0) > 0);
  if (!builtLands.length) {
    player.cash -= 80;
    return `${player.name} chưa có công trình, chỉ trả phí hồ sơ 80 tr.`;
  }
  const total = builtLands.reduce((sum, tile) => sum + ((tile.level || 0) >= 4 ? 220 : (tile.level || 0) * 60), 0);
  player.cash -= total;
  return `${player.name} trả ${total} tr phí bảo trì công trình.`;
}

function festivalOwnedTile(room, player) {
  const tile = randomItem(playerProperties(room, player.id).filter(item => item.type === "land"));
  if (!tile) return fallbackMoney(player, 100, `${player.name} chưa có đất tổ chức lễ hội nên nhận 100 tr.`);
  room.festivals = room.festivals.filter(item => item.tileId !== tile.id);
  room.festivals.push({ tileId: tile.id, turnsLeft: 4 });
  return `${tile.name} của ${player.name} mở lễ hội trong 4 vòng.`;
}

function randomItem(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function isOwnable(tile) {
  return ["land", "beach", "utility"].includes(tile.type);
}

function buyTile(room, player) {
  const tile = room.board[player.position];
  if (!isOwnable(tile)) throwAction("Ô này không thể mua.");
  if (tile.ownerId) throwAction("Ô này đã có chủ.");
  if (player.cash < tile.price) throwAction("Bạn không đủ tiền.");
  player.cash -= tile.price;
  tile.ownerId = player.id;
  tile.level = tile.level || 0;
  tile.hotelReady = false;
  addLog(room, `${player.name} mua ${tile.name} với giá ${tile.price} tr.`);
  touch(room);
}

function buildOnTile(room, player, targetLevel) {
  const tile = room.board[player.position];
  if (tile.type !== "land") throwAction("Chỉ ô nhà đất mới xây nhà/khách sạn.");
  if (tile.ownerId && tile.ownerId !== player.id) throwAction("Bạn không sở hữu ô này.");
  const current = tile.level || 0;
  const buyingLand = !tile.ownerId;
  if (![1, 2, 3, 4].includes(targetLevel) || targetLevel <= current) {
    throwAction("Cấp xây dựng không hợp lệ.");
  }
  if (buyingLand && targetLevel === 4) throwAction("Cần nhà lớn lv3 trước khi nâng thành khách sạn.");
  if (targetLevel === 4 && current < 3) throwAction("Cần nhà lớn lv3 trước khi nâng thành khách sạn.");
  if (targetLevel === 4 && !tile.hotelReady) throwAction("Bạn cần quay lại ô đã có nhà lớn lv3 để xây khách sạn.");
  const cost = buildCost(tile, targetLevel, current) + (buyingLand ? tile.price : 0);
  if (player.cash < cost) throwAction("Bạn không đủ tiền xây dựng.");
  player.cash -= cost;
  if (buyingLand) {
    tile.ownerId = player.id;
    tile.hotelReady = false;
  }
  tile.level = targetLevel;
  if (targetLevel === 3) tile.hotelReady = false;
  if (targetLevel === 4) tile.hotelReady = false;
  addLog(room, `${player.name} ${buyingLand ? "mua" : "nâng"} ${tile.name} lên ${buildingName(targetLevel)} với ${cost} tr.`);
  touch(room);
}

function sellProperty(room, player, tileId) {
  if (room.pending) throwAction("Hãy xử lý lựa chọn hiện tại trước khi bán tài sản.");
  const tile = room.board[tileId];
  if (!tile || !isOwnable(tile)) throwAction("Ô này không thể bán.");
  if (tile.ownerId !== player.id) throwAction("Bạn không sở hữu ô này.");
  const amount = sellValue(tile);
  player.cash += amount;
  delete tile.ownerId;
  tile.level = 0;
  tile.hotelReady = false;
  room.offers = room.offers.filter(offer => offer.tileId !== tile.id);
  room.festivals = room.festivals.filter(festival => festival.tileId !== tile.id);
  addLog(room, `${player.name} bán ${tile.name} và nhận ${amount} tr.`);
  setNotice(room, "sell", player, "Đã bán tài sản", `${player.name} bán ${tile.name} và nhận ${amount} tr.`, "₫");
  touch(room);
}

function buildCost(tile, targetLevel, currentLevel = 0) {
  const multipliers = { 1: 0.45, 2: 0.7, 3: 0.95, 4: 1.25 };
  let total = 0;
  for (let level = currentLevel + 1; level <= targetLevel; level += 1) {
    total += Math.ceil(tile.price * multipliers[level] / 10) * 10;
  }
  return total;
}

function sellValue(tile) {
  return Math.ceil(propertyValue(tile) * 0.75 / 10) * 10;
}

function buildingName(level) {
  return ["Đất trống", "Nhà nhỏ lv1", "Nhà vừa lv2", "Nhà lớn lv3", "Khách sạn"][level] || "Công trình";
}

function chargeRent(room, player, tile) {
  const owner = room.players.find(item => item.id === tile.ownerId);
  if (!owner) return;
  const amount = rentFor(room, tile);
  player.cash -= amount;
  owner.cash += amount;
  addLog(room, `${player.name} trả ${amount} tr cho ${owner.name} tại ${tile.name}.`);
}

function rentFor(room, tile) {
  if (tile.type === "beach") {
    const ownerBeachCount = room.board.filter(item => item.type === "beach" && item.ownerId === tile.ownerId).length;
    return [0, 25, 55, 110, 220][ownerBeachCount] || 25;
  }
  if (tile.type === "utility") {
    const count = room.board.filter(item => item.type === "utility" && item.ownerId === tile.ownerId).length;
    const roll = room.lastRoll?.total || 7;
    return roll * (count >= 2 ? 30 : 12);
  }
  const level = tile.level || 0;
  const base = tile.rent || 0;
  const multiplier = [1, 1.8, 2.8, 4.2, 6.5][level] || 1;
  const festival = activeFestivalTurns(room, tile.id) > 0 ? 2 : 1;
  return Math.ceil(base * multiplier * festival);
}

function resolveTravel(room, player, tileId) {
  if (room.pending?.type !== "travel" || room.pending.playerId !== player.id) {
    throwAction("Không có lượt du lịch cần xử lý.");
  }
  const fromChance = room.pending.source === "chance";
  if (!Number.isInteger(tileId) || tileId < 0 || tileId >= room.board.length) throwAction("Điểm đến không hợp lệ.");
  if (!canTravelToTile(room.board[tileId])) throwAction("Du lịch chỉ được chọn ô đất, bãi biển hoặc công ty.");
  player.position = tileId;
  room.pending = null;
  room.notice = null;
  addLog(room, `${player.name} du lịch đến ${room.board[tileId].name}.`);
  resolveTile(room, player, room.board[tileId]);
  if (fromChance && !room.pending) advanceTurn(room);
  touch(room);
}

function canTravelToTile(tile) {
  return Boolean(tile && ["land", "beach", "utility"].includes(tile.type));
}

function resolveFestival(room, player, tileId) {
  if (room.pending?.type !== "festival" || room.pending.playerId !== player.id) {
    throwAction("Không có lễ hội cần xử lý.");
  }
  const fromChance = room.pending.source === "chance";
  const tile = room.board[tileId];
  if (!tile) throwAction("Ô lễ hội không hợp lệ.");
  if (!canHostFestivalOnTile(tile)) throwAction("Lễ hội chỉ được tổ chức ở ô đất có thể mua hoặc xây nhà.");
  room.festivals = room.festivals.filter(item => item.tileId !== tileId);
  room.festivals.push({ tileId, turnsLeft: 4 });
  room.pending = null;
  room.notice = null;
  addLog(room, `${player.name} mở lễ hội tại ${tile.name} trong 4 vòng.`);
  if (fromChance) advanceTurn(room);
  touch(room);
}

function canHostFestivalOnTile(tile) {
  return Boolean(tile && tile.type === "land");
}

function tickFestivals(room) {
  room.festivals = room.festivals
    .map(festival => ({ ...festival, turnsLeft: festival.turnsLeft - 1 }))
    .filter(festival => festival.turnsLeft > 0);
  addLog(room, `Bắt đầu vòng ${room.round}. Thời hạn lễ hội được cập nhật.`);
}

function makeOffer(room, player, tileId, amount) {
  const tile = room.board[tileId];
  if (!tile || !isOwnable(tile) || !tile.ownerId || tile.ownerId === player.id) {
    throwAction("Không thể đề nghị mua ô này.");
  }
  if (!Number.isFinite(amount) || amount <= 0 || player.cash < amount) throwAction("Giá đề nghị không hợp lệ.");
  const offer = { id: id("o_"), tileId, fromPlayerId: player.id, toPlayerId: tile.ownerId, amount, at: Date.now() };
  room.offers = room.offers.filter(item => !(item.tileId === tileId && item.fromPlayerId === player.id));
  room.offers.push(offer);
  addLog(room, `${player.name} đề nghị mua ${tile.name} với ${amount} tr.`);
  touch(room);
}

function acceptOffer(room, player, offerId) {
  const offer = room.offers.find(item => item.id === offerId);
  if (!offer) throwAction("Không tìm thấy đề nghị.");
  const tile = room.board[offer.tileId];
  if (!tile || tile.ownerId !== player.id || offer.toPlayerId !== player.id) throwAction("Bạn không thể nhận đề nghị này.");
  const buyer = room.players.find(item => item.id === offer.fromPlayerId);
  if (!buyer || buyer.cash < offer.amount) throwAction("Người mua không đủ tiền.");
  buyer.cash -= offer.amount;
  player.cash += offer.amount;
  tile.ownerId = buyer.id;
  tile.hotelReady = false;
  room.offers = room.offers.filter(item => item.tileId !== tile.id);
  addLog(room, `${player.name} bán ${tile.name} cho ${buyer.name} với ${offer.amount} tr.`);
  touch(room);
}

function endTurn(room) {
  if (room.pending) throwAction("Hãy xử lý Du lịch/Lễ hội trước khi kết thúc lượt.");
  if (!room.rolledThisTurn) throwAction("Bạn cần thảy xúc xắc trước.");
  advanceTurn(room);
  touch(room);
}

function advanceTurn(room, options = {}) {
  const { preserveNotice = false } = options;
  room.rolledThisTurn = false;
  if (!preserveNotice) room.notice = null;
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  if (currentPlayer(room).inJail && !preserveNotice) {
    setNotice(room, "jail", currentPlayer(room), "Bạn là tù nhân", "Cần thảy 2 xúc xắc giống nhau để ra tù.", "⛓");
  }
  addLog(room, `Đến lượt ${currentPlayer(room).name}.`);
}

function throwAction(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml"
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, rooms: rooms.size });
    }
    if (req.method === "POST" && url.pathname === "/api/rooms") {
      const body = await readBody(req);
      const room = createRoom(body);
      return sendJson(res, 201, serialize(room, body.sessionId));
    }
    const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)(?:\/([^/]+))?$/);
    if (roomMatch) {
      const code = normalizeCode(roomMatch[1]);
      const action = roomMatch[2];
      const room = rooms.get(code);
      if (!room) return sendJson(res, 404, { error: "Không tìm thấy phòng." });

      if (req.method === "GET" && action === "events") {
        const sessionId = url.searchParams.get("sessionId");
        const player = assertPlayer(room, sessionId);
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no"
        });
        res.sessionId = sessionId;
        res.playerId = player.id;
        room.subscribers.add(res);
        res.write(`event: state\ndata: ${JSON.stringify(serialize(room, sessionId))}\n\n`);
        req.on("close", () => {
          room.subscribers.delete(res);
          if (rooms.get(code) === room && player.id === room.hostId) {
            closeRoom(room, "Chủ phòng đã mất kết nối, phòng đã đóng.");
          }
        });
        return;
      }

      if (req.method === "POST" && action === "leave") {
        const body = await readBody(req);
        leaveRoom(room, body.sessionId);
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === "POST" && action === "join") {
        const body = await readBody(req);
        const joined = joinRoom(code, body);
        return sendJson(res, 200, serialize(joined, body.sessionId));
      }
      if (req.method === "POST" && action === "action") {
        const body = await readBody(req);
        handleAction(room, body.sessionId, body.type, body.payload);
        return sendJson(res, 200, serialize(room, body.sessionId));
      }
    }
    if (req.method === "GET") return serveStatic(req, res);
    sendJson(res, 404, { error: "Không tìm thấy endpoint." });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "Lỗi máy chủ." });
  }
}

const server = http.createServer(route);
server.listen(PORT, () => {
  console.log(`Cờ Tỷ Phú Việt Nam running at http://localhost:${PORT}`);
});
