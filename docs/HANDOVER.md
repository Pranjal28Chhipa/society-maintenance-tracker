# Handover — deploying the Society Maintenance Tracker

**Read this before touching anything.** It covers what the README does not: the exact state the
repository was handed over in, two code paths that have never executed, and the deployment
landmines that are not obvious from the source.

If you are an AI agent picking this up: the tasks that need a browser login or an account signup
are marked **ASK THE USER**. Do not attempt those yourself — do not create accounts, and do not
enter passwords, API keys, or payment details anywhere. Ask the user to run those steps and paste
back the resulting value.

---

## 1. What this is

A complaint register for an apartment society, built as a college/interview assignment. Residents
raise photo-backed maintenance complaints and track them to resolved; an admin works an
overdue-first queue, posts notices, and sees a dashboard.

**Stack:** Next.js 16.3.2 (App Router, route handlers as the REST API) · React 19 · PostgreSQL via
Prisma 6.19.3 · Tailwind v4 · JWT sessions in httpOnly cookies · Vercel Blob for photos · Resend
for email.

**The assignment's own constraints** (from the submission guidelines) — these are graded, so do
not violate them:

- Repository must be **public**, branch must be **main**
- No `node_modules`, no `.env`, no build artifacts (`.next/`, `dist/`), no `.vscode/` or `.idea/`
- **"No extra modules or package files should be added. Keep dependencies minimal."**

---

## 2. State at handover

| | |
| --- | --- |
| Commit | `093deb9` — "Build the Society Maintenance Tracker" |
| Branch | `main` |
| Working tree | Clean, nothing uncommitted |
| Remote | **None configured. Never pushed anywhere.** |
| Hosted | **Not deployed.** No Vercel project exists. |
| Built with | Node v20.18.3, npm 11.2.0, on macOS |

### Verified working

