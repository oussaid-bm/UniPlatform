import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { getSocket } from '../../socketConnection/socketConn';
import './ChatGlobal.css';

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ChatHeaderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const AVATAR_COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#0891B2', '#059669', '#D97706'];
const colorFor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name = '') => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const formatTime = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const ChatGlobal = () => {
  const { user } = useSelector((s) => s.auth);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join-global-chat');
    const handleMsg = (msg) => setMessages((prev) => [...prev, msg]);
    socket.on('global-message', handleMsg);
    return () => {
      socket.emit('leave-global-chat');
      socket.off('global-message', handleMsg);
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

  return (
    <div className="chat_page">
      <div className="chat_page_header">
        <div className="chat_header_icon"><ChatHeaderIcon /></div>
        <div className="chat_header_info">
          <h2>Chat Global</h2>
          <p><span className="online_dot" /> Espace de discussion général</p>
        </div>
      </div>

      <div className="chat_messages_list">
        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === user?.id;
          const prev = messages[i - 1];
          const isGrouped = prev && prev.sender_id === msg.sender_id;

          return (
            <div
              className={`chat_msg_row${isOwn ? ' own' : ''}${isGrouped ? ' chat_msg_grouped' : ''}`}
              key={i}
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
                <div className={`chat_msg_bubble${isOwn ? ' own' : ''}`}>
                  {msg.content}
                </div>
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
        <input
          className="chat_input_field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrivez votre message..."
        />
        <button className="send_btn" onClick={handleSend} disabled={!text.trim()}>
          <SendIcon />
        </button>
      </div>
    </div>
  );
};

export default ChatGlobal;
