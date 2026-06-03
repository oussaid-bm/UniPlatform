// ─────────────────────────────────────────────────────────────────────────────
//  PAGE COURS EN LIGNE (visioconférence)
//  Liste les sessions vidéo. Le prof crée une session puis entre dans la salle ;
//  l'étudiant rejoint une session "EN DIRECT". Un clic ouvre la salle (CourseRoom).
//  Ce sont les cours avec is_live_session = 1 (séparés des cours PDF classiques).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../../socketConnection/socketConn';
import { FILIERES } from '../../filieres';
import API from '../../config';
import './CoursEnLigne.css';

const BANNER_COLORS = ['#1B2B4B', '#7C3AED', '#0891B2', '#059669', '#C8963E', '#DB2777'];
const colorFor = (id) => BANNER_COLORS[id % BANNER_COLORS.length];

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const EnterIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
    <polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const CamIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);

const CoursEnLigne = () => {
  const { user, token } = useSelector((s) => s.auth);
  const navigate = useNavigate();
  const isProfessor = user?.role === 'professor';

  const [sessions,   setSessions]   = useState([]);
  const [liveSessions, setLiveSessions] = useState({});
  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState({ title: '', filiere: '' });
  const [creating,   setCreating]   = useState(false);
  const [camModal,   setCamModal]   = useState(null);
  const [camError,   setCamError]   = useState('');
  const [checking,   setChecking]   = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    // Charge uniquement les sessions live (is_live_session = 1)
    fetch(`${API}/courses`, { headers })
      .then((r) => r.json())
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        if (isProfessor) {
          setSessions(all.filter((c) => c.is_live_session));
        } else {
          setSessions(all.filter((c) => c.is_live_session));
        }
      })
      .catch(() => {});

    const socket = getSocket();
    if (!socket) return;
    socket.emit('get-live-courses');
    socket.on('live-courses-update', (data) => setLiveSessions(data || {}));
    return () => socket.off('live-courses-update');
  }, [token]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/courses`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, filiere: form.filiere, is_live_session: 1 }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessions((prev) => [data, ...prev]);
        setForm({ title: '', filiere: '' });
        setShowModal(false);
      }
    } finally { setCreating(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette session ?')) return;
    const res = await fetch(`${API}/courses/${id}`, { method: 'DELETE', headers });
    if (res.ok) setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleStart = (sessionId) => navigate(`/app/cours/${sessionId}`);

  const openCamModal = (sessionId) => {
    setCamError('');
    setCamModal({ sessionId });
  };

  const handleJoinWithCam = async () => {
    setChecking(true);
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
      navigate(`/app/cours/${camModal.sessionId}`);
      setCamModal(null);
    } catch {
      setCamError('Accès à la caméra refusé. Veuillez autoriser la caméra pour rejoindre.');
    } finally { setChecking(false); }
  };

  return (
    <div className="live_page">
      <div className="live_page_header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2>Cours en ligne</h2>
          <p>
            {isProfessor
              ? 'Créez et gérez vos sessions de visioconférence'
              : 'Rejoignez les sessions en direct de vos professeurs'}
          </p>
        </div>
        {isProfessor && (
          <button className="create_session_btn" onClick={() => setShowModal(true)}>
            <PlusIcon /> Nouvelle session
          </button>
        )}
      </div>

      {/* ── VUE PROFESSEUR ─────────────────────────────────── */}
      {isProfessor && (
        <>
          {sessions.length === 0 ? (
            <div className="live_empty">
              <div className="live_empty_icon"><VideoIcon /></div>
              <p>Aucune session créée.</p>
              <p style={{ fontSize: 13 }}>Cliquez sur "Nouvelle session" pour en créer une.</p>
            </div>
          ) : (
            <>
              <div className="live_section_label">Vos sessions</div>
              <div className="live_grid">
                {sessions.map((s) => {
                  const isLive = !!liveSessions[s.id];
                  return (
                    <div className="live_card" key={s.id}>
                      <div className="live_card_banner" style={{ background: colorFor(s.id) }}>
                        <div className="live_card_banner_icon"><VideoIcon /></div>
                        {isLive && (
                          <div className="live_badge">
                            <div className="live_badge_dot" /> EN DIRECT
                          </div>
                        )}
                      </div>
                      <div className="live_card_body">
                        <div className="live_card_title">{s.title}</div>
                        {s.filiere && (
                          <div className="live_session_filiere">{s.filiere}</div>
                        )}
                        <div className="live_card_meta">
                          <span><UserIcon /> Prof. {s.professor_name}</span>
                        </div>
                        <div className="live_card_actions">
                          {!isLive ? (
                            <button className="btn_start" onClick={() => handleStart(s.id)}>
                              <PlayIcon /> Démarrer
                            </button>
                          ) : (
                            <button className="btn_enter" onClick={() => handleStart(s.id)}>
                              <EnterIcon /> Retourner dans la salle
                            </button>
                          )}
                          <button className="btn_delete_session" onClick={() => handleDelete(s.id)} title="Supprimer">
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── VUE ÉTUDIANT ───────────────────────────────────── */}
      {!isProfessor && (
        <>
          {sessions.length === 0 ? (
            <div className="live_empty">
              <div className="live_empty_icon"><VideoIcon /></div>
              <p>Aucune session disponible pour le moment.</p>
              <p style={{ fontSize: 13 }}>Revenez quand un professeur lance un cours.</p>
            </div>
          ) : (
            <>
              <div className="live_grid">
                {sessions.map((s) => {
                  const isLive = !!liveSessions[s.id];
                  return (
                    <div className="live_card" key={s.id}>
                      <div className="live_card_banner" style={{ background: colorFor(s.id) }}>
                        <div className="live_card_banner_icon"><VideoIcon /></div>
                        {isLive ? (
                          <div className="live_badge">
                            <div className="live_badge_dot" /> EN DIRECT
                          </div>
                        ) : (
                          <div className="live_badge live_badge_waiting">En attente</div>
                        )}
                      </div>
                      <div className="live_card_body">
                        <div className="live_card_title">{s.title}</div>
                        {s.filiere && (
                          <div className="live_session_filiere">{s.filiere}</div>
                        )}
                        <div className="live_card_meta">
                          <span><UserIcon /> Prof. {s.professor_name}</span>
                        </div>
                        <div className="live_card_actions">
                          <button
                            className={isLive ? 'btn_join' : 'btn_join btn_join_disabled'}
                            onClick={() => isLive && openCamModal(s.id)}
                            disabled={!isLive}
                          >
                            <ArrowIcon /> {isLive ? 'Rejoindre' : 'Pas encore démarré'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── MODAL CRÉATION SESSION ─────────────────────────── */}
      {showModal && (
        <div className="modal_overlay" onClick={() => setShowModal(false)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <div className="modal_cam_icon"><VideoIcon /></div>
            <h3>Nouvelle session en ligne</h3>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                placeholder="Titre de la session *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
              <select
                value={form.filiere}
                onChange={(e) => setForm({ ...form, filiere: e.target.value })}
              >
                <option value="">Toutes les filières</option>
                {FILIERES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="modal_actions">
              <button className="modal_cancel" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="modal_confirm" onClick={handleCreate} disabled={creating || !form.title.trim()}>
                {creating ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CAMÉRA ───────────────────────────────────── */}
      {camModal && (
        <div className="modal_overlay" onClick={() => setCamModal(null)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <div className="modal_cam_icon"><CamIcon /></div>
            <h3>Caméra requise</h3>
            <p>Pour rejoindre ce cours en direct, votre caméra doit être activée.</p>
            {camError && <div className="modal_error">{camError}</div>}
            <div className="modal_actions">
              <button className="modal_cancel" onClick={() => setCamModal(null)}>Annuler</button>
              <button className="modal_confirm" onClick={handleJoinWithCam} disabled={checking}>
                {checking ? 'Vérification...' : 'Rejoindre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursEnLigne;
