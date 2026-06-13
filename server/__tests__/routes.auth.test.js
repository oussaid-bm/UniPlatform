const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { signToken, makeMockDb, JWT_SECRET } = require('./_helpers');

// Mock dependencies before requiring the router
jest.mock('../db', () => ({ getDb: jest.fn() }));
jest.mock('../email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

// Mock dns.promises.resolveMx to avoid real DNS lookups
jest.mock('dns', () => {
  const actual = jest.requireActual('dns');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      resolveMx: jest.fn().mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]),
    },
  };
});

const { getDb } = require('../db');
const authRouter = require('../routes/auth');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

describe('Auth routes', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = buildApp();
    mockDb = makeMockDb();
    getDb.mockResolvedValue(mockDb);
    jest.clearAllMocks();
    getDb.mockResolvedValue(mockDb);
  });

  // ─── POST /register ────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'alice' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/requis/i);
    });

    it('returns 400 for invalid role', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'a', email: 'a@example.com', password: '123456', role: 'hacker' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalide/i);
    });

    it('returns 400 when student has no filiere', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'a', email: 'a@example.com', password: '123456', role: 'student' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/filière/i);
    });

    it('returns 201 on successful registration', async () => {
      mockDb.run.mockResolvedValue({ lastID: 42 });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'secret123',
          role: 'student',
          filiere: 'L1 Informatique',
        });

      expect(res.status).toBe(201);
      expect(res.body.userId).toBe(42);
      expect(res.body.message).toBeTruthy();
    });

    it('returns 409 on duplicate user', async () => {
      mockDb.run.mockRejectedValue(new Error('UNIQUE constraint failed'));

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'secret123',
          role: 'professor',
        });

      expect(res.status).toBe(409);
    });
  });

  // ─── POST /login ───────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('returns 400 when email or password missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'a@b.com' });

      expect(res.status).toBe(400);
    });

    it('returns 401 when user not found', async () => {
      mockDb.get.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'noone@example.com', password: 'pass' });

      expect(res.status).toBe(401);
    });

    it('returns 401 on wrong password', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      mockDb.get.mockResolvedValue({
        id: 1, username: 'alice', email: 'a@b.com',
        password: hashed, role: 'student', filiere: 'L1', email_verified: 1,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });

    it('returns 403 when email not verified', async () => {
      const hashed = await bcrypt.hash('pass', 10);
      mockDb.get.mockResolvedValue({
        id: 1, username: 'alice', email: 'a@b.com',
        password: hashed, role: 'student', filiere: 'L1', email_verified: 0,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: 'pass' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('email_not_verified');
    });

    it('returns token on successful login', async () => {
      const hashed = await bcrypt.hash('pass', 10);
      mockDb.get.mockResolvedValue({
        id: 1, username: 'alice', email: 'a@b.com',
        password: hashed, role: 'student', filiere: 'L1', email_verified: 1,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: 'pass' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.user.username).toBe('alice');

      const decoded = jwt.verify(res.body.token, JWT_SECRET);
      expect(decoded.id).toBe(1);
    });
  });

  // ─── GET /verify-email ────────────────────────────────────
  describe('GET /api/auth/verify-email', () => {
    it('returns 400 when token missing', async () => {
      const res = await request(app).get('/api/auth/verify-email');
      expect(res.status).toBe(400);
    });

    it('returns 400 when token not found in DB', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const res = await request(app).get('/api/auth/verify-email?token=bad');
      expect(res.status).toBe(400);
    });

    it('returns 400 when token expired', async () => {
      mockDb.get.mockResolvedValue({
        id: 1,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      });
      const res = await request(app).get('/api/auth/verify-email?token=expired');
      expect(res.status).toBe(400);
    });

    it('redirects on valid token', async () => {
      mockDb.get.mockResolvedValue({
        id: 1,
        token_expires_at: new Date(Date.now() + 60000).toISOString(),
      });
      const res = await request(app).get('/api/auth/verify-email?token=valid');
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/verified=1/);
    });
  });

  // ─── POST /reset-password ─────────────────────────────────
  describe('POST /api/auth/reset-password', () => {
    it('returns 400 when fields missing', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when password too short', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'tok', password: '12345' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/6/);
    });

    it('returns 400 when token not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'bad', password: '123456' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when reset token expired', async () => {
      mockDb.get.mockResolvedValue({
        id: 1,
        reset_token_expires: new Date(Date.now() - 1000).toISOString(),
      });
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'tok', password: '123456' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/expiré/i);
    });

    it('succeeds with valid token and password', async () => {
      mockDb.get.mockResolvedValue({
        id: 1,
        reset_token_expires: new Date(Date.now() + 60000).toISOString(),
      });
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'tok', password: 'newsecret' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBeTruthy();
    });
  });

  // ─── GET /account-status ──────────────────────────────────
  describe('GET /api/auth/account-status', () => {
    it('returns 400 when email missing', async () => {
      const res = await request(app).get('/api/auth/account-status');
      expect(res.status).toBe(400);
    });

    it('returns exists=false for unknown email', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const res = await request(app).get('/api/auth/account-status?email=x@y.com');
      expect(res.status).toBe(200);
      expect(res.body.exists).toBe(false);
    });

    it('returns exists=true and verified status', async () => {
      mockDb.get.mockResolvedValue({ id: 1, email_verified: 1 });
      const res = await request(app).get('/api/auth/account-status?email=x@y.com');
      expect(res.status).toBe(200);
      expect(res.body.exists).toBe(true);
      expect(res.body.verified).toBe(true);
    });
  });

  // ─── GET /professors ──────────────────────────────────────
  describe('GET /api/auth/professors', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/professors');
      expect(res.status).toBe(401);
    });

    it('returns list of professors', async () => {
      const profs = [{ id: 10, username: 'prof1' }, { id: 11, username: 'prof2' }];
      mockDb.all.mockResolvedValue(profs);

      const token = signToken({ role: 'student' });
      const res = await request(app)
        .get('/api/auth/professors')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(profs);
    });
  });

  // ─── POST /forgot-password ────────────────────────────────
  describe('POST /api/auth/forgot-password', () => {
    it('returns 400 when email missing', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns success even for unknown email (no leaking)', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'ghost@x.com' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBeTruthy();
    });
  });

  // ─── POST /resend-verification ────────────────────────────
  describe('POST /api/auth/resend-verification', () => {
    it('returns 400 when email missing', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown email', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'x@y.com' });
      expect(res.status).toBe(404);
    });

    it('returns message when already verified', async () => {
      mockDb.get.mockResolvedValue({ id: 1, email_verified: 1, username: 'alice' });
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'a@b.com' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/vérifié/i);
    });
  });
});
