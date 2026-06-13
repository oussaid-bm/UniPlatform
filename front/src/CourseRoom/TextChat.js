
import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addMessage, setMessages } from '../store/slices/chatSlice';
import { sendMessage, joinCourseChat, leaveCourseChat } from '../socketConnection/socketConn';
import { formatTime } from '../utils/formatting';
import API from '../config';

const TextChat = ({ courseId }) => {
  const dispatch = useDispatch();
  const { messages } = useSelector((s) => s.chat);
  const { user, token } = useSelector((s) => s.auth);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    joinCourseChat(courseId, (msg) => dispatch(addMessage(msg)));

    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API}/courses/${courseId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (Array.isArray(data)) dispatch(setMessages(data));
      } catch {}
    };
    fetchHistory();

    return () => leaveCourseChat(courseId);
  }, [courseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(courseId, text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="chat_header">Chat du cours</div>
      <div className="chat_messages">
        {messages.map((msg) => (
          <div className="chat_msg" key={msg.id}>
            <div className="chat_msg_header">
              <span className={`chat_msg_name ${msg.sender_id === user.id ? 'self' : ''}`}>
                {msg.sender_name}
              </span>
              <span className="chat_msg_time">{formatTime(msg.created_at)}</span>
            </div>
            <div className="chat_msg_content">{msg.content}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat_input_area">
        <textarea
          className="chat_input"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrire un message..."
        />
        <button className="chat_send_btn" onClick={handleSend} disabled={!text.trim()}>
          Envoyer
        </button>
      </div>
    </>
  );
};

export default TextChat;
