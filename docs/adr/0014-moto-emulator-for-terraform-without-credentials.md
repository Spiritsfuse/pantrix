# 0014 — Exercise Terraform against the Moto emulator when no AWS account is available

**Status:** Accepted

## Context

The AWS credentials on the build computer are invalid. A real `terraform plan`
stops at the STS `GetCallerIdentity` call, so the code could only be validated
statically. Provisioning real resources also needs the owner's explicit approval
for the cost.

## Options considered

1. **Static checks only** (`validate`, `fmt`, Trivy config). This misses data
   sources, module wiring and dependency order.
2. **LocalStack.** Its EKS emulation is not part of the free tier.
3. **Moto server.** Open source. It emulates EC2, IAM, KMS, STS, CloudWatch Logs,
   SSM and basic EKS cluster and node group calls.

## Decision

`scripts/terraform/plan-against-emulator.sh plan|apply|destroy` does the
following:
1. Copies `terraform/` into a scratch directory.
2. Adds a `zz_emulator_override.tf` that points the AWS provider at Moto with
   dummy keys.
3. Sets `use_latest_ami_release_version = false` on the node group. Moto has no
   `/aws/service/...` public SSM parameters, and it refuses writes to that
   namespace.
4. Runs the action.

The real `terraform/` directory is never modified.

## Results (real output, Moto 5.2.4)

**Plan:** `Plan: 62 to add, 0 to change, 0 to destroy.`

**Apply:** 54 resources created, including:
- the VPC, 4 subnets, the internet gateway and the NAT gateway;
- the KMS key and IAM roles;
- the EKS cluster `pantrix-dev` and the managed node group.

It then stopped on APIs Moto does not implement: EKS `CreateAccessEntry` and
`DescribeAddonVersions`.

Moto had to be started with `MOTO_IAM_LOAD_MANAGED_POLICIES=true` so that
AWS-managed policies such as `AmazonEKSClusterPolicy` exist.

**Destroy** (`-refresh=false`, because a refresh calls the missing add-on API):
`Destroy complete! Resources: 54 destroyed.`

Evidence: `docs/evidence/terraform-plan-emulator.png`,
`terraform-emulator-apply-destroy.png` and `terraform-destroy-emulator.png`.

## Consequences

- The configuration is shown to resolve and order a complete resource graph,
  well beyond `validate`.
- **This is not AWS.** No VPC or EKS cluster exists in any AWS account. Every
  emulator screenshot says so in its title and footer. The items "VPC +
  EKS provisioned (AWS Console)" and real `terraform destroy` stay pending until
  real credentials and cost approval exist.

## What I would do in production

Keep the emulator run as a fast CI smoke test, and add `terraform plan` against
a real sandbox account through GitHub OIDC (no static keys) on every pull
request.
