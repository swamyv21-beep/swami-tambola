/* ==========================================================
   1. 3D PERSPECTIVE FLOATING TAMBOLA BALLS BACKGROUND
   ========================================================== */
(function init3DBackground() {
  const canvas = document.getElementById("bg3dCanvas");
  const ctx = canvas.getContext("2d");
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const colors = [
    { main: "#f59e0b", dark: "#92400e" },
    { main: "#ef4444", dark: "#991b1b" },
    { main: "#3b82f6", dark: "#1e40af" },
    { main: "#10b981", dark: "#065f46" },
    { main: "#a855f7", dark: "#581c87" }
  ];

  const balls = Array.from({ length: 24 }, (_, idx) => {
    const c = colors[idx % colors.length];
    return {
      num: Math.floor(Math.random() * 90) + 1,
      x: (Math.random() - 0.5) * 1400,
      y: (Math.random() - 0.5) * 900,
      z: Math.random() * 900 + 150,
      vz: -(Math.random() * 0.9 + 0.35),
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.02,
      color: c
    };
  });

  function render3D() {
    ctx.clearRect(0, 0, width, height);
    const focalLength = 420;
    const cx = width / 2;
    const cy = height / 2;

    ctx.strokeStyle = "rgba(245, 158, 11, 0.07)";
    ctx.lineWidth = 1;
    for (let gx = -800; gx <= 800; gx += 160) {
      ctx.beginPath();
      ctx.moveTo(cx + gx * 0.25, cy * 0.6);
      ctx.lineTo(cx + gx * 1.6, height);
      ctx.stroke();
    }

    balls.sort((a, b) => b.z - a.z);

    for (const b of balls) {
      b.z += b.vz;
      b.rot += b.vrot;
      if (b.z < 80) {
        b.z = 1050;
        b.x = (Math.random() - 0.5) * 1400;
        b.y = (Math.random() - 0.5) * 900;
        b.num = Math.floor(Math.random() * 90) + 1;
      }

      const scale = focalLength / b.z;
      const sx = cx + b.x * scale;
      const sy = cy + b.y * scale;
      const radius = Math.max(8, 34 * scale);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(b.rot);

      const grad = ctx.createRadialGradient(
        -radius * 0.32, -radius * 0.32, radius * 0.1,
        0, 0, radius
      );
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.28, b.color.main);
      grad.addColorStop(1, b.color.dark);

      ctx.globalAlpha = Math.min(0.85, scale * 1.15);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.54, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fill();

      ctx.fillStyle = "#0f172a";
      ctx.font = `800 ${Math.max(7, Math.floor(radius * 0.52))}px Poppins, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.num, 0, 1);

      ctx.restore();
    }
    requestAnimationFrame(render3D);
  }
  render3D();
})();

/* ==========================================================
   2. MULTIPLAYER TAMBOLA (ANY NETWORK STUN/TURN + RULES POPUP)
   ========================================================== */
const LINGO = {
  1: "Kelly's Eye, Number 1", 2: "One Little Duck, Number 2", 3: "Cup of Tea, Number 3",
  4: "Knock at the Door, Number 4", 5: "Man Alive, Number 5", 6: "Tom Mix, Number 6",
  7: "Lucky Seven", 8: "Garden Gate, Number 8", 9: "Doctor's Orders, Number 9",
  10: "Prime Minister's Den, 10", 11: "Legs Eleven", 12: "One Dozen, 12",
  13: "Unlucky for Some, 13", 14: "Valentine's Day, 14", 15: "Young and Keen, 15",
  16: "Sweet Sixteen", 17: "Dancing Queen, 17", 18: "Coming of Age, 18",
  19: "Goodbye Teens, 19", 20: "One Score, 20", 21: "Key of the Door, 21",
  22: "Two Little Ducks, 22", 25: "Duck and Dive, 25", 30: "Dirty Gertie, 30",
  33: "All the Threes, 33", 40: "Life Begins at 40", 44: "Droopy Drawers, 44",
  45: "Halfway There, 45", 50: "Half a Century, 50", 55: "Snakes Alive, 55",
  60: "Five Dozen, 60", 66: "Clickety Click, 66", 70: "Three Score and Ten, 70",
  77: "Sunset Strip, 77", 80: "Eight and Blank, 80", 88: "Two Fat Ladies, 88",
  89: "Nearly There, 89", 90: "Top of the Shop, 90"
};

const PRIZE_LABELS = {
  jaldi5: "Jaldi Five",
  topLine: "Top Line",
  midLine: "Middle Line",
  botLine: "Bottom Line",
  corners: "Four Corners",
  fullHouse: "Full House"
};

const ANY_NETWORK_ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

let peer = null;
let isHost = false;
let currentRoomId = "";
let hostConn = null;
let connections = [];
let myName = "Player";

let calledNumbers = [];
let claims = {
  jaldi5: null, topLine: null, midLine: null,
  botLine: null, corners: null, fullHouse: null
};

let ticket = [];
let markedSet = new Set();
let autoTimer = null;
let drawLock = false;
let popupTimer = null;
let winnerTimer = null;

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("room")) {
  document.getElementById("joinRoomId").value = urlParams.get("room").toUpperCase();
}

const boardEl = document.getElementById("masterBoard");
for (let i = 1; i <= 90; i++) {
  const div = document.createElement("div");
  div.className = "b-num";
  div.id = `b-${i}`;
  div.textContent = i;
  boardEl.appendChild(div);
}

function openRulesPopup() {
  document.getElementById("rulesPopupModal").classList.add("active");
}

function closeRulesPopup() {
  document.getElementById("rulesPopupModal").classList.remove("active");
}

function copyInviteLink() {
  if (!currentRoomId) return;
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
  navigator.clipboard?.writeText(shareUrl);
  showToast(`🔗 Invite Link Copied! Share Room ${currentRoomId} across any network.`);
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.display = "none", 3500);
}

function showDrawPopup(num) {
  const popup = document.getElementById("drawPopup");
  document.getElementById("popupNumber").textContent = num;
  document.getElementById("popupLingo").textContent = LINGO[num] || `Single number ${num}`;
  popup.classList.add("active");

  clearTimeout(popupTimer);
  popupTimer = setTimeout(() => {
    closeDrawPopup();
  }, 2500);

  if (document.getElementById("voiceToggle")?.checked !== false && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(LINGO[num] || `Number ${num}`);
    utter.rate = 1.0;
    window.speechSynthesis.speak(utter);
  }
}

function closeDrawPopup() {
  document.getElementById("drawPopup").classList.remove("active");
}

function showWinnerReveal(prizeKey, winnerName) {
  closeDrawPopup();
  const modal = document.getElementById("winnerFoldModal");
  const box = document.getElementById("foldingPaperBox");

  document.getElementById("winnerPrizeLabel").textContent = `🏅 ${PRIZE_LABELS[prizeKey].toUpperCase()} WINNER`;
  document.getElementById("winnerNameText").textContent = winnerName;

  modal.classList.remove("active");
  const clone = box.cloneNode(true);
  box.parentNode.replaceChild(clone, box);
  modal.classList.add("active");

  if (document.getElementById("voiceToggle")?.checked !== false && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(`Congratulations ${winnerName} for winning ${PRIZE_LABELS[prizeKey]}`);
    window.speechSynthesis.speak(utter);
  }

  clearTimeout(winnerTimer);
  winnerTimer = setTimeout(() => {
    closeWinnerReveal();
  }, 4500);
}

function closeWinnerReveal() {
  document.getElementById("winnerFoldModal").classList.remove("active");
}

function generateTicket() {
  const grid = Array.from({ length: 3 }, () => Array(9).fill(0));
  const colRanges = [
    [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
    [50, 59], [60, 69], [70, 79], [80, 90]
  ];

  const colCounts = Array(9).fill(1);
  let remaining = 6;
  while (remaining > 0) {
    const c = Math.floor(Math.random() * 9);
    if (colCounts[c] < 3) {
      colCounts[c]++;
      remaining--;
    }
  }

  const colNums = colCounts.map((count, c) => {
    const [min, max] = colRanges[c];
    const pool = [];
    for (let n = min; n <= max; n++) pool.push(n);
    pool.sort(() => Math.random() - 0.5);
    return pool.slice(0, count).sort((a, b) => a - b);
  });

  let valid = false;
  while (!valid) {
    for (let r = 0; r < 3; r++) grid[r].fill(0);
    const rowCounts = [0, 0, 0];
    let ok = true;

    const order = [0,1,2,3,4,5,6,7,8].sort((a, b) => colCounts[b] - colCounts[a]);
    for (const c of order) {
      const cnt = colCounts[c];
      const availRows = [0, 1, 2].filter(r => rowCounts[r] < 5);
      if (availRows.length < cnt) { ok = false; break; }
      availRows.sort(() => Math.random() - 0.5);
      const chosen = availRows.slice(0, cnt).sort((a, b) => a - b);
      chosen.forEach((r, idx) => {
        grid[r][c] = colNums[c][idx];
        rowCounts[r]++;
      });
    }
    if (ok && rowCounts.every(x => x === 5)) valid = true;
  }
  return grid;
}

function createPenCrossSVG(animate = true) {
  const s1Class = animate ? 'class="pen-stroke-1"' : '';
  const s2Class = animate ? 'class="pen-stroke-2"' : '';
  const cClass = animate ? 'class="pen-circle"' : '';
  return `
    <svg class="pen-mark" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path ${s1Class} d="M18 22 C40 42, 62 60, 84 82" stroke="#dc2626" stroke-width="7.5" stroke-linecap="round"/>
      <path ${s2Class} d="M82 18 C60 42, 38 62, 16 84" stroke="#dc2626" stroke-width="7.5" stroke-linecap="round"/>
      <path ${cClass} d="M50 10 C76 8, 92 28, 90 52 C88 76, 68 92, 46 90 C22 88, 8 68, 11 45 C14 24, 32 11, 54 11" stroke="#1d4ed8" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
    </svg>
  `;
}

function renderTicket(newlyMarkedNum = null) {
  const el = document.getElementById("ticketGrid");
  el.innerHTML = "";
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) {
      const val = ticket[r][c];
      const cell = document.createElement("div");
      if (val === 0) {
        cell.className = "cell empty";
      } else {
        const isMarked = markedSet.has(val);
        cell.className = "cell" + (isMarked ? " marked" : "");
        cell.innerHTML = `<span>${val}</span>` + (isMarked ? createPenCrossSVG(val === newlyMarkedNum) : "");
        cell.onclick = () => toggleMark(val);
      }
      el.appendChild(cell);
    }
  }
}

function toggleMark(num) {
  if (!calledNumbers.includes(num)) {
    showToast(`⚠️ ${num} hasn't been called yet!`);
    return;
  }
  if (markedSet.has(num)) {
    markedSet.delete(num);
    renderTicket(null);
  } else {
    markedSet.add(num);
    renderTicket(num);
  }
}

function hostGame() {
  myName = document.getElementById("playerName").value.trim() || "Host";
  isHost = true;
  const shortId = "TAM-" + Math.floor(1000 + Math.random() * 9000);
  document.getElementById("connStatus").textContent = "Creating global any-network room...";

  peer = new Peer(shortId, { config: ANY_NETWORK_ICE });
  peer.on("open", (id) => {
    currentRoomId = id;
    startGameUI(id, "Host");
    document.getElementById("hostControls").style.display = "block";
  });

  peer.on("connection", (conn) => {
    connections.push(conn);
    conn.on("open", () => {
      conn.send({ type: "SYNC_STATE", calledNumbers, claims });
    });
    conn.on("data", (data) => handleHostIncoming(data, conn));
    conn.on("close", () => {
      connections = connections.filter(c => c !== conn);
    });
  });

  peer.on("error", (err) => {
    document.getElementById("connStatus").textContent = "Connection error: " + err.type;
  });
}

function joinGame() {
  myName = document.getElementById("playerName").value.trim() || "Player";
  const roomId = document.getElementById("joinRoomId").value.trim().toUpperCase();
  if (!roomId) return showToast("Enter a valid Room ID");

  isHost = false;
  currentRoomId = roomId;
  document.getElementById("connStatus").textContent = "Connecting across network...";
  peer = new Peer({ config: ANY_NETWORK_ICE });

  peer.on("open", () => {
    hostConn = peer.connect(roomId, { reliable: true });
    hostConn.on("open", () => {
      startGameUI(roomId, "Player");
    });
    hostConn.on("data", (data) => handleClientIncoming(data));
    hostConn.on("close", () => showToast("Disconnected from host"));
  });

  peer.on("error", (err) => {
    document.getElementById("connStatus").textContent = "Could not connect: " + err.type;
  });
}

function startGameUI(roomId, role) {
  document.getElementById("setupPanel").style.display = "none";
  document.getElementById("gameArea").style.display = "grid";
  document.getElementById("displayRoomId").textContent = roomId;
  document.getElementById("displayRole").textContent = `${role} (${myName})`;
  ticket = generateTicket();
  renderTicket();
}

function broadcast(payload) {
  connections.forEach(c => { if (c.open) c.send(payload); });
}

function drawNextNumber() {
  if (!isHost || drawLock) return;
  if (calledNumbers.length >= 90) {
    showToast("All 90 numbers have been called!");
    if (autoTimer) toggleAutoDraw();
    return;
  }

  drawLock = true;
  const available = [];
  for (let i = 1; i <= 90; i++) {
    if (!calledNumbers.includes(i)) available.push(i);
  }
  const next = available[Math.floor(Math.random() * available.length)];
  calledNumbers.push(next);

  applyNewNumber(next);
  broadcast({ type: "NUMBER_DRAWN", number: next, calledNumbers });
  setTimeout(() => { drawLock = false; }, 350);
}

function toggleAutoDraw() {
  const btn = document.getElementById("autoBtn");
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    btn.textContent = "▶ Auto Draw (5s)";
  } else {
    drawNextNumber();
    autoTimer = setInterval(drawNextNumber, 5000);
    btn.textContent = "⏸ Stop Auto";
  }
}

