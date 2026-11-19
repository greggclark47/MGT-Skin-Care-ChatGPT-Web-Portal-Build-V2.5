# Lowest-cost runtime policy

The default staging posture is deliberately inexpensive and reversible:

- Cloud Run web and API services use `min_instance_count = 0`, so idle services scale
  to zero. `max_instance_count` remains bounded and must be reviewed before activation.
- Operations work runs as a one-shot Cloud Run Job with `parallelism = 1`, `task_count = 1`
  and bounded retries. Cloud Scheduler starts a sweep; it does not keep a worker process
  running between sweeps.
- `deploy_application` remains `false` until immutable images, secret versions, database
  identity/RLS evidence and a staging approval are present.
- Hosted AI, subscriptions and billing are disabled in the staging example. A billing
  account and budget are not configured. Enabling any of them requires an explicit demand
  and unit-economics decision plus a new candidate-bound evidence review.
- Monitoring and alerting remain disabled until DNS/TLS and an approved operations mailbox
  exist; this avoids idle alert spend during qualification.
