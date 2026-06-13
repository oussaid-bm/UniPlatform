
const path = require('path');
const fs   = require('fs');
const multer = require('multer');
const { uploadToDrive, streamFromDrive, deleteFromDrive, driveEnabled } = require('../googleDrive');

function resolveUploadsDir(subdir) {
  const base = process.env.UPLOADS_PATH
    ? path.resolve(process.env.UPLOADS_PATH.trim())
    : path.join(__dirname, '..', 'uploads');
  const dir = subdir ? path.join(base, subdir) : base;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error(`Impossible de créer le dossier uploads (${dir}):`, err.message);
  }
  return dir;
}

function createUploadMiddleware({ fileFilter, limits } = {}) {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: limits || { fileSize: 25 * 1024 * 1024 },
  });
}

const pdfOnly = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf') cb(null, true);
  else cb(new Error('Seuls les fichiers PDF sont acceptés.'));
};

async function storeFile(file, uploadsDir, { prefix = '', mimeType } = {}) {
  if (driveEnabled()) {
    const driveFile = await uploadToDrive(
      file.buffer,
      file.originalname,
      mimeType || file.mimetype || 'application/octet-stream'
    );
    return driveFile.id;
  }
  const localName = prefix
    + Date.now() + '-' + Math.round(Math.random() * 1e9)
    + path.extname(file.originalname);
  fs.writeFileSync(path.join(uploadsDir, localName), file.buffer);
  return localName;
}

async function removeFile(storedName, uploadsDir) {
  if (driveEnabled()) {
    await deleteFromDrive(storedName);
    return;
  }
  const p = path.join(uploadsDir, storedName);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

async function downloadFile(storedName, originalName, uploadsDir, res) {
  if (driveEnabled()) {
    return await streamFromDrive(storedName, res, originalName);
  }
  const filePath = path.join(uploadsDir, storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier manquant sur le disque.' });
  }
  res.download(filePath, originalName, (err) => {
    if (err && !res.headersSent) {
      console.error('Erreur envoi fichier:', err);
      res.status(500).json({ error: "Erreur lors de l'envoi." });
    }
  });
}

module.exports = {
  resolveUploadsDir,
  createUploadMiddleware,
  pdfOnly,
  storeFile,
  removeFile,
  downloadFile,
};
