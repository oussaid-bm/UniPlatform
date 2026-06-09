
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { getDb }             = require('../db');
const { verifyToken }       = require('../middleware/auth');
const { sendFileUploadEmail } = require('../email');
const { uploadToDrive, streamFromDrive, deleteFromDrive, driveEnabled } = require('../googleDrive');

const router = express.Router();

const uploadsDir = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH.trim())
  : path.join(__dirname, '..', 'uploads');

try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
} catch (err) {
  console.error(`Impossible de créer le dossier uploads (${uploadsDir}):`, err.message);
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Seuls les fichiers PDF sont acceptés.'));
  },
  limits: { fileSize: 25 * 1024 * 1024 },
});

async function storeFile(file) {
  if (driveEnabled()) {
    const driveFile = await uploadToDrive(file.buffer, file.originalname);
    return driveFile.id; 
  }
  const localName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
  fs.writeFileSync(path.join(uploadsDir, localName), file.buffer);
  return localName;
}

router.post('/upload/:courseId', verifyToken, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'professor')
    return res.status(403).json({ error: 'Réservé aux professeurs.' });
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

  try {
    const storedName = await storeFile(req.file); 
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

    const filiereTarget = (course.filiere || '').trim();
    if (!filiereTarget) return;

    const students = await db.all(
      'SELECT username, email FROM users WHERE role = ? AND filiere = ? AND email_verified = 1',
      ['student', filiereTarget]
    );
    if (students.length === 0) return;

    console.log(`Fichier "${req.file.originalname}" → ${students.length} email(s) (${filiereTarget})`);
    students.forEach(({ username, email }) => {
      sendFileUploadEmail(email, username, req.file.originalname, course.title, req.user.username, course.id)
        .then(() => console.log(`  Email → ${email}`))
        .catch((err) => console.error(`  Échec ${email}:`, err.message));
    });

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

    if (driveEnabled()) {
      return await streamFromDrive(file.filename, res, file.original_name);
    }
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

    if (driveEnabled()) {
      await deleteFromDrive(file.filename);
    } else {
      const filePath = path.join(uploadsDir, file.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await db.run('DELETE FROM course_files WHERE id = ?', [req.params.fileId]);
    res.json({ message: 'Fichier supprimé.' });
  } catch (err) {
    console.error('Erreur suppression:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
