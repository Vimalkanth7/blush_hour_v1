# AUTH_FLOW — Blush Hour v0 (Expo Router)

## Goal
Production-correct auth/navigation flow:

- Logged out users must see Welcome/Login/Register.
- Logged in users must be validated via `GET /api/users/me`.
- Incomplete users go to onboarding.
- Completed users go to tabs.
- Sign out must always be available and must prevent returning to tabs.

---

## Definitions

### Auth states
- Loading: app is reading token + validating `/me`.
- Unauthenticated: no token or token invalid.
- Onboarding: token valid but `onboarding_completed=false`.
- Authenticated: token valid and `onboarding_completed=true`.

### Source of truth
- Token + backend validation via `GET /api/users/me` is the only truth.
- Never assume token is valid without calling `/me`.

---

## Route groups
- `(auth)` — guest-only screens: welcome/login/register/create-password
- `(onboarding)` — authenticated but incomplete profile wizard
- `(tabs)` — authenticated and complete user app

---

## App launch decision tree (Auth Gate)

On app open:

1) Read token from SecureStore.
2) If token missing:
   - Set user/token to null.
   - Navigate with `router.replace("/(auth)/welcome")` (or `/login` per your app).
3) If token exists:
   - Call `GET /api/users/me` with `Authorization: Bearer <token>`.
   - If 401/403:
     - Clear token from SecureStore.
     - Set auth state to unauthenticated.
     - `router.replace("/(auth)/welcome")`
   - If 200:
     - Store user in AuthContext.
     - If `user.onboarding_completed === true`:
       - `router.replace("/(tabs)/profile")` (or default tab)
     - Else:
       - `router.replace("/(onboarding)/name")`

During steps 1–3, render a loading/splash UI to avoid flicker.

---

## Register flow
Desired behavior for v0:

- Register success redirects to login (no auto-login):
  - `router.replace("/(auth)/login")`

---

## Login flow
- On login success:
  - store token
  - `refreshProfile()` using `/me`
  - route:
    - onboarding_completed true -> `/(tabs)`
    - else -> `/(onboarding)/name`

---

## Onboarding completion
Final onboarding step must:

1) Submit full payload via `PATCH /api/users/me` with bearer token.
2) `refreshProfile()` afterwards.
3) If onboarding_completed is true -> route to tabs.
4) If false -> stay in onboarding and show clear message (e.g. photo requirement).

---

## Sign out (mandatory)
From profile/settings:

1) Clear token from SecureStore
2) Reset AuthContext (`token=null`, `user=null`)
3) `router.replace("/(auth)/welcome")`

Rules:
- Do not use `router.back()` for auth transitions.
- Must not allow returning to tabs after sign out.

---

## Acceptance criteria
1) Fresh app install/open -> Welcome/Login.
2) Register -> Login.
3) Login -> onboarding (if incomplete) OR tabs (if complete).
4) Restart app -> routes correctly by token state.
5) Sign out -> Welcome and stays logged out after restart.
6) Invalid token -> forced logout to Welcome.
