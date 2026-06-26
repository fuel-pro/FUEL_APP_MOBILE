# FuelPro - Fuel Station Management System

> A professional fuel distribution and payment management system built with React, TypeScript, and tRPC.

![FuelPro Dashboard](dashboard-preview.png)

## 🚀 Quick Start

### Installation Options

#### Option 1: PWA (Recommended - All Devices)
- **Android Chrome**: Visit the deployed URL > Menu > "Add to Home Screen"
- **iOS Safari**: Visit the deployed URL > Share > "Add to Home Screen"
- **Windows Chrome**: Visit the deployed URL > Menu > "Install FuelPro"
- Works offline after first visit (Service Worker caching)

#### Option 2: Android APK
1. Download `FuelPro-v1.0.0.apk` to your Android phone
2. Enable "Unknown Sources" in Settings > Security
3. Open the APK file to install
4. Launch FuelPro from your app drawer

#### Option 3: Windows Standalone
1. Download `FuelPro-Windows.zip` and extract
2. Double-click `FuelPro.bat` to launch in Chrome app mode
3. Or right-click `FuelPro.ps1` > "Run with PowerShell"

#### Option 4: Use in Browser (Any Device)
Visit the deployed URL in any modern browser.

---

## 📋 Basic Rules - DO/HAVE

### ✅ DO / HAVE

1. **Data Persistence**
   - All data stored locally in browser's IndexedDB
   - Survives refresh, browser close, device restart
   - Cross-device sync via Export/Import JSON

2. **Authentication**
   - Google OAuth support
   - Email/password login
   - Username login option
   - Role-based access (owner, manager, staff, auditor)

3. **Multi-Station Support**
   - Manage multiple fuel stations from one account
   - Station-specific inventory tracking
   - Role bindings per station

4. **Fuel Types Supported**
   - Petrol
   - Diesel
   - Premium
   - Kerosene
   - LPG

5. **Payment Methods**
   - Cash payments
   - M-PESA (Kenya)
   - Bank transfers
   - Credit accounts

6. **Features**
   - Real-time sales tracking
   - Inventory management
   - Credit management
   - Payroll system
   - Document center
   - Compliance tracking
   - Audit trails
   - AI chatbot assistant
   - Live transaction monitoring
   - Shift management
   - Fuel quality testing

7. **Security**
   - HTTPS enforced
   - Secure session management
   - Role-based permissions
   - Audit logging

---

## 🚫 DON'T/HAVE NOT TO DO

### ❌ DON'T DO

1. **Don't store sensitive data in localStorage**
   - Use IndexedDB for sensitive data
   - Clear localStorage on logout
   - Don't cache auth tokens in plain text

2. **Don't expose API keys in client-side code**
   - All API keys should be in environment variables
   - Never commit `.env` files to version control

3. **Don't use eval() for user input processing**
   - The FounderConsole uses eval() - keep it admin-only
   - Sanitize all user inputs before processing

4. **Don't skip validation**
   - Always validate fuel quantities
   - Validate payment amounts
   - Validate inventory thresholds

5. **Don't ignore CORS settings**
   - Configure allowed origins properly
   - Use environment variables for origins

6. **Don't skip error handling**
   - Handle all API errors gracefully
   - Show user-friendly error messages
   - Log errors for debugging

7. **Don't hardcode URLs**
   - Use environment variables
   - Support multiple deployment targets

---

## 🏗️ Architecture

```
FUEL_APP_MOBILE/
├── app/                    # Main application (React + TypeScript)
│   ├── src/
│   │   ├── react-app/     # Main FuelPro UI
│   │   │   ├── pages/     # Page components
│   │   │   ├── components/ # UI components
│   │   │   ├── context/   # React contexts
│   │   │   ├── hooks/     # Custom hooks
│   │   │   ├── config/    # Configuration files
│   │   │   └── services/  # API services
│   │   ├── providers/      # TRPC providers
│   │   └── lib/           # Utilities
│   ├── api/               # Backend API (tRPC)
│   │   ├── auth-router.ts
│   │   ├── station-router.ts
│   │   ├── sale-router.ts
│   │   └── ...
│   ├── db/                # Database schemas (Drizzle ORM)
│   ├── contracts/         # Shared types
│   └── public/            # Static assets, manifest, SW
├── api/                   # Server entry points
├── nginx/                 # Nginx configuration
└── postgres/              # Database initialization SQL
```

---

## 🔧 Development Setup

### Prerequisites
- Node.js 18+
- npm 9+
- MySQL 8+ (for backend)

### Install Dependencies
```bash
cd app
npm install
```

### Development Mode
```bash
cd app
npm run dev
```
Opens at `http://localhost:5000`

### Build for Production
```bash
cd app
npm run build
```

### Run TypeScript Check
```bash
npm run check
```

### Database Migrations
```bash
npm run db:generate  # Generate migration
npm run db:migrate    # Apply migrations
npm run db:push       # Push schema to DB
```

---

## 🚢 Deployment

### Vercel (Recommended)
1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

### Docker
```bash
docker-compose up --build
```

### Manual
1. Build: `npm run build`
2. Copy `app/dist` to server
3. Configure nginx
4. Start server

---

## 🔐 Environment Variables

### Frontend (prefixed with VITE_)
```env
VITE_KIMI_AUTH_URL=https://auth.kimi.com
VITE_APP_ID=your_app_id
```

### Backend
```env
APP_ID=your_app_id
APP_SECRET=your_app_secret
DATABASE_URL=mysql://user:pass@host:port/db
KIMI_AUTH_URL=https://auth.kimi.com
KIMI_OPEN_URL=https://open.kimi.com
OWNER_UNION_ID=your_union_id
```

---

## 🧪 Testing

```bash
npm run test        # Run all tests
npm run test:watch  # Watch mode
```

---

## 📊 Features Overview

| Feature | Description |
|---------|-------------|
| Dashboard | Real-time station overview with charts |
| Sales Tracking | Track all fuel sales with receipts |
| Inventory | Manage fuel stock levels & alerts |
| Credit Management | Handle credit accounts & reminders |
| Payroll | Staff salary management |
| Document Center | Upload/store documents with categories |
| Compliance | Regional regulatory compliance |
| Audit Trail | Track all system changes |
| AI Chatbot | Get help with the system |
| M-PESA Integration | Kenya mobile money payments |
| Live Transactions | Real-time sale monitoring |
| Shift Management | Staff shift scheduling |
| Fuel Quality Testing | Quality control records |

---

## 🔒 Security Best Practices

1. **Authentication**
   - Use OAuth for third-party logins
   - Rotate tokens regularly
   - Implement session timeout

2. **Data Protection**
   - Encrypt sensitive data at rest
   - Use HTTPS for all communications
   - Implement rate limiting

3. **Access Control**
   - Use role-based permissions
   - Implement least privilege
   - Audit all access

---

## 🐛 Troubleshooting

### Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
```bash
npm run check
```

### API Connection Issues
1. Check if backend is running
2. Verify DATABASE_URL
3. Check CORS settings

---

## 📞 Support

For issues and feature requests:
- GitHub Issues: [Link to repository]

---

## 📄 License

Proprietary - All rights reserved

**The Publican Energy**  
Lodwar, Turkana County, Kenya

# Trigger Vercel deploy
