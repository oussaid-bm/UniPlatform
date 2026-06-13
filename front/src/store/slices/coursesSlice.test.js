import coursesReducer, {
  setCourses,
  addCourse,
  removeCourse,
  setCoursesLoading,
  setCoursesError,
} from './coursesSlice';

describe('coursesSlice reducer', () => {
  const emptyState = { courses: [], loading: false, error: null };

  it('returns initial state', () => {
    const state = coursesReducer(undefined, { type: '@@INIT' });
    expect(state).toEqual(emptyState);
  });

  describe('setCourses', () => {
    it('replaces courses array and resets loading', () => {
      const courses = [{ id: 1, title: 'A' }, { id: 2, title: 'B' }];
      const state = coursesReducer(
        { ...emptyState, loading: true },
        setCourses(courses),
      );
      expect(state.courses).toEqual(courses);
      expect(state.loading).toBe(false);
    });
  });

  describe('addCourse', () => {
    it('prepends the new course', () => {
      const existing = { ...emptyState, courses: [{ id: 1, title: 'Old' }] };
      const state = coursesReducer(existing, addCourse({ id: 2, title: 'New' }));

      expect(state.courses).toHaveLength(2);
      expect(state.courses[0].title).toBe('New');
      expect(state.courses[1].title).toBe('Old');
    });
  });

  describe('removeCourse', () => {
    it('removes course by id', () => {
      const existing = {
        ...emptyState,
        courses: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }],
      };
      const state = coursesReducer(existing, removeCourse(1));

      expect(state.courses).toHaveLength(1);
      expect(state.courses[0].id).toBe(2);
    });

    it('does nothing if id not found', () => {
      const existing = { ...emptyState, courses: [{ id: 1, title: 'A' }] };
      const state = coursesReducer(existing, removeCourse(99));
      expect(state.courses).toHaveLength(1);
    });
  });

  describe('setCoursesLoading', () => {
    it('sets loading flag', () => {
      const state = coursesReducer(emptyState, setCoursesLoading(true));
      expect(state.loading).toBe(true);
    });
  });

  describe('setCoursesError', () => {
    it('sets error and resets loading', () => {
      const state = coursesReducer(
        { ...emptyState, loading: true },
        setCoursesError('Network error'),
      );
      expect(state.error).toBe('Network error');
      expect(state.loading).toBe(false);
    });
  });
});
