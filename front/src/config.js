// En production, l'API est servie par le même serveur que le front
// (Railway, ngrok, etc.) → on utilise l'origine courante, pas une URL en dur.
const API = process.env.NODE_ENV === 'production'
  ? window.location.origin + '/api'
  : 'http://localhost:3003/api';

export default API;
