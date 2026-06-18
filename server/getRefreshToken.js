
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
  access_type: 'offline',          
  prompt: 'consent',               
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