function applyNewNumber(num) {
  document.getElementById(`b-${num}`)?.classList.add("called");
  document.getElementById("calledCount").textContent = calledNumbers.length;
  showDrawPopup(num);
}

function validateClaim(type, playerTicket) {
  const isCalled = (n) => n > 0 && calledNumbers.includes(n);
  const rowNums = (r) => playerTicket[r].filter(n => n > 0);

  if (type === "jaldi5") {
    let count = 0;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 9; c++)
        if (isCalled(playerTicket[r][c])) count++;
    return count >= 5;
  }
  if (type === "topLine") return rowNums(0).every(isCalled);
  if (type === "midLine") return rowNums(1).every(isCalled);
  if (type === "botLine") return rowNums(2).every(isCalled);
  if (type === "corners") {
    const top = rowNums(0);
    const bot = rowNums(2);
    const corners = [top[0], top[top.length - 1], bot[0], bot[bot.length - 1]];
    return corners.every(isCalled);
  }
  if (type === "fullHouse") {
    return [0, 1, 2].every(r => rowNums(r).every(isCalled));
  }
  return false;
}

function requestClaim(type) {
  if (claims[type]) return showToast(`${PRIZE_LABELS[type]} already won by ${claims[type]}!`);

  if (!validateClaim(type, ticket)) {
    return showToast(`❌ Bogey! Required numbers for ${PRIZE_LABELS[type]} are not all called yet.`);
  }

  if (isHost) {
    processClaim(type, myName, ticket);
  } else if (hostConn && hostConn.open) {
    hostConn.send({ type: "CLAIM_REQUEST", prize: type, playerName: myName, ticket });
  }
}

