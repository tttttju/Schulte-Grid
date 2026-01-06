const wordBank = {
  englishWords: [
    "apple", "ball", "cat", "dog", "egg", "fish", "green", "hat", "ice", "juice",
    "kite", "lion", "moon", "nest", "orange", "panda", "queen", "rain", "star", "tree",
    "umbrella", "violin", "whale", "xylophone", "yoyo", "zebra", "sun", "book", "chair",
    "desk", "flower", "grass", "house", "island", "jelly", "key", "leaf", "milk", "night",
    "ocean", "pig", "quilt", "river", "snow", "train", "watch", "box", "cloud", "car"
  ],
  chinese: {
    animals: ["猫", "狗", "鸟", "鱼", "兔", "马", "牛", "羊", "猴", "虎", "熊", "象", "鹿", "鸡", "鸭", "鹅", "猪", "狼", "狐", "鲸", "蝶", "蜂", "蛇", "龟", "鹿"],
    colors: ["红", "橙", "黄", "绿", "青", "蓝", "紫", "粉", "白", "黑", "灰", "棕", "金", "银", "彩", "亮", "淡", "深", "暖", "冷", "翠", "墨", "霞", "碧", "青"],
    traffic: ["车", "船", "飞", "桥", "路", "站", "灯", "停", "行", "转", "轮", "轨", "线", "票", "站", "门", "航", "铁", "汽", "摩", "巴", "站", "舱", "港", "站"],
    daily: ["桌", "椅", "杯", "碗", "勺", "衣", "鞋", "帽", "包", "床", "门", "窗", "书", "笔", "纸", "钟", "灯", "伞", "锅", "盆", "牙", "镜", "桶", "箱", "钥"]
  }
};

const state = {
  mode: "number",
  size: 4,
  timerMode: "countup",
  countdownSeconds: 60,
  difficulty: "normal",
  case: "upper",
  soundOn: true,
  eyeCare: false,
  sequence: [],
  currentIndex: 0,
  errors: 0,
  timer: null,
  startTime: null,
  elapsedSeconds: 0,
  paused: false
};

const views = {
  home: document.getElementById("homeView"),
  game: document.getElementById("gameView"),
  result: document.getElementById("resultView"),
  settings: document.getElementById("settingsView")
};

const grid = document.getElementById("grid");
const targetValue = document.getElementById("targetValue");
const timerDisplay = document.getElementById("timerDisplay");
const errorCount = document.getElementById("errorCount");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");

const bestStats = document.getElementById("bestStats");
const recentScores = document.getElementById("recentScores");
const resultTime = document.getElementById("resultTime");
const resultErrors = document.getElementById("resultErrors");
const resultStars = document.getElementById("resultStars");

const countdownConfig = document.getElementById("countdownConfig");
const countdownSeconds = document.getElementById("countdownSeconds");

const parentAccess = document.getElementById("parentAccess");
let longPressTimer = null;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const scoresKey = "schulte_scores";
const settingsKey = "schulte_settings";

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem(settingsKey) || "{}");
  state.soundOn = saved.soundOn ?? true;
  state.difficulty = saved.difficulty ?? "normal";
  state.case = saved.case ?? "upper";
  state.eyeCare = saved.eyeCare ?? false;
  applySettingsToUI();
}

function applySettingsToUI() {
  document.getElementById("soundToggle").checked = state.soundOn;
  document.getElementById("difficultySelect").value = state.difficulty;
  document.getElementById("caseSelect").value = state.case;
  document.getElementById("eyeCareToggle").checked = state.eyeCare;
  document.body.classList.toggle("eye-care", state.eyeCare);
}

function saveSettings() {
  localStorage.setItem(settingsKey, JSON.stringify({
    soundOn: state.soundOn,
    difficulty: state.difficulty,
    case: state.case,
    eyeCare: state.eyeCare
  }));
}

function switchView(view) {
  Object.values(views).forEach(section => section.classList.remove("view-active"));
  views[view].classList.add("view-active");
}

function randomSample(array, count) {
  const copy = [...array];
  const result = [];
  while (result.length < count && copy.length) {
    const index = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(index, 1)[0]);
  }
  return result;
}

