
import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import './Layout.css';

const GradCapIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
  </svg>
);
const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const GroupIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const BookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const LiveIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);
const InboxIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const NAV = [
  { path: '/app/annonces', label: 'Annonces',       Icon: BellIcon },
  { path: '/app/cours',    label: 'Mes Cours',      Icon: BookIcon },
  { path: '/app/live',     label: 'Cours en ligne', Icon: LiveIcon },
  { path: '/app/chat',     label: 'Chat',           Icon: ChatIcon,  hideFor: ['professor'] },
  { path: '/app/groupes',  label: 'Groupes',        Icon: GroupIcon },
  { path: '/app/demandes', label: 'Demandes',       Icon: InboxIcon },
];

const AVATAR_COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#0891B2', '#059669', '#D97706'];
const colorFor    = (name = '') => AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name = '') => (name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const Layout = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const dispatch  = useDispatch();
  const { user }  = useSelector((s) => s.auth);

  const handleLogout = () => { dispatch(logout()); navigate('/'); };

  const roleLabel    = user?.role === 'professor' ? 'Professeur' : user?.role === 'admin' ? 'Admin' : 'Étudiant';
  const subtitle     = user?.filiere ? user.filiere : roleLabel;
  const sectionLabel = user?.role === 'professor' ? 'ESPACE PROFESSEUR'
                     : user?.role === 'admin'     ? 'ESPACE ADMIN'
                     : 'ESPACE ÉTUDIANT';

  return (
    <div className="app_layout">

      <aside className="sidebar">

        <div className="sidebar_brand">
          <div className="sidebar_logo"><img src="/logo192.png" alt="UniPlatform" /></div>
          <div className="sidebar_brand_text">
            <div className="sidebar_brand_title">UniPlatform</div>
            <div className="sidebar_brand_sub">Plateforme universitaire</div>
          </div>
        </div>

        <div className="sidebar_section_label">{sectionLabel}</div>

        {NAV.filter(({ hideFor }) => !hideFor?.includes(user?.role)).map(({ path, label, Icon }) => (
          <div
            key={path}
            className={`nav_item ${location.pathname.startsWith(path) ? 'active' : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon />
            {label}
          </div>
        ))}

        <div className="sidebar_spacer" />

        <div className="sidebar_user">
          <div className="avatar" style={{ background: colorFor(user?.username) }}>
            {getInitials(user?.username)}
          </div>
          <div className="sidebar_user_info">
            <div className="sidebar_user_name">{user?.username}</div>
            <div className="sidebar_user_role">{subtitle}</div>
          </div>
          <button className="logout_btn_sidebar" onClick={handleLogout} title="Déconnexion">
            <LogoutIcon />
          </button>
        </div>

      </aside>

      <div className="main_area">
        <div className="page_area">
          <Outlet />
        </div>
      </div>

    </div>
  );
};

export default Layout;
