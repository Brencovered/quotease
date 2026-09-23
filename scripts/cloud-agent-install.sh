#!/usr/bin/env bash
# Idempotent dependency setup for the Cloud Agent environment.
# Safe to run repeatedly; installs only what is missing, then refreshes
# node dependencies. Long-running services live in cloud-agent-start.sh.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# System packages needed to run the local Supabase stack (Docker + the
# Supabase CLI). Normally baked into the environment snapshot; reinstalled
# only when starting from a base image that lacks them.
if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -y
  echo 'keep' | sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" \
    docker.io fuse-overlayfs uidmap iptables
fi

if ! command -v supabase >/dev/null 2>&1; then
  latest=$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest | grep -oP '"tag_name": "\K[^"]+')
  curl -fsSL "https://github.com/supabase/cli/releases/download/${latest}/supabase_${latest#v}_linux_amd64.deb" -o /tmp/supabase.deb
  sudo dpkg -i /tmp/supabase.deb
fi

npm install
