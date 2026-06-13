
const { getDb } = require('../db');

async function getVerifiedStudents(filiere) {
  const filiereTarget = (filiere || '').trim();
  if (!filiereTarget) return [];
  const db = await getDb();
  return db.all(
    'SELECT username, email FROM users WHERE role = ? AND filiere = ? AND email_verified = 1',
    ['student', filiereTarget]
  );
}

async function notifyStudentsByFiliere(filiere, sendFn, label) {
  const students = await getVerifiedStudents(filiere);
  if (students.length === 0) return;

  console.log(`${label} → ${students.length} email(s) (${filiere})`);
  students.forEach(({ username, email }) => {
    sendFn(email, username)
      .then(() => console.log(`  Email → ${email}`))
      .catch((err) => console.error(`  Échec ${email}:`, err.message));
  });
}

module.exports = { getVerifiedStudents, notifyStudentsByFiliere };
