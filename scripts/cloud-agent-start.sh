#!/usr/bin/env bash
# Per-boot startup for the Cloud Agent environment. Idempotent: brings up the
# Docker daemon and the local Supabase stack, bootstraps the database schema
# the first time, and writes .env.local. The Next.js dev server itself runs as
# a separate persistent terminal (see .cursor/environment.json).
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# 1. Docker daemon. Nested VMs need the fuse-overlayfs storage driver.
if ! sudo docker info >/dev/null 2>&1; then
  sudo dockerd --storage-driver=fuse-overlayfs >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 30); do sudo docker info >/dev/null 2>&1 && break; sleep 1; done
fi

# 2. Nested-Docker networking fix. Two iptables backends are active here; the
#    legacy backend defaults the FORWARD chain to DROP, which silently blocks
#    container-to-container traffic on Docker's user-defined bridges (the DB is
#    healthy but other containers cannot reach it). Allow forwarding.
sudo iptables-legacy -P FORWARD ACCEPT 2>/dev/null || true

# 3. Let the non-root user talk to the daemon.
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true

# 4. Local Supabase stack (idempotent - a no-op if already running).
supabase start

# 5. Wait for Postgres to accept connections.
for _ in $(seq 1 60); do
  docker exec supabase_db_workspace pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 2
done

# 6. Local env file.
[ -f .env.local ] || scripts/gen-env-local.sh

# 7. Bootstrap the schema once (detected via a core table).
if [ "$(docker exec supabase_db_workspace psql -U postgres -d postgres -tAc "select to_regclass('public.profiles')" 2>/dev/null)" != "profiles" ]; then
  bash scripts/db-bootstrap.sh
fi

echo "Cloud Agent services are up (Supabase API on http://127.0.0.1:54321)."
