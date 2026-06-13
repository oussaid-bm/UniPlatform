/**
 * useJanus – React hook that wraps Janus Gateway VideoRoom plugin.
 *
 * Handles:
 *  - Connecting to Janus via WebSocket
 *  - Publishing local media (as a VideoRoom publisher)
 *  - Subscribing to remote feeds (as VideoRoom subscribers)
 *  - Unpublishing / cleanup
 *
 * The hook returns helpers so VideoChat.js only manages UI + floor logic.
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import Janus from 'janus-gateway';

const ICE_SERVERS = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:global.relay.metered.ca:80',
    username: 'ed5f9fd343f6092b3dcc81d7',
    credential: 'km71W6e3w0iXGk21',
  },
  {
    urls: 'turn:global.relay.metered.ca:80?transport=tcp',
    username: 'ed5f9fd343f6092b3dcc81d7',
    credential: 'km71W6e3w0iXGk21',
  },
  {
    urls: 'turn:global.relay.metered.ca:443',
    username: 'ed5f9fd343f6092b3dcc81d7',
    credential: 'km71W6e3w0iXGk21',
  },
  {
    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
    username: 'ed5f9fd343f6092b3dcc81d7',
    credential: 'km71W6e3w0iXGk21',
  },
];

export default function useJanus() {
  const janusRef = useRef(null);
  const publisherRef = useRef(null);
  const subscriberHandles = useRef({});  // feedId → pluginHandle
  const [remoteStreams, setRemoteStreams] = useState({});
  const [connected, setConnected] = useState(false);
  const [myFeedId, setMyFeedId] = useState(null);
  const roomRef = useRef(null);
  const displayRef = useRef(null);
  const onNewFeedRef = useRef(null);

  // Initialize Janus and connect to the server
  const connect = useCallback((janusWsUrl, roomId, displayName, onNewFeed) => {
    return new Promise((resolve, reject) => {
      roomRef.current = roomId;
      displayRef.current = displayName;
      onNewFeedRef.current = onNewFeed;

      Janus.init({
        debug: 'warn',
        callback: () => {
          const janus = new Janus({
            server: janusWsUrl,
            iceServers: ICE_SERVERS,
            success: () => {
              janusRef.current = janus;
              setConnected(true);
              resolve(janus);
            },
            error: (err) => {
              console.error('[Janus] Connection error:', err);
              reject(err);
            },
            destroyed: () => {
              console.log('[Janus] Session destroyed');
              setConnected(false);
            },
          });
        },
      });
    });
  }, []);

  // Attach as publisher to the VideoRoom
  const publish = useCallback((stream) => {
    return new Promise((resolve, reject) => {
      if (!janusRef.current) { reject(new Error('Not connected')); return; }

      janusRef.current.attach({
        plugin: 'janus.plugin.videoroom',
        success: (handle) => {
          publisherRef.current = handle;

          handle.send({
            message: {
              request: 'join',
              room: roomRef.current,
              ptype: 'publisher',
              display: displayRef.current,
            },
          });
        },
        error: (err) => {
          console.error('[Janus] Publisher attach error:', err);
          reject(err);
        },
        onmessage: (msg, jsep) => {
          const event = msg.videoroom;

          if (event === 'joined') {
            setMyFeedId(msg.id);

            // Create SDP offer and publish
            publisherRef.current.createOffer({
              stream: stream,
              success: (jsepOffer) => {
                publisherRef.current.send({
                  message: { request: 'configure', audio: true, video: true },
                  jsep: jsepOffer,
                });
              },
              error: (err) => {
                console.error('[Janus] createOffer error:', err);
                reject(err);
              },
            });

            // Subscribe to existing publishers
            if (msg.publishers && msg.publishers.length > 0) {
              msg.publishers.forEach((pub) => {
                subscribeToFeed(pub.id, pub.display);
              });
            }

            resolve(msg.id);
          } else if (event === 'event') {
            // New publisher joined
            if (msg.publishers) {
              msg.publishers.forEach((pub) => {
                subscribeToFeed(pub.id, pub.display);
              });
            }
            // Publisher left
            if (msg.unpublished) {
              const feedId = msg.unpublished;
              if (feedId !== 'ok') {
                cleanupSubscriber(feedId);
              }
            }
            if (msg.leaving) {
              cleanupSubscriber(msg.leaving);
            }
          }

          if (jsep) {
            publisherRef.current.handleRemoteJsep({ jsep });
          }
        },
        onlocaltrack: () => { /* managed externally */ },
        oncleanup: () => {
          console.log('[Janus] Publisher cleanup');
        },
      });
    });
  }, []);

  // Subscribe to a remote feed
  const subscribeToFeed = useCallback((feedId, feedDisplay) => {
    if (!janusRef.current) return;
    if (subscriberHandles.current[feedId]) return;

    janusRef.current.attach({
      plugin: 'janus.plugin.videoroom',
      success: (handle) => {
        subscriberHandles.current[feedId] = handle;
        handle.send({
          message: {
            request: 'join',
            room: roomRef.current,
            ptype: 'subscriber',
            feed: feedId,
          },
        });
      },
      error: (err) => {
        console.error(`[Janus] Subscriber attach error (feed ${feedId}):`, err);
      },
      onmessage: (msg, jsep) => {
        if (jsep) {
          subscriberHandles.current[feedId]?.createAnswer({
            jsep,
            tracks: [{ type: 'audio', capture: false }, { type: 'video', capture: false }],
            success: (jsepAnswer) => {
              subscriberHandles.current[feedId]?.send({
                message: { request: 'start', room: roomRef.current },
                jsep: jsepAnswer,
              });
            },
            error: (err) => {
              console.error(`[Janus] createAnswer error (feed ${feedId}):`, err);
            },
          });
        }
      },
      onremotetrack: (track, mid, added) => {
        if (!added) return;
        const existing = remoteStreams[feedId];
        let mediaStream;
        if (existing) {
          mediaStream = existing;
          mediaStream.addTrack(track);
        } else {
          mediaStream = new MediaStream([track]);
        }
        setRemoteStreams((prev) => ({ ...prev, [feedId]: mediaStream }));
        if (onNewFeedRef.current) {
          onNewFeedRef.current(feedId, feedDisplay, mediaStream);
        }
      },
      oncleanup: () => {
        cleanupSubscriber(feedId);
      },
    });
  }, []);

  const cleanupSubscriber = useCallback((feedId) => {
    if (subscriberHandles.current[feedId]) {
      subscriberHandles.current[feedId].detach();
      delete subscriberHandles.current[feedId];
    }
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[feedId];
      return next;
    });
  }, []);

  // Unpublish (stop sending media but stay in room)
  const unpublish = useCallback(() => {
    if (publisherRef.current) {
      publisherRef.current.send({ message: { request: 'unpublish' } });
    }
  }, []);

  // Replace the video track being published (for screen share)
  const replaceVideoTrack = useCallback(async (newTrack) => {
    if (!publisherRef.current) return;
    const senders = publisherRef.current.webrtcStuff?.pc?.getSenders?.() || [];
    const videoSender = senders.find((s) => s.track?.kind === 'video');
    if (videoSender) {
      await videoSender.replaceTrack(newTrack);
    }
  }, []);

  // Configure audio/video mute on publisher
  const configureMedia = useCallback(({ audio, video }) => {
    if (!publisherRef.current) return;
    const msg = { request: 'configure' };
    if (audio !== undefined) msg.audio = audio;
    if (video !== undefined) msg.video = video;
    publisherRef.current.send({ message: msg });
  }, []);

  // Full disconnect
  const disconnect = useCallback(() => {
    Object.keys(subscriberHandles.current).forEach((feedId) => {
      subscriberHandles.current[feedId]?.detach();
    });
    subscriberHandles.current = {};
    if (publisherRef.current) {
      publisherRef.current.detach();
      publisherRef.current = null;
    }
    if (janusRef.current) {
      janusRef.current.destroy();
      janusRef.current = null;
    }
    setRemoteStreams({});
    setConnected(false);
    setMyFeedId(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    publish,
    unpublish,
    replaceVideoTrack,
    configureMedia,
    disconnect,
    remoteStreams,
    connected,
    myFeedId,
  };
}