`npm run build`, `npx tsc --noEmit` and `npm run lint` all pass clean. Over the live API on
localhost: registration, login, wrong-password 401, role scoping (a resident gets 403 on another
resident's complaint), the full status lifecycle including `RESOLVED` being terminal, priority
changes, the overdue flag, all list filters, multipart photo upload plus rejection of a bad file
type, notice posting and pinning, the dashboard, and the settings threshold.

### ⚠️ Never executed — the important part

Two code paths compile and typecheck but **have never run even once**:

1. **Resend email sending** (`lib/mail.ts`). All testing used the console fallback, because no
   `RESEND_API_KEY` was set. The message content and structure are correct; the live API call is
   unproven.
2. **Vercel Blob upload** (`lib/storage.ts`). All testing used the local-disk fallback. Every
   photo so far was written to `public/uploads`.

**Both run for the first time on your deployment.** Section 7 tells you how to exercise them
deliberately rather than discovering a failure later.

There is also **no automated test suite**. Verification was manual API calls. Do not report the
project as "tested" — report it as "manually verified, no test suite."

---

## 3. Hard rules

**Do not:**

- **Add any npm dependency.** The assignment grades dependency minimalism. If something seems to
  need a package, it almost certainly does not — the validation, design system and dashboard
  charts are all hand-written on purpose.
- **Commit `.env`.** `.gitignore` has `.env*` with a deliberate `!.env.example` exception. Keep
  that shape.
- **Run `prisma migrate dev` against production.** It can drop data. Production uses
  `npm run db:deploy` (`prisma migrate deploy`), which only applies existing migrations.
- **Edit `prisma/schema.prisma` or hand-write SQL in `prisma/migrations/`.** The migration
  `20260823101859_init` is already correct and applied.
- **Re-add `AGENTS.md` or `CLAUDE.md`.** `next.config.ts` sets `agentRules: false` on purpose —
  the guidelines ask for only the files the project needs. If they reappear, delete them.
- **Change `SEED_ADMIN_PASSWORD` to something weak, or leave the default on a public URL.**

---

## 4. Prerequisites

- Node **≥ 20.9.0** (enforced by `engines` in `package.json`; Next 16 requires it)
- git
- A PostgreSQL 14+ database — Neon's free tier is the path of least resistance
- Accounts: GitHub, Vercel, Neon (or another Postgres host), Resend

**ASK THE USER** to complete any account signup and any interactive login (`gh auth login`,
`vercel login`, `npx neonctl auth`). These open a browser and need their credentials.

---

## 5. Deployment

### Step 1 — Get the code onto the new machine

```bash
git clone <repo-url> society-maintenance-tracker   # if already pushed
cd society-maintenance-tracker
npm install
```

If it has **not** been pushed yet, the user must create a **public** repo on GitHub named
`society-maintenance-tracker`, then:

```bash
git remote add origin https://github.com/<username>/society-maintenance-tracker.git
git push -u origin main
```

**ASK THE USER** for the repo URL and let them handle GitHub authentication.

Confirm the push is clean:

```bash
git ls-files | grep -E "node_modules|\.next/|^\.env$|public/uploads" && echo "PROBLEM" || echo "clean"
```

### Step 2 — Provision the database

**ASK THE USER** to create a project at [neon.tech](https://neon.tech) and copy **both**
connection strings from the dashboard:

- the **pooled** one (host contains `-pooler`) → this becomes `DATABASE_URL`
- the **direct** one (no `-pooler`) → used only for migrations, see the landmine in §6

### Step 3 — Apply migrations and seed

Run from the machine that has the repo, using the **direct** URL:

```bash
DATABASE_URL="<DIRECT-url>" npm run db:deploy
DATABASE_URL="<DIRECT-url>" npm run db:seed      # optional but recommended for a demo
```

`db:seed` creates 1 admin, 4 residents, 8 complaints across every state (some backdated so the
overdue logic visibly has something to catch), and 3 notices. It is safe to re-run — it upserts
users and skips complaints if any already exist.

### Step 4 — Create the Vercel project

**ASK THE USER** to import the GitHub repo at [vercel.com/new](https://vercel.com/new). Framework
detection and build settings need no changes — `npm run build` already runs `prisma generate`
first.

### Step 5 — Environment variables

Set these in Vercel → Settings → Environment Variables, for **all** environments:

| Variable | Value | Required |
| --- | --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string | **Yes** |
| `AUTH_SECRET` | `openssl rand -base64 32` — must be ≥ 32 chars | **Yes** |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob → create store | **Yes in production** |
| `RESEND_API_KEY` | resend.com → API Keys | For real email |
| `MAIL_FROM` | `Society Maintenance <onboarding@resend.dev>` | With Resend |
| `SEED_ADMIN_PASSWORD` | Something other than `Admin@123` | Before seeding |

`APP_URL` can be omitted — it falls back to the Vercel deployment URL for links inside emails.
`OVERDUE_THRESHOLD_DAYS` can be omitted — it only seeds the initial value, which is then edited
in the app at Admin → Settings.

**ASK THE USER** to generate and paste `AUTH_SECRET` and to fetch the API tokens. Do not create
these accounts or handle the raw secrets yourself.

### Step 6 — Deploy

Trigger a deployment (a push to `main` does it, or Redeploy in the dashboard).

---

## 6. Landmines

**Prisma migrations fail on a pooled connection.** Neon's pooled endpoint runs PgBouncer in
transaction mode, which does not support the session-level advisory locks Prisma Migrate needs.
Symptom: `db:deploy` hangs or errors about advisory locks / prepared statements. Fix: run
migrations against the **direct** URL (§5 step 3) while the app runtime keeps the pooled one. This
is why the two are listed separately.

**`BLOB_READ_WRITE_TOKEN` is genuinely required in production.** Without it, `lib/storage.ts`
silently falls back to writing into `public/uploads` — which on Vercel is a read-only, ephemeral
filesystem. Photo upload will fail at runtime, or appear to succeed and then 404. This will not
show up at build time.

**Resend's sandbox sender only delivers to one address.** `onboarding@resend.dev` can only send to
the email address that owns the Resend account. Emails to `priya@society.test` and the other
seeded residents will be **rejected**, and the rejection is logged, not thrown — so the app looks
fine while nothing arrives. To email real addresses, verify a domain in Resend and set `MAIL_FROM`
to an address on it. For a demo, register a resident using the account owner's real email and test
with that.

**`AUTH_SECRET` shorter than 32 characters throws at runtime, not build time.** The app builds
successfully and then every request fails. Check the length.

**Emails never block a state change by design.** `lib/mail.ts` swallows and logs its own failures.
If mail is misconfigured, complaints still update correctly and nothing surfaces in the UI — check
the Vercel runtime logs for `[mail]` or `[mail:console]`.

**Overdue is computed, not stored.** If a complaint's overdue badge looks wrong, do not go looking
for a stale column or a cron job — there is neither. Check the threshold at Admin → Settings; it is
a row in the `Setting` table and re-evaluates the whole register the moment it changes.

---

## 7. Verify the deployment

Do these in order. Steps 3 and 4 are the ones that exercise the never-run code paths.

1. **Site loads.** Open the deployment URL; it should redirect to `/login`.
2. **Login works.** `admin@society.test` with the seeded password → lands on the dashboard showing
   non-zero counts and 3 overdue.
3. **Photo upload → exercises Vercel Blob.** Sign in as a resident (`priya@society.test`), raise a
   complaint, attach a real JPEG or PNG. Open the complaint — **the photo must render**. Confirm
   its URL is a `blob.vercel-storage.com` address, not `/uploads/...`. A `/uploads/` URL means
   `BLOB_READ_WRITE_TOKEN` is not set.
4. **Status change → exercises Resend.** As admin, move that complaint to In progress with a note.
   Check the resident's inbox. If nothing arrives, read the Vercel runtime logs — `[mail:console]`
   means no API key; `[mail] provider rejected` means Resend refused (almost always the sandbox
   sender restriction above).
5. **Lifecycle rule holds.** Resolve a complaint, then try to reopen it — the status control should
   be gone, and the API returns `409`.
6. **Role separation.** As a resident, open `/admin` — it must redirect to `/complaints`.

A quick API smoke test against the deployed URL:

```bash
BASE="https://<your-deployment>.vercel.app"
curl -s -o /dev/null -w "anon complaints (expect 401): %{http_code}\n" $BASE/api/complaints
curl -s -c /tmp/a.jar -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@society.test","password":"<seeded-password>"}' | head -c 200; echo
curl -s -b /tmp/a.jar "$BASE/api/dashboard" | head -c 300; echo
```

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build fails on `@prisma/client` | Client not generated | `npm run build` already runs `prisma generate`; check it wasn't overridden in Vercel |
| Every request 500s, build was fine | `AUTH_SECRET` missing or < 32 chars | Set a proper one and redeploy |
| `db:deploy` hangs or errors on advisory locks | Using the pooled URL | Use the **direct** URL for migrations |
| Photos 404 after upload | No `BLOB_READ_WRITE_TOKEN` | Create a Blob store, set the token, redeploy |
| No emails, no errors | No `RESEND_API_KEY`, or sandbox sender restriction | Check runtime logs for `[mail…]`; verify a domain in Resend |
| `Too many connections` | Using the direct URL at runtime | `DATABASE_URL` must be the **pooled** string |
| Login always fails | Database never seeded | Run `npm run db:seed` against the production DB |

**Rollback:** Vercel keeps every deployment — promote a previous one from the dashboard. The
database is unaffected by a rollback; migrations are additive and there is only one.

---

## 9. Before the user submits

- [ ] Repo is **public**, default branch is **main**
- [ ] `git ls-files` shows no `node_modules`, `.env`, `.next/`, or `public/uploads`
- [ ] `.env.example` **is** committed (it is a required deliverable)
- [ ] Hosted URL loads and login works
- [ ] Admin password is not the default `Admin@123`
- [ ] The four deliverables are ready: source code, README (setup + `.env.example` + API docs +
      schema), hosted URL, and `docs/system-design.md` (779 words, under the 800 cap)

**This file is a deployment runbook, not part of the assignment.** Once deployed, it can be
removed to keep the submission tight:

```bash
git rm docs/HANDOVER.md && git commit -m "Remove deployment handover notes" && git push
```

---

## 10. Orientation in the code

Read these four files and you understand the system:

| File | Why |
| --- | --- |
| `prisma/schema.prisma` | The whole data model, with comments explaining each decision |
| `lib/complaints.ts` | Every complaint state change goes through here, in transactions |
| `lib/overdue.ts` | Why overdue is derived rather than stored |
| `docs/system-design.md` | The 779-word write-up of all four design decisions |

`README.md` has the full API reference for all 13 endpoints, the schema diagram, and the index
list. Local development setup is there too — the local database runs in Docker on **port 5433**
(not 5432, to avoid colliding with an existing Postgres).
