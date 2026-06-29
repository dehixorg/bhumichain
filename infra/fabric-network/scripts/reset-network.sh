#!/bin/bash
NETWORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$NETWORK_DIR"

echo "WARNING: This will delete ALL chain data, crypto material, and volumes."
read -p "Are you sure? (yes/no): " confirm
[ "$confirm" != "yes" ] && echo "Aborted." && exit 0

echo "Stopping containers and removing volumes..."
docker compose down -v

echo "Removing generated artifacts..."
rm -rf crypto-config/ channel-artifacts/

echo "Removing chaincode docker images..."
docker images -q "dev-peer*" | xargs -r docker rmi -f

echo "Reset complete. Run start-network.sh to start fresh."
