#!/bin/bash
NETWORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$NETWORK_DIR"

echo "Stopping BhumiChain Fabric network..."
docker compose down
echo "Done. Volumes preserved. Run start-network.sh to restart."
