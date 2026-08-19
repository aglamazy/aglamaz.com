# Firestore Backup and Restore

FamCircle Firestore is the primary data store for the product. The backup plan
must provide a second metal in a different blast domain, so a Firebase project
loss does not take the data with it.

## Target shape

- Source of truth: the production Firestore database.
- Backup destination: a Cloud Storage bucket in a different GCP project from
  the Firebase project.
- Backup format: native Firestore export output created by `gcloud firestore export`.
- Restore method: native Firestore import created by `gcloud firestore import`.

## Required inputs

The repo-side helper script refuses to guess any of these:

- `--project`: the Firestore project ID to export from or import into.
- `--database`: the Firestore database name.
- `--storage-project`: the separate GCP project that owns the backup bucket.
- `--export-uri` for exports or `--import-uri` for imports.

Use the CLI wrapper in `scripts/firestore-backup.ts` rather than calling
`gcloud` ad hoc so the source project and storage project stay explicit in the
logs.

## Scheduled export

Run a scheduled export on a fixed cadence, with the output landing under a
timestamped prefix in the backup bucket.

Recommended schedule:

- Daily export for the rolling backup set.
- Monthly export for long-term retention.
- Yearly export for archive retention.

The bucket should live in a separate project owned by the platform side of the
team. The Firebase project should not own the bucket.

Example export command:

```bash
npx tsx scripts/firestore-backup.ts export \
  --project famcircle-prod \
  --database "(default)" \
  --storage-project famcircle-backups \
  --export-uri gs://famcircle-firestore-backups/prod/2026-08-07T00-00-00Z
```

## Retention policy

Apply bucket lifecycle rules on the backup bucket, not in the app.

Suggested policy:

- Daily exports: keep 30 days.
- Monthly exports: keep 12 months.
- Yearly exports: keep forever, or until the team approves a manual archival
  policy.

The bucket owner should enforce the lifecycle with GCS rules so retention keeps
working even if the app code stops running.

## Restore path

Restores should always happen into a scratch project first unless the outage
response explicitly requires a production restore.

Restore flow:

1. Create or choose a scratch Firestore project that is not the production
   project.
2. Import the selected export into that scratch project with the helper
   script.
3. Validate the restored data shape and counts against the export snapshot.
4. Only after the scratch restore is proven, decide whether production needs a
   destructive restore.

Example scratch import command:

```bash
npx tsx scripts/firestore-backup.ts import \
  --project famcircle-scratch \
  --database "(default)" \
  --storage-project famcircle-backups \
  --import-uri gs://famcircle-firestore-backups/prod/2026-08-07T00-00-00Z
```

## Verification status

The repo now has the export/import wrapper and the restore procedure. The
remaining operational work is to wire the scheduler, bucket ownership, and the
first real export/import verification in the cloud environment.
