
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  getSocket,
  onWebRTCOffer, onWebRTCAnswer, onIceCandidate, onPeerLeft,
  onExistingPeers,
  sendWebRTCOffer, sendWebRTCAnswer, sendIceCandidate,
  emitScreenShareStarted, emitScreenShareStopped,
  onScreenShareStarted, onScreenShareStopped,
  raiseHand, lowerHand,
  onHandRaised, onHandLowered,
  grantFloor, removeFloor,
  onFloorGranted, onFloorRemoved, onFloorUpdate,
  onKickedFromVideo,
} from '../socketConnection/socketConn'; 
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: 'ed5f9fd343f6092b3dcc81d7',
      credential: 'km71W6e3w0iXGk21',
    },
    {
      urls: 'turn:global.relay.metered.ca:80?transport=tcp',
      username: 'ed5f9fd343f6092b3dcc81d7',
      credential: 'km71W6e3w0iXGk21',
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: 'ed5f9fd343f6092b3dcc81d7',
      credential: 'km71W6e3w0iXGk21',
    },
    {
      urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      username: 'ed5f9fd343f6092b3dcc81d7',
      credential: 'km71W6e3w0iXGk21',
    },
  ],
};

const AVATAR_COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#0891B2', '#059669', '#D97706'];
const colorFor    = (n = '') => AVATAR_COLORS[(n || '').charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (n = '') => (n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();


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
  const mediaPromiseRef = useRef(null); 

  const [remoteStreams,    setRemoteStreams]    = useState({});
  const [localStream,     setLocalStream]      = useState(null);
  const [micMuted,        setMicMuted]         = useState(true);   
  const [micLocked,       setMicLocked]        = useState(true);   
  const [camOff,          setCamOff]           = useState(false);
  const [isSharing,       setIsSharing]        = useState(false);
  const [mediaError,      setMediaError]       = useState('');
  const [screenShareVer,  setScreenShareVer]   = useState(0);

  const [handRaised,   setHandRaised]   = useState(false);
  const [handStatus,   setHandStatus]   = useState('idle');

  const [handRequests,  setHandRequests]  = useState([]);   // (prof) demandes de parole en attente
  const [grantedIds,    setGrantedIds]    = useState([]);   // socketIds des étudiants ayant la parole
  const [amGranted,     setAmGranted]     = useState(false);// (étudiant) ai-je la parole ?
  const myId = getSocket()?.id;

  
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

  const getLocalMedia = async (startMuted = false) => {
    if (mediaPromiseRef.current) return await mediaPromiseRef.current;
    if (localStreamRef.current) return localStreamRef.current;

    const acquire = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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

    const promise = acquire().finally(() => { mediaPromiseRef.current = null; });
    mediaPromiseRef.current = promise;
    return await promise;
  };

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    const target = (isSharing && screenStreamRef.current)
      ? screenStreamRef.current
      : localStreamRef.current;
    // Ne réassigner srcObject que s'il a changé : réassigner le même flux
    // recharge la vidéo et la fait clignoter.
    if (target && el.srcObject !== target) el.srcObject = target;
  }, [localStream, camOff, isSharing, remoteStreams]);

  const createPeer = useCallback((targetId, stream) => {
    if (peersRef.current[targetId]) peersRef.current[targetId].close();
    iceQueues.current[targetId] = [];
    const pc = new RTCPeerConnection(ICE_SERVERS);
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = e => {
      if (e.candidate) {
        // DIAG : 'relay' = passe par TURN ; 'srflx'/'host' = direct (STUN/LAN)
        console.log(`[WebRTC] candidat local -> ${targetId.slice(0, 6)} :`, e.candidate.type, e.candidate.protocol);
        sendIceCandidate(targetId, e.candidate);
      } else {
        console.log(`[WebRTC] fin des candidats -> ${targetId.slice(0, 6)}`);
      }
    };
    pc.ontrack = e => {
      console.log(`[WebRTC] FLUX RECU de ${targetId.slice(0, 6)} (${e.track.kind})`);
      if (e.streams?.[0]) addRemoteStream(targetId, e.streams[0]);
    };
    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE ${targetId.slice(0, 6)} : ${pc.iceConnectionState}`);
    };
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] connexion ${targetId.slice(0, 6)} : ${pc.connectionState}`);
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

  const handleRaiseHand = () => {
    if (!professorSocketId) return;
    if (handRaised) {
      lowerHand(professorSocketId);
      setHandRaised(false);
      setHandStatus('idle');
    } else {
      raiseHand(courseId, professorSocketId);
      setHandRaised(true);
      setHandStatus('pending');
    }
  };

  // Prof : accepte une main levée -> donne la parole (cam+micro de l'étudiant s'activent)
  const handleAcceptMic = (studentSocketId) => {
    grantFloor(courseId, studentSocketId);
    setHandRequests(prev => prev.filter(r => r.studentSocketId !== studentSocketId));
  };

  // Prof : refuse une demande -> on retire juste la demande de la liste
  const handleRejectMic = (studentSocketId) => {
    setHandRequests(prev => prev.filter(r => r.studentSocketId !== studentSocketId));
  };


  useEffect(() => {
    // MESH : on reçoit la liste des pairs déjà présents -> on les appelle (offre vers chacun)
    const unsubExisting = onExistingPeers(async (peers) => {
      console.log('[WebRTC] existing-peers reçu :', (peers || []).map(p => p.socketId.slice(0, 6)));
      const stream = localStreamRef.current || await getLocalMedia(true);
      if (!stream) { console.warn('[WebRTC] pas de flux local -> aucune offre envoyée'); return; }
      for (const p of (peers || [])) {
        try {
          const pc = createPeer(p.socketId, stream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.log('[WebRTC] OFFRE envoyée ->', p.socketId.slice(0, 6));
          sendWebRTCOffer(p.socketId, offer);
        } catch (e) { console.error('Erreur offre mesh:', e); }
      }
    });

    // On reçoit une offre d'un pair (prof OU étudiant) -> on répond
    const unsubOffer = onWebRTCOffer(async ({ fromSocketId, offer }) => {
      console.log('[WebRTC] OFFRE reçue de', fromSocketId.slice(0, 6));
      try {
        const stream = localStreamRef.current || await getLocalMedia(true);
        if (!stream) { console.warn('[WebRTC] pas de flux local -> pas de réponse'); return; }
        const pc = createPeer(fromSocketId, stream);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIceQueue(fromSocketId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('[WebRTC] REPONSE envoyée ->', fromSocketId.slice(0, 6));
        sendWebRTCAnswer(fromSocketId, answer);
      } catch (e) { console.error('Erreur réponse:', e); }
    });

    const unsubAnswer = onWebRTCAnswer(async ({ fromSocketId, answer }) => {
      console.log('[WebRTC] REPONSE reçue de', fromSocketId.slice(0, 6));
      const pc = peersRef.current[fromSocketId];
      if (!pc) { console.warn('[WebRTC] réponse reçue mais aucun peer pour', fromSocketId.slice(0, 6)); return; }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIceQueue(fromSocketId, pc);
      } catch (e) { console.error('Erreur answer:', e); }
    });

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
      setHandRequests(prev => prev.filter(r => r.studentSocketId !== socketId));
      setGrantedIds(prev => prev.filter(id => id !== socketId));
    });

    // Tout le monde apprend qui a la parole (pour l'affichage)
    const unsubFloor = onFloorUpdate(({ socketId, granted }) => {
      setGrantedIds(prev => granted
        ? [...new Set([...prev, socketId])]
        : prev.filter(id => id !== socketId));
    });

    const unsubScreenStart = onScreenShareStarted(() => {
      if (isProfessor) return;
      setTimeout(() => setScreenShareVer(v => v + 1), 200);
    });
    const unsubScreenStop = onScreenShareStopped(() => {
      if (isProfessor) return;
      setTimeout(() => setScreenShareVer(v => v + 1), 200);
    });

    let unsubHandRaised, unsubHandLowered, unsubGranted, unsubRemoved;

    if (isProfessor) {
      unsubHandRaised = onHandRaised(({ studentSocketId, username }) => {
        setHandRequests(prev =>
          prev.find(r => r.studentSocketId === studentSocketId)
            ? prev
            : [...prev, { studentSocketId, username }]);
      });
      unsubHandLowered = onHandLowered(({ studentSocketId }) => {
        setHandRequests(prev => prev.filter(r => r.studentSocketId !== studentSocketId));
      });
    } else {
      // Étudiant : le prof m'accorde la parole -> j'active ma cam et mon micro
      unsubGranted = onFloorGranted(() => {
        const s = localStreamRef.current;
        s?.getVideoTracks().forEach(t => { t.enabled = true; });
        s?.getAudioTracks().forEach(t => { t.enabled = true; });
        setAmGranted(true); setCamOff(false); setMicMuted(false);
        setHandRaised(false); setHandStatus('idle');
      });
      // Le prof me retire la parole -> je coupe ma cam et mon micro
      unsubRemoved = onFloorRemoved(() => {
        const s = localStreamRef.current;
        s?.getVideoTracks().forEach(t => { t.enabled = false; });
        s?.getAudioTracks().forEach(t => { t.enabled = false; });
        setAmGranted(false); setCamOff(true); setMicMuted(true);
      });
    }

    return () => {
      unsubExisting?.(); unsubOffer?.(); unsubAnswer?.();
      unsubIce?.(); unsubLeft?.(); unsubFloor?.();
      unsubScreenStart?.(); unsubScreenStop?.();
      unsubHandRaised?.(); unsubHandLowered?.();
      unsubGranted?.(); unsubRemoved?.();
    };
  }, [isProfessor, courseId, createPeer, addRemoteStream, removeRemoteStream]);

  useEffect(() => {
    if (!isProfessor && inVideoSession && !localStreamRef.current) {
      getLocalMedia(true).then((s) => {
        // L'étudiant démarre cam ET micro coupés (il n'est que dans la liste).
        // Les pistes sont quand même présentes (désactivées) pour le mesh :
        // quand le prof l'interroge, on les réactive sans renégocier.
        s?.getVideoTracks().forEach(t => { t.enabled = false; });
        setMicMuted(true);
        setMicLocked(true);
        setCamOff(true);
      });
    }
  }, [inVideoSession, isProfessor]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, []);

  const toggleMic = () => {
    // Étudiant : ne peut activer/couper son micro que s'il a la parole.
    if (!isProfessor && !amGranted) return;
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (!t) return;
    const newMuted = !micMuted;
    t.enabled = !newMuted;
    setMicMuted(newMuted);
  };

  const toggleCam = () => {
    if (!isProfessor) return;
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCamOff(c => !c); }
  };

  const handleStartSession = async () => {
    const stream = await getLocalMedia(false); 
    if (!stream) return;
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
    setHandRequests([]); setGrantedIds([]);
    onEndSession();
  };

  const handleLeaveVideo = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {}; setRemoteStreams({});
    onLeaveVideo();
  };

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

  // Flux du professeur (affiché en grand pour les étudiants).
  const profStream = professorSocketId ? remoteStreams[professorSocketId] : null;
  // Étudiants ayant la parole (affichés dans le bandeau, pour TOUT le monde).
  const grantedList = grantedIds.filter(sid => sid !== professorSocketId);
  const hasVideo = localStream || Object.keys(remoteStreams).length > 0;

  let sessionBtn = null;
  if (isProfessor) {
    sessionBtn = inVideoSession
      ? <button className="ctrl_session stop"  onClick={handleEndSession}><StopIcon /> Terminer</button>
      : <button className="ctrl_session start" onClick={handleStartSession}><PlayIcon /> Démarrer le cours</button>;
  } else if (inVideoSession) {
    sessionBtn = <button className="ctrl_session leave" onClick={handleLeaveVideo}><StopIcon /> Quitter</button>;
  }

  const handLabel = handStatus === 'pending' ? '' : handStatus === 'approved' ? '' : handStatus === 'rejected' ? '' : '';

  return (
    <>
      {}
      {isSharing && (
        <div className="screen_share_banner">
          Partage d'écran en cours —
          <button onClick={stopScreenShare}>Arrêter le partage</button>
        </div>
      )}

      {}
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

      {}
      <div className="video_content_row">
        <div className="video_area">
          {hasVideo ? (
            <div className="video_speakers">
              {/* Tuile du PROFESSEUR (toujours affichée) */}
              {isProfessor ? (
                <div className="speaker_tile local">
                  {isSharing ? (
                    <div className="video_tile_sharing">
                      <ScreenIcon /><span>Partage d'écran actif</span>
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
                  <div className="video_tile_label">{user?.username} (vous)</div>
                </div>
              ) : profStream ? (
                <RemoteVideo
                  className="speaker_tile"
                  stream={profStream}
                  label={usernameFor(professorSocketId)}
                  refreshKey={screenShareVer}
                  micMuted={false}
                />
              ) : (
                <div className="speaker_tile">
                  <div className="video_tile_cam_off">
                    <div className="avatar" style={{ background: '#1B2B4B' }}>P</div>
                  </div>
                  <div className="video_tile_label">Professeur (connexion…)</div>
                </div>
              )}

              {/* Tuile de l'ÉTUDIANT INTERROGÉ (un seul à la fois, même taille, à côté) */}
              {grantedList.length > 0 && (() => {
                const sid = grantedList[0];
                if (sid === myId) {
                  return (
                    <div className="speaker_tile local" key={sid}>
                      {camOff ? (
                        <div className="video_tile_cam_off">
                          <div className="avatar" style={{ background: colorFor(user?.username) }}>
                            {getInitials(user?.username)}
                          </div>
                        </div>
                      ) : (
                        <video
                          ref={el => { localVideoRef.current = el; if (el && el.srcObject !== localStreamRef.current) el.srcObject = localStreamRef.current; }}
                          autoPlay muted playsInline
                        />
                      )}
                      <div className="video_tile_label">{user?.username} (vous)</div>
                    </div>
                  );
                }
                const stream = remoteStreams[sid];
                if (!stream) return null;
                return (
                  <RemoteVideo
                    key={sid}
                    className="speaker_tile"
                    stream={stream}
                    label={usernameFor(sid)}
                    refreshKey={screenShareVer}
                    micMuted={false}
                  />
                );
              })()}
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

      {}
      <div className="video_controls">
        {/* Micro : prof toujours ; étudiant seulement s'il a la parole */}
        {(isProfessor || amGranted) && (
          <button
            className={`ctrl_circle ${micMuted ? 'mic_off' : 'mic_on'}`}
            onClick={toggleMic}
            disabled={!localStream}
            title={micMuted ? 'Activer le micro' : 'Couper le micro'}
          >
            {micMuted ? <MicOffIcon /> : <MicOnIcon />}
          </button>
        )}

        {/* Main levée : étudiant uniquement (désactivée s'il a déjà la parole) */}
        {!isProfessor && inVideoSession && (
          <button
            className={`ctrl_circle hand_btn_ctrl ${handStatus}`}
            onClick={handleRaiseHand}
            disabled={!localStream || amGranted}
            title={
              amGranted ? 'Vous avez la parole'
              : handRaised ? 'Baisser la main'
              : 'Demander la parole'
            }
          >
            <HandIcon />
            {handStatus !== 'idle' && <span className="hand_status_badge">{handLabel}</span>}
          </button>
        )}

        {}
        {isProfessor && (
          <button
            className={`ctrl_circle ${camOff ? 'cam_off' : 'cam_on'}`}
            onClick={toggleCam} disabled={!localStream || isSharing}
            title={camOff ? 'Activer la caméra' : 'Couper la caméra'}
          >
            {camOff ? <CamOffIcon /> : <CamOnIcon />}
          </button>
        )}

        {}
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

const RemoteVideo = ({ stream, label, refreshKey, micMuted, className = 'video_tile' }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !stream) return;
    ref.current.srcObject = null;
    ref.current.srcObject = stream;

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
