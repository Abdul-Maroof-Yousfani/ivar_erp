# Authentication System Refactoring - Refresh Token Fix

## Problem Statement

The application was experiencing frequent user logouts in production due to an overly aggressive refresh token rotation strategy. The main issues were:

1. **Refresh tokens were being revoked on every refresh** - This caused "token revoked" errors
2. **Token rotation complexity** - The system created a new refresh token and revoked the old one on each refresh
3. **Short-lived access tokens** - Combined with aggressive rotation, this led to poor user experience
4. **Not suitable for portal applications** - The security pattern was more appropriate for high-security banking apps

## Solution Overview

We've simplified the authentication system to be more suitable for a portal application:

### 1. **Removed Refresh Token Rotation**
- **Before**: Each refresh created a new token and revoked the old one
- **After**: Refresh tokens are reused until they expire naturally (30 days)
- **Benefit**: Eliminates "token revoked" errors and simplifies the flow

### 2. **Extended Access Token Lifetime**
- **Before**: Access tokens expired after 7 days but were refreshed every 90 minutes
- **After**: Access tokens last 7 days with refresh checks every 6 hours
- **Benefit**: Reduces server load and improves user experience

### 3. **Simplified Session Management**
- **Before**: Session timeout was 30 days, mismatched with token strategy
- **After**: Session timeout is 7 days, matching access token lifetime
- **Benefit**: Consistent behavior across the system

## Changes Made

### Backend Changes

#### 1. `nestjs_backend/src/config/auth.config.ts`
```typescript
// Updated configuration
accessExpiresIn: '7d',        // 7 days - suitable for portal
refreshExpiresIn: '30d',      // 30 days - backup for extended sessions
sessionTimeout: 7 * 24 * 60 * 60 * 1000  // 7 days to match access token
```

#### 2. `nestjs_backend/src/auth/auth.service.ts`
**Key Change**: Modified `refresh()` method to remove token rotation

**Before**:
```typescript
// Revoked old token
await tx.refreshToken.update({
  where: { id: stored.id },
  data: { isRevoked: true },
});

// Created new token
await tx.refreshToken.create({
  data: {
    userId: user.id,
    token: newRefreshToken,
    family,
    expiresAt: new Date(Date.now() + refreshTokenExpiryMs),
  },
});

return { accessToken, refreshToken: newRefreshToken };
```

**After**:
```typescript
// No token rotation - reuse existing token
// Only update session with new access token

return { accessToken, refreshToken: token }; // Return same refresh token
```

### Frontend Changes

#### 1. `frontend/components/providers/auth-provider.tsx`
```typescript
// Reduced refresh frequency from 90 minutes to 6 hours
const refreshInterval = setInterval(() => {
  refreshToken();
}, 6 * 60 * 60 * 1000); // 6 hours (was 90 minutes)
```

#### 2. `frontend/lib/hooks/use-auth.ts`
```typescript
// Reduced session check from 5 minutes to 1 hour
const interval = setInterval(checkAndRefreshToken, 60 * 60 * 1000); // 1 hour (was 5 minutes)
```

## How It Works Now

### Login Flow
1. User logs in with email/password
2. Backend creates:
   - Access token (7-day expiry)
   - Refresh token (30-day expiry)
   - Session record (7-day expiry)
3. Both tokens are stored in HTTP-only cookies

### Token Refresh Flow
1. Frontend calls `/api/auth/refresh-token` every 6 hours (or on window focus)
2. Backend validates the refresh token:
   - Checks if token exists in database
   - Checks if token is revoked (should never be revoked now)
   - Checks if token is expired
3. If valid:
   - Generates new access token (7-day expiry)
   - **Reuses the same refresh token** (no rotation)
   - Updates session with new access token
4. Returns new access token and same refresh token

### Session Management
- Sessions are updated on each token refresh
- Session timeout is 7 days (sliding window)
- On logout, both session and refresh tokens are invalidated

## Benefits

### 1. **Improved User Experience**
- Users stay logged in for up to 7 days without interruption
- No more unexpected "token revoked" errors
- Seamless experience across browser tabs

### 2. **Reduced Server Load**
- Token refresh checks reduced from every 5 minutes to every hour
- Automatic refresh reduced from every 90 minutes to every 6 hours
- Fewer database queries for token validation

### 3. **Simplified Codebase**
- Removed complex token rotation logic
- Easier to debug and maintain
- Clear separation between access and refresh token lifetimes

### 4. **Better for Portal Applications**
- 7-day sessions are standard for business portals
- Balance between security and convenience
- Users don't need to re-login multiple times per week

## Security Considerations

### What We Kept
- ✅ HTTP-only cookies (prevents XSS attacks)
- ✅ Refresh token validation in database
- ✅ Token expiry checks
- ✅ Session tracking and management
- ✅ Ability to revoke tokens on logout
- ✅ User status validation on each refresh

### What We Removed
- ❌ Token rotation (was causing production issues)
- ❌ Token family tracking (no longer needed)
- ❌ Aggressive refresh intervals

### Is This Secure Enough?
**Yes, for a portal application**:
- Access tokens still expire after 7 days
- Refresh tokens expire after 30 days
- Tokens are stored in HTTP-only cookies (not accessible to JavaScript)
- Sessions can be invalidated on logout
- User status is checked on every refresh
- This is the same pattern used by many successful SaaS applications

## Migration Notes

### For Existing Users
- Existing sessions will continue to work
- Old refresh tokens in the database will remain valid
- No user action required

### For Development
- No database migration needed
- Changes are backward compatible
- Existing tokens will work with new logic

## Testing Recommendations

1. **Login Test**: Verify users can log in successfully
2. **Session Persistence**: Confirm users stay logged in for 7 days
3. **Token Refresh**: Test automatic refresh after 6 hours
4. **Logout**: Ensure logout properly invalidates tokens
5. **Multiple Tabs**: Verify seamless experience across tabs
6. **Window Focus**: Test token refresh on window focus

## Monitoring

Watch for these metrics in production:
- Reduction in "token revoked" errors (should be zero)
- Reduction in `/api/auth/refresh-token` calls
- User session duration (should average 3-7 days)
- Logout rate (should decrease)

## Rollback Plan

If issues arise, you can revert by:
1. Restoring the original `auth.service.ts` refresh method
2. Restoring the original `auth.config.ts` settings
3. Restarting the backend service

The changes are isolated to these files and don't require database changes.