function processClaim(prize, playerName, playerTicket) {
  if (claims[prize]) return;
  if (!validateClaim(prize, playerTicket)) return;

  claims[prize] = playerName;
  updateClaimsUI();
  showWinnerReveal(prize, playerName);
  broadcast({ type: "CLAIM_APPROVED", prize, playerName, claims });
}

function updateClaimsUI() {
  for (const [key, winner] of Object.entries(claims)) {
    const btn = document.getElementById(`btn-${key}`);
    if (winner && btn) {
      btn.classList.add("won");
      btn.textContent = `🏅 ${PRIZE_LABELS[key]} (${winner})`;
    }
  }
}

function handleHostIncoming(data, conn) {
  if (data.type === "CLAIM_REQUEST") {
    if (claims[data.prize]) {
      conn.send({ type: "TOAST", msg: `Too late! ${claims[data.prize]} already claimed it.` });
    } else if (validateClaim(data.prize, data.ticket)) {
      processClaim(data.prize, data.playerName, data.ticket);
    } else {
      conn.send({ type: "TOAST", msg: "❌ Invalid (Bogey) claim rejected by Host." });
    }
  }
}

function handleClientIncoming(data) {
  if (data.type === "SYNC_STATE") {
    calledNumbers = data.calledNumbers;
    claims = data.claims;
    calledNumbers.forEach(n => document.getElementById(`b-${n}`)?.classList.add("called"));
    document.getElementById("calledCount").textContent = calledNumbers.length;
    updateClaimsUI();
  } else if (data.type === "NUMBER_DRAWN") {
    calledNumbers = data.calledNumbers;
    applyNewNumber(data.number);
  } else if (data.type === "CLAIM_APPROVED") {
    claims = data.claims;
    updateClaimsUI();
    showWinnerReveal(data.prize, data.playerName);
  } else if (data.type === "TOAST") {
    showToast(data.msg);
  }
}
