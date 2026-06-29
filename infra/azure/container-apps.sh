#!/bin/bash
# BhumiChain — Azure Container Apps deployment
# Deploys all BhumiChain services as Azure Container Apps.
# Prerequisites: container-registry.sh must have run first (images in ACR).
# Usage: ./container-apps.sh [resource-group] [acr-name]
set -euo pipefail

RG="${1:-bhumichain-rg}"
ACR="${2:-bhumichainacr}"
ACR_SERVER="${ACR}.azurecr.io"
LOCATION="centralindia"
ENV_NAME="bhumichain-env"
LOG_WORKSPACE="bhumichain-logs"

# ── Resolve ACR credentials ───────────────────────────────────────────────────
ACR_USERNAME=$(az acr credential show --name "$ACR" --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name "$ACR" --query "passwords[0].value" -o tsv)

echo "================================================"
echo " BhumiChain — Azure Container Apps Deployment"
echo " Resource Group : $RG"
echo " ACR            : $ACR_SERVER"
echo " Environment    : $ENV_NAME"
echo "================================================"

# ── 1. Log Analytics workspace ────────────────────────────────────────────────
echo ""
echo "[1/5] Ensuring Log Analytics workspace..."
if az monitor log-analytics workspace show --resource-group "$RG" --workspace-name "$LOG_WORKSPACE" &>/dev/null; then
  echo "  Workspace already exists."
else
  az monitor log-analytics workspace create \
    --resource-group "$RG" \
    --workspace-name "$LOG_WORKSPACE" \
    --location "$LOCATION" \
    --output none
  echo "  Workspace created."
fi

LA_ID=$(az monitor log-analytics workspace show \
  --resource-group "$RG" --workspace-name "$LOG_WORKSPACE" \
  --query customerId -o tsv)
LA_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group "$RG" --workspace-name "$LOG_WORKSPACE" \
  --query primarySharedKey -o tsv)

# ── 2. Container Apps environment ─────────────────────────────────────────────
echo ""
echo "[2/5] Ensuring Container Apps environment..."
if az containerapp env show --name "$ENV_NAME" --resource-group "$RG" &>/dev/null; then
  echo "  Environment already exists."
else
  az containerapp env create \
    --name "$ENV_NAME" \
    --resource-group "$RG" \
    --location "$LOCATION" \
    --logs-workspace-id "$LA_ID" \
    --logs-workspace-key "$LA_KEY" \
    --output table
  echo "  Environment created."
fi

ENV_FQDN=$(az containerapp env show \
  --name "$ENV_NAME" --resource-group "$RG" \
  --query properties.defaultDomain -o tsv)

# ── Internal service FQDNs (resolved after first deploy) ─────────────────────
RECORD_SCAN_URL="http://record-scan.internal.${ENV_FQDN}"
COPARCENARY_URL="http://coparcenary-mapper.internal.${ENV_FQDN}"
NYAYA_URL="http://nyaya-ai.internal.${ENV_FQDN}"
SETTLE_URL="http://bhumi-settle.internal.${ENV_FQDN}"
ORACLE_URL="http://valuation-oracle.internal.${ENV_FQDN}"

# ── Helper: deploy or update a Container App ─────────────────────────────────
deploy_app() {
  local NAME="$1"
  local IMAGE="$2"
  local PORT="$3"
  local INGRESS="$4"     # "external" | "internal" | "none"
  shift 4
  local ENV_VARS=("$@")  # remaining args are KEY=VALUE pairs

  echo ""
  echo "  ▶ Deploying $NAME (port $PORT, ingress=$INGRESS)..."

  # Build --env-vars string
  local ENV_ARGS=()
  for kv in "${ENV_VARS[@]}"; do
    ENV_ARGS+=("$kv")
  done

  if az containerapp show --name "$NAME" --resource-group "$RG" &>/dev/null; then
    az containerapp update \
      --name "$NAME" \
      --resource-group "$RG" \
      --image "$IMAGE" \
      --set-env-vars "${ENV_ARGS[@]}" \
      --output none
  else
    local INGRESS_ARGS=()
    if [ "$INGRESS" != "none" ]; then
      INGRESS_ARGS=(--ingress "$INGRESS" --target-port "$PORT")
    fi

    az containerapp create \
      --name "$NAME" \
      --resource-group "$RG" \
      --environment "$ENV_NAME" \
      --image "$IMAGE" \
      --registry-server "$ACR_SERVER" \
      --registry-username "$ACR_USERNAME" \
      --registry-password "$ACR_PASSWORD" \
      --cpu 0.5 --memory 1.0Gi \
      --min-replicas 1 --max-replicas 3 \
      "${INGRESS_ARGS[@]}" \
      --env-vars "${ENV_ARGS[@]}" \
      --output none
  fi
  echo "  ✓ $NAME deployed"
}

