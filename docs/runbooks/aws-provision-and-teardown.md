# Provision and tear down the AWS stack (VPC + EKS)

> **Status:** run end to end on a real account in ap-south-1: plan (62 to add), apply, Console and
> `kubectl` evidence, destroy (62 destroyed, nothing left). Real provisioning costs money, so destroy it
> as soon as the evidence is captured.
>
> **AWS Free plan accounts:** `t3.medium` is rejected ("not eligible for Free Tier") and the node group
> never gets instances. Use a free-tier-eligible type, for example
> `node_instance_types = ["m7i-flex.large"]` (`aws ec2 describe-instance-types --filters
> Name=free-tier-eligible,Values=true`).

## Prerequisites

- An AWS account and an IAM identity allowed to create VPC, EC2, EKS, IAM, KMS
  and CloudWatch Logs resources.
- AWS CLI v2, configured with `aws configure` (or SSO). Keys never go into the
  repository.
- Terraform ≥ 1.9 (1.16.5 used), kubectl and Helm.

Check who and where you are **before** creating anything:

```bash
aws sts get-caller-identity
aws configure get region          # the stack defaults to ap-south-1
```

## Approximate cost while the stack exists (ap-south-1)

Check the current prices on the AWS pricing pages before applying; these are
**approximate on-demand list prices**, excluding tax and free-tier effects.

| Item | Quantity | Approx. USD / hour |
|------|----------|--------------------|
| EKS control plane (standard support) | 1 | 0.10 |
| EC2 t3.medium worker nodes | 2 | ~0.09 (≈0.045 each) |
| NAT gateway (plus per-GB processing) | 1 | ~0.056 |
| Public IPv4 addresses (NAT EIP and others) | 1+ | ~0.005 each |
| EBS gp3 20 GiB per node, KMS key, CloudWatch logs | — | a few cents per day |
| **Total** | | **roughly USD 0.25–0.35 per hour** |

A 2–3 hour session for screenshots and the video costs a few dollars. Leaving it
running for a month costs about USD 200 or more. Destroy it as soon as the
evidence is captured.

## Provision

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit: endpoint_public_access_cidrs = ["<your public IP>/32"]   (curl -s https://checkip.amazonaws.com)
terraform init
terraform fmt -check && terraform validate
terraform plan -out tfplan            # review: VPC, 2 public + 2 private subnets, NAT, EKS, node group
terraform apply tfplan                # roughly 15-20 minutes, mostly the EKS control plane
terraform output
aws eks update-kubeconfig --region ap-south-1 --name pantrix-dev
kubectl get nodes -o wide             # the managed nodes are Ready
```

Console screenshots as evidence (VPC console and EKS console):
- the VPC `pantrix-dev` and its 4 subnets;
- the EKS cluster `pantrix-dev`;
- the node group `general-*` with its nodes.

## Deploy Pantrix on EKS (optional)

- **Ingress.** kind's ingress-nginx manifest does not apply here. Install the
  AWS Load Balancer Controller and set `ingress.className: alb` with ALB
  annotations, or use a LoadBalancer Service for the demo.
- **Images.** GHCR images are private by default. Make the packages public, or
  create an `imagePullSecret` and set `imagePullSecrets` in the values.
- **Storage.** PostgreSQL needs a StorageClass. Install the EBS CSI driver add-on
  for gp3 volumes, or point `postgres.externalHost` at RDS.

## Tear down

```bash
helm uninstall pantrix -n pantrix || true      # removes load balancers created by Kubernetes first
cd terraform
terraform destroy                              # capture this output as evidence
```

## Verify that nothing is left (and nothing is billing)

```bash
aws eks list-clusters --region ap-south-1
aws ec2 describe-vpcs --region ap-south-1 --filters Name=tag:Project,Values=pantrix --query 'Vpcs[].VpcId'
aws ec2 describe-nat-gateways --region ap-south-1 --filter Name=tag:Project,Values=pantrix --query 'NatGateways[?State!=`deleted`].NatGatewayId'
aws ec2 describe-addresses --region ap-south-1 --filters Name=tag:Project,Values=pantrix --query 'Addresses[].PublicIp'
aws elbv2 describe-load-balancers --region ap-south-1 --query 'LoadBalancers[].LoadBalancerName'
aws logs describe-log-groups --region ap-south-1 --log-group-name-prefix /aws/eks/pantrix-dev
terraform state list                           # empty
```

All of them should return empty lists. The EKS control-plane log group and the
KMS key (pending deletion, 7–30 days) can outlive `destroy`. Delete the log group
by hand if it remains.
