/**
 * API REST de l'Advanced To-Do List.
 *
 * Routes :
 *   GET    /api/health        → état du service + mode de stockage
 *   GET    /api/tasks         → liste des tâches
 *   POST   /api/tasks         → créer    body: { title, emoji?, status?, due_date? }
 *   PATCH  /api/tasks/:id      → modifier body: { title?, emoji?, status?, due_date? }
 *   DELETE /api/tasks/:id      → supprimer
 */

const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const STATUSES = ['todo', 'doing', 'done'];

// Valide une date 'YYYY-MM-DD' (ou null/'' pour "pas de date").
function normalizeDate(value) {
  if (value === null || value === '' || value === undefined) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined; // invalide
  return value;
}

app.use(cors());          // autorise le front (autre origine) à appeler l'API
app.use(express.json());  // parse le JSON des requêtes

// --- Santé (utile pour Docker healthcheck) ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', storage: db.mode });
});

// --- Liste ---
app.get('/api/tasks', async (req, res, next) => {
  try {
    res.json(await db.getTasks());
  } catch (err) {
    next(err);
  }
});

// --- Création ---
app.post('/api/tasks', async (req, res, next) => {
  try {
    const title = (req.body.title || '').trim();
    if (!title) {
      return res.status(400).json({ error: 'Le titre est obligatoire.' });
    }
    const status = req.body.status || 'todo';
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `Statut invalide. Attendu : ${STATUSES.join(', ')}.` });
    }
    const due_date = normalizeDate(req.body.due_date);
    if (due_date === undefined) {
      return res.status(400).json({ error: 'Date invalide (format attendu : YYYY-MM-DD).' });
    }
    const task = await db.createTask({
      title,
      emoji: (req.body.emoji || '').trim() || '📝',
      status,
      due_date,
    });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// --- Modification ---
app.patch('/api/tasks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const fields = {};

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) return res.status(400).json({ error: 'Le titre ne peut pas être vide.' });
      fields.title = title;
    }
    if (req.body.emoji !== undefined) {
      fields.emoji = String(req.body.emoji).trim() || '📝';
    }
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: `Statut invalide. Attendu : ${STATUSES.join(', ')}.` });
      }
      fields.status = req.body.status;
    }
    if (req.body.due_date !== undefined) {
      const due_date = normalizeDate(req.body.due_date);
      if (due_date === undefined) {
        return res.status(400).json({ error: 'Date invalide (format attendu : YYYY-MM-DD).' });
      }
      fields.due_date = due_date;
    }

    const task = await db.updateTask(id, fields);
    if (!task) return res.status(404).json({ error: 'Tâche introuvable.' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// --- Suppression ---
app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ok = await db.deleteTask(id);
    if (!ok) return res.status(404).json({ error: 'Tâche introuvable.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- Gestion d'erreur centralisée ---
app.use((err, req, res, next) => {
  console.error('[api] Erreur :', err.message);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

// --- Démarrage : on initialise la base puis on écoute ---
db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[api] API démarrée sur le port ${PORT} (stockage : ${db.mode}).`);
    });
  })
  .catch((err) => {
    console.error('[api] Échec du démarrage :', err.message);
    process.exit(1);
  });
