// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURATION DE L'URL DE L'API
//  Centralise l'adresse du serveur : tous les fetch() utilisent `${API}/...`.
//  - Production : frontend et API servis depuis la même origine → '/api'
//  - Développement : le serveur tourne séparément sur le port 3003.
// ─────────────────────────────────────────────────────────────────────────────
const API = process.env.NODE_ENV === 'production'
  ? '/api'
  : 'http://localhost:3003/api';

export default API;
