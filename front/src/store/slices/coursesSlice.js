import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  courses: [],
  loading: false,
  error: null,
};

const coursesSlice = createSlice({
  name: 'courses',
  initialState,
  reducers: {
    setCourses: (state, action) => {
      state.courses = action.payload;
      state.loading = false;
    },
    addCourse: (state, action) => {
      state.courses.unshift(action.payload);
    },
    removeCourse: (state, action) => {
      state.courses = state.courses.filter((c) => c.id !== action.payload);
    },
    setCoursesLoading: (state, action) => {
      state.loading = action.payload;
    },
    setCoursesError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const { setCourses, addCourse, removeCourse, setCoursesLoading, setCoursesError } =
  coursesSlice.actions;
export default coursesSlice.reducer;
