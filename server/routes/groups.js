
const express = require('express');
const { getDb } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.get('/', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const { id, role } = req.user;
    let rows;

    if (role === 'professor') {
      rows = await db.all(
        `SELECT g.*, COUNT(gm.user_id) AS member_count
         FROM study_groups g
         LEFT JOIN group_members gm ON g.id = gm.group_id
         WHERE g.created_by = ?
         GROUP BY g.id
         ORDER BY g.created_at DESC`,
        [id]
      );
    } else {
      rows = await db.all(
        `SELECT g.*, COUNT(gm2.user_id) AS member_count
         FROM study_groups g
         JOIN group_members gm  ON g.id = gm.group_id  AND gm.user_id = ?
         LEFT JOIN group_members gm2 ON g.id = gm2.group_id
         GROUP BY g.id
         ORDER BY g.created_at DESC`,
        [id]
      );
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/students', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const { filiere } = req.query;
    const rows = await db.all(
      `SELECT id, username FROM users WHERE role = 'student'${filiere ? " AND filiere = ?" : ''} ORDER BY username ASC`,
      filiere ? [filiere] : []
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'professor') return res.status(403).json({ error: 'Non autorisé.' });
  const { name, filiere, members } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom du groupe requis.' });

  try {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO study_groups (name, filiere, created_by, creator_name) VALUES (?, ?, ?, ?)',
      [name.trim(), filiere || '', req.user.id, req.user.username]
    );
    const groupId = result.lastID;

    await db.run('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, req.user.id]);

    if (Array.isArray(members)) {
      for (const userId of members) {
        await db.run('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, userId]);
      }
    }

    const group = await db.get(
      `SELECT g.*, COUNT(gm.user_id) AS member_count
       FROM study_groups g LEFT JOIN group_members gm ON g.id = gm.group_id
       WHERE g.id = ?`,
      [groupId]
    );
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/members', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const group = await db.get('SELECT * FROM study_groups WHERE id = ?', [req.params.id]);
    if (!group) return res.status(404).json({ error: 'Groupe introuvable.' });

    const members = await db.all(
      `SELECT u.id, u.username, u.role
       FROM group_members gm JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ?
       ORDER BY (u.role = 'professor') DESC, u.username ASC`,
      [req.params.id]
    );
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/leave', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const group = await db.get('SELECT * FROM study_groups WHERE id = ?', [req.params.id]);
    if (!group) return res.status(404).json({ error: 'Groupe introuvable.' });
    if (group.created_by === req.user.id) {
      return res.status(400).json({ error: 'Le créateur doit supprimer le groupe.' });
    }
    await db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/members/:userId', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const group = await db.get('SELECT * FROM study_groups WHERE id = ?', [req.params.id]);
    if (!group) return res.status(404).json({ error: 'Groupe introuvable.' });
    if (group.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé.' });
    }
    if (parseInt(req.params.userId) === group.created_by) {
      return res.status(400).json({ error: 'Impossible d\'expulser le créateur.' });
    }
    await db.run('DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const group = await db.get('SELECT * FROM study_groups WHERE id = ?', [req.params.id]);
    if (!group) return res.status(404).json({ error: 'Groupe introuvable.' });
    if (group.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Non autorisé.' });
    }
    await db.run('DELETE FROM study_groups WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
