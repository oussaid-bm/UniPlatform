import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import store from './store/store';
import App from './App';
import { connectWithSocketIOServer } from './socketConnection/socketConn';
import './index.css';

// Re-connect socket if user is already authenticated (persisted in localStorage)
const token = localStorage.getItem('univ_token');
if (token) connectWithSocketIOServer(token);

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
