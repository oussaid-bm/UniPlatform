
const API = process.env.NODE_ENV === 'production'
  ? '/api'
  : 'http://localhost:3003/api';

export default API;
