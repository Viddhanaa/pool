# =============================================================================
# Viddhana Pool - Terraform Variables
# =============================================================================

# -----------------------------------------------------------------------------
# General
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "development"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

# -----------------------------------------------------------------------------
# VPC Configuration
# -----------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# -----------------------------------------------------------------------------
# EKS Configuration
# -----------------------------------------------------------------------------

variable "kubernetes_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

# General Node Group
variable "general_node_instance_types" {
  description = "Instance types for general node group"
  type        = list(string)
  default     = ["m6i.large", "m6i.xlarge"]
}

variable "general_node_min_size" {
  description = "Minimum size of general node group"
  type        = number
  default     = 2
}

variable "general_node_max_size" {
  description = "Maximum size of general node group"
  type        = number
  default     = 10
}

variable "general_node_desired_size" {
  description = "Desired size of general node group"
  type        = number
  default     = 3
}

# Stratum Node Group
variable "stratum_node_instance_types" {
  description = "Instance types for stratum node group (high network performance)"
  type        = list(string)
  default     = ["c6i.xlarge", "c6i.2xlarge"]
}

variable "stratum_node_min_size" {
  description = "Minimum size of stratum node group"
  type        = number
  default     = 2
}

variable "stratum_node_max_size" {
  description = "Maximum size of stratum node group"
  type        = number
  default     = 10
}

variable "stratum_node_desired_size" {
  description = "Desired size of stratum node group"
  type        = number
  default     = 3
}

# GPU Node Group
variable "gpu_node_instance_types" {
  description = "Instance types for GPU node group"
  type        = list(string)
  default     = ["g4dn.xlarge", "g4dn.2xlarge"]
}

variable "gpu_node_min_size" {
  description = "Minimum size of GPU node group"
  type        = number
  default     = 0
}

variable "gpu_node_max_size" {
  description = "Maximum size of GPU node group"
  type        = number
  default     = 4
}

variable "gpu_node_desired_size" {
  description = "Desired size of GPU node group"
  type        = number
  default     = 2
}

# -----------------------------------------------------------------------------
# RDS Configuration
# -----------------------------------------------------------------------------

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "rds_allocated_storage" {
  description = "Allocated storage for RDS (GB)"
  type        = number
  default     = 100
}

variable "rds_max_allocated_storage" {
  description = "Maximum allocated storage for RDS autoscaling (GB)"
  type        = number
  default     = 500
}

variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "viddhana_pool"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "viddhana"
  sensitive   = true
}

# -----------------------------------------------------------------------------
# ElastiCache (Redis) Configuration
# -----------------------------------------------------------------------------

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_num_nodes" {
  description = "Number of ElastiCache nodes"
  type        = number
  default     = 2
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Domain Configuration
# -----------------------------------------------------------------------------

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "viddhana.io"
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for domain"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Secrets
# -----------------------------------------------------------------------------

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "pool_wallet_private_key" {
  description = "Private key for pool wallet (DO NOT COMMIT)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ethereum_rpc_url" {
  description = "Ethereum RPC URL"
  type        = string
  sensitive   = true
  default     = ""
}

# -----------------------------------------------------------------------------
# Feature Flags
# -----------------------------------------------------------------------------

variable "enable_gpu_nodes" {
  description = "Enable GPU nodes for AI workloads"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable CloudWatch monitoring and alarms"
  type        = bool
  default     = true
}

variable "enable_backups" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}
