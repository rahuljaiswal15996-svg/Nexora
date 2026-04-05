# Nexora – Part 6: Cloud & Infrastructure (AWS/GCP/Azure)

## Goals
- Multi-cloud portability
- High availability (HA) and scalability
- Secure, private networking

## Core Components
- Kubernetes: EKS (AWS), GKE (GCP), AKS (Azure)
- Object Storage: S3 / GCS / Azure Blob
- Databases: RDS/Cloud SQL/Azure SQL, managed Postgres
- Streaming: MSK/Kafka, Pub/Sub, Event Hub
- Caching: Redis (ElastiCache/MemoryStore)
- Observability: CloudWatch / Cloud Logging / Azure Monitor

## Networking
- VPC/VNet per environment
- Private subnets for services
- NAT for egress
- PrivateLink / VPC Peering / Service Endpoints

## HA & DR
- Multi-AZ by default
- Cross-region replication (active-active or active-passive)
- RPO/RTO targets defined per service
- Automated failover + health checks

## Autoscaling
- HPA/VPA for pods
- Cluster autoscaler
- Queue-based scaling for workers

## Cost Controls
- Spot/preemptible nodes for batch
- Storage lifecycle policies
- Per-tenant cost attribution tags
