---
name: qbo-oauth
description: QuickBooks Online OAuth 2.0 token management pattern including initial authorization, token refresh, and secure storage in Firestore
---

# QBO OAuth 2.0 Pattern

## Token Flow
1. User clicks "Connect to QuickBooks" in the web app
2. App redirects to Intuit authorization URL with Client ID and scopes
3. User authorizes, Intuit redirects back with authorization code
4. App exchanges code for access token + refresh token
5. Store both tokens in Firestore (encrypted)
6. Access token used for all API calls (expires in 60 min)
7. Refresh token used to get new access token (valid 5 years)

## Authorization URL
```
https://appcenter.intuit.com/connect/oauth2?
  client_id={CLIENT_ID}&
  redirect_uri={REDIRECT_URI}&
  response_type=code&
  scope=com.intuit.quickbooks.accounting&
  state={CSRF_TOKEN}
```

## Token Exchange
```javascript
const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: REDIRECT_URI
  })
});
```

## Token Refresh (call before every API request if token is near expiry)
```javascript
const refreshResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
  },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: storedRefreshToken
  })
});
```

## Firestore Token Storage
```
Collection: qboAuth
Document: tokens
Fields:
  accessToken: string (encrypted)
  refreshToken: string (encrypted)
  accessTokenExpiry: timestamp
  refreshTokenExpiry: timestamp
  realmId: string
  lastRefreshed: timestamp
```

## Auto-Refresh Logic
Before every QBO API call, check if access token expires within 5 minutes. If so, refresh first. If refresh fails, prompt user to re-authorize.
