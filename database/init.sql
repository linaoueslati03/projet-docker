-- Script d'initialisation de la base de données de l'Advanced To-Do List.
-- Il est exécuté automatiquement par le conteneur PostgreSQL au premier
-- démarrage (via le dossier /docker-entrypoint-initdb.d).

CREATE TABLE IF NOT EXISTS tasks (
    id         SERIAL PRIMARY KEY,
    title      TEXT NOT NULL,
    emoji      TEXT NOT NULL DEFAULT '📝',
    status     TEXT NOT NULL DEFAULT 'todo',  -- 'todo' | 'doing' | 'done'
    due_date   DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tâches de démonstration. Les dates sont relatives à la date du jour
-- (CURRENT_DATE) pour que les étiquettes (« Do it today! », « X days
-- remaining », « Due X days ago ») et le calendrier soient parlants.
INSERT INTO tasks (title, emoji, status, due_date) VALUES
    ('Go to the Gym',            '🏋️', 'todo',  CURRENT_DATE),
    ('Learn how to use Notion',  '📝', 'todo',  CURRENT_DATE + 1),
    ('Clean the flat',           '🧹', 'todo',  CURRENT_DATE + 5),
    ('Plant some tomatoes',      '🍅', 'todo',  CURRENT_DATE - 2),
    ('Record a video',           '🎥', 'todo',  CURRENT_DATE + 4),
    ('Run 1 hour',               '🏃', 'todo',  CURRENT_DATE + 4),
    ('Play Fortnite',            '🎮', 'doing', CURRENT_DATE - 3),
    ('Cook lasagna',             '🍝', 'doing', CURRENT_DATE),
    ('Call mom',                 '📞', 'done',  CURRENT_DATE - 1),
    ('Grab kids at school',      '🧒', 'done',  CURRENT_DATE - 1),
    ('Study',                    '📚', 'done',  CURRENT_DATE + 2);
