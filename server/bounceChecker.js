const { ImapFlow } = require('imapflow');
const { getDb }    = require('./db');

const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const DELAY_MS   = 2.5 * 60 * 1000; // 2.5 minutes (gmail bounce en ~1 min)

async function hasBounceForEmail(targetEmail) {
  if (!EMAIL_USER || !EMAIL_PASS) return false;

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    // Cherche tous les emails des 8 dernières minutes
    const since = new Date(Date.now() - 8 * 60 * 1000);

    // Plusieurs patterns d'expéditeur possibles pour les bounces Gmail
    const searches = [
      { from: 'mailer-daemon@googlemail.com', since },
      { from: 'mailer-daemon@google.com', since },
      { from: 'postmaster', since },
      { subject: 'Delivery Status Notification', since },
      { subject: 'Address not found', since },
      { subject: 'Undelivered Mail', since },
    ];

    const uidSet = new Set();
    for (const criteria of searches) {
      try {
        const results = await client.search(criteria);
        results.forEach(uid => uidSet.add(uid));
      } catch {}
    }

    console.log(`Bounce check pour ${targetEmail} : ${uidSet.size} emails trouvés`);

    for (const uid of uidSet) {
      try {
        const msg = await client.fetchOne(String(uid), {
          envelope: true,
          bodyStructure: true,
          source: true,
        });
        const raw = msg?.source?.toString() || '';
        if (raw.toLowerCase().includes(targetEmail.toLowerCase())) {
          console.log(`Bounce confirmé pour ${targetEmail}`);
          return true;
        }
      } catch {}
    }

    console.log(`Pas de bounce trouvé pour ${targetEmail}`);
    return false;
  } catch (err) {
    console.error('Erreur IMAP:', err.message);
    return false;
  } finally {
    try { await client.logout(); } catch {}
  }
}

function scheduleBounceCheck(email, userId) {
  if (!EMAIL_USER || !EMAIL_PASS) return;

  setTimeout(async () => {
    try {
      const bounced = await hasBounceForEmail(email);
      if (!bounced) return;

      const db   = await getDb();
      const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

      if (user && !user.email_verified) {
        await db.run('DELETE FROM users WHERE id = ?', [userId]);
        console.log(`Compte supprimé (bounce) : ${email}`);
      }
    } catch (err) {
      console.error('Erreur bounce check:', err.message);
    }
  }, DELAY_MS);
}

module.exports = { scheduleBounceCheck };
