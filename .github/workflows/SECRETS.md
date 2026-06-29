# GitHub Actions Required Secrets

Set these in GitHub → Settings → Secrets and variables → Actions:

| Secret | Description | Sprint |
|--------|-------------|--------|
| `AZURE_CREDENTIALS` | JSON output of `az ad sp create-for-rbac --sdk-auth` | 11 |
| `JWT_SECRET` | ≥32-char random string | 12 |
| `AADHAAR_SALT` | ≥32-char random string | 12 |
| `AZURE_AI_ENDPOINT` | Azure AI Foundry endpoint URL | 12 |
| `AZURE_AI_KEY` | Azure AI Foundry API key | 12 |
| `AWS_ACCESS_KEY_ID` | IAM key with DynamoDB access | 12 |
| `AWS_SECRET_ACCESS_KEY` | IAM secret (40 chars) | 12 |

## Generate AZURE_CREDENTIALS

```bash
az ad sp create-for-rbac \
  --name bhumichain-github-deploy \
  --role contributor \
  --scopes /subscriptions/<SUB_ID>/resourceGroups/bhumichain-rg \
  --sdk-auth
```

Paste the entire JSON output as the `AZURE_CREDENTIALS` secret.
