#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"

CHANNEL=land-registry
ORDERER_ADMIN_PORT=7053

# TLS paths inside the crypto-config tree
ORDERER_CA="$NETWORK_DIR/crypto-config/ordererOrganizations/bhumichain.in/orderers/orderer.bhumichain.in/msp/tlscacerts/tlsca.bhumichain.in-cert.pem"
ORDERER_TLS_CERT="$NETWORK_DIR/crypto-config/ordererOrganizations/bhumichain.in/orderers/orderer.bhumichain.in/tls/server.crt"
PEER0_TLS_CA="$NETWORK_DIR/crypto-config/peerOrganizations/revenuedept.bhumichain.in/peers/peer0.revenuedept.bhumichain.in/tls/ca.crt"
PEER1_TLS_CA="$NETWORK_DIR/crypto-config/peerOrganizations/revenuedept.bhumichain.in/peers/peer1.revenuedept.bhumichain.in/tls/ca.crt"
ADMIN_MSP="$NETWORK_DIR/crypto-config/peerOrganizations/revenuedept.bhumichain.in/users/Admin@revenuedept.bhumichain.in/msp"

# Detect 1-peer vs 2-peer mode from docker-compose.yml
if grep -q 'peer1.revenuedept.bhumichain.in' "$NETWORK_DIR/docker-compose.yml" 2>/dev/null; then
  TWO_PEER_MODE=true
  echo "  [INFO] 2-peer mode detected"
else
  TWO_PEER_MODE=false
  echo "  [INFO] 1-peer mode detected"
fi

echo "========================================"
echo " BhumiChain Fabric Network v2.5 — Start"
echo "========================================"

# ── Prereqs ──────────────────────────────────────────────────────────────────
for cmd in docker cryptogen configtxgen osnadmin; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "ERROR: '$cmd' not found."
    echo "  Install Fabric binaries: curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.12 1.5.9"
    exit 1
  }
done

cd "$NETWORK_DIR"

# ── Step 1: Crypto material ───────────────────────────────────────────────────
echo ""
echo "Step 1: Generating crypto material..."
if [ -d "crypto-config" ]; then
  echo "  crypto-config/ exists — skipping (delete to regenerate)"
else
  cryptogen generate --config=crypto-config.yaml --output=crypto-config
  echo "  Done."
fi

# ── Step 2: Channel genesis block (Fabric 2.5 channel-participation API) ──────
echo ""
echo "Step 2: Generating channel genesis block..."
mkdir -p channel-artifacts

if [ ! -f "channel-artifacts/${CHANNEL}.block" ]; then
  # Fabric 2.5: no system channel — create channel genesis directly
  configtxgen \
    -profile LandRegistryChannel \
    -outputBlock "channel-artifacts/${CHANNEL}.block" \
    -channelID "$CHANNEL"
  echo "  ${CHANNEL}.block created."
else
  echo "  ${CHANNEL}.block already exists — skipping"
fi

# ── Step 3: Start Docker containers ─────────────────────────────────────────
echo ""
echo "Step 3: Starting Docker containers..."
docker compose up -d
echo "  Waiting 8s for peers to be ready..."
sleep 8

# ── Step 4: Join orderer to channel (channel-participation API) ───────────────
echo ""
echo "Step 4: Joining orderer to channel via osnadmin..."
osnadmin channel join \
  --channelID "$CHANNEL" \
  --config-block "channel-artifacts/${CHANNEL}.block" \
  -o "localhost:${ORDERER_ADMIN_PORT}" \
  --ca-file "$ORDERER_CA" \
  --client-cert "$ORDERER_TLS_CERT" \
  --client-key "$NETWORK_DIR/crypto-config/ordererOrganizations/bhumichain.in/orderers/orderer.bhumichain.in/tls/server.key"
echo "  Orderer joined channel $CHANNEL."

# ── Step 5: Join peers to channel ────────────────────────────────────────────
echo ""
echo "Step 5: Joining peers to channel $CHANNEL..."

# peer0
CORE_PEER_TLS_ENABLED=true \
CORE_PEER_LOCALMSPID=RevenueDeptMSP \
CORE_PEER_ADDRESS=localhost:7051 \
CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP" \
CORE_PEER_TLS_ROOTCERT_FILE="$PEER0_TLS_CA" \
peer channel join -b "channel-artifacts/${CHANNEL}.block"
echo "  peer0 joined."

# peer1 — only if 2-peer mode
if [ "$TWO_PEER_MODE" = "true" ]; then
  CORE_PEER_TLS_ENABLED=true \
  CORE_PEER_LOCALMSPID=RevenueDeptMSP \
  CORE_PEER_ADDRESS=localhost:9051 \
  CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP" \
  CORE_PEER_TLS_ROOTCERT_FILE="$PEER1_TLS_CA" \
  peer channel join -b "channel-artifacts/${CHANNEL}.block"
  echo "  peer1 joined."
fi

# ── Step 6: Update anchor peers ──────────────────────────────────────────────
echo ""
echo "Step 6: Updating anchor peers..."

if [ ! -f "channel-artifacts/revenuedept-anchors.tx" ]; then
  configtxgen \
    -profile LandRegistryChannel \
    -outputAnchorPeersUpdate "channel-artifacts/revenuedept-anchors.tx" \
    -channelID "$CHANNEL" \
    -asOrg RevenueDeptMSP
fi

CORE_PEER_TLS_ENABLED=true \
CORE_PEER_LOCALMSPID=RevenueDeptMSP \
CORE_PEER_ADDRESS=localhost:7051 \
CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP" \
CORE_PEER_TLS_ROOTCERT_FILE="$PEER0_TLS_CA" \
peer channel update \
  -o localhost:7050 \
  -c "$CHANNEL" \
  -f "channel-artifacts/revenuedept-anchors.tx" \
  --tls --cafile "$ORDERER_CA"
echo "  Anchor peers updated."

echo ""
echo "========================================"
echo " Network is UP ✓"
echo " Channel   : $CHANNEL"
echo " peer0     : localhost:7051"
if [ "$TWO_PEER_MODE" = "true" ]; then
  echo " peer1     : localhost:9051"
  echo " CouchDB-1 : http://localhost:7984"
fi
echo " CouchDB-0 : http://localhost:5984"
echo " Orderer   : localhost:7050 (admin: 7053)"
echo ""
echo " Next: ./scripts/deploy-chaincodes.sh"
echo "========================================"
