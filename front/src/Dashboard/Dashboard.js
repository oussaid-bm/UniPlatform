
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/slices/authSlice';
import { setCourses, addCourse, removeCourse, setCoursesLoading } from '../store/slices/coursesSlice';
import './Dashboard.css';

const API = 'http://localhost:3003/api';

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, token } = useSelector((s) => s.auth);
  const { courses, loading } = useSelector((s) => s.courses);
  const [form, setForm] = useState({ title: '', description: '' });
  const [creating, setCreating] = useState(false);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    fetchCourses();
  }, [token]);

  const fetchCourses = async () => {
    dispatch(setCoursesLoading(true));
    try {
      const res = await fetch(`${API}/courses`, { headers });
      const data = await res.json();
      dispatch(setCourses(Array.isArray(data) ? data : []));
    } catch {
      dispatch(setCourses([]));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/courses`, {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        dispatch(addCourse({ ...data, professor_name: user.username }));
        setForm({ title: '', description: '' });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (courseId, e) => {
    e.stopPropagation();
    if (!window.confirm('Supprimer ce cours ?')) return;
    const res = await fetch(`${API}/courses/${courseId}`, { method: 'DELETE', headers });
    if (res.ok) dispatch(removeCourse(courseId));
  };

  const handleJoin = (courseId) => {
    navigate(`/course/${courseId}`);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const isProfessor = user?.role === 'professor';

  return (
    <div className="dashboard">
      <nav className="dashboard_nav">
        <span className="nav_brand">UnivLearn</span>
        <div className="nav_user">
          <span className="nav_username">{user?.username}</span>
          <span className={`nav_badge ${user?.role}`}>
            {isProfessor ? 'Professeur' : 'Etudiant'}
          </span>
          <button className="logout_btn" onClick={handleLogout}>Déconnexion</button>
        </div>
      </nav>

      <div className="dashboard_content">
        <div className="dashboard_header">
          <h2>Bonjour, {user?.username}</h2>
          <p>
            {isProfessor
              ? 'Gérez vos cours et démarrez des sessions vidéo.'
              : 'Rejoignez un cours pour assister aux sessions.'}
          </p>
        </div>

        {isProfessor && (
          <form className="create_course_form" onSubmit={handleCreate}>
            <h3>Créer un nouveau cours</h3>
            <input
              placeholder="Titre du cours"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <textarea
              rows={3}
              placeholder="Description (optionnel)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <button className="create_btn" type="submit" disabled={creating || !form.title.trim()}>
              {creating ? 'Création...' : 'Créer le cours'}
            </button>
          </form>
        )}

        <p className="courses_section_title">
          {isProfessor ? 'Mes cours' : 'Cours disponibles'}
        </p>

        {loading ? (
          <div className="empty_state">Chargement...</div>
        ) : courses.length === 0 ? (
          <div className="empty_state">
            {isProfessor ? 'Aucun cours créé pour le moment.' : 'Aucun cours disponible.'}
          </div>
        ) : (
          <div className="courses_grid">
            {courses.map((course) => (
              <div className="course_card" key={course.id} onClick={() => handleJoin(course.id)}>
                <div className="course_card_title">{course.title}</div>
                <div className="course_card_desc">{course.description || 'Pas de description.'}</div>
                <div className="course_card_footer">
                  <span className="course_prof">Par {course.professor_name}</span>
                  <div className="card_actions" onClick={(e) => e.stopPropagation()}>
                    <button className="join_btn" onClick={() => handleJoin(course.id)}>
                      Rejoindre
                    </button>
                    {isProfessor && course.professor_id === user.id && (
                      <button className="delete_btn" onClick={(e) => handleDelete(course.id, e)}>
                        Suppr.
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
