
const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required. Set it in your .env file.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

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
