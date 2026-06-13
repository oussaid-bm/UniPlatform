
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
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
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
const LeaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const formatSize = (b) => !b ? '' : b < 1024 ? `${b} o` : b < 1048576 ? `${(b/1024).toFixed(1)} Ko` : `${(b/1048576).toFixed(1)} Mo`;

const Groupes = () => {
  const { user, token } = useSelector((s) => s.auth);
  const isProfessor = user?.role === 'professor';

  const [groups,      setGroups]      = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages,    setMessages]    = useState({});
  const [onlineByGroup, setOnlineByGroup] = useState({});
  const [showOnline, setShowOnline] = useState(false);
  const [text,        setText]        = useState('');
  const [uploading,   setUploading]   = useState(false);
  const bottomRef = useRef(null);
  const fileRef   = useRef(null);

  const [showModal,        setShowModal]        = useState(false);
  const [step,             setStep]             = useState(1);
  const [formName,         setFormName]         = useState('');
  const [formFiliere,      setFormFiliere]      = useState('');
  const [students,         setStudents]         = useState([]);
  const [selectedMembers,  setSelectedMembers]  = useState([]);
  const [loadingStudents,  setLoadingStudents]  = useState(false);
  const [creating,         setCreating]         = useState(false);

  const [membersModal,  setMembersModal]  = useState(null); 
  const [members,       setMembers]       = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch(`${API}/groups`, { headers })
      .then((r) => r.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setFetchError('Impossible de charger les groupes.'));
  }, [token]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleMsg = (msg) => {
      const gid = msg.groupId || msg.group_id;
      setMessages((prev) => {
        const list = prev[gid] || [];
        if (msg.id && list.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [gid]: [...list, msg] };
      });
    };
    const handleOnline = ({ groupId, users }) =>
      setOnlineByGroup((prev) => ({ ...prev, [groupId]: Array.isArray(users) ? users : [] }));
    socket.on('group-message', handleMsg);
    socket.on('group-online', handleOnline);
    return () => {
      socket.off('group-message', handleMsg);
      socket.off('group-online', handleOnline);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeGroup]);

  const selectGroup = (group) => {
    const socket = getSocket();
    if (activeGroup) socket?.emit('leave-group-chat', activeGroup.id);
    setActiveGroup(group);
    socket?.emit('join-group-chat', group.id);
    fetch(`${API}/chat/group/${group.id}`, { headers })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data))
          setMessages((prev) => ({ ...prev, [group.id]: data }));
      })
      .catch(() => {});
  };

  // Note: group messages fetch errors are non-critical since real-time delivery continues

  const handleSend = () => {
    if (!text.trim() || !activeGroup) return;
    getSocket()?.emit('send-group-message', { groupId: activeGroup.id, content: text.trim() });
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeGroup) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/chat/group/${activeGroup.id}/file`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const msg = await res.json();
      if (res.ok) {
        getSocket()?.emit('broadcast-group-file', { groupId: activeGroup.id, message: msg });
      } else {
        alert('Erreur lors de l\'envoi du fichier.');
      }
    } catch {
      alert('Impossible de joindre le serveur.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadFile = (msg) => {
    window.open(`${API}/chat/group/download/${msg.file_name}?token=${token}`, '_blank');
  };

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
      } else {
        alert(data.error || 'Erreur lors de la création.');
      }
    } catch {
      alert('Impossible de joindre le serveur.');
    } finally { setCreating(false); }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce groupe ?')) return;
    try {
      const res = await fetch(`${API}/groups/${id}`, { method: 'DELETE', headers });
      if (res.ok) {
        setGroups((prev) => prev.filter((g) => g.id !== id));
        if (activeGroup?.id === id) setActiveGroup(null);
      } else alert('Erreur lors de la suppression.');
    } catch {
      alert('Impossible de joindre le serveur.');
    }
  };

  const handleLeave = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Quitter ce groupe ?')) return;
    try {
      const res = await fetch(`${API}/groups/${id}/leave`, { method: 'DELETE', headers });
      if (res.ok) {
        setGroups((prev) => prev.filter((g) => g.id !== id));
        if (activeGroup?.id === id) setActiveGroup(null);
      } else alert('Erreur en quittant le groupe.');
    } catch {
      alert('Impossible de joindre le serveur.');
    }
  };

  const openMembers = async (e, group) => {
    e.stopPropagation();
    setMembersModal(group);
    setLoadingMembers(true);
    try {
      const res = await fetch(`${API}/groups/${group.id}/members`, { headers });
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
    } finally { setLoadingMembers(false); }
  };

  const handleExpel = async (userId) => {
    if (!membersModal || !window.confirm('Expulser cet étudiant du groupe ?')) return;
    const res = await fetch(`${API}/groups/${membersModal.id}/members/${userId}`, {
      method: 'DELETE', headers,
    });
    if (!res.ok) { alert('Erreur lors de l\'expulsion.'); return; }
    setMembers((prev) => prev.filter((m) => m.id !== userId));
    setGroups((prev) => prev.map((g) =>
        g.id === membersModal.id ? { ...g, member_count: Math.max(0, (g.member_count || 1) - 1) } : g));
  };

  const groupMessages = activeGroup ? (messages[activeGroup.id] || []) : [];

  return (
    <div className={`groupes_page${activeGroup ? ' chat_open' : ''}`}>

      {}
      <div className="groupes_list_panel">
        <div className="groupes_list_header">
          <h3>Mes Groupes</h3>
          {isProfessor && (
            <button className="add_group_btn" onClick={openModal} title="Créer un groupe">+</button>
          )}
        </div>

        {fetchError && <p style={{ color: '#DC2626', textAlign: 'center', margin: '12px 0', fontSize: 13 }}>{fetchError}</p>}
        {groups.length === 0 && !fetchError ? (
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
            {isProfessor && g.created_by === user?.id ? (
              <div className="group_item_actions">
                <button className="group_action_btn" onClick={(e) => openMembers(e, g)} title="Gérer les membres">
                  <UsersIcon />
                </button>
                <button className="group_action_btn danger" onClick={(e) => handleDelete(e, g.id)} title="Supprimer le groupe">
                  <TrashIcon />
                </button>
              </div>
            ) : !isProfessor && (
              <button className="group_action_btn danger" onClick={(e) => handleLeave(e, g.id)} title="Quitter le groupe">
                <LeaveIcon />
              </button>
            )}
          </div>
        ))}
      </div>

      {}
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
                <p>{(onlineByGroup[activeGroup.id]?.length || 0)} en ligne · {activeGroup.member_count ?? '—'} membres{activeGroup.filiere ? ` · ${activeGroup.filiere}` : ''}</p>
              </div>
              <button
                className={`online_toggle_btn${showOnline ? ' active' : ''}`}
                onClick={() => setShowOnline((v) => !v)}
                title="Membres en ligne"
              >
                <UsersIcon />
                <span className="online_toggle_count">{onlineByGroup[activeGroup.id]?.length || 0}</span>
              </button>
              {!isProfessor && (
                <button
                  className="group_leave_header_btn"
                  onClick={(e) => handleLeave(e, activeGroup.id)}
                  title="Quitter le groupe"
                >
                  <LeaveIcon /> Quitter
                </button>
              )}
              {isProfessor && activeGroup.created_by === user?.id && (
                <button
                  className="group_leave_header_btn manage"
                  onClick={(e) => openMembers(e, activeGroup)}
                  title="Gérer les membres"
                >
                  <UsersIcon /> Gérer
                </button>
              )}
            </div>

            <div className="chat_main_row">
            <div className="chat_left">
            <div className="group_messages">
              {groupMessages.map((msg, i) => {
                const isOwn    = msg.sender_id === user?.id;
                const prev     = groupMessages[i - 1];
                const isGrouped = prev && prev.sender_id === msg.sender_id;
                return (
                  <div className={`chat_msg_row${isOwn ? ' own' : ''}${isGrouped ? ' chat_msg_grouped' : ''}`} key={msg.id || i}>
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
                        <div className={`chat_msg_bubble${isOwn ? ' own' : ''}`}>{msg.content}</div>
                      )}
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
              <input ref={fileRef} type="file" hidden onChange={handleFile} />
              <button className="attach_btn" onClick={() => fileRef.current?.click()} disabled={uploading} title="Joindre un fichier">
                <ClipIcon />
              </button>
              <input
                className="chat_input_field"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={uploading ? 'Envoi du fichier...' : `Message dans ${activeGroup.name}…`}
              />
              <button className="send_btn" onClick={handleSend} disabled={!text.trim()}>
                <SendIcon />
              </button>
            </div>
            </div>

            <div className={`chat_online_panel${showOnline ? ' open' : ''}`}>
              <div className="online_panel_title">
                <span className="online_dot" /> En ligne — {onlineByGroup[activeGroup.id]?.length || 0}
              </div>
              <div className="online_panel_list">
                {(onlineByGroup[activeGroup.id] || []).map((u) => (
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
                {(onlineByGroup[activeGroup.id]?.length || 0) === 0 && (
                  <div className="online_empty">Personne en ligne</div>
                )}
              </div>
            </div>
            </div>
          </>
        ) : (
          <div className="no_group_selected">
            <div className="no_group_selected_icon"><GroupIconSvg /></div>
            Sélectionnez un groupe pour commencer
          </div>
        )}
      </div>

      {}
      {showModal && (
        <div className="modal_overlay" onClick={() => setShowModal(false)}>
          <div className={`modal_box${step === 2 ? ' modal_box_wide' : ''}`} onClick={(e) => e.stopPropagation()}>

            {}
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

            {}
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

      {}
      {membersModal && (
        <div className="modal_overlay" onClick={() => setMembersModal(null)}>
          <div className="modal_box modal_box_wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal_step_header">
              <h3>Membres du groupe</h3>
              <span className="modal_step_badge">{members.length}</span>
            </div>
            <div className="group_modal_meta">
              <strong>{membersModal.name}</strong>{membersModal.filiere ? ` · ${membersModal.filiere}` : ''}
            </div>

            {loadingMembers ? (
              <div className="students_empty">Chargement...</div>
            ) : (
              <div className="members_manage_list">
                {members.map((m) => (
                  <div className="member_manage_item" key={m.id}>
                    <div className="member_manage_avatar" style={{ background: colorFor(m.username) }}>
                      {getInitials(m.username)}
                    </div>
                    <div className="member_manage_info">
                      <span className="member_manage_name">{m.username}</span>
                      <span className="member_manage_role">
                        {m.role === 'professor' ? 'Professeur (créateur)' : 'Étudiant'}
                      </span>
                    </div>
                    {m.role !== 'professor' && (
                      <button className="member_expel_btn" onClick={() => handleExpel(m.id)} title="Expulser">
                        Expulser
                      </button>
                    )}
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="students_empty">Aucun membre.</div>
                )}
              </div>
            )}

            <div className="modal_actions">
              <button className="modal_cancel" onClick={() => setMembersModal(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groupes;
