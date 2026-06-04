// ─────────────────────────────────────────────────────────────────────────────
//  INTÉGRATION GOOGLE DRIVE (via OAuth2 — compte personnel)
//  Stocke les fichiers sur TON Google Drive (15 Go gratuits) au lieu du disque.
//
//  Pourquoi OAuth et pas un compte de service ?
//   Un compte de service n'a pas d'espace de stockage propre et ne peut pas
//   écrire dans un Drive personnel gratuit. On authentifie donc l'appli EN TON
//   NOM (avec un "refresh token") : les fichiers comptent dans TON espace.
//
//  Variables .env nécessaires :
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN,
//   GOOGLE_DRIVE_FOLDER_ID
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const { google } = require('googleapis');
const stream = require('stream');

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';
const FOLDER_ID     = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

// Crée un client OAuth2 déjà authentifié grâce au refresh token.
// Le refresh token permet de régénérer automatiquement un accès sans
// redemander la connexion à chaque fois.
const getDrive = () => {
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'http://localhost');
  oauth2.setCredentials({ refresh_token: REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: oauth2 });
};

/* ── Upload d'un buffer (fichier en mémoire) → Google Drive ──────────────── */
const uploadToDrive = async (buffer, originalName, mimeType = 'application/pdf') => {
  if (!REFRESH_TOKEN) throw new Error('GOOGLE_REFRESH_TOKEN non configuré dans .env.');
  if (!FOLDER_ID)     throw new Error('GOOGLE_DRIVE_FOLDER_ID non configuré dans .env.');

  const drive = getDrive();

  // multer nous donne un buffer en mémoire ; Drive veut un flux (stream).
  const bufStream = new stream.PassThrough();
  bufStream.end(buffer);

  const res = await drive.files.create({
    requestBody: { name: originalName, parents: [FOLDER_ID] },
    media:       { mimeType, body: bufStream },
    fields:      'id, name, size',
  });
  return res.data; // { id, name, size }
};

/* ── Télécharger depuis Drive et l'envoyer au navigateur ─────────────────── */
const streamFromDrive = async (fileId, res, originalName, mimeType = 'application/pdf') => {
  const drive = getDrive();
  const fileRes = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
  res.setHeader('Content-Type', mimeType);
  fileRes.data.pipe(res);
};

/* ── Supprimer un fichier sur Drive ──────────────────────────────────────── */
const deleteFromDrive = async (fileId) => {
  try {
    const drive = getDrive();
    await drive.files.delete({ fileId });
  } catch (err) {
    // Déjà supprimé ou introuvable → on ignore.
    console.warn('Drive delete warning:', err.message);
  }
};

// Indique au reste du code si Google Drive est activé et configuré.
const driveEnabled = () =>
  process.env.USE_GOOGLE_DRIVE === 'true' &&
  CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN && FOLDER_ID;

module.exports = { uploadToDrive, streamFromDrive, deleteFromDrive, driveEnabled };
