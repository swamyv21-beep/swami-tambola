const LINGO = {
  1: "Kelly's Eye, 1", 2: "One Little Duck, 2", 3: "Cup of Tea, 3", 4: "Knock at the Door, 4",
  5: "Man Alive, 5", 6: "Tom Mix, 6", 7: "Lucky Seven", 8: "Garden Gate, 8",
  9: "Doctor's Orders, 9", 10: "Prime Minister's Den, 10", 11: "Legs Eleven",
  12: "One Dozen, 12", 13: "Unlucky for Some, 13", 14: "Valentine's Day, 14",
  15: "Young and Keen, 15", 16: "Sweet Sixteen", 17: "Dancing Queen, 17",
  18: "Coming of Age, 18", 21: "Key of the Door, 21", 22: "Two Little Ducks, 22",
  25: "Duck and Dive, 25", 30: "Dirty Gertie, 30", 33: "All the Threes, 33",
  40: "Life Begins at 40", 44: "Droopy Drawers, 44", 45: "Halfway There, 45",
  50: "Half a Century, 50", 55: "Snakes Alive, 55", 60: "Five Dozen, 60",
  66: "Clickety Click, 66", 70: "Three Score and Ten, 70", 77: "Sunset Strip, 77",
  80: "Eight and Blank, 80", 88: "Two Fat Ladies, 88", 89: "Nearly There, 89",
  90: "Top of the Shop, 90"
};

const PRIZES = {
  jaldi5: "Jaldi Five", topLine: "Top Line", midLine: "Middle Line",
  botLine: "Bottom Line", corners: "Four Corners", fullHouse: "Full House"
};

const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" }
  ]
};

let peer = null;
let isHost = false;
let roomId = "";
let myId = localStorage.getItem("tambola_uid") || ("U-" + Math.random().toString(36).slice(2, 9));
localStorage.setItem("tambola_uid", myId);
let myName = "";

let hostConn = null;
let clientConns = new Map();

let state = {
  calledNumbers: [],
  claims: { jaldi5: null, topLine: null, midLine: null, botLine: null, corners: null, fullHouse: null },
  players: {}
};

let ticket = [];
let marked = new Set();
let autoTimer = null;
let popupTimeout = null;
let drawBusy = false;

// Build 1-90 Master Board
const boardEl = document.getElementById("masterBoard");
for (let i = 1; i <= 90; i++) {
  const d = document.createElement("div");
  d.className = "b-num";
  d.id = `b-${i}`;
  d.textContent = i;
  boardEl.appendChild(d);
}

// Auto-fill Room Code from URL (?room=TAM-XXXX)
const params = new URLSearchParams(window.location.search);
if (params.get("room")) {
  document.getElementById("roomInput").value = params.get("room").toUpperCase();
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(el._t);
  el._t = setTimeout(() => el.style.display = "none", 3600);
}

function saveSession() {
  if (!roomId) return;
  localStorage.setItem(`tambola_session_${roomId}`, JSON.stringify({
    ticket,
    marked: Array.from(marked),
    calledNumbers: state.calledNumbers,
    claims: state.claims
  }));
}

function loadSession(rId) {
  try {
    const raw = localStorage.getItem(`tambola_session_${rId}`);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (Array.isArray(data.ticket) && data.ticket.length === 3) {
      ticket = data.ticket;
      marked = new Set(data.marked || []);
      if (isHost && Array.isArray(data.calledNumbers)) {
        state.calledNumbers = data.calledNumbers;
        state.claims = data.claims || state.claims;
      }
      return true;
    }
  } catch (e) {}
  return false;
}

function generateTicket() {
  const grid = Array.from({ length: 3 }, () => Array(9).fill(0));
  const ranges = [[1,9],[10,19],[20,29],[30,39],[40,49],[50,59],[60,69],[70,79],[80,90]];
  const counts = Array(9).fill(1);
  let rem = 6;
  while (rem > 0) {
    const c = Math.floor(Math.random() * 9);
    if (counts[c] < 3) { counts[c]++; rem--; }
  }
  const cols = counts.map((cnt, c) => {
    const [min, max] = ranges[c];
    const pool = [];
    for (let n = min; n <= max; n++) pool.push(n);
    pool.sort(() => Math.random() - 0.5);
    return pool.slice(0, cnt).sort((a, b) => a - b);
  });

  let ok = false;
  while (!ok) {
    for (let r = 0; r < 3; r++) grid[r].fill(0);
    const rCnt = [0, 0, 0];
    let valid = true;
    const order = [0,1,2,3,4,5,6,7,8].sort((a, b) => counts[b] - counts[a]);
    for (const c of order) {
      const avail = [0,1,2].filter(r => rCnt[r] < 5);
      if (avail.length < counts[c]) { valid = false; break; }
      avail.sort(() => Math.random() - 0.5);
      const chosen = avail.slice(0, counts[c]).sort((a, b) => a - b);
      chosen.forEach((r, idx) => { grid[r][c] = cols[c][idx]; rCnt[r]++; });
    }
    if (valid && rCnt.every(x => x === 5)) ok = true;
  }
  return grid;
}

