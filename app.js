const STORAGE_KEY = "todos";
const THEME_KEY = "todos-theme";
const STATS_KEY = "todos-stats";
const VALID_THEMES = ["light", "dark", "sunset", "sage", "midnight", "robinhood"];
const FOCUS_MS = 25 * 60 * 1000;

const form = document.getElementById("add-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const counter = document.getElementById("counter");
const filters = document.getElementById("filters");
const clearCompletedBtn = document.getElementById("clear-completed");
const palette = document.getElementById("palette");
const focusBar = document.getElementById("focus-bar");
const focusBarText = document.getElementById("focus-bar-text");
const focusBarTime = document.getElementById("focus-bar-time");
const focusBarCancel = document.getElementById("focus-bar-cancel");
const statCompleted = document.getElementById("stat-completed");
const statCompletedDelta = document.getElementById("stat-completed-delta");
const statStreak = document.getElementById("stat-streak");
const statStreakUnit = document.getElementById("stat-streak-unit");
const statFocus = document.getElementById("stat-focus");
const confettiCanvas = document.getElementById("confetti-canvas");

const ORIGINAL_TITLE = document.title;
let tasks = load();
let stats = loadStats();
let currentFilter = "all";
let focusTaskId = null;
let focusEndsAt = 0;
let focusInterval = null;
let focusStartedAt = 0;

applyTheme(loadTheme());
render();
updateStats();

palette.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-theme]");
  if (!btn) return;
  applyTheme(btn.dataset.theme);
});

function applyTheme(theme) {
  if (!VALID_THEMES.includes(theme)) theme = "light";
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  for (const b of palette.querySelectorAll("button[data-theme]")) {
    b.classList.toggle("active", b.dataset.theme === theme);
  }
}

function loadTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  tasks.push({ id: Date.now().toString(), text, completed: false, completedAt: null });
  input.value = "";
  save();
  render();
});

list.addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  const id = li.dataset.id;

  if (e.target.matches(".delete")) {
    if (id === focusTaskId) cancelFocus();
    tasks = tasks.filter((t) => t.id !== id);
    save();
    render();
  } else if (e.target.matches(".focus")) {
    startFocus(id);
  } else if (e.target.matches('input[type="checkbox"]')) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      const wasCompleted = task.completed;
      task.completed = e.target.checked;
      task.completedAt = task.completed ? Date.now() : null;
      if (task.completed && !wasCompleted) {
        recordCompletion();
        burstConfetti(li);
        li.classList.add("just-completed");
      }
      if (task.completed && id === focusTaskId) cancelFocus();
      save();
      render();
      updateStats();
    }
  }
});

focusBarCancel.addEventListener("click", cancelFocus);

filters.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-filter]");
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  for (const b of filters.querySelectorAll("button")) {
    b.classList.toggle("active", b === btn);
  }
  render();
});

clearCompletedBtn.addEventListener("click", () => {
  tasks = tasks.filter((t) => !t.completed);
  save();
  render();
});

function render() {
  const visible = tasks.filter((t) => {
    if (currentFilter === "active") return !t.completed;
    if (currentFilter === "completed") return t.completed;
    return true;
  });

  list.innerHTML = visible.map(taskHTML).join("");
  emptyState.style.display = tasks.length === 0 ? "block" : "none";

  const done = tasks.filter((t) => t.completed).length;
  counter.textContent = `${done} of ${tasks.length} done`;
}

function taskHTML(t) {
  const safe = escapeHTML(t.text);
  const isFocused = t.id === focusTaskId;
  const meta = t.completed && t.completedAt
    ? `<span class="task-meta task-meta--done">+1</span>`
    : isFocused
    ? `<span class="task-meta task-meta--live">LIVE</span>`
    : `<span class="task-meta task-meta--idle">—</span>`;
  return `
    <li data-id="${t.id}" class="${t.completed ? "completed" : ""}${isFocused ? " focused" : ""}">
      <input type="checkbox" ${t.completed ? "checked" : ""} />
      <span class="text">${safe}</span>
      ${meta}
      <button class="focus" aria-label="Focus on task" ${t.completed ? "disabled" : ""}>▶</button>
      <button class="delete" aria-label="Delete task">×</button>
    </li>
  `;
}

