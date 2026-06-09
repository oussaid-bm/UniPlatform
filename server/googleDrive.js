
require('dotenv').config();
const { google } = require('googleapis');
const stream = require('stream');

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';
const FOLDER_ID     = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

const getDrive = () => {
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'http://localhost');
  oauth2.setCredentials({ refresh_token: REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: oauth2 });
};

const uploadToDrive = async (buffer, originalName, mimeType = 'application/pdf') => {
  if (!REFRESH_TOKEN) throw new Error('GOOGLE_REFRESH_TOKEN non configuré dans .env.');
  if (!FOLDER_ID)     throw new Error('GOOGLE_DRIVE_FOLDER_ID non configuré dans .env.');

  const drive = getDrive();

  const bufStream = new stream.PassThrough();
  bufStream.end(buffer);

  const res = await drive.files.create({
    requestBody: { name: originalName, parents: [FOLDER_ID] },
    media:       { mimeType, body: bufStream },
    fields:      'id, name, size',
  });
  return res.data; 
};

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

const deleteFromDrive = async (fileId) => {
  try {
    const drive = getDrive();
    await drive.files.delete({ fileId });
  } catch (err) {
    console.warn('Drive delete warning:', err.message);
  }
};

const driveEnabled = () =>
  process.env.USE_GOOGLE_DRIVE === 'true' &&
  CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN && FOLDER_ID;

module.exports = { uploadToDrive, streamFromDrive, deleteFromDrive, driveEnabled };
