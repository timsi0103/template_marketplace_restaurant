# Auth Testing Playbook

## Test Credentials
- Admin: admin@culinaryeditorial.com / Admin123!
- Test User: test@example.com / test123

## Step 1: Create Test Session for Browser Testing
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'browser.test.' + Date.now() + '@example.com',
  name: 'Browser Test User',
  picture: '',
  role: 'customer',
  auth_provider: 'email',
  password_hash: '',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Browser Testing with Cookie
```javascript
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "dining-platform-17.preview.emergentagent.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}]);
await page.goto("https://dining-platform-17.preview.emergentagent.com");
```

## API Endpoints
- POST /api/auth/register - {email, password, name}
- POST /api/auth/login - {email, password}
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
- POST /api/auth/forgot-password - {email}
- POST /api/auth/reset-password - {token, new_password}
- POST /api/auth/google/callback - {session_id}
- POST /api/auth/guest-session
