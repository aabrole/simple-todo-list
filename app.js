const STORAGE_KEY = "todos";
const THEME_KEY = "todos-theme";
const VALID_THEMES = ["light", "dark", "sunset", "sage", "midnight"];

const form = document.getElementById("add-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const counter = document.getElementById("counter");
const filters = document.getElementById("filters");
const clearCompletedBtn = document.getElementById("clear-completed");
const palette = document.getElementById("palette");

let tasks = load();
let currentFilter = "all";

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
    tasks = tasks.filter((t) => t.id !== id);
    save();
    render();
  } else if (e.target.matches('input[type="checkbox"]')) {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.completed = e.target.checked;
      save();
      render();
    }
  }
});

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
  return `
    <li data-id="${t.id}" class="${t.completed ? "completed" : ""}">
      <input type="checkbox" ${t.completed ? "checked" : ""} />
      <span class="text">${safe}</span>
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
