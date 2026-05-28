require('dotenv').config();
const nodemailer = require('nodemailer');

const APP_URL    = process.env.APP_URL    || 'http://localhost:3003';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';

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

async function sendVerificationEmail(email, username, token) {
  const link = `${APP_URL}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: '✅ Vérifiez votre adresse email – UniPlatform',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #E5E7EB;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:#4F46E5;border-radius:14px;font-size:26px;">🎓</div>
          <h2 style="color:#111827;margin:14px 0 4px;font-size:22px;font-weight:700;">Bienvenue sur UniPlatform !</h2>
          <p style="color:#6B7280;margin:0;font-size:14px;">Bonjour <strong>${username}</strong>, votre compte est presque prêt.</p>
        </div>

        <p style="color:#374151;font-size:14px;line-height:1.7;margin-bottom:24px;">
          Cliquez sur le bouton ci-dessous pour <strong>vérifier votre adresse email</strong> et activer votre compte UniPlatform.
        </p>

        <div style="text-align:center;margin:28px 0;">
          <a href="${link}"
             style="display:inline-block;padding:14px 36px;background:#4F46E5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            ✅ Vérifier mon email
          </a>
        </div>

        <hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;" />
        <p style="color:#9CA3AF;font-size:12px;text-align:center;line-height:1.6;margin:0;">
          Ce lien expire dans 24 heures.<br/>
          Si vous n'avez pas créé de compte sur UniPlatform, ignorez cet email.
        </p>
      </div>
    `,
  });

  console.log(`📧 Email envoyé à ${email}`);
}

/* ── Notification cours en direct ───────────────────────────────────── */
async function sendLiveSessionEmail(email, username, courseName, professorName, courseId) {
  const link = `${APP_URL}/app/cours/${courseId}`;

  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `🔴 Cours en direct : ${courseName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #E5E7EB;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:#EF4444;border-radius:14px;font-size:26px;">🔴</div>
          <h2 style="color:#111827;margin:14px 0 4px;font-size:22px;font-weight:700;">Cours en direct démarré !</h2>
          <p style="color:#6B7280;margin:0;font-size:14px;">Bonjour <strong>${username}</strong></p>
        </div>

        <div style="background:#F8FAFF;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
          <p style="margin:0 0 8px;font-size:13px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Cours</p>
          <p style="margin:0;font-size:17px;font-weight:700;color:#111827;">${courseName}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#6B7280;">👨‍🏫 ${professorName} • En ce moment</p>
        </div>

        <p style="color:#374151;font-size:14px;line-height:1.7;margin-bottom:24px;">
          Votre professeur vient de démarrer une session vidéo en direct. Rejoignez maintenant pour ne rien manquer !
        </p>

        <div style="text-align:center;margin:28px 0;">
          <a href="${link}"
             style="display:inline-block;padding:14px 36px;background:#4F46E5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            🚀 Rejoindre le cours
          </a>
        </div>

        <hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;" />
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0;">
          Vous recevez cet email car vous êtes inscrit dans cette filière sur UniPlatform.
        </p>
      </div>
    `,
  });
}

/* ── Notification nouvelle annonce ──────────────────────────────────── */
async function sendAnnouncementEmail(email, username, title, content, authorName) {
  const preview = content.length > 120 ? content.slice(0, 120) + '…' : content;

  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `📢 Nouvelle annonce : ${title}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #E5E7EB;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:#F59E0B;border-radius:14px;font-size:26px;">📢</div>
          <h2 style="color:#111827;margin:14px 0 4px;font-size:22px;font-weight:700;">Nouvelle annonce</h2>
          <p style="color:#6B7280;margin:0;font-size:14px;">Bonjour <strong>${username}</strong></p>
        </div>

        <div style="background:#FFFBEB;border-radius:10px;padding:18px 20px;margin-bottom:24px;border-left:4px solid #F59E0B;">
          <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111827;">${title}</p>
          <p style="margin:0;font-size:13px;color:#6B7280;">👨‍🏫 ${authorName}</p>
        </div>

        <p style="color:#374151;font-size:14px;line-height:1.7;margin-bottom:24px;">${preview}</p>

        <div style="text-align:center;margin:28px 0;">
          <a href="${APP_URL}/app/annonces"
             style="display:inline-block;padding:14px 36px;background:#4F46E5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            Voir l'annonce
          </a>
        </div>

        <hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;" />
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0;">
          Vous recevez cet email car vous êtes inscrit dans cette filière sur UniPlatform.
        </p>
      </div>
    `,
  });
}

