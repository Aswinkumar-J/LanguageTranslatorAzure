variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "cloud-project-rg"
}

variable "rg_location" {
  description = "Location of the Resource Group"
  type        = string
  default     = "southeastasia"
}

variable "secondary_location" {
  description = "Location for other resources (Central India)"
  type        = string
  default     = "centralindia"
}

variable "translator_location" {
  description = "Region for Translator service (Southeast Asia)"
  type        = string
  default     = "southeastasia"
}

variable "storage_account_name" {
  description = "Name of the storage account"
  type        = string
  default     = "translatorstorage09"
}

variable "acr_name" {
  description = "Name of the Azure Container Registry"
  type        = string
  default     = "languagetranslator"
}

variable "container_app_environment_name" {
  description = "Name of the Container Apps Environment"
  type        = string
  default     = "managedEnvironment-cloudprojectrg-83c4"
}

variable "container_app_name" {
  description = "Name of the Container App"
  type        = string
  default     = "languagecontainer"
}

variable "cognitive_translator_name" {
  description = "Name of the Translator Cognitive Services account"
  type        = string
  default     = "cloud-computing-translator"
}

variable "cognitive_speech_name" {
  description = "Name of the Speech Cognitive Services account"
  type        = string
  default     = "language-speech"
}

variable "cognitive_openai_name" {
  description = "Name of the Azure OpenAI account"
  type        = string
  default     = "LanguageOpenAI"
}

variable "openai_location" {
  description = "Location for Azure OpenAI"
  type        = string
  default     = "southeastasia"
}

variable "openai_deployment_name" {
  description = "Name of the model deployment"
  type        = string
  default     = "gpt-5.4"
}

variable "key_vault_name" {
  description = "Name of the Key Vault"
  type        = string
  default     = "translatorvault"
}

variable "log_analytics_workspace_name" {
  description = "Name of the Log Analytics workspace"
  type        = string
  default     = "workspacecloudprojectrgb8d3"
}

# Sensitive variables for secrets
variable "translator_key" {
  description = "Key for the Translator service"
  type        = string
  sensitive   = true
}

variable "speech_key" {
  description = "Key for the Speech service"
  type        = string
  sensitive   = true
}



variable "storage_connection_string" {
  description = "Connection string for the Storage Account"
  type        = string
  sensitive   = true
}

# Authentication Variables (Optional if using Azure CLI)
variable "subscription_id" {
  description = "Azure Subscription ID"
  type        = string
  default     = "94bf1b45-40a3-491b-a540-93553402617e"
}

variable "tenant_id" {
  description = "Azure Tenant ID"
  type        = string
  default     = "6070ff68-33e0-4724-a42f-768f0963ae2b"
}

variable "client_id" {
  description = "Azure Service Principal Client ID"
  type        = string
  default     = ""
}

variable "client_secret" {
  description = "Azure Service Principal Client Secret"
  type        = string
  sensitive   = true
  default     = ""
}
