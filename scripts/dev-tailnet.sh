#!/usr/bin/env bash
# Start the dev server so it is reachable from other devices on the tailnet.
#
# Binds Vite to this machine's Tailscale address only — not to 0.0.0.0, so the
# LAN cannot see it — and allows the MagicDNS hostname as a Host header.
#
# Requires: tailscale CLI, python3. No root, no `tailscale serve` needed.
# For HTTPS on 443 instead of http://host:5173, use `tailscale serve` (needs
# operator rights: `sudo tailscale set --operator=$USER` once), then run this
# with PUBLIC_DEV_PROXY=1.
set -euo pipefail

bind="$(tailscale ip -4 | head -1)"
host="$(tailscale status --json | python3 -c 'import sys,json; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"

echo "tailnet:  http://${host}:5173/open-letter/"
echo "local:    http://${bind}:5173/open-letter/"

DEV_BIND_HOST="$bind" PUBLIC_DEV_HOST="$host" exec npm run dev
