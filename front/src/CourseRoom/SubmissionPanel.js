
import React, { useEffect, useState, useRef, useCallback } from 'react';
import API from '../config';
import { UploadIcon, DownloadIcon, TrashIcon, PdfIconSimple } from '../components/Icons';
import { formatSize, formatDateShort } from '../utils/formatting';

const SubmissionPanel = ({ courseId, token, isProfessor }) => {
  const [submissions,  setSubmissions]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [uploading,    setUploading]    = useState(false);
  const [dragOver,     setDragOver]     = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [gradingId,    setGradingId]    = useState(null);
  const [gradeVal,     setGradeVal]     = useState('');
  const [gradeComment, setGradeComment] = useState('');
  const [gradingBusy,  setGradingBusy]  = useState(false);
  const inputRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/submissions/${courseId}`, { headers });
      if (!res.ok) throw new Error();
      setSubmissions(await res.json());
    } catch {
      setError('Impossible de charger les soumissions.');
    } finally {
      setLoading(false);
    }
  }, [courseId, token]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const uploadSubmission = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Seuls les fichiers PDF sont acceptés.'); return; }
    if (file.size > 25 * 1024 * 1024)  { setError('Fichier trop lourd (max 25 Mo).'); return; }
    setError(''); setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`${API}/submissions/upload/${courseId}`, {
        method: 'POST', headers, body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur upload.');
      setSubmissions([data]);
      setSuccess('Travail soumis avec succès !');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => { const f = e.target.files?.[0]; if (f) uploadSubmission(f); e.target.value = ''; };
  const handleDragOver  = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = ()  => setDragOver(false);
  const handleDrop      = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) uploadSubmission(f); };

  const handleDownload = (sub) => {
    fetch(`${API}/submissions/download/${sub.id}`, { headers })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = sub.original_name;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      })
      .catch(() => setError('Erreur lors du téléchargement.'));
  };

  const handleDelete = async (sub) => {
    if (!window.confirm(`Retirer "${sub.original_name}" ?`)) return;
    try {
      const res = await fetch(`${API}/submissions/${sub.id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error();
      setSubmissions(prev => prev.filter(s => s.id !== sub.id));
      setSuccess('Soumission retirée.'); setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Erreur lors de la suppression.'); }
  };

  const openGrading = (sub) => {
    setGradingId(sub.id);
    setGradeVal(sub.grade !== null && sub.grade !== undefined ? String(sub.grade) : '');
    setGradeComment(sub.grade_comment || '');
  };

  const submitGrade = async (subId) => {
    const g = gradeVal.trim();
    if (g !== '' && (isNaN(parseFloat(g)) || parseFloat(g) < 0 || parseFloat(g) > 20)) {
      setError('La note doit être entre 0 et 20.'); return;
    }
    setGradingBusy(true); setError('');
    try {
      const res = await fetch(`${API}/submissions/${subId}/grade`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: g === '' ? null : parseFloat(g), grade_comment: gradeComment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur.');
      setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, grade: data.grade, grade_comment: data.grade_comment } : s));
      setGradingId(null);
      setSuccess('Note enregistrée.'); setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.message); }
    finally { setGradingBusy(false); }
  };

  const mySubmission = !isProfessor ? submissions[0] : null;

  return (
    <div className="submission_panel">
      <div className="submission_panel_title">
        {isProfessor ? `Travaux rendus (${submissions.length})` : 'Remettre mon travail'}
      </div>

      {error   && <div className="file_msg error">{error}</div>}
      {success && <div className="file_msg success">{success}</div>}

      {}
      {!isProfessor && (
        <>
          {mySubmission ? (
            <div className="sub_existing">
              <div className="file_icon"><PdfIconSimple /></div>
              <div className="file_info">
                <span className="file_name">{mySubmission.original_name}</span>
                <span className="file_meta">{formatSize(mySubmission.size)} · soumis le {formatDateShort(mySubmission.created_at)}</span>
                {mySubmission.grade !== null && mySubmission.grade !== undefined && (
                  <div className="sub_grade_display">
                    <span className="sub_grade_value">{mySubmission.grade}/20</span>
                    {mySubmission.grade_comment && (
                      <span className="sub_grade_comment">{mySubmission.grade_comment}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="file_actions">
                <button className="file_btn download" onClick={() => handleDownload(mySubmission)} title="Télécharger"><DownloadIcon /></button>
                <button className="file_btn delete"   onClick={() => handleDelete(mySubmission)}   title="Retirer"><TrashIcon /></button>
              </div>
            </div>
          ) : null}

          <div
            className={`file_drop_zone sub_drop${dragOver ? ' drag_over' : ''}${uploading ? ' uploading' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFileInput} />
            {uploading ? (
              <><div className="file_spinner" /><span>Envoi en cours...</span></>
            ) : (
              <>
                <UploadIcon />
                <span>{mySubmission ? 'Remplacer mon travail' : 'Déposer mon travail'}</span>
                <small>PDF uniquement · max 25 Mo</small>
              </>
            )}
          </div>
        </>
      )}

      {}
      {isProfessor && (
        <div className="sub_list">
          {loading ? (
            <div className="file_empty"><div className="file_spinner" /></div>
          ) : submissions.length === 0 ? (
            <div className="file_empty"><PdfIconSimple /><span>Aucun travail rendu pour l'instant</span></div>
          ) : (
            submissions.map(sub => (
              <div key={sub.id} className="sub_prof_item">
                <div className="file_item" style={{ borderRadius: gradingId === sub.id ? '10px 10px 0 0' : undefined }}>
                  <div className="file_icon"><PdfIconSimple /></div>
                  <div className="file_info">
                    <span className="file_name">{sub.original_name}</span>
                    <span className="file_meta">{sub.student_name} · {formatSize(sub.size)} · {formatDateShort(sub.created_at)}</span>
                  </div>
                  <div className="file_actions">
                    {sub.grade !== null && sub.grade !== undefined
                      ? <span className="sub_grade_badge">{sub.grade}/20</span>
                      : null
                    }
                    <button className="file_btn grade" onClick={() => gradingId === sub.id ? setGradingId(null) : openGrading(sub)} title="Noter"></button>
                    <button className="file_btn download" onClick={() => handleDownload(sub)} title="Télécharger"><DownloadIcon /></button>
                    <button className="file_btn delete"   onClick={() => handleDelete(sub)}   title="Supprimer"><TrashIcon /></button>
                  </div>
                </div>

                {gradingId === sub.id && (
                  <div className="sub_grade_form">
                    <div className="sub_grade_inputs">
                      <input
                        type="number" min="0" max="20" step="0.5"
                        placeholder="Note /20"
                        value={gradeVal}
                        onChange={e => setGradeVal(e.target.value)}
                        className="sub_grade_input"
                      />
                      <input
                        type="text"
                        placeholder="Commentaire (optionnel)"
                        value={gradeComment}
                        onChange={e => setGradeComment(e.target.value)}
                        className="sub_grade_comment_input"
                      />
                    </div>
                    <div className="sub_grade_actions">
                      <button className="sub_grade_cancel" onClick={() => setGradingId(null)}>Annuler</button>
                      <button className="sub_grade_save" onClick={() => submitGrade(sub.id)} disabled={gradingBusy}>
                        {gradingBusy ? 'Enregistrement...' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SubmissionPanel;
