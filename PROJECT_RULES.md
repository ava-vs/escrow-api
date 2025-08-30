# Escrow API Project Rules

## Project Overview
This is a comprehensive escrow system built with Cloudflare Workers, D1 Database, and Hono framework. The system handles multi-party payments, order management, and document workflow for secure transactions.

## Development Setup
Use PowerShell commands.

### Prerequisites
- Node.js 18+
- Cloudflare account with Workers and D1 access
- Wrangler CLI installed globally: `npm install -g wrangler`

### Initial Setup
1. Clone the repository
2. Navigate to `cloudflare` directory: `cd cloudflare`
3. Install dependencies: `npm install`
4. Login to Cloudflare: `wrangler auth login`

### Database Operations
**IMPORTANT**: Always use `--remote` flag for production database operations:

```bash
# Apply migrations to remote database
wrangler d1 migrations apply escrow-db --remote

# Execute SQL commands on remote database
wrangler d1 execute escrow-db --remote --command "SELECT * FROM users;"

# Check migration status
wrangler d1 migrations list escrow-db --remote
```

### Deployment
```bash
# Deploy to Cloudflare Workers
wrangler deploy
```

## API Usage Guidelines

### Authentication
All API requests (except registration/login) require authentication:
- **JWT Token**: `Authorization: Bearer <token>`
- **Admin Operations**: `X-API-Key: Escrow-secret-test`

### Base URL
```
https://escrow-api.aged-waterfall-b055.workers.dev/api
```

## User Management

### 1. Create Admin User (First Time Setup)
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "Admin User",
  "email": "admin@escrow.com", 
  "password": "AdminPassword123!",
  "type": "PLATFORM",
  "bio": "System Administrator"
}
```

### 2. Create Regular Users
```bash
POST /api/admin/users
X-API-Key: Escrow-secret-test
Content-Type: application/json

{
  "name": "User Name",
  "email": "user@example.com",
  "password": "Password123!",
  "type": "CUSTOMER|CONTRACTOR|PLATFORM"
}
```

### 3. Update User Balance
```bash
PUT /api/admin/users/{userId}/balance
X-API-Key: Escrow-secret-test
Content-Type: application/json

{
  "amount": 1000
}
```

### 4. User Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!"
}
```

## Order Management

### 1. Create Order
```bash
POST /api/orders
Authorization: Bearer <customer_token>
Content-Type: application/json

{
  "title": "Project Title",
  "description": "Project description",
  "isGroupOrder": true,
  "milestones": [
    {
      "description": "Milestone 1",
      "amount": 400.00,
      "deadline": "2025-12-31T00:00:00Z"
    },
    {
      "description": "Milestone 2", 
      "amount": 600.00,
      "deadline": "2026-01-31T00:00:00Z"
    }
  ]
}
```

### 2. Fund Order
```bash
POST /api/orders/{orderId}/fund
Authorization: Bearer <payer_token>
Content-Type: application/json

{
  "amount": 400
}
```

### 3. Assign Contractor
```bash
POST /api/orders/{orderId}/assign-contractor
Authorization: Bearer <customer_token>
Content-Type: application/json

{
  "contractorId": "contractor-uuid"
}
```

### 4. Get Order Details
```bash
GET /api/orders/{orderId}
Authorization: Bearer <token>
```

## Document Management

### 1. Create Document
```bash
POST /api/orders/{orderId}/documents
Authorization: Bearer <contractor_token>
Content-Type: application/json

{
  "type": "DELIVERY",
  "name": "Document Name",
  "content": {
    "description": "Document description",
    "deliverables": ["Item 1", "Item 2"]
  }
}
```

### 2. Create Act
```bash
POST /api/documents/{documentId}/acts
Authorization: Bearer <customer_token>
Content-Type: application/json

{
  "type": "APPROVAL",
  "description": "Act description",
  "signatories": ["user-id-1", "user-id-2"]
}
```

### 3. Sign Act
```bash
POST /api/documents/acts/{actId}/sign
Authorization: Bearer <signatory_token>
Content-Type: application/json

{
  "signature": {
    "signedAt": "2025-08-30T12:00:00Z",
    "signedBy": "User Name",
    "approved": true,
    "comments": "Approved"
  }
}
```

## Password Requirements
- Minimum 8 characters
- Must contain uppercase letter
- Must contain lowercase letter  
- Must contain number
- Must contain special character

## User Types
- **CUSTOMER**: Can create orders, fund orders, approve work
- **CONTRACTOR**: Can be assigned to orders, create delivery documents
- **PLATFORM**: Administrative access, can manage users and balances

## Testing
Use the provided comprehensive test script: `complete-escrow-workflow-test.ps1`

```powershell
# Run complete end-to-end test
.\complete-escrow-workflow-test.ps1
```

### Test Coverage
The test script validates:
- Order creation with milestones (2 milestones, 1000 total)
- Multi-party funding (400 + 600 from different payers)
- Contractor assignment
- Document creation and management
- Act creation and signing workflow
- Milestone completion
- Automatic payment distribution (80% contractor, 10% platform, 10% promotion)
- Balance management and tracking
- Status transitions (CREATED → FUNDED → IN_PROGRESS)

## Database Schema
- **users**: User accounts and balances
- **orders**: Order information and status
- **milestones**: Order milestones/phases
- **documents**: Delivery and approval documents
- **acts**: Legal acts and signatures
- **customer_orders**: Order participation tracking

## Security Notes
- All passwords are hashed using PBKDF2 with 100,000 iterations
- JWT tokens expire after 24 hours
- API key required for administrative operations
- Rate limiting implemented on authentication endpoints

## Environment Variables
- `JWT_SECRET`: Secret key for JWT token signing
- `API_KEY`: Administrative API key
- `ENVIRONMENT`: Deployment environment (production/development)

## Support
For issues or questions, check the API logs in Cloudflare Workers dashboard or review the test scripts for usage examples.