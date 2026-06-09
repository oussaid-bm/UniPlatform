
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
    setMessages: (state, action) => {      
      state.messages = action.payload;
    },
    addMessage: (state, action) => {    
      state.messages.push(action.payload);
    },
    clearMessages: (state) => {             
      state.messages = [];
    },
    setVideoSessionActive: (state, action) => { 
      state.videoSessionActive = action.payload.active;
      state.professorSocketId = action.payload.professorSocketId || null;
    },
  },
});

export const { setMessages, addMessage, clearMessages, setVideoSessionActive } = chatSlice.actions;
export default chatSlice.reducer;
