#!/bin/bash
# BhumiChain — Azure VM Provisioning
# Provisions a Standard_D4s_v3 Ubuntu 22.04 VM for Hyperledger Fabric v2.5
# Usage: ./provision-vm.sh [resource-group] [location]
set -euo pipefail

RG="${1:-bhumichain-rg}"
LOCATION="${2:-centralindia}"          # Central India region — low latency for UP pilot
VM_NAME="bhumichain-fabric-vm"
VM_SIZE="Standard_D4s_v3"             # 4 vCPU, 16 GB RAM — sufficient for 2-peer Fabric + API gateway
OS_IMAGE="Canonical:0001-com-ubuntu-server-jammy:22_04-lts-gen2:latest"
ADMIN_USER="bhumichain"
NSG_NAME="${VM_NAME}-nsg"

echo "================================================"
echo " BhumiChain — Azure VM Provisioning"
echo " Resource Group : $RG"
echo " Location       : $LOCATION"
echo " VM Size        : $VM_SIZE"
echo "================================================"

# ── 1. Resource group ─────────────────────────────────────────────────────────
echo ""
echo "[1/6] Creating resource group $RG..."
az group create --name "$RG" --location "$LOCATION" --output table

# ── 2. NSG with required ports ────────────────────────────────────────────────
echo ""
echo "[2/6] Creating Network Security Group..."
az network nsg create --resource-group "$RG" --name "$NSG_NAME" --location "$LOCATION" --output none

# SSH
az network nsg rule create --resource-group "$RG" --nsg-name "$NSG_NAME" \
  --name Allow-SSH --priority 100 --protocol Tcp \
  --destination-port-ranges 22 --access Allow --output none

# Fabric orderer gRPC
az network nsg rule create --resource-group "$RG" --nsg-name "$NSG_NAME" \
  --name Allow-Orderer --priority 110 --protocol Tcp \
  --destination-port-ranges 7050 --access Allow --output none

# Fabric orderer admin (osnadmin)
az network nsg rule create --resource-group "$RG" --nsg-name "$NSG_NAME" \
  --name Allow-OrdererAdmin --priority 111 --protocol Tcp \
  --destination-port-ranges 7053 --access Allow --output none

# Fabric peer0 gRPC
az network nsg rule create --resource-group "$RG" --nsg-name "$NSG_NAME" \
  --name Allow-Peer0 --priority 120 --protocol Tcp \
  --destination-port-ranges 7051 --access Allow --output none

# Fabric peer1 gRPC
az network nsg rule create --resource-group "$RG" --nsg-name "$NSG_NAME" \
  --name Allow-Peer1 --priority 130 --protocol Tcp \
  --destination-port-ranges 9051 --access Allow --output none

# API gateway
az network nsg rule create --resource-group "$RG" --nsg-name "$NSG_NAME" \
  --name Allow-ApiGateway --priority 140 --protocol Tcp \
  --destination-port-ranges 4000 --access Allow --output none

# Frontend (Next.js)
az network nsg rule create --resource-group "$RG" --nsg-name "$NSG_NAME" \
  --name Allow-Frontend --priority 150 --protocol Tcp \
  --destination-port-ranges 3000 --access Allow --output none

# CouchDB (internal only — restrict to VNet in prod)
az network nsg rule create --resource-group "$RG" --nsg-name "$NSG_NAME" \
  --name Allow-CouchDB --priority 160 --protocol Tcp \
  --destination-port-ranges 5984 7984 --access Allow --output none

echo "  NSG created."

# ── 3. VM ─────────────────────────────────────────────────────────────────────
echo ""
echo "[3/6] Creating VM $VM_NAME ($VM_SIZE)..."
az vm create \
  --resource-group "$RG" \
  --name "$VM_NAME" \
  --image "$OS_IMAGE" \
  --size "$VM_SIZE" \
  --admin-username "$ADMIN_USER" \
  --generate-ssh-keys \
  --nsg "$NSG_NAME" \
  --public-ip-sku Standard \
  --os-disk-size-gb 128 \
  --storage-sku Premium_LRS \
  --output table

# ── 4. Get public IP ──────────────────────────────────────────────────────────
echo ""
echo "[4/6] Getting public IP..."
PUBLIC_IP=$(az vm show -d --resource-group "$RG" --name "$VM_NAME" --query publicIps -o tsv)
echo "  Public IP: $PUBLIC_IP"

# ── 5. Open ports ─────────────────────────────────────────────────────────────
echo ""
echo "[5/6] Opening VM ports..."
az vm open-port --resource-group "$RG" --name "$VM_NAME" \
  --port "22,4000,7050,7051,7053,7054,9051,3000" --priority 200 --output none

# ── 6. Upload setup script and execute ───────────────────────────────────────
echo ""
echo "[6/6] Running setup script on VM..."
az vm run-command invoke \
  --resource-group "$RG" \
  --name "$VM_NAME" \
  --command-id RunShellScript \
  --scripts "
    set -e
    apt-get update -qq
    apt-get install -y -qq docker.io docker-compose-plugin golang-go git curl jq python3-pip
    systemctl enable docker && systemctl start docker
    usermod -aG docker $ADMIN_USER

    # Install Fabric 2.5 binaries
    curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.12 1.5.9
    echo 'export PATH=\$PATH:\$HOME/fabric-samples/bin' >> /home/$ADMIN_USER/.bashrc

    echo 'VM setup complete. Fabric binaries installed.'
  " \
  --output table

echo ""
echo "================================================"
echo " Azure VM provisioned successfully ✓"
echo ""
echo " VM Name   : $VM_NAME"
echo " Public IP : $PUBLIC_IP"
echo " SSH       : ssh $ADMIN_USER@$PUBLIC_IP"
echo ""
echo " Next steps:"
echo "  1. scp -r ../fabric-network $ADMIN_USER@$PUBLIC_IP:~/bhumichain/infra/"
echo "  2. scp -r ../../../blockchain $ADMIN_USER@$PUBLIC_IP:~/bhumichain/"
echo "  3. ssh $ADMIN_USER@$PUBLIC_IP"
echo "  4. cd ~/bhumichain/infra/fabric-network && ./scripts/start-network.sh"
echo "  5. ./scripts/deploy-chaincodes.sh"
echo "  6. Update api-gateway .env: FABRIC_MODE=real"
echo "     FABRIC_PEER_ENDPOINT=${PUBLIC_IP}:7051"
echo "================================================"

# Save IP to file for subsequent scripts
echo "$PUBLIC_IP" > .azure-vm-ip
echo "  IP saved to infra/azure/.azure-vm-ip"