function escapeHTML(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY));
    return s || { lastCompletionDate: null, streak: 0, focusMinutesByDay: {} };
  } catch {
    return { lastCompletionDate: null, streak: 0, focusMinutesByDay: {} };
  }
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function recordCompletion() {
  const today = todayKey();
  if (stats.lastCompletionDate === today) return;
  if (stats.lastCompletionDate === yesterdayKey()) {
    stats.streak += 1;
  } else {
    stats.streak = 1;
  }
  stats.lastCompletionDate = today;
  saveStats();
}

function recordFocusMinutes(minutes) {
  if (minutes <= 0) return;
  const k = todayKey();
  stats.focusMinutesByDay[k] = (stats.focusMinutesByDay[k] || 0) + minutes;
  saveStats();
}

function updateStats() {
  const today = todayKey();
  const completedToday = tasks.filter(
    (t) => t.completed && t.completedAt && sameDay(t.completedAt, today)
  ).length;
  statCompleted.textContent = completedToday;
  statCompletedDelta.textContent = `▲ ${completedToday}`;
  statCompletedDelta.classList.toggle("stat__delta--up", completedToday > 0);
  statCompletedDelta.classList.toggle("stat__delta--flat", completedToday === 0);

  const streak = stats.lastCompletionDate === today || stats.lastCompletionDate === yesterdayKey()
    ? stats.streak
    : 0;
  statStreak.textContent = streak;
  statStreakUnit.textContent = streak === 1 ? "day" : "days";

  const focusToday = Math.round(stats.focusMinutesByDay[today] || 0);
  statFocus.innerHTML = `${focusToday}<span class="stat__unit">m</span>`;
}

function sameDay(ts, key) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` === key;
}

function startFocus(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task || task.completed) return;

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  if (focusInterval) clearInterval(focusInterval);

  focusTaskId = id;
  focusStartedAt = Date.now();
  focusEndsAt = Date.now() + FOCUS_MS;
  focusBarText.textContent = task.text;
  focusBar.hidden = false;
  tick();
  focusInterval = setInterval(tick, 1000);
  render();
}

function cancelFocus() {
  if (focusInterval) clearInterval(focusInterval);
  if (focusStartedAt) {
    const elapsedMin = (Date.now() - focusStartedAt) / 60000;
    recordFocusMinutes(elapsedMin);
    updateStats();
  }
  focusInterval = null;
  focusTaskId = null;
  focusEndsAt = 0;
  focusStartedAt = 0;
  focusBar.hidden = true;
  document.title = ORIGINAL_TITLE;
  render();
}

function tick() {
  const remaining = Math.max(0, focusEndsAt - Date.now());
  const display = formatTime(remaining);
  focusBarTime.textContent = display;
  const task = tasks.find((t) => t.id === focusTaskId);
  document.title = task ? `${display} — ${task.text}` : ORIGINAL_TITLE;
  if (remaining === 0) completeFocus(task);
}

function completeFocus(task) {
  const name = task ? task.text : "your task";
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Done — " + name, { body: "25 minutes complete." });
  }
  recordFocusMinutes(25);
  updateStats();
  cancelFocus();
}

function formatTime(ms) {
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// --- Confetti burst ---
const ctx = confettiCanvas.getContext("2d");
let confettiParticles = [];
let confettiRaf = null;

function resizeConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
resizeConfetti();
window.addEventListener("resize", resizeConfetti);

function burstConfetti(originEl) {
  const rect = originEl.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const colors = ["#00C805", "#21CE99", "#5AC8FA", "#FFD60A", "#FFFFFF"];
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 6;
    confettiParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 60 + Math.random() * 30,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    });
  }
  if (!confettiRaf) confettiRaf = requestAnimationFrame(stepConfetti);
}

function stepConfetti() {
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  confettiParticles = confettiParticles.filter((p) => p.life > 0);
  for (const p of confettiParticles) {
    p.vy += 0.18;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life / 60);
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
    ctx.restore();
  }
  if (confettiParticles.length > 0) {
    confettiRaf = requestAnimationFrame(stepConfetti);
  } else {
    confettiRaf = null;
  }
}
