require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db');

const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const announcementsRoutes = require('./routes/announcements');
const filesRoutes = require('./routes/files');
const demandesRoutes    = require('./routes/demandes');
const groupsRoutes      = require('./routes/groups');
const submissionsRoutes = require('./routes/submissions');
const { sendLiveSessionEmail } = require('./email');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/demandes',     demandesRoutes);
app.use('/api/groups',      groupsRoutes);
app.use('/api/submissions', submissionsRoutes);

// Sert le build React en production
const buildPath = path.join(__dirname, '../front/build');
app.use(express.static(buildPath));
// Toutes les autres routes → React Router
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

const JWT_SECRET = process.env.JWT_SECRET || 'univ_secret_key_2024';

// socketId -> { userId, username, role, courseId }
const connectedUsers = {};
// courseId -> Set of socketIds (participants in video session)
const courseRooms = {};
// courseId -> { professorSocketId, professorName, startedAt }
const liveCourses = {};
// courseId -> { socketId: username }
const courseParticipants = {};

const getRoomKey = (courseId) => `course-${courseId}`;

io.on('connection', (socket) => {
  console.log('Nouvelle connexion socket:', socket.id);

  // Authentification socket via token JWT
  socket.on('authenticate', (token) => {
    try {
      const user = jwt.verify(token, JWT_SECRET);
      connectedUsers[socket.id] = { userId: user.id, username: user.username, role: user.role };
      socket.emit('authenticated', { success: true });
    } catch {
      socket.emit('authenticated', { success: false, error: 'Token invalide.' });
    }
  });

  // ─── CHAT GLOBAL ───────────────────────────────────────────────────
  socket.on('join-global-chat', () => {
    socket.join('global-chat');
  });

  socket.on('leave-global-chat', () => {
    socket.leave('global-chat');
  });

  socket.on('send-global-message', ({ content }) => {
    const user = connectedUsers[socket.id];
    if (!user || !content?.trim()) return;
    const message = {
      sender_id: user.userId,
      sender_name: user.username,
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    io.to('global-chat').emit('global-message', message);
  });

  // ─── CHAT GROUPES ───────────────────────────────────────────────────
  socket.on('join-group-chat', (groupId) => {
    socket.join(`group-${groupId}`);
  });

  socket.on('leave-group-chat', (groupId) => {
    socket.leave(`group-${groupId}`);
  });

  socket.on('send-group-message', ({ groupId, content }) => {
    const user = connectedUsers[socket.id];
    if (!user || !content?.trim()) return;
    const message = {
      groupId,
      sender_id: user.userId,
      sender_name: user.username,
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    io.to(`group-${groupId}`).emit('group-message', message);
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
        console.log(`📧 Cours "${course.title}" sans filière → aucun email envoyé.`);
        return;
      }

      const students = await db.all(
        'SELECT username, email FROM users WHERE role = ? AND filiere = ? AND email_verified = 1',
        ['student', filiere]
      );

      if (students.length === 0) {
        console.log(`📧 Aucun étudiant vérifié pour la filière "${filiere}"`);
        return;
      }

      console.log(`📧 Envoi de ${students.length} email(s) pour "${course.title}" → ${filiere}`);
      students.forEach(({ username, email }) => {
        sendLiveSessionEmail(email, username, course.title, user.username, courseId)
          .then(() => console.log(`  ✅ Email → ${email}`))
          .catch((err) => console.error(`  ❌ Échec ${email}:`, err.message));
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

  // Offre WebRTC du professeur vers l'étudiant
  socket.on('webrtc-offer', ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit('webrtc-offer', {
      fromSocketId: socket.id,
      offer,
    });
  });

  // Réponse WebRTC de l'étudiant vers le professeur
  socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('webrtc-answer', {
      fromSocketId: socket.id,
      answer,
    });
  });

  // Échange de candidats ICE
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
  server.listen(PORT, () => console.log(`✅ Serveur démarré sur http://localhost:${PORT}`));
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️  Port ${PORT} déjà utilisé — libération en cours...`);
    const { execSync } = require('child_process');
    try {
      const output = execSync(`netstat -ano | findstr :${PORT} | findstr LISTENING`).toString();
      const pid = output.trim().split(/\s+/).pop();
      if (pid && pid !== '0') {
        execSync(`taskkill /F /PID ${pid}`);
        console.log(`🔪 Ancien processus (PID ${pid}) tué. Redémarrage...`);
        // Crée un nouveau serveur car l'ancien est en état d'erreur
        const newServer = http.createServer(app);
        newServer.listen(PORT, () => console.log(`✅ Serveur démarré sur http://localhost:${PORT}`));
        // Transfère les listeners socket.io sur le nouveau serveur
        io.attach(newServer);
      }
    } catch (e) {
      console.error('❌ Impossible de libérer le port:', e.message);
      process.exit(1);
    }
  } else {
    throw err;
  }
});

startServer();
