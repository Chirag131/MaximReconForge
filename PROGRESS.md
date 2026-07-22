# MaximReconForge — Progress & Remaining Work

_Last updated: 2026-07-22_

## What's working right now

**Backend** (`backend/`) — scaffolded per `backend/MaximReconForge_Scaffolding_Guide.md`: FastAPI app, Postgres via SQLAlchemy/Alembic, Redis/ARQ worker skeleton, Qdrant client stub, domain/IP scope validator, and JWT auth.

**Auth** is httpOnly-cookie based (not bearer-token-in-body):
- `POST /auth/register`, `POST /auth/login` — create the account/session and set `access_token` + `refresh_token` as `HttpOnly`, `SameSite=Lax` cookies. The response body only ever contains the user profile (`{id, email}`) — JavaScript never sees the token values, which closes off token theft via XSS.
- `POST /auth/refresh` — reads the refresh cookie, rotates both cookies.
- `POST /auth/logout` — clears both cookies.
- `GET /auth/me` — returns the current user from the access cookie; the frontend uses this on load to restore session state, since JS can't read httpOnly cookies directly.
- `POST /engagements` is guarded by the same cookie-based dependency (`app/auth/security.py::get_current_user`) — it previously expected an `Authorization: Bearer` header, which would have silently broken once the frontend stopped sending one.

**Frontend** (`frontend/`): React + Vite + Tailwind, dark "recon" theme.
- `src/services/authService.js` — thin fetch wrapper, always sends `credentials: "include"`.
- `src/context/AuthContext.jsx` — app-wide auth state, calls `/auth/me` on load.
- `src/pages/LoginPage.jsx` / `RegisterPage.jsx` — new pages, styled to match the existing landing page.
- `src/components/ProtectedRoute.jsx` — guards `/scan`, redirects to `/login` if not authenticated.
- `Navbar.jsx` — shows Login/Register or the logged-in email + Log out.

**Certbot / TLS** — scaffolded but **not activated** (see "Explicitly skipped" below):
- `certbot` service added to `docker-compose.yml` (renewal loop, inert until a cert exists).
- `nginx/conf.d/default.conf` has the `/.well-known/acme-challenge/` location certbot's webroot mode needs.
- `.env.example` has blank `DOMAIN` / `CERTBOT_EMAIL` placeholders.

## Tested end-to-end (2026-07-22)

Ran the full stack via `docker compose up --build` (postgres, redis, qdrant, backend, worker, nginx, certbot) and the Vite dev server, then drove it with a headless Playwright browser:

1. Visiting `/scan` while logged out → redirected to `/login`. ✅
2. Register a new account → lands on `/scan`, navbar shows the email. ✅
3. Reload `/scan` → session survives via the cookie (no bounce to login). ✅
4. Log out → cookies cleared, redirected away from the protected route. ✅
5. Log back in with the same credentials → lands on `/scan` again. ✅
6. Backend-only checks: `/auth/me`, `/auth/refresh` (rotates cookies), `/auth/logout` (invalidates session, confirmed via a subsequent 401), and `/engagements` correctly requires auth (422 scope-validation error, not 401, once authenticated). ✅

### Bugs found and fixed during this test pass
- **`ProtectedRoute` caused an infinite render loop on logout.** React Router's `<Navigate>` depends on its `state` prop *by reference*; `ProtectedRoute` was passing a fresh `{ from: location }` object every render, and — because `SharedLayout`'s `AnimatePresence` keeps the outgoing route element mounted during its exit animation — that component kept re-rendering even after the URL had already changed, each time recomputing (and getting wrong) the redirect target. Fixed by freezing the original target location in a `useRef` on first render and memoizing the `state` object once with `useMemo(..., [])`, so the reference — and the target — stay stable for the life of that redirect.
- **`Navbar`'s logout handler raced `ProtectedRoute`'s own redirect.** Both tried to navigate away from `/scan` the instant the user logged out. Removed the navbar's explicit `navigate("/")` — `ProtectedRoute` is now the single place that decides where to send a logged-out user.
- **`backend/app/api/engagements.py`** still expected a Bearer token via `OAuth2PasswordBearer`, left over from before the cookie switch — updated to use the same `get_current_user` cookie dependency as everything else.

## Explicitly skipped this pass (needs real hosting first)

- **Actual certbot cert issuance.** Let's Encrypt can't issue a certificate for `localhost` — it needs a domain's DNS pointed at a publicly reachable IP on ports 80/443. Once that's true:
  1. Set `DOMAIN` and `CERTBOT_EMAIL` in `.env`.
  2. `docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --email $CERTBOT_EMAIL --agree-tos --no-eff-email`
  3. Uncomment the `listen 443 ssl` block in `nginx/conf.d/default.conf` and reload nginx.
- **Cookie `Secure` flag.** Currently forced off in development (`backend/app/auth/security.py::set_auth_cookies`) because a `Secure` cookie is silently dropped by browsers over plain HTTP, which is all we have without a cert. It flips on automatically once `ENVIRONMENT=production` — just don't set that until TLS is actually live, or logins will appear to succeed while the cookie never gets stored.
- **CSRF hardening.** `SameSite=Lax` cookies already block the common case (cross-site POST via fetch/forms), which is why a separate CSRF token wasn't added — but a double-submit token would still be the standard next step if this becomes internet-facing.

## Still outstanding (unrelated to auth/certbot, carried over from the scaffolding guide)

- `backend/app/tools/registry.py` and `worker/runner/executor.py` — placeholders, no real tool logic (subfinder, nmap, nuclei, etc.).
- `GET /engagements/{id}/report`, `POST /engagements/{id}/abort`, `WS /engagements/{id}/live` — stubbed as `501`.
- ScopeGuard enforcement, Commander/LangGraph prompts, ContextStore ACL — stub files only.
- Frontend's `/scan` flow still runs against `services/dummyScanApi.js` (a scripted mock), not the real `/engagements` backend endpoint.
