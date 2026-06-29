#!/bin/bash
# BhumiChain — Deploy application stack to Azure VM after Fabric is running
# Usage: ./deploy-app.sh [vm-ip] [admin-user]
set -euo pipefail

VM_IP="${1:-$(cat "$(dirname "$0")/.azure-vm-ip" 2>/dev/null || echo '')}"
ADMIN="${2:-bhumichain}"

if [ -z "$VM_IP" ]; then
  echo "ERROR: VM IP not found. Pass as arg or run provision-vm.sh first."
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "================================================"
echo " BhumiChain — Deploy to Azure VM $VM_IP"
echo "================================================"

# ── Sync source code ─────────────────────────────────────────────────────────
echo ""
echo "[1/4] Syncing source to VM..."
rsync -az --exclude 'node_modules' --exclude '.next' --exclude '*.log' \
  "$PROJECT_ROOT/" "$ADMIN@$VM_IP:~/bhumichain/"
echo "  Sync complete."

# ── Install dependencies ──────────────────────────────────────────────────────
echo ""
echo "[2/4] Installing Node.js dependencies on VM..."
ssh "$ADMIN@$VM_IP" "
  cd ~/bhumichain/backend/api-gateway && npm ci --production
  cd ~/bhumichain/frontend/web-portal && npm ci
"

# ── Start API gateway ─────────────────────────────────────────────────────────
echo ""
echo "[3/4] Starting API gateway (port 4000)..."
ssh "$ADMIN@$VM_IP" "
  pkill -f 'node.*index.js' 2>/dev/null || true
  cd ~/bhumichain/backend/api-gateway
  FABRIC_MODE=real NODE_ENV=production nohup node src/index.js > /tmp/api-gateway.log 2>&1 &
  echo API gateway PID: \$!
"

# ── Build and start frontend ──────────────────────────────────────────────────
echo ""
echo "[4/4] Building Next.js frontend..."
ssh "$ADMIN@$VM_IP" "
  cd ~/bhumichain/frontend/web-portal
  NEXT_PUBLIC_API_URL=http://${VM_IP}:4000 npm run build
  pkill -f 'next start' 2>/dev/null || true
  nohup npm run start -- -p 3000 > /tmp/frontend.log 2>&1 &
  echo Frontend PID: \$!
"

echo ""
echo "================================================"
echo " Deployment complete ✓"
echo ""
echo " API Gateway  : http://${VM_IP}:4000/health"
echo " Frontend     : http://${VM_IP}:3000"
echo " Fabric peer0 : ${VM_IP}:7051"
echo ""
echo " Update api-gateway .env on VM:"
echo "  FABRIC_MODE=real"
echo "  FABRIC_PEER_ENDPOINT=${VM_IP}:7051"
echo "  FABRIC_CERT_PATH=~/bhumichain/infra/fabric-network/crypto-config/..."
echo "  FABRIC_KEY_PATH=~/bhumichain/infra/fabric-network/crypto-config/..."
echo "================================================"
