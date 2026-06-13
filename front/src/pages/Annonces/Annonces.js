
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FILIERES } from '../../filieres';
import API from '../../config';
import { BellIcon, PlusIcon } from '../../components/Icons';
import { colorById, getInitials, formatDateLong } from '../../utils/formatting';
import './Annonces.css';

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
            const color = colorById(a.id);
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
                    Prof. {a.author_name} · {formatDateLong(a.created_at)}
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
