
const express = require('express');
const { getDb } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { sendAnnouncementEmail } = require('../email');
const { notifyStudentsByFiliere } = require('../utils/notifyStudents');

const router = express.Router();

router.get('/', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    let rows;
    if (req.user.role === 'student') {
      rows = await db.all(
        `SELECT * FROM announcements
         WHERE filiere = '' OR filiere = ?
         ORDER BY created_at DESC LIMIT 50`,
        [req.user.filiere || '']
      );
    } else {
      rows = await db.all(
        `SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50`
      );
    }
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/', verifyToken, async (req, res) => {
  if (!['professor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Réservé aux professeurs et admins.' });
  }
  const { title, content, filiere } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Titre et contenu requis.' });
  }
  try {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO announcements (title, content, author_id, author_name, filiere) VALUES (?, ?, ?, ?, ?)',
      [title, content, req.user.id, req.user.username, filiere || '']
    );
    res.status(201).json({
      id: result.lastID,
      title, content,
      author_id: req.user.id,
      author_name: req.user.username,
      filiere: filiere || '',
      created_at: new Date().toISOString(),
    });

    const authorName = req.user.username;
    await notifyStudentsByFiliere(
      filiere,
      (email, username) => sendAnnouncementEmail(email, username, title, content, authorName),
      `Annonce "${title}"`
    );
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  if (!['professor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  try {
    const db = await getDb();
    const ann = await db.get('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
    if (!ann) return res.status(404).json({ error: 'Annonce introuvable.' });
    if (req.user.role !== 'admin' && ann.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos annonces.' });
    }
    await db.run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    res.json({ message: 'Annonce supprimée.' });
  } catch {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
