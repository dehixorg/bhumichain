#!/bin/bash
# BhumiChain — AWS DynamoDB table provisioning
# Creates all DynamoDB tables with PAY_PER_REQUEST billing (no capacity planning needed).
# Safe to run multiple times — skips tables that already exist.
# Usage: ./setup-dynamodb.sh
# Prerequisites: AWS CLI configured (aws configure) or AWS_* env vars set.
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"

echo "================================================"
echo " BhumiChain — DynamoDB Table Provisioning"
echo " Region : $REGION"
echo "================================================"

create_table_if_missing() {
  local TABLE="$1"
  local PK="$2"
  local PK_TYPE="$3"
  local SK="$4"
  local SK_TYPE="$5"
  local TTL_ATTR="${6:-}"   # optional TTL attribute name

  if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" &>/dev/null; then
    echo "  ✓ $TABLE — exists, skipping"
    return
  fi

  echo "  ▶ Creating $TABLE..."
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions \
      AttributeName="${PK}",AttributeType="${PK_TYPE}" \
      AttributeName="${SK}",AttributeType="${SK_TYPE}" \
    --key-schema \
      AttributeName="${PK}",KeyType=HASH \
      AttributeName="${SK}",KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" \
    --output none

  # Enable TTL if attribute specified
  if [ -n "$TTL_ATTR" ]; then
    aws dynamodb update-time-to-live \
      --table-name "$TABLE" \
      --time-to-live-specification "Enabled=true,AttributeName=${TTL_ATTR}" \
      --region "$REGION" \
      --output none
    echo "    TTL enabled on ${TTL_ATTR}"
  fi

  # Enable point-in-time recovery
  aws dynamodb update-continuous-backups \
    --table-name "$TABLE" \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
    --region "$REGION" \
    --output none

  echo "  ✓ $TABLE created (PITR enabled)"
}

echo ""
echo "[1/5] Notifications table..."
# Stores heir consent/objection/mutation notifications per parcel
create_table_if_missing \
  "bhumichain-notifications" \
  "dlpiId" "S" \
  "notificationId" "S" \
  "ttlEpoch"

echo ""
echo "[2/5] OTP tokens table..."
# Ephemeral Aadhaar OTP tokens (TTL = 10 min)
create_table_if_missing \
  "bhumichain-tokens" \
  "aadhaarHash" "S" \
  "tokenId" "S" \
  "expiresAt"

echo ""
echo "[3/5] EC cache table..."
# Encumbrance Certificate responses cached per DLPI (TTL = 24 hr)
create_table_if_missing \
  "bhumichain-ec-cache" \
  "dlpiId" "S" \
  "ecId" "S" \
  "cacheExpiresAt"

echo ""
echo "[4/5] Analytics events table..."
# Mutation/audit events for dashboards and DILRMP reporting
create_table_if_missing \
  "bhumichain-analytics" \
  "eventDate" "S" \
  "eventId" "S"

echo ""
echo "[5/5] Legacy dev table (testArpit)..."
# Original dev table from Sprint 1 — kept for backward compat
create_table_if_missing \
  "testArpit" \
  "pk" "S" \
  "sk" "S"

echo ""
echo "================================================"
echo " All DynamoDB tables ready ✓"
echo ""
echo " Tables in $REGION:"
aws dynamodb list-tables --region "$REGION" --output json \
  | python3 -c "import sys,json; [print('  •', t) for t in json.load(sys.stdin)['TableNames'] if t.startswith('bhumichain') or t=='testArpit']"
echo "================================================"
