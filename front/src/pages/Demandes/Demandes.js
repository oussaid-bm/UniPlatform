
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import API from '../../config';
import { SendIcon, UserIcon, CalIcon, InboxIcon, TrashIcon, ReplyIcon } from '../../components/Icons';
import { formatDate } from '../../utils/formatting';
import './Demandes.css';

const STATUS_LABELS = { repondu: 'Répondu', en_attente: 'En attente', refuse: 'Refusé' };

const DemandeCard = ({ d, canReply, showSender, currentUserId, onReply, onDelete }) => (
  <div className={`demande_card ${d.status}`}>
    <div className="demande_card_header">
      <span className="demande_title">{d.title}</span>
      <span className={`status_badge ${d.status}`}>{STATUS_LABELS[d.status] || d.status}</span>
    </div>
    <div className="demande_meta">
      {showSender
        ? <span><UserIcon /> De : {d.sender_name}</span>
        : <span><UserIcon /> À : {d.recipient_name}</span>}
      <span><CalIcon /> {formatDate(d.created_at)}</span>
    </div>
    <div className="demande_content">« {d.content} »</div>
    {d.response && (
      <div className="demande_response">
        <span className="demande_response_label">Réponse :</span> {d.response}
      </div>
    )}
    <div className="demande_card_actions">
      {canReply && !d.response && (
        <button className="demande_btn reply" onClick={() => onReply(d)}>
          <ReplyIcon /> Répondre
        </button>
      )}
      {canReply && d.response && (
        <button className="demande_btn reply" onClick={() => onReply(d)}>
          <ReplyIcon /> Modifier la réponse
        </button>
      )}
      {d.sender_id === currentUserId && (
        <button className="demande_btn danger" onClick={() => onDelete(d.id)}>
          <TrashIcon />
        </button>
      )}
    </div>
  </div>
);

