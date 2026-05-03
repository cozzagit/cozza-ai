#!/usr/bin/env bash
# Deploy cozza-ai to Aruba VPS — git-pull + remote-build pattern.
#
# Local prerequisites: ssh, ~/.ssh/aruba_vps
# Remote prerequisites: git, node>=20, pnpm@9, pm2, nginx, certbot
#                       /var/www/cozza-ai/apps/api/.env (one-time, with secrets)
#
# Run from repo root:
#     bash deploy/deploy.sh
#
# Idempotent. First run: clones, installs, builds, configures nginx+SSL, starts PM2.
# Next runs: pulls, rebuilds, reloads PM2+nginx.

set -euo pipefail

VPS_HOST="${VPS_HOST:-188.213.170.214}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/aruba_vps}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/cozza-ai}"
DOMAIN="${DOMAIN:-cozza-ai.vibecanyon.com}"
REPO_URL="${REPO_URL:-https://github.com/cozzagit/cozza-ai.git}"
BRANCH="${BRANCH:-main}"

# Ensure local commit is pushed before deploying
LOCAL_SHA="$(git rev-parse HEAD)"
echo "▶ Local HEAD: $LOCAL_SHA"
if ! git fetch origin "$BRANCH" --quiet 2>/dev/null; then
  echo "  ⚠ git fetch failed, continuing"
fi
REMOTE_SHA="$(git rev-parse origin/$BRANCH 2>/dev/null || echo unknown)"
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ] && [ "$REMOTE_SHA" != "unknown" ]; then
  echo "  ⚠ origin/$BRANCH ($REMOTE_SHA) != HEAD ($LOCAL_SHA)"
  echo "  → run 'git push' first if you want to deploy your local commit"
  exit 1
fi

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$VPS_USER@$VPS_HOST" \
  REPO_URL="$REPO_URL" REMOTE_DIR="$REMOTE_DIR" BRANCH="$BRANCH" DOMAIN="$DOMAIN" \
  bash -se <<'REMOTE_SCRIPT'
set -euo pipefail

echo "▶ Remote: $(hostname) — $(date -u +%FT%TZ)"

# Tooling availability
export PATH="/root/.local/share/pnpm:/usr/local/bin:/usr/bin:$PATH"
command -v pnpm >/dev/null || { corepack enable && corepack prepare pnpm@9.12.0 --activate; }
echo "  node $(node --version) · pnpm $(pnpm --version) · pm2 $(pm2 --version)"

# Clone or pull
if [ ! -d "$REMOTE_DIR/.git" ]; then
  echo "▶ First clone into $REMOTE_DIR"
  # Preserve any existing .env etc by cloning into a temp dir first
  if [ -f "$REMOTE_DIR/apps/api/.env" ]; then
    cp "$REMOTE_DIR/apps/api/.env" /tmp/cozza-ai-api.env.bak
  fi
  rm -rf "$REMOTE_DIR.tmp"
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$REMOTE_DIR.tmp"
  mkdir -p "$REMOTE_DIR"
  rsync -a --delete --exclude='/apps/api/.env' "$REMOTE_DIR.tmp/" "$REMOTE_DIR/"
  rm -rf "$REMOTE_DIR.tmp"
  if [ -f /tmp/cozza-ai-api.env.bak ] && [ ! -f "$REMOTE_DIR/apps/api/.env" ]; then
    cp /tmp/cozza-ai-api.env.bak "$REMOTE_DIR/apps/api/.env"
    chmod 600 "$REMOTE_DIR/apps/api/.env"
  fi
else
  echo "▶ git pull origin/$BRANCH"
  cd "$REMOTE_DIR"
  git fetch --depth 1 origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

cd "$REMOTE_DIR"
COMMIT_SHA="$(git rev-parse --short HEAD)"
echo "  commit: $COMMIT_SHA"

# Install (full, not --prod, because we need devDeps to build)
echo "▶ pnpm install"
pnpm install --frozen-lockfile

echo "▶ Build shared package"
pnpm --filter @cozza/shared build

echo "▶ Build web bundle ($DOMAIN)"
VITE_API_BASE_URL="" VITE_BUILD_COMMIT="$COMMIT_SHA" pnpm --filter web build

echo "▶ Build api bundle"
pnpm --filter api build

# Cockpit HUD + Remote: optional, only build if the workspaces exist
if [ -f apps/cockpit-hud/package.json ]; then
  echo "▶ Build cockpit-hud bundle"
  pnpm --filter cockpit-hud build || echo "  ⚠ cockpit-hud build failed, continuing"
fi
if [ -f apps/cockpit-remote/package.json ]; then
  echo "▶ Build cockpit-remote bundle"
  pnpm --filter cockpit-remote build || echo "  ⚠ cockpit-remote build failed, continuing"
fi

echo "▶ Verify no secret leak in web bundle"
if grep -rE '(sk-(ant|proj)-|xi-api-key|sk_[a-zA-Z0-9]{20,})' apps/web/dist >/dev/null 2>&1; then
  echo "  ✗ FATAL: secret leaked into apps/web/dist — abort" >&2
  exit 1
fi
echo "  ✓ clean"

# Inject COMMIT_SHA into the api .env (replace if line exists, append otherwise).
# Ensure the file ends with a newline before appending — otherwise we create a
# concatenated line like ADMIN_TOKEN_TTL_SECONDS=86400COMMIT_SHA=… which trips Zod.
if [ -f apps/api/.env ]; then
  if grep -q '^COMMIT_SHA=' apps/api/.env; then
    sed -i "s/^COMMIT_SHA=.*/COMMIT_SHA=$COMMIT_SHA/" apps/api/.env
  else
    [ -n "$(tail -c1 apps/api/.env)" ] && echo "" >> apps/api/.env
    echo "COMMIT_SHA=$COMMIT_SHA" >> apps/api/.env
  fi
fi

# Nginx config
echo "▶ Symlink nginx config + reload"
cp deploy/nginx-cozza-ai.conf /etc/nginx/sites-available/cozza-ai
ln -sf /etc/nginx/sites-available/cozza-ai /etc/nginx/sites-enabled/cozza-ai
nginx -t
systemctl reload nginx

# SSL via certbot (idempotent — always re-applies the nginx directives because
# we just overwrote sites-available/cozza-ai with the bare HTTP config)
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "▶ Issuing Let's Encrypt cert for $DOMAIN"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect -m luca.cozza@gmail.com
else
  echo "▶ Re-applying SSL directives for $DOMAIN"
  certbot install --nginx --cert-name "$DOMAIN" --redirect --non-interactive
fi
nginx -t && systemctl reload nginx

# Make sure /var/log/pm2 exists
mkdir -p /var/log/pm2

# PM2 reload (or first-time start)
echo "▶ PM2 reload"
if pm2 describe cozza-ai-api >/dev/null 2>&1; then
  pm2 reload cozza-ai-api --update-env
else
  pm2 start ecosystem.config.cjs --only cozza-ai-api --update-env
fi
pm2 save

# Health check
sleep 2
echo "▶ Local health check"
curl -sf http://127.0.0.1:3025/api/healthz | head -c 200 && echo
echo "  ✓ healthz OK"

echo "▶ Remote done. Live at https://$DOMAIN"
REMOTE_SCRIPT
