# Security & exposure

**Read this before making the app reachable from anywhere other than your own machine or trusted LAN.**

This app was built for a single person running it on their own homelab. That assumption is baked into it. This document explains, in plain terms, what that means for security, what has already been hardened, and what you must put in place _before_ exposing it to the internet.

---

## The one thing to know: there is no login

The app has **no authentication at all**. There is no password, no user account, no session check. Every API route is open to anyone who can reach the server.

On `localhost` or a trusted home network, that is fine — the network itself is the boundary. The moment the app is reachable from the internet, that boundary is gone, and "anyone who can reach the server" becomes "anyone, anywhere".

This is a deliberate current state, not an oversight — but it is **not** a permanent design decision. If you want to expose the app, auth has to be added in front of it (see options below).

---

## What "no login" concretely lets a stranger do, if exposed

If the app were port-forwarded to the internet as-is, anyone who found the URL could, without any credentials:

- **Browse your server's folders.** One endpoint lists directories on the machine (`/api/fs/list-dirs`). It's meant to help you pick a ROM folder in the UI; to an attacker it's free reconnaissance of your filesystem.
- **Write and rename files on disk.** The scan/rename and download features write into the folders you configured. A guard (`fs-safety`) keeps this _inside_ those configured folders — an attacker can't escape to the rest of the disk — but within them they could overwrite, shuffle, or fill up your ROM directories.
- **Use your archive.org account.** Your archive.org login is stored on the server and used to download restricted collections. An attacker can't _read it back_ (that was fixed — see below), but they can still trigger downloads _through_ your authenticated account: your bandwidth, your IP's reputation, potentially your account getting rate-limited or suspended.
- **Change your settings.** Anyone can overwrite the configured folders, the download concurrency, or replace the stored credentials.
- **Overload the machine.** A single scan request on a huge folder, or a download loop, can saturate CPU, disk, and network. There is no rate limiting.

None of this requires any skill beyond knowing the URL. That's what "no auth" means once the network boundary is removed.

---

## What has already been hardened

- **Credentials are write-only across the API.** The archive.org S3 keys and session cookies used to be sent back to the browser on every settings read. Now the settings API only reports _whether_ they are configured (`archiveOrgKeysConfigured` / `archiveOrgSessionConfigured`), never the values. The server still holds and uses the real values internally. (Commit `210fd7e`.)

This narrows what leaks _outward_, but it does not add a login. It is one small fix inside a design that still assumes a trusted network.

---

## Before exposing to the internet — your options

Ordered from most robust / least app work, to most app work:

### 1. Don't expose it directly — use a VPN (recommended for personal use)

Put the app on a VPN (WireGuard, Tailscale, …) and reach it as if you were at home. Nothing is exposed publicly, so none of the risks above apply. For a single user this is the best effort-to-safety ratio and needs zero application code.

### 2. Put an authenticated reverse proxy in front

Run the app behind Caddy / Traefik / nginx with authentication at the proxy layer — HTTP Basic Auth at minimum, or a real SSO (Authelia, Authentik, `oauth2-proxy`). The app stays "open" internally but is only reachable _after_ the proxy authenticates the visitor. This covers **every** endpoint at once, is battle-tested, and the proxy also terminates HTTPS for you. No application code changes.

#### The setup in use: Cloudflare Tunnel + Cloudflare Access

This is option 2 with Cloudflare as the proxy, and it is how the homelab instance is reached from outside. It needs no in-app login, **provided every point below holds**:

- **No published port.** The container's `docker-compose.yml` has no `ports:` entry for the app. `cloudflared` reaches it by service name on a shared Docker network. A published port is a way around Access: anyone on the LAN (or the internet, if the port is forwarded) reaches the app with no login.
- **One Access application covers the whole hostname**, all paths included: `/api/*` and the SSE streams as much as the page. An Access policy on `/` alone leaves the API open.
- **The policy names who may log in** (email one-time PIN for your own address), not "anyone with an email".
- **No second route in.** If a reverse proxy (SWAG) also serves the app on the LAN, it must not be reachable from outside with the same hostname, or it bypasses Access.

Two consequences of going through Cloudflare, handled in the app:

- **Idle connections are cut after ~100 s.** The download and scan event streams send a keep-alive comment every 30 s (`apps/server/src/lib/job-event-stream.ts`), so a long CHD conversion no longer freezes the progress shown.
- **Large files through the tunnel.** "Browser" downloads stream ROM files (disc images of several hundred MB) through Cloudflare. Cloudflare's terms discourage serving large non-web content through its proxy on the free plan; "server" downloads, which land on the homelab's disk directly, avoid the question.

Optional defense in depth: check the `Cf-Access-Jwt-Assertion` header Cloudflare adds to every authenticated request (a Hono middleware verifying the JWT against the team's public keys and the application's audience tag). It would reject a request that reached the app without going through Access — the case where a port was published by mistake. Not built: the points above already close that path.

### 3. Add a single-password gate inside the app (defense-in-depth)

Only worth it if you want the container to be safe _by default_, without depending on the proxy being configured correctly. See the sketch below.

**Whichever you pick, HTTPS is mandatory.** Without TLS, the archive.org password you type (and any app password) travels in clear text over the network — not just over localhost. A reverse proxy handles this for you; a VPN sidesteps it; a bare port-forward does not.

---

## If we build the in-app gate later — the plan

For a single-user app you do **not** need accounts, registration, roles, or password reset. You need exactly one gate. Rough shape (~100 lines):

- Two environment variables: `AUTH_PASSWORD` (the shared secret) and `SESSION_SECRET` (to sign the cookie).
- A Hono middleware `app.use('*', …)` that rejects any request without a valid signed, `httpOnly` session cookie — except the login and health routes.
- A `POST /api/login` that compares the submitted password in constant time and, on success, sets the signed session cookie.
- A small login screen on the frontend.

Known costs to budget for, so they aren't a surprise:

- **It ripples through the server tests.** All 296 server tests currently call endpoints with no auth. A global gate means the test harness has to authenticate, or the middleware needs a documented bypass for tests — real work, not huge.
- **Cookie vs. token / CSRF.** Using a session cookie means deciding on CSRF protection (a `SameSite` cookie is usually enough for a same-origin SPA); a bearer token avoids CSRF but is readable by any XSS. A trade-off to make deliberately, not by accident.
- **It protects the API surface, not the data at rest** (see next section).

---

## Secrets at rest

The archive.org S3 keys and session cookies are stored **in clear text** in the SQLite database (`~/.flemarr/`). The account password itself is never stored — it's exchanged once for those keys and cookies.

This is acceptable for a homelab: the database file sits on the same machine, at the same trust level as the ROM folders next to it. But be clear-eyed about the implication — **if the machine itself is compromised, the stored keys and cookies are readable.** No amount of API-level auth changes that. If that matters to you later, the fix would be encrypting those columns with a key supplied at startup (out of scope for now).

---

## Summary

| Situation                                         | Safe?                   |
| ------------------------------------------------- | ----------------------- |
| `localhost` only                                  | Yes                     |
| Trusted home LAN                                  | Yes                     |
| VPN access from outside                           | Yes                     |
| Behind an authenticated reverse proxy, over HTTPS | Yes                     |
| Cloudflare Tunnel + Access, no published port     | Yes                     |
| Port-forwarded to the internet as-is              | **No — do not do this** |
