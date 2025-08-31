#!/bin/bash

# Deploy Hotfix Script
# This script runs the security columns hotfix in production

echo "🚀 Deploying Security Columns Hotfix to Production"
echo "================================================="
echo ""

# Check if we're in Railway environment
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found. This script must be run in Railway environment."
    exit 1
fi

# Check if SYSTEM_ENCRYPTION_KEY is set (needed for other operations)
if [ -z "$SYSTEM_ENCRYPTION_KEY" ]; then
    echo "⚠️  Warning: SYSTEM_ENCRYPTION_KEY not found. Encryption features won't work."
fi

echo "✅ Environment variables found"
echo ""

# Run the hotfix
echo "🔧 Applying hotfix to add security columns to public.users table..."
node scripts/hotfix-security-columns.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Hotfix deployed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Verify security columns are present in public.users"
    echo "2. Test login tracking and security features"
    echo "3. Monitor application logs for any issues"
else
    echo ""
    echo "❌ Hotfix deployment failed. Check logs above for details."
    exit 1
fi