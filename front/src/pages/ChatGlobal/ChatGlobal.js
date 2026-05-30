import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { getSocket } from '../../socketConnection/socketConn';
import API from '../../config';
import './ChatGlobal.css';

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const ClipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);
const FileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
  </svg>
);
const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const ChatHeaderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const AVATAR_COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#0891B2', '#059669', '#D97706'];
const colorFor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name = '') => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const formatTime = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const formatSize = (b) => !b ? '' : b < 1024 ? `${b} o` : b < 1048576 ? `${(b/1024).toFixed(1)} Ko` : `${(b/1048576).toFixed(1)} Mo`;

const ChatGlobal = () => {
  const { user, token } = useSelector((s) => s.auth);
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [showOnline, setShowOnline] = useState(false);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  // Charger l'historique depuis la base de données
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/chat/global`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setMessages(data); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join-global-chat');
    const handleMsg = (msg) => setMessages((prev) =>
      msg.id && prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
    );
    const handleOnline = (list) => setOnline(Array.isArray(list) ? list : []);
    socket.on('global-message', handleMsg);
    socket.on('global-online', handleOnline);
    return () => {
      socket.emit('leave-global-chat');
      socket.off('global-message', handleMsg);
      socket.off('global-online', handleOnline);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    getSocket()?.emit('send-global-message', { content: text.trim() });
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/chat/global/file`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const msg = await res.json();
      if (res.ok) {
        // On ne l'ajoute pas localement : le broadcast nous le renvoie (évite les doublons)
        getSocket()?.emit('broadcast-global-file', { message: msg });
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadFile = (msg) => {
    window.open(`${API}/chat/global/download/${msg.file_name}?token=${token}`, '_blank');
  };

  return (
    <div className="chat_page">
      <div className="chat_page_header">
        <div className="chat_header_icon"><ChatHeaderIcon /></div>
        <div className="chat_header_info">
          <h2>Chat Global</h2>
          <p><span className="online_dot" /> {online.length} en ligne</p>
        </div>
        <button
          className={`online_toggle_btn${showOnline ? ' active' : ''}`}
          onClick={() => setShowOnline((v) => !v)}
          title="Membres en ligne"
        >
          <UsersIcon />
          <span className="online_toggle_count">{online.length}</span>
        </button>
      </div>

      <div className="chat_main_row">
      <div className="chat_left">
      <div className="chat_messages_list">
        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === user?.id;
          const prev = messages[i - 1];
          const isGrouped = prev && prev.sender_id === msg.sender_id;

          return (
            <div
              className={`chat_msg_row${isOwn ? ' own' : ''}${isGrouped ? ' chat_msg_grouped' : ''}`}
              key={msg.id || i}
            >
              {!isOwn && (
                isGrouped
                  ? <div className="avatar_spacer" />
                  : <div className="avatar sm" style={{ background: colorFor(msg.sender_name) }}>
                      {getInitials(msg.sender_name)}
                    </div>
              )}
              <div className="chat_msg_body">
                {!isGrouped && (
                  <div className="chat_msg_meta">
                    <span className="chat_msg_name">{isOwn ? 'Moi' : msg.sender_name}</span>
                    <span className="chat_msg_time">{formatTime(msg.created_at)}</span>
                  </div>
                )}
                {msg.file_name ? (
                  <div className={`chat_file_bubble${isOwn ? ' own' : ''}`} onClick={() => downloadFile(msg)}>
                    <div className="chat_file_icon"><FileIcon /></div>
                    <div className="chat_file_info">
                      <span className="chat_file_name">{msg.file_original}</span>
                      <span className="chat_file_size">{formatSize(msg.file_size)}</span>
                    </div>
                    <div className="chat_file_dl"><DownloadIcon /></div>
                  </div>
                ) : (
                  <div className={`chat_msg_bubble${isOwn ? ' own' : ''}`}>
                    {msg.content}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: 14 }}>
            Soyez le premier à écrire un message. Salut tout le monde !
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat_input_bar">
        <input ref={fileRef} type="file" hidden onChange={handleFile} />
        <button className="attach_btn" onClick={() => fileRef.current?.click()} disabled={uploading} title="Joindre un fichier">
          <ClipIcon />
        </button>
        <input
          className="chat_input_field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={uploading ? 'Envoi du fichier...' : 'Écrivez votre message...'}
        />
        <button className="send_btn" onClick={handleSend} disabled={!text.trim()}>
          <SendIcon />
        </button>
      </div>
      </div>

      <div className={`chat_online_panel${showOnline ? ' open' : ''}`}>
        <div className="online_panel_title">
          <span className="online_dot" /> En ligne — {online.length}
        </div>
        <div className="online_panel_list">
          {online.map((u) => (
            <div className="online_user" key={u.id}>
              <div className="online_user_avatar" style={{ background: colorFor(u.username) }}>
                {getInitials(u.username)}
                <span className="online_user_dot" />
              </div>
              <div className="online_user_info">
                <span className="online_user_name">{u.username}{u.id === user?.id ? ' (moi)' : ''}</span>
                <span className="online_user_role">{u.role === 'professor' ? 'Professeur' : u.role === 'admin' ? 'Admin' : 'Étudiant'}</span>
              </div>
            </div>
          ))}
          {online.length === 0 && (
            <div className="online_empty">Personne en ligne</div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default ChatGlobal;
