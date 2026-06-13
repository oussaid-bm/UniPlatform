const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'univ_secret_key_2024';

function signToken(overrides = {}) {
  const payload = {
    id: 1,
    username: 'testuser',
    role: 'student',
    filiere: 'L1 Informatique',
    ...overrides,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function makeMockDb(overrides = {}) {
  return {
    get: jest.fn().mockResolvedValue(undefined),
    all: jest.fn().mockResolvedValue([]),
    run: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
    exec: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

module.exports = { signToken, makeMockDb, JWT_SECRET };
