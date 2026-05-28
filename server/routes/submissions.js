const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { getDb }       = require('../db');
const { verifyToken } = require('../middleware/auth');
const { sendSubmissionEmail, sendGradeEmail } = require('../email');

const router = express.Router();

const uploadsDir = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH.trim())
  : path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'sub-' + unique + path.extname(file.originalname));
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

/* ── Soumettre / remplacer son travail (étudiant) ─────────────────────────── */
router.post('/upload/:courseId', verifyToken, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'student')
    return res.status(403).json({ error: 'Réservé aux étudiants.' });
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

  try {
    const db = await getDb();

    // Supprimer l'ancienne soumission si elle existe
    const existing = await db.get(
      'SELECT * FROM homework_submissions WHERE course_id = ? AND student_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (existing) {
      const oldPath = path.join(uploadsDir, existing.filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      await db.run('DELETE FROM homework_submissions WHERE id = ?', [existing.id]);
    }

    const result = await db.run(
      `INSERT INTO homework_submissions (course_id, student_id, student_name, filename, original_name, size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.courseId, req.user.id, req.user.username,
       req.file.filename, req.file.originalname, req.file.size]
    );

    // Notifier le professeur du cours
    const course = await db.get(
      `SELECT c.title, u.email, u.username
       FROM courses c JOIN users u ON c.professor_id = u.id
       WHERE c.id = ?`,
      [req.params.courseId]
    );
    if (course) {
      sendSubmissionEmail(course.email, course.username, req.user.username, course.title).catch(() => {});
    }

    res.status(201).json({
      id:            result.lastID,
      course_id:     parseInt(req.params.courseId),
      student_id:    req.user.id,
      student_name:  req.user.username,
      filename:      req.file.filename,
      original_name: req.file.originalname,
      size:          req.file.size,
      created_at:    new Date().toISOString(),
    });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Erreur soumission:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── Télécharger une soumission ───────────────────────────────────────────── */
router.get('/download/:id', verifyToken, async (req, res) => {
  try {
    const db  = await getDb();
    const sub = await db.get('SELECT * FROM homework_submissions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Soumission introuvable.' });

    // Étudiant : peut télécharger seulement la sienne
    if (req.user.role === 'student' && sub.student_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé.' });

    const filePath = path.join(uploadsDir, sub.filename);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: 'Fichier manquant sur le disque.' });

    res.download(filePath, sub.original_name);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── Liste des soumissions d'un devoir ────────────────────────────────────── */
router.get('/:courseId', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    if (req.user.role === 'professor' || req.user.role === 'admin') {
      const rows = await db.all(
        'SELECT * FROM homework_submissions WHERE course_id = ? ORDER BY created_at DESC',
        [req.params.courseId]
      );
      return res.json(rows);
    }
    // Étudiant : seulement la sienne
    const row = await db.get(
      'SELECT * FROM homework_submissions WHERE course_id = ? AND student_id = ?',
      [req.params.courseId, req.user.id]
    );
    return res.json(row ? [row] : []);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── Noter une soumission (prof uniquement) ───────────────────────────────── */
router.patch('/:id/grade', verifyToken, async (req, res) => {
  if (req.user.role !== 'professor')
    return res.status(403).json({ error: 'Réservé aux professeurs.' });

  const { grade, grade_comment } = req.body;
  if (grade !== null && grade !== undefined) {
    const g = parseFloat(grade);
    if (isNaN(g) || g < 0 || g > 20)
      return res.status(400).json({ error: 'La note doit être entre 0 et 20.' });
  }

  try {
    const db  = await getDb();
    const sub = await db.get('SELECT * FROM homework_submissions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Soumission introuvable.' });

    const g = (grade !== null && grade !== undefined && grade !== '') ? parseFloat(grade) : null;
    await db.run(
      'UPDATE homework_submissions SET grade = ?, grade_comment = ? WHERE id = ?',
      [g, grade_comment || '', req.params.id]
    );

    // Notifier l'étudiant par email
    const course = await db.get('SELECT title FROM courses WHERE id = ?', [sub.course_id]);
    const student = await db.get('SELECT email FROM users WHERE id = ?', [sub.student_id]);
    if (student && course) {
      sendGradeEmail(student.email, sub.student_name, course.title, g, grade_comment || '')
        .catch(() => {});
    }

    res.json({ id: sub.id, grade: g, grade_comment: grade_comment || '' });
  } catch (err) {
    console.error('Erreur notation:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── Supprimer une soumission ─────────────────────────────────────────────── */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const db  = await getDb();
    const sub = await db.get('SELECT * FROM homework_submissions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Soumission introuvable.' });

    // Étudiant : seulement la sienne ; prof/admin : n'importe laquelle
    if (req.user.role === 'student' && sub.student_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé.' });

    const filePath = path.join(uploadsDir, sub.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.run('DELETE FROM homework_submissions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Soumission supprimée.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
