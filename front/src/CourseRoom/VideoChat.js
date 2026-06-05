// ─────────────────────────────────────────────────────────────────────────────
//  VIDEOCHAT — le cœur technique de la visioconférence (WebRTC, côté client)
//  Gère : l'accès caméra/micro (getUserMedia), les connexions pair-à-pair
//  (RTCPeerConnection), l'échange offre/réponse/ICE via Socket.io, le partage
//  d'écran, le contrôle du micro (main levée) et l'affichage des flux vidéo.
//  RAPPEL : la vidéo circule en DIRECT entre navigateurs, pas par le serveur.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  onStudentWantsToJoin, onWebRTCOffer, onWebRTCAnswer,
  onIceCandidate, onPeerLeft,
  sendWebRTCOffer, sendWebRTCAnswer, sendIceCandidate,
  emitScreenShareStarted, emitScreenShareStopped,
  onScreenShareStarted, onScreenShareStopped,
  raiseHand, lowerHand,
  acceptMic, rejectMic,
  emitMicState,
  onHandRaised, onHandLowered,
  onMicAccepted, onMicRejected,
  onForceMuted, onForceUnmuted,
  onStudentMicState, onKickedFromVideo,
} from '../socketConnection/socketConn';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const AVATAR_COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#0891B2', '#059669', '#D97706'];
const colorFor    = (n = '') => AVATAR_COLORS[(n || '').charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (n = '') => (n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

/* ── Icons ──────────────────────────────────────────────────────────── */
const MicOnIcon    = () => <svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const MicOffIcon   = () => <svg viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const CamOnIcon    = () => <svg viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
const CamOffIcon   = () => <svg viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06A2 2 0 0 1 10 15V9"/></svg>;
const PlayIcon     = () => <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const StopIcon     = () => <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>;
const JoinIcon     = () => <svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>;
const PhoneOffIcon = () => <svg viewBox="0 0 24 24"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.33 3.46a19.79 19.79 0 0 0-12.83 12.82M6.59 6.59A16 16 0 0 0 3.07 15"/></svg>;
const ScreenIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
const StopScreenIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const HandIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M6 14v-3"/><path d="M6 14a5 5 0 0 0 5 5h2a5 5 0 0 0 5-5v-3a2 2 0 0 0-4 0"/></svg>;

/* ── Composant principal ─────────────────────────────────────────────── */
const VideoChat = ({
  courseId, videoSessionActive, inVideoSession, isProfessor,
  joinStatus, participants, professorSocketId,
  onStartSession, onEndSession, onLeaveVideo, onRetryJoin, onBack,
}) => {
  const { user } = useSelector(s => s.auth);

  const localStreamRef  = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef   = useRef(null);
  const peersRef        = useRef({});
  const iceQueues       = useRef({});
  const mediaPromiseRef = useRef(null); // empêche les getUserMedia concurrents

  const [remoteStreams,    setRemoteStreams]    = useState({});
  const [localStream,     setLocalStream]      = useState(null);
  const [micMuted,        setMicMuted]         = useState(true);   // étudiants démarrent muets
  const [micLocked,       setMicLocked]        = useState(true);   // vrai = pas le droit d'activer
  const [camOff,          setCamOff]           = useState(false);
  const [isSharing,       setIsSharing]        = useState(false);
  const [mediaError,      setMediaError]       = useState('');
  const [screenShareVer,  setScreenShareVer]   = useState(0);

  // ── État main levée (étudiant) ─────────────────────────────────────
  const [handRaised,   setHandRaised]   = useState(false); // main levée en attente
  const [handStatus,   setHandStatus]   = useState('idle'); // idle | pending | approved | rejected

  // ── Contrôles prof ────────────────────────────────────────────────
  const [handRequests,     setHandRequests]     = useState([]); // [{studentSocketId, username}]
  const [studentMicStates, setStudentMicStates] = useState({}); // {socketId: muted bool}

  /* ── helpers ─────────────────────────────────────────────────────── */
  const usernameFor = sid => {
    const p = (participants || []).find(p => p.socketId === sid);
    if (p) return `${p.username}${p.role === 'professor' ? '‍' : ''}`;
    if (sid === professorSocketId) return 'Professeur‍';
    return sid.slice(0, 8);
  };

  const addRemoteStream = useCallback((sid, stream) => {
    setRemoteStreams(prev => ({ ...prev, [sid]: stream }));
  }, []);

  const removeRemoteStream = useCallback((sid) => {
    setRemoteStreams(prev => { const n = { ...prev }; delete n[sid]; return n; });
    if (peersRef.current[sid]) { peersRef.current[sid].close(); delete peersRef.current[sid]; }
    delete iceQueues.current[sid];
  }, []);

  /* ── accès caméra/micro ─────────────────────────────────────────── */
  const getLocalMedia = async (startMuted = false) => {
    // Si un getUserMedia est déjà en cours → on attend le même résultat (évite 2 streams)
    if (mediaPromiseRef.current) return await mediaPromiseRef.current;
    // Si la caméra est déjà ouverte → on la réutilise
    if (localStreamRef.current) return localStreamRef.current;

    const acquire = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // Étudiants démarrent avec le micro coupé
        if (startMuted) stream.getAudioTracks().forEach(t => { t.enabled = false; });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setMediaError('');
        return stream;
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          localStreamRef.current = stream;
          setLocalStream(stream);
          setMediaError('Micro non disponible.');
          return stream;
        } catch (err) {
          const msg = err.name === 'NotAllowedError'
            ? 'Caméra refusée. La caméra est OBLIGATOIRE pour rejoindre le cours.\nAutorisez-la dans les paramètres du navigateur puis rechargez.'
            : `Erreur caméra : ${err.message}`;
          setMediaError(msg);
          return null;
        }
      }
    };

    // Partage la promesse : tout appel concurrent attend le même getUserMedia
    const promise = acquire().finally(() => { mediaPromiseRef.current = null; });
    mediaPromiseRef.current = promise;
    return await promise;
  };

  /* ── attache stream au <video> ──────────────────────────────────── */
  useEffect(() => {
    if (localVideoRef.current) {
      if (isSharing && screenStreamRef.current) {
        localVideoRef.current.srcObject = screenStreamRef.current;
      } else if (localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  }, [localStream, camOff, isSharing, remoteStreams]);

  /* ── création RTCPeerConnection ─────────────────────────────────── */
  const createPeer = useCallback((targetId, stream) => {
    if (peersRef.current[targetId]) peersRef.current[targetId].close();
    iceQueues.current[targetId] = [];
    const pc = new RTCPeerConnection(ICE_SERVERS);
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = e => { if (e.candidate) sendIceCandidate(targetId, e.candidate); };
    pc.ontrack = e => { if (e.streams?.[0]) addRemoteStream(targetId, e.streams[0]); };
    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) removeRemoteStream(targetId);
    };
    peersRef.current[targetId] = pc;
    return pc;
  }, [addRemoteStream, removeRemoteStream]);

  const flushIceQueue = async (sid, pc) => {
    const q = iceQueues.current[sid] || [];
    iceQueues.current[sid] = [];
    for (const c of q) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
  };

  /* ── partage d'écran (prof uniquement) ─────────────────────────── */
  const startScreenShare = async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' }, audio: false,
      });
      screenStreamRef.current = screen;
      const screenTrack = screen.getVideoTracks()[0];

      await Promise.all(Object.values(peersRef.current).map(async pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
      }));

      emitScreenShareStarted(courseId);
      setIsSharing(true);
      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      if (err.name !== 'NotAllowedError') console.error('Erreur partage écran:', err);
    }
  };

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;

    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    if (camTrack) {
      Object.values(peersRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(camTrack).catch(() => {});
      });
    }

    emitScreenShareStopped(courseId);
    setIsSharing(false);
  }, [courseId]);

  /* ── main levée (étudiant) ──────────────────────────────────────── */
  const handleRaiseHand = () => {
    if (!professorSocketId) return;
    if (handRaised) {
      // Baisser la main
      lowerHand(professorSocketId);
      setHandRaised(false);
      setHandStatus('idle');
    } else {
      // Lever la main
      raiseHand(courseId, professorSocketId);
      setHandRaised(true);
      setHandStatus('pending');
    }
  };

  /* ── actions prof : micro ────────────────────────────────────────── */
  const handleAcceptMic = (studentSocketId) => {
    acceptMic(studentSocketId);
    setHandRequests(prev => prev.filter(r => r.studentSocketId !== studentSocketId));
    setStudentMicStates(prev => ({ ...prev, [studentSocketId]: false }));
  };

  const handleRejectMic = (studentSocketId) => {
    rejectMic(studentSocketId);
    setHandRequests(prev => prev.filter(r => r.studentSocketId !== studentSocketId));
  };


  /* ── signaling WebRTC ───────────────────────────────────────────── */
  useEffect(() => {
    // PROF : étudiant rejoint → envoyer une offre
    const unsubJoin = onStudentWantsToJoin(async ({ studentSocketId }) => {
      if (!isProfessor || !localStreamRef.current) return;
      try {
        const streamToSend = screenStreamRef.current
          ? new MediaStream([
              ...screenStreamRef.current.getVideoTracks(),
              ...(localStreamRef.current?.getAudioTracks() || []),
            ])
          : localStreamRef.current;
        const pc = createPeer(studentSocketId, streamToSend);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWebRTCOffer(studentSocketId, offer);
      } catch (e) { console.error('Erreur offre:', e); }
    });

    // ÉTUDIANT : reçoit l'offre du prof
    const unsubOffer = onWebRTCOffer(async ({ fromSocketId, offer }) => {
      if (isProfessor) return;
      try {
        const stream = localStreamRef.current || await getLocalMedia(true);
        if (!stream) return;
        const pc = createPeer(fromSocketId, stream);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIceQueue(fromSocketId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendWebRTCAnswer(fromSocketId, answer);
      } catch (e) { console.error('Erreur réponse:', e); }
    });

    // PROF : reçoit la réponse
    const unsubAnswer = onWebRTCAnswer(async ({ fromSocketId, answer }) => {
      const pc = peersRef.current[fromSocketId];
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIceQueue(fromSocketId, pc);
      } catch (e) { console.error('Erreur answer:', e); }
    });

    // ICE candidates avec buffer
    const unsubIce = onIceCandidate(async ({ fromSocketId, candidate }) => {
      const pc = peersRef.current[fromSocketId];
      if (!pc) return;
      if (!pc.remoteDescription) {
        if (!iceQueues.current[fromSocketId]) iceQueues.current[fromSocketId] = [];
        iceQueues.current[fromSocketId].push(candidate);
        return;
      }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });

    const unsubLeft = onPeerLeft(({ socketId }) => {
      removeRemoteStream(socketId);
      // Nettoyer les demandes de ce student si prof
      setHandRequests(prev => prev.filter(r => r.studentSocketId !== socketId));
      setStudentMicStates(prev => { const n = {...prev}; delete n[socketId]; return n; });
    });

    // Partage d'écran
    const unsubScreenStart = onScreenShareStarted(() => {
      if (isProfessor) return;
      setTimeout(() => setScreenShareVer(v => v + 1), 200);
    });
    const unsubScreenStop = onScreenShareStopped(() => {
      if (isProfessor) return;
      setTimeout(() => setScreenShareVer(v => v + 1), 200);
    });

    // ── MICRO : listeners selon le rôle ───────────────────────────
    let unsubHandRaised, unsubHandLowered, unsubMicAccepted,
        unsubMicRejected, unsubForceMuted, unsubForceUnmuted, unsubStudentMic;

    if (isProfessor) {
      // Prof reçoit les demandes de parole
      unsubHandRaised = onHandRaised(({ studentSocketId, username }) => {
        setHandRequests(prev => {
          if (prev.find(r => r.studentSocketId === studentSocketId)) return prev;
          return [...prev, { studentSocketId, username }];
        });
      });
      unsubHandLowered = onHandLowered(({ studentSocketId }) => {
        setHandRequests(prev => prev.filter(r => r.studentSocketId !== studentSocketId));
      });
      // Prof voit l'état micro de chaque étudiant
      unsubStudentMic = onStudentMicState(({ studentSocketId, muted }) => {
        setStudentMicStates(prev => ({ ...prev, [studentSocketId]: muted }));
      });
    } else {
      // Étudiant reçoit la réponse du prof
      unsubMicAccepted = onMicAccepted(() => {
        // Active la piste audio dans le stream ET dans tous les senders du peer connection
        const stream = localStreamRef.current;
        const t = stream?.getAudioTracks()[0];
        if (t) {
          t.enabled = true;
          // S'assurer que le sender envoie bien cette piste
          Object.values(peersRef.current).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (sender && sender.track !== t) {
              sender.replaceTrack(t).catch(() => {});
            } else if (sender) {
              sender.track.enabled = true;
            }
          });
        }
        setMicMuted(false);
        setMicLocked(false);
        setHandRaised(false);
        setHandStatus('approved');
        emitMicState(courseId, false);
        setTimeout(() => setHandStatus('idle'), 3000);
      });
      unsubMicRejected = onMicRejected(() => {
        setHandRaised(false);
        setHandStatus('rejected');
        setTimeout(() => setHandStatus('idle'), 3000);
      });
      // Prof force coupe le micro
      unsubForceMuted = onForceMuted(() => {
        const t = localStreamRef.current?.getAudioTracks()[0];
        if (t) t.enabled = false;
        setMicMuted(true);
        setMicLocked(true);
        setHandRaised(false);
        setHandStatus('idle');
        emitMicState(courseId, true);
      });
      // Prof active directement le micro
      unsubForceUnmuted = onForceUnmuted(() => {
        const stream = localStreamRef.current;
        const t = stream?.getAudioTracks()[0];
        if (t) {
          t.enabled = true;
          Object.values(peersRef.current).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
            if (sender && sender.track !== t) {
              sender.replaceTrack(t).catch(() => {});
            } else if (sender) {
              sender.track.enabled = true;
            }
          });
        }
        setMicMuted(false);
        setMicLocked(false);
        emitMicState(courseId, false);
      });
    }

    return () => {
      unsubJoin?.(); unsubOffer?.(); unsubAnswer?.();
      unsubIce?.(); unsubLeft?.();
      unsubScreenStart?.(); unsubScreenStop?.();
      unsubHandRaised?.(); unsubHandLowered?.();
      unsubMicAccepted?.(); unsubMicRejected?.();
      unsubForceMuted?.(); unsubForceUnmuted?.();
      unsubStudentMic?.();
    };
  }, [isProfessor, courseId, createPeer, addRemoteStream, removeRemoteStream]);

  // Démarre la caméra de l'étudiant quand accepté (micro verrouillé par défaut)
  useEffect(() => {
    if (!isProfessor && inVideoSession && !localStreamRef.current) {
      getLocalMedia(true).then(() => {
        setMicMuted(true);
        setMicLocked(true);
      });
    }
  }, [inVideoSession, isProfessor]);

  // Nettoyage
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, []);

  /* ── contrôles ──────────────────────────────────────────────────── */
  const toggleMic = () => {
    // Étudiant ne peut pas activer sans permission
    if (!isProfessor && micLocked && micMuted) return;
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (!t) return;
    const newMuted = !micMuted;
    t.enabled = !newMuted;
    setMicMuted(newMuted);
    // Si l'étudiant se coupe lui-même → il se reverrouille
    if (!isProfessor && newMuted) setMicLocked(true);
    if (!isProfessor) emitMicState(courseId, newMuted);
  };

  const toggleCam = () => {
    if (!isProfessor) return;
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamOff(c => !c); }
  };

  const handleStartSession = async () => {
    const stream = await getLocalMedia(false); // prof démarre avec micro actif
    if (!stream) return;
    // Force l'activation explicite de la piste audio
    stream.getAudioTracks().forEach(t => { t.enabled = true; });
    setMicMuted(false);
    setMicLocked(false);
    onStartSession();
  };

  const handleEndSession = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    setLocalStream(null); setIsSharing(false);
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {}; setRemoteStreams({});
    setHandRequests([]); setStudentMicStates({});
    onEndSession();
  };

  const handleLeaveVideo = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {}; setRemoteStreams({});
    onLeaveVideo();
  };

  // Étudiant expulsé : couper la caméra et fermer les connexions
  useEffect(() => {
    if (isProfessor) return;
    const unsub = onKickedFromVideo(() => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      Object.values(peersRef.current).forEach(pc => pc.close());
      peersRef.current = {}; setRemoteStreams({});
    });
    return () => unsub?.();
  }, [isProfessor]);

  /* ── vidéos distantes ─────────────────────────────────────────── */
  const remoteEntries = Object.entries(remoteStreams).filter(([sid]) => {
    if (isProfessor) return true;
    // Étudiant : affiche le prof par son socket ID
    // Si professorSocketId pas encore connu, affiche le premier stream disponible
    return professorSocketId ? sid === professorSocketId : true;
  });
  const hasVideo = localStream || remoteEntries.length > 0;

  /* ── bouton session ─────────────────────────────────────────────── */
  let sessionBtn = null;
  if (isProfessor) {
    sessionBtn = inVideoSession
      ? <button className="ctrl_session stop"  onClick={handleEndSession}><StopIcon /> Terminer</button>
      : <button className="ctrl_session start" onClick={handleStartSession}><PlayIcon /> Démarrer le cours</button>;
  } else if (inVideoSession) {
    sessionBtn = <button className="ctrl_session leave" onClick={handleLeaveVideo}><StopIcon /> Quitter</button>;
  }

  /* ── label main levée (étudiant) ────────────────────────────────── */
  const handLabel = handStatus === 'pending' ? '' : handStatus === 'approved' ? '' : handStatus === 'rejected' ? '' : '';

  /* ── JSX ────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Bandeau partage d'écran */}
      {isSharing && (
        <div className="screen_share_banner">
          Partage d'écran en cours —
          <button onClick={stopScreenShare}>Arrêter le partage</button>
        </div>
      )}

      {/* Notifications demandes de parole (prof) */}
      {isProfessor && handRequests.length > 0 && (
        <div className="hand_requests_banner">
          {handRequests.map(req => (
            <div key={req.studentSocketId} className="hand_request_item">
              <span><strong>{req.username}</strong> demande la parole</span>
              <div className="hand_request_actions">
                <button className="hand_btn accept" onClick={() => handleAcceptMic(req.studentSocketId)}>
                  Accepter
                </button>
                <button className="hand_btn reject" onClick={() => handleRejectMic(req.studentSocketId)}>
                  Refuser
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contenu vidéo + panneau participants */}
      <div className="video_content_row">
        <div className="video_area">
          {hasVideo ? (
            <div className="video_layout">
              <div className="video_main_area">
                {isProfessor ? (
                  localStream && (
                    <div className="video_tile_main local">
                      {isSharing ? (
                        <div className="video_tile_sharing">
                          <ScreenIcon />
                          <span>Partage d'écran actif</span>
                        </div>
                      ) : camOff ? (
                        <div className="video_tile_cam_off">
                          <div className="avatar" style={{ background: colorFor(user?.username) }}>
                            {getInitials(user?.username)}
                          </div>
                        </div>
                      ) : (
                        <video ref={localVideoRef} autoPlay muted playsInline />
                      )}
                      <div className="video_tile_label">
                        {user?.username} (vous)‍{micMuted ? '' : ''}
                      </div>
                    </div>
                  )
                ) : (() => {
                  // Priorité au socket ID du prof ; sinon premier stream disponible
                  const profEntry = remoteEntries.find(([sid]) => sid === professorSocketId)
                    || (remoteEntries.length > 0 ? remoteEntries[0] : null);
                  if (profEntry) {
                    const [sid, stream] = profEntry;
                    return (
                      <RemoteVideo
                        className="video_tile_main"
                        stream={stream}
                        label={usernameFor(sid)}
                        refreshKey={screenShareVer}
                        micMuted={false}
                      />
                    );
                  }
                  return localStream ? (
                    <div className="video_tile_main local">
                      {camOff ? (
                        <div className="video_tile_cam_off">
                          <div className="avatar" style={{ background: colorFor(user?.username) }}>
                            {getInitials(user?.username)}
                          </div>
                        </div>
                      ) : (
                        <video ref={localVideoRef} autoPlay muted playsInline />
                      )}
                      <div className="video_tile_label">
                        {user?.username} (vous) {micMuted ? '' : ''}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="video_strip">
                {isProfessor ? (
                  remoteEntries.map(([sid, stream]) => (
                    <RemoteVideo
                      key={sid}
                      className="video_tile_strip"
                      stream={stream}
                      label={usernameFor(sid)}
                      refreshKey={screenShareVer}
                      micMuted={studentMicStates[sid] !== false}
                    />
                  ))
                ) : (() => {
                  const hasProfStream = remoteEntries.some(([sid]) => sid === professorSocketId);
                  if (!hasProfStream || !localStream) return null;
                  return (
                    <div className="video_tile_strip local">
                      {camOff ? (
                        <div className="video_tile_cam_off">
                          <div className="avatar" style={{ background: colorFor(user?.username) }}>
                            {getInitials(user?.username)}
                          </div>
                        </div>
                      ) : (
                        <video ref={localVideoRef} autoPlay muted playsInline />
                      )}
                      <div className="video_tile_label">
                        {user?.username} {micMuted ? '' : ''}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="video_banner">
              <div className="video_banner_icon"><CamOnIcon /></div>
              {mediaError ? (
                <p style={{ color: '#F87171', maxWidth: 340, textAlign: 'center', whiteSpace: 'pre-line' }}>{mediaError}</p>
              ) : isProfessor ? (
                <p>Cliquez sur <strong>Démarrer le cours</strong> pour activer la vidéo.</p>
              ) : joinStatus === 'pending' ? (
                <p style={{ color: '#FCD34D' }}>En attente d'approbation du professeur...</p>
              ) : joinStatus === 'rejected' ? (
                <>
                  <p style={{ color: '#F87171' }}>Demande refusée par le professeur.</p>
                  <button className="ctrl_session join" style={{ marginTop: 14 }} onClick={onRetryJoin}>
                    <JoinIcon /> Redemander
                  </button>
                </>
              ) : videoSessionActive ? (
                <p style={{ color: '#34D399' }}>Connexion en cours...</p>
              ) : (
                <p>En attente que le professeur démarre...</p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Barre de contrôle */}
      <div className="video_controls">
        {/* Micro */}
        <button
          className={`ctrl_circle ${micMuted ? 'mic_off' : 'mic_on'} ${!isProfessor && micLocked && micMuted ? 'mic_locked' : ''}`}
          onClick={toggleMic}
          disabled={!localStream}
          title={
            !isProfessor && micLocked && micMuted
              ? 'Levez la main pour demander la parole'
              : micMuted ? 'Activer le micro' : 'Couper le micro'
          }
        >
          {micMuted ? <MicOffIcon /> : <MicOnIcon />}
          {!isProfessor && micLocked && micMuted && <span className="lock_badge"></span>}
        </button>

        {/* Main levée — étudiant uniquement, quand en session */}
        {!isProfessor && inVideoSession && (
          <button
            className={`ctrl_circle hand_btn_ctrl ${handStatus}`}
            onClick={handleRaiseHand}
            disabled={!localStream || handStatus === 'approved'}
            title={
              handRaised
                ? 'Baisser la main'
                : handStatus === 'approved'
                ? 'Micro autorisé'
                : 'Demander la parole'
            }
          >
            <HandIcon />
            {handStatus !== 'idle' && <span className="hand_status_badge">{handLabel}</span>}
          </button>
        )}

        {/* Caméra — prof uniquement */}
        {isProfessor && (
          <button
            className={`ctrl_circle ${camOff ? 'cam_off' : 'cam_on'}`}
            onClick={toggleCam} disabled={!localStream || isSharing}
            title={camOff ? 'Activer la caméra' : 'Couper la caméra'}
          >
            {camOff ? <CamOffIcon /> : <CamOnIcon />}
          </button>
        )}

        {/* Partage d'écran — prof uniquement */}
        {isProfessor && inVideoSession && (
          <button
            className={`ctrl_circle ${isSharing ? 'screen_active' : 'screen_idle'}`}
            onClick={isSharing ? stopScreenShare : startScreenShare}
            disabled={!localStream}
            title={isSharing ? 'Arrêter le partage' : "Partager l'écran"}
          >
            {isSharing ? <StopScreenIcon /> : <ScreenIcon />}
          </button>
        )}


        {sessionBtn && (
          <>
            <div className="ctrl_divider" />
            {sessionBtn}
          </>
        )}

        <div className="ctrl_divider" />
        <button className="ctrl_endcall" onClick={onBack} title="Quitter la salle">
          <PhoneOffIcon />
        </button>
      </div>
    </>
  );
};

/* ── Vidéo distante ──────────────────────────────────────────────────── */
const RemoteVideo = ({ stream, label, refreshKey, micMuted, className = 'video_tile' }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !stream) return;
    ref.current.srcObject = null;
    ref.current.srcObject = stream;
    // Force la lecture audio (autoplay policy du navigateur)
    ref.current.play().catch(() => {});
  }, [stream, refreshKey]);

  return (
    <div className={className}>
      <video ref={ref} autoPlay playsInline />
      <div className="video_tile_label">
        {label} {micMuted ? '' : ''}
      </div>
    </div>
  );
};

export default VideoChat;
