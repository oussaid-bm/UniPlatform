const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'univ_secret_key_2024';

function mockReq(overrides = {}) {
  return { headers: {}, query: {}, ...overrides };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('verifyToken middleware', () => {
  const payload = { id: 1, username: 'alice', role: 'student', filiere: 'L1 Informatique' };

  it('rejects when no token is provided', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token manquant.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid Bearer token from Authorization header', () => {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 1, username: 'alice', role: 'student' });
  });

  it('accepts a valid token from query string', () => {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const req = mockReq({ query: { token } });
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(1);
  });

  it('rejects an expired token', () => {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '0s' });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token invalide.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token signed with wrong secret', () => {
    const token = jwt.sign(payload, 'wrong_secret');
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a malformed token string', () => {
    const req = mockReq({ headers: { authorization: 'Bearer not.a.valid.jwt' } });
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('prefers Authorization header over query token', () => {
    const headerToken = jwt.sign({ ...payload, username: 'header-user' }, JWT_SECRET, { expiresIn: '1h' });
    const queryToken = jwt.sign({ ...payload, username: 'query-user' }, JWT_SECRET, { expiresIn: '1h' });
    const req = mockReq({
      headers: { authorization: `Bearer ${headerToken}` },
      query: { token: queryToken },
    });
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.username).toBe('header-user');
  });
});
