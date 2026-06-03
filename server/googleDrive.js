// ─────────────────────────────────────────────────────────────────────────────
//  INTÉGRATION GOOGLE DRIVE (optionnelle)
//  Permet de stocker les fichiers sur Google Drive au lieu du disque local.
//  Nécessite un compte de service (service-account.json) et un dossier cible.
//  Non utilisé par défaut : le stockage se fait sur le disque (voir routes/files.js).
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const { google } = require('googleapis');
const path   = require('path');
const stream = require('stream');
const fs     = require('fs');

const KEY_FILE   = path.join(__dirname, 'service-account.json');
const FOLDER_ID  = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
const SCOPES     = ['https://www.googleapis.com/auth/drive'];

/* ── Client auth ─────────────────────────────────────────────────────────── */
const getAuth = () => new google.auth.GoogleAuth({ keyFile: KEY_FILE, scopes: SCOPES });
const getDrive = async () => {
  const auth = await getAuth().getClient();
  return google.drive({ version: 'v3', auth });
};

/* ── Upload buffer → Google Drive ────────────────────────────────────────── */
const uploadToDrive = async (buffer, originalName) => {
  if (!fs.existsSync(KEY_FILE)) throw new Error('service-account.json introuvable.');
  if (!FOLDER_ID)               throw new Error('GOOGLE_DRIVE_FOLDER_ID non configuré dans .env.');

  const drive = await getDrive();

  // Transforme le buffer en stream lisible
  const bufStream = new stream.PassThrough();
  bufStream.end(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: originalName,
      parents: [FOLDER_ID],
    },
    media: {
      mimeType: 'application/pdf',
      body: bufStream,
    },
    fields: 'id, name, size',
  });
  return res.data; // { id, name, size }
};

/* ── Stream depuis Drive vers la réponse HTTP ────────────────────────────── */
const streamFromDrive = async (fileId, res, originalName) => {
  const drive = await getDrive();
  const fileRes = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
  res.setHeader('Content-Type', 'application/pdf');
  fileRes.data.pipe(res);
};

/* ── Supprimer un fichier Drive ──────────────────────────────────────────── */
const deleteFromDrive = async (fileId) => {
  try {
    const drive = await getDrive();
    await drive.files.delete({ fileId });
  } catch (err) {
    // Fichier déjà supprimé ou inexistant → on ignore
    console.warn('Drive delete warning:', err.message);
  }
};

module.exports = { uploadToDrive, streamFromDrive, deleteFromDrive };
