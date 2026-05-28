import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setVideoSessionActive, clearMessages } from '../store/slices/chatSlice';
import {
  onVideoSessionStarted,
  onVideoSessionEnded,
  startVideoSession,
  endVideoSession,
  joinVideoSession,
  leaveVideoSession,
  getSocket,
  requestJoinVideo,
  acceptStudent,
  rejectStudent,
  onStudentJoinRequest,
  onJoinRequestAccepted,
  onJoinRequestRejected,
  onParticipantsUpdate,
} from '../socketConnection/socketConn';
import VideoChat from './VideoChat';
import TextChat from './TextChat';
import FilePanel from './FilePanel';
import './CourseRoom.css';
import API from '../config';

const BackIcon = () => (
  <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const UsersIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

const useTimer = (running) => {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef(null);
  useEffect(() => {
    if (running) {
      setSeconds(0);
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
      setSeconds(0);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);
  const pad = (n) => String(n).padStart(2, '0');
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const AVATAR_COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#0891B2', '#059669', '#D97706'];
const colorFor = (name = '') => AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name = '') => (name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const CourseRoom = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, token } = useSelector((s) => s.auth);
  const { videoSessionActive, professorSocketId } = useSelector((s) => s.chat);

  const [course, setCourse] = useState(null);
  const [inVideoSession, setInVideoSession] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [joinStatus, setJoinStatus] = useState('idle'); // idle | pending | rejected
  const [rightTab, setRightTab] = useState('chat'); // 'chat' | 'files'
  const [mobileChat, setMobileChat] = useState(false);

  const isProfessor = user?.role === 'professor';
  const timerDisplay = useTimer(inVideoSession);

  useEffect(() => {
    if (!token) { navigate('/'); return; }

    fetch(`${API}/courses`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const found = (Array.isArray(data) ? data : []).find((c) => c.id === parseInt(courseId));
        setCourse(found || null);
      })
      .catch(() => {});

    const socket = getSocket();
    if (socket) {
      socket.emit('get-live-courses');
      socket.once('live-courses-update', (liveCourses) => {
        const session = liveCourses[String(courseId)];
        if (session) {
          dispatch(setVideoSessionActive({ active: true, professorSocketId: session.professorSocketId }));
        }
      });
    }

    const unsubStart = onVideoSessionStarted(({ professorSocketId: pId }) => {
      dispatch(setVideoSessionActive({ active: true, professorSocketId: pId }));
    });

    const unsubEnd = onVideoSessionEnded(() => {
      dispatch(setVideoSessionActive({ active: false, professorSocketId: null }));
      setInVideoSession(false);
      setParticipants([]);
      setJoinRequests([]);
      setJoinStatus('idle');
    });

    // Prof reçoit les demandes d'admission
    const unsubRequest = onStudentJoinRequest(({ studentSocketId, username }) => {
      setJoinRequests((prev) => {
        if (prev.find((r) => r.studentSocketId === studentSocketId)) return prev;
        return [...prev, { studentSocketId, username }];
      });
    });

    // Étudiant : accepté → rejoindre la vidéo
    const unsubAccepted = onJoinRequestAccepted(({ professorSocketId: pId }) => {
      setJoinStatus('accepted');
      joinVideoSession(courseId, pId);
      setInVideoSession(true);
    });

    // Étudiant : refusé
    const unsubRejected = onJoinRequestRejected(() => {
      setJoinStatus('rejected');
    });

    // Mise à jour liste participants
    const unsubParticipants = onParticipantsUpdate((list) => {
      setParticipants(list);
    });

    return () => {
      unsubStart?.();
      unsubEnd?.();
      unsubRequest?.();
      unsubAccepted?.();
      unsubRejected?.();
      unsubParticipants?.();
      dispatch(clearMessages());
      dispatch(setVideoSessionActive({ active: false, professorSocketId: null }));
    };
  }, [courseId, token]);

  // Étudiant : envoyer demande d'admission automatiquement quand session démarre
  useEffect(() => {
    if (!isProfessor && videoSessionActive && joinStatus === 'idle' && professorSocketId) {
      requestJoinVideo(courseId, professorSocketId);
      setJoinStatus('pending');
    }
  }, [videoSessionActive, isProfessor, joinStatus, professorSocketId]);

  const handleStartSession = () => {
    startVideoSession(courseId);
    setInVideoSession(true);
  };

  const handleEndSession = () => {
    endVideoSession(courseId);
    setInVideoSession(false);
    setParticipants([]);
    setJoinRequests([]);
  };

  const handleLeaveVideo = () => {
    leaveVideoSession(courseId);
    setInVideoSession(false);
    setJoinStatus('idle');
  };

  const handleAccept = (studentSocketId) => {
    acceptStudent(courseId, studentSocketId);
    setJoinRequests((prev) => prev.filter((r) => r.studentSocketId !== studentSocketId));
  };

  const handleReject = (studentSocketId) => {
    rejectStudent(studentSocketId);
    setJoinRequests((prev) => prev.filter((r) => r.studentSocketId !== studentSocketId));
  };

  const handleBack = () => navigate('/app/cours');

  const handleRetryJoin = () => {
    if (professorSocketId) {
      requestJoinVideo(courseId, professorSocketId);
      setJoinStatus('pending');
    }
  };

  return (
    <div className="course_room">
      {/* Top bar */}
      <nav className="room_nav">
        <div className="room_nav_left">
          <button className="back_btn" onClick={handleBack}>
            <BackIcon /> Retour
          </button>
          <span className="room_title">{course?.title || 'Chargement...'}</span>
        </div>
        <div className="room_nav_right">
          {inVideoSession && (
            <div className="room_timer"><ClockIcon /> {timerDisplay}</div>
          )}
          {participants.length > 0 && (
            <div className="room_participants"><UsersIcon /> {participants.length}</div>
          )}
          <button
            className={`mobile_chat_btn${mobileChat ? ' active' : ''}`}
            onClick={() => setMobileChat(v => !v)}
            title="Chat"
          >
            💬
          </button>
        </div>
      </nav>

      {videoSessionActive && (
        <div className="video_session_banner">
          <div className="pulse_dot" /> Session en direct
        </div>
      )}

      {/* Notifications demandes (prof) */}
      {isProfessor && joinRequests.length > 0 && (
        <div className="join_requests_bar">
          {joinRequests.map((req) => (
            <div className="join_request_item" key={req.studentSocketId}>
              <div className="join_request_avatar" style={{ background: colorFor(req.username) }}>
                {getInitials(req.username)}
              </div>
              <span className="join_request_name"><strong>{req.username}</strong> demande à rejoindre</span>
              <button className="join_req_btn accept" onClick={() => handleAccept(req.studentSocketId)} title="Accepter">
                <CheckIcon />
              </button>
              <button className="join_req_btn reject" onClick={() => handleReject(req.studentSocketId)} title="Refuser">
                <XIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="room_body">
        <div className="video_section">
          <VideoChat
            courseId={courseId}
            videoSessionActive={videoSessionActive}
            inVideoSession={inVideoSession}
            isProfessor={isProfessor}
            joinStatus={joinStatus}
            participants={participants}
            professorSocketId={professorSocketId}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            onLeaveVideo={handleLeaveVideo}
            onRetryJoin={handleRetryJoin}
            onBack={handleBack}
          />
        </div>

        {/* Panneau droit */}
        <div className={`chat_section${mobileChat ? ' mobile_open' : ''}`}>
          {/* Onglets Chat / Fichiers */}
          <div className="right_tabs">
            <button
              className={`right_tab ${rightTab === 'chat' ? 'active' : ''}`}
              onClick={() => setRightTab('chat')}
            >
              💬 Chat
            </button>
            <button
              className={`right_tab ${rightTab === 'files' ? 'active' : ''}`}
              onClick={() => setRightTab('files')}
            >
              📁 Fichiers
            </button>
          </div>

          {rightTab === 'chat' ? (
            <TextChat courseId={courseId} />
          ) : (
            <FilePanel courseId={courseId} token={token} isProfessor={isProfessor} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseRoom;
