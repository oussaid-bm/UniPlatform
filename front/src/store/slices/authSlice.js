// ─────────────────────────────────────────────────────────────────────────────
//  SLICE REDUX "auth" — la mémoire globale de l'utilisateur connecté
//  Un "slice" Redux = un morceau de l'état global + les fonctions qui le modifient.
//  Ici on stocke : l'utilisateur, son jeton (token), l'état de chargement et les erreurs.
//  Ces infos sont accessibles depuis N'IMPORTE QUEL composant via useSelector.
// ─────────────────────────────────────────────────────────────────────────────
import { createSlice } from '@reduxjs/toolkit';

// Au démarrage, on relit l'utilisateur depuis le localStorage du navigateur.
// → l'utilisateur reste connecté même après avoir rechargé/fermé la page.
const savedUser = localStorage.getItem('univ_user');
const savedToken = localStorage.getItem('univ_token');

const initialState = {
  user: savedUser ? JSON.parse(savedUser) : null, // {id, username, role, filiere} ou null
  token: savedToken || null,                        // le jeton JWT, ou null si déconnecté
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Appelé après une connexion/inscription réussie : on mémorise l'utilisateur + token.
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.error = null;
      // On sauvegarde dans le localStorage pour persister la session entre les visites.
      localStorage.setItem('univ_user', JSON.stringify(action.payload.user));
      localStorage.setItem('univ_token', action.payload.token);
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    // Déconnexion : on efface tout (état + localStorage).
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.error = null;
      localStorage.removeItem('univ_user');
      localStorage.removeItem('univ_token');
    },
  },
});

// On exporte les "actions" (à appeler avec dispatch) et le "reducer" (branché dans le store).

export const { setCredentials, setLoading, setError, logout } = authSlice.actions;
export default authSlice.reducer;
