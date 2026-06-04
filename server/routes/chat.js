// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES DU CHAT (historique + fichiers)
//  Le temps réel des messages passe par Socket.io (index.js). CE fichier gère :
//   - le chargement de l'HISTORIQUE des messages (au chargement de la page)
//   - l'UPLOAD/téléchargement des FICHIERS partagés dans le chat global et les groupes.
// ─────────────────────────────────────────────────────────────────────────────
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { getDb }        = require('../db');
const { verifyToken }  = require('../middleware/auth');
const { uploadToDrive, streamFromDrive, driveEnabled } = require('../googleDrive');

const router = express.Router();

// Dossier local (utilisé seulement si Google Drive est désactivé).
const UPLOADS_DIR = process.env.UPLOADS_PATH
  ? path.join(process.env.UPLOADS_PATH, 'chat')
  : path.join(__dirname, '..', 'uploads', 'chat');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// multer en mémoire : le fichier arrive dans req.file.buffer.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Range le fichier sur Drive (si activé) ou sur le disque ; retourne la clé de stockage.
async function storeFile(file) {
  // Les fichiers de chat peuvent être de n'importe quel type → on garde le mimetype.
  if (driveEnabled()) {
    const driveFile = await uploadToDrive(file.buffer, file.originalname, file.mimetype || 'application/octet-stream');
    return driveFile.id;
  }
  const localName = `${Date.now()}_${file.originalname}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, localName), file.buffer);
  return localName;
}

/* ── GET /api/chat/global — historique chat global ─────────────── */
router.get('/global', verifyToken, async (req, res) => {
  try {
    const db   = await getDb();
    const rows = await db.all(
      `SELECT * FROM global_messages ORDER BY created_at ASC LIMIT 100`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── POST /api/chat/global/file — upload fichier chat global ────── */
router.post('/global/file', verifyToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant.' });
  try {
    const storedName = await storeFile(req.file); // Drive ou disque
    const db     = await getDb();
    const result = await db.run(
      `INSERT INTO global_messages (sender_id, sender_name, content, file_name, file_original, file_size)
       VALUES (?, ?, '', ?, ?, ?)`,
      [req.user.id, req.user.username, storedName, req.file.originalname, req.file.size]
    );
    const msg = await db.get('SELECT * FROM global_messages WHERE id = ?', [result.lastID]);
    res.json(msg);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ── GET /api/chat/global/download/:filename ─────────────────────── */
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

/* ── GET /api/chat/group/:groupId — historique chat groupe ──────── */
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

/* ── POST /api/chat/group/:groupId/file — upload fichier groupe ─── */
router.post('/group/:groupId/file', verifyToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant.' });
  try {
    const storedName = await storeFile(req.file); // Drive ou disque
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

/* ── GET /api/chat/group/download/:filename ─────────────────────── */
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