function createRoom() {
  myName = document.getElementById("playerName").value.trim() || "Host";
  isHost = true;
  roomId = "TAM-" + Math.floor(1000 + Math.random() * 9000);
  document.getElementById("lobbyMsg").textContent = "Initializing online room...";

  peer = new Peer(roomId, { config: ICE_CONFIG });
  peer.on("open", () => {
    state.players[myId] = { name: myName, online: true, isHost: true };
    if (!loadSession(roomId)) ticket = generateTicket();
    enterRoom();
    document.getElementById("hostPanel").style.display = "block";
  });

  peer.on("connection", (conn) => {
    conn.on("data", (msg) => handleHostMsg(msg, conn));
    conn.on("close", () => {
      for (const [uid, c] of clientConns.entries()) {
        if (c === conn) {
          if (state.players[uid]) state.players[uid].online = false;
          clientConns.delete(uid);
          broadcastState();
          renderAll();
        }
      }
    });
  });

  peer.on("error", (err) => {
    document.getElementById("lobbyMsg").textContent = "Network error: " + err.type;
  });
}

function joinRoom() {
  myName = document.getElementById("playerName").value.trim() || "Player";
  roomId = document.getElementById("roomInput").value.trim().toUpperCase();
  if (!roomId) return toast("Enter a valid Room Code");

  isHost = false;
  document.getElementById("lobbyMsg").textContent = `Connecting to ${roomId}...`;
  connectToHost();
}

function connectToHost() {
  if (peer) peer.destroy();
  peer = new Peer({ config: ICE_CONFIG });

  peer.on("open", () => {
    hostConn = peer.connect(roomId, { reliable: true });
    hostConn.on("open", () => {
      document.getElementById("reconnectBtn").style.display = "none";
      document.getElementById("netBadge").textContent = "● Connected Online";
      hostConn.send({ type: "HELLO", uid: myId, name: myName });
      if (!loadSession(roomId)) ticket = generateTicket();
      enterRoom();
    });
    hostConn.on("data", (msg) => handleClientMsg(msg));
    hostConn.on("close", () => {
      document.getElementById("netBadge").textContent = "● Disconnected";
      document.getElementById("reconnectBtn").style.display = "inline-block";
      toast("Connection lost. Tap Reconnect.");
    });
  });

  peer.on("error", (err) => {
    document.getElementById("lobbyMsg").textContent = "Could not reach room: " + err.type;
  });
}

function manualReconnect() {
  toast("Reconnecting to room...");
  connectToHost();
}

function enterRoom() {
  document.getElementById("lobbyPanel").style.display = "none";
  document.getElementById("roomPanel").style.display = "grid";
  document.getElementById("roomCodeDisplay").textContent = roomId;
  document.getElementById("ticketOwner").textContent = myName;
  saveSession();
  renderAll();
}

function copyInviteLink() {
  const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  navigator.clipboard?.writeText(url);
  toast(`Invite link copied! Share Room Code: ${roomId}`);
}

function broadcastState(extra = {}) {
  const payload = { type: "STATE_SYNC", state, ...extra };
  clientConns.forEach((conn) => {
    if (conn.open) conn.send(payload);
  });
}

function hostDrawNumber() {
  if (!isHost || drawBusy) return;
  if (state.calledNumbers.length >= 90) {
    toast("All 90 numbers have been drawn!");
    if (autoTimer) toggleAutoCaller();
    return;
  }

  drawBusy = true;
  const pool = [];
  for (let i = 1; i <= 90; i++) {
    if (!state.calledNumbers.includes(i)) pool.push(i);
  }
  const num = pool[Math.floor(Math.random() * pool.length)];
  state.calledNumbers.push(num);

  saveSession();
  renderAll();
  triggerDrawPopup(num);
  broadcastState({ newNumber: num });

  setTimeout(() => { drawBusy = false; }, 350);
}

function toggleAutoCaller() {
  const btn = document.getElementById("autoBtn");
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    btn.textContent = "▶ Auto Caller (5s)";
  } else {
    hostDrawNumber();
    autoTimer = setInterval(hostDrawNumber, 5000);
    btn.textContent = "⏸ Stop Auto Caller";
  }
}

function triggerDrawPopup(num) {
  document.getElementById("popupNum").textContent = num;
  document.getElementById("popupLingo").textContent = LINGO[num] || `Number ${num}`;
  document.getElementById("drawPopup").classList.add("active");

  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(closePopup, 2400);

  if (document.getElementById("autoDaubCheck")?.checked) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 9; c++) {
        if (ticket[r][c] === num) marked.add(num);
      }
    }
    saveSession();
    renderTicket();
  }

  if (document.getElementById("voiceCheck")?.checked !== false && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(LINGO[num] || `Number ${num}`);
    window.speechSynthesis.speak(u);
  }
}

