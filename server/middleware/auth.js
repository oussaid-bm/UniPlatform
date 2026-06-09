
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'univ_secret_key_2024';

const verifyToken = (req, res, next) => {
  const header = req.headers['authorization'];

  const token = header ? header.split(' ')[1] : req.query.token;

  if (!token) return res.status(401).json({ error: 'Token manquant.' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next(); 
  } catch {
    res.status(403).json({ error: 'Token invalide.' });
  }
};

module.exports = { verifyToken };
