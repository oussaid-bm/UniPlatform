
const ACCENT_COLORS = ['#4F46E5', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DB2777'];
const AVATAR_COLORS = ['#4F46E5', '#7C3AED', '#DB2777', '#0891B2', '#059669', '#D97706'];
const BANNER_COLORS = ['#1B2B4B', '#7C3AED', '#0891B2', '#059669', '#C8963E', '#DB2777'];

export const colorById = (id) => ACCENT_COLORS[id % ACCENT_COLORS.length];
export const colorByName = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
export const bannerColorById = (id) => BANNER_COLORS[id % BANNER_COLORS.length];

export const getInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateLong = (iso) =>
  new Date(iso).toLocaleDateString('fr-DZ', { day: 'numeric', month: 'long', year: 'numeric' });

export const formatDateShort = (iso) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const formatSize = (b) =>
  !b ? '' : b < 1024 ? `${b} o` : b < 1048576 ? `${(b / 1024).toFixed(1)} Ko` : `${(b / 1048576).toFixed(1)} Mo`;
