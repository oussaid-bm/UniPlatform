
import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { getSocket } from '../../socketConnection/socketConn';
import API from '../../config';
import { SendIcon, ClipIcon, FileIcon, DownloadIcon, ChatIcon, UsersIcon } from '../../components/Icons';
import { colorByName, getInitials, formatTime, formatSize } from '../../utils/formatting';
import './ChatGlobal.css';

const ChatGlobal = () => {
  const { user, token } = useSelector((s) => s.auth);
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [showOnline, setShowOnline] = useState(false);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

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
        <div className="chat_header_icon"><ChatIcon /></div>
        <div className="chat_header_info">
          <h2>Chat Global</h2>
          <p>{user?.filiere || 'Toutes filières'} · {online.length} en ligne</p>
        </div>
        <button
          className={`online_toggle_btn${showOnline ? ' active' : ''}`}
          onClick={() => setShowOnline((v) => !v)}
          title="Utilisateurs en ligne"
        >
          <UsersIcon />
          <span className="online_toggle_count">{online.length}</span>
        </button>
      </div>

      <div className="chat_main_row">
        <div className="chat_left">
          <div className="chat_messages">
            {messages.map((msg, i) => {
              const isOwn    = msg.sender_id === user?.id;
              const prev     = messages[i - 1];
              const isGrouped = prev && prev.sender_id === msg.sender_id;
              return (
                <div className={`chat_msg_row${isOwn ? ' own' : ''}${isGrouped ? ' chat_msg_grouped' : ''}`} key={msg.id || i}>
                  {!isOwn && (
                    isGrouped
                      ? <div className="avatar_spacer" />
                      : <div className="avatar sm" style={{ background: colorByName(msg.sender_name) }}>
                          {getInitials(msg.sender_name)}
                        </div>
                  )}
                  <div className="chat_bubble_wrap">
                    {!isOwn && !isGrouped && <div className="chat_sender">{msg.sender_name}</div>}
                    {msg.file_name ? (
                      <div className="chat_bubble file" onClick={() => downloadFile(msg)}>
                        <FileIcon />
                        <div className="file_info">
                          <span className="file_name">{msg.file_original || msg.file_name}</span>
                          <span className="file_size">{formatSize(msg.file_size)}</span>
                        </div>
                        <DownloadIcon />
                      </div>
                    ) : (
                      <div className="chat_bubble">{msg.content}</div>
                    )}
                    <span className="chat_time">{formatTime(msg.created_at)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="chat_input_bar">
            <button className="chat_attach_btn" onClick={() => fileRef.current?.click()} disabled={uploading} title="Joindre un fichier">
              <ClipIcon />
            </button>
            <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={handleFile} />
            <textarea
              className="chat_input"
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écrire un message..."
            />
            <button className="chat_send_btn" onClick={handleSend} disabled={!text.trim()}>
              <SendIcon />
            </button>
          </div>
        </div>

        {showOnline && (
          <div className="online_panel">
            <div className="online_panel_header">
              <UsersIcon /> En ligne ({online.length})
            </div>
            {online.map((u) => (
              <div className="online_user" key={u.id}>
                <div className="avatar xs" style={{ background: colorByName(u.username) }}>
                  {getInitials(u.username)}
                </div>
                <span>{u.username}</span>
                {u.role === 'professor' && <span className="role_badge prof">Prof</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatGlobal;
