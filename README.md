# Society Maintenance Tracker

A complaint register for an apartment society. Residents raise maintenance issues with a photo
and follow them through to resolved; the office works a queue that puts whatever has waited
longest at the top, posts notices to a board, and gets a one-screen view of what is outstanding.

Every change to a complaint — status, priority, overdue flag — is appended to an immutable
history, so a closed complaint still shows who did what, when, and why.

---

## Contents

- [Demo accounts](#demo-accounts)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [npm scripts](#npm-scripts)
- [How it works](#how-it-works)
- [API reference](#api-reference)
- [Database schema](#database-schema)
- [Project structure](#project-structure)
- [Deployment](#deployment)

---

## Demo accounts

`npm run db:seed` creates one admin, four residents, eight complaints spread across every state
(some deliberately backdated so the overdue rules have something to catch), and three notices.

| Role     | Email                | Password       |
| -------- | -------------------- | -------------- |
| Admin    | `admin@society.test` | `Admin@123`    |
| Resident | `priya@society.test` | `Resident@123` |
| Resident | `rahul@society.test` | `Resident@123` |
| Resident | `anita@society.test` | `Resident@123` |
| Resident | `vikram@society.test`| `Resident@123` |

---

## Quick start

**Requirements:** Node.js 20+ and a PostgreSQL 14+ database. Docker is the quickest way to get
one locally; any hosted Postgres works too.

```bash
# 1. Install
npm install

# 2. Start Postgres (or point DATABASE_URL at your own)
docker run -d --name smt-postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=society_tracker \
  -p 5433:5432 postgres:16-alpine

# 3. Configure
cp .env.example .env
#    Then set AUTH_SECRET to a long random string:
#    openssl rand -base64 32

# 4. Create the schema and seed demo data
npm run db:migrate
npm run db:seed

# 5. Run
npm run dev
```

Open <http://localhost:3000> and sign in with one of the demo accounts above.

### Running with no third-party accounts

The app is fully usable with only a database. The two optional integrations degrade rather than
break:

| Integration | Configured                       | Not configured                                       |
| ----------- | -------------------------------- | ---------------------------------------------------- |
| Email       | Sent via Resend                  | Written to the server console, tagged `[mail:console]` |
| Photos      | Uploaded to Vercel Blob          | Written to `public/uploads` on local disk             |

Admin → Settings shows which mode each one is in. The local photo fallback is for development
only — serverless filesystems are read-only and ephemeral, so `BLOB_READ_WRITE_TOKEN` is
required in production.

---

## Environment variables

See [`.env.example`](.env.example) for the annotated version.

| Variable                  | Required | Default                  | Purpose                                                                                       |
| ------------------------- | -------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | **Yes**  | —                        | PostgreSQL connection string. Use the pooled string on serverless hosts.                        |
| `AUTH_SECRET`             | **Yes**  | —                        | HMAC key for session JWTs. Must be ≥ 32 characters. `openssl rand -base64 32`.                  |
| `APP_URL`                 | No       | `http://localhost:3000`  | Public base URL used to build links inside emails. Falls back to `VERCEL_URL` when deployed.    |
| `OVERDUE_THRESHOLD_DAYS`  | No       | `5`                      | Seeds the overdue threshold on first run. After that it is edited in Admin → Settings.          |
| `RESEND_API_KEY`          | No       | *(empty)*                | Resend API key. Blank means emails are logged instead of sent.                                  |
| `MAIL_FROM`               | No       | `onboarding@resend.dev`  | Verified sender. Resend's sandbox sender only delivers to the account owner's own address.      |
| `BLOB_READ_WRITE_TOKEN`   | No       | *(empty)*                | Vercel Blob token. Blank means photos go to local disk. **Required in production.**             |
| `SEED_ADMIN_EMAIL`        | No       | `admin@society.test`     | Admin account created by the seed.                                                              |
| `SEED_ADMIN_PASSWORD`     | No       | `Admin@123`              | Password for that account. **Change this before any real deployment.**                          |

---

## npm scripts

| Script               | What it does                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `npm run dev`        | Development server on port 3000                                     |
| `npm run build`      | Generates the Prisma client, then builds for production             |
| `npm start`          | Serves the production build                                         |
| `npm run typecheck`  | `tsc --noEmit`                                                      |
| `npm run lint`       | ESLint                                                              |
| `npm run db:migrate` | Applies migrations in development, creating one if the schema moved |
| `npm run db:deploy`  | Applies existing migrations — this is the production command        |
| `npm run db:seed`    | Seeds demo data (safe to re-run; skips if complaints already exist) |
| `npm run db:studio`  | Prisma Studio, a browser UI over the database                       |
| `npm run db:reset`   | Drops, re-migrates and re-seeds. Destroys all data.                 |

---

## How it works

Four decisions shape most of the code. The full reasoning is in
[`docs/system-design.md`](docs/system-design.md).

**Complaint history is an append-only log.** The `Complaint` row holds current state; every
change writes a `ComplaintEvent` describing the transition. The event and the row are written in
one transaction, so state and history cannot drift apart. Actor name and role are denormalised
onto the event, so history stays readable even if the account is later removed.

**Overdue is derived, never stored.** A complaint is overdue when it is unresolved and older
than the configured threshold. Computing that at read time means changing the threshold
re-evaluates the whole register instantly, with no backfill job and no nightly cron to keep
alive. The one thing that *is* stored is `overdueFlaggedAt` — an explicit admin flag, which is a
decision rather than a calculation.

**Photos travel with the complaint.** `POST /api/complaints` accepts `multipart/form-data`, so
the row and its photo are created in one request. There is no window where a complaint points at
an upload that never finished.

**Email never blocks a state change.** Notifications are dispatched after the transaction commits
and their failures are logged, not thrown. A mail outage must not roll back a status update or
return a 500 to the admin who made it.

### Where the API is used

Writes from the browser all go through the REST API documented below. Page loads read through
the same service layer the API routes call (`lib/complaints.ts`, `lib/dashboard.ts`) directly on
the server, which skips an internal HTTP round trip. Authorisation lives in that shared layer,
so both paths enforce identical rules.

---

## API reference

All responses are JSON. Authentication is a signed JWT in an `httpOnly`, `SameSite=Lax` cookie
(`smt_session`), set on login and register.

Errors use a consistent shape. Validation failures add a `details` map keyed by field name:

```json
{ "error": "Validation failed", "details": { "title": "title must be at least 4 characters" } }
```

| Status | Meaning                                                            |
| ------ | ------------------------------------------------------------------ |
| `400`  | Validation failed — see `details`                                   |
| `401`  | No valid session                                                    |
| `403`  | Signed in, but not allowed (resident hitting an admin route, or another resident's complaint) |
| `404`  | Not found                                                           |
| `409`  | Conflict — an invalid lifecycle transition, or a duplicate email     |

### Authentication

<details open>
<summary><code>POST /api/auth/register</code> — create a resident account</summary>

Public. Always creates a `RESIDENT`; admin accounts are seeded, never self-registered.

```jsonc
// Request
{ "name": "Priya Nair", "email": "priya@society.test", "password": "Resident@123",
  "flatNumber": "A-204", "phone": "9876543210" }   // flatNumber, phone optional

// 201 Created — also sets the session cookie
{ "user": { "id": "…", "email": "…", "name": "…", "role": "RESIDENT", "flatNumber": "A-204" } }
```
</details>

<details>
<summary><code>POST /api/auth/login</code> — exchange credentials for a session</summary>

```jsonc
// Request
{ "email": "admin@society.test", "password": "Admin@123" }

// 200 OK — sets the session cookie
{ "user": { "id": "…", "email": "…", "name": "…", "role": "ADMIN", "flatNumber": "Office" } }
```

Returns `401 Incorrect email or password` for both an unknown address and a wrong password, so
the response does not reveal which addresses are registered.
</details>

<details>
<summary><code>POST /api/auth/logout</code> · <code>GET /api/auth/me</code></summary>

`POST /api/auth/logout` clears the cookie and returns `{ "ok": true }`.

`GET /api/auth/me` returns `{ "user": … }`, or `{ "user": null }` when anonymous. The user is
re-read from the database rather than trusted from the token, so a role change takes effect
immediately instead of at token expiry.
</details>

### Complaints

<details open>
<summary><code>GET /api/complaints</code> — list complaints</summary>

Requires a session. Residents always receive only their own complaints; the filters below are
effectively the admin view.

| Query param | Values                                              |
| ----------- | --------------------------------------------------- |
| `status`    | `OPEN` · `IN_PROGRESS` · `RESOLVED`                 |
| `category`  | `PLUMBING` · `ELECTRICAL` · `LIFT` · `HOUSEKEEPING` · `SECURITY` · `PARKING` · `COMMON_AREA` · `OTHER` |
| `priority`  | `LOW` · `MEDIUM` · `HIGH`                           |
| `from`, `to`| Date or ISO timestamp, filtering on when it was raised |
| `overdue`   | `true` to return only overdue complaints            |
| `search`    | Case-insensitive match on title or description      |
| `page`      | 1-based, default `1`                                |
| `pageSize`  | 1–100, default `20`                                 |

```jsonc
// 200 OK
{
  "complaints": [ /* complaint objects, see below */ ],
  "page": 1, "pageSize": 20, "total": 8, "totalPages": 1,
  "overdueThresholdDays": 5
}
```

For admins the list is ordered **overdue first, then by priority, then oldest first**.

**The complaint object:**

```jsonc
{
  "id": "cmt5nsf3j000oupzshblolc2q",
  "title": "Kitchen tap leaking continuously",
  "description": "The kitchen tap in A-204 has been dripping since Monday…",
  "category": "PLUMBING",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "photoUrl": "https://…/complaints/66937fa4….png",   // or null
  "isClosed": false,
  "createdAt": "2026-08-11T09:14:02.113Z",
  "updatedAt": "2026-08-13T05:02:44.900Z",
  "resolvedAt": null,
  "overdueFlaggedAt": "2026-08-14T09:14:02.113Z",      // set only by an explicit admin flag
  "overdue": {
    "ageDays": 12,        // whole days since raised (or until resolved)
    "dueAt": "2026-08-16T09:14:02.113Z",
    "isBreached": true,   // aged past the threshold
    "isFlagged": true,    // an admin flagged it by hand
    "isOverdue": true,    // either of the above
    "daysOverdue": 7
  },
  "resident": { "id": "…", "name": "Priya Nair", "email": "…", "flatNumber": "A-204" },
  "history": [ /* only on the single-complaint endpoint */ ]
}
```
</details>

<details>
<summary><code>POST /api/complaints</code> — raise a complaint</summary>

Requires a session. Accepts **either** content type.

`multipart/form-data` — fields `title`, `description`, `category`, and an optional `photo` file
(JPEG, PNG, WebP or HEIC, max 5 MB):

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/complaints \
  -F "title=Bathroom ceiling dripping after rain" \
  -F "description=Water comes through the ceiling in A-204 whenever it rains hard." \
  -F "category=PLUMBING" \
  -F "photo=@leak.png;type=image/png"
```

`application/json` — same fields, with `photoUrl` instead of a file:

```jsonc
{ "title": "…", "description": "…", "category": "PLUMBING", "photoUrl": null }
```

Returns `201` with `{ "complaint": … }`. New complaints start `OPEN` / `MEDIUM` and get a
`CREATED` history event.
</details>

<details>
<summary><code>GET /api/complaints/:id</code> — one complaint with its full history</summary>

Requires a session. Residents may only read their own (`403` otherwise); admins may read any.
The response includes a `history` array, oldest first:

```jsonc
{
  "id": "…", "type": "STATUS_CHANGED",
  "fromStatus": "OPEN", "toStatus": "IN_PROGRESS",
  "fromPriority": null, "toPriority": null,
  "note": "Plumber scheduled for Thursday morning.",
  "actor": { "id": "…", "name": "Society Admin", "role": "ADMIN" },
  "createdAt": "2026-08-13T05:02:44.900Z"
}
```

Event types: `CREATED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `OVERDUE_FLAGGED`,
`OVERDUE_CLEARED`, `NOTE_ADDED`.
</details>

<details>
<summary><code>PATCH /api/complaints/:id/status</code> — move along the lifecycle (admin)</summary>

```jsonc
// Request
{ "status": "IN_PROGRESS", "note": "Plumber scheduled for Thursday morning." }  // note optional
```

Allowed transitions:

```
OPEN ──▶ IN_PROGRESS ──▶ RESOLVED   (terminal)
  └──────────────────────▶ RESOLVED
         IN_PROGRESS ──▶ OPEN       (correction)
```

`RESOLVED` is terminal — the assignment states a resolved complaint is closed — so any
transition out of it returns `409`. Setting the status it already has also returns `409`.
Resolving stamps `resolvedAt` and clears any overdue flag.

On success the resident is emailed, and the note is included in that email.
</details>

<details>
<summary><code>PATCH /api/complaints/:id/priority</code> — triage (admin)</summary>

```jsonc
{ "priority": "HIGH" }   // LOW | MEDIUM | HIGH
```

Recorded in history but deliberately not emailed — priority is internal triage, not
resident-facing progress. Returns `409` on a resolved complaint.
</details>

<details>
<summary><code>PATCH /api/complaints/:id/overdue</code> — raise or clear the overdue flag (admin)</summary>

```jsonc
{ "flagged": true, "note": "Chased twice, no response." }   // note optional
```

This is the *explicit* flag only. Threshold-derived overdue needs no endpoint because it is
recomputed on every read. Returns `409` on a resolved complaint, or if the flag is already in the
requested state.
</details>

### Notices

<details open>
<summary><code>GET /api/notices</code> · <code>POST /api/notices</code></summary>

`GET` requires a session and is readable by everyone. Ordered `isImportant desc, createdAt desc`,
so important notices are pinned to the top. Optional `limit` (1–100, default 50).

`POST` requires admin:

```jsonc
{ "title": "Water tank cleaning on Sunday", "body": "…", "isImportant": true }
```

Marking a notice important pins it **and** emails every resident. Returns `201`.
</details>

<details>
<summary><code>PATCH /api/notices/:id</code> · <code>DELETE /api/notices/:id</code></summary>

Both require admin. `PATCH` accepts any of `title`, `body`, `isImportant`; omitted fields are
left unchanged. Residents are emailed only when a notice *becomes* important, so re-saving an
already-important notice does not re-notify the society.

`DELETE` removes the notice and returns `{ "ok": true }`.
</details>

### Dashboard and settings

<details open>
<summary><code>GET /api/dashboard</code> — admin summary</summary>

```jsonc
{
  "overdueThresholdDays": 5,
  "totals": { "all": 9, "open": 3, "inProgress": 3, "resolved": 3, "overdue": 3, "unresolved": 6 },
  "byStatus":   [ { "status": "OPEN", "count": 3 }, … ],
  "byCategory": [ { "category": "PLUMBING", "count": 2, "open": 2 }, … ],
  "byPriority": [ { "priority": "HIGH", "count": 3 }, … ],
  "averageResolutionDays": 4,          // null when nothing is resolved yet
  "trend": [ { "date": "2026-08-10", "raised": 0, "resolved": 0 }, … ],   // last 14 days
  "oldestOverdue": [ { "id": "…", "title": "…", "daysOverdue": 7, "priority": "HIGH",
                       "residentName": "Priya Nair" } ]
}
```
</details>

<details>
<summary><code>GET /api/settings</code> · <code>PATCH /api/settings</code></summary>

`GET` is readable by any signed-in user; `PATCH` requires admin.

```jsonc
{ "overdueThresholdDays": 7 }   // 1–365
```

Because overdue is derived at read time, saving a new threshold re-evaluates every existing
complaint immediately.
</details>

---

## Database schema

PostgreSQL via Prisma. The full definition is [`prisma/schema.prisma`](prisma/schema.prisma);
migrations are in [`prisma/migrations/`](prisma/migrations).

```
┌─────────────────────┐
│ User                │
│─────────────────────│
│ id            PK    │
│ email         UNIQUE│
│ passwordHash        │
│ name                │
│ flatNumber   NULL   │
│ phone        NULL   │
│ role         ENUM   │  RESIDENT | ADMIN
│ createdAt           │
└──────────┬──────────┘
           │ 1
           │
           │ N                          ┌──────────────────────────┐
┌──────────▼──────────────────┐   1   N │ ComplaintEvent           │
│ Complaint                   ├─────────▶│──────────────────────────│
│─────────────────────────────│         │ id             PK        │
│ id               PK         │         │ complaintId    FK cascade│
│ residentId       FK cascade │         │ type           ENUM      │
│ category         ENUM       │         │ fromStatus     NULL      │
│ title                       │         │ toStatus       NULL      │
│ description                 │         │ fromPriority   NULL      │
│ photoUrl         NULL       │         │ toPriority     NULL      │
│ status           ENUM       │         │ note           NULL      │
│ priority         ENUM       │         │ actorId        FK setnull│
│ overdueFlaggedAt NULL       │         │ actorName                │
│ createdAt                   │         │ actorRole      ENUM      │
│ updatedAt                   │         │ createdAt                │
│ resolvedAt       NULL       │         └──────────────────────────┘
└─────────────────────────────┘
                                        ┌──────────────────────────┐
┌─────────────────────┐                 │ Setting                  │
│ Notice              │                 │──────────────────────────│
│─────────────────────│                 │ key            PK        │
│ id            PK    │                 │ value                    │
│ title               │                 │ updatedAt                │
│ body                │                 └──────────────────────────┘
│ isImportant   BOOL  │                   overdue_threshold_days
│ authorId      FK ⤳  │  setnull
│ createdAt           │
│ updatedAt           │
└─────────────────────┘
```

### Enums

| Enum                 | Values                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `Role`               | `RESIDENT`, `ADMIN`                                                                           |
| `ComplaintStatus`    | `OPEN`, `IN_PROGRESS`, `RESOLVED`                                                             |
| `Priority`           | `LOW`, `MEDIUM`, `HIGH`                                                                       |
| `ComplaintCategory`  | `PLUMBING`, `ELECTRICAL`, `LIFT`, `HOUSEKEEPING`, `SECURITY`, `PARKING`, `COMMON_AREA`, `OTHER` |
| `ComplaintEventType` | `CREATED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `OVERDUE_FLAGGED`, `OVERDUE_CLEARED`, `NOTE_ADDED` |

### Indexes

| Table            | Index                      | Serves                                              |
| ---------------- | -------------------------- | --------------------------------------------------- |
| `User`           | `email` (unique)           | Login lookup                                        |
| `User`           | `role`                     | Fetching all residents to email                     |
| `Complaint`      | `(status, createdAt)`      | Status-filtered lists and dashboard counts          |
| `Complaint`      | `category`                 | Category filter and grouping                        |
| `Complaint`      | `(residentId, createdAt)`  | A resident's own list — the most common query       |
| `Complaint`      | `createdAt`                | Date-range filters and the 14-day trend             |
| `ComplaintEvent` | `(complaintId, createdAt)` | Loading one complaint's history in order            |
| `Notice`         | `(isImportant, createdAt)` | The pinned-first notice board ordering              |

### Deletion behaviour

Deleting a user cascades to their complaints, and a complaint cascades to its events — a removed
resident leaves no orphaned rows. Event `actorId` and notice `authorId` are `SET NULL` instead,
because history must survive the removal of the person who acted; `actorName` and `actorRole` are
denormalised onto each event so the timeline still reads correctly afterwards.

---

## Project structure

```
app/
  (auth)/            login, register — split layout, redirects if already signed in
  (app)/             everything behind a session
    complaints/      resident register, new complaint, shared detail page
    notices/         the notice board
    admin/           dashboard, queue, notice management, settings
  api/               the REST API — one route file per endpoint
components/          UI primitives, badges, charts, forms
lib/
  auth.ts            password hashing, session JWTs, requireUser / requireAdmin
  complaints.ts      complaint domain logic — every state change goes through here
  dashboard.ts       dashboard aggregation
  domain.ts          shared enums, labels, and the allowed status transitions
  overdue.ts         derived overdue state and the admin queue ordering
  storage.ts         photo upload — Vercel Blob, or local disk as a fallback
  mail.ts            Resend, or console output as a fallback
  serialize.ts       row → API shape, in one place
  validate.ts        small hand-rolled validators
prisma/
  schema.prisma      the schema
  migrations/        migration history
  seed.ts            demo society
docs/
  system-design.md   the write-up
```

### Dependencies

Kept deliberately small, per the submission guidelines:

`next` · `react` · `react-dom` · `@prisma/client` · `jose` (JWT) · `bcryptjs` (password hashing) ·
`@vercel/blob` (photos) · `resend` (email) · `server-only`

Dev: `prisma`, `tsx`, `typescript`, `tailwindcss`, `eslint`. There is no validation library, no
UI component library, and no charting library — request validation, the design system, and the
dashboard charts are all hand-written.

---

## Deployment

Any host that runs Node 20 and can reach a Postgres database works. Vercel is the shortest path.

**1. Provision a database.** [Neon](https://neon.tech), [Supabase](https://supabase.com) and
Railway all have a free tier. Copy the **pooled** connection string.

**2. Push to GitHub** on the `main` branch, then import the repo at
[vercel.com/new](https://vercel.com/new).

**3. Set environment variables** in the Vercel project (Settings → Environment Variables):

| Variable                | Value                                              |
| ----------------------- | -------------------------------------------------- |
| `DATABASE_URL`          | The pooled Postgres connection string               |
| `AUTH_SECRET`           | `openssl rand -base64 32`                           |
| `BLOB_READ_WRITE_TOKEN` | From Vercel → Storage → Blob → create a store       |
| `RESEND_API_KEY`        | From [resend.com](https://resend.com) → API Keys    |
| `MAIL_FROM`             | `Society Maintenance <onboarding@resend.dev>`       |
| `SEED_ADMIN_PASSWORD`   | Something other than the default                    |

`APP_URL` can be left unset — it falls back to the Vercel deployment URL.

**4. Apply migrations against the production database**, from your machine:

```bash
DATABASE_URL="<production-url>" npm run db:deploy
DATABASE_URL="<production-url>" npm run db:seed   # optional: demo data
```

**5. Deploy.** `npm run build` runs `prisma generate` first, so no extra build command is needed.

### Notes

- **Resend's sandbox sender** (`onboarding@resend.dev`) only delivers to the email address that
  owns the Resend account. To email real residents, verify a domain in Resend and set `MAIL_FROM`
  to an address on it.
- **`BLOB_READ_WRITE_TOKEN` is required in production.** Without it, uploads fall back to the
  local filesystem, which is read-only on serverless platforms.
- **Change `SEED_ADMIN_PASSWORD`** before seeding anything public.
