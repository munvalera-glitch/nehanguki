#!/bin/bash
set -e
tar \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='data' \
  --exclude='outputs' \
  --exclude='temp' \
  --exclude='server.log' \
  --exclude='vite_output.log' \
  -czf /tmp/hikoreaforms-release.tgz .

scp -i ssh-key-2026-05-14.key /tmp/hikoreaforms-release.tgz ubuntu@hikoreaforms.com:/tmp/hikoreaforms-release.tgz

ssh -i ssh-key-2026-05-14.key ubuntu@hikoreaforms.com bash << 'REMOTE'
set -euo pipefail
cd /var/www/hikoreaforms
tar -xzf /tmp/hikoreaforms-release.tgz -C /var/www/hikoreaforms
rm -f /tmp/hikoreaforms-release.tgz
npm ci
npm run build
pm2 restart hikoreaforms-api --update-env
REMOTE