const Demandes = () => {
  const { user, token } = useSelector((s) => s.auth);
  const isProfessor = user?.role === 'professor';

  const [demandes,   setDemandes]   = useState([]);
  const [professors, setProfessors] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState('students');

  const [showModal,      setShowModal]      = useState(false);
  const [formTitle,      setFormTitle]      = useState('');
  const [formContent,    setFormContent]    = useState('');
  const [formRecipId,    setFormRecipId]    = useState('');
  const [sending,        setSending]        = useState(false);

  const [replyModal,    setReplyModal]    = useState(null);
  const [replyStatus,   setReplyStatus]   = useState('repondu');
  const [replyResponse, setReplyResponse] = useState('');
  const [saving,        setSaving]        = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/demandes`,        { headers }).then((r) => r.json()),
      fetch(`${API}/auth/professors`, { headers }).then((r) => r.json()),
    ])
      .then(([d, p]) => {
        setDemandes(d);
        setProfessors(Array.isArray(p) ? p : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]); 

  const openCreate = () => {
    setFormTitle('');
    setFormContent('');
    setFormRecipId('');
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSending(true);
    try {
      const body = {
        title: formTitle,
        content: formContent,
        recipient_type: 'professor',
        recipient_id: formRecipId,
      };
      const res  = await fetch(`${API}/demandes`, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        if (isProfessor) {
          setDemandes((prev) => ({
            fromStudents:  prev?.fromStudents  || [],
            profExchanges: [data, ...(prev?.profExchanges || [])],
          }));
        } else {
          setDemandes((prev) => [data, ...(Array.isArray(prev) ? prev : [])]);
        }
        setShowModal(false);
      }
    } finally { setSending(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette demande ?')) return;
    const res = await fetch(`${API}/demandes/${id}`, { method: 'DELETE', headers });
    if (!res.ok) return;
    if (isProfessor) {
      setDemandes((prev) => ({
        fromStudents:  prev?.fromStudents?.filter((d) => d.id !== id)  || [],
        profExchanges: prev?.profExchanges?.filter((d) => d.id !== id) || [],
      }));
    } else {
      setDemandes((prev) => prev.filter((d) => d.id !== id));
    }
  };

  const openReply = (d) => {
    setReplyModal(d);
    setReplyStatus(d.status !== 'en_attente' ? d.status : 'repondu');
    setReplyResponse(d.response || '');
  };

  const handleReply = async () => {
    if (!replyModal) return;
    setSaving(true);
    try {
      const res     = await fetch(`${API}/demandes/${replyModal.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ status: replyStatus, response: replyResponse }),
      });
      const updated = await res.json();
      if (res.ok) {
        if (isProfessor) {
          setDemandes((prev) => ({
            fromStudents:  prev?.fromStudents?.map((d)  => d.id === updated.id ? updated : d) || [],
            profExchanges: prev?.profExchanges?.map((d) => d.id === updated.id ? updated : d) || [],
          }));
        } else {
          setDemandes((prev) => prev.map((d) => d.id === updated.id ? updated : d));
        }
        setReplyModal(null);
      }
    } finally { setSaving(false); }
  };

  if (loading) return <div className="demandes_page"><p style={{ color: '#7A7060' }}>Chargement...</p></div>;

  if (isProfessor) {
    const fromStudents    = demandes?.fromStudents  || [];
    const profExchanges   = demandes?.profExchanges || [];
    const pendingStudents = fromStudents.filter((d) => d.status === 'en_attente').length;
    const pendingProfs    = profExchanges.filter((d) => d.status === 'en_attente' && d.recipient_id === user?.id).length;
    const canSend = formTitle.trim() && formContent.trim() && !!formRecipId;

    return (
      <div className="demandes_page">
        <div className="demandes_header">
          <div>
            <h2>Demandes</h2>
            <p>Gérez les demandes reçues et vos échanges avec les collègues</p>
          </div>
          <button className="new_demande_btn" onClick={openCreate}>
            <SendIcon /> Nouvelle demande
          </button>
        </div>

        <div className="demandes_tabs">
          <button className={`demandes_tab ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>
            Demandes étudiants
            {pendingStudents > 0 && <span className="tab_badge">{pendingStudents}</span>}
          </button>
          <button className={`demandes_tab ${tab === 'profs' ? 'active' : ''}`} onClick={() => setTab('profs')}>
            Échanges professeurs
            {pendingProfs > 0 && <span className="tab_badge">{pendingProfs}</span>}
          </button>
        </div>

        {tab === 'students' && (
          <div className="demandes_list">
            {fromStudents.length === 0 ? (
              <div className="demandes_empty"><InboxIcon /><span>Aucune demande d'étudiant.</span></div>
            ) : fromStudents.map((d) => (
              <DemandeCard key={d.id} d={d} canReply={d.recipient_id === user?.id}
                showSender currentUserId={user?.id} onReply={openReply} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {tab === 'profs' && (
          <div className="demandes_list">
            {profExchanges.length === 0 ? (
              <div className="demandes_empty"><InboxIcon /><span>Aucun échange avec des collègues.</span></div>
            ) : profExchanges.map((d) => (
              <DemandeCard key={d.id} d={d} canReply={d.recipient_id === user?.id}
                showSender={d.sender_id !== user?.id} currentUserId={user?.id}
                onReply={openReply} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {}
        {showModal && (
          <div className="modal_overlay" onClick={() => setShowModal(false)}>
            <div className="modal_box" onClick={(e) => e.stopPropagation()}>
              <h3>Nouvelle demande</h3>
              <input
                placeholder="Sujet *"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                autoFocus
              />
              <div className="service_label">Destinataire (professeur)</div>
              <select value={formRecipId} onChange={(e) => setFormRecipId(e.target.value)}>
                <option value="">— Choisir un collègue —</option>
                {professors.filter((p) => p.id !== user?.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.username}</option>
                ))}
              </select>
              <textarea
                rows={4}
                placeholder="Votre message *"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
              />
              <div className="modal_actions">
                <button className="modal_cancel" onClick={() => setShowModal(false)}>Annuler</button>
                <button className="modal_confirm" onClick={handleCreate} disabled={sending || !canSend}>
                  {sending ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {}
        {replyModal && (
          <div className="modal_overlay" onClick={() => setReplyModal(null)}>
            <div className="modal_box" onClick={(e) => e.stopPropagation()}>
              <h3>{replyModal.response ? 'Modifier la réponse' : 'Répondre à la demande'}</h3>
              <p style={{ fontSize: 13, color: '#7A7060', margin: 0 }}>"{replyModal.title}"</p>
              <select value={replyStatus} onChange={(e) => setReplyStatus(e.target.value)}>
                <option value="repondu">Répondu</option>
                <option value="refuse">Refusé</option>
                <option value="en_attente">En attente</option>
              </select>
              <textarea
                rows={4}
                placeholder="Votre réponse (optionnel)"
                value={replyResponse}
                onChange={(e) => setReplyResponse(e.target.value)}
              />
              <div className="modal_actions">
                <button className="modal_cancel" onClick={() => setReplyModal(null)}>Annuler</button>
                <button className="modal_confirm" onClick={handleReply} disabled={saving}>
                  {saving ? 'Enregistrement...' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const myDemandes = Array.isArray(demandes) ? demandes : [];
  const canSendStudent = formTitle.trim() && formContent.trim() && !!formRecipId;

  return (
    <div className="demandes_page">
      <div className="demandes_header">
        <div>
          <h2>Mes Demandes</h2>
          <p>Envoyez des demandes à vos professeurs</p>
        </div>
        <button className="new_demande_btn" onClick={openCreate}>
          <SendIcon /> Nouvelle demande
        </button>
      </div>

      <div className="demandes_list">
        {myDemandes.length === 0 ? (
          <div className="demandes_empty"><InboxIcon /><span>Aucune demande pour le moment.</span></div>
        ) : myDemandes.map((d) => (
          <DemandeCard key={d.id} d={d} canReply={false} showSender={false}
            currentUserId={user?.id} onReply={openReply} onDelete={handleDelete} />
        ))}
      </div>

      {}
      {showModal && (
        <div className="modal_overlay" onClick={() => setShowModal(false)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <h3>Nouvelle demande</h3>
            <input
              placeholder="Sujet *"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              autoFocus
            />
            <div className="service_label">Destinataire (professeur)</div>
            <select value={formRecipId} onChange={(e) => setFormRecipId(e.target.value)}>
              <option value="">— Choisir un professeur —</option>
              {professors.map((p) => (
                <option key={p.id} value={p.id}>{p.username}</option>
              ))}
            </select>
            <textarea
              rows={4}
              placeholder="Votre message *"
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
            />
            <div className="modal_actions">
              <button className="modal_cancel" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="modal_confirm" onClick={handleCreate} disabled={sending || !canSendStudent}>
                {sending ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Demandes;
