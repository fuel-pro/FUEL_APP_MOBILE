#!/bin/bash
# Railway Environment Variable Update Script
# Run this on your local machine with Railway CLI installed
# 
# Railway Token: d1a34559-6a70-4c38-8312-00d8f982f04c
# Railway Project ID: 226c5567-8377-4520-8088-1e4c019b984a

# Step 1: Install Railway CLI (if not installed)
# curl -fsSL https://railway.app/install.sh | sh

# Step 2: Login with token
# railway login
# When prompted, enter the token: d1a34559-6a70-4c38-8312-00d8f982f04c

# Step 3: Link to project
# railway link 226c5567-8377-4520-8088-1e4c019b984a

# Step 4: Set founder credentials
railway variables set FOUNDER_USER=ADMIN
railway variables set FOUNDER_PASS=ADMIN

echo "✅ Founder credentials set successfully!"
echo ""
echo "After running this script:"
echo "1. Redeploy the Railway backend to pick up new env vars"
echo "2. Test founder login at https://fuel-app-mobile.vercel.app/#/founder"
