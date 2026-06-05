// ═════════════════════════════════════════════════════════════════════════════
//  POINT D'ENTRÉE DU SERVEUR
//  Ce fichier fait DEUX choses sur un même port :
//   1. Sert l'API REST (Express) → requêtes HTTP classiques (login, cours, devoirs…)
//   2. Sert la communication temps réel (Socket.io) → chat, signalisation WebRTC,
//      notifications, listes "en ligne".
// ═════════════════════════════════════════════════════════════════════════════
require('dotenv').config();            // charge les variables du fichier .env
const express = require('express');
const http = require('http');
const cors = require('cors');          // autorise le frontend (autre port) à appeler l'API
const path = require('path');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db');

// Chaque fichier de routes regroupe les endpoints d'un domaine fonctionnel.
const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const announcementsRoutes = require('./routes/announcements');
const filesRoutes = require('./routes/files');
const demandesRoutes    = require('./routes/demandes');
const groupsRoutes      = require('./routes/groups');
const submissionsRoutes = require('./routes/submissions');
const chatRoutes        = require('./routes/chat');
const { sendLiveSessionEmail } = require('./email');

const app = express();
const server = http.createServer(app); // serveur HTTP qui portera à la fois Express ET Socket.io

// Socket.io s'attache au même serveur HTTP. cors origin '*' = accepte toutes les origines.
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());            // active CORS pour toutes les routes
app.use(express.json());    // parse automatiquement le corps JSON des requêtes (req.body)

