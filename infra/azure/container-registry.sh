#!/bin/bash
# BhumiChain — Azure Container Registry: build & push all Docker images
# Run this once (or after major changes) to populate ACR before Container Apps deploy.
# Usage: ./container-registry.sh [resource-group] [acr-name]
set -euo pipefail

RG="${1:-bhumichain-rg}"
ACR="${2:-bhumichainacr}"
LOCATION="centralindia"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "================================================"
echo " BhumiChain — Build & Push to Azure Container Registry"
echo " ACR     : $ACR.azurecr.io"
echo " Project : $PROJECT_ROOT"
echo "================================================"

# ── 1. Create ACR (skip if exists) ───────────────────────────────────────────
echo ""
echo "[1/3] Ensuring ACR $ACR exists..."
if az acr show --name "$ACR" --resource-group "$RG" &>/dev/null; then
  echo "  ACR already exists — skipping creation."
else
  az acr create \
    --resource-group "$RG" \
    --name "$ACR" \
    --location "$LOCATION" \
    --sku Basic \
    --admin-enabled true \
    --output table
  echo "  ACR created."
fi

# ── 2. Login to ACR ──────────────────────────────────────────────────────────
echo ""
echo "[2/3] Logging in to ACR..."
az acr login --name "$ACR"

ACR_SERVER="${ACR}.azurecr.io"

# ── 3. Build & push each service ─────────────────────────────────────────────
echo ""
echo "[3/3] Building and pushing images..."

# Map: image-tag → build-context relative to PROJECT_ROOT
declare -A IMAGES=(
  ["api-gateway"]="backend/api-gateway"
  ["frontend"]="frontend/web-portal"
  ["record-scan"]="backend/ai-services/record-scan"
  ["coparcenary-mapper"]="backend/ai-services/coparcenary-mapper"
  ["nyaya-ai"]="backend/ai-services/nyaya-ai"
  ["bhumi-settle"]="backend/ai-services/bhumi-settle"
  ["valuation-oracle"]="backend/ai-services/valuation-oracle"
)

for SERVICE in "${!IMAGES[@]}"; do
  CTX="${PROJECT_ROOT}/${IMAGES[$SERVICE]}"
  TAG="${ACR_SERVER}/${SERVICE}:latest"
  echo ""
  echo "  ▶ Building $SERVICE from $CTX"
  docker build -t "$TAG" "$CTX"
  echo "  ▶ Pushing $TAG"
  docker push "$TAG"
  echo "  ✓ $SERVICE pushed"
done

echo ""
echo "================================================"
echo " All images pushed to $ACR_SERVER ✓"
echo ""
echo " Images:"
for SERVICE in "${!IMAGES[@]}"; do
  echo "   ${ACR_SERVER}/${SERVICE}:latest"
done
echo ""
echo " Next step: run container-apps.sh to deploy"
echo "================================================"
