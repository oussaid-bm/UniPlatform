const express = require('express');
const { getDb } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/* ── GET /api/demandes ─────────────────────────────────────────
   Étudiant  : ses propres demandes envoyées
   Professeur:
     - reçues des étudiants (section "étudiants")
     - échanges avec d'autres profs (envoyées ou reçues, section "profs")
─────────────────────────────────────────────────────────────── */
router.get('/', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const { id, role } = req.user;

    if (role === 'student') {
      const rows = await db.all(
        `SELECT * FROM demandes WHERE sender_id = ? ORDER BY created_at DESC`,
        [id]
      );
      return res.json(rows);
    }

    if (role === 'professor') {
      // Reçues des étudiants
      const fromStudents = await db.all(
        `SELECT * FROM demandes WHERE recipient_id = ? AND sender_role = 'student' ORDER BY created_at DESC`,
        [id]
      );
      // Échanges entre profs (envoyées OU reçues par ce prof)
      const profExchanges = await db.all(
        `SELECT * FROM demandes
         WHERE (sender_id = ? OR recipient_id = ?) AND sender_role = 'professor'
         ORDER BY created_at DESC`,
        [id, id]
      );
      return res.json({ fromStudents, profExchanges });
    }

    // Admin : tout
    const rows = await db.all(`SELECT * FROM demandes ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /api/demandes ───────────────────────────────────────── */
router.post('/', verifyToken, async (req, res) => {
  const { title, content, recipient_type, recipient_id, service } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ error: 'Titre et contenu requis.' });
  }

  try {
    const db = await getDb();
    let recipientName = 'Administration';
    let recipId = null;

    if (recipient_type === 'professor' && recipient_id) {
      const prof = await db.get('SELECT username FROM users WHERE id = ? AND role = ?', [recipient_id, 'professor']);
      if (!prof) return res.status(404).json({ error: 'Professeur introuvable.' });
      recipientName = prof.username;
      recipId = recipient_id;
    } else if (recipient_type === 'admin' && service?.trim()) {
      recipientName = service.trim();
    }

    const result = await db.run(
      `INSERT INTO demandes (title, content, sender_id, sender_name, sender_role, recipient_type, recipient_id, recipient_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title.trim(), content.trim(), req.user.id, req.user.username, req.user.role,
       recipient_type || 'admin', recipId, recipientName]
    );

    const demande = await db.get('SELECT * FROM demandes WHERE id = ?', [result.lastID]);
    res.status(201).json(demande);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── PATCH /api/demandes/:id ─────────────────────────────────────
   Le destinataire met à jour le statut et optionnellement une réponse
─────────────────────────────────────────────────────────────── */
router.patch('/:id', verifyToken, async (req, res) => {
  const { status, response } = req.body;
  const allowed = ['en_attente', 'repondu', 'refuse'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Statut invalide.' });

  try {
    const db = await getDb();
    const demande = await db.get('SELECT * FROM demandes WHERE id = ?', [req.params.id]);
    if (!demande) return res.status(404).json({ error: 'Demande introuvable.' });

    // Seul le destinataire (prof) ou un admin peut répondre
    const canRespond =
      req.user.role === 'admin' ||
      (demande.recipient_id === req.user.id);
    if (!canRespond) return res.status(403).json({ error: 'Non autorisé.' });

    await db.run(
      'UPDATE demandes SET status = ?, response = ? WHERE id = ?',
      [status, response || '', req.params.id]
    );
    const updated = await db.get('SELECT * FROM demandes WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── DELETE /api/demandes/:id ────────────────────────────────── */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const demande = await db.get('SELECT * FROM demandes WHERE id = ?', [req.params.id]);
    if (!demande) return res.status(404).json({ error: 'Demande introuvable.' });
    if (demande.sender_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé.' });
    }
    await db.run('DELETE FROM demandes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
