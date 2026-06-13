
require('dotenv').config();
const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'uniplatform';
if (!/^[a-zA-Z0-9_]+$/.test(DB_NAME)) {
  console.error('FATAL: DB_NAME contains invalid characters.');
  process.exit(1);
}

let dbWrapper;

async function createPool() {
  const root = await mysql.createConnection({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASS,
  });
  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await root.end();

  return mysql.createPool({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: false,
  });
}

const getDb = async () => {
  if (dbWrapper) return dbWrapper;

  const pool = await createPool();

  dbWrapper = {
    async get(sql, params = []) {
      const [rows] = await pool.query(sql, params);
      return rows[0]; 
    },
    async all(sql, params = []) {
      const [rows] = await pool.query(sql, params);
      return rows;
    },
    async run(sql, params = []) {
      const [result] = await pool.query(sql, params);
      return { lastID: result.insertId, changes: result.affectedRows };
    },
    async exec(sql) {
      await pool.query(sql);
    },
  };

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('student','professor','admin') NOT NULL DEFAULT 'student',
      filiere VARCHAR(255) DEFAULT '',
      email_verified TINYINT DEFAULT 0,
      verification_token VARCHAR(255) DEFAULT NULL,
      token_expires_at VARCHAR(64) DEFAULT NULL,
      reset_token VARCHAR(255) DEFAULT NULL,
      reset_token_expires VARCHAR(64) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      professor_id INT NOT NULL,
      filiere VARCHAR(255) DEFAULT '',
      is_active TINYINT DEFAULT 0,
      is_live_session TINYINT DEFAULT 0,
      type VARCHAR(50) DEFAULT 'cours',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (professor_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      sender_id INT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      author_id INT NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      filiere VARCHAR(255) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS demandes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      sender_id INT NOT NULL,
      sender_name VARCHAR(255) NOT NULL,
      sender_role VARCHAR(50) NOT NULL,
      recipient_type VARCHAR(50) NOT NULL DEFAULT 'admin',
      recipient_id INT DEFAULT NULL,
      recipient_name VARCHAR(255) DEFAULT 'Administration',
      status VARCHAR(20) NOT NULL DEFAULT 'en_attente',
      response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS study_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      filiere VARCHAR(255) DEFAULT '',
      created_by INT NOT NULL,
      creator_name VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS group_members (
      group_id INT NOT NULL,
      user_id INT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS course_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      size INT DEFAULT 0,
      uploaded_by INT NOT NULL,
      uploader_name VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS homework_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      student_id INT NOT NULL,
      student_name VARCHAR(255) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      size INT DEFAULT 0,
      grade DECIMAL(4,2) DEFAULT NULL,
      grade_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS global_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      sender_name VARCHAR(255) NOT NULL,
      filiere VARCHAR(255) DEFAULT '',
      content TEXT,
      file_name VARCHAR(255) DEFAULT NULL,
      file_original VARCHAR(255) DEFAULT NULL,
      file_size INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS group_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      sender_id INT NOT NULL,
      sender_name VARCHAR(255) NOT NULL,
      content TEXT,
      file_name VARCHAR(255) DEFAULT NULL,
      file_original VARCHAR(255) DEFAULT NULL,
      file_size INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  ];

  for (const sql of tables) {
    await pool.query(sql);
  }

  try {
    await pool.query("ALTER TABLE global_messages ADD COLUMN filiere VARCHAR(255) DEFAULT ''");
  } catch (e) { }

  console.log(`Base MySQL "${DB_NAME}" prête (${tables.length} tables).`);
  return dbWrapper;
};

module.exports = { getDb };
