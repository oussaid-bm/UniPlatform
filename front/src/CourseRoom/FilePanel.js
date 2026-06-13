
import React, { useEffect, useState, useRef, useCallback } from 'react';
import API from '../config';
import { PdfIcon, DownloadIcon, TrashIconFull, UploadIcon } from '../components/Icons';
import { formatSize, formatDateShort } from '../utils/formatting';

const FilePanel = ({ courseId, token, isProfessor }) => {
  const [files,     setFiles]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const inputRef = useRef(null);

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
      setSuccess(`"${file.name}" déposé avec succès.`);
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

  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = ()  => setDragOver(false);
  const handleDrop      = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDownload = (file) => {
    const url = `${API}/files/download/${file.id}`;
    const a   = document.createElement('a');
    a.href    = url;
    a.setAttribute('download', file.original_name);

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

  return (
    <div className="file_panel">

      {}
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

      {}
      {error   && <div className="file_msg error">{error}</div>}
      {success && <div className="file_msg success">{success}</div>}

      {}
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
                  {formatSize(file.size)} · {formatDateShort(file.created_at)} · {file.uploader_name}
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
                    <TrashIconFull />
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
