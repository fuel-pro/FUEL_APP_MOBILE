# FuelPro - Agent Knowledge Base

> Comprehensive documentation for AI agents working on the FuelPro codebase.

## 📁 Repository Structure

```
FUEL_APP_MOBILE/
├── app/                    # Main application (Vite + React + TypeScript)
│   ├── api/               # tRPC routers (14 routers)
│   │   ├── router.ts      # Main tRPC router aggregation
│   │   ├── context.ts     # tRPC context with auth
│   │   ├── middleware.ts  # Auth middleware (requireAuth, adminQuery)
│   │   ├── boot.ts        # Hono server entry point
│   │   ├── founder-router.ts      # Feature flags, pricing, subscriptions
│   │   ├── auth-router.ts         # User authentication
│   │   ├── station-router.ts      # Station management
│   │   ├── sale-router.ts         # Sales operations
│   │   ├── inventory-router.ts   # Inventory tracking
│   │   ├── payment-router.ts     # Payment processing
│   │   ├── audit-router.ts       # Audit logging
│   │   ├── founder-auth-router.ts # Founder authentication
│   │   ├── access-control-router.ts
│   │   ├── routes/rest-api.ts    # REST API fallback
│   │   └── queries/              # Database queries
│   ├── db/
│   │   ├── schema.ts     # Drizzle ORM schema (MySQL)
│   │   └── migrations/   # Database migrations
│   └── src/react-app/    # React frontend
│       ├── components/   # UI components
│       ├── pages/        # Page components
│       ├── hooks/        # Custom React hooks
│       ├── lib/          # Utilities, services, POS modules
│       └── utils/        # Helper functions
├── backend/              # Legacy Express backend (SQLite)
│   ├── server.js        # Express + Socket.io server
│   ├── routes/          # REST API routes
│   └── database/         # SQLite database
├── .github/workflows/   # CI/CD pipelines
├── docs/                # Documentation
├── docker-compose.yml   # Docker setup
├── vercel.json         # Vercel routing config
└── railway.toml        # Railway deployment config
```

## 🔐 Authentication Architecture

### Three-Layer Auth System

1. **Clerk (Primary)**: OAuth-based authentication
   - Frontend: `@clerk/clerk-react` hooks
   - Backend: `CLERK_SECRET_KEY` verification
   - Env: `VITE_CLERK_PUBLISHABLE_KEY`

2. **JWT (OAuth)**: Token-based API auth
   - `authenticateRequest()` in `api/kimi/auth.ts`
   - Bearer token in `Authorization` header

3. **Founder Tokens**: Admin access
   - `x-founder-token` header for founder dashboard
   - Session stored in `founder_sessions` table
   - 8-hour session validity

### Key Auth Files

- `app/api/context.ts` - Auth context creation
- `app/api/middleware.ts` - `requireAuth`, `adminQuery` middleware
- `app/src/react-app/hooks/useClerkAuth.ts` - Clerk integration hook
- `app/src/react-app/lib/founder-auth.ts` - Founder authentication

## 🗄️ Database

### Schema (Drizzle ORM + MySQL)

**Primary Tables:**
- `users` - User accounts
- `stations` - Fuel station records
- `station_users` - Station access bindings
- `inventory` - Fuel inventory tracking
- `sales` - Sales transactions
- `audit_logs` - Audit trail
- `founder_sessions` - Founder login sessions
- `feature_flags` - Feature toggles
- `pricing_plans` - Subscription plans
- `subscriptions` - User subscriptions
- `coupons` - Discount codes
- `api_keys` - API authentication
- `webhooks` - Webhook configurations

### Migrations

```bash
npm run db:generate   # Generate migration
npm run db:migrate     # Apply migrations
```

## 🌐 Deployment Architecture

### Frontend (Vercel)
- URL: `https://fuel-app-mobile.vercel.app`
- Build: `npm run build`
- Output: `app/dist`

### Backend Options

#### Option 1: Railway (Current)
- URL: `https://fuel-pro-backend-v2-production-7c2b.up.railway.app`
- Type: Express + SQLite (legacy)
- Routes: `/api/*`

#### Option 2: Railway (New - Recommended)
- Deploy `app/` with `npm run build:api`
- Use `Dockerfile.api` or `railway.toml`
- URL: `https://fuel-pro-tprc-api.up.railway.app`
- Type: Hono + tRPC + MySQL

### Vercel Routing (`vercel.json`)

```json
{
  "routes": [
    { "src": "/api/trpc/(.*)", "dest": "/api/trpc/$1" },
    { "src": "/api/(.*)", "dest": "https://railway-url/api/$1" }
  ]
}
```

