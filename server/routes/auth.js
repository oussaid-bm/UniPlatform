// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES D'AUTHENTIFICATION
//  Inscription, connexion, vérification email, mot de passe oublié/réinitialisé.
//  Sécurité : mots de passe hachés (bcrypt), jetons signés (jwt),
//  jetons aléatoires (crypto), vérification du domaine email (dns/MX).
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const express  = require('express');
const bcrypt   = require('bcryptjs');         // hachage des mots de passe (sens unique)
const jwt      = require('jsonwebtoken');     // création/vérification des jetons de session
const crypto   = require('crypto');           // génération de jetons aléatoires (vérif. email, reset)
const dns      = require('dns').promises;     // vérifie qu'un domaine email existe (enregistrement MX)
const { getDb }                    = require('../db');
const { sendVerificationEmail }    = require('../email');
const { scheduleBounceCheck }      = require('../bounceChecker');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'univ_secret_key_2024';

// Vérifie que le domaine de l'email a bien un serveur mail (MX record)
async function emailDomainExists(email) {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    const records = await dns.resolveMx(domain);
    return records && records.length > 0;
  } catch {
    return false; // domaine inexistant ou sans MX
  }
}

/* ── INSCRIPTION ─────────────────────────────────────────────────────── */
router.post('/register', async (req, res) => {
  const { username, email, password, role, filiere } = req.body;
  if (!username || !email || !password || !role)
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  if (!['student', 'professor', 'admin'].includes(role))
    return res.status(400).json({ error: 'Rôle invalide.' });
  if (role === 'student' && !filiere)
    return res.status(400).json({ error: 'La filière est requise pour les étudiants.' });

  // Vérification domaine email (MX record)
  const domainValid = await emailDomainExists(email);
  if (!domainValid)
    return res.status(400).json({ error: "Adresse email invalide : le domaine n'accepte pas d'emails." });

  try {
    const db      = await getDb();
    const hashed  = await bcrypt.hash(password, 10);
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const result = await db.run(
      `INSERT INTO users
         (username, email, password, role, filiere, email_verified, verification_token, token_expires_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [username, email, hashed, role, filiere || '', token, expires]
    );

    // Envoi email (non bloquant — ne fait pas planter si ça échoue)
    sendVerificationEmail(email, username, token).catch((err) =>
      console.error('Erreur envoi email:', err.message)
    );

    // Vérification rebond : supprime le compte si Gmail renvoie "Address not found"
    scheduleBounceCheck(email, result.lastID);

    const APP_URL = process.env.APP_URL || 'http://localhost:3003';
    const isDevMode = !process.env.EMAIL_USER || process.env.EMAIL_USER.includes('votre.email');

    res.status(201).json({
      message: 'Compte créé. Vérifiez votre email pour activer votre compte.',
      userId: result.lastID,
      // En mode dev uniquement : renvoie le lien pour que le frontend l'affiche
      devVerifyLink: isDevMode ? `${APP_URL}/api/auth/verify-email?token=${token}` : undefined,
    });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed'))
      return res.status(409).json({ error: "Email ou nom d'utilisateur déjà utilisé." });
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── VÉRIFICATION EMAIL ──────────────────────────────────────────────── */
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token manquant.' });

  try {
    const db   = await getDb();
    const user = await db.get(
      'SELECT * FROM users WHERE verification_token = ?', [token]
    );

    if (!user)
      return res.status(400).send(htmlPage('Lien invalide', 'Ce lien de vérification est invalide ou a déjà été utilisé.', false));

    if (new Date(user.token_expires_at) < new Date())
      return res.status(400).send(htmlPage('Lien expiré', 'Ce lien a expiré. Connectez-vous et demandez un nouveau lien.', false));

    await db.run(
      'UPDATE users SET email_verified = 1, verification_token = NULL, token_expires_at = NULL WHERE id = ?',
      [user.id]
    );

    const APP_URL = process.env.APP_URL || 'http://localhost:3003';
    res.redirect(`${APP_URL}/?verified=1`);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── RENVOYER L'EMAIL DE VÉRIFICATION ───────────────────────────────── */
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });

  try {
    const db   = await getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user)       return res.status(404).json({ error: 'Aucun compte avec cet email.' });
    if (user.email_verified) return res.json({ message: 'Email déjà vérifié.' });

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await db.run(
      'UPDATE users SET verification_token = ?, token_expires_at = ? WHERE id = ?',
      [token, expires, user.id]
    );

    await sendVerificationEmail(email, user.username, token).catch((err) =>
      console.error('Erreur renvoi email:', err.message)
    );

    res.json({ message: 'Email de vérification renvoyé.' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── CONNEXION ───────────────────────────────────────────────────────── */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis.' });

  try {
    const db   = await getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Aucun compte trouvé avec cette adresse email.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Mot de passe incorrect.' });

    if (!user.email_verified)
      return res.status(403).json({ error: 'email_not_verified' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, filiere: user.filiere || '' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role, filiere: user.filiere || '' },
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── MOT DE PASSE OUBLIÉ ─────────────────────────────────────────────── */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });

  try {
    const db   = await getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    const ok   = { message: 'Si cet email existe, un lien de réinitialisation vous a été envoyé.' };

    if (!user) return res.json(ok); // ne révèle pas si l'email existe

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 h

    await db.run(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [token, expires, user.id]
    );

    const { sendPasswordResetEmail } = require('../email');
    sendPasswordResetEmail(email, user.username, token).catch((err) =>
      console.error('Erreur email reset:', err.message)
    );

    const APP_URL   = process.env.APP_URL || 'http://localhost:3003';
    const isDevMode = !process.env.EMAIL_USER || process.env.EMAIL_USER.includes('votre.email');

    res.json({
      ...ok,
      devResetLink: isDevMode ? `${APP_URL}/?reset_token=${token}` : undefined,
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── RÉINITIALISATION MOT DE PASSE ───────────────────────────────────── */
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token et mot de passe requis.' });
  if (password.length < 6) return res.status(400).json({ error: 'Minimum 6 caractères.' });

  try {
    const db   = await getDb();
    const user = await db.get('SELECT * FROM users WHERE reset_token = ?', [token]);

    if (!user) return res.status(400).json({ error: 'Lien invalide ou déjà utilisé.' });
    if (new Date(user.reset_token_expires) < new Date())
      return res.status(400).json({ error: 'Lien expiré. Demandez un nouveau lien.' });

    const hashed = await bcrypt.hash(password, 10);
    await db.run(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hashed, user.id]
    );

    res.json({ message: 'Mot de passe réinitialisé avec succès.' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── VÉRIFICATION STATUT COMPTE (pour feedback bounce) ─────────────── */
router.get('/account-status', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email requis.' });
  try {
    const db   = await getDb();
    const user = await db.get('SELECT id, email_verified FROM users WHERE email = ?', [email]);
    if (!user) return res.json({ exists: false });
    res.json({ exists: true, verified: !!user.email_verified });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── LISTE DES PROFESSEURS ──────────────────────────────────────────── */
const { verifyToken } = require('../middleware/auth');
router.get('/professors', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const professors = await db.all(
      'SELECT id, username FROM users WHERE role = ? ORDER BY username ASC',
      ['professor']
    );
    res.json(professors);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── Helper : page HTML d'erreur ─────────────────────────────────────── */
function htmlPage(title, message, success) {
  const color = success ? '#059669' : '#DC2626';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#F8FAFF}
  .box{text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:400px}
  h2{color:${color}} p{color:#6B7280;font-size:14px}
  a{display:inline-block;margin-top:16px;padding:10px 24px;background:#4F46E5;color:#fff;border-radius:8px;text-decoration:none;font-weight:600}</style>
  </head><body><div class="box"><h2>${title}</h2><p>${message}</p><a href="/">Retour à l'accueil</a></div></body></html>`;
}

module.exports = router;
