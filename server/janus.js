/**
 * Janus Gateway HTTP API helper.
 *
 * Manages VideoRoom plugin rooms via the Janus REST API.
 * The Node server creates/destroys rooms; browsers connect directly
 * to Janus via WebSocket for media (publish/subscribe).
 */

const JANUS_URL = process.env.JANUS_URL || 'http://localhost:8088/janus';
const JANUS_API_SECRET = process.env.JANUS_API_SECRET || 'janusapisecret';
const VIDEOROOM_ADMIN_KEY = process.env.JANUS_VIDEOROOM_ADMIN_KEY || 'supersecret';

let sessionId = null;
let handleId = null;

async function janusPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function txId() {
  return Math.random().toString(36).slice(2, 12);
}

async function ensureSession() {
  if (sessionId && handleId) return;

  // Create a Janus session
  const sess = await janusPost(JANUS_URL, {
    janus: 'create',
    transaction: txId(),
    apisecret: JANUS_API_SECRET,
  });
  sessionId = sess.data.id;

  // Attach the VideoRoom plugin
  const att = await janusPost(`${JANUS_URL}/${sessionId}`, {
    janus: 'attach',
    plugin: 'janus.plugin.videoroom',
    transaction: txId(),
    apisecret: JANUS_API_SECRET,
  });
  handleId = att.data.id;
}

async function videoroomRequest(body) {
  await ensureSession();
  const res = await janusPost(`${JANUS_URL}/${sessionId}/${handleId}`, {
    janus: 'message',
    transaction: txId(),
    apisecret: JANUS_API_SECRET,
    body,
  });
  return res?.plugindata?.data || res;
}

/**
 * Create a VideoRoom for a course session.
 * @param {string} roomId - unique room identifier (course ID)
 * @param {string} description - room description
 * @returns {object} Janus response
 */
async function createRoom(roomId, description = '') {
  return videoroomRequest({
    request: 'create',
    room: roomId,
    description: description || `Course ${roomId}`,
    publishers: 6,
    bitrate: 512000,
    fir_freq: 10,
    videocodec: 'vp8',
    audiocodec: 'opus',
    record: false,
    admin_key: VIDEOROOM_ADMIN_KEY,
    is_private: false,
    permanent: false,
  });
}

/**
 * Destroy a VideoRoom when the session ends.
 * @param {string} roomId
 */
async function destroyRoom(roomId) {
  return videoroomRequest({
    request: 'destroy',
    room: roomId,
    admin_key: VIDEOROOM_ADMIN_KEY,
  });
}

/**
 * Check if a room exists.
 * @param {string} roomId
 */
async function roomExists(roomId) {
  const res = await videoroomRequest({ request: 'exists', room: roomId });
  return res?.exists === true;
}

/**
 * List participants in a room.
 * @param {string} roomId
 */
async function listParticipants(roomId) {
  const res = await videoroomRequest({ request: 'listparticipants', room: roomId });
  return res?.participants || [];
}

/**
 * Reset the cached session (e.g. if Janus restarts).
 */
function resetSession() {
  sessionId = null;
  handleId = null;
}

module.exports = {
  createRoom,
  destroyRoom,
  roomExists,
  listParticipants,
  resetSession,
  JANUS_URL,
};
