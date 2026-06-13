const express = require('express');
const request = require('supertest');
const { signToken, makeMockDb } = require('./_helpers');

jest.mock('../db', () => ({ getDb: jest.fn() }));
jest.mock('../email', () => ({
  sendNewDevoirEmail: jest.fn().mockResolvedValue(undefined),
}));

const { getDb } = require('../db');
const coursesRouter = require('../routes/courses');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/courses', coursesRouter);
  return app;
}

describe('Courses routes', () => {
  let app, mockDb;

  beforeEach(() => {
    app = buildApp();
    mockDb = makeMockDb();
    getDb.mockResolvedValue(mockDb);
  });

  // ─── GET / ─────────────────────────────────────────────────
  describe('GET /api/courses', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/courses');
      expect(res.status).toBe(401);
    });

    it('returns courses for student filtered by filiere', async () => {
      const courses = [{ id: 1, title: 'Math' }];
      mockDb.all.mockResolvedValue(courses);

      const token = signToken({ role: 'student', filiere: 'L1 Informatique' });
      const res = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(courses);
      expect(mockDb.all).toHaveBeenCalledTimes(1);
      expect(mockDb.all.mock.calls[0][1]).toEqual(['L1 Informatique']);
    });

    it('returns courses for professor (own courses)', async () => {
      mockDb.all.mockResolvedValue([]);
      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockDb.all.mock.calls[0][1]).toEqual([5]);
    });

    it('returns all courses for admin', async () => {
      mockDb.all.mockResolvedValue([]);
      const token = signToken({ role: 'admin' });
      const res = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });

  // ─── POST / ────────────────────────────────────────────────
  describe('POST /api/courses', () => {
    it('returns 403 for non-professor', async () => {
      const token = signToken({ role: 'student' });
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test' });

      expect(res.status).toBe(403);
    });

    it('returns 400 when title is missing', async () => {
      const token = signToken({ role: 'professor' });
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('creates a course as professor', async () => {
      mockDb.run.mockResolvedValue({ lastID: 10 });
      const token = signToken({ id: 5, role: 'professor', username: 'prof' });

      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Algo', description: 'desc', filiere: 'L1 Informatique' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(10);
      expect(res.body.title).toBe('Algo');
      expect(res.body.type).toBe('cours');
    });

    it('defaults type to cours for invalid type', async () => {
      mockDb.run.mockResolvedValue({ lastID: 11 });
      const token = signToken({ id: 5, role: 'professor', username: 'prof' });

      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'X', type: 'invalid' });

      expect(res.body.type).toBe('cours');
    });

    it('sends email notifications for devoir type', async () => {
      const { sendNewDevoirEmail } = require('../email');
      mockDb.run.mockResolvedValue({ lastID: 12 });
      mockDb.all.mockResolvedValue([{ email: 's@e.com', username: 'stu' }]);
      const token = signToken({ id: 5, role: 'professor', username: 'prof' });

      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'HW1', type: 'devoir', filiere: 'L1' });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('devoir');
      expect(sendNewDevoirEmail).toHaveBeenCalled();
    });
  });

  // ─── DELETE /:id ───────────────────────────────────────────
  describe('DELETE /api/courses/:id', () => {
    it('returns 403 for non-professor', async () => {
      const token = signToken({ role: 'student' });
      const res = await request(app)
        .delete('/api/courses/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns 404 when course not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .delete('/api/courses/99')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 when professor does not own the course', async () => {
      mockDb.get.mockResolvedValue({ id: 1, professor_id: 99 });
      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .delete('/api/courses/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('deletes own course successfully', async () => {
      mockDb.get.mockResolvedValue({ id: 1, professor_id: 5 });
      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .delete('/api/courses/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBeTruthy();
    });
  });

  // ─── GET /:id/messages ────────────────────────────────────
  describe('GET /api/courses/:id/messages', () => {
    it('returns messages for a course', async () => {
      const msgs = [{ id: 1, content: 'hello', sender_name: 'alice' }];
      mockDb.all.mockResolvedValue(msgs);

      const token = signToken();
      const res = await request(app)
        .get('/api/courses/1/messages')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(msgs);
    });
  });
});
