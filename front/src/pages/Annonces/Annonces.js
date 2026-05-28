import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FILIERES } from '../../filieres';
import API from '../../config';
import './Annonces.css';

const ACCENT_COLORS = ['#4F46E5', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DB2777'];
const colorFor = (id) => ACCENT_COLORS[id % ACCENT_COLORS.length];
const getInitials = (name = '') => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const BellIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('fr-DZ', { day: 'numeric', month: 'long', year: 'numeric' });

const Annonces = () => {
  const { user, token } = useSelector((s) => s.auth);
  const [annonces, setAnnonces] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', filiere: '' });
  const [saving, setSaving] = useState(false);

  const canPost = ['professor', 'admin'].includes(user?.role);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/announcements`, { headers })
      .then((r) => r.json())
      .then((data) => setAnnonces(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [token]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/announcements`, {
        method: 'POST', headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setAnnonces((prev) => [data, ...prev]);
        setForm({ title: '', content: '', filiere: '' });
        setShowModal(false);
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette annonce ?')) return;
    const res = await fetch(`${API}/announcements/${id}`, { method: 'DELETE', headers });
    if (res.ok) setAnnonces((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="annonces_page">
      <div className="annonces_topbar">
        <div className="annonces_topbar_left">
          <h2>Annonces</h2>
          <p>
            {user?.filiere
              ? `Annonces pour ${user.filiere} et générales`
              : 'Toutes les annonces universitaires'}
          </p>
        </div>
        {canPost && (
          <button className="new_annonce_btn" onClick={() => setShowModal(true)}>
            <PlusIcon /> Nouvelle annonce
          </button>
        )}
      </div>

      <div className="annonces_list">
        {annonces.length === 0 ? (
          <div className="annonces_empty">
            <div className="annonces_empty_icon"><BellIcon /></div>
            <p>Aucune annonce pour le moment.</p>
            {canPost && <p style={{ fontSize: 13 }}>Publiez la première annonce pour vos étudiants.</p>}
          </div>
        ) : (
          annonces.map((a) => {
            const color = colorFor(a.id);
            const canDelete = user?.role === 'admin' || a.author_id === user?.id;
            return (
              <div className="annonce_card" key={a.id}>
                <div className="annonce_card_accent" style={{ background: color }} />
                <div className="annonce_card_header">
                  <div className="annonce_title">{a.title}</div>
                  <span className={`annonce_filiere_badge ${!a.filiere ? 'all' : ''}`}>
                    {a.filiere || 'Toutes filières'}
                  </span>
                </div>
                <div className="annonce_content">{a.content}</div>
                <div className="annonce_footer">
                  <div className="annonce_author">
                    <div className="annonce_author_avatar" style={{ background: color }}>
                      {getInitials(a.author_name)}
                    </div>
                    Prof. {a.author_name} · {formatDate(a.created_at)}
                  </div>
                  {canDelete && (
                    <button className="annonce_delete_btn" onClick={() => handleDelete(a.id)}>
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="modal_overlay" onClick={() => setShowModal(false)}>
          <div className="modal_box" onClick={(e) => e.stopPropagation()}>
            <h3>Nouvelle annonce</h3>
            <input
              placeholder="Titre de l'annonce"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
            <textarea
              placeholder="Contenu de l'annonce..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
            <select
              value={form.filiere}
              onChange={(e) => setForm({ ...form, filiere: e.target.value })}
            >
              <option value="">Toutes les filières</option>
              {FILIERES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <div className="modal_actions">
              <button className="modal_cancel" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="modal_confirm" onClick={handleCreate} disabled={saving}>
                {saving ? '...' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Annonces;
