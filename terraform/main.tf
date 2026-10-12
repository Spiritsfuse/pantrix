# Pantrix on AWS: a VPC with public + private subnets across two AZs and an EKS
# cluster with one managed node group in the private subnets.
#
#   Internet -- IGW -- public subnets (load balancers, NAT GW) -- NAT -- private subnets (EKS nodes)

data "aws_availability_zones" "available" {
  state = "available"

  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

locals {
  name = "${var.project}-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  tags = {
    Project     = var.project
    Environment = var.environment
    Owner       = var.owner
    ManagedBy   = "terraform"
    Repository  = "pantrix"
  }
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 6.7"

  name = local.name
  cidr = var.vpc_cidr
  azs  = local.azs

  # /20 per subnet: 10.42.0.0/20 and 10.42.16.0/20 public, 10.42.48.0/20 and 10.42.64.0/20 private.
  public_subnets  = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i)]
  private_subnets = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i + 3)]

  enable_nat_gateway     = true
  single_nat_gateway     = var.single_nat_gateway
  one_nat_gateway_per_az = !var.single_nat_gateway
  enable_dns_hostnames   = true
  enable_dns_support     = true

  map_public_ip_on_launch = false

  # Flow logs to CloudWatch for network forensics; short retention keeps cost low.
  enable_flow_log                                 = true
  create_flow_log_cloudwatch_log_group            = true
  create_flow_log_cloudwatch_iam_role             = true
  flow_log_cloudwatch_log_group_retention_in_days = 7

  # Subnet tags let the AWS Load Balancer Controller place internet-facing and
  # internal load balancers for Kubernetes Services and Ingresses.
  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = 1
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.29"

  name               = local.name
  kubernetes_version = var.kubernetes_version

  # Public API access only when the operator lists their own CIDRs.
  endpoint_public_access       = length(var.endpoint_public_access_cidrs) > 0
  endpoint_private_access      = true
  endpoint_public_access_cidrs = var.endpoint_public_access_cidrs

  # The identity running terraform apply becomes cluster admin via an access entry.
  enable_cluster_creator_admin_permissions = true

  # Envelope-encrypt Kubernetes Secrets with a module-managed KMS key.
  encryption_config = {
    resources = ["secrets"]
  }

  enabled_log_types                      = ["api", "audit", "authenticator"]
  cloudwatch_log_group_retention_in_days = 7

  addons = {
    coredns    = {}
    kube-proxy = {}
    vpc-cni = {
      before_compute = true
    }
    eks-pod-identity-agent = {
      before_compute = true
    }
    metrics-server = {}
  }

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.private_subnets
  control_plane_subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    general = {
      ami_type       = "AL2023_x86_64_STANDARD"
      instance_types = var.node_instance_types
      capacity_type  = var.node_capacity_type

      min_size     = var.node_min_size
      desired_size = var.node_desired_size
      max_size     = var.node_max_size

      disk_size = 20

      labels = {
        workload = "pantrix"
      }

      # IMDSv2 only, with a hop limit of 1 so pods cannot read node credentials.
      metadata_options = {
        http_endpoint               = "enabled"
        http_tokens                 = "required"
        http_put_response_hop_limit = 1
      }
    }
  }
}
