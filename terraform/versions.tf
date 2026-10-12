terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Remote state for a team setup (create the bucket first, then uncomment):
  # backend "s3" {
  #   bucket       = "pantrix-tfstate-<account-id>"
  #   key          = "eks/terraform.tfstate"
  #   region       = "ap-south-1"
  #   use_lockfile = true
  #   encrypt      = true
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = local.tags
  }
}
