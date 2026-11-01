# CareConnect AI — Backend

**"One Platform. Complete Healthcare Journey."**

A secure, modular REST API backend for a healthcare platform covering the full patient journey: AI-assisted triage → doctor discovery → appointment booking → payment → chat/video consultation → prescriptions → pharmacy orders → hospital admission → bed allocation → medical records → emergency handling → admin analytics.

---

## 1. Final Folder Structure

```
backend/
├── config/            # env.js, db.js, constants.js (roles, statuses, enums)
├── controllers/        # thin HTTP layer — no business logic
├── models/             # Mongoose schemas
├── routes/              # Express routers, grouped by domain
├── middleware/         # auth, role-check, validation, rate limiting, uploads, error handling
├── services/            # business logic (appointments, payments, AI, beds, orders, notifications...)
├── validators/         # express-validator chains
├── sockets/              # Socket.IO auth + chat event handlers
├── utils/                 # ApiError, ApiResponse, asyncHandler, tokens, storage abstraction, logger
├── uploads/             # local disk storage (reports/prescriptions/admissions/profiles)
├── seed/seed.js       # demo data seeding script
├── app.js                # Express app (middleware + route mounting)
├── server.js           # HTTP + Socket.IO bootstrap
├── .env.example
└── package.json
```

Business logic never lives in route files — routes call controllers, controllers call services, services touch models.

---

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in real values. **Never commit `.env`.**

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 5000) |
| `NODE_ENV` | `development` \| `production` |
| `CLIENT_URL` | Allowed CORS origin / Socket.IO origin |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Access token signing |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Refresh token signing |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay **test mode** credentials |
| `AI_API_KEY`, `AI_API_URL`, `AI_MODEL` | Server-side AI provider call (never exposed to frontend) |
| `MAX_UPLOAD_MB` | Multer file size limit |
| `VIDEO_PROVIDER_API_KEY` / `VIDEO_PROVIDER_API_SECRET` | Placeholder for a real video provider (Twilio/Daily/Agora) |

---

## 3. Installation

```bash
cd backend
npm install
```

## 4. Database Setup

Run a local MongoDB instance (or point `MONGO_URI` at Atlas), then seed demo data:

```bash
npm run seed
```

## 5. Start Commands

```bash
npm run dev     # nodemon, development
npm start        # production
```

Health check: `GET /health`

---

## 6. Seed / Demo Accounts

All seeded accounts use password: **`Password@123`**

| Role | Email |
|---|---|
| SUPER_ADMIN | superadmin@careconnect.example |
| HOSPITAL_ADMIN | hospitaladmin@careconnect.example |
| PHARMACY_ADMIN | pharmacyadmin@careconnect.example |
| DOCTOR | doctor@careconnect.example |
| PATIENT | patient@careconnect.example |

The seed also creates one hospital (with Cardiology/General Medicine/Pediatrics departments), two rooms with three beds, and four catalog medicines (two requiring a prescription).

---

## 7. API Endpoint Summary

**Auth**: `POST /api/auth/register|login|refresh`, `GET /api/auth/me`, `POST /api/auth/logout`

**Patients** (self-service): `GET/PATCH /api/patients/me`, `GET /api/patients/me/{appointments,records,admissions,orders,prescriptions}`

**Doctors**: `GET /api/doctors`, `GET /api/doctors/:id`, `GET /api/doctors/:id/availability?date=YYYY-MM-DD`, `PATCH /api/doctors/me/availability`, `GET /api/doctors/me/{appointments,patients}`

**Departments**: `GET /api/departments`, `GET /api/departments/:id`

**AI**: `POST /api/ai/assessment|report-analysis|consultation-summary` — always returns `{summary, possibleDepartments, urgencyCategory, followUpQuestions, doctorQuestions, safetyMessage, disclaimer}`

**Appointments**: `POST /api/appointments`, `GET /api/appointments/my|:id`, `PATCH /api/appointments/:id/status|reschedule`, `DELETE /api/appointments/:id`

**Consultations**: `POST /api/consultations`, `GET/PATCH /api/consultations/:id`, `POST /api/consultations/:id/notes`

**Chat**: `POST/GET /api/conversations`, `GET/POST /api/conversations/:id/messages` (+ Socket.IO events — see below)

**Video**: `POST /api/video/session`, `GET /api/video/session/:id`

**Prescriptions**: `POST /api/prescriptions`, `GET /api/prescriptions/:id`

**Admissions**: `POST /api/admissions`, `GET /api/admissions/:id`, `PATCH /api/admissions/:id/status`, `POST /api/admissions/:admissionId/documents`

**Beds/Rooms**: `GET /api/beds/available`, `GET /api/rooms`, `POST /api/beds/allocate`, `PATCH /api/beds/:id/status`, `POST /api/beds/release`

**Emergency**: `POST /api/emergency`, `GET /api/emergency/:id`, `PATCH /api/emergency/:id/status`

**Pharmacy**: `GET /api/medicines`, `GET /api/medicines/:id`, `POST/PATCH/DELETE /api/medicines/:id` (pharmacy/super admin)

**Orders**: `POST /api/orders`, `GET /api/orders/my|:id`, `PATCH /api/orders/:id/status|delivery`

**Payments**: `POST /api/payments/create-order|verify`, `GET /api/payments/my|:id`

