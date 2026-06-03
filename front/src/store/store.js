// ─────────────────────────────────────────────────────────────────────────────
//  STORE REDUX — l'état global de l'application
//  On assemble ici les trois "slices" (morceaux d'état) :
//   - auth    : utilisateur connecté + jeton
//   - courses : liste des cours
//   - chat    : messages et état de la session vidéo
//  N'importe quel composant peut lire ces données via useSelector(s => s.auth, ...).
// ─────────────────────────────────────────────────────────────────────────────
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import coursesReducer from './slices/coursesSlice';
import chatReducer from './slices/chatSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    courses: coursesReducer,
    chat: chatReducer,
  },
});

export default store;