function generateSequence() {
  const total = state.size * state.size;
  if (state.mode === "number") {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (state.mode === "english") {
    if (state.difficulty === "easy") {
      return Array.from({ length: total }, (_, i) => String.fromCharCode(65 + i));
    }
    const words = randomSample(wordBank.englishWords, total);
    return words.map(word => state.case === "upper" ? word.toUpperCase() : word.toLowerCase());
  }
  const categories = Object.values(wordBank.chinese).flat();
  return randomSample(categories, total);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createGrid() {
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${state.size}, 1fr)`;
  const items = shuffle(state.sequence);
  items.forEach(value => {
    const button = document.createElement("button");
    button.textContent = value;
    button.dataset.value = value;
    button.addEventListener("click", () => handleCellClick(button));
    grid.appendChild(button);
  });
}

function handleCellClick(button) {
  if (state.paused) return;
  const expected = state.sequence[state.currentIndex];
  const value = button.dataset.value;
  if (`${value}` === `${expected}`) {
    state.currentIndex += 1;
    button.classList.add("correct", "completed");
    button.disabled = true;
    playSound("correct");
    if (state.currentIndex >= state.sequence.length) {
      finishGame();
    } else {
      updateTarget();
    }
  } else {
    state.errors += 1;
    errorCount.textContent = state.errors;
    button.classList.add("wrong");
    playSound("wrong");
    setTimeout(() => button.classList.remove("wrong"), 300);
  }
}

function updateTarget() {
  targetValue.textContent = state.sequence[state.currentIndex];
}

function formatTime(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2, "0");
  const sec = String(seconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function startTimer() {
  state.elapsedSeconds = 0;
  if (state.timer) clearInterval(state.timer);
  state.startTime = Date.now();
  if (state.timerMode === "countdown") {
    state.elapsedSeconds = state.countdownSeconds;
    timerDisplay.textContent = formatTime(state.elapsedSeconds);
  }
  state.timer = setInterval(() => {
    if (state.paused) return;
    if (state.timerMode === "countup") {
      state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
      timerDisplay.textContent = formatTime(state.elapsedSeconds);
    } else {
      state.elapsedSeconds -= 1;
      timerDisplay.textContent = formatTime(state.elapsedSeconds);
      if (state.elapsedSeconds <= 0) {
        finishGame(true);
      }
    }
  }, 1000);
}

function stopTimer() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}

function startGame() {
  state.sequence = generateSequence();
  state.currentIndex = 0;
  state.errors = 0;
  state.paused = false;
  errorCount.textContent = "0";
  updateTarget();
  createGrid();
  startTimer();
  switchView("game");
}

function finishGame(timeout = false) {
  stopTimer();
  overlay.classList.add("is-hidden");
  const totalTime = state.timerMode === "countdown" ? state.countdownSeconds - state.elapsedSeconds : state.elapsedSeconds;
  const resultTimeValue = timeout ? state.countdownSeconds : totalTime;
  resultTime.textContent = formatTime(resultTimeValue);
  resultErrors.textContent = state.errors;
  resultStars.textContent = calculateStars(resultTimeValue, state.errors);
  saveScore(resultTimeValue, state.errors, timeout);
  renderRecentScores();
  switchView("result");
}

function calculateStars(time, errors) {
  let score = 3;
  if (time > 90) score -= 1;
  if (time > 150) score -= 1;
  if (errors > 0) score -= 1;
  if (errors > 3) score -= 1;
  if (score < 1) score = 1;
  return "★".repeat(score) + "☆".repeat(3 - score);
}

function playSound(type) {
  if (!state.soundOn) return;
  if (!audioCtx) return;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = type === "correct" ? 560 : 220;
  gain.gain.value = 0.15;
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.15);
}

function saveScore(time, errors, timeout) {
  const key = `${state.mode}_${state.size}_${state.timerMode}`;
  const scores = JSON.parse(localStorage.getItem(scoresKey) || "{}");
  const entry = {
    time,
    errors,
    timeout,
    date: new Date().toLocaleDateString()
  };
  scores[key] = scores[key] || { best: null, recent: [] };
  scores[key].recent.unshift(entry);
  scores[key].recent = scores[key].recent.slice(0, 10);
  if (!timeout && (!scores[key].best || time < scores[key].best.time || (time === scores[key].best.time && errors < scores[key].best.errors))) {
    scores[key].best = entry;
  }
  localStorage.setItem(scoresKey, JSON.stringify(scores));
  renderBestStats();
}

function renderBestStats() {
  const scores = JSON.parse(localStorage.getItem(scoresKey) || "{}");
  const modes = ["number", "english", "chinese"];
  bestStats.innerHTML = "";
  modes.forEach(mode => {
    const key = `${mode}_${state.size}_${state.timerMode}`;
    const record = scores[key]?.best;
    const label = mode === "number" ? "数字" : mode === "english" ? "英文" : "汉字";
    const card = document.createElement("div");
    card.className = "stats-card";
    card.innerHTML = `
      <strong>${label}</strong>
      <div>${record ? `${formatTime(record.time)} / 错误 ${record.errors}` : "暂无成绩"}</div>
    `;
    bestStats.appendChild(card);
  });
}

function renderRecentScores() {
  const key = `${state.mode}_${state.size}_${state.timerMode}`;
  const scores = JSON.parse(localStorage.getItem(scoresKey) || "{}");
  const recent = scores[key]?.recent || [];
  recentScores.innerHTML = "<h3>最近 10 次</h3>";
  if (!recent.length) {
    recentScores.innerHTML += "<p>暂无记录</p>";
    return;
  }
  recent.forEach(item => {
    const div = document.createElement("div");
    div.textContent = `${item.date} - ${formatTime(item.time)} - 错误 ${item.errors}`;
    recentScores.appendChild(div);
  });
}

function toggleCountdown() {
  if (state.timerMode === "countdown") {
    countdownConfig.classList.remove("is-hidden");
  } else {
    countdownConfig.classList.add("is-hidden");
  }
}

function pauseGame() {
  state.paused = true;
  overlay.classList.remove("is-hidden");
  overlayText.textContent = "已暂停";
}

function resumeGame() {
  state.paused = false;
  overlay.classList.add("is-hidden");
}

function restartGame() {
  stopTimer();
  startGame();
}

function setupControls() {
  document.querySelectorAll(".segmented-btn[data-mode]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segmented-btn[data-mode]").forEach(btn => btn.classList.remove("is-active"));
      button.classList.add("is-active");
      state.mode = button.dataset.mode;
    });
  });

  document.querySelectorAll(".segmented-btn[data-size]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segmented-btn[data-size]").forEach(btn => btn.classList.remove("is-active"));
      button.classList.add("is-active");
      state.size = Number(button.dataset.size);
      renderBestStats();
    });
  });

  document.querySelectorAll(".segmented-btn[data-timer]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segmented-btn[data-timer]").forEach(btn => btn.classList.remove("is-active"));
      button.classList.add("is-active");
      state.timerMode = button.dataset.timer;
      toggleCountdown();
      renderBestStats();
    });
  });

  countdownSeconds.addEventListener("change", (event) => {
    const value = Number(event.target.value);
    state.countdownSeconds = Math.min(300, Math.max(10, value));
    event.target.value = state.countdownSeconds;
  });

  document.getElementById("startGame").addEventListener("click", () => startGame());
  document.getElementById("pauseGame").addEventListener("click", pauseGame);
  document.getElementById("resumeGame").addEventListener("click", resumeGame);
  document.getElementById("restartGame").addEventListener("click", restartGame);
  document.getElementById("backHome").addEventListener("click", () => {
    stopTimer();
    switchView("home");
  });
  document.getElementById("playAgain").addEventListener("click", () => startGame());
  document.getElementById("backHomeFromResult").addEventListener("click", () => switchView("home"));

  parentAccess.addEventListener("touchstart", handleLongPressStart);
  parentAccess.addEventListener("mousedown", handleLongPressStart);
  parentAccess.addEventListener("touchend", handleLongPressEnd);
  parentAccess.addEventListener("mouseup", handleLongPressEnd);
  parentAccess.addEventListener("mouseleave", handleLongPressEnd);

  document.getElementById("closeSettings").addEventListener("click", () => {
    saveSettings();
    switchView("home");
  });

  document.getElementById("soundToggle").addEventListener("change", (event) => {
    state.soundOn = event.target.checked;
  });
  document.getElementById("difficultySelect").addEventListener("change", (event) => {
    state.difficulty = event.target.value;
  });
  document.getElementById("caseSelect").addEventListener("change", (event) => {
    state.case = event.target.value;
  });
  document.getElementById("eyeCareToggle").addEventListener("change", (event) => {
    state.eyeCare = event.target.checked;
    document.body.classList.toggle("eye-care", state.eyeCare);
  });
}

function handleLongPressStart() {
  longPressTimer = setTimeout(() => {
    switchView("settings");
  }, 3000);
}

function handleLongPressEnd() {
  if (longPressTimer) clearTimeout(longPressTimer);
}

loadSettings();
setupControls();
renderBestStats();
toggleCountdown();