/* ── Notification nouveau fichier déposé ────────────────────────────── */
async function sendFileUploadEmail(email, username, fileName, courseName, authorName, courseId) {
  const link = `${APP_URL}/app/cours`;

  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `📎 Nouveau fichier dans "${courseName}"`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #E5E7EB;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:#EF4444;border-radius:14px;font-size:26px;">📎</div>
          <h2 style="color:#111827;margin:14px 0 4px;font-size:22px;font-weight:700;">Nouveau fichier disponible</h2>
          <p style="color:#6B7280;margin:0;font-size:14px;">Bonjour <strong>${username}</strong></p>
        </div>

        <div style="background:#FEF2F2;border-radius:10px;padding:18px 20px;margin-bottom:24px;border-left:4px solid #EF4444;">
          <p style="margin:0 0 4px;font-size:13px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Cours</p>
          <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#111827;">${courseName}</p>
          <p style="margin:0;font-size:14px;color:#374151;">📄 ${fileName}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6B7280;">👨‍🏫 Déposé par ${authorName}</p>
        </div>

        <p style="color:#374151;font-size:14px;line-height:1.7;margin-bottom:24px;">
          Un nouveau fichier PDF a été déposé dans ce cours. Consultez-le dès maintenant depuis l'espace Cours & Devoirs.
        </p>

        <div style="text-align:center;margin:28px 0;">
          <a href="${link}"
             style="display:inline-block;padding:14px 36px;background:#4F46E5;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            Voir le cours
          </a>
        </div>

        <hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;" />
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0;">
          Vous recevez cet email car vous êtes inscrit dans cette filière sur UniPlatform.
        </p>
      </div>
    `,
  });
}

/* ── Nouveau devoir publié ───────────────────────────────────────────── */
async function sendNewDevoirEmail(email, username, devoirTitle, professorName) {
  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `📝 Nouveau devoir : ${devoirTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #E5E7EB;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:#1B2B4B;border-radius:14px;font-size:26px;">📝</div>
          <h2 style="color:#111827;margin:14px 0 4px;font-size:22px;font-weight:700;">Nouveau devoir publié</h2>
          <p style="color:#6B7280;margin:0;font-size:14px;">Bonjour <strong>${username}</strong></p>
        </div>
        <div style="background:#FBF0E0;border-radius:10px;padding:18px 20px;margin-bottom:24px;border-left:4px solid #C8963E;">
          <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111827;">${devoirTitle}</p>
          <p style="margin:0;font-size:13px;color:#6B7280;">👨‍🏫 ${professorName}</p>
        </div>
        <p style="color:#374151;font-size:14px;line-height:1.7;margin-bottom:24px;">
          Un nouveau devoir a été publié. Connectez-vous à UniPlatform pour consulter les consignes et remettre votre travail.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${APP_URL}/app/cours" style="display:inline-block;padding:14px 36px;background:#1B2B4B;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            Voir le devoir
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;" />
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0;">
          Vous recevez cet email car vous êtes inscrit dans cette filière sur UniPlatform.
        </p>
      </div>
    `,
  });
}

/* ── Travail rendu par un étudiant ──────────────────────────────────── */
async function sendSubmissionEmail(email, professorName, studentName, devoirTitle) {
  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `✅ Travail rendu : ${devoirTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #E5E7EB;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:#059669;border-radius:14px;font-size:26px;">✅</div>
          <h2 style="color:#111827;margin:14px 0 4px;font-size:22px;font-weight:700;">Travail rendu</h2>
          <p style="color:#6B7280;margin:0;font-size:14px;">Bonjour <strong>${professorName}</strong></p>
        </div>
        <div style="background:#F0FDF4;border-radius:10px;padding:18px 20px;margin-bottom:24px;border-left:4px solid #10B981;">
          <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#111827;">${devoirTitle}</p>
          <p style="margin:0;font-size:13px;color:#6B7280;">👤 Soumis par <strong>${studentName}</strong></p>
        </div>
        <p style="color:#374151;font-size:14px;line-height:1.7;margin-bottom:24px;">
          Un étudiant vient de remettre son travail. Connectez-vous pour le consulter et le télécharger.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${APP_URL}/app/cours" style="display:inline-block;padding:14px 36px;background:#059669;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            Voir les rendus
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;" />
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0;">
          Vous recevez cet email car vous êtes professeur sur UniPlatform.
        </p>
      </div>
    `,
  });
}

/* ── Note attribuée à un étudiant ───────────────────────────────────── */
async function sendGradeEmail(email, studentName, devoirTitle, grade, comment) {
  const gradeDisplay = grade !== null && grade !== undefined ? `${grade}/20` : 'Non notée';
  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: `🎓 Votre note pour "${devoirTitle}"`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #E5E7EB;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:#1B2B4B;border-radius:14px;font-size:26px;">🎓</div>
          <h2 style="color:#111827;margin:14px 0 4px;font-size:22px;font-weight:700;">Votre travail a été noté</h2>
          <p style="color:#6B7280;margin:0;font-size:14px;">Bonjour <strong>${studentName}</strong></p>
        </div>
        <div style="background:#F8FAFF;border-radius:10px;padding:18px 20px;margin-bottom:24px;border-left:4px solid #1B2B4B;">
          <p style="margin:0 0 6px;font-size:14px;color:#6B7280;">Devoir</p>
          <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#111827;">${devoirTitle}</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:#1B2B4B;">${gradeDisplay}</p>
        </div>
        ${comment ? `<div style="background:#FFFBEB;border-radius:10px;padding:14px 18px;margin-bottom:24px;border-left:4px solid #C8963E;"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.05em;">Commentaire</p><p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${comment}</p></div>` : ''}
        <div style="text-align:center;margin:28px 0;">
          <a href="${APP_URL}/app/cours" style="display:inline-block;padding:14px 36px;background:#1B2B4B;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            Voir mon devoir
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;" />
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin:0;">UniPlatform</p>
      </div>
    `,
  });
}

/* ── Réinitialisation mot de passe ──────────────────────────────────── */
async function sendPasswordResetEmail(email, username, token) {
  const link = `${APP_URL}/?reset_token=${token}`;

  await transporter.sendMail({
    from: `"UniPlatform" <${EMAIL_USER}>`,
    to: email,
    subject: '🔑 Réinitialisation de votre mot de passe – UniPlatform',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #E5E7EB;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;background:#1B2B4B;border-radius:14px;font-size:26px;">🔑</div>
          <h2 style="color:#111827;margin:14px 0 4px;font-size:22px;font-weight:700;">Réinitialisation du mot de passe</h2>
          <p style="color:#6B7280;margin:0;font-size:14px;">Bonjour <strong>${username}</strong></p>
        </div>
        <p style="color:#374151;font-size:14px;line-height:1.7;margin-bottom:24px;">
          Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${link}" style="display:inline-block;padding:14px 36px;background:#1B2B4B;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            🔑 Réinitialiser mon mot de passe
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;" />
        <p style="color:#9CA3AF;font-size:12px;text-align:center;line-height:1.6;margin:0;">
          Ce lien expire dans <strong>1 heure</strong>.<br/>
          Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
        </p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendLiveSessionEmail, sendAnnouncementEmail, sendFileUploadEmail, sendPasswordResetEmail, sendNewDevoirEmail, sendSubmissionEmail, sendGradeEmail };
