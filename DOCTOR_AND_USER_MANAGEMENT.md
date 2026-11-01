# CareConnect AI — Doctor Management & User Management

What was added on top of the existing project (nothing was rebuilt or removed), how to run it, and what is and is not verified.

## 1. What you get

**Hospital Admin → Doctors** (existing page, extended): *Add Doctor* (5-step form), View details, Edit, Activate / Deactivate, search, filters (department, specialization, status, verification, account), pagination, document upload/download, verification decision, resend invitation.
**Super Admin → Users** (existing page, extended): View, Edit, Activate / Deactivate, Delete (typed-email confirmation, *anonymises* rather than erases), search, role + status filters, pagination.
**Patient side**: only active, bookable, verified doctors are listed; modes + verified badge on the card; booking limited to the doctor's modes; slot rules enforced on the server.
**New public page** `/accept-invite?token=…` where an invited doctor sets their own password.

## 2. Decisions you should know about

| Topic | Decision |
|---|---|
| Doctor onboarding | No passwords are ever set by an admin. Creating a doctor makes a `PENDING_VERIFICATION` user + `INACTIVE` doctor and returns a **one-time invitation link** (72 h, only its SHA-256 hash is stored). **No mail provider exists in the project**, so the admin must send the link themselves (`services/doctorAdminService.js → issueInvitation` is the single place to plug in email). |
| Verification | Never set by create/edit payloads. A separate endpoint records a decision (`VERIFIED / REJECTED / PENDING`, who, when, notes). `VERIFIED` is refused unless the category's required documents are uploaded and registration number/council/state exist. Editing registration/category/qualification, or deleting a required document, sends a verified doctor back to `PENDING`. |
| Bookable | `status=ACTIVE` **and** booking enabled **and** (policy `required`) `VERIFIED`. Policy via `DOCTOR_VERIFICATION_POLICY=required|optional`. |
| Documents | Stored in `careconnect-backend/private_uploads/` (not under the public `/uploads`), validated by MIME **and** file signature, streamed only through an authenticated, hospital-checked route; every download is audit-logged. |
| Deletion | Safe deletion = **anonymisation**: login destroyed, name/email/phone replaced, patient address/DOB/emergency contact cleared; appointments, payments, orders, prescriptions, records, admissions are **kept**. Retention periods are a hospital policy decision — adjust in `services/userAdminService.js → deleteUser`. |
| Role changes | Super Admin only, and only between staff roles (Hospital/Pharmacy/Super Admin). Patient/Doctor roles cannot be flipped because they own clinical profiles. |
| Existing appointments of a deactivated doctor | **Kept untouched** (no auto-cancel, because refunds/notifications are a business process). The API/UI report how many upcoming appointments are affected. |
| Transactions | Used when MongoDB supports them (Atlas / replica set). On a standalone `mongod` they are skipped and doctor creation compensates (deletes the new User if the Doctor insert fails). |

### Existing behaviour I changed (please read)
1. **Self-registration can only create PATIENT accounts.** Previously a client could send `role: "DOCTOR"` and get a doctor-role account with no profile. Your UI never offered it.
2. **Hospital admin with no `hospitalId` saw all hospitals' data** in the admin list endpoints (`scopeToHospital` fell through). Now they see nothing.
3. **Public doctor endpoints no longer return doctor email/phone** (they used to populate them), nor registration numbers/documents. `GET /api/doctors/:id` returns 404 for non-bookable doctors unless you are that doctor or an admin of their hospital.
4. **Appointment ownership check bug fixed**: `GET /api/appointments/:id` returned 403 to the patient who owned it because the populated document was compared as a string.
5. **Unexpected 500 errors no longer echo internal messages** to clients (they are logged).
6. Login now checks the password *before* reporting account state, and records `lastLoginAt`.
7. Booking/reschedule now validate against the doctor's real schedule (grid, breaks, leave dates, daily cap, past dates, offered mode); `endTime` is computed server-side. Appointment creation uses the new optional-transaction helper.
8. The frontend no longer pre-escapes the specialization filter (the server escapes it now).

