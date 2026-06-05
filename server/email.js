// ─────────────────────────────────────────────────────────────────────────────
//  ENVOI D'EMAILS (Nodemailer + Gmail)
//  Ce fichier définit le "transporteur" (la connexion au serveur d'envoi Gmail)
//  et toutes les fonctions qui composent et envoient un email HTML pour chaque
//  événement : vérification de compte, cours en direct, nouveau devoir,
//  fichier déposé, note attribuée, réinitialisation de mot de passe.
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const nodemailer = require('nodemailer');

const APP_URL    = process.env.APP_URL    || 'http://localhost:3003'; // adresse publique de l'app (pour les liens)
const EMAIL_USER = process.env.EMAIL_USER || ''; // adresse Gmail d'envoi
const EMAIL_PASS = process.env.EMAIL_PASS || ''; // "mot de passe d'application" Gmail (pas le vrai mot de passe)

// Le transporteur = la configuration de connexion au serveur d'envoi (SMTP) de Gmail.
// Port 587 + STARTTLS : connexion chiffrée, port ouvert sur la plupart des réseaux.
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  IDENTITÉ VISUELLE (mêmes couleurs que le site)
//  navy #1B2B4B · or #C8963E · crème #F2EDE4 · titres serif Georgia
// ─────────────────────────────────────────────────────────────────────────────
const NAVY  = '#1B2B4B';
const GOLD  = '#C8963E';
const CREAM = '#F2EDE4';
const SERIF = "Georgia,'Times New Roman',serif";

// Bouton d'action réutilisable (couleur navy par défaut, ou or).
const button = (href, label, color = NAVY) => `
  <div style="text-align:center;margin:30px 0 8px;">
    <a href="${href}" style="display:inline-block;padding:14px 38px;background:${color};color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
      ${label}
    </a>
  </div>`;

// Encart d'information (carte beige avec liseré or).
const infoCard = (inner) => `
  <div style="background:${CREAM};border-radius:10px;padding:18px 20px;margin:24px 0;border-left:4px solid ${GOLD};">
    ${inner}
  </div>`;

// Gabarit COMMUN à tous les emails : en-tête navy avec logo + nom, corps, pied de page.
// `body`   : le contenu HTML propre à chaque email
// `footer` : la petite phrase grise du bas
function layout(title, subtitle, body, footer) {
  return `
  <div style="background:${CREAM};padding:28px 16px;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:540px;margin:auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 28px rgba(27,43,75,0.10);">

      <!-- En-tête navy avec logo et nom de la plateforme -->
      <div style="background:${NAVY};padding:26px 28px;text-align:center;">
        <div style="display:inline-block;width:46px;height:46px;background:${GOLD};border-radius:12px;line-height:46px;font-size:24px;"></div>
        <div style="color:#ffffff;font-family:${SERIF};font-size:24px;font-weight:800;margin-top:10px;letter-spacing:-0.3px;">UniPlatform</div>
        <div style="color:${GOLD};font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-top:3px;">Plateforme universitaire</div>
      </div>

      <!-- Corps -->
      <div style="padding:30px 30px 26px;">
        <h2 style="color:${NAVY};font-family:${SERIF};font-size:21px;font-weight:700;margin:0 0 4px;">${title}</h2>
        ${subtitle ? `<p style="color:#7A7060;font-size:14px;margin:0 0 20px;">${subtitle}</p>` : ''}
        ${body}
      </div>

      <!-- Pied de page -->
      <div style="background:${CREAM};padding:16px 28px;border-top:1px solid #E5E0D8;">
        <p style="color:#A89880;font-size:11.5px;text-align:center;line-height:1.6;margin:0;">${footer || 'UniPlatform — Plateforme universitaire en ligne'}</p>
      </div>

    </div>
  </div>`;
}