## 🔧 Environment Variables

### Frontend (.env)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_URL=https://api.fuelpro.app
VITE_FIREBASE_API_KEY=...
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_KEY=...
```

### Backend
```
DATABASE_URL=mysql://...       # MySQL connection
JWT_SECRET=...                 # JWT signing secret
CLERK_SECRET_KEY=sk_...       # Clerk backend
APP_ID=...
APP_SECRET=...
KIMI_AUTH_URL=...
KIMI_OPEN_URL=...
```

### M-PESA (Optional)
```
MPESA_CONSUMER_KEY=...
MPESA_CONSUMER_SECRET=...
MPESA_SHORTCODE=...
MPESA_PASSKEY=...
MPESA_CALLBACK_URL=...
```

## 📡 API Reference

### tRPC Endpoints

| Router | Procedures | Auth |
|--------|-----------|------|
| `ping` | 1 (public) | None |
| `auth` | CRUD | User |
| `station` | CRUD | User |
| `sale` | CRUD + analytics | User |
| `inventory` | CRUD | User |
| `payment` | process, verify | User |
| `audit` | log, list, summary | User |
| `founderAuth` | login, logout | Public |
| `accessControl` | CRUD | Admin |
| `featureFlag` | CRUD | Admin |
| `pricing` | CRUD | User/Admin |
| `coupon` | CRUD | Admin |
| `userMgmt` | CRUD | Admin |

### REST Endpoints (Legacy)

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/dashboard/stats`
- `POST /api/mpesa/stkpush`
- `POST /api/mpesa/stkstatus`

## 💳 Payment Integration

### M-PESA (Safaricom Daraja API)

**Flow:**
1. Client calls `POST /api/mpesa/stkpush` with phone + amount
2. Backend creates token + Lipa Na M-PESA request
3. Client receives checkout request ID
4. Client polls `GET /api/mpesa/stkstatus` for confirmation
5. Backend receives callback from Safaricom

**Security:**
- API credentials stored server-side only
- Callback URL must be HTTPS
- Transaction verified against pending records

## 🖨️ POS Hardware Support

Located in `app/src/react-app/lib/pos/`:

- `hardware-manager.ts` - USB/Bluetooth device detection
- `payment-service.ts` - Payment terminal integration
- `printer-service.ts` - Receipt printer support

Type declarations added for WebUSB API.

## 🧪 Testing

```bash
npm test          # Run tests
npm run check     # TypeScript check
npm run build     # Production build
```

## 🚀 CI/CD

GitHub Actions workflows in `.github/workflows/`:

1. **ci.yml** - Main pipeline (lint, build, security, deploy)
2. **deploy-vercel.yml** - Vercel frontend deployment
3. **deploy-zeabur.yml** - Zeabur backend deployment
4. **deploy-railway.yml** - Railway deployment
5. **docker.yml** - Container build/push

## 🛡️ Security Considerations

1. **JWT Secret**: Required in production (enforced)
2. **Clerk Keys**: Publishable key safe for frontend, secret never exposed
3. **CORS**: Configured per-deployment
4. **Rate Limiting**: Recommended for public endpoints
5. **Input Validation**: Zod schemas for all tRPC inputs

## 🐛 Common Issues

### TypeScript Errors
- Run `npm run check` to identify issues
- Check import paths (relative vs absolute)
- Verify type declarations for Web APIs

### Build Failures
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for missing environment variables
- Verify Node version (20.x)

### Deployment Issues
- Check Railway logs for backend errors
- Verify Vercel environment variables
- Ensure DATABASE_URL is set for MySQL

## 📝 Development Workflow

1. **Branch**: Create from `main`
2. **Code**: Make changes, run `npm run check`
3. **Test**: `npm test`
4. **Build**: `npm run build`
5. **Commit**: Clear commit message
6. **Push**: Auto-deploys via GitHub Actions

## 🔗 External Services

- **Clerk**: Authentication (clerk.com)
- **Railway**: Backend hosting
- **Vercel**: Frontend hosting
- **Zeabur**: Alternative backend hosting
- **Firebase**: Real-time database (optional)
- **Supabase**: Database backup (optional)
- **M-PESA**: Mobile payments (Kenya)

## 📚 Additional Documentation

- [CLERK_INTEGRATION.md](./docs/CLERK_INTEGRATION.md) - Clerk setup guide
- [README.md](./README.md) - Project overview
- [backend/README.md](./backend/README.md) - Legacy backend docs

---

*Last updated: 2026-06-14*
