# =============================================================================
# Viddhana Pool - Terraform Outputs
# =============================================================================

# -----------------------------------------------------------------------------
# VPC Outputs
# -----------------------------------------------------------------------------

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnets
}

output "nat_gateway_ips" {
  description = "NAT Gateway public IPs"
  value       = module.vpc.nat_public_ips
}

# -----------------------------------------------------------------------------
# EKS Outputs
# -----------------------------------------------------------------------------

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_version" {
  description = "EKS cluster Kubernetes version"
  value       = module.eks.cluster_version
}

output "eks_cluster_arn" {
  description = "EKS cluster ARN"
  value       = module.eks.cluster_arn
}

output "eks_cluster_security_group_id" {
  description = "EKS cluster security group ID"
  value       = module.eks.cluster_security_group_id
}

output "eks_node_security_group_id" {
  description = "EKS node security group ID"
  value       = module.eks.node_security_group_id
}

output "eks_oidc_provider_arn" {
  description = "EKS OIDC provider ARN"
  value       = module.eks.oidc_provider_arn
}

output "eks_cluster_certificate_authority_data" {
  description = "EKS cluster certificate authority data"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

# kubeconfig command
output "configure_kubectl" {
  description = "Configure kubectl command"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

# -----------------------------------------------------------------------------
# RDS Outputs
# -----------------------------------------------------------------------------

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
}

output "rds_address" {
  description = "RDS instance address (hostname)"
  value       = module.rds.db_instance_address
}

output "rds_port" {
  description = "RDS instance port"
  value       = module.rds.db_instance_port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = module.rds.db_instance_name
}

output "rds_username" {
  description = "RDS master username"
  value       = module.rds.db_instance_username
  sensitive   = true
}

output "database_url" {
  description = "Full database connection URL"
  value       = "postgresql://${module.rds.db_instance_username}:PASSWORD@${module.rds.db_instance_endpoint}/${module.rds.db_instance_name}"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# ElastiCache Outputs
# -----------------------------------------------------------------------------

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.elasticache.cluster_cache_nodes[0].address
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = module.elasticache.cluster_cache_nodes[0].port
}

output "redis_url" {
  description = "Redis connection URL"
  value       = "redis://${module.elasticache.cluster_cache_nodes[0].address}:${module.elasticache.cluster_cache_nodes[0].port}"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# S3 Outputs
# -----------------------------------------------------------------------------

output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = module.s3_bucket.s3_bucket_id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = module.s3_bucket.s3_bucket_arn
}

output "s3_bucket_regional_domain_name" {
  description = "S3 bucket regional domain name"
  value       = module.s3_bucket.s3_bucket_bucket_regional_domain_name
}

# -----------------------------------------------------------------------------
# Load Balancer Outputs
# -----------------------------------------------------------------------------

output "stratum_lb_dns_name" {
  description = "Stratum load balancer DNS name"
  value       = aws_lb.stratum.dns_name
}

output "stratum_lb_zone_id" {
  description = "Stratum load balancer zone ID"
  value       = aws_lb.stratum.zone_id
}

output "stratum_connection_string" {
  description = "Stratum mining connection string"
  value       = "stratum+tcp://${aws_lb.stratum.dns_name}:3333"
}

# -----------------------------------------------------------------------------
# Security Outputs
# -----------------------------------------------------------------------------

output "kms_key_arn" {
  description = "KMS key ARN for EKS encryption"
  value       = aws_kms_key.eks.arn
}

# -----------------------------------------------------------------------------
# Summary Output
# -----------------------------------------------------------------------------

output "infrastructure_summary" {
  description = "Summary of deployed infrastructure"
  value = {
    environment      = var.environment
    region           = var.aws_region
    eks_cluster      = module.eks.cluster_name
    eks_version      = module.eks.cluster_version
    rds_endpoint     = module.rds.db_instance_endpoint
    redis_endpoint   = "${module.elasticache.cluster_cache_nodes[0].address}:${module.elasticache.cluster_cache_nodes[0].port}"
    stratum_endpoint = "${aws_lb.stratum.dns_name}:3333"
    s3_bucket        = module.s3_bucket.s3_bucket_id
  }
}
