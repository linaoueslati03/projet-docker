/**
 * Advanced To-Do List — logique côté client.
 *
 * Communication avec l'API :
 *  - En local (page ouverte en file://), on tape directement http://localhost:3000.
 *  - Servi par Nginx (Docker), on utilise un chemin relatif "/api" que Nginx
 *    redirige (reverse proxy) vers le conteneur backend.
 */

const API_BASE =
  (window.API_BASE || (location.protocol === 'file:' ? 'http://localhost:3000' : '')) + '/api';

// État local
let TASKS = [];
let calCursor = startOfMonth(new Date()); // mois affiché dans le calendrier

// --- Raccourcis DOM ---
const $ = (sel) => document.querySelector(sel);
const COLUMNS = {
  todo: $('#col-todo'),
  doing: $('#col-doing'),
  done: $('#col-done'),
};
const badge = $('#status-badge');

/* =========================================================
   Appels API
   ========================================================= */
async function api(path, options) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function setBadge(text, kind) {
  badge.textContent = text;
  badge.className = 'badge' + (kind ? ' ' + kind : '');
}

async function loadTasks() {
  try {
    TASKS = await api('/tasks');
    setBadge('connected', 'ok');
    renderAll();
  } catch (err) {
    setBadge('API unreachable', 'error');
    console.error(err);
  }
}

/* =========================================================
   Dates & étiquettes
   ========================================================= */
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayYmd() { return ymd(new Date()); }

// Différence en jours entiers entre due_date et aujourd'hui.
function daysFromToday(dueYmd) {
  const today = new Date(todayYmd());
  const due = new Date(dueYmd);
  return Math.round((due - today) / 86400000);
}

// Calcule l'étiquette d'une tâche (texte + classe couleur).
function computeTag(task) {
  if (task.status === 'done') return { text: 'Well Done!', cls: 'tag-green' };
  if (!task.due_date) return null;
  const d = daysFromToday(task.due_date);
  if (d === 0) return { text: 'Do it today!', cls: 'tag-orange' };
  if (d > 0) return { text: `${d} day${d > 1 ? 's' : ''} remaining`, cls: 'tag-green' };
  const n = -d;
  return { text: `Due ${n} day${n > 1 ? 's' : ''} ago`, cls: 'tag-red' };
}

/* =========================================================
   Rendu global
   ========================================================= */
function renderAll() {
  renderBoard();
  renderCalendar();
  renderCompletion();
}

/* ---- Vue Status (Kanban) ---- */
function renderBoard() {
  Object.values(COLUMNS).forEach((c) => (c.innerHTML = ''));
  for (const task of TASKS) {
    const col = COLUMNS[task.status] || COLUMNS.todo;
    col.appendChild(createCard(task));
  }
}

function createCard(task) {
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = true;
  card.dataset.id = task.id;

  const title = document.createElement('div');
  title.className = 'card-title';
  title.innerHTML = `<span class="card-emoji">${task.emoji || '📝'}</span><span></span>`;
  title.children[1].textContent = task.title;
  card.appendChild(title);

  const tag = computeTag(task);
  if (tag) {
    const el = document.createElement('span');
    el.className = 'tag ' + tag.cls;
    el.textContent = tag.text;
    card.appendChild(el);
  }

  // Clic = éditer (sauf pendant un drag)
  card.addEventListener('click', () => openModal(task));

  // Drag & drop
  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', task.id);
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  return card;
}

// Zones de drop = colonnes
document.querySelectorAll('.column').forEach((col) => {
  const status = col.dataset.status;
  const zone = col.querySelector('.cards');
  col.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  col.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  col.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const id = Number(e.dataTransfer.getData('text/plain'));
    const task = TASKS.find((t) => t.id === id);
    if (task && task.status !== status) updateTask(id, { status });
  });
});

