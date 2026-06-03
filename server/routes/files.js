// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES DES FICHIERS DE COURS (supports PDF)
//  Le professeur dépose des PDF dans un cours ; les étudiants les téléchargent.
//  Stockage sur le disque (dossier uploads), métadonnées en base (course_files).
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const multer  = require('multer'); // gestion de l'upload de fichiers
const path    = require('path');
const fs      = require('fs');
const { getDb }             = require('../db');
const { verifyToken }       = require('../middleware/auth');
const { sendFileUploadEmail } = require('../email');

const router = express.Router();

// ── Dossier de stockage ─────────────────────────────────────────────────────
const uploadsDir = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH.trim())
  : path.join(__dirname, '..', 'uploads');

try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📂 Dossier uploads : ${uploadsDir}`);
} catch (err) {
  console.error(`❌ Impossible de créer le dossier uploads (${uploadsDir}):`, err.message);
}

// ── Configuration multer ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Seuls les fichiers PDF sont acceptés.'));
  },
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ── Upload (prof uniquement) ────────────────────────────────────────────────
router.post('/upload/:courseId', verifyToken, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'professor') {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Réservé aux professeurs.' });
  }
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

  try {
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO course_files (course_id, filename, original_name, size, uploaded_by, uploader_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.courseId, req.file.filename, req.file.originalname,
       req.file.size, req.user.id, req.user.username]
    );
    res.status(201).json({
      id:            result.lastID,
      course_id:     parseInt(req.params.courseId),
      filename:      req.file.filename,
      original_name: req.file.originalname,
      size:          req.file.size,
      uploader_name: req.user.username,
      created_at:    new Date().toISOString(),
    });

    // ── Notification email (même logique que le live) ─────────────────
    const course = await db.get('SELECT * FROM courses WHERE id = ?', [req.params.courseId]);
    if (!course) return;

    const filiereTarget = (course.filiere || '').trim();
    if (!filiereTarget) return; // "Toutes les filières" → pas d'email

    const students = await db.all(
      'SELECT username, email FROM users WHERE role = ? AND filiere = ? AND email_verified = 1',
      ['student', filiereTarget]
    );
    if (students.length === 0) return;

    console.log(`📧 Fichier "${req.file.originalname}" → ${students.length} email(s) (${filiereTarget})`);
    students.forEach(({ username, email }) => {
      sendFileUploadEmail(email, username, req.file.originalname, course.title, req.user.username, course.id)
        .then(() => console.log(`  ✅ Email → ${email}`))
        .catch((err) => console.error(`  ❌ Échec ${email}:`, err.message));
    });

  } catch (err) {
    console.error('Erreur upload:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── Téléchargement ── DOIT être avant /:courseId ─────────────────────────────
router.get('/download/:fileId', verifyToken, async (req, res) => {
  try {
    const db   = await getDb();
    const file = await db.get('SELECT * FROM course_files WHERE id = ?', [req.params.fileId]);
    if (!file) return res.status(404).json({ error: 'Fichier introuvable.' });

    const filePath = path.join(uploadsDir, file.filename);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: 'Fichier manquant sur le disque.' });

    res.download(filePath, file.original_name, (err) => {
      if (err && !res.headersSent) {
        console.error('Erreur envoi fichier:', err);
        res.status(500).json({ error: "Erreur lors de l'envoi." });
      }
    });
  } catch (err) {
    console.error('Erreur download:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── Liste des fichiers d'un cours ── APRÈS /download/ ────────────────────────
router.get('/:courseId', verifyToken, async (req, res) => {
  try {
    const db   = await getDb();
    const rows = await db.all(
      `SELECT * FROM course_files WHERE course_id = ? ORDER BY created_at DESC`,
      [req.params.courseId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur liste fichiers:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── Suppression (prof uniquement) ───────────────────────────────────────────
router.delete('/:fileId', verifyToken, async (req, res) => {
  if (req.user.role !== 'professor')
    return res.status(403).json({ error: 'Réservé aux professeurs.' });
  try {
    const db   = await getDb();
    const file = await db.get('SELECT * FROM course_files WHERE id = ?', [req.params.fileId]);
    if (!file) return res.status(404).json({ error: 'Fichier introuvable.' });
    if (file.uploaded_by !== req.user.id)
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres fichiers.' });

    const filePath = path.join(uploadsDir, file.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.run('DELETE FROM course_files WHERE id = ?', [req.params.fileId]);
    res.json({ message: 'Fichier supprimé.' });
  } catch (err) {
    console.error('Erreur suppression:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
