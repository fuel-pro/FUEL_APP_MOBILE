# Founder Access Route Documentation

## Overview

The `/founder` route is a high-privilege dashboard accessible only to FuelPro founders. It provides oversight of all stations, analytics, system health, and administrative controls.

**URL:** `https://fuel-app-mobile.vercel.app/#/founder`

## Authentication

The route supports the following authentication methods:

### 1. Custom Hardcoded Login (Current Default)
- **Username:** `FOUNDER`
- **Password:** `fuelpro2026`
- **2FA:** Any valid 6-digit code (if 2FA is configured)

### 2. Clerk Authentication (Recommended for Production)
Enterprise-grade SSO and MFA via `@clerk/clerk-react`.

To enable Clerk authentication:
1. Set `VITE_CLERK_PUBLISHABLE_KEY` in your environment
2. Wrap the route with Clerk's `<Protect>` component

## Session Management

- Sessions are stored in `localStorage` under the key `fuelpro_founder_session`
- Session object structure:
  ```json
  {
    "active": true,
    "loginTime": 1719000000000,
    "username": "FOUNDER"
  }
  ```
- Sessions expire after **8 hours** of inactivity
- Session is validated on page load and refreshed on login

## Navigation Sections

| Section | Description |
|---------|-------------|
| **Overview** | System statistics and health dashboard |
| **All Users** | View and manage all registered users |
| **All Stations** | View and manage all fuel stations |
| **Analytics** | Usage analytics and reporting |
| **Secrets** | Manage sensitive configuration keys |
| **Audit Log** | View all administrative actions |
| **Feature Flags** | Toggle application features |
| **System Health** | Server status and metrics |
| **Security & 2FA** | Configure two-factor authentication |
| **Rate Limits** | API rate limit configuration |
| **Backup & Restore** | Data backup management |
| **Site Config** | Global site settings |
| **Notifications** | Push notification settings |
| **Branding** | Logo and theme customization |
| **Email Templates** | Email notification templates |
| **Paywall Control** | Subscription paywall settings |
| **Payment Methods** | Configure payment providers |
| **Pricing Manager** | Manage subscription pricing |
| **Sub. Dashboard** | Subscription analytics |
| **Coupons** | Promo code management |
| **Payments** | Payout history |
| **Trial Analytics** | Free trial metrics |
| **Performance Center** | System performance monitoring |
| **API & Webhooks** | API documentation and webhook config |
| **Maintenance** | Maintenance mode controls |
| **Data Manager** | Import/export data |
| **AI Website Editor** | Code generation assistant |

## Audit Logging

All actions (login, logout, session resume, errors) are logged to:
1. **MySQL Backend** (via `useFounderBackend` hook) - Primary storage
2. **localStorage** (`fuelpro_founder_audit`) - Fallback for offline access

Audit log entries include:
- Action type
- Details
- Severity level (success, warning, danger, info)
- Timestamp
- User identification

## Troubleshooting

### Blank Screen on Load
- Ensure `lucide-react` icons are correctly imported
- Verify navGroups use valid React components (not numbers)
- Check browser console for React errors

### Logged Out on Refresh
- Check that `localStorage` is not being cleared by browser privacy settings
- Verify session object has correct structure: `{ active: boolean, loginTime: number }`
- Ensure 8-hour expiry has not been exceeded

### 2FA Code Not Working
- Ensure code is exactly 6 digits
- Verify TOTP secret is correctly configured
- Check system clock synchronization

## Security Considerations

- **HTTPS Required:** Always access via HTTPS in production
- **Session Expiry:** Sessions automatically expire after 8 hours
- **Rate Limiting:** 5 failed login attempts trigger a 15-minute lockout
- **Audit Trail:** All actions are logged for compliance

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for authentication |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side only) |

## API Endpoints (Backend)

The founder dashboard integrates with these backend endpoints:
- `GET /api/founder/users` - List all users
- `GET /api/founder/stations` - List all stations
- `GET /api/founder/audit` - Get audit logs
- `POST /api/founder/audit` - Log audit entry
- `GET /api/founder/stats` - Dashboard statistics
