# VPS Setup Log — For Automation Script
*Provider: Hetzner CX22 | OS: Ubuntu 24.04 | Location: Ashburn, VA*
*Date: 2026-03-28*

## Server Details
- Hostname: snapi-2gb-ash-1
- User: openclaw
- OpenClaw version: 2026.3.28

## Step-by-Step Commands (in order)

### 1. System Update (as root)
```bash
apt update && apt upgrade -y
```

### 2. Install Node.js 24 (as root)
```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
```

### 3. Create User (as root)
```bash
adduser openclaw
usermod -aG sudo openclaw
loginctl enable-linger openclaw
```

### 4. Install systemd-container (as root)
```bash
apt install -y systemd-container
```

### 5. Install Tailscale (as root)
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh --hostname=openclaw-vps
# Opens auth URL — click to authenticate with Tailscale account
```

### 6. Switch to openclaw user (MUST use machinectl for systemd user session)
```bash
machinectl shell openclaw@
```

### 7. Install OpenClaw (as openclaw)
```bash
curl -fsSL https://openclaw.ai/install.sh | bash
source ~/.bashrc
# When prompted "How do you want to hatch your bot?" → "Do this later"
# When prompted to generate gateway token → Yes
# When prompted to tighten permissions → Yes
```

### 8. Configure Gateway (as openclaw)
```bash
openclaw config set gateway.mode local
openclaw config set gateway.bind loopback
openclaw config set gateway.auth.mode token
openclaw config set gateway.tailscale.mode serve
openclaw config set gateway.trustedProxies '["127.0.0.1"]'
```

### 9. Install & Start Gateway Service (as openclaw)
```bash
openclaw gateway install
systemctl --user start openclaw-gateway
systemctl --user enable openclaw-gateway
systemctl --user status openclaw-gateway
curl http://localhost:18789/health
# Should return: {"ok":true,"status":"live"}
```

### 10. Set Up Tailscale Serve (as root or sudo)
```bash
sudo tailscale serve --https=443 http://localhost:18789
sudo tailscale serve status
```

### 11. Verify Remote Access
From any device on the tailnet:
```
https://openclaw-vps.YOUR-TAILNET.ts.net/
```

## Troubleshooting
- "Gateway start blocked: set gateway.mode=local" → `openclaw config set gateway.mode local`
- "Failed to connect to bus" → Use `machinectl shell openclaw@` instead of `su - openclaw`
- "Out of capacity" (Oracle) → Use Hetzner instead
- Tailscale serve not working → `sudo tailscale serve --https=443 http://localhost:18789`

## Next Steps After Gateway Is Running
1. Configure Discord bot token on VPS
2. Configure Telegram bot token on VPS
3. Set up API keys (Anthropic, OpenAI) on VPS
4. Copy workspace files (AGENTS.md, SOUL.md, etc.) to VPS
5. Connect your Windows PC as a node via Tailscale
6. Lock down VCN/firewall to Tailscale only
