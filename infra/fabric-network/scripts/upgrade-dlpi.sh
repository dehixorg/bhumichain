#!/bin/bash
set -e

NETWORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHAINCODE_BASE=/opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode
CHANNEL=land-registry
ORDERER=orderer.bhumichain.in:7050
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/bhumichain.in/orderers/orderer.bhumichain.in/msp/tlscacerts/tlsca.bhumichain.in-cert.pem

# Detect if peer1 is running
PEER1_RUNNING=false
if docker ps --format '{{.Names}}' | grep -q 'peer1.revenuedept.bhumichain.in'; then
  PEER1_RUNNING=true
fi

NAME="dlpi"
VERSION="2.0"
SEQUENCE=2
CC_SRC_PATH="$CHAINCODE_BASE/$NAME"

echo "========================================"
echo " Upgrading Chaincode: $NAME to v$VERSION (Sequence $SEQUENCE)"
echo "========================================"

echo "  [1/5] Packaging..."
docker exec fabric-network-cli-1 peer lifecycle chaincode package "/tmp/${NAME}.tar.gz" \
  --path "$CC_SRC_PATH" \
  --lang golang \
  --label "${NAME}_${VERSION}"

echo "  [2/5] Installing on peer0..."
docker exec fabric-network-cli-1 peer lifecycle chaincode install "/tmp/${NAME}.tar.gz" || true

if [ "$PEER1_RUNNING" = "true" ]; then
  echo "  [2/5] Installing on peer1..."
  docker exec \
    -e CORE_PEER_ADDRESS=peer1.revenuedept.bhumichain.in:9051 \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/revenuedept.bhumichain.in/peers/peer1.revenuedept.bhumichain.in/tls/ca.crt \
    fabric-network-cli-1 peer lifecycle chaincode install "/tmp/${NAME}.tar.gz" || true
fi

echo "  [3/5] Getting package ID..."
CC_PACKAGE_ID=$(docker exec fabric-network-cli-1 peer lifecycle chaincode queryinstalled \
  --output json | \
  python3 -c "import sys,json; ccs=json.load(sys.stdin)['installed_chaincodes']; print([c['package_id'] for c in ccs if c['label']=='${NAME}_${VERSION}'][0])")
echo "  Package ID: $CC_PACKAGE_ID"

echo "  [4/5] Approving for RevenueDeptMSP..."
docker exec fabric-network-cli-1 peer lifecycle chaincode approveformyorg \
  --channelID "$CHANNEL" \
  --name "$NAME" \
  --version "$VERSION" \
  --package-id "$CC_PACKAGE_ID" \
  --sequence "$SEQUENCE" \
  --tls --cafile "$ORDERER_CA" \
  -o "$ORDERER"

echo "  [5/5] Committing to channel..."
PEER_ARGS="--peerAddresses peer0.revenuedept.bhumichain.in:7051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/revenuedept.bhumichain.in/peers/peer0.revenuedept.bhumichain.in/tls/ca.crt"
if [ "$PEER1_RUNNING" = "true" ]; then
  PEER_ARGS="$PEER_ARGS --peerAddresses peer1.revenuedept.bhumichain.in:9051 --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/revenuedept.bhumichain.in/peers/peer1.revenuedept.bhumichain.in/tls/ca.crt"
fi

docker exec fabric-network-cli-1 peer lifecycle chaincode commit \
  --channelID "$CHANNEL" \
  --name "$NAME" \
  --version "$VERSION" \
  --sequence "$SEQUENCE" \
  --tls --cafile "$ORDERER_CA" \
  -o "$ORDERER" \
  $PEER_ARGS

echo "========================================"
echo " Upgrade Successful!"
echo "========================================"
