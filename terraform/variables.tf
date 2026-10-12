variable "region" {
  description = "AWS region for every resource."
  type        = string
  default     = "ap-south-1"
}

variable "project" {
  description = "Name prefix for resources."
  type        = string
  default     = "pantrix"
}

variable "environment" {
  description = "Environment name used in resource names and tags."
  type        = string
  default     = "dev"
}

variable "owner" {
  description = "Owner tag so the resources are easy to find (and delete) in a shared account."
  type        = string
  default     = "dhruv-sharma"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.42.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones (one public and one private subnet each). Minimum 2 for EKS."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "EKS needs subnets in at least two AZs; this stack supports 2 or 3."
  }
}

variable "single_nat_gateway" {
  description = "One shared NAT gateway (cheaper) instead of one per AZ (highly available)."
  type        = bool
  default     = true
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version. Keep it inside AWS standard support to avoid extended-support charges."
  type        = string
  default     = "1.35"
}

variable "endpoint_public_access_cidrs" {
  description = <<-EOT
    CIDRs allowed to reach the EKS API from the internet, e.g. ["203.0.113.10/32"].
    Empty (the default) keeps the API endpoint private to the VPC.
  EOT
  type        = list(string)
  default     = []

  validation {
    condition     = !contains(var.endpoint_public_access_cidrs, "0.0.0.0/0")
    error_message = "Do not open the Kubernetes API to the whole internet; use your own IP/32."
  }
}

variable "node_instance_types" {
  description = "Instance types for the managed node group."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_capacity_type" {
  description = "ON_DEMAND or SPOT. SPOT cuts node cost for a short-lived demo."
  type        = string
  default     = "ON_DEMAND"

  validation {
    condition     = contains(["ON_DEMAND", "SPOT"], var.node_capacity_type)
    error_message = "node_capacity_type must be ON_DEMAND or SPOT."
  }
}

variable "node_min_size" {
  description = "Minimum nodes in the managed node group."
  type        = number
  default     = 1
}

variable "node_desired_size" {
  description = "Desired nodes in the managed node group."
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum nodes in the managed node group."
  type        = number
  default     = 3
}
