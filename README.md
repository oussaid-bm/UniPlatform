# UniPlatform

## Video Architecture – Janus SFU

Live video sessions use [Janus Gateway](https://janus.conf.meetecho.com/) as a Selective Forwarding Unit (SFU) instead of peer-to-peer mesh. This means each participant sends their stream once to Janus, which then forwards it to all other participants.

### Quick Start

```bash
# Start Janus (requires Docker)
docker compose up -d janus

# Start the backend
cd server && npm install && npm start

# Start the frontend
cd front && npm install && npm start
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JANUS_URL` | `http://localhost:8088/janus` | Janus REST API endpoint |
| `JANUS_WS_URL` | `ws://localhost:8188` | Janus WebSocket URL (clients connect here) |
| `JANUS_API_SECRET` | `janusapisecret` | Janus API secret (set in `janus/janus.jcfg`) |
| `JANUS_VIDEOROOM_ADMIN_KEY` | `supersecret` | VideoRoom plugin admin key |

### Production Deployment

For production, update `janus/janus.jcfg`:
- Set `nat_1_1_mapping` to your server's public IP
- Configure TURN server credentials
- Enable HTTPS/WSS transports
- Change the admin and API secrets
