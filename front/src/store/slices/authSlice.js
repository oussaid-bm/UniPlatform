
import { createSlice } from '@reduxjs/toolkit';

const savedUser = localStorage.getItem('univ_user');
const savedToken = localStorage.getItem('univ_token');

const initialState = {
  user: savedUser ? JSON.parse(savedUser) : null, 
  token: savedToken || null,                        
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.error = null;
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
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.error = null;
      localStorage.removeItem('univ_user');
      localStorage.removeItem('univ_token');
    },
  },
});


export const { setCredentials, setLoading, setError, logout } = authSlice.actions;
export default authSlice.reducer;
