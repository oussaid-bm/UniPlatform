const express = require('express');
const request = require('supertest');
const { signToken, makeMockDb } = require('./_helpers');

jest.mock('../db', () => ({ getDb: jest.fn() }));

const { getDb } = require('../db');
const groupsRouter = require('../routes/groups');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/groups', groupsRouter);
  return app;
}

describe('Groups routes', () => {
  let app, mockDb;

  beforeEach(() => {
    app = buildApp();
    mockDb = makeMockDb();
    getDb.mockResolvedValue(mockDb);
  });

  // ─── GET / ─────────────────────────────────────────────────
  describe('GET /api/groups', () => {
    it('returns groups for professor (own groups)', async () => {
      const rows = [{ id: 1, name: 'Group A' }];
      mockDb.all.mockResolvedValue(rows);

      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(rows);
    });

    it('returns joined groups for student', async () => {
      mockDb.all.mockResolvedValue([]);
      const token = signToken({ id: 2, role: 'student' });
      const res = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /students ────────────────────────────────────────
  describe('GET /api/groups/students', () => {
    it('returns list of students', async () => {
      const students = [{ id: 1, username: 'stu1' }];
      mockDb.all.mockResolvedValue(students);

      const token = signToken({ role: 'professor' });
      const res = await request(app)
        .get('/api/groups/students')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(students);
    });

    it('filters by filiere query param', async () => {
      mockDb.all.mockResolvedValue([]);
      const token = signToken({ role: 'professor' });
      const res = await request(app)
        .get('/api/groups/students?filiere=L1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockDb.all.mock.calls[0][1]).toEqual(['L1']);
    });
  });

  // ─── POST / ────────────────────────────────────────────────
  describe('POST /api/groups', () => {
    it('returns 403 for non-professor', async () => {
      const token = signToken({ role: 'student' });
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'G' });
      expect(res.status).toBe(403);
    });

    it('returns 400 when name is empty', async () => {
      const token = signToken({ role: 'professor' });
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('creates a group with members', async () => {
      mockDb.run.mockResolvedValue({ lastID: 10 });
      mockDb.get.mockResolvedValue({ id: 10, name: 'TP Group', member_count: 3 });

      const token = signToken({ id: 5, role: 'professor', username: 'prof' });
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'TP Group', filiere: 'L1', members: [1, 2] });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('TP Group');
      // creator + 2 members = 3 INSERT calls
      expect(mockDb.run).toHaveBeenCalledTimes(4); // 1 create + 1 creator + 2 members
    });
  });

  // ─── GET /:id/members ─────────────────────────────────────
  describe('GET /api/groups/:id/members', () => {
    it('returns 404 when group not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const token = signToken();
      const res = await request(app)
        .get('/api/groups/99/members')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns members list', async () => {
      mockDb.get.mockResolvedValue({ id: 1 });
      mockDb.all.mockResolvedValue([{ id: 5, username: 'prof', role: 'professor' }]);

      const token = signToken();
      const res = await request(app)
        .get('/api/groups/1/members')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  // ─── DELETE /:id/leave ────────────────────────────────────
  describe('DELETE /api/groups/:id/leave', () => {
    it('returns 404 when group not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const token = signToken({ id: 2 });
      const res = await request(app)
        .delete('/api/groups/99/leave')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 when creator tries to leave', async () => {
      mockDb.get.mockResolvedValue({ id: 1, created_by: 2 });
      const token = signToken({ id: 2 });
      const res = await request(app)
        .delete('/api/groups/1/leave')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('allows non-creator to leave', async () => {
      mockDb.get.mockResolvedValue({ id: 1, created_by: 5 });
      const token = signToken({ id: 2 });
      const res = await request(app)
        .delete('/api/groups/1/leave')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── DELETE /:id/members/:userId ──────────────────────────
  describe('DELETE /api/groups/:id/members/:userId', () => {
    it('returns 404 when group not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const token = signToken({ id: 5 });
      const res = await request(app)
        .delete('/api/groups/99/members/2')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 when non-creator non-admin tries to remove', async () => {
      mockDb.get.mockResolvedValue({ id: 1, created_by: 5 });
      const token = signToken({ id: 2, role: 'student' });
      const res = await request(app)
        .delete('/api/groups/1/members/3')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns 400 when trying to remove the creator', async () => {
      mockDb.get.mockResolvedValue({ id: 1, created_by: 5 });
      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .delete('/api/groups/1/members/5')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('creator can remove a member', async () => {
      mockDb.get.mockResolvedValue({ id: 1, created_by: 5 });
      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .delete('/api/groups/1/members/2')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── DELETE /:id ───────────────────────────────────────────
  describe('DELETE /api/groups/:id', () => {
    it('returns 404 when group not found', async () => {
      mockDb.get.mockResolvedValue(undefined);
      const token = signToken({ id: 5 });
      const res = await request(app)
        .delete('/api/groups/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('returns 403 when non-creator non-admin tries to delete', async () => {
      mockDb.get.mockResolvedValue({ id: 1, created_by: 5 });
      const token = signToken({ id: 2, role: 'student' });
      const res = await request(app)
        .delete('/api/groups/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('creator can delete the group', async () => {
      mockDb.get.mockResolvedValue({ id: 1, created_by: 5 });
      const token = signToken({ id: 5, role: 'professor' });
      const res = await request(app)
        .delete('/api/groups/1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