/* ---- Vue Calendar ---- */
function renderCalendar() {
  const grid = $('#cal-grid');
  grid.innerHTML = '';

  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();
  $('#cal-title').textContent = calCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Lundi = premier jour de la grille
  const first = new Date(year, month, 1);
  let startOffset = (first.getDay() + 6) % 7; // 0 = lundi
  const start = new Date(year, month, 1 - startOffset);

  // Regroupe les tâches par date
  const byDate = {};
  for (const t of TASKS) {
    if (!t.due_date) continue;
    (byDate[t.due_date] = byDate[t.due_date] || []).push(t);
  }

  for (let i = 0; i < 42; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (day.getMonth() !== month) cell.classList.add('other-month');
    if (ymd(day) === todayYmd()) cell.classList.add('today');

    const num = document.createElement('div');
    num.className = 'day-num';
    num.textContent = day.getDate();
    cell.appendChild(num);

    for (const t of byDate[ymd(day)] || []) {
      const el = document.createElement('div');
      el.className = 'cal-task' + (t.status === 'done' ? ' done' : '');
      el.textContent = `${t.emoji || '📝'} ${t.title}`;
      el.title = t.title;
      el.addEventListener('click', () => openModal(t));
      cell.appendChild(el);
    }
    grid.appendChild(cell);
  }
}

$('#cal-prev').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); });
$('#cal-next').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); });
$('#cal-today').addEventListener('click', () => { calCursor = startOfMonth(new Date()); renderCalendar(); });

/* ---- Completion ---- */
function renderCompletion() {
  const today = new Date(todayYmd());
  const periods = {
    today: (d) => ymd(d) === todayYmd(),
    week: (d) => withinDays(d, 7),
    month: (d) => d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear(),
    year: (d) => d.getFullYear() === today.getFullYear(),
  };

  for (const [key, inPeriod] of Object.entries(periods)) {
    const scoped = TASKS.filter((t) => t.due_date && inPeriod(new Date(t.due_date)));
    const done = scoped.filter((t) => t.status === 'done').length;
    const pct = scoped.length ? Math.round((done / scoped.length) * 100) : 0;
    const row = document.querySelector(`.bar[data-period="${key}"]`);
    row.querySelector('.bar-val').textContent = pct + '%';
    row.querySelector('.bar-fill').style.width = pct + '%';
  }
}

function withinDays(d, n) {
  const diff = daysFromToday(ymd(d));
  return diff >= 0 && diff < n;
}

/* =========================================================
   Actions (CRUD)
   ========================================================= */
async function createTask(data) {
  await api('/tasks', { method: 'POST', body: JSON.stringify(data) });
  await loadTasks();
}
async function updateTask(id, fields) {
  await api(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
  await loadTasks();
}
async function deleteTask(id) {
  await api(`/tasks/${id}`, { method: 'DELETE' });
  await loadTasks();
}

/* =========================================================
   Bascule de vues
   ========================================================= */
document.querySelectorAll('.view-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.view-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const view = tab.dataset.view;
    $('#view-status').classList.toggle('hidden', view !== 'status');
    $('#view-calendar').classList.toggle('hidden', view !== 'calendar');
  });
});

/* =========================================================
   Modale création / édition
   ========================================================= */
const modal = $('#modal');
let editingId = null;

function openModal(task) {
  editingId = task ? task.id : null;
  $('#modal-title').textContent = task ? 'Edit task' : 'Create a new task';
  $('#f-emoji').value = task ? task.emoji || '' : '';
  $('#f-title').value = task ? task.title : '';
  $('#f-status').value = task ? task.status : 'todo';
  $('#f-due').value = task && task.due_date ? task.due_date : '';
  $('#modal-delete').classList.toggle('hidden', !task);
  modal.classList.remove('hidden');
  $('#f-title').focus();
}

function closeModal() {
  modal.classList.add('hidden');
  editingId = null;
}

$('#create-btn').addEventListener('click', () => openModal(null));
$('#modal-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

$('#task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    title: $('#f-title').value.trim(),
    emoji: $('#f-emoji').value.trim() || '📝',
    status: $('#f-status').value,
    due_date: $('#f-due').value || null,
  };
  if (!data.title) return;
  if (editingId) await updateTask(editingId, data);
  else await createTask(data);
  closeModal();
});

$('#modal-delete').addEventListener('click', async () => {
  if (editingId && confirm('Delete this task?')) {
    await deleteTask(editingId);
    closeModal();
  }
});

/* =========================================================
   Démarrage
   ========================================================= */
loadTasks();
