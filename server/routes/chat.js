const express  = require('express');
const { getDb }        = require('../db');
const { verifyToken }  = require('../middleware/auth');
const { driveEnabled } = require('../googleDrive');
const { resolveUploadsDir, createUploadMiddleware, storeFile, downloadFile } = require('../utils/fileStorage');

const router = express.Router();

const UPLOADS_DIR = resolveUploadsDir('chat');
const upload = createUploadMiddleware();

router.get('/global', verifyToken, async (req, res) => {
  try {
    const db   = await getDb();
    const rows = await db.all(
      `SELECT * FROM global_messages WHERE filiere = ? ORDER BY created_at ASC LIMIT 100`,
      [req.user.filiere || '']
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/global/file', verifyToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant.' });
  try {
    const storedName = await storeFile(req.file, UPLOADS_DIR);
    const db     = await getDb();
    const result = await db.run(
      `INSERT INTO global_messages (sender_id, sender_name, filiere, content, file_name, file_original, file_size)
       VALUES (?, ?, ?, '', ?, ?, ?)`,
      [req.user.id, req.user.username, req.user.filiere || '', storedName, req.file.originalname, req.file.size]
    );
    const msg = await db.get('SELECT * FROM global_messages WHERE id = ?', [result.lastID]);
    res.json(msg);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/global/download/:filename', verifyToken, async (req, res) => {
  try {
    if (driveEnabled()) {
      const db = await getDb();
      const msg = await db.get('SELECT file_original FROM global_messages WHERE file_name = ?', [req.params.filename]);
      return await downloadFile(req.params.filename, msg?.file_original || 'fichier', UPLOADS_DIR, res);
    }
    await downloadFile(req.params.filename, req.params.filename, UPLOADS_DIR, res);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/group/:groupId', verifyToken, async (req, res) => {
  try {
    const db   = await getDb();
    const rows = await db.all(
      `SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at ASC LIMIT 100`,
      [req.params.groupId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/group/:groupId/file', verifyToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant.' });
  try {
    const storedName = await storeFile(req.file, UPLOADS_DIR);
    const db     = await getDb();
    const result = await db.run(
      `INSERT INTO group_messages (group_id, sender_id, sender_name, content, file_name, file_original, file_size)
       VALUES (?, ?, ?, '', ?, ?, ?)`,
      [req.params.groupId, req.user.id, req.user.username,
       storedName, req.file.originalname, req.file.size]
    );
    const msg = await db.get('SELECT * FROM group_messages WHERE id = ?', [result.lastID]);
    res.json(msg);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/group/download/:filename', verifyToken, async (req, res) => {
  try {
    if (driveEnabled()) {
      const db = await getDb();
      const msg = await db.get('SELECT file_original FROM group_messages WHERE file_name = ?', [req.params.filename]);
      return await downloadFile(req.params.filename, msg?.file_original || 'fichier', UPLOADS_DIR, res);
    }
    await downloadFile(req.params.filename, req.params.filename, UPLOADS_DIR, res);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
