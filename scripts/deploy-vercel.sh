#!/bin/bash
# Deploy script for FuelPro to Vercel
# Usage: ./scripts/deploy-vercel.sh <VERCEL_TOKEN>

set -e

VERCEL_TOKEN="${1:-$VERCEL_TOKEN}"

if [ -z "$VERCEL_TOKEN" ]; then
    echo "❌ VERCEL_TOKEN is required"
    echo "Usage: ./scripts/deploy-vercel.sh <VERCEL_TOKEN>"
    echo "Or set VERCEL_TOKEN environment variable"
    exit 1
fi

echo "🚀 Starting Vercel deployment..."

# Build the app
cd app
npm ci
npm run build:static

# Deploy to Vercel
npx vercel@latest deploy \
    --token="$VERCEL_TOKEN" \
    --prod \
    --yes \
    --cwd=app

echo "✅ Deployment complete!"
