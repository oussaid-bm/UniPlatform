import chatReducer, {
  setMessages,
  addMessage,
  clearMessages,
  setVideoSessionActive,
} from './chatSlice';

describe('chatSlice reducer', () => {
  const emptyState = {
    messages: [],
    videoSessionActive: false,
    professorSocketId: null,
  };

  it('returns initial state', () => {
    const state = chatReducer(undefined, { type: '@@INIT' });
    expect(state).toEqual(emptyState);
  });

  describe('setMessages', () => {
    it('replaces messages array', () => {
      const msgs = [{ id: 1, content: 'hi' }, { id: 2, content: 'hello' }];
      const state = chatReducer(emptyState, setMessages(msgs));
      expect(state.messages).toEqual(msgs);
    });
  });

  describe('addMessage', () => {
    it('appends a message', () => {
      const state = chatReducer(
        { ...emptyState, messages: [{ id: 1, content: 'a' }] },
        addMessage({ id: 2, content: 'b' }),
      );
      expect(state.messages).toHaveLength(2);
      expect(state.messages[1].content).toBe('b');
    });
  });

  describe('clearMessages', () => {
    it('empties the messages array', () => {
      const state = chatReducer(
        { ...emptyState, messages: [{ id: 1 }, { id: 2 }] },
        clearMessages(),
      );
      expect(state.messages).toEqual([]);
    });
  });

  describe('setVideoSessionActive', () => {
    it('activates video session with professor socket id', () => {
      const state = chatReducer(
        emptyState,
        setVideoSessionActive({ active: true, professorSocketId: 'sock123' }),
      );
      expect(state.videoSessionActive).toBe(true);
      expect(state.professorSocketId).toBe('sock123');
    });

    it('deactivates video session', () => {
      const activeState = {
        ...emptyState,
        videoSessionActive: true,
        professorSocketId: 'sock123',
      };
      const state = chatReducer(
        activeState,
        setVideoSessionActive({ active: false }),
      );
      expect(state.videoSessionActive).toBe(false);
      expect(state.professorSocketId).toBeNull();
    });
  });
});
