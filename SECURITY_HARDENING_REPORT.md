# Security Hardening Report

Updated backend: `backend/server.js`

## What Was Fixed

- Login SQL injection is fixed by using a parameterized user lookup and `bcrypt.compare`.
- Product search SQL injection is fixed by parameterizing search terms.
- Admin routes now require an authenticated admin role.
- Order detail access now checks ownership unless the requester is an admin.
- Order totals are now calculated from database product prices, not client-submitted prices.
- User profile lookup now requires authentication and only allows self/admin access.
- Admin user updates now use an allowlist to prevent mass assignment.
- Debug output no longer exposes schema or environment variables.
- CORS is restricted to local app origins instead of allowing every origin.
- JWT fallback secret is generated at runtime when `JWT_SECRET` is not provided.
- New registrations no longer store plaintext passwords.

## Quick Verification

Tested locally against `http://127.0.0.1:3001`:

- Health check returned `ok`.
- Admin login still works.
- User login still works.
- Login SQL injection payload is rejected.
- Normal user access to `/api/admin/orders` is rejected.
- Injected product search returns no leaked user data.

## Remaining Note

For production, set a stable strong `JWT_SECRET` in the environment. Without it, the server generates a new secret on each restart, which is safer than a hardcoded secret but invalidates existing sessions.
