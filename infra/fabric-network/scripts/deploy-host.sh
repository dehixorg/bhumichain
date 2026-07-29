#!/bin/bash
set -eo pipefail
CHAINCODE_BASE=~/bhumichain/blockchain/chaincode
CRYPTO=~/bhumichain/infra/fabric-network/crypto-config
CHANNEL=land-registry
ORDERER=orderer.bhumichain.in:7050
ORDERER_CA=$CRYPTO/ordererOrganizations/bhumichain.in/orderers/orderer.bhumichain.in/msp/tlscacerts/tlsca.bhumichain.in-cert.pem
export FABRIC_CFG_PATH=~/fabric-samples/config
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=RevenueDeptMSP
export CORE_PEER_MSPCONFIGPATH=$CRYPTO/peerOrganizations/revenuedept.bhumichain.in/users/Admin@revenuedept.bhumichain.in/msp
PEER0_ADDR=peer0.revenuedept.bhumichain.in:7051
PEER0_TLS=$CRYPTO/peerOrganizations/revenuedept.bhumichain.in/peers/peer0.revenuedept.bhumichain.in/tls/ca.crt
PEER1_ADDR=peer1.revenuedept.bhumichain.in:9051
PEER1_TLS=$CRYPTO/peerOrganizations/revenuedept.bhumichain.in/peers/peer1.revenuedept.bhumichain.in/tls/ca.crt
CHAINCODES=("dlpi" "encumbrance" "coparcenary-pool" "mutation-manager" "property-transfer" "uttaradhikar" "tribal-guard" "bhumi-auction")

deploy_chaincode() {
  local NAME=$1; local VERSION="1.0"; local SEQUENCE=1
  echo "--- Deploying: $NAME ---"
  cd $CHAINCODE_BASE/$NAME
  if [ ! -d "vendor" ]; then
    GOPROXY=https://proxy.golang.org GONOSUMDB=* go mod tidy
    GOPROXY=https://proxy.golang.org GONOSUMDB=* go mod vendor
  fi
  peer lifecycle chaincode package /tmp/${NAME}.tar.gz --path $CHAINCODE_BASE/$NAME --lang golang --label ${NAME}_${VERSION}
  
  export CORE_PEER_ADDRESS=$PEER0_ADDR; export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_TLS
  peer lifecycle chaincode install /tmp/${NAME}.tar.gz || echo "  (already installed on peer0, continuing...)"
  
  export CORE_PEER_ADDRESS=$PEER1_ADDR; export CORE_PEER_TLS_ROOTCERT_FILE=$PEER1_TLS
  peer lifecycle chaincode install /tmp/${NAME}.tar.gz || echo "  (already installed on peer1, continuing...)"
  
  export CORE_PEER_ADDRESS=$PEER0_ADDR; export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_TLS
  CC_PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json | python3 -c "import sys,json; ccs=json.load(sys.stdin)['installed_chaincodes']; print([c['package_id'] for c in ccs if c['label']=='${NAME}_${VERSION}'][0])")
  echo "  Package ID: $CC_PACKAGE_ID"
  
  peer lifecycle chaincode approveformyorg --channelID $CHANNEL --name $NAME --version $VERSION --package-id $CC_PACKAGE_ID --sequence $SEQUENCE --tls --cafile $ORDERER_CA -o $ORDERER
  peer lifecycle chaincode commit --channelID $CHANNEL --name $NAME --version $VERSION --sequence $SEQUENCE --tls --cafile $ORDERER_CA -o $ORDERER --peerAddresses $PEER0_ADDR --tlsRootCertFiles $PEER0_TLS --peerAddresses $PEER1_ADDR --tlsRootCertFiles $PEER1_TLS
  echo "  ✓ $NAME DONE"
}

for CC in "${CHAINCODES[@]}"; do deploy_chaincode "$CC"; done
echo "ALL 8 CHAINCODES DEPLOYED!"
