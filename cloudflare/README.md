# Escrow API - Cloudflare Workers

This is the Cloudflare Workers implementation of the Escrow API, featuring:

- **Serverless Architecture** with Cloudflare Workers
- **Real-time Chat** using Durable Objects and WebSockets
- **File Storage** with Cloudflare R2
- **Database** with Cloudflare D1 (SQLite)
- **Product Marketplace** with revenue distribution

## Quick Start

### Prerequisites

1. **Cloudflare Account** with Workers and D1 enabled
2. **Node.js** 18+ and npm/pnpm
3. **Wrangler CLI** installed globally

```bash
npm install -g wrangler
```

### Setup

1. **Clone and install dependencies**:
```bash
cd cloudflare
npm install
```

2. **Configure Cloudflare**:
```bash
# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create escrow-db

# Create R2 bucket
wrangler r2 bucket create escrow-files
```

3. **Update wrangler.toml** with your database ID from the previous step.

4. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Run database migrations**:
```bash
npm run db:migrate
```

### Development

```bash
# Start development server
npm run dev

# The API will be available at http://localhost:8787
```

### Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/verify` - Verify JWT token
- `POST /api/auth/refresh` - Refresh JWT token

### Users
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user profile
- `POST /api/users/:id/balance` - Update user balance

### Chat
- `POST /api/chat/orders/:orderId` - Create chat for order
- `GET /api/chat/orders/:orderId` - Get chat by order ID
- `GET /api/chat/:chatId/websocket` - WebSocket connection
- `POST /api/chat/:chatId/messages` - Send message
- `GET /api/chat/:chatId/messages` - Get messages
- `POST /api/chat/:chatId/upload` - Upload file

### Orders (Coming Soon)
- Order management endpoints

### Marketplace (Coming Soon)
- Product publishing and sales endpoints

## Architecture

### Durable Objects

#### ChatDurableObject
Handles real-time chat functionality:
- WebSocket connections management
- Message broadcasting
- Typing indicators
- Online presence

#### EscrowManagerDurableObject (Planned)
Will handle:
- Order state management
- Transaction processing
- Event coordination

### Database Schema

The application uses Cloudflare D1 (SQLite) with the following main tables:

- **users** - User accounts and balances
- **orders** - Order information and status
- **chat_messages** - Chat messages and files
- **products** - Digital products and deliveries
- **marketplace_products** - Products for sale
- **sales_escrow_accounts** - Revenue distribution

### File Storage

Cloudflare R2 is used for:
- Chat file attachments
- Product deliveries
- User avatars (planned)

## Development Guidelines

### Adding New Features

1. **Database Changes**: Add migrations in `migrations/`
2. **Services**: Add business logic in `src/services/`
3. **Routes**: Add API endpoints in `src/routes/`
4. **Durable Objects**: Add stateful components in `src/durable-objects/`

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Database Management

```bash
# Generate new migration
npm run db:generate

# Apply migrations
npm run db:migrate

# Open database studio (local development)
npm run db:studio
```

## Environment Variables

### Required
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - API token with Workers and D1 permissions
- `JWT_SECRET` - Secret key for JWT tokens
- `API_KEY` - API key for external integrations

### Optional
- `ENVIRONMENT` - Environment name (development/staging/production)

## Monitoring and Debugging

### Logs
```bash
# View real-time logs
wrangler tail

# View logs for specific deployment
wrangler tail --env production
```

### Analytics
The application includes built-in analytics through Cloudflare Analytics Engine.

## Security Considerations

1. **JWT Tokens** - Short-lived access tokens with refresh mechanism
2. **API Keys** - For external system integrations
3. **File Uploads** - Size limits and type validation
4. **Rate Limiting** - Built into Cloudflare Workers
5. **CORS** - Configured for specific origins

## Performance

- **Cold Start** - Typically <10ms with Cloudflare Workers
- **Database** - D1 provides low-latency SQLite access
- **File Storage** - R2 offers global CDN distribution
- **WebSockets** - Durable Objects maintain persistent connections

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify `CLOUDFLARE_DATABASE_ID` in wrangler.toml
   - Check D1 database exists and is accessible

2. **WebSocket Connection Failures**
   - Ensure Durable Objects are properly configured
   - Check CORS settings for WebSocket origins

3. **File Upload Issues**
   - Verify R2 bucket exists and is accessible
   - Check file size limits (default 10MB)

### Getting Help

- Check Cloudflare Workers documentation
- Review application logs with `wrangler tail`
- Inspect D1 database with `wrangler d1 execute`

## Roadmap

- [ ] Complete OrderService implementation
- [ ] Implement MarketplaceService
- [ ] Add EscrowManagerDurableObject
- [ ] Implement revenue distribution system
- [ ] Add comprehensive testing
- [ ] Performance optimization
- [ ] Enhanced security features