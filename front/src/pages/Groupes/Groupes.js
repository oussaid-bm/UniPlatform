import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { getSocket } from '../../socketConnection/socketConn';
import { FILIERES } from '../../filieres';
import API from '../../config';
import '../ChatGlobal/ChatGlobal.css';
import './Groupes.css';

const GROUP_COLORS  = ['#1B2B4B', '#7C3AED', '#0891B2', '#059669', '#C8963E', '#DB2777'];
const groupColor    = (name = '') => GROUP_COLORS[name.charCodeAt(0) % GROUP_COLORS.length];
const AVATAR_COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#0891B2', '#059669', '#D97706'];
const colorFor      = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials   = (name = '') => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const formatTime    = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const GroupIconSvg = () => (
  <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
  </svg>
);

const Groupes = () => {
  const { user, token } = useSelector((s) => s.auth);
  const isProfessor = user?.role === 'professor';

  const [groups,      setGroups]      = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages,    setMessages]    = useState({});
  const [text,        setText]        = useState('');
  const bottomRef = useRef(null);

  /* ── États modal création ─────────────────────────────────── */
  const [showModal,        setShowModal]        = useState(false);
  const [step,             setStep]             = useState(1);
  const [formName,         setFormName]         = useState('');
  const [formFiliere,      setFormFiliere]      = useState('');
  const [students,         setStudents]         = useState([]);
  const [selectedMembers,  setSelectedMembers]  = useState([]);
  const [loadingStudents,  setLoadingStudents]  = useState(false);
  const [creating,         setCreating]         = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  /* ── Chargement des groupes ───────────────────────────────── */
  useEffect(() => {
    fetch(`${API}/groups`, { headers })
      .then((r) => r.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [token]); // eslint-disable-line

  /* ── Socket ───────────────────────────────────────────────── */
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleMsg = (msg) => {
      setMessages((prev) => ({ ...prev, [msg.groupId]: [...(prev[msg.groupId] || []), msg] }));
    };
    socket.on('group-message', handleMsg);
    return () => socket.off('group-message', handleMsg);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeGroup]);

  const selectGroup = (group) => {
    const socket = getSocket();
    if (activeGroup) socket?.emit('leave-group-chat', activeGroup.id);
    setActiveGroup(group);
    socket?.emit('join-group-chat', group.id);
  };

  const handleSend = () => {
    if (!text.trim() || !activeGroup) return;
    getSocket()?.emit('send-group-message', { groupId: activeGroup.id, content: text.trim() });
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* ── Création groupe ──────────────────────────────────────── */
  const openModal = () => {
    setFormName(''); setFormFiliere('');
    setStudents([]); setSelectedMembers([]);
    setStep(1); setShowModal(true);
  };

  const handleNextStep = async () => {
    if (!formName.trim() || !formFiliere) return;
    setLoadingStudents(true);
    try {
      const res  = await fetch(`${API}/groups/students?filiere=${encodeURIComponent(formFiliere)}`, { headers });
      const data = await res.json();
      setStudents(Array.isArray(data) ? data : []);
      setSelectedMembers([]);
      setStep(2);
    } finally { setLoadingStudents(false); }
  };

  const toggleAll = () => {
    setSelectedMembers((prev) =>
      prev.length === students.length ? [] : students.map((s) => s.id)
    );
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res  = await fetch(`${API}/groups`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: formName, filiere: formFiliere, members: selectedMembers }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroups((prev) => [data, ...prev]);
        setShowModal(false);
      }
    } finally { setCreating(false); }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce groupe ?')) return;
    const res = await fetch(`${API}/groups/${id}`, { method: 'DELETE', headers });
    if (res.ok) {
      setGroups((prev) => prev.filter((g) => g.id !== id));
      if (activeGroup?.id === id) setActiveGroup(null);
    }
  };

  const groupMessages = activeGroup ? (messages[activeGroup.id] || []) : [];

  return (
    <div className={`groupes_page${activeGroup ? ' chat_open' : ''}`}>

      {/* ── PANEL LISTE ─────────────────────────────────────── */}
      <div className="groupes_list_panel">
        <div className="groupes_list_header">
          <h3>Mes Groupes</h3>
          {isProfessor && (
            <button className="add_group_btn" onClick={openModal} title="Créer un groupe">+</button>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="groups_empty">
            <GroupIconSvg />
            <span>{isProfessor ? 'Aucun groupe créé.' : 'Vous n\'êtes dans aucun groupe.'}</span>
            {isProfessor && <span className="groups_empty_hint">Cliquez sur "+" pour en créer un.</span>}
          </div>
        ) : groups.map((g) => (
          <div
            key={g.id}
            className={`group_item ${activeGroup?.id === g.id ? 'active' : ''}`}
            onClick={() => selectGroup(g)}
          >
            <div className="group_avatar" style={{ background: groupColor(g.name) }}>
              {getInitials(g.name)}
            </div>
            <div className="group_info">
              <div className="group_name">{g.name}</div>
              {g.filiere && <div className="group_filiere_tag">{g.filiere}</div>}
              <div className="group_members">{g.member_count ?? '—'} membres</div>
            </div>
            {isProfessor && g.created_by === user?.id && (
              <button className="group_delete_btn" onClick={(e) => handleDelete(e, g.id)} title="Supprimer">
                <TrashIcon />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── PANEL CHAT ──────────────────────────────────────── */}
      <div className="group_chat_panel">
        {activeGroup ? (
          <>
            <div className="group_chat_header">
              <button className="group_back_btn" onClick={() => setActiveGroup(null)}>‹</button>
              <div className="group_chat_header_avatar" style={{ background: groupColor(activeGroup.name) }}>
                {getInitials(activeGroup.name)}
              </div>
              <div className="group_chat_header_info">
                <h3>{activeGroup.name}</h3>
                <p>{activeGroup.member_count ?? '—'} membres{activeGroup.filiere ? ` · ${activeGroup.filiere}` : ''}</p>
              </div>
            </div>

            <div className="group_messages">
              {groupMessages.map((msg, i) => {
                const isOwn    = msg.sender_id === user?.id;
                const prev     = groupMessages[i - 1];
                const isGrouped = prev && prev.sender_id === msg.sender_id;
                return (
                  <div className={`chat_msg_row${isOwn ? ' own' : ''}${isGrouped ? ' chat_msg_grouped' : ''}`} key={i}>
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
                      <div className={`chat_msg_bubble${isOwn ? ' own' : ''}`}>{msg.content}</div>
                    </div>
                  </div>
                );
              })}
              {groupMessages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: 13 }}>
                  Aucun message pour l'instant. Lancez la conversation !
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
                placeholder={`Message dans ${activeGroup.name}…`}
              />
              <button className="send_btn" onClick={handleSend} disabled={!text.trim()}>
                <SendIcon />
              </button>
            </div>
          </>
        ) : (
          <div className="no_group_selected">
            <div className="no_group_selected_icon"><GroupIconSvg /></div>
            Sélectionnez un groupe pour commencer
          </div>
        )}
      </div>

      {/* ── MODAL CRÉATION ──────────────────────────────────── */}
      {showModal && (
        <div className="modal_overlay" onClick={() => setShowModal(false)}>
          <div className={`modal_box${step === 2 ? ' modal_box_wide' : ''}`} onClick={(e) => e.stopPropagation()}>

            {/* Étape 1 : nom + filière */}
            {step === 1 && (
              <>
                <div className="modal_step_header">
                  <h3>Nouveau groupe</h3>
                  <span className="modal_step_badge">Étape 1 / 2</span>
                </div>
                <input
                  placeholder="Nom du groupe *"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && formName.trim() && formFiliere && handleNextStep()}
                />
                <div className="group_modal_label">Spécialité</div>
                <select value={formFiliere} onChange={(e) => setFormFiliere(e.target.value)}>
                  <option value="">— Choisir une spécialité —</option>
                  {FILIERES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <div className="modal_actions">
                  <button className="modal_cancel" onClick={() => setShowModal(false)}>Annuler</button>
                  <button
                    className="modal_confirm"
                    onClick={handleNextStep}
                    disabled={!formName.trim() || !formFiliere || loadingStudents}
                  >
                    {loadingStudents ? 'Chargement...' : 'Suivant →'}
                  </button>
                </div>
              </>
            )}

            {/* Étape 2 : sélection des membres */}
            {step === 2 && (
              <>
                <div className="modal_step_header">
                  <h3>Choisir les membres</h3>
                  <span className="modal_step_badge">Étape 2 / 2</span>
                </div>
                <div className="group_modal_meta">
                  <strong>{formName}</strong> · {formFiliere}
                </div>

                {students.length === 0 ? (
                  <div className="students_empty">Aucun étudiant inscrit dans cette spécialité.</div>
                ) : (
                  <>
                    <div className="students_list_header">
                      <span className="students_count">{students.length} étudiant{students.length > 1 ? 's' : ''}</span>
                      <button className="select_all_btn" onClick={toggleAll}>
                        {selectedMembers.length === students.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </button>
                    </div>
                    <select
                      multiple
                      className="students_select"
                      value={selectedMembers.map(String)}
                      onChange={(e) => setSelectedMembers(
                        Array.from(e.target.selectedOptions, (opt) => parseInt(opt.value))
                      )}
                      size={Math.min(students.length, 8)}
                    >
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>{s.username}</option>
                      ))}
                    </select>
                    <div className="students_select_hint">
                      Maintenez Ctrl (ou Cmd) pour sélectionner plusieurs étudiants
                    </div>
                  </>
                )}

                <div className="modal_actions">
                  <button className="modal_cancel" onClick={() => setStep(1)}>← Retour</button>
                  <button
                    className="modal_confirm"
                    onClick={handleCreate}
                    disabled={creating}
                  >
                    {creating ? 'Création...' : `Créer${selectedMembers.length > 0 ? ` (${selectedMembers.length} membre${selectedMembers.length > 1 ? 's' : ''})` : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Groupes;
