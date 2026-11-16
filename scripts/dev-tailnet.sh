#!/usr/bin/env bash
# Start the dev server so it is reachable from other devices on the tailnet.
#
# Two modes, because they bind differently:
#
#   plain                binds this machine's Tailscale address (not 0.0.0.0, so
#                        the LAN cannot see it) and serves http://host:5173.
#                        Enough to look at the page — but *not* for wallets: a
#                        hostname over plain HTTP is not a secure context, so the
#                        browser withholds crypto.subtle and the WalletConnect
#                        handshake cannot complete.
#
#   PUBLIC_DEV_PROXY=1   for `tailscale serve`, which terminates TLS on 443 and
#                        proxies to 127.0.0.1:5173 — so this mode binds loopback
#                        and tells HMR to use wss:443. Needs, once:
#                          sudo tailscale serve --bg 5173
#                          sudo tailscale set --operator=$USER   (then serve needs no sudo)
#
# Requires: tailscale CLI, python3.
set -euo pipefail

host="$(tailscale status --json | python3 -c 'import sys,json; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"

if [[ "${PUBLIC_DEV_PROXY:-}" == "1" ]]; then
  echo "https:    https://${host}/open-letter/   (through \`tailscale serve\`)"
  echo "local:    http://127.0.0.1:5173/open-letter/"
  DEV_BIND_HOST=127.0.0.1 PUBLIC_DEV_HOST="$host" PUBLIC_DEV_PROXY=1 exec npm run dev
fi

bind="$(tailscale ip -4 | head -1)"
echo "tailnet:  http://${host}:5173/open-letter/   (no wallet: not a secure context)"
echo "local:    http://${bind}:5173/open-letter/"
echo "wallets:  PUBLIC_DEV_PROXY=1 npm run dev:tailnet   (with \`sudo tailscale serve --bg 5173\`)"

DEV_BIND_HOST="$bind" PUBLIC_DEV_HOST="$host" exec npm run dev
