
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setCourses, addCourse, removeCourse } from '../../store/slices/coursesSlice';
import FilePanel       from '../../CourseRoom/FilePanel';
import SubmissionPanel from '../../CourseRoom/SubmissionPanel';
import './CoursDevoirs.css';
import API from '../../config';
import { FILIERES } from '../../filieres';

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
  </svg>
);
const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
);
const TaskIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
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
const ChevronIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const formatDate = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

const CoursDevoirs = () => {
  const dispatch = useDispatch();
  const { user, token } = useSelector((s) => s.auth);
  const { courses } = useSelector((s) => s.courses);

  const [showModal,   setShowModal]   = useState(false);
  const [form,        setForm]        = useState({ title: '', description: '', type: 'cours', filiere: '' });
  const [creating,    setCreating]    = useState(false);
  const [openFilesId, setOpenFilesId] = useState(null);
  const [filter,      setFilter]      = useState('tous'); 

  const isProfessor = user?.role === 'professor';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/courses`, { headers })
      .then((r) => r.json())
      .then((data) => dispatch(setCourses(Array.isArray(data) ? data : [])))
      .catch(() => {});
  }, [token]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/courses`, {
        method: 'POST', headers,
        body: JSON.stringify({ title: form.title, description: form.description, filiere: form.filiere, type: form.type }),
      });
      const data = await res.json();
      if (res.ok) {
        dispatch(addCourse({ ...data, professor_name: user.username, type: form.type }));
        setForm({ title: '', description: '', type: 'cours', filiere: '' });
        setShowModal(false);
      }
    } finally { setCreating(false); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce cours ?')) return;
    const res = await fetch(`${API}/courses/${id}`, { method: 'DELETE', headers });
    if (res.ok) { dispatch(removeCourse(id)); if (openFilesId === id) setOpenFilesId(null); }
  };

  const toggleFiles = (id, e) => {
    e.stopPropagation();
    setOpenFilesId(prev => prev === id ? null : id);
  };

  const displayed = courses
    .filter(c => !c.is_live_session)
    .filter(c => filter === 'tous' || (c.type || 'cours') === filter);

  return (
    <div className="cours_page">

      {}
      <div className="cours_page_header">
        <div>
          <h2>Cours &amp; Devoirs</h2>
          <p>Déposez et consultez les fichiers de vos cours</p>
        </div>
        {isProfessor && (
          <button className="create_cours_btn" onClick={() => setShowModal(true)}>
            <PlusIcon /> Ajouter un cours
          </button>
        )}
      </div>

      {}
      <div className="cours_filters">
        {['tous', 'cours', 'devoir'].map(f => (
          <button key={f} className={`filter_btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'tous' ? 'Tous' : f === 'cours' ? 'Cours' : 'Devoirs'}
          </button>
        ))}
      </div>

      {}
      <div className="cours_list">
        {displayed.length === 0 ? (
          <div className="cours_empty">
            <BookIcon />
            <span>Aucun cours disponible.</span>
          </div>
        ) : (
          displayed.map((c) => {
            const type      = c.type || 'cours';
            const isOpen    = openFilesId === c.id;
            const isOwner   = isProfessor && c.professor_id === user?.id;

            return (
              <div className={`cours_item ${isOpen ? 'open' : ''}`} key={c.id}>

                {}
                <div className={`cours_card ${type}`}>
                  {}
                  <div className={`cours_type_icon ${type}`}>
                    {type === 'cours' ? <BookIcon /> : <TaskIcon />}
                  </div>

                  {}
                  <div className="cours_info">
                    <div className="cours_title_row">
                      <span className="cours_title">{c.title}</span>
                      <span className={`cours_badge ${type}`}>
                        {type === 'cours' ? 'Cours' : 'Devoir'}
                      </span>
                      {c.filiere && <span className="cours_filiere_tag">{c.filiere}</span>}
                    </div>
                    <div className="cours_desc">{c.description || 'Aucune description.'}</div>
                    <div className="cours_meta">
                      <span><UserIcon /> {c.professor_name}</span>
                      <span><CalIcon /> {formatDate(c.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="cours_actions">
                    <button
                      className={`cours_btn files ${isOpen ? 'active' : ''}`}
                      onClick={(e) => toggleFiles(c.id, e)}
                      title="Gérer les fichiers"
                    >
                      <FolderIcon />
                      <span>Fichiers</span>
                      <ChevronIcon open={isOpen} />
                    </button>

                    {isOwner && (
                      <button className="cours_btn danger" onClick={(e) => handleDelete(c.id, e)} title="Supprimer">
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>

                {}
                {isOpen && (
                  <div className="cours_files_panel">
                    <FilePanel courseId={c.id} token={token} isProfessor={isOwner} />
                    {type === 'devoir' && (
                      <SubmissionPanel courseId={c.id} token={token} isProfessor={isOwner} />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {}
      {showModal && (
        <div className="modal_overlay" onClick={() => setShowModal(false)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <h3>Ajouter un cours / devoir</h3>
            <input
              placeholder="Titre *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <textarea
              rows={3}
              placeholder="Description (optionnel)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="cours">Cours</option>
              <option value="devoir">Devoir</option>
            </select>
            <select value={form.filiere} onChange={(e) => setForm({ ...form, filiere: e.target.value })}>
              <option value="">Toutes les filières</option>
              {FILIERES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <div className="modal_actions">
              <button className="modal_cancel" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="modal_confirm" onClick={handleCreate} disabled={creating || !form.title.trim()}>
                {creating ? 'Création...' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursDevoirs;
