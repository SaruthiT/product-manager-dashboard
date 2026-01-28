CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  comment TEXT NOT NULL,
  source TEXT NOT NULL,
  sentiment TEXT NOT NULL,
  timestamp INTEGER DEFAULT (strftime('%s', 'now'))
);