// Branche chaque groupe de routes sous son préfixe d'URL.

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/demandes',     demandesRoutes);
app.use('/api/groups',      groupsRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/chat',       chatRoutes);

// ── Historique chat global ────────────────────────────────────────────
const { verifyToken } = require('./middleware/auth');
app.get('/api/global-chat/history', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    // On ne renvoie que les messages de la filière de l'utilisateur.
    const messages = await db.all(
      'SELECT * FROM global_messages WHERE filiere = ? ORDER BY created_at ASC LIMIT 100',
      [req.user.filiere || '']
    );
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Sert le build React en production
const buildPath = path.join(__dirname, '../front/build');
app.use(express.static(buildPath));
// Toutes les autres routes → React Router
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

const JWT_SECRET = process.env.JWT_SECRET || 'univ_secret_key_2024';

// ── ÉTAT EN MÉMOIRE (vit tant que le serveur tourne) ──
// On suit qui est connecté et qui participe à quelle session vidéo.
// Un "socketId" identifie UNE connexion navigateur (un onglet).

// socketId -> { userId, username, role } : qui est derrière chaque connexion
const connectedUsers = {};
// courseId -> Set de socketIds : les participants présents dans une session vidéo
const courseRooms = {};
// courseId -> { professorSocketId, professorName, startedAt } : les cours actuellement EN DIRECT
const liveCourses = {};
// courseId -> { socketId: {username, role} } : détail des participants (pour la liste)
const courseParticipants = {};

const getRoomKey = (courseId) => `course-${courseId}`;

// Liste des utilisateurs en ligne dans une room (dédupliqués par userId)
function getOnlineInRoom(room) {
  const socketIds = io.sockets.adapter.rooms.get(room);
  if (!socketIds) return [];
  const seen = new Set();
  const users = [];
  for (const sid of socketIds) {
    const u = connectedUsers[sid];
    if (u && !seen.has(u.userId)) {
      seen.add(u.userId);
      users.push({ id: u.userId, username: u.username, role: u.role });
    }
  }
  return users;
}
// Le chat global est SÉPARÉ PAR FILIÈRE : chaque spécialité a sa propre "room"
// nommée "global-<filiere>". Les étudiants ne voient que le chat de leur filière.
const globalRoom = (filiere) => `global-${filiere || ''}`;
const emitGlobalOnline = (filiere) => {
  const room = globalRoom(filiere);
  io.to(room).emit('global-online', getOnlineInRoom(room));
};
const emitGroupOnline = (groupId) =>
  io.to(`group-${groupId}`).emit('group-online', { groupId, users: getOnlineInRoom(`group-${groupId}`) });

// ═══════════════════════════════════════════════════════════════════════════
//  GESTION TEMPS RÉEL (Socket.io)
//  Ce bloc s'exécute À CHAQUE nouvelle connexion d'un navigateur.
//  Chaque socket.on('événement', ...) écoute un message envoyé par le client.
//  socket.emit  → envoie à CE client ; io.to(room).emit → envoie à toute une "room".
// ═══════════════════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log('Nouvelle connexion socket:', socket.id);

  // Dès la connexion, le client envoie son token JWT pour s'identifier.
  // On mémorise qui il est (connectedUsers) pour les messages/participants suivants.
  socket.on('authenticate', (token) => {
    try {
      const user = jwt.verify(token, JWT_SECRET);
      // On mémorise aussi la filière → sert à router le chat global par spécialité.
      connectedUsers[socket.id] = { userId: user.id, username: user.username, role: user.role, filiere: user.filiere || '' };
      socket.emit('authenticated', { success: true });
    } catch {
      socket.emit('authenticated', { success: false, error: 'Token invalide.' });
    }
  });

  // ─── CHAT GLOBAL (séparé par filière) ──────────────────────────────
  // L'étudiant rejoint automatiquement la room de SA filière (lue depuis son compte).
  socket.on('join-global-chat', () => {
    const user = connectedUsers[socket.id];
    if (!user) return;
    socket.join(globalRoom(user.filiere));
    emitGlobalOnline(user.filiere);
  });

  socket.on('leave-global-chat', () => {
    const user = connectedUsers[socket.id];
    if (!user) return;
    socket.leave(globalRoom(user.filiere));
    emitGlobalOnline(user.filiere);
  });

  socket.on('send-global-message', async ({ content }) => {
    const user = connectedUsers[socket.id];
    if (!user || !content?.trim()) return;
    try {
      const db = await getDb();
      const result = await db.run(
        'INSERT INTO global_messages (sender_id, sender_name, filiere, content) VALUES (?, ?, ?, ?)',
        [user.userId, user.username, user.filiere || '', content.trim()]
      );
      const message = {
        id: result.lastID,
        sender_id: user.userId,
        sender_name: user.username,
        filiere: user.filiere || '',
        content: content.trim(),
        created_at: new Date().toISOString(),
      };
      // On diffuse UNIQUEMENT aux étudiants de la même filière.
      io.to(globalRoom(user.filiere)).emit('global-message', message);
    } catch (err) {
      console.error('Erreur sauvegarde message global:', err.message);
    }
  });

  // ─── CHAT GROUPES ───────────────────────────────────────────────────
  socket.on('join-group-chat', (groupId) => {
    socket.join(`group-${groupId}`);
    emitGroupOnline(groupId);
  });

  socket.on('leave-group-chat', (groupId) => {
    socket.leave(`group-${groupId}`);
    emitGroupOnline(groupId);
  });

  socket.on('send-group-message', async ({ groupId, content }) => {
    const user = connectedUsers[socket.id];
    if (!user || !content?.trim()) return;
    try {
      const db = await getDb();
      const result = await db.run(
        'INSERT INTO group_messages (group_id, sender_id, sender_name, content) VALUES (?, ?, ?, ?)',
        [groupId, user.userId, user.username, content.trim()]
      );
      const message = {
        id: result.lastID,
        groupId,
        group_id: groupId,
        sender_id: user.userId,
        sender_name: user.username,
        content: content.trim(),
        created_at: new Date().toISOString(),
      };
      io.to(`group-${groupId}`).emit('group-message', message);
    } catch (err) {
      console.error('Erreur sauvegarde message groupe:', err.message);
    }
  });

  // Diffusion d'un message fichier (déjà sauvegardé via REST) aux membres connectés
  socket.on('broadcast-group-file', ({ groupId, message }) => {
    io.to(`group-${groupId}`).emit('group-message', { ...message, groupId, group_id: groupId });
  });
  socket.on('broadcast-global-file', ({ message }) => {
    const user = connectedUsers[socket.id];
    // On diffuse le fichier uniquement à la filière de l'expéditeur.
    io.to(globalRoom(user?.filiere)).emit('global-message', message);
  });

  // ─── CHAT TEXTE (cours) ────────────────────────────────────────────
  socket.on('join-course-chat', (courseId) => {
    socket.join(getRoomKey(courseId));
    if (connectedUsers[socket.id]) {
      connectedUsers[socket.id].courseId = courseId;
    }
  });

  socket.on('send-message', async ({ courseId, content }) => {
    const user = connectedUsers[socket.id];
    if (!user || !content?.trim()) return;
    try {
      const db = await getDb();
      const result = await db.run(
        'INSERT INTO messages (course_id, sender_id, content) VALUES (?, ?, ?)',
        [courseId, user.userId, content.trim()]
      );
      const message = {
        id: result.lastID,
        course_id: courseId,
        sender_id: user.userId,
        sender_name: user.username,
        content: content.trim(),
        created_at: new Date().toISOString(),
      };
      io.to(getRoomKey(courseId)).emit('new-message', message);
    } catch (err) {
      console.error('Erreur sauvegarde message:', err);
    }
  });

  socket.on('leave-course-chat', (courseId) => {
    socket.leave(getRoomKey(courseId));
  });

  // ─── VIDÉO WEBRTC SIGNALING ────────────────────────────────────────
  socket.on('get-live-courses', () => {
    socket.emit('live-courses-update', liveCourses);
  });

  socket.on('start-video-session', async (courseId) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    courseId = String(courseId);
    if (!courseRooms[courseId]) courseRooms[courseId] = new Set();
    courseRooms[courseId].add(socket.id);
    socket.join(`video-${courseId}`);
    liveCourses[courseId] = {
      professorSocketId: socket.id,
      professorName: user.username,
      startedAt: new Date().toISOString(),
    };
    courseParticipants[courseId] = { [socket.id]: user.username };
    io.emit('live-courses-update', liveCourses);
    io.to(getRoomKey(courseId)).emit('video-session-started', {
      courseId,
      professorSocketId: socket.id,
    });
    io.to(`video-${courseId}`).emit('participants-update', [{ socketId: socket.id, username: user.username, role: 'professor' }]);

    // ── Envoi d'emails selon la filière du cours ──────────────────────
    try {
      const db = await getDb();
      const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
      if (!course) return;

      // Filière du cours — si vide ("Toutes les filières") → pas d'email envoyé
      const filiere = course.filiere ? course.filiere.trim() : null;
      if (!filiere) {
        console.log(`Cours "${course.title}" sans filière → aucun email envoyé.`);
        return;
      }

      const students = await db.all(
        'SELECT username, email FROM users WHERE role = ? AND filiere = ? AND email_verified = 1',
        ['student', filiere]
      );

      if (students.length === 0) {
        console.log(`Aucun étudiant vérifié pour la filière "${filiere}"`);
        return;
      }

      console.log(`Envoi de ${students.length} email(s) pour "${course.title}" → ${filiere}`);
      students.forEach(({ username, email }) => {
        sendLiveSessionEmail(email, username, course.title, user.username, courseId)
          .then(() => console.log(`  Email → ${email}`))
          .catch((err) => console.error(`  Échec ${email}:`, err.message));
      });

    } catch (err) {
      console.error('Erreur envoi emails cours live:', err.message);
    }
  });

  // Étudiant demande à rejoindre (salle d'attente)
  socket.on('request-join-video', ({ courseId, professorSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user) return;
    io.to(professorSocketId).emit('student-join-request', {
      studentSocketId: socket.id,
      username: user.username,
    });
  });

  // Professeur accepte un étudiant
  socket.on('accept-student', ({ courseId, studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    courseId = String(courseId);
    io.to(studentSocketId).emit('join-request-accepted', { professorSocketId: socket.id });
  });

  // Professeur refuse un étudiant
  socket.on('reject-student', ({ studentSocketId }) => {
    io.to(studentSocketId).emit('join-request-rejected');
  });

  socket.on('join-video-session', ({ courseId, professorSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user) return;
    courseId = String(courseId);
    if (!courseRooms[courseId]) courseRooms[courseId] = new Set();
    courseRooms[courseId].add(socket.id);
    socket.join(`video-${courseId}`);
    // Ajouter aux participants et diffuser la liste mise à jour
    if (!courseParticipants[courseId]) courseParticipants[courseId] = {};
    courseParticipants[courseId][socket.id] = { username: user.username, role: user.role };
    const parts = Object.entries(courseParticipants[courseId]).map(([sid, u]) => ({ socketId: sid, username: u.username, role: u.role }));
    io.to(`video-${courseId}`).emit('participants-update', parts);
    // Notifie le professeur pour démarrer WebRTC
    io.to(professorSocketId).emit('student-wants-to-join', {
      studentSocketId: socket.id,
      username: user.username,
    });
  });

  // ── SIGNALISATION WebRTC ──
  // IMPORTANT : la vidéo NE passe PAS par le serveur. Le serveur ne fait QUE
  // transmettre les "messages de mise en relation" entre deux navigateurs.
  // Une fois connectés, ils s'échangent la vidéo en DIRECT (pair-à-pair / P2P).
  //
  // Étape 1 : le prof envoie une OFFRE (sa description de session SDP) à un étudiant.
  socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit('webrtc-offer', {
      fromSocketId: socket.id, // pour que l'étudiant sache à qui répondre
      offer,
    });
  });

  // Étape 2 : l'étudiant renvoie une RÉPONSE (sa propre description SDP) au prof.
  socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('webrtc-answer', {
      fromSocketId: socket.id,
      answer,
    });
  });

  // Étape 3 : les deux s'échangent des "candidats ICE" = chemins réseau possibles
  // (adresses IP/ports) pour trouver comment se joindre à travers les routeurs (NAT).
  socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('ice-candidate', {
      fromSocketId: socket.id,
      candidate,
    });
  });

  socket.on('end-video-session', (courseId) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    courseId = String(courseId);
    io.to(`video-${courseId}`).emit('video-session-ended', { courseId });
    if (courseRooms[courseId]) delete courseRooms[courseId];
    delete liveCourses[courseId];
    delete courseParticipants[courseId];
    io.emit('live-courses-update', liveCourses);
  });

  // ─── CONTRÔLE DU MICRO ──────────────────────────────────────────────

  // Étudiant lève la main
  socket.on('raise-hand', ({ courseId, professorSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user) return;
    io.to(professorSocketId).emit('hand-raised', {
      studentSocketId: socket.id,
      username: user.username,
    });
  });

  // Étudiant baisse la main
  socket.on('lower-hand', ({ professorSocketId }) => {
    io.to(professorSocketId).emit('hand-lowered', { studentSocketId: socket.id });
  });

  // Prof accepte la prise de parole
  socket.on('accept-mic', ({ studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    io.to(studentSocketId).emit('mic-accepted');
  });

  // Prof refuse la prise de parole
  socket.on('reject-mic', ({ studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    io.to(studentSocketId).emit('mic-rejected');
  });

  // Prof coupe le micro d'un étudiant
  socket.on('force-mute-student', ({ studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    io.to(studentSocketId).emit('force-muted');
  });

  // Prof active le micro d'un étudiant directement
  socket.on('force-unmute-student', ({ studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    io.to(studentSocketId).emit('force-unmuted');
  });

  // Prof expulse un étudiant de la session vidéo
  socket.on('kick-from-video', ({ courseId, studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    courseId = String(courseId);
    // Notifie l'étudiant expulsé
    io.to(studentSocketId).emit('kicked-from-video');
    // Retire l'étudiant de la salle et informe les autres
    const target = io.sockets.sockets.get(studentSocketId);
    if (target) target.leave(`video-${courseId}`);
    if (courseRooms[courseId]) courseRooms[courseId].delete(studentSocketId);
    if (courseParticipants[courseId]) {
      delete courseParticipants[courseId][studentSocketId];
      const parts = Object.entries(courseParticipants[courseId]).map(([sid, u]) => ({ socketId: sid, username: u.username, role: u.role }));
      io.to(`video-${courseId}`).emit('participants-update', parts);
    }
    io.to(`video-${courseId}`).emit('peer-left', { socketId: studentSocketId });
  });

  // Étudiant informe le prof de l'état de son micro
  socket.on('mic-state', ({ courseId, muted }) => {
    const user = connectedUsers[socket.id];
    if (!user) return;
    const live = liveCourses[String(courseId)];
    if (live) {
      io.to(live.professorSocketId).emit('student-mic-state', {
        studentSocketId: socket.id,
        muted,
      });
    }
  });

  // ─── PARTAGE D'ÉCRAN ────────────────────────────────────────────────
  socket.on('screen-share-started', ({ courseId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    // Notifie tous les étudiants de la salle vidéo
    socket.to(`video-${courseId}`).emit('screen-share-started', {
      professorSocketId: socket.id,
    });
  });

  socket.on('screen-share-stopped', ({ courseId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    socket.to(`video-${courseId}`).emit('screen-share-stopped', {
      professorSocketId: socket.id,
    });
  });

  socket.on('leave-video-session', ({ courseId }) => {
    courseId = String(courseId);
    socket.leave(`video-${courseId}`);
    if (courseRooms[courseId]) courseRooms[courseId].delete(socket.id);
    if (courseParticipants[courseId]) {
      delete courseParticipants[courseId][socket.id];
      const parts = Object.entries(courseParticipants[courseId]).map(([sid, u]) => ({ socketId: sid, username: u.username, role: u.role }));
      io.to(`video-${courseId}`).emit('participants-update', parts);
    }
    socket.to(`video-${courseId}`).emit('peer-left', { socketId: socket.id });
  });

  // ─── DÉCONNEXION ────────────────────────────────────────────────────
  // Met à jour les listes "en ligne" des chats que ce socket quitte
  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms];
    setTimeout(() => {
      rooms.forEach((room) => {
        // room "global-<filiere>" → met à jour les en ligne de cette filière
        if (room.startsWith('global-')) emitGlobalOnline(room.slice(7));
        else if (room.startsWith('group-')) emitGroupOnline(room.slice(6));
      });
    }, 60);
  });

  socket.on('disconnect', () => {
    const user = connectedUsers[socket.id];
    if (user?.courseId) {
      socket.to(`video-${user.courseId}`).emit('peer-left', { socketId: socket.id });
      if (courseRooms[user.courseId]) courseRooms[user.courseId].delete(socket.id);
    }
    // Retirer des participants de toutes les salles
    for (const [courseId, parts] of Object.entries(courseParticipants)) {
      if (parts[socket.id]) {
        delete parts[socket.id];
        const list = Object.entries(parts).map(([sid, u]) => ({ socketId: sid, username: u.username, role: u.role }));
        io.to(`video-${courseId}`).emit('participants-update', list);
        break;
      }
    }
    // Si le prof déconnecté avait une session live → la supprimer
    for (const [courseId, info] of Object.entries(liveCourses)) {
      if (info.professorSocketId === socket.id) {
        delete liveCourses[courseId];
        if (courseRooms[courseId]) delete courseRooms[courseId];
        delete courseParticipants[courseId];
        io.emit('live-courses-update', liveCourses);
        break;
      }
    }
    delete connectedUsers[socket.id];
    console.log('Déconnexion socket:', socket.id);
  });
});

const PORT = process.env.PORT || 3003;

function startServer() {
  server.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(` Port ${PORT} déjà utilisé — libération en cours...`);
    const { execSync } = require('child_process');
    try {
      const output = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`).toString();
      const pid = output.trim().split(/\s+/).pop();
      if (pid && pid !== '0') {
        execSync(`taskkill /F /PID ${pid}`);
        console.log(`Ancien processus (PID ${pid}) tué. Redémarrage...`);
        // Crée un nouveau serveur car l'ancien est en état d'erreur
        const newServer = http.createServer(app);
        newServer.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));
        // Transfère les listeners socket.io sur le nouveau serveur
        io.attach(newServer);
      }
    } catch (e) {
      console.error('Impossible de libérer le port:', e.message);
      process.exit(1);
    }
  } else {
    throw err;
  }
});

// ── Nettoyage automatique des comptes non vérifiés (toutes les heures) ──
setInterval(async () => {
  try {
    const db = await getDb();
    const result = await db.run(
      `DELETE FROM users WHERE email_verified = 0
       AND created_at < (NOW() - INTERVAL 24 HOUR)`
    );
    if (result.changes > 0)
      console.log(`${result.changes} compte(s) non vérifié(s) supprimé(s)`);
  } catch (err) {
    console.error('Erreur nettoyage comptes:', err.message);
  }
}, 60 * 60 * 1000); // toutes les heures

startServer();