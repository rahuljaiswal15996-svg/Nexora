terraform {
  required_version = ">= 1.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.16"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.5"
    }
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig_path
}

provider "helm" {
  kubernetes {
    config_path = var.kubeconfig_path
  }
}

# Example: deploy local Helm chart to cluster using Terraform's Helm provider.
# Uncomment and adjust the `chart` path and values for your environment.
# resource "helm_release" "nexora" {
#   name             = "nexora"
#   chart            = "${path.module}/../../helm/nexora"
#   namespace        = var.namespace
#   create_namespace = true
#   set {
#     name  = "backend.image.repository"
#     value = var.backend_image_repository
#   }
#   set {
#     name  = "backend.image.tag"
#     value = var.backend_image_tag
#   }
# }