async function sendVerificationEmail(email, username, token) {
  const link = `${APP_URL}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: 'Vérifiez votre adresse email – UniPlatform',
    html: layout(
      'Bienvenue sur UniPlatform !',
      `Bonjour <strong>${username}</strong>, votre compte est presque prêt.`,
      `<p style="color:#3D3628;font-size:14px;line-height:1.7;margin:0;">
        Cliquez sur le bouton ci-dessous pour <strong>vérifier votre adresse email</strong> et activer votre compte.
      </p>
      ${button(link, 'Vérifier mon email')}`,
      'Ce lien expire dans 24 heures. Si vous n\'avez pas créé de compte, ignorez cet email.'
    ),
  });

  console.log(`Email envoyé à ${email}`);
}

/* ── Notification cours en direct ───────────────────────────────────── */
async function sendLiveSessionEmail(email, username, courseName, professorName, courseId) {
  const link = `${APP_URL}/app/cours/${courseId}`;

  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `Cours en direct : ${courseName}`,
    html: layout(
      'Cours en direct démarré',
      `Bonjour <strong>${username}</strong>`,
      `${infoCard(`
        <p style="margin:0 0 4px;font-size:11px;color:${GOLD};font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Cours</p>
        <p style="margin:0;font-size:17px;font-weight:700;color:${NAVY};">${courseName}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#7A7060;">‍${professorName} • En ce moment</p>
      `)}
      <p style="color:#3D3628;font-size:14px;line-height:1.7;margin:0;">
        Votre professeur vient de démarrer une session vidéo en direct. Rejoignez maintenant pour ne rien manquer !
      </p>
      ${button(link, 'Rejoindre le cours')}`,
      'Vous recevez cet email car vous êtes inscrit dans cette filière sur UniPlatform.'
    ),
  });
}

/* ── Notification nouvelle annonce ──────────────────────────────────── */
async function sendAnnouncementEmail(email, username, title, content, authorName) {
  const preview = content.length > 120 ? content.slice(0, 120) + '…' : content;

  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `Nouvelle annonce : ${title}`,
    html: layout(
      'Nouvelle annonce',
      `Bonjour <strong>${username}</strong>`,
      `${infoCard(`
        <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:${NAVY};">${title}</p>
        <p style="margin:0;font-size:13px;color:#7A7060;">‍${authorName}</p>
      `)}
      <p style="color:#3D3628;font-size:14px;line-height:1.7;margin:0;">${preview}</p>
      ${button(`${APP_URL}/app/annonces`, "Voir l'annonce")}`,
      'Vous recevez cet email car vous êtes inscrit dans cette filière sur UniPlatform.'
    ),
  });
}

/* ── Notification nouveau fichier déposé ────────────────────────────── */
async function sendFileUploadEmail(email, username, fileName, courseName, authorName, courseId) {
  const link = `${APP_URL}/app/cours`;

  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `Nouveau fichier dans "${courseName}"`,
    html: layout(
      'Nouveau fichier disponible',
      `Bonjour <strong>${username}</strong>`,
      `${infoCard(`
        <p style="margin:0 0 4px;font-size:11px;color:${GOLD};font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Cours</p>
        <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:${NAVY};">${courseName}</p>
        <p style="margin:0;font-size:14px;color:#3D3628;">${fileName}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#7A7060;">‍Déposé par ${authorName}</p>
      `)}
      <p style="color:#3D3628;font-size:14px;line-height:1.7;margin:0;">
        Un nouveau fichier PDF a été déposé dans ce cours. Consultez-le dès maintenant.
      </p>
      ${button(link, 'Voir le cours')}`,
      'Vous recevez cet email car vous êtes inscrit dans cette filière sur UniPlatform.'
    ),
  });
}

/* ── Nouveau devoir publié ───────────────────────────────────────────── */
async function sendNewDevoirEmail(email, username, devoirTitle, professorName) {
  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `Nouveau devoir : ${devoirTitle}`,
    html: layout(
      'Nouveau devoir publié',
      `Bonjour <strong>${username}</strong>`,
      `${infoCard(`
        <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:${NAVY};">${devoirTitle}</p>
        <p style="margin:0;font-size:13px;color:#7A7060;">‍${professorName}</p>
      `)}
      <p style="color:#3D3628;font-size:14px;line-height:1.7;margin:0;">
        Un nouveau devoir a été publié. Connectez-vous pour consulter les consignes et remettre votre travail.
      </p>
      ${button(`${APP_URL}/app/cours`, 'Voir le devoir')}`,
      'Vous recevez cet email car vous êtes inscrit dans cette filière sur UniPlatform.'
    ),
  });
}

/* ── Travail rendu par un étudiant ──────────────────────────────────── */
async function sendSubmissionEmail(email, professorName, studentName, devoirTitle) {
  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `Travail rendu : ${devoirTitle}`,
    html: layout(
      'Travail rendu',
      `Bonjour <strong>${professorName}</strong>`,
      `${infoCard(`
        <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:${NAVY};">${devoirTitle}</p>
        <p style="margin:0;font-size:13px;color:#7A7060;">Soumis par <strong>${studentName}</strong></p>
      `)}
      <p style="color:#3D3628;font-size:14px;line-height:1.7;margin:0;">
        Un étudiant vient de remettre son travail. Connectez-vous pour le consulter et le télécharger.
      </p>
      ${button(`${APP_URL}/app/cours`, 'Voir les rendus')}`,
      'Vous recevez cet email car vous êtes professeur sur UniPlatform.'
    ),
  });
}

/* ── Note attribuée à un étudiant ───────────────────────────────────── */
async function sendGradeEmail(email, studentName, devoirTitle, grade, comment) {
  const gradeDisplay = grade !== null && grade !== undefined ? `${grade}/20` : 'Non notée';
  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `Votre note pour "${devoirTitle}"`,
    html: layout(
      'Votre travail a été noté',
      `Bonjour <strong>${studentName}</strong>`,
      `<div style="background:${NAVY};border-radius:12px;padding:22px;margin:24px 0;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:${GOLD};text-transform:uppercase;letter-spacing:0.06em;">Devoir</p>
        <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#ffffff;">${devoirTitle}</p>
        <p style="margin:0;font-size:36px;font-weight:800;color:#ffffff;font-family:${SERIF};">${gradeDisplay}</p>
      </div>
      ${comment ? infoCard(`
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:${GOLD};text-transform:uppercase;letter-spacing:0.06em;">Commentaire du professeur</p>
        <p style="margin:0;font-size:14px;color:#3D3628;line-height:1.6;">${comment}</p>
      `) : ''}
      ${button(`${APP_URL}/app/cours`, 'Voir mon devoir')}`,
      'UniPlatform — Plateforme universitaire en ligne'
    ),
  });
}

/* ── Réinitialisation mot de passe ──────────────────────────────────── */
async function sendPasswordResetEmail(email, username, token) {
  const link = `${APP_URL}/?reset_token=${token}`;

  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: 'Réinitialisation de votre mot de passe – UniPlatform',
    html: layout(
      'Réinitialisation du mot de passe',
      `Bonjour <strong>${username}</strong>`,
      `<p style="color:#3D3628;font-size:14px;line-height:1.7;margin:0;">
        Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
      </p>
      ${button(link, 'Réinitialiser mon mot de passe')}`,
      'Ce lien expire dans 1 heure. Si vous n\'avez pas demandé cette réinitialisation, ignorez cet email.'
    ),
  });
}

module.exports = { sendVerificationEmail, sendLiveSessionEmail, sendAnnouncementEmail, sendFileUploadEmail, sendPasswordResetEmail, sendNewDevoirEmail, sendSubmissionEmail, sendGradeEmail };
