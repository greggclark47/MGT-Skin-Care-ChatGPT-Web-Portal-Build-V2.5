# Team 47 Studio Terraform state bootstrap

This one-time module creates the pre-existing Google Cloud Storage bucket required by
the platform's GCS backend. Create one bucket in the staging project and one in the
production project. The bucket is private, versioned, protected from Terraform destroy
and grants object access only to explicitly declared administrators.

## Bootstrap sequence

1. Authenticate with an approved Workspace administrator using Application Default
   Credentials and MFA. Do not create or download a service-account key.
2. Copy `terraform.tfvars.example` to an untracked environment-specific file and replace
   every placeholder with an approved IAM principal.
3. Run `terraform init`, `terraform validate`, save a plan and apply it from this folder.
   The first bootstrap state is local and contains resource metadata only; protect it
   until migration completes.
4. Copy `backend_override.tf.example` to the ignored `backend_override.tf` file.
5. Run `terraform init -migrate-state` with `bucket` set to the `state_bucket` output and
   `prefix` set to the `bootstrap_state_prefix` output. Review the migration prompt.
6. Initialize `infra/gcp/platform` with the same bucket and the emitted
   `platform_state_prefix`. The tracked platform backend block contains no credentials.
7. Verify object versioning, state locking, IAM membership and recovery of a prior state
   generation before allowing CI to plan against the backend.

Supply backend credentials through Application Default Credentials or GitHub OIDC.
Never put credentials in backend configuration, command history, Terraform variables,
the repository, Google Drive or plan artifacts. Never use `-lock=false` in automation.
