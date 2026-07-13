#!/bin/bash
set -euo pipefail

NETWORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export FABRIC_CFG_PATH=$HOME/fabric-samples/config
export PATH=$HOME/fabric-samples/bin:$PATH

CHANNEL=land-registry
ORDERER=orderer.bhumichain.in:7050

ORDERER_CA="$NETWORK_DIR/crypto-config/ordererOrganizations/bhumichain.in/orderers/orderer.bhumichain.in/msp/tlscacerts/tlsca.bhumichain.in-cert.pem"
PEER0_TLS_CA="$NETWORK_DIR/crypto-config/peerOrganizations/revenuedept.bhumichain.in/peers/peer0.revenuedept.bhumichain.in/tls/ca.crt"
ADMIN_MSP="$NETWORK_DIR/crypto-config/peerOrganizations/revenuedept.bhumichain.in/users/Admin@revenuedept.bhumichain.in/msp"

export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=RevenueDeptMSP
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_MSPCONFIGPATH="$ADMIN_MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="$PEER0_TLS_CA"

NAME="uttaradhikar"
VERSION=${1:-"2.0"}
SEQUENCE=${2:-2}
CC_SRC_PATH="$NETWORK_DIR/../../blockchain/chaincode/$NAME"

echo "========================================"
echo " Upgrading Chaincode: $NAME to v$VERSION (Sequence $SEQUENCE) [NATIVE MODE]"
echo "========================================"

echo "  [1/4] Packaging..."
peer lifecycle chaincode package "/tmp/${NAME}.tar.gz" \
  --path "$CC_SRC_PATH" \
  --lang golang \
  --label "${NAME}_${VERSION}"

echo "  [2/4] Installing on peer0..."
peer lifecycle chaincode install "/tmp/${NAME}.tar.gz" || true

echo "  [3/4] Getting package ID..."
CC_PACKAGE_ID=$(peer lifecycle chaincode queryinstalled \
  --output json | \
  python3 -c "import sys,json; ccs=json.load(sys.stdin)['installed_chaincodes']; print([c['package_id'] for c in ccs if c['label']=='${NAME}_${VERSION}'][0])")
echo "  Package ID: $CC_PACKAGE_ID"

echo "  [4/4] Approving and Committing..."
peer lifecycle chaincode approveformyorg \
  --channelID "$CHANNEL" \
  --name "$NAME" \
  --version "$VERSION" \
  --package-id "$CC_PACKAGE_ID" \
  --sequence "$SEQUENCE" \
  --tls --cafile "$ORDERER_CA" \
  -o "localhost:7050"

peer lifecycle chaincode commit \
  --channelID "$CHANNEL" \
  --name "$NAME" \
  --version "$VERSION" \
  --sequence "$SEQUENCE" \
  --tls --cafile "$ORDERER_CA" \
  -o "localhost:7050" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$PEER0_TLS_CA"

echo "========================================"
echo " Upgrade Successful!"
echo "========================================"
