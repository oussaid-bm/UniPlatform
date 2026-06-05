// ─────────────────────────────────────────────────────────────────────────────
//  SCRIPT À LANCER UNE SEULE FOIS — obtenir le refresh token Google Drive
//  Usage :
//    1. Mettre GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans .env
//    2. node getRefreshToken.js
//    3. Ouvrir l'URL affichée, autoriser, copier le code, le coller ici.
//    4. Copier le refresh_token affiché dans .env (GOOGLE_REFRESH_TOKEN=...)
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Mets d\'abord GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans .env');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'urn:ietf:wg:oauth:2.0:oob');

const url = oauth2.generateAuthUrl({
  access_type: 'offline',          // pour obtenir un refresh_token
  prompt: 'consent',               // force l'affichage du refresh_token
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('\n1) Ouvre ce lien dans ton navigateur :\n');
console.log('   ' + url + '\n');
console.log('2) Autorise, puis copie le CODE affiché.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('3) Colle le code ici puis Entrée : ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2.getToken(code.trim());
    console.log('\nSUCCÈS ! Copie cette ligne dans ton fichier .env :\n');
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token + '\n');
  } catch (err) {
    console.error('\nErreur :', err.message);
  }
});
