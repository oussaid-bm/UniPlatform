// ─────────────────────────────────────────────────────────────────────────────
//  SLICE REDUX "chat" — état partagé du chat de cours et de la session vidéo
//   - messages           : messages du chat de la salle de cours
//   - videoSessionActive : un cours est-il actuellement EN DIRECT ?
//   - professorSocketId  : l'identifiant de connexion du professeur (cible WebRTC)
// ─────────────────────────────────────────────────────────────────────────────
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  messages: [],
  videoSessionActive: false,
  professorSocketId: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setMessages: (state, action) => {       // remplace toute la liste (chargement historique)
      state.messages = action.payload;
    },
    addMessage: (state, action) => {        // ajoute un message (nouveau message reçu)
      state.messages.push(action.payload);
    },
    clearMessages: (state) => {             // vide la liste (en quittant la salle)
      state.messages = [];
    },
    setVideoSessionActive: (state, action) => { // marque le début/fin d'une session live
      state.videoSessionActive = action.payload.active;
      state.professorSocketId = action.payload.professorSocketId || null;
    },
  },
});

export const { setMessages, addMessage, clearMessages, setVideoSessionActive } = chatSlice.actions;
export default chatSlice.reducer;
