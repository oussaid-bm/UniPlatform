const express = require('express');
const request = require('supertest');
const { signToken, makeMockDb } = require('./_helpers');

jest.mock('../db', () => ({ getDb: jest.fn() }));

const { getDb } = require('../db');
const demandesRouter = require('../routes/demandes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/demandes', demandesRouter);
  return app;
}

describe('Demandes routes', () => {
  let app, mockDb;

  beforeEach(() => {
    app = buildApp();
    mockDb = makeMockDb();
    getDb.mockResolvedValue(mockDb);
  });

  // ─── GET / ─────────────────────────────────────────────────
  describe('GET /api/demandes', () => {
    it('returns student own demandes', async () => {
      const rows = [{ id: 1, title: 'Request' }];
      mockDb.all.mockResolvedValue(rows);

      const token = signToken({ id: 2, role: 'student' });
      const res = await request(app)
        .get('/api/demandes')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(rows);
    });

    it('returns professor demandes (fromStudents + profExchanges)', async () => {
      mockDb.all
        .mockResolvedValueOnce([{ id: 1, title: 'From student' }])
        .mockResolvedValueOnce([{ id: 2, title: 'Prof exchange' }]);

      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .get('/api/demandes')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.fromStudents).toHaveLength(1);
      expect(res.body.profExchanges).toHaveLength(1);
    });

    it('returns all demandes for admin', async () => {
      mockDb.all.mockResolvedValue([]);
      const token = signToken({ role: 'admin' });
      const res = await request(app)
        .get('/api/demandes')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  // ─── POST / ────────────────────────────────────────────────
  describe('POST /api/demandes', () => {
    it('returns 400 when title or content missing', async () => {
      const token = signToken({ role: 'student' });
      const res = await request(app)
        .post('/api/demandes')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '' });
      expect(res.status).toBe(400);
    });

    it('creates a demande to admin', async () => {
      const created = { id: 1, title: 'Help', recipient_name: 'Administration' };
      mockDb.run.mockResolvedValue({ lastID: 1 });
      mockDb.get.mockResolvedValue(created);

      const token = signToken({ id: 2, role: 'student', username: 'alice' });
      const res = await request(app)
        .post('/api/demandes')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Help', content: 'I need help', recipient_type: 'admin' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Help');
    });

    it('creates a demande to a professor', async () => {
      mockDb.get.mockResolvedValueOnce({ username: 'prof1' }); // professor lookup
      mockDb.run.mockResolvedValue({ lastID: 2 });
      mockDb.get.mockResolvedValueOnce({ id: 2, title: 'Question' }); // final select

      const token = signToken({ id: 2, role: 'student', username: 'alice' });
      const res = await request(app)
        .post('/api/demandes')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Question', content: 'Details', recipient_type: 'professor', recipient_id: 5 });

      expect(res.status).toBe(201);
    });

    it('returns 404 when professor not found', async () => {
      mockDb.get.mockResolvedValue(undefined); // professor lookup

      const token = signToken({ id: 2, role: 'student', username: 'alice' });
      const res = await request(app)
        .post('/api/demandes')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Q', content: 'D', recipient_type: 'professor', recipient_id: 999 });

      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /:id ────────────────────────────────────────────
  describe('PATCH /api/demandes/:id', () => {
    it('returns 400 for invalid status', async () => {
      const token = signToken({ role: 'admin' });
      const res = await request(app)
        .patch('/api/demandes/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when demande not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const token = signToken({ role: 'admin' });
      const res = await request(app)
        .patch('/api/demandes/99')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'repondu', response: 'Done' });
      expect(res.status).toBe(404);
    });

    it('returns 403 when user cannot respond', async () => {
      mockDb.get.mockResolvedValue({ id: 1, recipient_id: 99 });
      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .patch('/api/demandes/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'repondu', response: 'Ok' });
      expect(res.status).toBe(403);
    });

    it('admin can respond to any demande', async () => {
      mockDb.get
        .mockResolvedValueOnce({ id: 1, recipient_id: 99 }) // find demande
        .mockResolvedValueOnce({ id: 1, status: 'repondu' }); // updated
      const token = signToken({ role: 'admin' });
      const res = await request(app)
        .patch('/api/demandes/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'repondu', response: 'Done' });
      expect(res.status).toBe(200);
    });
  });

  // ─── DELETE /:id ───────────────────────────────────────────
  describe('DELETE /api/demandes/:id', () => {
    it('returns 404 when demande not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const token = signToken({ role: 'student' });
      const res = await request(app)
        .delete('/api/demandes/99')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 when not owner and not admin', async () => {
      mockDb.get.mockResolvedValue({ id: 1, sender_id: 99 });
      const token = signToken({ id: 2, role: 'student' });
      const res = await request(app)
        .delete('/api/demandes/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('owner can delete own demande', async () => {
      mockDb.get.mockResolvedValue({ id: 1, sender_id: 2 });
      const token = signToken({ id: 2, role: 'student' });
      const res = await request(app)
        .delete('/api/demandes/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('admin can delete any demande', async () => {
      mockDb.get.mockResolvedValue({ id: 1, sender_id: 99 });
      const token = signToken({ role: 'admin' });
      const res = await request(app)
        .delete('/api/demandes/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
