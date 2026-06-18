/**
 * LiveKit (SFU) helper.
 *
 * Le serveur LiveKit (cloud) héberge les "rooms" et redistribue les flux
 * (architecture SFU). Notre serveur Node ne fait que générer un JETON
 * d'accès signé pour chaque participant qui rejoint une room.
 *
 * IMPORTANT : l'identité (identity) du participant = son socket.id, afin que
 * la logique "interroger / lever la main" (qui manipule des socket IDs)
 * corresponde directement aux flux distants reçus côté client.
 *
 * Variables .env requises :
 *   LIVEKIT_URL        = wss://xxxx.livekit.cloud
 *   LIVEKIT_API_KEY    = APIxxxxxxxx
 *   LIVEKIT_API_SECRET = (le secret, à garder privé)
 */

const { AccessToken } = require('livekit-server-sdk');

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

function isConfigured() {
  return Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}

/**
 * Génère un jeton d'accès LiveKit.
 * @param {string} roomName  nom de la room (ex. "course-12")
 * @param {string} identity  identité unique du participant (= socket.id)
 * @param {string} name      nom affiché (username)
 * @returns {Promise<string>} le JWT d'accès
 */
async function createToken(roomName, identity, name) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: name || identity,
    ttl: '6h',
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  // toJwt() est asynchrone dans livekit-server-sdk v2
  return await at.toJwt();
}

module.exports = { createToken, isConfigured, LIVEKIT_URL };