# ── 3. Internal AI services ───────────────────────────────────────────────────
echo ""
echo "[3/5] Deploying internal AI services..."

deploy_app "record-scan" "${ACR_SERVER}/record-scan:latest" 8010 internal \
  "FABRIC_MODE=mock"

deploy_app "coparcenary-mapper" "${ACR_SERVER}/coparcenary-mapper:latest" 8011 internal \
  "FABRIC_MODE=mock"

deploy_app "nyaya-ai" "${ACR_SERVER}/nyaya-ai:latest" 8012 internal \
  "FABRIC_MODE=mock"

deploy_app "bhumi-settle" "${ACR_SERVER}/bhumi-settle:latest" 8013 internal \
  "FABRIC_MODE=mock"

deploy_app "valuation-oracle" "${ACR_SERVER}/valuation-oracle:latest" 8001 internal \
  "ORACLE_MODE=mock"

# ── 4. API gateway ────────────────────────────────────────────────────────────
echo ""
echo "[4/5] Deploying API gateway..."

# Sprint 12: replace placeholder secrets below with real values
deploy_app "api-gateway" "${ACR_SERVER}/api-gateway:latest" 4000 external \
  "NODE_ENV=production" \
  "PORT=4000" \
  "FABRIC_MODE=mock" \
  "FABRIC_CHANNEL=land-registry" \
  "FABRIC_MSP_ID=RevenueDeptMSP" \
  "AADHAAR_MOCK=true" \
  "ORACLE_MODE=mock" \
  "ORACLE_SERVICE_URL=${ORACLE_URL}" \
  "RECORD_SCAN_URL=${RECORD_SCAN_URL}" \
  "COPARCENARY_URL=${COPARCENARY_URL}" \
  "NYAYA_URL=${NYAYA_URL}" \
  "SETTLE_URL=${SETTLE_URL}" \
  "RATE_LIMIT_WINDOW_MS=60000" \
  "RATE_LIMIT_MAX=200" \
  "JWT_SECRET=REPLACE_IN_SPRINT_12" \
  "JWT_EXPIRY=8h" \
  "AADHAAR_SALT=REPLACE_IN_SPRINT_12" \
  "AZURE_AI_ENDPOINT=REPLACE_IN_SPRINT_12" \
  "AZURE_AI_KEY=REPLACE_IN_SPRINT_12" \
  "AZURE_AI_MODEL=gpt-5.4" \
  "AWS_ACCESS_KEY_ID=REPLACE_IN_SPRINT_12" \
  "AWS_SECRET_ACCESS_KEY=REPLACE_IN_SPRINT_12" \
  "AWS_REGION=ap-south-1" \
  "DYNAMODB_TABLE=testArpit"

API_FQDN=$(az containerapp show --name "api-gateway" --resource-group "$RG" \
  --query properties.configuration.ingress.fqdn -o tsv)

# ── 5. Frontend ───────────────────────────────────────────────────────────────
echo ""
echo "[5/5] Deploying frontend..."

deploy_app "frontend" "${ACR_SERVER}/frontend:latest" 3000 external \
  "NODE_ENV=production" \
  "NEXT_PUBLIC_API_URL=https://${API_FQDN}" \
  "NEXT_PUBLIC_WS_URL=wss://${API_FQDN}/ws" \
  "NEXT_PUBLIC_FABRIC_MODE=mock" \
  "NEXT_PUBLIC_MAP_CENTER_LAT=28.5706" \
  "NEXT_PUBLIC_MAP_CENTER_LNG=77.5413" \
  "NEXT_PUBLIC_MAP_ZOOM=12"

FRONTEND_FQDN=$(az containerapp show --name "frontend" --resource-group "$RG" \
  --query properties.configuration.ingress.fqdn -o tsv)

# ── Update api-gateway CORS with frontend URL ─────────────────────────────────
az containerapp update \
  --name "api-gateway" \
  --resource-group "$RG" \
  --set-env-vars "CORS_ORIGIN=https://${FRONTEND_FQDN}" \
  "FRONTEND_URL=https://${FRONTEND_FQDN}" \
  --output none

echo ""
echo "================================================"
echo " BhumiChain — Container Apps deployed ✓"
echo ""
echo " Frontend     : https://${FRONTEND_FQDN}"
echo " API Gateway  : https://${API_FQDN}"
echo " Health check : https://${API_FQDN}/health"
echo ""
echo " Internal services (no public ingress):"
echo "   record-scan, coparcenary-mapper, nyaya-ai,"
echo "   bhumi-settle, valuation-oracle"
echo ""
echo " ⚠  Sprint 12: replace REPLACE_IN_SPRINT_12 secrets"
echo "    az containerapp secret set ..."
echo "================================================"
