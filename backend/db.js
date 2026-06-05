/**
 * Couche d'accès aux données.
 *
 * Deux modes :
 *  - PostgreSQL : utilisé dès qu'une variable d'environnement DB_HOST est présente
 *    (c'est le cas dans Docker Compose). Les données sont alors persistées.
 *  - Mémoire    : fallback automatique si aucune base n'est configurée, pour
 *    pouvoir lancer l'appli en local sans installer PostgreSQL.
 *
 * Modèle d'une tâche :
 *   id, title, emoji, status ('todo'|'doing'|'done'), due_date (YYYY-MM-DD|null), created_at
 *
 * Les deux modes exposent la même interface : getTasks / createTask /
 * updateTask / deleteTask / init.
 */

const usePostgres = Boolean(process.env.DB_HOST);

// Décale une date de N jours par rapport à aujourd'hui → 'YYYY-MM-DD'.
function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

let impl;

if (usePostgres) {
  const { Pool } = require('pg');

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'kanban',
    password: process.env.DB_PASSWORD || 'kanban',
    database: process.env.DB_NAME || 'kanban',
  });

  impl = {
    mode: 'postgres',

    // Crée la table si elle n'existe pas (au cas où le script SQL d'init
    // n'aurait pas été joué). Réessaie tant que la base n'est pas prête.
    async init(retries = 10) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
              id         SERIAL PRIMARY KEY,
              title      TEXT NOT NULL,
              emoji      TEXT NOT NULL DEFAULT '📝',
              status     TEXT NOT NULL DEFAULT 'todo',
              due_date   DATE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
          `);
          console.log('[db] Connecté à PostgreSQL, table "tasks" prête.');
          return;
        } catch (err) {
          console.warn(
            `[db] PostgreSQL pas encore prêt (tentative ${attempt}/${retries}) : ${err.message}`
          );
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      throw new Error('Impossible de se connecter à PostgreSQL.');
    },

    async getTasks() {
      const { rows } = await pool.query(
        `SELECT id, title, emoji, status,
                to_char(due_date, 'YYYY-MM-DD') AS due_date,
                created_at
         FROM tasks ORDER BY id`
      );
      return rows;
    },

    async createTask({ title, emoji, status, due_date }) {
      const { rows } = await pool.query(
        `INSERT INTO tasks (title, emoji, status, due_date)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, emoji, status,
                   to_char(due_date, 'YYYY-MM-DD') AS due_date, created_at`,
        [title, emoji || '📝', status || 'todo', due_date || null]
      );
      return rows[0];
    },

    async updateTask(id, fields) {
      const sets = [];
      const values = [];
      let i = 1;
      for (const key of ['title', 'emoji', 'status', 'due_date']) {
        if (fields[key] !== undefined) {
          sets.push(`${key} = $${i++}`);
          values.push(fields[key]);
        }
      }
      if (sets.length === 0) return this._findById(id);
      values.push(id);
      const { rows } = await pool.query(
        `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${i}
         RETURNING id, title, emoji, status,
                   to_char(due_date, 'YYYY-MM-DD') AS due_date, created_at`,
        values
      );
      return rows[0] || null;
    },

    async deleteTask(id) {
      const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async _findById(id) {
      const { rows } = await pool.query(
        `SELECT id, title, emoji, status,
                to_char(due_date, 'YYYY-MM-DD') AS due_date, created_at
         FROM tasks WHERE id = $1`,
        [id]
      );
      return rows[0] || null;
    },
  };
} else {
  // ---- Mode mémoire (dev local sans base) ----
  let tasks = [];
  let nextId = 1;

  function seed(title, emoji, status, due_date) {
    return { id: nextId++, title, emoji, status, due_date, created_at: new Date().toISOString() };
  }

  impl = {
    mode: 'memory',

    async init() {
      // Données de démo proches du template (avec dates relatives à aujourd'hui).
      tasks = [
        seed('Go to the Gym', '🏋️', 'todo', dayOffset(0)),
        seed('Learn how to use Notion', '📝', 'todo', dayOffset(1)),
        seed('Clean the flat', '🧹', 'todo', dayOffset(5)),
        seed('Plant some tomatoes', '🍅', 'todo', dayOffset(-2)),
        seed('Record a video', '🎥', 'todo', dayOffset(4)),
        seed('Run 1 hour', '🏃', 'todo', dayOffset(4)),
        seed('Play Fortnite', '🎮', 'doing', dayOffset(-3)),
        seed('Cook lasagna', '🍝', 'doing', dayOffset(0)),
        seed('Call mom', '📞', 'done', dayOffset(-1)),
        seed('Grab kids at school', '🧒', 'done', dayOffset(-1)),
        seed('Study', '📚', 'done', dayOffset(2)),
      ];
      console.log('[db] Mode MÉMOIRE (aucune base configurée). Données non persistées.');
    },

    async getTasks() {
      return tasks.slice().sort((a, b) => a.id - b.id);
    },

    async createTask({ title, emoji, status, due_date }) {
      const task = seed(title, emoji || '📝', status || 'todo', due_date || null);
      tasks.push(task);
      return task;
    },

    async updateTask(id, fields) {
      const task = tasks.find((t) => t.id === id);
      if (!task) return null;
      for (const key of ['title', 'emoji', 'status', 'due_date']) {
        if (fields[key] !== undefined) task[key] = fields[key];
      }
      return task;
    },

    async deleteTask(id) {
      const before = tasks.length;
      tasks = tasks.filter((t) => t.id !== id);
      return tasks.length < before;
    },
  };
}

module.exports = impl;