## 3. Data model changes (additive, existing records stay valid)
`User`: `emailVerified, lastLoginAt, createdBy, inviteTokenHash, inviteExpiresAt, deletedAt`, status `DELETED`.
`Doctor`: `professionalCategory, additionalSpecializations, languages, registration{number,council,state}, verification{status,notes,verifiedBy,verifiedAt,method}, documents[], profilePhotoUrl, dateOfBirth, gender, address, consultationRoom, consultationModes, appointmentDurationMinutes, followUpFee, emergencyAvailable, onlineConsultationAvailable, bookingEnabled, maxAppointmentsPerDay, leaveDates, createdBy`; schedule windows gain `breakStartTime/breakEndTime`. Sensitive paths are `select:false`, so no existing `.populate('doctorId')` leaks them. Unique partial index on (council, state, number).
`Appointment`: consultation type `AUDIO` added. New collection `AuditLog`.

### Migration (existing database)
```bash
cd careconnect-backend
node seed/migrateDoctors.js              # reports doctors with no verification record (changes nothing)
node seed/migrateDoctors.js --grandfather  # OPTIONAL: marks them VERIFIED (method MIGRATION) so they stay bookable
```
With the default policy `required`, existing doctors **disappear from the patient directory until verified or grandfathered**. Nothing is deleted or overwritten. New indexes are created automatically by Mongoose on start.

## 4. API (all under `/api`)
| Method & path | Who | Purpose |
|---|---|---|
| `GET /doctors/meta/options` | public | categories, 45 specializations, department suggestions, languages |
| `GET /doctors/me` | doctor | own profile (even if not yet listed) |
| `GET /admin/doctor-form-context` | hospital/super admin | hospital(s) + departments for the form |
| `GET/POST /admin/doctors` · `GET/PATCH /admin/doctors/:id` | hospital admin (own hospital) / super admin | list, create, view, edit |
| `PATCH /admin/doctors/:id/status` | same | ACTIVE / INACTIVE / ON_LEAVE |
| `POST /admin/doctors/:id/invite` | same | new invitation link |
| `PATCH /admin/doctors/:id/verification` | same | record decision |
| `POST/GET/DELETE /admin/doctors/:id/documents[/:docId]` | same | private documents |
| `POST /admin/departments` | same | a hospital creates only the departments it offers |
| `GET /admin/users`, `GET/PATCH/DELETE /admin/users/:id`, `PATCH /admin/users/:id/status` | **super admin** | user management |
| `GET /admin/audit-logs` | super admin | audit trail |
| `GET /auth/invitations/:token`, `POST /auth/accept-invitation` | public (rate-limited) | doctor onboarding |

Audit actions: `DOCTOR_CREATED/UPDATED/STATUS_CHANGED/VERIFICATION_RECORDED/DOCUMENT_UPLOADED/DOCUMENT_VIEWED/DOCUMENT_DELETED/INVITE_ISSUED`, `DEPARTMENT_CREATED`, `USER_UPDATED/ROLE_CHANGED/STATUS_CHANGED/DELETED` (secrets are stripped before writing).

## 5. Run it
```bash
# backend
cd careconnect-backend && cp .env.example .env   # fill MONGO_URI, JWT secrets, … (never commit .env)
npm install && npm run seed && npm run dev
# frontend
cd ../careconnect-frontend && cp .env.example .env && npm install && npm run dev
```
Seed logins (password `Password@123`): `hospitaladmin@…`, `superadmin@…`, `doctor@…`, `patient@…` (`@careconnect.example`).

## 6. Tests
```bash
cd careconnect-backend
MONGO_URI=mongodb://127.0.0.1:27017/careconnect_test JWT_SECRET=x JWT_REFRESH_SECRET=y npm test
```
The suite wipes the target database, so it **refuses to run unless the DB name contains "test"**. It covers Tests A–F from the brief (add/edit, hospital isolation, deactivation, super-admin management incl. last-super-admin and self-protection, patient directory + booking + double-booking) plus privacy/escalation checks.

Manual walk-through: log in as Hospital Admin → Doctors → Add Doctor → copy the invitation link → open it in a private window and set a password → back as admin: View → upload both certificates → *Mark verified* → *Activate* → log in as patient → the doctor appears → book a slot → try the same slot again (rejected). Then as Super Admin → Users: edit, deactivate/reactivate, delete (type the email).
