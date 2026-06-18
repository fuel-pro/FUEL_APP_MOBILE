# FuelPro Architecture

## Overview
FuelPro is a multi-tenant fuel station management system with:
- React frontend (Vite + TypeScript)
- Node.js/Express backend (SQLite)
- Real-time sync across devices

## Repository Structure
```
FUEL_APP_MOBILE/
├── app/                    # Frontend React application
│   ├── src/
│   │   ├── react-app/     # Main app components
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── context/     # React context providers
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── lib/         # Utilities and services
│   │   │   ├── pages/       # Page components
│   │   │   └── services/     # API services
│   │   └── ...
│   └── dist/              # Built assets
├── backend/               # Express.js API server
│   ├── database/         # SQLite database setup
│   ├── middleware/        # Express middleware
│   ├── models/            # Data models
│   ├── routes/            # API routes
│   └── server.js          # Entry point
├── api/                   # Additional API utilities
├── scripts/               # Build/deployment scripts
├── docs/                  # Documentation
└── Configuration files
```

## Key Technologies
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express, SQLite (better-sqlite3)
- **Real-time**: Socket.io
- **Auth**: JWT with refresh tokens
- **Sync**: BroadcastChannel API, localStorage

## Data Sync Architecture
1. **Local Storage**: All user data cached in localStorage
2. **Cross-Tab Sync**: BroadcastChannel for same-browser tabs
3. **Backend Sync**: REST API with JWT authentication
4. **Token Refresh**: Automatic refresh before expiry

## Authentication Flow
1. User logs in → Backend returns JWT + refresh token
2. Token stored in localStorage + BroadcastChannel sync
3. On page load → Validate token with backend
4. Token auto-refreshes every 14 minutes
5. Logout clears all local data + broadcasts to other tabs

## Cross-Device Login
- Device ID generated and stored per browser
- Login history tracked with device info
- Session info available via `/api/auth/session`
