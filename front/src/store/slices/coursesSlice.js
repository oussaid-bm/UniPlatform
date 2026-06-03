// ─────────────────────────────────────────────────────────────────────────────
//  SLICE REDUX "courses" — la liste des cours en mémoire
//  Permet d'afficher/ajouter/retirer des cours sans recharger toute la page.
// ─────────────────────────────────────────────────────────────────────────────
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
    setCourses: (state, action) => {        // remplace la liste (après chargement depuis l'API)
      state.courses = action.payload;
      state.loading = false;
    },
    addCourse: (state, action) => {         // ajoute un cours en tête de liste (le plus récent en premier)
      state.courses.unshift(action.payload);
    },
    removeCourse: (state, action) => {      // retire un cours par son id
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
