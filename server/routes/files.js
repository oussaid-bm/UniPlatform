
const express = require('express');
const { getDb }             = require('../db');
const { verifyToken }       = require('../middleware/auth');
const { sendFileUploadEmail } = require('../email');
const { resolveUploadsDir, createUploadMiddleware, pdfOnly, storeFile, removeFile, downloadFile } = require('../utils/fileStorage');
const { notifyStudentsByFiliere } = require('../utils/notifyStudents');

const router = express.Router();

const uploadsDir = resolveUploadsDir();
const upload = createUploadMiddleware({ fileFilter: pdfOnly });

router.post('/upload/:courseId', verifyToken, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'professor')
    return res.status(403).json({ error: 'Réservé aux professeurs.' });
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

  try {
    const storedName = await storeFile(req.file, uploadsDir);
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO course_files (course_id, filename, original_name, size, uploaded_by, uploader_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.courseId, storedName, req.file.originalname,
       req.file.size, req.user.id, req.user.username]
    );
    res.status(201).json({
      id:            result.lastID,
      course_id:     parseInt(req.params.courseId),
      filename:      storedName,
      original_name: req.file.originalname,
      size:          req.file.size,
      uploader_name: req.user.username,
      created_at:    new Date().toISOString(),
    });

    const course = await db.get('SELECT * FROM courses WHERE id = ?', [req.params.courseId]);
    if (!course) return;

    const fileName = req.file.originalname;
    const profName = req.user.username;
    const courseTitle = course.title;
    const courseId = course.id;
    await notifyStudentsByFiliere(
      course.filiere,
      (email, username) => sendFileUploadEmail(email, username, fileName, courseTitle, profName, courseId),
      `Fichier "${fileName}"`
    );

  } catch (err) {
    console.error('Erreur upload:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/download/:fileId', verifyToken, async (req, res) => {
  try {
    const db   = await getDb();
    const file = await db.get('SELECT * FROM course_files WHERE id = ?', [req.params.fileId]);
    if (!file) return res.status(404).json({ error: 'Fichier introuvable.' });

    await downloadFile(file.filename, file.original_name, uploadsDir, res);
  } catch (err) {
    console.error('Erreur download:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

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

router.delete('/:fileId', verifyToken, async (req, res) => {
  if (req.user.role !== 'professor')
    return res.status(403).json({ error: 'Réservé aux professeurs.' });
  try {
    const db   = await getDb();
    const file = await db.get('SELECT * FROM course_files WHERE id = ?', [req.params.fileId]);
    if (!file) return res.status(404).json({ error: 'Fichier introuvable.' });
    if (file.uploaded_by !== req.user.id)
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres fichiers.' });

    await removeFile(file.filename, uploadsDir);
    await db.run('DELETE FROM course_files WHERE id = ?', [req.params.fileId]);
    res.json({ message: 'Fichier supprimé.' });
  } catch (err) {
    console.error('Erreur suppression:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
