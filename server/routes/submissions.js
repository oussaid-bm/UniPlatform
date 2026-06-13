
const express = require('express');
const { getDb }       = require('../db');
const { verifyToken } = require('../middleware/auth');
const { sendSubmissionEmail, sendGradeEmail } = require('../email');
const { resolveUploadsDir, createUploadMiddleware, pdfOnly, storeFile, removeFile, downloadFile } = require('../utils/fileStorage');

const router = express.Router();

const uploadsDir = resolveUploadsDir();
const upload = createUploadMiddleware({ fileFilter: pdfOnly });

router.post('/upload/:courseId', verifyToken, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'student')
    return res.status(403).json({ error: 'Réservé aux étudiants.' });
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

  try {
    const db = await getDb();

   
    const existing = await db.get(
      'SELECT * FROM homework_submissions WHERE course_id = ? AND student_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (existing) {
      await removeFile(existing.filename, uploadsDir);
      await db.run('DELETE FROM homework_submissions WHERE id = ?', [existing.id]);
    }

   
    const storedName = await storeFile(req.file, uploadsDir, { prefix: 'sub-' });

   
    const result = await db.run(
      `INSERT INTO homework_submissions (course_id, student_id, student_name, filename, original_name, size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.courseId, req.user.id, req.user.username,
       storedName, req.file.originalname, req.file.size]
    );

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
      filename:      storedName,
      original_name: req.file.originalname,
      size:          req.file.size,
      created_at:    new Date().toISOString(),
    });
  } catch (err) {
    console.error('Erreur soumission:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/download/:id', verifyToken, async (req, res) => {
  try {
    const db  = await getDb();
    const sub = await db.get('SELECT * FROM homework_submissions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Soumission introuvable.' });

    if (req.user.role === 'student' && sub.student_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé.' });

    await downloadFile(sub.filename, sub.original_name, uploadsDir, res);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

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
    const row = await db.get(
      'SELECT * FROM homework_submissions WHERE course_id = ? AND student_id = ?',
      [req.params.courseId, req.user.id]
    );
    return res.json(row ? [row] : []);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

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

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const db  = await getDb();
    const sub = await db.get('SELECT * FROM homework_submissions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Soumission introuvable.' });

    if (req.user.role === 'student' && sub.student_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé.' });

    await removeFile(sub.filename, uploadsDir);
    await db.run('DELETE FROM homework_submissions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Soumission supprimée.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
