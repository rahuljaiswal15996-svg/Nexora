variable "kubeconfig_path" {
  type    = string
  default = "~/.kube/config"
  description = "Path to kubeconfig used by providers"
}

variable "namespace" {
  type    = string
  default = "nexora"
}

variable "backend_image_repository" {
  type    = string
  default = "nexora/backend"
}

variable "backend_image_tag" {
  type    = string
  default = "latest"
}

variable "frontend_image_repository" {
  type    = string
  default = "nexora/frontend"
}

variable "frontend_image_tag" {
  type    = string
  default = "latest"
}
