# Clerk Authentication Integration Guide

## Overview

FuelPro uses Clerk for enterprise-grade authentication. The integration provides:
- Secure user authentication (sign-in/sign-up)
- Session management
- Multi-factor authentication (MFA)
- Social login (Google, etc.)
- User profile management

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ClerkWrapper                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    ClerkProvider                           │   │
│  │  - publishableKey: VITE_CLERK_PUBLISHABLE_KEY           │   │
│  │  - routerType: "hash" (for React Router v7)             │   │
│  │  - afterSignInUrl: "/#/dashboard"                        │   │
│  │  - afterSignUpUrl: "/#/welcome"                         │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      App Components                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ ClerkSignIn │  │ ClerkSignUp │  │ ClerkUserButton   │    │
│  └──────────────┘  └──────────────┘  └───────────────────┘    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ ClerkProtect│  │ ClerkShow   │  │ ClerkBridge      │    │
│  └──────────────┘  └──────────────┘  └───────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Auth Hooks                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ useClerkSync() - Unified auth state                       │   │
│  │ - isClerkConfigured, isSignedIn, user, getToken()         │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ useClerkAuth() - Combined Clerk + legacy auth             │   │
│  │ - clerkUser, appUser, isAuthenticated, signOut()          │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ useFounderAuth() - Founder Access with Clerk             │   │
│  │ - isAuthenticated, authMethod, getClerkUser()             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### ClerkWrapper
Main provider that wraps the app. Located at:
`src/react-app/components/ClerkWrapper.tsx`

```tsx
<ClerkWrapper>
  <App />
</ClerkWrapper>
```

### ClerkSignIn
Full-page sign-in component. Route: `/sign-in`

```tsx
<ClerkSignIn />
```

### ClerkSignUp
Full-page sign-up component. Route: `/sign-up`

```tsx
<ClerkSignUp />
```

### ClerkUserButton
User avatar with dropdown menu.

```tsx
import { ClerkUserButton } from "@/react-app/components/ClerkUserButton";

<ClerkUserButton />
```

### ClerkProtect
Protected route wrapper.

```tsx
import { ClerkProtect } from "@/react-app/components/ClerkProtect";

<ClerkProtect fallback={<Loading />}>
  <ProtectedContent />
</ClerkProtect>
```

### ClerkShow
Conditional rendering based on auth state.

```tsx
import { ClerkShow } from "@/react-app/components/ClerkShow";

<ClerkShow when="signed-in">
  <Dashboard />
</ClerkShow>

<ClerkShow when="signed-out" fallback={<Spinner />}>
  <LoginForm />
</ClerkShow>
```

## Hooks

### useClerkSync
Unified Clerk authentication state.

```tsx
import { useClerkSync } from "@/react-app/hooks/useClerkSync";

function MyComponent() {
  const { 
    isClerkConfigured,
    isSignedIn,
    user,
    email,
    name,
    imageUrl,
    getToken,
    getAuthHeaders 
  } = useClerkSync();
  
  // ...
}
```

### useClerkAuth
Combines Clerk with legacy app auth.

```tsx
import { useClerkAuth } from "@/react-app/hooks/useClerkAuth";

function MyComponent() {
  const {
    clerkUser,
    appUser,
    isAuthenticated,
    displayName,
    signOut,
    getAuthToken
  } = useClerkAuth();
  
  // ...
}
```

### useFounderAuth
Founder Access with Clerk support.

```tsx
import { useFounderAuth } from "@/react-app/hooks/useFounderAuth";

function FounderPage() {
  const {
    isAuthenticated,
    authMethod,
    login,
    logout,
    getClerkUser,
    isClerkConfigured
  } = useFounderAuth();
  
  // authMethod: "clerk" | "legacy"
  // ...
}
```

## API Integration

### TRPC Provider
The tRPC provider automatically includes Clerk tokens in API calls:

```typescript
// In trpc.tsx
async headers() {
  const headers = {};
  const clerkToken = await getClerkToken();
  if (clerkToken) {
    headers["Authorization"] = `Bearer ${clerkToken}`;
    headers["X-Clerk-Auth"] = "true";
  }
  return headers;
}
```

