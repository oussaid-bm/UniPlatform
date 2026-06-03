// ─────────────────────────────────────────────────────────────────────────────
//  FILEPANEL — panneau "Fichiers" dans la salle de cours
//  Le professeur dépose des PDF (supports de cours) ; tout le monde les télécharge.
//  Glisser-déposer ou clic ; affiche la liste avec taille et auteur.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useRef, useCallback } from 'react';
import API from '../config';

/* ── Icônes ─────────────────────────────────────────────────────────────── */
const PdfIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="15" y2="17"/>
    <line x1="9" y1="9" x2="11" y2="9"/>
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ── Composant principal ─────────────────────────────────────────────────── */
const FilePanel = ({ courseId, token, isProfessor }) => {
  const [files,     setFiles]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const inputRef = useRef(null);

  /* ── Chargement de la liste ─────────────────────────────────────────── */
  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/files/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setFiles(await res.json());
    } catch {
      setError('Impossible de charger les fichiers.');
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  /* ── Upload ─────────────────────────────────────────────────────────── */
  const uploadFile = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Seuls les fichiers PDF sont acceptés.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('Fichier trop lourd (max 25 Mo).');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API}/files/upload/${courseId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur upload.');
      setFiles(prev => [data, ...prev]);
      setSuccess(`✅ "${file.name}" déposé avec succès.`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  /* ── Drag & drop ─────────────────────────────────────────────────────── */
  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = ()  => setDragOver(false);
  const handleDrop      = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  /* ── Téléchargement ─────────────────────────────────────────────────── */
  const handleDownload = (file) => {
    const url = `${API}/files/download/${file.id}`;
    const a   = document.createElement('a');
    a.href    = url;
    a.setAttribute('download', file.original_name);

    // Ajouter l'auth via fetch + blob pour éviter le blocage CORS
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        a.href = URL.createObjectURL(blob);
        a.download = file.original_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      })
      .catch(() => setError('Erreur lors du téléchargement.'));
  };

  /* ── Suppression ────────────────────────────────────────────────────── */
  const handleDelete = async (file) => {
    if (!window.confirm(`Supprimer "${file.original_name}" ?`)) return;
    try {
      const res = await fetch(`${API}/files/${file.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setSuccess('Fichier supprimé.');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Erreur lors de la suppression.');
    }
  };

  /* ── Rendu ──────────────────────────────────────────────────────────── */
  return (
    <div className="file_panel">

      {/* Zone de dépôt (prof uniquement) */}
      {isProfessor && (
        <div
          className={`file_drop_zone ${dragOver ? 'drag_over' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          {uploading ? (
            <>
              <div className="file_spinner" />
              <span>Envoi en cours...</span>
            </>
          ) : (
            <>
              <UploadIcon />
              <span>Cliquez ou glissez un PDF ici</span>
              <small>PDF uniquement · max 25 Mo</small>
            </>
          )}
        </div>
      )}

      {/* Messages */}
      {error   && <div className="file_msg error">{error}</div>}
      {success && <div className="file_msg success">{success}</div>}

      {/* Liste des fichiers */}
      <div className="file_list">
        {loading ? (
          <div className="file_empty"><div className="file_spinner" /></div>
        ) : files.length === 0 ? (
          <div className="file_empty">
            <PdfIcon />
            <span>Aucun fichier déposé</span>
            {isProfessor && <small>Déposez votre premier PDF ci-dessus</small>}
          </div>
        ) : (
          files.map(file => (
            <div key={file.id} className="file_item">
              <div className="file_icon"><PdfIcon /></div>
              <div className="file_info">
                <span className="file_name" title={file.original_name}>
                  {file.original_name}
                </span>
                <span className="file_meta">
                  {formatSize(file.size)} · {formatDate(file.created_at)} · {file.uploader_name}
                </span>
              </div>
              <div className="file_actions">
                <button
                  className="file_btn download"
                  onClick={() => handleDownload(file)}
                  title="Télécharger"
                >
                  <DownloadIcon />
                </button>
                {isProfessor && (
                  <button
                    className="file_btn delete"
                    onClick={() => handleDelete(file)}
                    title="Supprimer"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FilePanel;
