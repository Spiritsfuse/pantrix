# 0013 — Terraform community VPC/EKS modules, private API endpoint, single NAT

**Status:** Accepted (real `apply` pending AWS access)

## Context

The infrastructure needs Terraform that provisions a VPC with at least two public
subnets and an EKS cluster with a managed node group, plus
`terraform.tfvars.example`. The design should be secure by default and cheap for
a short-lived demo environment.

## Options considered

1. **Hand-written resources.** Every route table, IAM role and add-on has to be
   right by hand.
2. **`terraform-aws-modules/vpc` (~> 6.7) and `terraform-aws-modules/eks`
   (~> 21.29).** Widely used, current with AWS provider 6.x.
3. **eksctl.** Fast, but not Terraform, which is the chosen tool here.

## Decision

Option 2, AWS provider `~> 6.0`, region `ap-south-1` by default.

**Network:**
- VPC `10.42.0.0/16` across two AZs: two public /20 subnets and two private /20
  subnets.
- One shared NAT gateway (`single_nat_gateway = true`). It saves cost and
  accepts an AZ dependency.
- VPC flow logs with 7-day retention.
- Subnet tags for the AWS Load Balancer Controller.

**EKS:**
- Kubernetes 1.35; Secrets envelope-encrypted with KMS; API/audit/authenticator
  logs.
- Core add-ons: CoreDNS, kube-proxy, VPC CNI, Pod Identity Agent and
  metrics-server.
- One managed node group (`t3.medium`, 1/2/3) in the private subnets, AL2023,
  with IMDSv2 required and a hop limit of 1.

**API endpoint:**
- The endpoint is private unless `endpoint_public_access_cidrs` lists the
  operator's own CIDR.
- A validation rule rejects `0.0.0.0/0`.
- This cleared Trivy AWS-0040/AWS-0041 instead of suppressing them.
- AWS-0104 (node egress) is a documented exception (ADR 0007).

**Other:**
- State is local by default. An S3 backend with lockfile is provided as a
  commented block.
- No credentials appear in any file; `terraform.tfvars` is git-ignored.

## Consequences

- Verified locally: `terraform init`, `fmt -check` and `validate` pass.
- A real `terraform plan` fails at STS with `InvalidClientTokenId`, because this
  computer's AWS credentials are invalid
  (`docs/evidence/terraform-plan-blocked.png`).
- The configuration was exercised against an emulator instead (ADR 0014).
- Cost while running: an EKS control plane, NAT gateway, two t3.medium nodes and
  CloudWatch logs. The approximate table is in
  `docs/runbooks/aws-provision-and-teardown.md`. Destroy after evaluation.

## What I would do in production

- Remote state in S3 with locking.
- NAT per AZ (or VPC endpoints for ECR/S3/STS to cut NAT traffic).
- Private endpoint only, with access via SSM or a VPN.
- Karpenter for nodes, and separate accounts per environment.
