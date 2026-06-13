const express = require('express');
const request = require('supertest');
const { signToken, makeMockDb } = require('./_helpers');

jest.mock('../db', () => ({ getDb: jest.fn() }));
jest.mock('../email', () => ({
  sendAnnouncementEmail: jest.fn().mockResolvedValue(undefined),
}));

const { getDb } = require('../db');
const announcementsRouter = require('../routes/announcements');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/announcements', announcementsRouter);
  return app;
}

describe('Announcements routes', () => {
  let app, mockDb;

  beforeEach(() => {
    app = buildApp();
    mockDb = makeMockDb();
    getDb.mockResolvedValue(mockDb);
  });

  // ─── GET / ─────────────────────────────────────────────────
  describe('GET /api/announcements', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/announcements');
      expect(res.status).toBe(401);
    });

    it('returns announcements for student filtered by filiere', async () => {
      const anns = [{ id: 1, title: 'Welcome' }];
      mockDb.all.mockResolvedValue(anns);

      const token = signToken({ role: 'student', filiere: 'L2 Informatique' });
      const res = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(anns);
      expect(mockDb.all.mock.calls[0][1]).toEqual(['L2 Informatique']);
    });

    it('returns all announcements for professor', async () => {
      mockDb.all.mockResolvedValue([]);
      const token = signToken({ role: 'professor' });
      const res = await request(app)
        .get('/api/announcements')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  // ─── POST / ────────────────────────────────────────────────
  describe('POST /api/announcements', () => {
    it('returns 403 for students', async () => {
      const token = signToken({ role: 'student' });
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'x', content: 'y' });
      expect(res.status).toBe(403);
    });

    it('returns 400 when title or content missing', async () => {
      const token = signToken({ role: 'professor' });
      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'x' });
      expect(res.status).toBe(400);
    });

    it('creates announcement as professor', async () => {
      mockDb.run.mockResolvedValue({ lastID: 5 });
      const token = signToken({ id: 3, role: 'professor', username: 'prof1' });

      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Exam', content: 'Tomorrow', filiere: 'L1 Informatique' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(5);
      expect(res.body.title).toBe('Exam');
    });

    it('creates announcement as admin', async () => {
      mockDb.run.mockResolvedValue({ lastID: 6 });
      const token = signToken({ id: 1, role: 'admin', username: 'admin' });

      const res = await request(app)
        .post('/api/announcements')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Holiday', content: 'Break' });

      expect(res.status).toBe(201);
    });
  });

  // ─── DELETE /:id ───────────────────────────────────────────
  describe('DELETE /api/announcements/:id', () => {
    it('returns 403 for students', async () => {
      const token = signToken({ role: 'student' });
      const res = await request(app)
        .delete('/api/announcements/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns 404 when announcement not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const token = signToken({ role: 'professor' });
      const res = await request(app)
        .delete('/api/announcements/99')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 when professor does not own the announcement', async () => {
      mockDb.get.mockResolvedValue({ id: 1, author_id: 99 });
      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .delete('/api/announcements/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('deletes own announcement', async () => {
      mockDb.get.mockResolvedValue({ id: 1, author_id: 5 });
      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .delete('/api/announcements/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('admin can delete any announcement', async () => {
      mockDb.get.mockResolvedValue({ id: 1, author_id: 99 });
      const token = signToken({ id: 1, role: 'admin' });
      const res = await request(app)
        .delete('/api/announcements/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
