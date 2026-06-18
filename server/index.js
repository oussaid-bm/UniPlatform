
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
const chatRoutes        = require('./routes/chat');
const { sendLiveSessionEmail } = require('./email');
const livekit = require('./livekit');


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
app.use('/api/chat',       chatRoutes);

const { verifyToken } = require('./middleware/auth');
app.get('/api/global-chat/history', verifyToken, async (req, res) => {
  try {
    const db = await getDb();
    const messages = await db.all(
      'SELECT * FROM global_messages WHERE filiere = ? ORDER BY created_at ASC LIMIT 100',
      [req.user.filiere || '']
    );
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

const buildPath = path.join(__dirname, '../front/build');
app.use(express.static(buildPath));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

const JWT_SECRET = process.env.JWT_SECRET || 'univ_secret_key_2024';

const connectedUsers = {};
const courseRooms = {};
const liveCourses = {};
const courseParticipants = {};
const courseFloor = {}; 

const getRoomKey = (courseId) => `course-${courseId}`;

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
const globalRoom = (filiere) => `global-${filiere || ''}`;
const emitGlobalOnline = (filiere) => {
  const room = globalRoom(filiere);
  io.to(room).emit('global-online', getOnlineInRoom(room));
};
const emitGroupOnline = (groupId) =>
  io.to(`group-${groupId}`).emit('group-online', { groupId, users: getOnlineInRoom(`group-${groupId}`) });

io.on('connection', (socket) => {
  console.log('Nouvelle connexion socket:', socket.id);

  socket.on('authenticate', (token) => {
    try {
      const user = jwt.verify(token, JWT_SECRET);
      connectedUsers[socket.id] = { userId: user.id, username: user.username, role: user.role, filiere: user.filiere || '' };
      socket.emit('authenticated', { success: true });
    } catch {
      socket.emit('authenticated', { success: false, error: 'Token invalide.' });
    }
  });

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
      io.to(globalRoom(user.filiere)).emit('global-message', message);
    } catch (err) {
      console.error('Erreur sauvegarde message global:', err.message);
    }
  });

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

  socket.on('broadcast-group-file', ({ groupId, message }) => {
    io.to(`group-${groupId}`).emit('group-message', { ...message, groupId, group_id: groupId });
  });
  socket.on('broadcast-global-file', ({ message }) => {
    const user = connectedUsers[socket.id];
    io.to(globalRoom(user?.filiere)).emit('global-message', message);
  });

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

  socket.on('get-live-courses', () => {
    socket.emit('live-courses-update', liveCourses);
  });

  socket.on('start-video-session', async (courseId) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    courseId = String(courseId);

    // Room LiveKit (SFU) pour ce cours. LiveKit crée la room automatiquement
    // au premier participant : pas besoin de la créer à l'avance.
    const livekitRoom = `course-${courseId}`;
    if (!livekit.isConfigured()) {
      console.error('LiveKit non configuré (.env : LIVEKIT_URL/API_KEY/API_SECRET)');
      socket.emit('video-session-error', { error: 'Serveur vidéo non configuré' });
      return;
    }

    if (!courseRooms[courseId]) courseRooms[courseId] = new Set();
    courseRooms[courseId].add(socket.id);
    socket.join(`video-${courseId}`);
    liveCourses[courseId] = {
      professorSocketId: socket.id,
      professorName: user.username,
      startedAt: new Date().toISOString(),
      livekitRoom,
    };
    courseParticipants[courseId] = { [socket.id]: { username: user.username, role: user.role } };
    io.emit('live-courses-update', liveCourses);
    io.to(getRoomKey(courseId)).emit('video-session-started', {
      courseId,
      professorSocketId: socket.id,
    });
    io.to(`video-${courseId}`).emit('participants-update', [{ socketId: socket.id, username: user.username, role: 'professor' }]);

    // Jeton LiveKit du professeur (identité = son socket.id)
    try {
      const token = await livekit.createToken(livekitRoom, socket.id, user.username);
      io.to(socket.id).emit('livekit-info', { url: livekit.LIVEKIT_URL, token, room: livekitRoom });
    } catch (err) {
      console.error('Erreur génération jeton LiveKit (prof):', err.message);
    }

    try {
      const db = await getDb();
      const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
      if (!course) return;

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

  socket.on('request-join-video', ({ courseId, professorSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user) return;
    io.to(professorSocketId).emit('student-join-request', {
      studentSocketId: socket.id,
      username: user.username,
    });
  });

  socket.on('accept-student', ({ courseId, studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    courseId = String(courseId);
    io.to(studentSocketId).emit('join-request-accepted', { professorSocketId: socket.id });
  });

  socket.on('reject-student', ({ studentSocketId }) => {
    io.to(studentSocketId).emit('join-request-rejected');
  });

  socket.on('join-video-session', async ({ courseId }) => {
    const user = connectedUsers[socket.id];
    if (!user) return;
    courseId = String(courseId);
    if (!courseRooms[courseId]) courseRooms[courseId] = new Set();

    courseRooms[courseId].add(socket.id);
    socket.join(`video-${courseId}`);
    if (!courseParticipants[courseId]) courseParticipants[courseId] = {};
    courseParticipants[courseId][socket.id] = { username: user.username, role: user.role };

    const parts = Object.entries(courseParticipants[courseId]).map(([sid, u]) => ({ socketId: sid, username: u.username, role: u.role }));
    io.to(`video-${courseId}`).emit('participants-update', parts);

    // Jeton LiveKit du client qui rejoint (identité = son socket.id)
    const live = liveCourses[courseId];
    if (live && live.livekitRoom) {
      try {
        const token = await livekit.createToken(live.livekitRoom, socket.id, user.username);
        io.to(socket.id).emit('livekit-info', { url: livekit.LIVEKIT_URL, token, room: live.livekitRoom });
      } catch (err) {
        console.error('Erreur génération jeton LiveKit (étudiant):', err.message);
      }
    }
  });

  socket.on('grant-floor', ({ courseId, studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    courseId = String(courseId);

    const previous = courseFloor[courseId];
    if (previous && previous !== studentSocketId) {
      io.to(previous).emit('floor-removed');                      
      io.to(`video-${courseId}`).emit('floor-update', { socketId: previous, granted: false });
    }

    courseFloor[courseId] = studentSocketId;
    io.to(studentSocketId).emit('floor-granted');                 
    io.to(`video-${courseId}`).emit('floor-update', { socketId: studentSocketId, granted: true }); 
  });
 
  socket.on('remove-floor', ({ courseId, studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    courseId = String(courseId);
    if (courseFloor[courseId] === studentSocketId) delete courseFloor[courseId];
    io.to(studentSocketId).emit('floor-removed');                  
    io.to(`video-${courseId}`).emit('floor-update', { socketId: studentSocketId, granted: false });
  });

 
  // La signalisation WebRTC (offer/answer/ICE) est gérée par le SFU LiveKit
  // directement entre les clients et le serveur LiveKit — aucun relais ici.

  socket.on('end-video-session', async (courseId) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    courseId = String(courseId);

    // LiveKit ferme automatiquement la room quand elle se vide : rien à détruire.
    io.to(`video-${courseId}`).emit('video-session-ended', { courseId });
    if (courseRooms[courseId]) delete courseRooms[courseId];
    delete liveCourses[courseId];
    delete courseParticipants[courseId];
    delete courseFloor[courseId];
    io.emit('live-courses-update', liveCourses);
  });

  socket.on('raise-hand', ({ courseId, professorSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user) return;
    io.to(professorSocketId).emit('hand-raised', {
      studentSocketId: socket.id,
      username: user.username,
    });
  });

  socket.on('lower-hand', ({ professorSocketId }) => {
    io.to(professorSocketId).emit('hand-lowered', { studentSocketId: socket.id });
  });

  socket.on('accept-mic', ({ studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    io.to(studentSocketId).emit('mic-accepted');
  });

  socket.on('reject-mic', ({ studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    io.to(studentSocketId).emit('mic-rejected');
  });

  socket.on('force-mute-student', ({ studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    io.to(studentSocketId).emit('force-muted');
  });

  socket.on('force-unmute-student', ({ studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    io.to(studentSocketId).emit('force-unmuted');
  });

  socket.on('kick-from-video', ({ courseId, studentSocketId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
    courseId = String(courseId);
    io.to(studentSocketId).emit('kicked-from-video');
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

  socket.on('screen-share-started', ({ courseId }) => {
    const user = connectedUsers[socket.id];
    if (!user || user.role !== 'professor') return;
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

  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms];
    setTimeout(() => {
      rooms.forEach((room) => {
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
    for (const [courseId, parts] of Object.entries(courseParticipants)) {
      if (parts[socket.id]) {
        delete parts[socket.id];
        const list = Object.entries(parts).map(([sid, u]) => ({ socketId: sid, username: u.username, role: u.role }));
        io.to(`video-${courseId}`).emit('participants-update', list);
        break;
      }
    }
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
        const newServer = http.createServer(app);
        newServer.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));
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

setInterval(async () => {
  try {
    const db = await getDb();
    const result = await db.run(
      `DELETE FROM users WHERE email_verified = 0
       AND created_at < (NOW() - INTERVAL 30 MINUTE)`
    );
    if (result.changes > 0)
      console.log(`${result.changes} compte(s) non vérifié(s) supprimé(s)`);
  } catch (err) {
    console.error('Erreur nettoyage comptes:', err.message);
  }
}, 5 * 60 * 1000); 

startServer();