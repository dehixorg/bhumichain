#!/bin/bash
set -e

NETWORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHAINCODE_BASE=/opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode
CHANNEL=land-registry
ORDERER=orderer.bhumichain.in:7050
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/bhumichain.in/orderers/orderer.bhumichain.in/msp/tlscacerts/tlsca.bhumichain.in-cert.pem

# Detect if peer1 is running (supports both 1-peer and 2-peer setups)
PEER1_RUNNING=false
if docker ps --format '{{.Names}}' | grep -q 'peer1.revenuedept.bhumichain.in'; then
  PEER1_RUNNING=true
  echo "  [INFO] peer1 detected — will install on both peers"
else
  echo "  [INFO] peer1 not running — single-peer mode"
fi

echo "========================================"
echo " BhumiChain — Deploy All Chaincodes"
echo " Channel: $CHANNEL"
echo "========================================"

# Chaincodes deployed in dependency order
CHAINCODES=(
  "dlpi"
  "encumbrance"
  "coparcenary-pool"
  "mutation-manager"
  "property-transfer"
  "uttaradhikar"
  "tribal-guard"
  "bhumi-auction"
)

deploy_chaincode() {
  local NAME=$1
  local VERSION="1.0"
  local SEQUENCE=1
  local CC_SRC_PATH="$CHAINCODE_BASE/$NAME"

  echo ""
  echo "─────────────────────────────────────"
  echo " Deploying: $NAME v$VERSION"
  echo "─────────────────────────────────────"

  # Package
  echo "  [1/5] Packaging..."
  docker exec fabric-network-cli-1 peer lifecycle chaincode package "/tmp/${NAME}.tar.gz" \
    --path "$CC_SRC_PATH" \
    --lang golang \
    --label "${NAME}_${VERSION}"

  # Install on peer0
  echo "  [2/5] Installing on peer0..."
  docker exec fabric-network-cli-1 peer lifecycle chaincode install "/tmp/${NAME}.tar.gz"

  # Install on peer1 only if it is running
  if [ "$PEER1_RUNNING" = "true" ]; then
    echo "  [2/5] Installing on peer1..."
    docker exec fabric-network-cli-1 \
      -e CORE_PEER_ADDRESS=peer1.revenuedept.bhumichain.in:9051 \
      -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/revenuedept.bhumichain.in/peers/peer1.revenuedept.bhumichain.in/tls/ca.crt \
      cli peer lifecycle chaincode install "/tmp/${NAME}.tar.gz"
  fi

  # Get package ID
  echo "  [3/5] Getting package ID..."
  CC_PACKAGE_ID=$(docker exec fabric-network-cli-1 peer lifecycle chaincode queryinstalled \
    --output json | \
    python3 -c "import sys,json; ccs=json.load(sys.stdin)['installed_chaincodes']; \
    print([c['package_id'] for c in ccs if c['label']=='${NAME}_${VERSION}'][0])")
  echo "  Package ID: $CC_PACKAGE_ID"

  # Approve for org
  echo "  [4/5] Approving for RevenueDeptMSP..."
  docker exec fabric-network-cli-1 peer lifecycle chaincode approveformyorg \
    --channelID "$CHANNEL" \
    --name "$NAME" \
    --version "$VERSION" \
    --package-id "$CC_PACKAGE_ID" \
    --sequence "$SEQUENCE" \
    --tls --cafile "$ORDERER_CA" \
    -o "$ORDERER"

  # Commit — include peer1 in commit endorsers only if it is running
  echo "  [5/5] Committing to channel..."
  PEER_ARGS="--peerAddresses peer0.revenuedept.bhumichain.in:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/revenuedept.bhumichain.in/peers/peer0.revenuedept.bhumichain.in/tls/ca.crt"

  if [ "$PEER1_RUNNING" = "true" ]; then
    PEER_ARGS="$PEER_ARGS \
      --peerAddresses peer1.revenuedept.bhumichain.in:9051 \
      --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/revenuedept.bhumichain.in/peers/peer1.revenuedept.bhumichain.in/tls/ca.crt"
  fi

  docker exec fabric-network-cli-1 peer lifecycle chaincode commit \
    --channelID "$CHANNEL" \
    --name "$NAME" \
    --version "$VERSION" \
    --sequence "$SEQUENCE" \
    --tls --cafile "$ORDERER_CA" \
    -o "$ORDERER" \
    $PEER_ARGS

  echo "  ✓ $NAME deployed successfully"
}

# Deploy all chaincodes in order
for CC in "${CHAINCODES[@]}"; do
  deploy_chaincode "$CC"
done

echo ""
echo "========================================"
echo " All 8 chaincodes deployed successfully"
echo ""
echo " Deployed to channel: $CHANNEL"
echo " dlpi | encumbrance | coparcenary-pool"
echo " mutation-manager | property-transfer"
echo " uttaradhikar | tribal-guard | bhumi-auction"
echo ""
echo " Next step: set FABRIC_MODE=real in api-gateway .env"
echo "========================================"