function closePopup() {
  document.getElementById("drawPopup").classList.remove("active");
}

function toggleCell(num) {
  if (!state.calledNumbers.includes(num)) {
    return toast(`⚠️ ${num} has not been called yet!`);
  }
  if (marked.has(num)) marked.delete(num);
  else marked.add(num);
  saveSession();
  renderTicket();
}

function checkWin(prize, t) {
  const called = (n) => n > 0 && state.calledNumbers.includes(n);
  const row = (r) => t[r].filter(n => n > 0);
  if (prize === "jaldi5") {
    let c = 0;
    for (let r = 0; r < 3; r++) for (let col = 0; col < 9; col++) if (called(t[r][col])) c++;
    return c >= 5;
  }
  if (prize === "topLine") return row(0).every(called);
  if (prize === "midLine") return row(1).every(called);
  if (prize === "botLine") return row(2).every(called);
  if (prize === "corners") {
    const r0 = row(0), r2 = row(2);
    return [r0[0], r0[r0.length - 1], r2[0], r2[r2.length - 1]].every(called);
  }
  if (prize === "fullHouse") return [0,1,2].every(r => row(r).every(called));
  return false;
}

function submitClaim(prize) {
  if (state.claims[prize]) {
    return toast(`${PRIZES[prize]} already claimed by ${state.claims[prize].name}!`);
  }
  if (!checkWin(prize, ticket)) {
    return toast(`❌ Bogey! ${PRIZES[prize]} numbers are not all called yet.`);
  }
  if (isHost) {
    approveClaim(prize, myName, ticket);
  } else if (hostConn && hostConn.open) {
    hostConn.send({ type: "CLAIM", prize, uid: myId, name: myName, ticket });
  }
}

function approveClaim(prize, playerName, playerTicket) {
  if (state.claims[prize]) return;
  if (!checkWin(prize, playerTicket)) return;

  state.claims[prize] = { name: playerName, atCall: state.calledNumbers.length };
  saveSession();
  renderAll();
  toast(`🎉 ${playerName} won ${PRIZES[prize]} (Call #${state.calledNumbers.length})!`);
  broadcastState({ announcement: `🎉 ${playerName} won ${PRIZES[prize]}!` });
}

function handleHostMsg(msg, conn) {
  if (msg.type === "HELLO") {
    clientConns.set(msg.uid, conn);
    state.players[msg.uid] = { name: msg.name, online: true, isHost: false };
    renderAll();
    broadcastState();
  } else if (msg.type === "CLAIM") {
    if (state.claims[msg.prize]) {
      conn.send({ type: "ALERT", text: `Too late! ${state.claims[msg.prize].name} won it.` });
    } else if (checkWin(msg.prize, msg.ticket)) {
      approveClaim(msg.prize, msg.name, msg.ticket);
    } else {
      conn.send({ type: "ALERT", text: "❌ Bogey claim rejected by Host." });
    }
  }
}

function handleClientMsg(msg) {
  if (msg.type === "STATE_SYNC") {
    state = msg.state;
    saveSession();
    renderAll();
    if (msg.newNumber) triggerDrawPopup(msg.newNumber);
    if (msg.announcement) toast(msg.announcement);
  } else if (msg.type === "ALERT") {
    toast(msg.text);
  }
}

function renderAll() {
  const pList = document.getElementById("playersList");
  pList.innerHTML = "";
  Object.values(state.players).forEach(p => {
    const chip = document.createElement("div");
    chip.className = "player-chip";
    chip.innerHTML = `<span class="dot ${p.online ? "" : "off"}"></span>${p.name}${p.isHost ? " 👑" : ""}`;
    pList.appendChild(chip);
  });

  const recentEl = document.getElementById("recentCalls");
  if (state.calledNumbers.length > 0) {
    const last6 = [...state.calledNumbers].reverse().slice(0, 6);
    recentEl.innerHTML = last6.map((n, idx) =>
      `<div class="ball ${idx === 0 ? "latest" : ""}">${n}</div>`
    ).join("");
  }

  document.getElementById("callCount").textContent = state.calledNumbers.length;
  state.calledNumbers.forEach(n => document.getElementById(`b-${n}`)?.classList.add("called"));

  for (const [key, info] of Object.entries(state.claims)) {
    const btn = document.getElementById(`claim-${key}`);
    if (info && btn) {
      btn.classList.add("won");
      btn.textContent = `${PRIZES[key]} • ${info.name} (#${info.atCall})`;
    }
  }

  renderTicket();
}

function renderTicket() {
  const grid = document.getElementById("ticketGrid");
  grid.innerHTML = "";
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) {
      const val = ticket[r][c];
      const cell = document.createElement("div");
      if (val === 0) {
        cell.className = "cell empty";
      } else {
        cell.className = "cell" + (marked.has(val) ? " marked" : "");
        cell.textContent = val;
        cell.onclick = () => toggleCell(val);
      }
      grid.appendChild(cell);
    }
  }
}
