#!/usr/bin/env bash
# One-time Google Cloud setup so GitHub Actions can deploy the website
# without any stored password or key file (Workload Identity Federation).
#
# Run in Google Cloud Shell (https://shell.cloud.google.com) as the project owner:
#   bash infra/setup-gcp.sh
set -euo pipefail

PROJECT_ID="copper-index-509815-k3"
REPO="AlexanderAwuku/FA-Vision-Enterprise-Furniture-Store"
SA_NAME="github-deployer"
POOL="github"
PROVIDER="github-oidc"

gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  firebase.googleapis.com firebasehosting.googleapis.com

gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA_NAME" --display-name="GitHub Actions deployer (FA Vision site)"

# Only what a website deploy needs.
for ROLE in roles/firebasehosting.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" --role="$ROLE" --condition=None >/dev/null
done

gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions"

# Trust only the main branch of this one repository.
gcloud iam workload-identity-pools providers describe "$PROVIDER" --location=global \
  --workload-identity-pool="$POOL" >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --location=global \
    --workload-identity-pool="$POOL" --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '${REPO}' && assertion.ref == 'refs/heads/main'"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}" >/dev/null

cat <<EOF

Done. In GitHub open Settings → Secrets and variables → Actions → Variables and add:

  GCP_WORKLOAD_IDENTITY_PROVIDER = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}
  GCP_SERVICE_ACCOUNT            = ${SA_EMAIL}

These are identifiers, not secrets. Every push to main that changes frontend/ then redeploys the site.
EOF
