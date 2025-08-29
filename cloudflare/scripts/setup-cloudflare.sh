#!/bin/bash

# Escrow API Cloudflare Setup Script
# This script sets up the required Cloudflare infrastructure

set -e

echo "🚀 Setting up Escrow API on Cloudflare Workers..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI is not installed. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare first:"
    wrangler login
fi

echo "📊 Creating D1 database..."
DB_OUTPUT=$(wrangler d1 create escrow-db 2>&1)
DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)

if [ -z "$DB_ID" ]; then
    echo "❌ Failed to create D1 database. Output:"
    echo "$DB_OUTPUT"
    exit 1
fi

echo "✅ D1 database created with ID: $DB_ID"

echo "🗄️ Creating R2 bucket..."
if wrangler r2 bucket create escrow-files; then
    echo "✅ R2 bucket 'escrow-files' created successfully"
else
    echo "⚠️  R2 bucket might already exist or creation failed"
fi

echo "📝 Updating wrangler.toml with database ID..."
sed -i.bak "s/database_id = \"your-database-id\"/database_id = \"$DB_ID\"/" wrangler.toml
rm wrangler.toml.bak

echo "🔄 Running database migrations..."
wrangler d1 migrations apply escrow-db --local
wrangler d1 migrations apply escrow-db

echo "🔑 Setting up secrets..."
echo "Please set the following secrets:"
echo "1. JWT_SECRET - for JWT token signing"
echo "2. API_KEY - for external API access"
echo ""
echo "Run these commands:"
echo "wrangler secret put JWT_SECRET"
echo "wrangler secret put API_KEY"
echo ""

# Generate a sample JWT secret
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "your-jwt-secret-$(date +%s)")
API_KEY=$(openssl rand -hex 16 2>/dev/null || echo "your-api-key-$(date +%s)")

echo "Suggested values:"
echo "JWT_SECRET: $JWT_SECRET"
echo "API_KEY: $API_KEY"
echo ""

echo "📋 Setup Summary:"
echo "- D1 Database ID: $DB_ID"
echo "- R2 Bucket: escrow-files"
echo "- Migrations: Applied"
echo ""
echo "Next steps:"
echo "1. Set the secrets using wrangler secret put"
echo "2. Update your .env file with the configuration"
echo "3. Run 'npm run dev' to start development"
echo "4. Run 'npm run deploy' to deploy to production"
echo ""
echo "🎉 Cloudflare setup complete!"