**Uploads**: `POST /api/uploads/report`, `POST /api/uploads/profile-image`

**Admin**: `GET /api/admin/dashboard|users|doctors|patients|appointments|admissions|beds|emergency|analytics`

### Socket.IO events
Auth via `socket.handshake.auth.token` (same JWT as REST). Events: `join_conversation`, `send_message`, `typing`, `mark_read`, `receive_message` (server→client), `read_receipt`, `presence:update` / `presence:check`, `notification` (server→client), `emergency:new` (hospital room broadcast).

---

## 8. Frontend Integration Requirements

- Send `Authorization: Bearer <accessToken>` on every authenticated REST call; refresh via `/api/auth/refresh` when it expires.
- Connect Socket.IO with `{ auth: { token: accessToken } }`.
- Razorpay checkout: call `/api/payments/create-order`, open Razorpay Checkout client-side with the returned `razorpayOrder` + `keyId`, then POST the checkout callback fields to `/api/payments/verify`. **Never** compute or trust amounts client-side.
- File uploads use `multipart/form-data` (field names: `report`, `image`, `document`).
- AI endpoints must render the returned `disclaimer`/`safetyMessage` prominently in the UI — do not present AI output as a diagnosis.
- Video: call `/api/video/session` to get a `roomName`, then `/api/video/session/:id` to mint a short-lived `clientToken` for whichever video SDK is wired into `services/videoService.js`.

---

## 9. Known Limitations

- **Emergency coordination is a prototype only** — it does not integrate with any real ambulance/emergency dispatch service; hospital selection is a naive "first active hospital" placeholder, not geospatial routing.
- **Video calling has no real provider wired in** — `services/videoService.js` mints a placeholder HMAC token; plug in Twilio/Daily/Agora's actual SDK for production use.
- **Local disk storage** is used for uploads (`utils/storageService.js`) with a clean interface to swap in S3/GCS; static files under `/uploads` are served without per-file access control — production should route private documents (medical reports, admission docs) through an authenticated download endpoint instead of static serving.
- **AI provider call** in `services/aiService.js` uses raw `https` against the Anthropic Messages API format; swap `AI_API_URL`/`AI_MODEL`/parsing if using a different provider.
- Order stock decrement is not fully atomic against concurrent orders for the same medicine at extreme scale (uses a guarded `findOneAndUpdate`, not a distributed lock).
- No automated test suite is included; see the testing checklist below for manual verification steps.
- Notifications are stored + emitted over the already-connected socket; there's no push-notification (FCM/APNs) integration for offline mobile delivery.
- Rate limiting/CORS/Helmet defaults are reasonable for a demo but should be tuned (stricter CSP, per-route limits) before production.

---

## 10. Testing Checklist

- [ ] Register as PATIENT and DOCTOR; confirm SUPER_ADMIN/HOSPITAL_ADMIN/PHARMACY_ADMIN cannot self-register (`role` is ignored server-side for those).
- [ ] Login, call `/api/auth/me`, refresh token, logout (confirm refresh token is revoked after logout).
- [ ] Book an appointment, then attempt to book the **same doctor/date/startTime** again from a second request — confirm `409 Conflict`.
- [ ] Fire two near-simultaneous booking requests for the same slot (e.g. with `Promise.all`) — confirm only one succeeds (double-booking protection).
- [ ] Create a Razorpay test-mode order, complete checkout in test mode, verify signature — confirm appointment flips to `CONFIRMED`/`PAID` only after **server-side** signature verification (tamper with the signature to confirm rejection).
- [ ] Attempt to order a `requiresPrescription: true` medicine without a `prescriptionId` — confirm rejection; then with a valid prescription belonging to a **different** patient — confirm rejection; then with the correct patient's prescription — confirm success.
- [ ] Allocate a bed to an admission, then attempt to allocate the same bed to a second admission before releasing it — confirm `409 Conflict`.
- [ ] As PATIENT A, attempt to `GET /api/appointments/:id` for PATIENT B's appointment — confirm `403 Forbidden`.
- [ ] As DOCTOR, attempt to view a patient with whom you have no appointment via `/api/doctors/me/patients` — confirm they don't appear.
- [ ] As HOSPITAL_ADMIN for Hospital A, call `/api/admin/appointments` and confirm only Hospital A's data returns (not Hospital B's).
- [ ] Upload a medical report as PATIENT, confirm it appears under `/api/patients/me/records` and is not accessible by an unrelated patient.
- [ ] Connect two Socket.IO clients (patient + doctor) to the same conversation; send a message, confirm delivery, typing indicator, and read receipt all work; disconnect and confirm presence broadcasts.
- [ ] Call `/api/ai/assessment` with sample symptoms; confirm the response is structured JSON with `disclaimer` populated and contains no definitive diagnosis language.
- [ ] Confirm `.env` is never committed and the app fails gracefully (clear warning, not a crash loop) if secrets are missing in development.

---

**Medical AI Safety Note:** Every AI endpoint response includes a `disclaimer` field carrying the platform's standard medical disclaimer. The AI is deliberately constrained (via a fixed system prompt in `services/aiService.js`) to avoid definitive diagnosis or independent prescribing — it summarizes, asks clarifying questions, and routes toward professional evaluation only.
