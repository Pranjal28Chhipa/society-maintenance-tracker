# System design

Next.js (App Router) with route handlers as the REST API, PostgreSQL via Prisma, sessions as
signed JWTs in `httpOnly` cookies. Authorisation lives in a service layer that both the API routes
and the server-rendered pages call, so one place decides "can this person see this?".

## Complaint history model

A complaint is a row of current state plus an append-only log of how it got there. `Complaint`
holds `status`, `priority`, `resolvedAt`; `ComplaintEvent` holds one row per change, typed as
`CREATED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `OVERDUE_FLAGGED`, `OVERDUE_CLEARED` or
`NOTE_ADDED`, each recording `fromStatus`/`toStatus` (or the priority equivalents), an optional
note, the actor, and a timestamp.

Storing only the latest note, or diffing a generic audit table, loses what the admin actually
needs: *why* something sat open for nine days. Recording the transition explicitly means the
timeline renders straight from the table.

Two details matter. The event and the row update share one transaction, so state and history
cannot drift apart, and the read-check-write inside it stops two admins moving a complaint out of
the same starting status at once. And `actorName`/`actorRole` are denormalised onto the event
beside an `ON DELETE SET NULL` `actorId`, so a resident who moves out can be deleted without
cascading away the society's records or leaving a timeline of "unknown user".

Valid transitions are declared as data in `lib/domain.ts`:

```
OPEN → IN_PROGRESS | RESOLVED      IN_PROGRESS → OPEN | RESOLVED      RESOLVED → (nothing)
```

`RESOLVED` maps to an empty list, which is how "once resolved, it is closed" is enforced —
anything else returns `409`. The UI reads the same table and only offers transitions the API will
accept, so a closed complaint shows no status control rather than a button that fails.

## Overdue detection

Overdue is **derived at read time, never stored**. `evaluateOverdue()` takes a complaint and the
configured threshold and returns `ageDays`, `dueAt`, `isBreached`, `daysOverdue`.

Persisting an `isOverdue` boolean would need a scheduled job to flip it — a second system to
deploy and monitor — and the value would still go stale the moment an admin changed the threshold,
requiring a backfill. Deriving it means changing the threshold from 5 days to 1 re-evaluates the
whole register instantly, which is both correct and free.

The threshold lives in a `Setting` row rather than an environment variable, because the
requirement is that an admin can configure it; the env var only seeds the row on first run.

The one piece that *is* stored is `overdueFlaggedAt`, set by an explicit admin flag. That is a
judgement — "this needs attention now" — not a calculation, so it cannot be recomputed. A
complaint is overdue if either condition holds, and resolving one clears the flag.

The cost is that overdue is not a sortable column, so the queue's "overdue first, then priority,
then oldest" ordering happens in memory over a bounded fetch. A single society's unresolved set is
hundreds of rows, not millions. If that ever stopped holding, the fix is a generated column, not a
cron job.

## Photo handling

`POST /api/complaints` accepts `multipart/form-data`, so the photo uploads in the same request
that creates the complaint. A separate upload endpoint would open a window where a complaint row
points at an upload that never completed, or where orphaned blobs accumulate from abandoned
forms.

Files are validated server-side for MIME type (JPEG, PNG, WebP, HEIC) and size (5 MB) before any
write; the client checks the same limits only for a faster error. Storage is Vercel Blob, keyed by
a random UUID so filenames from residents' phones never collide or leak. Without
`BLOB_READ_WRITE_TOKEN` the same function writes to `public/uploads`, keeping the project runnable
with no cloud account — development-only, since serverless filesystems are read-only.

## Notification flow

Two triggers: a complaint's status changing, and an important notice being posted.

Both dispatch **after** the database transaction commits, and both swallow their own failures
into the server log. A mail outage must not roll back a status change or return a 500 to the
admin who made it — the state change is the durable fact; the email is a courtesy about it.
Status emails carry the transition, the admin's note and a deep link; important notices fan out
to every resident via `Promise.allSettled`, so one bad address cannot abort the rest.

Priority changes deliberately send nothing. Priority is internal triage, and emailing residents
about it would train them to ignore the mail that does matter.

With no `RESEND_API_KEY`, every message is written to the console tagged `[mail:console]`. The
whole notification path stays exercisable — and reviewable — without a mail account.
