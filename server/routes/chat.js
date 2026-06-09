const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { getDb }        = require('../db');
const { verifyToken }  = require('../middleware/auth');
const { uploadToDrive, streamFromDrive, driveEnabled } = require('../googleDrive');

const router = express.Router();

const UPLOADS_DIR = process.env.UPLOADS_PATH
  ? path.join(process.env.UPLOADS_PATH, 'chat')
  : path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

async function storeFile(file) {
  if (driveEnabled()) {
    const driveFile = await uploadToDrive(file.buffer, file.originalname, file.mimetype || 'application/octet-stream');
    return driveFile.id;
  }
  const localName = `${Date.now()}_${file.originalname}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, localName), file.buffer);
  return localName;
}

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
    const storedName = await storeFile(req.file); 
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
      return await streamFromDrive(req.params.filename, res, msg?.file_original || 'fichier');
    }
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier introuvable.' });
    res.download(filePath);
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
    const storedName = await storeFile(req.file); 
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
      return await streamFromDrive(req.params.filename, res, msg?.file_original || 'fichier');
    }
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier introuvable.' });
    res.download(filePath);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
