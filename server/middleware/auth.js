// ─────────────────────────────────────────────────────────────────────────────
//  MIDDLEWARE D'AUTHENTIFICATION (JWT)
//  Un "middleware" est une fonction qui s'exécute AVANT le code d'une route.
//  Ici, il vérifie que la requête contient un jeton (token) valide.
//  Si oui → on continue (next()) ; si non → on bloque avec une erreur 401/403.
// ─────────────────────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');

// Clé secrète utilisée pour SIGNER et VÉRIFIER les jetons.
// (En production, elle doit venir d'une variable d'environnement, jamais en clair.)
const JWT_SECRET = process.env.JWT_SECRET || 'univ_secret_key_2024';

const verifyToken = (req, res, next) => {
  // L'en-tête HTTP a la forme : "Authorization: Bearer <token>"
  const header = req.headers['authorization'];

  // On récupère le token depuis l'en-tête (split sur l'espace → ["Bearer", "<token>"]),
  // OU depuis l'URL ?token=... (cas des téléchargements ouverts avec window.open,
  // où on ne peut pas ajouter d'en-tête HTTP personnalisé).
  const token = header ? header.split(' ')[1] : req.query.token;

  if (!token) return res.status(401).json({ error: 'Token manquant.' });

  try {
    // jwt.verify déchiffre le token ET vérifie sa signature.
    // S'il est valide, il retourne le contenu : { id, username, role, filiere }.
    // On l'attache à req.user pour que les routes suivantes sachent QUI fait la requête.
    req.user = jwt.verify(token, JWT_SECRET);
    next(); // tout est bon → on passe à la route demandée
  } catch {
    // Token expiré, modifié ou faux → accès refusé
    res.status(403).json({ error: 'Token invalide.' });
  }
};

module.exports = { verifyToken };
