# Deployment Guide - Escrow API on Cloudflare Workers

This guide walks you through deploying the Escrow API to Cloudflare Workers.

## Prerequisites

1. **Cloudflare Account** with Workers Paid plan (required for Durable Objects)
2. **Domain** (optional, for custom domain)
3. **Node.js** 18+ installed
4. **Wrangler CLI** installed globally

## Step 1: Initial Setup

### Install Wrangler CLI
```bash
npm install -g wrangler
```

### Login to Cloudflare
```bash
wrangler login
```

### Clone and Setup Project
```bash
cd cloudflare
npm install
```

## Step 2: Cloudflare Infrastructure Setup

### Automated Setup (Recommended)
```bash
chmod +x scripts/setup-cloudflare.sh
./scripts/setup-cloudflare.sh
```

### Manual Setup (Alternative)

#### Create D1 Database
```bash
wrangler d1 create escrow-db
```
Copy the `database_id` from the output and update `wrangler.toml`.

#### Create R2 Bucket
```bash
wrangler r2 bucket create escrow-files
```

#### Apply Database Migrations
```bash
wrangler d1 migrations apply escrow-db --local
wrangler d1 migrations apply escrow-db
```

## Step 3: Environment Configuration

### Set Secrets
```bash
# JWT Secret for token signing
wrangler secret put JWT_SECRET
# Enter a secure random string (32+ characters)

# API Key for external integrations
wrangler secret put API_KEY
# Enter your API key (from original .env)
```

### Update wrangler.toml
Ensure your `wrangler.toml` has the correct `database_id`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "escrow-db"
database_id = "your-actual-database-id"
```

## Step 4: Development Testing

### Local Development
```bash
npm run dev
```

Test the API at `http://localhost:8787`:
- Health check: `GET /`
- Create user: `POST /api/users`
- Login: `POST /api/auth/login`

### Test WebSocket Chat
```bash
# In another terminal, test WebSocket connection
wscat -c "ws://localhost:8787/api/chat/test-chat-id/websocket?userId=test-user"
```

## Step 5: Production Deployment

### Deploy to Cloudflare
```bash
npm run deploy
```

### Verify Deployment
Your API will be available at:
```
https://escrow-api.your-subdomain.workers.dev
```

Test the deployment:
```bash
curl https://escrow-api.your-subdomain.workers.dev
```

## Step 6: Custom Domain (Optional)

### Add Custom Domain
```bash
wrangler custom-domains add api.yourdomain.com
```

### Update CORS Settings
Update the CORS origins in `src/index.ts`:
```typescript
app.use('*', cors({
  origin: ['https://yourdomain.com', 'https://api.yourdomain.com'],
  // ... other settings
}));
```

## Step 7: Monitoring and Analytics

### View Logs
```bash
# Real-time logs
wrangler tail

# Production logs
wrangler tail --env production
```

### Analytics Dashboard
Visit the Cloudflare Dashboard to view:
- Request analytics
- Error rates
- Performance metrics
- Durable Objects usage

## Environment-Specific Deployments

### Staging Environment
```bash
# Deploy to staging
wrangler deploy --env staging

# Set staging-specific secrets
wrangler secret put JWT_SECRET --env staging
wrangler secret put API_KEY --env staging
```

### Production Environment
```bash
# Deploy to production
wrangler deploy --env production

# Set production secrets
wrangler secret put JWT_SECRET --env production
wrangler secret put API_KEY --env production
```

## Database Management

### View Database
```bash
# Local database
wrangler d1 execute escrow-db --local --command "SELECT * FROM users LIMIT 5"

# Production database
wrangler d1 execute escrow-db --command "SELECT * FROM users LIMIT 5"
```

### Backup Database
```bash
# Export production data
wrangler d1 export escrow-db --output backup.sql
```

### New Migrations
```bash
# Generate migration
npm run db:generate

# Apply to local
wrangler d1 migrations apply escrow-db --local

# Apply to production
wrangler d1 migrations apply escrow-db
```

## Security Checklist

- [ ] JWT_SECRET is secure and unique
- [ ] API_KEY is properly configured
- [ ] CORS origins are restricted to your domains
- [ ] Database access is properly secured
- [ ] File upload limits are configured
- [ ] Rate limiting is enabled (automatic with Workers)

## Performance Optimization

### Durable Objects
- Each chat gets its own Durable Object instance
- EscrowManager handles global state coordination
- Objects automatically scale and distribute globally

### Database Optimization
- Indexes are created for common queries
- Connection pooling is handled by D1
- Query optimization through Drizzle ORM

### File Storage
- R2 provides global CDN distribution
- Automatic compression and optimization
- Signed URLs for secure access

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check database exists
wrangler d1 list

# Verify migrations
wrangler d1 migrations list escrow-db
```

#### Durable Objects Not Working
- Ensure you're on Workers Paid plan
- Check Durable Objects are properly exported in `src/index.ts`
- Verify wrangler.toml configuration

#### WebSocket Connection Issues
- Check CORS configuration
- Verify Durable Object bindings
- Test with simple WebSocket client

#### File Upload Problems
- Verify R2 bucket exists and is accessible
- Check file size limits
- Ensure proper CORS for file uploads

### Debug Commands
```bash
# Check account info
wrangler whoami

# List all resources
wrangler d1 list
wrangler r2 bucket list
wrangler kv:namespace list

# View deployment status
wrangler deployments list
```

## Rollback Procedure

### Rollback Deployment
```bash
# List recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback [deployment-id]
```

### Database Rollback
```bash
# Restore from backup
wrangler d1 execute escrow-db --file backup.sql
```

## Monitoring and Alerts

### Set up Alerts
1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select your worker
4. Configure alerts for:
   - Error rate > 5%
   - Response time > 1000ms
   - Request volume spikes

### Health Checks
Set up external monitoring for:
- `GET /` - Basic health check
- `POST /api/auth/login` - Authentication flow
- WebSocket connections

## Cost Optimization

### Workers Pricing
- First 100,000 requests/day: Free
- Additional requests: $0.50 per million
- Durable Objects: $12.50 per million requests

### D1 Pricing
- First 5 million reads/day: Free
- First 100,000 writes/day: Free
- Storage: $0.75 per GB per month

### R2 Pricing
- First 10 GB storage: Free
- Additional storage: $0.015 per GB per month
- Egress: Free (Class A operations have costs)

## Next Steps

After successful deployment:

1. **Implement remaining features**:
   - Complete OrderService
   - Add MarketplaceService
   - Implement revenue distribution

2. **Add monitoring**:
   - Set up error tracking
   - Configure performance monitoring
   - Add business metrics

3. **Scale considerations**:
   - Monitor Durable Objects usage
   - Optimize database queries
   - Consider caching strategies

4. **Security enhancements**:
   - Add rate limiting per user
   - Implement request signing
   - Add audit logging

## Support

For issues with deployment:
1. Check Cloudflare Workers documentation
2. Review wrangler logs: `wrangler tail`
3. Check Cloudflare Dashboard for errors
4. Consult the troubleshooting section above