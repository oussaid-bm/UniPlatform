import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AuthPage from './AuthPage/AuthPage';
import Layout from './Layout/Layout';
import ChatGlobal from './pages/ChatGlobal/ChatGlobal';
import Annonces from './pages/Annonces/Annonces';
import Groupes from './pages/Groupes/Groupes';
import CoursDevoirs from './pages/CoursDevoirs/CoursDevoirs';
import CoursEnLigne from './pages/CoursEnLigne/CoursEnLigne';
import Demandes from './pages/Demandes/Demandes';
import CourseRoom from './CourseRoom/CourseRoom';

const PrivateRoute = ({ children }) => {
  const { token } = useSelector((s) => s.auth);
  return token ? children : <Navigate to="/" replace />;
};

// Redirige vers la bonne page par défaut selon le rôle
const DefaultRedirect = () => {
  const { user } = useSelector((s) => s.auth);
  return <Navigate to={user?.role === 'professor' ? 'annonces' : 'chat'} replace />;
};

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        {/* Full-screen course room — outside the sidebar layout */}
        <Route
          path="/app/cours/:courseId"
          element={
            <PrivateRoute>
              <CourseRoom />
            </PrivateRoute>
          }
        />
        <Route
          path="/app"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<DefaultRedirect />} />
          <Route path="chat"     element={<ChatGlobal />} />
          <Route path="annonces" element={<Annonces />} />
          <Route path="groupes"  element={<Groupes />} />
          <Route path="cours"    element={<CoursDevoirs />} />
          <Route path="live"     element={<CoursEnLigne />} />
          <Route path="demandes" element={<Demandes />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
