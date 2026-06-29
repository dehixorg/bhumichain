# BhumiChain — Cloud Deployment Guide

## Architecture
- Azure Central India (Pune): Fabric VM + Container Apps + Static Web App
- AWS Mumbai (ap-south-1): DynamoDB

---

## Step 1 — Azure VM (Hyperledger Fabric)

### Create VM
```bash
az group create --name bhumichain-rg --location centralindia

az vm create \
  --resource-group bhumichain-rg \
  --name bhumichain-fabric-vm \
  --image Ubuntu2204 \
  --size Standard_D4s_v3 \
  --admin-username azureuser \
  --generate-ssh-keys \
  --public-ip-sku Standard

# Open Fabric ports
az vm open-port --resource-group bhumichain-rg --name bhumichain-fabric-vm --port 7050 --priority 100
az vm open-port --resource-group bhumichain-rg --name bhumichain-fabric-vm --port 7051 --priority 101
az vm open-port --resource-group bhumichain-rg --name bhumichain-fabric-vm --port 9051 --priority 102
```

### Setup VM
```bash
ssh azureuser@<vm-public-ip>

# Install Docker
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker azureuser
newgrp docker

# Install Go 1.21
wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc && source ~/.bashrc

# Install Fabric binaries (peer, configtxgen, cryptogen)
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.0
echo 'export PATH=$PATH:~/fabric-samples/bin' >> ~/.bashrc && source ~/.bashrc

# Copy infra/fabric-network/ to VM
exit
scp -r infra/fabric-network/ azureuser@<vm-public-ip>:~/bhumichain-network/
```

### Start Network
```bash
ssh azureuser@<vm-public-ip>
cd ~/bhumichain-network
./scripts/start-network.sh
./scripts/deploy-chaincodes.sh
```

---

## Step 2 — Azure Container Apps (API Gateway + AI Services)

### Create Container Apps environment
```bash
az containerapp env create \
  --name bhumichain-apps \
  --resource-group bhumichain-rg \
  --location centralindia
```

### Build and push images to Azure Container Registry
```bash
# Create registry
az acr create --resource-group bhumichain-rg --name bhumichainregistry --sku Basic

# Build and push api-gateway
az acr build --registry bhumichainregistry --image api-gateway:latest ./backend/api-gateway

# Build and push AI services
az acr build --registry bhumichainregistry --image record-scan:latest ./backend/ai-services/record-scan
az acr build --registry bhumichainregistry --image coparcenary-mapper:latest ./backend/ai-services/coparcenary-mapper
az acr build --registry bhumichainregistry --image nyaya-ai:latest ./backend/ai-services/nyaya-ai
az acr build --registry bhumichainregistry --image bhumi-settle:latest ./backend/ai-services/bhumi-settle
```

### Deploy Container Apps
```bash
# api-gateway (replace env vars with your actual values)
az containerapp create \
  --name api-gateway \
  --resource-group bhumichain-rg \
  --environment bhumichain-apps \
  --image bhumichainregistry.azurecr.io/api-gateway:latest \
  --target-port 4000 \
  --ingress external \
  --min-replicas 1 \
  --env-vars \
    FABRIC_MODE=real \
    FABRIC_PEER_ENDPOINT=<fabric-vm-ip>:7051 \
    FABRIC_CHANNEL=land-registry \
    FABRIC_MSPID=RevenueDeptMSP \
    JWT_SECRET=<your-secret> \
    ANTHROPIC_API_KEY=<your-key> \
    TELEGRAM_BOT_TOKEN=<your-token> \
    AWS_ACCESS_KEY_ID=<your-key> \
    AWS_SECRET_ACCESS_KEY=<your-secret> \
    AWS_REGION=ap-south-1

# Repeat for each AI service (change image name and PORT)
az containerapp create \
  --name nyaya-ai \
  --resource-group bhumichain-rg \
  --environment bhumichain-apps \
  --image bhumichainregistry.azurecr.io/nyaya-ai:latest \
  --target-port 8012 \
  --ingress internal \
  --min-replicas 1 \
  --env-vars ANTHROPIC_API_KEY=<your-key> AWS_ACCESS_KEY_ID=<your-key> AWS_SECRET_ACCESS_KEY=<your-secret> AWS_REGION=ap-south-1
```

---

## Step 3 — Azure Static Web Apps (Frontend)

```bash
az staticwebapp create \
  --name bhumichain-frontend \
  --resource-group bhumichain-rg \
  --location centralindia \
  --source https://github.com/<your-org>/bhumichain \
  --branch main \
  --app-location /frontend/web-portal \
  --output-location .next \
  --login-with-github
```

Set environment variables in Azure portal → Static Web App → Configuration:
```
NEXT_PUBLIC_API_URL = https://<api-gateway-url>.azurecontainerapps.io
NEXT_PUBLIC_WS_URL  = wss://<api-gateway-url>.azurecontainerapps.io/ws
NEXT_PUBLIC_FABRIC_MODE = real
```

---

## Step 4 — AWS DynamoDB Tables

```bash
# Set credentials first
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=ap-south-1

# Create all 4 tables
node scripts/setup-dynamo.js
```

---

## Step 5 — Mailhog (Local Dev Email)

```bash
docker run -d -p 1025:1025 -p 8025:8025 --name mailhog mailhog/mailhog
# View emails at: http://localhost:8025
```

---

## URLs after deployment

| Service | URL |
|---|---|
| Frontend | https://bhumichain.azurestaticapps.net |
| API Gateway | https://api-gateway.<env>.azurecontainerapps.io |
| NyayaAI | https://nyaya-ai.<env>.azurecontainerapps.io (internal) |
| CouchDB peer0 | http://<fabric-vm-ip>:5984 (internal only) |
| Fabric peer0 | <fabric-vm-ip>:7051 (open to Container Apps) |
