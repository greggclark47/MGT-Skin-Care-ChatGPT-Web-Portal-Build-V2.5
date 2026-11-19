# Team 47 Studio backup manifest

Created for the Team47Studio portal and app workspace backup.

## GitHub

- Repository: `greggclark47/MGT-Skin-Care-ChatGPT-Web-Portal-Build-V2.5`
- Branch: `codex/reconcile-main-2026-09-20`
- Backup commit: `79b4f34` (`chore: snapshot portal demo and production hardening`)
- Included in the commit: production audit fixes, Google platform Terraform fixes, and the populated HTML demo.

## Google Drive

- Full workspace archive: `Team47Studio-workspace-backup-2026-11-13.zip`
- Reviewable demo: `team47studio-populated-demo.html`

## Archive handling

The archive contains the workspace source, documentation, assets, generated evidence, and export materials available in the working directory at backup time. Local Git metadata, environment files, Terraform state and variable files, package caches, and transient dependency/build directories were excluded so secrets and machine-specific state are not copied into the Drive backup.
