# CareConnect AI — Frontend

**One Platform. Complete Healthcare Journey.**

A React + Vite frontend built strictly against the existing CareConnect AI backend (Node/Express/MongoDB, Socket.IO, Razorpay). No backend files were modified. Every screen, service call, status value and socket event name is taken directly from the backend's routes, controllers, validators, models and sockets — not guessed.

## Architecture

```
src/
├── components/   common/  layout/  ui/  doctors/  appointments/  chat/  video/
│                 pharmacy/ admission/ medical/ admin/
├── pages/        public/ patient/ doctor/ admin/ pharmacyAdmin/ common/
├── services/     api.js + one file per backend domain (authService, patientService, …)
├── context/      AuthContext, AppContext (toast/confirm), NotificationContext, CartContext
├── hooks/        useAsync, useChatSocket, useWebRTC, usePayment, useDoctorDirectory, …
├── routes/       AppRoutes, ProtectedRoute, RoleRoute
├── constants/    backend enums (statuses, roles) + navigation config
└── utils/        env, tokenStorage, response (ApiResponse unwrapping), format
```

Every API call goes through `services/*.js` — never called directly from a component. Each service file is commented with the exact backend route, method, auth requirement, role restriction, request body and response shape it targets.

## Installation

```bash
npm install
npm run dev       # http://localhost:5173
npm run build      # production build to dist/
npm run preview
npm run check       # static import/export sanity check (no build tool required)
```

## Environment

```
VITE_API_URL=http://localhost:5000
```

No secrets are ever placed in the frontend (no Mongo URI, JWT secret, or Razorpay secret key — only the public Razorpay `keyId` returned by the backend at payment time is used).

## Authentication flow

1. `POST /api/auth/login` or `/register` → `{ user, accessToken, refreshToken }`, stored in `localStorage`.
2. Every request attaches `Authorization: Bearer <accessToken>` (services/api.js interceptor).
3. On a `401` (excluding the auth endpoints themselves), a single-flight `POST /api/auth/refresh` runs and the original request is retried once. If refresh fails, the session is cleared and the user is redirected to `/login`.
4. `GET /api/auth/me` restores the session on reload. `POST /api/auth/logout` revokes the refresh token (tokenVersion bump) server-side.

## Role-based routing

Roles (`PATIENT`, `DOCTOR`, `HOSPITAL_ADMIN`, `PHARMACY_ADMIN`, `SUPER_ADMIN`) come straight from `GET /api/auth/me`. `ProtectedRoute` gates any authenticated area; `RoleRoute` mirrors the backend's `authorize(...roles)` middleware per route group (e.g. `/api/admin/users` and `/api/admin/patients` are SUPER_ADMIN‑only, so `/super-admin/users` and `/super-admin/patients` only render for that role — `/hospital-admin` never links to them).

## Socket.IO integration

`services/socket.js` opens one connection per tab, authenticating with `socket.handshake.auth.token` (the same JWT the backend's `io.use()` middleware expects — copied from `sockets/chatSocket.js`). Event names (`join_conversation`, `send_message`, `typing`, `mark_read`, `presence:check`, `receive_message`, `read_receipt`, `presence:update`, `notification`, `notification:new_message`, `emergency:new`) are used verbatim, not invented. `NotificationContext` and `hooks/useChatSocket` consume these events; both rejoin rooms automatically after reconnect.

## Payment integration (Razorpay)

`POST /api/payments/create-order` → the backend computes the amount and returns `{ payment, razorpayOrder, keyId }` (keyId is Razorpay's **public** key). The frontend loads Razorpay Checkout, opens it with that public key, and on success calls `POST /api/payments/verify` with the three `razorpay_*` fields — the backend verifies the HMAC signature server-side. Only a verified response shows the success screen/receipt; nothing is marked "paid" client-side.

## File upload integration

Reports (`POST /api/uploads/report`), profile images (`POST /api/uploads/profile-image`) and admission documents (`POST /api/admissions/:id/documents`) all use `multipart/form-data` via the shared `FileUploader` component, validated client-side against the same rules as `middleware/upload.js` (jpeg/png/webp/pdf, 10 MB).

## Backend endpoints used

Every endpoint listed in the original backend routes is wired to a service function — see `src/services/*.js` for the full, commented list (auth, patients, doctors, departments, AI, appointments, consultations, prescriptions, chat + sockets, video sessions, admissions, beds, rooms, emergency, medicines, orders, payments, uploads, admin).

## Backend features left integration-ready

These are UI-ready but clearly marked (`IntegrationPending` component) rather than faked, because the backend does not expose them:

- **Notification history** — no `GET /api/notifications`; only live Socket.IO push exists, so notifications shown are limited to the current browser session.
- **Pharmacy-admin order listing** — no `GET /api/orders` for staff (only `/orders/my` for patients); pharmacy admins can open/update a specific order by ID.
- **WebRTC signalling & media provider** — the backend issues a video *session record* only (`roomName` + placeholder `clientToken`); there is no offer/answer/ICE channel or TURN provider. `hooks/useWebRTC` does real camera/mic capture and exposes a `signaling` adapter slot for when a provider is wired in, rather than faking a connected call.
- **Doctor/admin self-registration** — self-registration only creates PATIENT accounts (matches backend behavior); doctor and admin accounts must be provisioned directly (e.g. via the seed script).

## Known limitations

- Doctor/patient display names on appointments, prescriptions, orders, conversations etc. are resolved client-side from the public doctor directory (`GET /api/doctors`) and the patient's own profile, since populated refs on those documents don't include names.
- AI assessments (`POST /api/ai/assessment`, `/ai/report-analysis`) are not persisted by the backend, so they intentionally do not appear on the Care Timeline.

## npm commands

```bash
npm install
npm run dev
npm run build
npm run preview
npm run check
```