### Manual API Calls
Use `getAuthHeaders()` for manual fetch calls:

```typescript
import { getAuthHeaders } from "@/react-app/lib/clerkAPI";

async function fetchProtectedData() {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/protected", { headers });
  return response.json();
}
```

## Configuration

### Environment Variables

Create `.env.local` in the `app` directory:

```bash
# Clerk Publishable Key (get from dashboard.clerk.com)
# Example: pk_test_51H2B4K8L9M0N1O2P3Q4R5S6T7U8V9W0X1Y2Z3
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here

# Clerk Secret Key (server-side only)
# Example: sk_test_51H2B4K8L9M0N1O2P3Q4R5S6T7U8V9W0X1Y2Z3
CLERK_SECRET_KEY=sk_test_your_secret_here
```

### Clerk Dashboard Setup

1. Go to https://dashboard.clerk.com
2. Select your app (immense-mullet-70)
3. Navigate to **API Keys** - Copy Publishable Key
4. Go to **User & Authentication** → **Sign-in**
   - Enable identifiers (email, username)
   - Configure social providers
5. Go to **User & Authentication** → **Redirects**
   - Add: `http://localhost:5173/#/dashboard`
   - Add: `http://localhost:5173/#/sign-in`

## Fallback Behavior

When `VITE_CLERK_PUBLISHABLE_KEY` is **NOT** set:
- Clerk components are hidden
- App uses legacy email/password authentication
- All existing functionality continues to work

When `VITE_CLERK_PUBLISHABLE_KEY` **IS** set:
- Clerk is the primary authentication method
- ClerkSignIn/SignUp pages are used
- Session tokens are managed by Clerk
- Legacy auth still works as fallback

## File Structure

```
app/src/
├── react-app/
│   ├── components/
│   │   ├── ClerkWrapper.tsx      # Main provider
│   │   ├── ClerkSignIn.tsx       # Sign-in page
│   │   ├── ClerkSignUp.tsx       # Sign-up page
│   │   ├── ClerkUserButton.tsx    # User dropdown
│   │   ├── ClerkProtect.tsx       # Protected routes
│   │   ├── ClerkShow.tsx          # Conditional rendering
│   │   ├── ClerkBridge.tsx        # Auth sync
│   │   └── ClerkAuthButtons.tsx   # Auth buttons
│   ├── hooks/
│   │   ├── useClerkAuth.ts        # Combined auth hook
│   │   ├── useClerkSync.ts       # Unified state hook
│   │   └── useFounderAuth.ts      # Founder auth hook
│   ├── lib/
│   │   └── clerkAPI.ts           # API utilities
│   └── App.tsx                   # Updated with Clerk routes
├── providers/
│   └── trpc.tsx                  # Updated with Clerk tokens
└── .env.clerk.example            # Example configuration
```

## Security

- **Publishable Key** (`pk_test_...`) - Safe to expose to client
- **Secret Key** (`sk_test_...`) - NEVER expose to client
- All sensitive operations go through Clerk's secure infrastructure
- JWT tokens are verified server-side

## Troubleshooting

### "Clerk not loading"
- Verify `VITE_CLERK_PUBLISHABLE_KEY` is set correctly
- Check browser console for errors
- Verify Clerk app is active in dashboard

### "Sign-in not redirecting"
- Check redirect URLs in Clerk Dashboard
- Verify the URL matches exactly (including trailing slash)

### "Token not included in API calls"
- Ensure ClerkWrapper wraps the app
- Check that user is signed in
- Verify tRPC provider has Clerk headers configured

## Migration from Legacy Auth

To fully migrate to Clerk:

1. Set `VITE_CLERK_PUBLISHABLE_KEY`
2. Test all authentication flows
3. Update user profile components to use Clerk user data
4. Remove legacy auth code when ready
5. Update backend to verify Clerk JWTs

## Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk React SDK](https://clerk.com/docs/reference/clerk-react)
- [Clerk Dashboard](https://dashboard.clerk.com)
- [FuelPro Clerk App](https://immense-mullet-70.clerk.accounts.dev)
