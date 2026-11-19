# GitHub required verification check

The existing `Portal verification` workflow now runs repository lint, the full
infrastructure and application contract suites, the encrypted-backup contract, and
the candidate verification harness on every pull request and on `main` pushes.

Set the protected-branch required status check to:

```text
Portal verification / Local release gate
```

Require branches to be up to date before merging and disallow bypass for ordinary
contributors. This setting is repository administration rather than source code and
must be applied by an owner with GitHub branch-protection permission. The workflow is
read-only and contains no deploy, publish, billing, or hosted-AI activation step.
