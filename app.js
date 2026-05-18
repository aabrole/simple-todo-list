const STORAGE_KEY = "todos";
const THEME_KEY = "todos-theme";
const VALID_THEMES = ["light", "dark", "sunset", "sage", "midnight"];
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

const ORIGINAL_TITLE = document.title;
let tasks = load();
let currentFilter = "all";
let focusTaskId = null;
let focusEndsAt = 0;
let focusInterval = null;

applyTheme(loadTheme());
render();

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
  tasks.push({ id: Date.now().toString(), text, completed: false });
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
      task.completed = e.target.checked;
      if (task.completed && id === focusTaskId) cancelFocus();
      save();
      render();
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
  return `
    <li data-id="${t.id}" class="${t.completed ? "completed" : ""}${isFocused ? " focused" : ""}">
      <input type="checkbox" ${t.completed ? "checked" : ""} />
      <span class="text">${safe}</span>
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

function startFocus(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task || task.completed) return;

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  if (focusInterval) clearInterval(focusInterval);

  focusTaskId = id;
  focusEndsAt = Date.now() + FOCUS_MS;
  focusBarText.textContent = task.text;
  focusBar.hidden = false;
  tick();
  focusInterval = setInterval(tick, 1000);
  render();
}

function cancelFocus() {
  if (focusInterval) clearInterval(focusInterval);
  focusInterval = null;
  focusTaskId = null;
  focusEndsAt = 0;
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
  cancelFocus();
}

function formatTime(ms) {
  const total = Math.ceil(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}
