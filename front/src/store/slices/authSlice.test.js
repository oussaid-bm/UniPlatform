import authReducer, { setCredentials, setLoading, setError, logout } from './authSlice';

// Mock localStorage for tests
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('authSlice reducer', () => {
  const emptyState = { user: null, token: null, loading: false, error: null };

  beforeEach(() => {
    localStorage.clear();
  });

  it('returns initial state', () => {
    const state = authReducer(undefined, { type: '@@INIT' });
    expect(state).toMatchObject({ loading: false, error: null });
  });

  describe('setCredentials', () => {
    it('sets user and token, clears error', () => {
      const payload = { user: { id: 1, username: 'alice' }, token: 'jwt123' };
      const state = authReducer(emptyState, setCredentials(payload));

      expect(state.user).toEqual({ id: 1, username: 'alice' });
      expect(state.token).toBe('jwt123');
      expect(state.error).toBeNull();
    });

    it('persists to localStorage', () => {
      const payload = { user: { id: 1, username: 'alice' }, token: 'jwt123' };
      authReducer(emptyState, setCredentials(payload));

      expect(localStorage.getItem('univ_token')).toBe('jwt123');
      expect(JSON.parse(localStorage.getItem('univ_user'))).toEqual({ id: 1, username: 'alice' });
    });
  });

  describe('setLoading', () => {
    it('sets loading to true', () => {
      const state = authReducer(emptyState, setLoading(true));
      expect(state.loading).toBe(true);
    });

    it('sets loading to false', () => {
      const state = authReducer({ ...emptyState, loading: true }, setLoading(false));
      expect(state.loading).toBe(false);
    });
  });

  describe('setError', () => {
    it('sets error and resets loading', () => {
      const state = authReducer(
        { ...emptyState, loading: true },
        setError('Invalid credentials'),
      );
      expect(state.error).toBe('Invalid credentials');
      expect(state.loading).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears user, token, error', () => {
      const loggedIn = {
        user: { id: 1, username: 'alice' },
        token: 'jwt',
        loading: false,
        error: 'some',
      };
      const state = authReducer(loggedIn, logout());

      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.error).toBeNull();
    });

    it('removes from localStorage', () => {
      localStorage.setItem('univ_user', '{}');
      localStorage.setItem('univ_token', 'tok');

      authReducer(emptyState, logout());

      expect(localStorage.getItem('univ_user')).toBeNull();
      expect(localStorage.getItem('univ_token')).toBeNull();
    });
  });
});
