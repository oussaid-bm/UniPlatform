import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import API from '../../config';
import './Demandes.css';

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const AdminIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
  </svg>
);
const ProfIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
    <path d="M12 11v4M10 13h4"/>
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const CalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const InboxIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
  </svg>
);
const ReplyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
  </svg>
);

const STATUS_LABELS = { repondu: 'Répondu', en_attente: 'En attente', refuse: 'Refusé' };

const SERVICES_ADMIN = [
  'Scolarité',
  'Direction',
  'Bibliothèque',
  'Service des examens',
  'Service financier',
  'Ressources humaines',
];

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/* ── Carte demande ── définie en dehors pour éviter le re-mount ──── */
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
      {canReply && (
        <button className="demande_btn reply" onClick={() => onReply(d)}>
          <ReplyIcon /> Répondre
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

/* ── Composant principal ─────────────────────────────────────────── */
const Demandes = () => {
  const { user, token } = useSelector((s) => s.auth);
  const isProfessor = user?.role === 'professor';

  const [demandes,   setDemandes]   = useState([]);
  const [professors, setProfessors] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState('students');

  /* ── État modal création ──────────────────────────────────────── */
  const [showModal,      setShowModal]      = useState(false);
  const [formTitle,      setFormTitle]      = useState('');
  const [formContent,    setFormContent]    = useState('');
  const [formRecipType,  setFormRecipType]  = useState('admin');
  const [formRecipId,    setFormRecipId]    = useState('');
  const [formService,    setFormService]    = useState('');
  const [sending,        setSending]        = useState(false);

  /* ── État modal réponse ───────────────────────────────────────── */
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
  }, [token]); // eslint-disable-line

  const openCreate = () => {
    setFormTitle('');
    setFormContent('');
    setFormRecipType('admin');
    setFormRecipId('');
    setFormService('');
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSending(true);
    try {
      const body = {
        title: formTitle,
        content: formContent,
        recipient_type: formRecipType,
        recipient_id: formRecipType === 'professor' ? formRecipId : undefined,
        service: formRecipType === 'admin' ? formService : undefined,
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

  /* ── VUE PROFESSEUR ─────────────────────────────────────────────── */
  if (isProfessor) {
    const fromStudents    = demandes?.fromStudents  || [];
    const profExchanges   = demandes?.profExchanges || [];
    const pendingStudents = fromStudents.filter((d) => d.status === 'en_attente').length;
    const pendingProfs    = profExchanges.filter((d) => d.status === 'en_attente' && d.recipient_id === user?.id).length;
    const canSend = formTitle.trim() && formContent.trim() &&
      (formRecipType === 'professor' ? !!formRecipId : !!formService);

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

        {/* Modal création (prof) */}
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
              <div className="service_label">Destinataire</div>
              <div className="service_selector">
                <button
                  type="button"
                  className={`service_btn ${formRecipType === 'admin' ? 'active' : ''}`}
                  onClick={() => { setFormRecipType('admin'); setFormRecipId(''); setFormService(''); }}
                >
                  <AdminIcon /> Administration
                </button>
                <button
                  type="button"
                  className={`service_btn ${formRecipType === 'professor' ? 'active' : ''}`}
                  onClick={() => { setFormRecipType('professor'); setFormRecipId(''); setFormService(''); }}
                >
                  <ProfIcon /> Professeur
                </button>
              </div>
              {formRecipType === 'admin' && (
                <select value={formService} onChange={(e) => setFormService(e.target.value)}>
                  <option value="">— Choisir un service —</option>
                  {SERVICES_ADMIN.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              {formRecipType === 'professor' && (
                <select value={formRecipId} onChange={(e) => setFormRecipId(e.target.value)}>
                  <option value="">— Choisir un collègue —</option>
                  {professors.filter((p) => p.id !== user?.id).map((p) => (
                    <option key={p.id} value={p.id}>{p.username}</option>
                  ))}
                </select>
              )}
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

        {/* Modal réponse */}
        {replyModal && (
          <div className="modal_overlay" onClick={() => setReplyModal(null)}>
            <div className="modal_box" onClick={(e) => e.stopPropagation()}>
              <h3>Répondre à la demande</h3>
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

  /* ── VUE ÉTUDIANT / ADMIN ──────────────────────────────────────── */
  const myDemandes = Array.isArray(demandes) ? demandes : [];
  const canSendStudent = formTitle.trim() && formContent.trim() &&
    (formRecipType === 'professor' ? !!formRecipId : !!formService);

  return (
    <div className="demandes_page">
      <div className="demandes_header">
        <div>
          <h2>Mes Demandes</h2>
          <p>Envoyez des demandes à l'administration ou à vos professeurs</p>
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

      {/* Modal création (étudiant) */}
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
            <div className="service_label">Destinataire</div>
            <div className="service_selector">
              <button
                type="button"
                className={`service_btn ${formRecipType === 'admin' ? 'active' : ''}`}
                onClick={() => { setFormRecipType('admin'); setFormRecipId(''); setFormService(''); }}
              >
                <AdminIcon /> Administration
              </button>
              <button
                type="button"
                className={`service_btn ${formRecipType === 'professor' ? 'active' : ''}`}
                onClick={() => { setFormRecipType('professor'); setFormRecipId(''); setFormService(''); }}
              >
                <ProfIcon /> Professeur
              </button>
            </div>
            {formRecipType === 'admin' && (
              <select value={formService} onChange={(e) => setFormService(e.target.value)}>
                <option value="">— Choisir un service —</option>
                {SERVICES_ADMIN.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            {formRecipType === 'professor' && (
              <select value={formRecipId} onChange={(e) => setFormRecipId(e.target.value)}>
                <option value="">— Choisir un professeur —</option>
                {professors.map((p) => (
                  <option key={p.id} value={p.id}>{p.username}</option>
                ))}
              </select>
            )}
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
