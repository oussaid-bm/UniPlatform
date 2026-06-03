// ─────────────────────────────────────────────────────────────────────────────
//  ROUTES DES COURS
//  Création / consultation / suppression des cours et devoirs.
//  Colonne "type" : 'cours' ou 'devoir'.
//  Colonne "is_live_session" : 1 = salle de visioconférence, 0 = cours classique.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const { getDb } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { sendNewDevoirEmail } = require('../email');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    let rows;
    if (req.user.role === 'student') {
      // Étudiants : cours de leur filière ou cours sans restriction
      rows = await db.all(
        `SELECT c.*, u.username AS professor_name
         FROM courses c JOIN users u ON c.professor_id = u.id
         WHERE c.filiere = '' OR c.filiere = ?
         ORDER BY c.created_at DESC`,
        [req.user.filiere || '']
      );
    } else if (req.user.role === 'professor') {
      // Profs : leurs propres cours uniquement
      rows = await db.all(
        `SELECT c.*, u.username AS professor_name
         FROM courses c JOIN users u ON c.professor_id = u.id
         WHERE c.professor_id = ?
         ORDER BY c.created_at DESC`,
        [req.user.id]
      );
    } else {
      // Admin : tous les cours
      rows = await db.all(
        `SELECT c.*, u.username AS professor_name
         FROM courses c JOIN users u ON c.professor_id = u.id
         ORDER BY c.created_at DESC`
      );
    }
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'professor') {
    return res.status(403).json({ error: 'Accès réservé aux professeurs.' });
  }
  const { title, description, filiere, is_live_session, type } = req.body;
  if (!title) return res.status(400).json({ error: 'Le titre est requis.' });
  try {
    const db = await getDb();
    const liveFlag   = is_live_session ? 1 : 0;
    const courseType = ['cours', 'devoir'].includes(type) ? type : 'cours';
    const result = await db.run(
      'INSERT INTO courses (title, description, professor_id, filiere, is_live_session, type) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description || '', req.user.id, filiere || '', liveFlag, courseType]
    );
    const courseId = result.lastID;

    // Notifier les étudiants de la filière si c'est un devoir
    if (courseType === 'devoir') {
      const filiereTarget = filiere || '';
      const students = await db.all(
        `SELECT email, username FROM users WHERE role = 'student' AND (? = '' OR filiere = ?)`,
        [filiereTarget, filiereTarget]
      );
      students.forEach(s =>
        sendNewDevoirEmail(s.email, s.username, title, req.user.username).catch(() => {})
      );
    }

    res.status(201).json({
      id: courseId,
      title,
      description: description || '',
      professor_id: req.user.id,
      professor_name: req.user.username,
      filiere: filiere || '',
      is_live_session: liveFlag,
      type: courseType,
      created_at: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'professor') {
    return res.status(403).json({ error: 'Accès réservé aux professeurs.' });
  }
  try {
    const db = await getDb();
    const course = await db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);
    if (!course) return res.status(404).json({ error: 'Cours introuvable.' });
    if (course.professor_id !== req.user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres cours.' });
    }
    await db.run('DELETE FROM courses WHERE id = ?', [req.params.id]);
    res.json({ message: 'Cours supprimé.' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/:id/messages', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all(
      `SELECT m.*, u.username AS sender_name
       FROM messages m JOIN users u ON m.sender_id = u.id
       WHERE m.course_id = ?
       ORDER BY m.created_at ASC LIMIT 100`,
      [req.params.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
