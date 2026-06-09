
import io from 'socket.io-client';

let socket = null;

export const connectWithSocketIOServer = (token) => {
  if (socket) socket.disconnect(); 
  const serverUrl = process.env.NODE_ENV === 'production'
    ? window.location.origin
    : 'http://localhost:3003';
  socket = io(serverUrl);

  socket.on('connect', () => {
    console.log('Socket connecté:', socket.id);
    if (token) socket.emit('authenticate', token);
  });
};

export const getSocket = () => socket;

let chatMessageCallback = null;

export const joinCourseChat = (courseId, onMessage) => {
  chatMessageCallback = onMessage;
  socket.emit('join-course-chat', courseId);
  socket.on('new-message', onMessage);
};

export const leaveCourseChat = (courseId) => {
  socket.emit('leave-course-chat', courseId);
  if (chatMessageCallback) {
    socket.off('new-message', chatMessageCallback);
    chatMessageCallback = null;
  }
};

export const sendMessage = (courseId, content) => {
  socket.emit('send-message', { courseId, content });
};

export const startVideoSession = (courseId) => {
  socket.emit('start-video-session', courseId);
};

export const endVideoSession = (courseId) => {
  socket.emit('end-video-session', courseId);
};

export const joinVideoSession = (courseId, professorSocketId) => {
  socket.emit('join-video-session', { courseId, professorSocketId });
};

export const leaveVideoSession = (courseId) => {
  socket.emit('leave-video-session', { courseId });
};

export const sendWebRTCOffer = (targetSocketId, offer) => {
  socket.emit('webrtc-offer', { targetSocketId, offer });
};

export const sendWebRTCAnswer = (targetSocketId, answer) => {
  socket.emit('webrtc-answer', { targetSocketId, answer });
};

export const sendIceCandidate = (targetSocketId, candidate) => {
  socket.emit('ice-candidate', { targetSocketId, candidate });
};

export const onVideoSessionStarted = (cb) => {
  socket.on('video-session-started', cb);
  return () => socket.off('video-session-started', cb);
};

export const onVideoSessionEnded = (cb) => {
  socket.on('video-session-ended', cb);
  return () => socket.off('video-session-ended', cb);
};

export const onStudentWantsToJoin = (cb) => {
  socket.on('student-wants-to-join', cb);
  return () => socket.off('student-wants-to-join', cb);
};

export const onWebRTCOffer = (cb) => {
  socket.on('webrtc-offer', cb);
  return () => socket.off('webrtc-offer', cb);
};

export const onWebRTCAnswer = (cb) => {
  socket.on('webrtc-answer', cb);
  return () => socket.off('webrtc-answer', cb);
};

export const onIceCandidate = (cb) => {
  socket.on('ice-candidate', cb);
  return () => socket.off('ice-candidate', cb);
};

export const onPeerLeft = (cb) => {
  socket.on('peer-left', cb);
  return () => socket.off('peer-left', cb);
};

export const onExistingPeers = (cb) => {
  socket.on('existing-peers', cb);
  return () => socket.off('existing-peers', cb);
};
 
export const grantFloor = (courseId, studentSocketId) => {
  socket.emit('grant-floor', { courseId, studentSocketId });
};
export const removeFloor = (courseId, studentSocketId) => {
  socket.emit('remove-floor', { courseId, studentSocketId });
}; 
export const onFloorGranted = (cb) => {
  socket.on('floor-granted', cb);
  return () => socket.off('floor-granted', cb);
};
export const onFloorRemoved = (cb) => {
  socket.on('floor-removed', cb);
  return () => socket.off('floor-removed', cb);
}; 
export const onFloorUpdate = (cb) => {
  socket.on('floor-update', cb);
  return () => socket.off('floor-update', cb);
};

export const requestJoinVideo = (courseId, professorSocketId) => {
  socket.emit('request-join-video', { courseId, professorSocketId });
};

export const acceptStudent = (courseId, studentSocketId) => {
  socket.emit('accept-student', { courseId, studentSocketId });
};

export const rejectStudent = (studentSocketId) => {
  socket.emit('reject-student', { studentSocketId });
};

export const onStudentJoinRequest = (cb) => {
  socket.on('student-join-request', cb);
  return () => socket.off('student-join-request', cb);
};

export const onJoinRequestAccepted = (cb) => {
  socket.on('join-request-accepted', cb);
  return () => socket.off('join-request-accepted', cb);
};

export const onJoinRequestRejected = (cb) => {
  socket.on('join-request-rejected', cb);
  return () => socket.off('join-request-rejected', cb);
};

export const onParticipantsUpdate = (cb) => {
  socket.on('participants-update', cb);
  return () => socket.off('participants-update', cb);
};
 

export const raiseHand = (courseId, professorSocketId) => {
  socket.emit('raise-hand', { courseId, professorSocketId });
};

export const lowerHand = (professorSocketId) => {
  socket.emit('lower-hand', { professorSocketId });
};

export const acceptMic = (studentSocketId) => {
  socket.emit('accept-mic', { studentSocketId });
};

export const rejectMic = (studentSocketId) => {
  socket.emit('reject-mic', { studentSocketId });
};

export const forceMuteStudent = (studentSocketId) => {
  socket.emit('force-mute-student', { studentSocketId });
};

export const forceUnmuteStudent = (studentSocketId) => {
  socket.emit('force-unmute-student', { studentSocketId });
};

export const kickFromVideo = (courseId, studentSocketId) => {
  socket.emit('kick-from-video', { courseId, studentSocketId });
};

export const onKickedFromVideo = (cb) => {
  socket.on('kicked-from-video', cb);
  return () => socket.off('kicked-from-video', cb);
};

export const emitMicState = (courseId, muted) => {
  socket.emit('mic-state', { courseId, muted });
};

export const onHandRaised = (cb) => {
  socket.on('hand-raised', cb);
  return () => socket.off('hand-raised', cb);
};

export const onHandLowered = (cb) => {
  socket.on('hand-lowered', cb);
  return () => socket.off('hand-lowered', cb);
};

export const onMicAccepted = (cb) => {
  socket.on('mic-accepted', cb);
  return () => socket.off('mic-accepted', cb);
};

export const onMicRejected = (cb) => {
  socket.on('mic-rejected', cb);
  return () => socket.off('mic-rejected', cb);
};

export const onForceMuted = (cb) => {
  socket.on('force-muted', cb);
  return () => socket.off('force-muted', cb);
};

export const onForceUnmuted = (cb) => {
  socket.on('force-unmuted', cb);
  return () => socket.off('force-unmuted', cb);
};

export const onStudentMicState = (cb) => {
  socket.on('student-mic-state', cb);
  return () => socket.off('student-mic-state', cb);
};

export const emitScreenShareStarted = (courseId) => {
  socket.emit('screen-share-started', { courseId });
};

export const emitScreenShareStopped = (courseId) => {
  socket.emit('screen-share-stopped', { courseId });
};

export const onScreenShareStarted = (cb) => {
  socket.on('screen-share-started', cb);
  return () => socket.off('screen-share-started', cb);
};

export const onScreenShareStopped = (cb) => {
  socket.on('screen-share-stopped', cb);
  return () => socket.off('screen-share-stopped', cb);
};
