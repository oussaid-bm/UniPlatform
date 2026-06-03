// ─────────────────────────────────────────────────────────────────────────────
//  POINT D'ENTRÉE DE L'APPLICATION REACT
//  C'est le tout premier fichier exécuté côté navigateur.
//  Il "monte" l'application dans la page HTML et fournit le store Redux à tous
//  les composants via <Provider>.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';          // rend le store Redux accessible partout
import store from './store/store';
import App from './App';
import { connectWithSocketIOServer } from './socketConnection/socketConn';
import './index.css';

// Si un jeton est déjà présent (utilisateur déjà connecté lors d'une visite précédente),
// on rouvre immédiatement la connexion temps réel (Socket.io).
const token = localStorage.getItem('univ_token');
if (token) connectWithSocketIOServer(token);

// On accroche React à la balise <div id="root"> du fichier public/index.html.
const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
