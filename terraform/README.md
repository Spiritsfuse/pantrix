# Terraform — AWS VPC + EKS for Pantrix

Provisions the AWS side of Pantrix in **ap-south-1 (Mumbai)**:

* VPC `10.42.0.0/16` across **2 availability zones**
* **2 public subnets** (`/20`, Internet Gateway, load balancers, one NAT gateway)
* **2 private subnets** (`/20`, EKS worker nodes, egress through the NAT gateway)
* VPC flow logs to CloudWatch (7-day retention)
* **EKS 1.35** control plane: Secrets envelope-encrypted with a KMS key, API/audit/authenticator logs,
  API endpoint **private** unless you pass your own CIDR in `endpoint_public_access_cidrs`
* Add-ons: CoreDNS, kube-proxy, VPC CNI, Pod Identity agent, metrics-server (needed by the HPA)
* **1 managed node group** `general`: AL2023, `t3.medium`, min 1 / desired 2 / max 3, IMDSv2 only
* IAM roles for the cluster and nodes (created by the modules), cluster-creator admin access entry

Modules: `terraform-aws-modules/vpc/aws ~> 6.7`, `terraform-aws-modules/eks/aws ~> 21.29`, AWS provider `~> 6.0`.

## Verification status

| Step | Status | Evidence |
|---|---|---|
| `terraform fmt -check`, `init`, `validate` | **Verified** on 2026-10-12 (Terraform 1.16.5) | `docs/evidence/terraform-init-validate.png` |
| Trivy misconfiguration scan | **Verified**, 0 HIGH/CRITICAL (AWS-0104 is a documented exception) | `docs/evidence/trivy-config-iac.png` |
| `terraform plan` against **real AWS** | **Blocked** — the AWS credentials on the build machine are invalid (`InvalidClientTokenId`) | `docs/evidence/terraform-plan-blocked.png` |
| `plan` / `apply` / `destroy` against the **Moto AWS API emulator** | **Verified**: plan 62 to add; apply created 54/62 (VPC, subnets, IGW, NAT, EKS cluster, node group, IAM, KMS) before EKS add-on/access-entry APIs Moto does not implement; destroy removed all 54 | `docs/evidence/terraform-plan-emulator.png`, `terraform-emulator-apply-destroy.png`, `terraform-destroy-emulator.png` |
| Real `apply`, AWS Console screenshots, real `destroy` | **Not done** — needs a valid AWS account and an explicit go-ahead for the cost | — |

The emulator run is a correctness check of the configuration, **not** evidence of AWS resources.
Script: [`../scripts/terraform/plan-against-emulator.sh`](../scripts/terraform/plan-against-emulator.sh).

## Prerequisites

* Terraform >= 1.9, AWS CLI v2, kubectl, Helm
* An AWS identity allowed to manage VPC, EC2, EKS, IAM, KMS and CloudWatch Logs
  (`aws sts get-caller-identity` must succeed)
* Your public IP if you want kubectl access from your laptop: `curl -s https://checkip.amazonaws.com`

## Commands

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars    # edit endpoint_public_access_cidrs = ["<your-ip>/32"]
aws sts get-caller-identity                      # confirm the account and region first

terraform init
terraform fmt -check -recursive
terraform validate
terraform plan -out tfplan                       # review: ~62 resources to add
terraform apply tfplan                           # ~15-20 minutes, mostly the EKS control plane

terraform output
$(terraform output -raw configure_kubectl)       # aws eks update-kubeconfig ...
kubectl get nodes -o wide                        # 2 Ready nodes expected

# deploy the app onto EKS (images must be pullable: make the GHCR packages public
# or create an imagePullSecret), then:
helm upgrade --install pantrix ../helm/pantrix -n pantrix --create-namespace \
  -f ../helm/pantrix/values-dev.yaml --set image.tag=<git-sha>

terraform destroy                                # always, after the demo
```

### Cleanup verification

```bash
aws eks list-clusters --region ap-south-1
aws ec2 describe-vpcs --region ap-south-1 --filters Name=tag:Project,Values=pantrix --query 'Vpcs[].VpcId'
aws ec2 describe-nat-gateways --region ap-south-1 --filter Name=tag:Project,Values=pantrix --query 'NatGateways[?State!=`deleted`].NatGatewayId'
aws ec2 describe-addresses --region ap-south-1 --filters Name=tag:Project,Values=pantrix
aws logs describe-log-groups --region ap-south-1 --log-group-name-prefix /aws/eks/pantrix-dev
```

All should return empty lists. KMS keys enter a 30-day pending-deletion window instead of
disappearing immediately; that is expected.

## Cost (approximate, ap-south-1, on-demand, October 2026 — check the AWS pricing pages)

| Resource | Approx. hourly |
|---|---|
| EKS control plane (standard support) | $0.10 |
| 2 x t3.medium nodes | ~$0.09 |
| NAT gateway (+ data processed) | ~$0.056 + per-GB |
| KMS key, CloudWatch logs, EBS | cents per day |
| **Total** | **roughly $0.25-0.30 per hour** (a 2-hour demo is about $0.50-0.60) |

Never leave it running: an idle cluster costs about $6-7 per day. Use `node_capacity_type = "SPOT"`
to cut the node cost for a short demo. State files (`*.tfstate`) and `terraform.tfvars` are git-ignored;
for a team, enable the S3 backend shown in `versions.tf`.

## Files

| File | Purpose |
|---|---|
| `versions.tf` | Terraform/provider versions, optional S3 backend, default tags |
| `variables.tf` | Inputs with validation (AZ count, capacity type, endpoint CIDRs) |
| `main.tf` | VPC module, EKS module, node group definition |
| `outputs.tf` | VPC/subnet/NAT IDs, cluster name/endpoint/version, kubeconfig command |
| `terraform.tfvars.example` | Example inputs — no credentials |
| `.terraform.lock.hcl` | Provider checksums pinned by `terraform init` |
