output "region" {
  description = "Region the stack is deployed to."
  value       = var.region
}

output "vpc_id" {
  description = "ID of the Pantrix VPC."
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnets (load balancers, NAT gateway)."
  value       = module.vpc.public_subnets
}

output "private_subnet_ids" {
  description = "Private subnets (EKS worker nodes)."
  value       = module.vpc.private_subnets
}

output "nat_gateway_ids" {
  description = "NAT gateways created for private-subnet egress."
  value       = module.vpc.natgw_ids
}

output "cluster_name" {
  description = "EKS cluster name."
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint."
  value       = module.eks.cluster_endpoint
}

output "cluster_version" {
  description = "Kubernetes version of the control plane."
  value       = module.eks.cluster_version
}

output "node_group_names" {
  description = "Managed node groups in the cluster."
  value       = keys(module.eks.eks_managed_node_groups)
}

output "configure_kubectl" {
  description = "Run this after apply to point kubectl at the new cluster."
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}
