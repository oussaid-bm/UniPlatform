// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES DES SOUMISSIONS DE DEVOIRS
//  Gère : l'étudiant qui dépose son travail (PDF), le professeur qui le note,
//  le téléchargement et la suppression.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const multer  = require('multer'); // librairie qui gère l'upload de fichiers (multipart/form-data)
const path    = require('path');   // utilitaires de chemins de fichiers
const fs      = require('fs');     // accès au système de fichiers (lire/écrire/supprimer)
const { getDb }       = require('../db');
const { verifyToken } = require('../middleware/auth');
const { sendSubmissionEmail, sendGradeEmail } = require('../email');

const router = express.Router();

// Dossier où sont stockés les PDF déposés.
// On peut le configurer via la variable UPLOADS_PATH (ex : disque externe),
// sinon on utilise le dossier "uploads" à côté du serveur.
const uploadsDir = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH.trim())
  : path.join(__dirname, '..', 'uploads');

// Crée le dossier s'il n'existe pas encore (récursif = crée aussi les parents).
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Configuration de multer : OÙ stocker le fichier et SOUS QUEL NOM.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename:    (_req, file, cb) => {
    // Nom unique : "sub-<timestamp>-<nombre aléatoire>.pdf"
    // → évite que deux fichiers du même nom s'écrasent.
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'sub-' + unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  // On n'accepte QUE les PDF (sécurité : pas d'exécutables, images, etc.)
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Seuls les fichiers PDF sont acceptés.'));
  },
  limits: { fileSize: 25 * 1024 * 1024 }, // taille max : 25 Mo
});

/* ── Soumettre / remplacer son travail (étudiant) ─────────────────────────────
   POST /api/submissions/upload/:courseId
   upload.single('file') = multer traite UN fichier nommé "file" avant notre code.
─────────────────────────────────────────────────────────────────────────────── */
router.post('/upload/:courseId', verifyToken, upload.single('file'), async (req, res) => {
  // Seul un étudiant peut déposer un travail
  if (req.user.role !== 'student')
    return res.status(403).json({ error: 'Réservé aux étudiants.' });
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

  try {
    const db = await getDb();

    // Un étudiant n'a qu'UNE soumission par devoir : s'il redépose,
    // on supprime l'ancienne (fichier sur le disque + ligne en base) avant d'enregistrer la nouvelle.
    const existing = await db.get(
      'SELECT * FROM homework_submissions WHERE course_id = ? AND student_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (existing) {
      const oldPath = path.join(uploadsDir, existing.filename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      await db.run('DELETE FROM homework_submissions WHERE id = ?', [existing.id]);
    }

    // Enregistre la nouvelle soumission en base.
    // filename = nom sur le disque ; original_name = nom d'origine choisi par l'étudiant.
    const result = await db.run(
      `INSERT INTO homework_submissions (course_id, student_id, student_name, filename, original_name, size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.courseId, req.user.id, req.user.username,
       req.file.filename, req.file.originalname, req.file.size]
    );

    // Récupère l'email du professeur (jointure courses ↔ users) pour le prévenir.
    const course = await db.get(
      `SELECT c.title, u.email, u.username
       FROM courses c JOIN users u ON c.professor_id = u.id
       WHERE c.id = ?`,
      [req.params.courseId]
    );
    if (course) {
      sendSubmissionEmail(course.email, course.username, req.user.username, course.title).catch(() => {});
    }

    res.status(201).json({
      id:            result.lastID,
      course_id:     parseInt(req.params.courseId),
      student_id:    req.user.id,
      student_name:  req.user.username,
      filename:      req.file.filename,
      original_name: req.file.originalname,
      size:          req.file.size,
      created_at:    new Date().toISOString(),
    });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Erreur soumission:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── Télécharger une soumission ───────────────────────────────────────────── */
router.get('/download/:id', verifyToken, async (req, res) => {
  try {
    const db  = await getDb();
    const sub = await db.get('SELECT * FROM homework_submissions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Soumission introuvable.' });

    // Étudiant : peut télécharger seulement la sienne
    if (req.user.role === 'student' && sub.student_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé.' });

    const filePath = path.join(uploadsDir, sub.filename);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ error: 'Fichier manquant sur le disque.' });

    res.download(filePath, sub.original_name);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── Liste des soumissions d'un devoir ────────────────────────────────────── */
router.get('/:courseId', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    if (req.user.role === 'professor' || req.user.role === 'admin') {
      const rows = await db.all(
        'SELECT * FROM homework_submissions WHERE course_id = ? ORDER BY created_at DESC',
        [req.params.courseId]
      );
      return res.json(rows);
    }
    // Étudiant : seulement la sienne
    const row = await db.get(
      'SELECT * FROM homework_submissions WHERE course_id = ? AND student_id = ?',
      [req.params.courseId, req.user.id]
    );
    return res.json(row ? [row] : []);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── Noter une soumission (prof uniquement) ───────────────────────────────────
   PATCH /api/submissions/:id/grade   (PATCH = modification partielle)
─────────────────────────────────────────────────────────────────────────────── */
router.patch('/:id/grade', verifyToken, async (req, res) => {
  // Contrôle de rôle : seul un professeur peut noter.
  if (req.user.role !== 'professor')
    return res.status(403).json({ error: 'Réservé aux professeurs.' });

  const { grade, grade_comment } = req.body;
  // Validation : si une note est fournie, elle doit être un nombre entre 0 et 20.
  if (grade !== null && grade !== undefined) {
    const g = parseFloat(grade);
    if (isNaN(g) || g < 0 || g > 20)
      return res.status(400).json({ error: 'La note doit être entre 0 et 20.' });
  }

  try {
    const db  = await getDb();
    const sub = await db.get('SELECT * FROM homework_submissions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Soumission introuvable.' });

    // g = note convertie en nombre, ou null si le champ est vide (= "non noté").
    const g = (grade !== null && grade !== undefined && grade !== '') ? parseFloat(grade) : null;
    await db.run(
      'UPDATE homework_submissions SET grade = ?, grade_comment = ? WHERE id = ?',
      [g, grade_comment || '', req.params.id]
    );

    // On prévient l'étudiant par email qu'il a reçu une note.
    // .catch(() => {}) → si l'envoi échoue, on ignore (ne bloque pas la réponse).
    const course = await db.get('SELECT title FROM courses WHERE id = ?', [sub.course_id]);
    const student = await db.get('SELECT email FROM users WHERE id = ?', [sub.student_id]);
    if (student && course) {
      sendGradeEmail(student.email, sub.student_name, course.title, g, grade_comment || '')
        .catch(() => {});
    }

    res.json({ id: sub.id, grade: g, grade_comment: grade_comment || '' });
  } catch (err) {
    console.error('Erreur notation:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/* ── Supprimer une soumission ─────────────────────────────────────────────── */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const db  = await getDb();
    const sub = await db.get('SELECT * FROM homework_submissions WHERE id = ?', [req.params.id]);
    if (!sub) return res.status(404).json({ error: 'Soumission introuvable.' });

    // Étudiant : seulement la sienne ; prof/admin : n'importe laquelle
    if (req.user.role === 'student' && sub.student_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé.' });

    const filePath = path.join(uploadsDir, sub.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.run('DELETE FROM homework_submissions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Soumission supprimée.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
