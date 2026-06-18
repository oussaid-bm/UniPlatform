/**
 * useLiveKit – hook React qui encapsule le SDK livekit-client (SFU).
 *
 * Remplace useJanus en gardant la MÊME interface, pour que VideoChat.js
 * ne gère que l'UI + la logique "lever la main / interroger".
 *
 *  - connect(url, token, onNewFeed)  : rejoint la room avec un jeton
 *  - publish(stream)                 : publie ses pistes (caméra + micro)
 *  - replaceVideoTrack(track)        : remplace la piste vidéo (partage d'écran)
 *  - disconnect()                    : quitte la room et nettoie
 *  - remoteStreams                   : { identity(socket.id) → MediaStream }
 *
 * Côté serveur, l'identité du participant = son socket.id : les clés de
 * remoteStreams correspondent donc aux socket IDs utilisés par la logique
 * "floor" (grantedIds, professorSocketId).
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { Room, RoomEvent } from 'livekit-client';

export default function useLiveKit() {
  const roomRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [connected, setConnected] = useState(false);
  const onNewFeedRef = useRef(null);

  // (Re)construit le MediaStream d'un participant à partir de ses pistes publiées
  const buildStreamFor = useCallback((participant) => {
    const ms = new MediaStream();
    participant.trackPublications.forEach((pub) => {
      if (pub.track && pub.track.mediaStreamTrack) {
        try { ms.addTrack(pub.track.mediaStreamTrack); } catch { /* déjà présent */ }
      }
    });
    return ms;
  }, []);

  const pushFeed = useCallback((participant) => {
    const id = participant.identity;               // = socket.id
    const stream = buildStreamFor(participant);
    setRemoteStreams((prev) => ({ ...prev, [id]: stream }));
    if (onNewFeedRef.current) onNewFeedRef.current(id, participant.name || id, stream);
  }, [buildStreamFor]);

  const removeFeed = useCallback((identity) => {
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[identity];
      return next;
    });
  }, []);

  const connect = useCallback(async (url, token, onNewFeed) => {
    onNewFeedRef.current = onNewFeed;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room
      .on(RoomEvent.TrackSubscribed, (_track, _pub, participant) => pushFeed(participant))
      .on(RoomEvent.TrackUnsubscribed, (_track, _pub, participant) => pushFeed(participant))
      .on(RoomEvent.TrackMuted, (_pub, participant) => pushFeed(participant))
      .on(RoomEvent.TrackUnmuted, (_pub, participant) => pushFeed(participant))
      .on(RoomEvent.ParticipantDisconnected, (participant) => removeFeed(participant.identity))
      .on(RoomEvent.Disconnected, () => setConnected(false));

    await room.connect(url, token);
    setConnected(true);

    // Participants déjà présents (leurs pistes arriveront via TrackSubscribed)
    room.remoteParticipants.forEach((p) => { if (p.trackPublications.size) pushFeed(p); });
    return room;
  }, [pushFeed, removeFeed]);

  // Publie les pistes d'un MediaStream local (caméra + micro déjà capturés)
  const publish = useCallback(async (stream) => {
    const room = roomRef.current;
    if (!room || !stream) return;
    for (const track of stream.getTracks()) {
      try { await room.localParticipant.publishTrack(track); } catch (e) { console.error('[LiveKit] publishTrack', e); }
    }
  }, []);

  // Remplace la piste vidéo publiée (partage d'écran <-> caméra)
  const replaceVideoTrack = useCallback(async (newTrack) => {
    const room = roomRef.current;
    if (!room || !newTrack) return;
    const pubs = Array.from(room.localParticipant.videoTrackPublications.values());
    const current = pubs[0];
    if (current && current.track) {
      try { await room.localParticipant.unpublishTrack(current.track.mediaStreamTrack); } catch { /* ignore */ }
    }
    try { await room.localParticipant.publishTrack(newTrack); } catch (e) { console.error('[LiveKit] replaceVideoTrack', e); }
  }, []);

  // Conservé pour compat d'interface avec useJanus (le mute se fait via track.enabled côté VideoChat)
  const unpublish = useCallback(() => {}, []);
  const configureMedia = useCallback(() => {}, []);

  const disconnect = useCallback(() => {
    try { roomRef.current?.disconnect(); } catch { /* ignore */ }
    roomRef.current = null;
    setRemoteStreams({});
    setConnected(false);
  }, []);

  useEffect(() => () => { try { roomRef.current?.disconnect(); } catch { /* ignore */ } }, []);

  return { connect, publish, unpublish, replaceVideoTrack, configureMedia, disconnect, remoteStreams, connected };
}
