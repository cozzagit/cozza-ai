#!/usr/bin/env bash
# Deploy cozza-ai to Aruba VPS.
# - Builds locally (web + api dist)
# - rsync sources to /var/www/cozza-ai
# - On the VPS: pnpm install --prod, pm2 reload, nginx reload
#
# Run from repo root:
#     bash deploy/deploy.sh
#
# Requires:
#   - SSH key ~/.ssh/aruba_vps with access to root@188.213.170.214
#   - apps/api/.env on the VPS at /var/www/cozza-ai/apps/api/.env (one-time)
#   - DNS A record cozza-ai.vibecanyon.com → 188.213.170.214 (already done)

set -euo pipefail

VPS_HOST="${VPS_HOST:-188.213.170.214}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/aruba_vps}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/cozza-ai}"
DOMAIN="${DOMAIN:-cozza-ai.vibecanyon.com}"

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo local)"

echo "▶ Building locally @ $GIT_SHA"
pnpm install --frozen-lockfile
pnpm --filter @cozza/shared build
VITE_BUILD_COMMIT="$GIT_SHA" pnpm --filter web build
pnpm --filter api build

echo "▶ Verifying no secret-looking strings in web bundle"
if grep -rE '(sk-(ant|proj)-|xi-api-key|sk_[a-zA-Z0-9]{20,})' apps/web/dist >/dev/null 2>&1; then
  echo "  ✗ FATAL: secret leaked into apps/web/dist — abort" >&2
  exit 1
fi
echo "  ✓ clean"

ssh_run() {
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$VPS_USER@$VPS_HOST" "$@"
}
rsync_to() {
  rsync -az --delete -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" "$@"
}

echo "▶ Ensuring remote dirs"
ssh_run "mkdir -p $REMOTE_DIR/apps/web/dist $REMOTE_DIR/apps/api/dist $REMOTE_DIR/packages/shared/dist /var/log/pm2"

echo "▶ Sync web bundle"
rsync_to apps/web/dist/ "$VPS_USER@$VPS_HOST:$REMOTE_DIR/apps/web/dist/"

echo "▶ Sync api dist + manifests"
rsync_to apps/api/dist/ "$VPS_USER@$VPS_HOST:$REMOTE_DIR/apps/api/dist/"
rsync_to apps/api/package.json "$VPS_USER@$VPS_HOST:$REMOTE_DIR/apps/api/"

echo "▶ Sync shared dist + manifests (workspace dep for api)"
rsync_to packages/shared/dist/ "$VPS_USER@$VPS_HOST:$REMOTE_DIR/packages/shared/dist/"
rsync_to packages/shared/package.json "$VPS_USER@$VPS_HOST:$REMOTE_DIR/packages/shared/"

echo "▶ Sync root manifests + ecosystem"
rsync_to package.json pnpm-workspace.yaml ecosystem.config.cjs "$VPS_USER@$VPS_HOST:$REMOTE_DIR/"
# Lockfile: only if it exists locally
if [ -f pnpm-lock.yaml ]; then
  rsync_to pnpm-lock.yaml "$VPS_USER@$VPS_HOST:$REMOTE_DIR/"
fi

echo "▶ Sync nginx config (root only)"
rsync_to deploy/nginx-cozza-ai.conf "$VPS_USER@$VPS_HOST:/etc/nginx/sites-available/cozza-ai"

echo "▶ Remote: install prod deps + restart"
ssh_run bash -se <<EOF
set -euo pipefail
cd "$REMOTE_DIR"

# Use the system pnpm (node 20+ + corepack-managed pnpm@9 expected on the VPS)
export PATH="/root/.local/share/pnpm:/usr/local/bin:/usr/bin:\$PATH"
command -v pnpm >/dev/null || corepack enable && corepack prepare pnpm@9.12.0 --activate

# Production install (uses pnpm-lock.yaml; if missing, falls back to install)
if [ -f pnpm-lock.yaml ]; then
  pnpm install --frozen-lockfile --prod --filter !@cozza/shared || pnpm install --prod --filter !@cozza/shared
else
  pnpm install --prod --filter !@cozza/shared
fi

# Symlink nginx + reload
ln -sf /etc/nginx/sites-available/cozza-ai /etc/nginx/sites-enabled/cozza-ai
nginx -t
systemctl reload nginx

# Issue/refresh SSL (idempotent)
if ! [ -d /etc/letsencrypt/live/$DOMAIN ]; then
  certbot --nginx -d $DOMAIN --non-interactive --agree-tos --redirect -m luca.cozza@gmail.com
fi

# Reload or start PM2
if pm2 describe cozza-ai-api >/dev/null 2>&1; then
  pm2 reload cozza-ai-api --update-env
else
  pm2 start $REMOTE_DIR/ecosystem.config.cjs --only cozza-ai-api --update-env
fi
pm2 save

# Sanity check
sleep 1
curl -sf http://127.0.0.1:3025/api/healthz && echo "  ✓ healthz OK"
EOF

echo "▶ Done. Live at https://$DOMAIN"
