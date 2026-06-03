// ─────────────────────────────────────────────────────────────────────────────
//  PAGE D'AUTHENTIFICATION
//  Gère 4 vues dans un seul composant (variable `view`) :
//   - 'login'    : connexion
//   - 'register' : inscription (avec choix du rôle et de la filière)
//   - 'forgot'   : demande de réinitialisation du mot de passe
//   - 'reset'    : saisie du nouveau mot de passe (via le lien reçu par email)
//  Après connexion réussie : stocke le token (Redux) et ouvre la connexion Socket.io.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setCredentials, setError, setLoading } from '../store/slices/authSlice';
import { connectWithSocketIOServer } from '../socketConnection/socketConn';
import { FILIERES } from '../filieres';
import API from '../config';
import './AuthPage.css';

/* ─── Icons ──────────────────────────────────────────────────────────── */
const GradCapIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const AlertMailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const ROLES = [
  { key: 'student',   label: 'Étudiant' },
  { key: 'professor', label: 'Professeur' },
];

/* ─── Composant principal ────────────────────────────────────────────── */
const AuthPage = () => {
  // view: 'login' | 'register' | 'forgot' | 'reset'
  const [view,       setView]       = useState('login');
  const [role,       setRole]       = useState('student');
  const [form,       setForm]       = useState({ username: '', email: '', password: '', filiere: '' });
  const [successMsg, setSuccessMsg] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendStatus,    setResendStatus]    = useState('');

  /* ── États "mot de passe oublié" ─────────────────────── */
  const [forgotEmail,  setForgotEmail]  = useState('');
  const [forgotMsg,    setForgotMsg]    = useState('');
  const [forgotErr,    setForgotErr]    = useState('');
  const [forgotLoading,setForgotLoading]= useState(false);
  const [devResetLink, setDevResetLink] = useState('');

  /* ── États "réinitialisation" ────────────────────────── */
  const [resetToken,   setResetToken]   = useState('');
  const [resetPwd,     setResetPwd]     = useState('');
  const [resetPwd2,    setResetPwd2]    = useState('');
  const [resetMsg,     setResetMsg]     = useState('');
  const [resetErr,     setResetErr]     = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((s) => s.auth);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === '1') {
      setSuccessMsg('✅ Email vérifié ! Vous pouvez maintenant vous connecter.');
      window.history.replaceState({}, '', '/');
    }
    const rt = params.get('reset_token');
    if (rt) {
      setResetToken(rt);
      setView('reset');
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  /* ── Validation email ────────────────────────────────────── */
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  /* ── Login / Register ─────────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(setError(null));
    setSuccessMsg('');

    // Validation email format côté client
    if (!isValidEmail(form.email)) {
      dispatch(setError('Adresse email invalide. Vérifiez le format (ex : nom@domaine.com)'));
      return;
    }

    dispatch(setLoading(true));

    try {
      const isRegister = view === 'register';
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const body = isRegister
        ? { username: form.username, email: form.email, password: form.password, role, filiere: role === 'student' ? form.filiere : '' }
        : { email: form.email, password: form.password };

      const res  = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'email_not_verified') {
          setRegisteredEmail(form.email);
          dispatch(setError('email_not_verified'));
        } else {
          dispatch(setError(data.error || 'Erreur.'));
        }
        return;
      }

      if (isRegister) {
        setRegisteredEmail(form.email);
        setSuccessMsg(`📧 Compte créé ! Un email de vérification a été envoyé à ${form.email}. Vérifiez votre boîte mail et cliquez sur le lien pour activer votre compte. ⚠️ Si vous ne recevez rien, votre adresse email est peut-être invalide — le compte sera supprimé automatiquement après 24h.`);
        setForm({ username: '', email: '', password: '', filiere: '' });
        return;
      }

      dispatch(setCredentials({ user: data.user, token: data.token }));
      connectWithSocketIOServer(data.token);
      navigate('/app/annonces');

    } catch {
      dispatch(setError('Impossible de joindre le serveur.'));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleResend = async () => {
    if (!registeredEmail || resendStatus === 'sending') return;
    setResendStatus('sending');
    try {
      const res = await fetch(`${API}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail }),
      });
      setResendStatus(res.ok ? 'sent' : 'error');
    } catch {
      setResendStatus('error');
    }
  };

  /* ── Mot de passe oublié ──────────────────────────────── */
  const handleForgot = async (e) => {
    e.preventDefault();
    setForgotErr(''); setForgotMsg(''); setDevResetLink('');
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      const res  = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) { setForgotErr(data.error || 'Erreur.'); return; }
      setForgotMsg(data.message);
      if (data.devResetLink) setDevResetLink(data.devResetLink);
    } catch {
      setForgotErr('Impossible de joindre le serveur.');
    } finally {
      setForgotLoading(false);
    }
  };

  /* ── Réinitialisation mot de passe ───────────────────── */
  const handleReset = async (e) => {
    e.preventDefault();
    setResetErr(''); setResetMsg('');
    if (resetPwd.length < 6) { setResetErr('Minimum 6 caractères.'); return; }
    if (resetPwd !== resetPwd2) { setResetErr('Les mots de passe ne correspondent pas.'); return; }
    setResetLoading(true);
    try {
      const res  = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: resetPwd }),
      });
      const data = await res.json();
      if (!res.ok) { setResetErr(data.error || 'Erreur.'); return; }
      setResetMsg('✅ Mot de passe réinitialisé ! Vous pouvez maintenant vous connecter.');
      setResetPwd(''); setResetPwd2('');
      setTimeout(() => { setView('login'); setResetMsg(''); setSuccessMsg('✅ Mot de passe changé ! Connectez-vous.'); }, 2000);
    } catch {
      setResetErr('Impossible de joindre le serveur.');
    } finally {
      setResetLoading(false);
    }
  };

  const switchView = (v) => {
    setView(v);
    dispatch(setError(null));
    setSuccessMsg(''); setResendStatus('');
    setForgotMsg(''); setForgotErr(''); setForgotEmail(''); setDevResetLink('');
    setForm({ username: '', email: '', password: '', filiere: '' });
  };

  const emailNotVerified = error === 'email_not_verified';

  return (
    <div className="auth_page">
      <div className="auth_center">

        {/* Logo + Titre */}
        <div className="auth_logo"><GradCapIcon /></div>
        <div className="auth_brand_name">UniPlatform</div>
        <div className="auth_brand_sub">PLATEFORME UNIVERSITAIRE</div>
        <div className="auth_tagline">Connectez-vous à votre espace académique</div>

        {/* ── VUE MOT DE PASSE OUBLIÉ ─────────────────────── */}
        {view === 'forgot' && (
          <div className="auth_card">
            <h2 className="auth_form_title">Mot de passe oublié</h2>
            <p className="auth_form_subtitle">Entrez votre email pour recevoir un lien de réinitialisation</p>

            {forgotMsg && (
              <div className="auth_success">
                {forgotMsg}
                {devResetLink && (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: '#7A7060' }}>Mode dev — </span>
                    <a href={devResetLink} style={{ fontSize: 12, color: '#C8963E', fontWeight: 600 }}>Cliquez ici pour réinitialiser</a>
                  </div>
                )}
              </div>
            )}
            {forgotErr && <div className="auth_error">{forgotErr}</div>}

            <form className="auth_form" onSubmit={handleForgot}>
              <div className="auth_field">
                <label>Adresse email</label>
                <div className="auth_input_wrap">
                  <span className="auth_input_icon"><MailIcon /></span>
                  <input
                    type="email" value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="prenom.nom@univ.dz" required autoFocus
                  />
                </div>
              </div>
              <button className="auth_submit" type="submit" disabled={forgotLoading}>
                {forgotLoading ? 'Envoi...' : 'Envoyer le lien'}
              </button>
            </form>

            <p className="auth_footer_link">
              <span onClick={() => switchView('login')}>← Retour à la connexion</span>
            </p>
          </div>
        )}

        {/* ── VUE RÉINITIALISATION ─────────────────────────── */}
        {view === 'reset' && (
          <div className="auth_card">
            <h2 className="auth_form_title">Nouveau mot de passe</h2>
            <p className="auth_form_subtitle">Choisissez un nouveau mot de passe pour votre compte</p>

            {resetMsg && <div className="auth_success">{resetMsg}</div>}
            {resetErr && <div className="auth_error">{resetErr}</div>}

            <form className="auth_form" onSubmit={handleReset}>
              <div className="auth_field">
                <label>Nouveau mot de passe</label>
                <div className="auth_input_wrap">
                  <span className="auth_input_icon"><LockIcon /></span>
                  <input
                    type="password" value={resetPwd}
                    onChange={(e) => setResetPwd(e.target.value)}
                    placeholder="••••••••" required autoFocus minLength={6}
                  />
                </div>
              </div>
              <div className="auth_field">
                <label>Confirmer le mot de passe</label>
                <div className="auth_input_wrap">
                  <span className="auth_input_icon"><LockIcon /></span>
                  <input
                    type="password" value={resetPwd2}
                    onChange={(e) => setResetPwd2(e.target.value)}
                    placeholder="••••••••" required
                  />
                </div>
              </div>
              <button className="auth_submit" type="submit" disabled={resetLoading}>
                {resetLoading ? 'Enregistrement...' : 'Changer le mot de passe'}
              </button>
            </form>

            <p className="auth_footer_link">
              <span onClick={() => switchView('login')}>← Retour à la connexion</span>
            </p>
          </div>
        )}

        {/* ── VUE LOGIN / REGISTER ─────────────────────────── */}
        {(view === 'login' || view === 'register') && (
          <div className="auth_card">
            <h2 className="auth_form_title">
              {view === 'register' ? 'Créer un compte' : 'Se connecter'}
            </h2>
            <p className="auth_form_subtitle">
              {view === 'register' ? 'Rejoignez la communauté universitaire' : 'Bon retour sur votre espace'}
            </p>

            {successMsg && (
              <div className="auth_success">
                {successMsg}
                {registeredEmail && !successMsg.includes('vérifié') && !successMsg.includes('changé') && (
                  <div className="auth_resend">
                    Vous n'avez pas reçu l'email ?{' '}
                    <button onClick={handleResend} disabled={resendStatus === 'sending' || resendStatus === 'sent'}>
                      {resendStatus === 'sending' ? 'Envoi...' : resendStatus === 'sent' ? '✅ Renvoyé !' : 'Renvoyer'}
                    </button>
                    {resendStatus === 'error' && <span style={{ color: '#DC2626' }}> Échec.</span>}
                  </div>
                )}
              </div>
            )}

            {emailNotVerified && (
              <div className="auth_warning">
                <AlertMailIcon />
                <div>
                  <div>Email non vérifié. Vérifiez votre boîte mail.</div>
                  <div className="auth_resend">
                    Pas reçu ?{' '}
                    <button onClick={handleResend} disabled={resendStatus === 'sending' || resendStatus === 'sent'}>
                      {resendStatus === 'sending' ? 'Envoi...' : resendStatus === 'sent' ? '✅ Envoyé !' : "Renvoyer l'email"}
                    </button>
                    {resendStatus === 'error' && <span style={{ color: '#DC2626' }}> Échec.</span>}
                  </div>
                </div>
              </div>
            )}

            {error && !emailNotVerified && <div className="auth_error">{error}</div>}

            {view === 'register' && (
              <div className="auth_roles">
                {ROLES.map((r) => (
                  <button key={r.key} className={`role_btn ${role === r.key ? 'active' : ''}`}
                    onClick={() => setRole(r.key)} type="button">
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            <form className="auth_form" onSubmit={handleSubmit}>
              {view === 'register' && (
                <div className="auth_field">
                  <label>Nom d'utilisateur</label>
                  <div className="auth_input_wrap">
                    <span className="auth_input_icon"><UserIcon /></span>
                    <input name="username" value={form.username} onChange={handleChange}
                      placeholder="ex : yassine_benali" required autoComplete="username" />
                  </div>
                </div>
              )}

              <div className="auth_field">
                <label>Adresse email</label>
                <div className="auth_input_wrap">
                  <span className="auth_input_icon"><MailIcon /></span>
                  <input name="email" type="email" value={form.email} onChange={handleChange}
                    placeholder="prenom.nom@univ.dz" required autoComplete="email" />
                </div>
              </div>

              <div className="auth_field">
                <label>Mot de passe</label>
                <div className="auth_input_wrap">
                  <span className="auth_input_icon"><LockIcon /></span>
                  <input name="password" type="password" value={form.password} onChange={handleChange}
                    placeholder="••••••••" required
                    autoComplete={view === 'register' ? 'new-password' : 'current-password'} />
                </div>
                {view === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: 5 }}>
                    <span className="auth_forgot_link" onClick={() => switchView('forgot')}>
                      Mot de passe oublié ?
                    </span>
                  </div>
                )}
              </div>

              {view === 'register' && role === 'student' && (
                <div className="auth_field">
                  <label>Filière &amp; Niveau</label>
                  <select name="filiere" value={form.filiere} onChange={handleChange} required>
                    <option value="">-- Choisir votre filière --</option>
                    {FILIERES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              )}

              <button className="auth_submit" type="submit" disabled={loading}>
                {loading ? 'Chargement...' : view === 'register' ? "S'inscrire" : 'Se connecter'}
              </button>
            </form>

            <p className="auth_footer_link">
              {view === 'register' ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
              <span onClick={() => switchView(view === 'register' ? 'login' : 'register')}>
                {view === 'register' ? 'Se connecter' : "S'inscrire"}
              </span>
            </p>
          </div>
        )}

        <div className="auth_demo_hint">
          Démo : email avec "prof" → espace professeur, sinon étudiant
        </div>

      </div>
    </div>
  );
};

export default AuthPage;
