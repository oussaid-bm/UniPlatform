const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

let db;

const getDb = async () => {
  if (db) return db;

  db = await open({
    filename: path.join(__dirname, 'database.db'),
    driver: sqlite3.Database,
  });

  await db.exec('PRAGMA foreign_keys = ON;');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'professor', 'admin')) DEFAULT 'student',
      filiere TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      professor_id INTEGER NOT NULL,
      filiere TEXT DEFAULT '',
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (professor_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      filiere TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS demandes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      recipient_type TEXT NOT NULL DEFAULT 'admin',
      recipient_id INTEGER DEFAULT NULL,
      recipient_name TEXT DEFAULT 'Administration',
      status TEXT NOT NULL DEFAULT 'en_attente',
      response TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS study_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filiere TEXT DEFAULT '',
      created_by INTEGER NOT NULL,
      creator_name TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS course_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      uploaded_by INTEGER NOT NULL,
      uploader_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS homework_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Migrations pour les colonnes ajoutées sur une DB existante
  const migrate = async (sql) => { try { await db.exec(sql); } catch {} };
  await migrate('ALTER TABLE users ADD COLUMN filiere TEXT DEFAULT ""');
  await migrate('ALTER TABLE courses ADD COLUMN filiere TEXT DEFAULT ""');
  await migrate('ALTER TABLE announcements ADD COLUMN filiere TEXT DEFAULT ""');
  await migrate('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
  await migrate('ALTER TABLE users ADD COLUMN verification_token TEXT DEFAULT NULL');
  await migrate('ALTER TABLE users ADD COLUMN token_expires_at TEXT DEFAULT NULL');
  await migrate('ALTER TABLE courses ADD COLUMN is_live_session INTEGER DEFAULT 0');
  await migrate('ALTER TABLE users ADD COLUMN reset_token TEXT DEFAULT NULL');
  await migrate('ALTER TABLE users ADD COLUMN reset_token_expires TEXT DEFAULT NULL');
  await migrate('ALTER TABLE courses ADD COLUMN type TEXT DEFAULT "cours"');
  await migrate('ALTER TABLE homework_submissions ADD COLUMN grade REAL DEFAULT NULL');
  await migrate('ALTER TABLE homework_submissions ADD COLUMN grade_comment TEXT DEFAULT ""');

  return db;
};

module.exports = { getDb };
