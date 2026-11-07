# Sign-in provider setup status

X Browser currently has no X Browser account backend. A provider button alone would not create a secure login or user account, so the product website does not pretend that sign-in is active.

To implement Google, Microsoft, Apple, and Yandex sign-in, first choose the final HTTPS domain and the account service. Then register one OAuth/OIDC application at each provider using exact callback URLs. Keep every client secret on the server; Apple also requires a developer team and signing key. Add account linking, session expiry, CSRF/state validation, logout, and recovery before exposing sign-in buttons to users.

Required values will be stored only as server-side secrets, for example:

- `PUBLIC_SITE_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT`
- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
- `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`
- `SESSION_SIGNING_KEY`

These are placeholders, not real credentials. Do not share secret values in chat or commit them. Provider registration, identity verification, and any paid developer memberships must be completed by the account owner.
