resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.rg_location
}

resource "azurerm_storage_account" "storage" {
  name                          = var.storage_account_name
  resource_group_name           = azurerm_resource_group.rg.name
  location                      = var.secondary_location
  account_tier                  = "Standard"
  account_replication_type      = "LRS"
  min_tls_version               = "TLS1_2"
  allow_nested_items_to_be_public = false
  https_traffic_only_enabled    = true
}

resource "azurerm_log_analytics_workspace" "logs" {
  name                = var.log_analytics_workspace_name
  location            = var.secondary_location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "ace" {
  name                       = var.container_app_environment_name
  location                   = var.secondary_location
  resource_group_name        = azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id

  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }

  lifecycle {
    ignore_changes = [
      log_analytics_workspace_id,
      workload_profile
    ]
  }
}

resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.rg.name
  location            = var.secondary_location
  sku                 = "Basic"
  admin_enabled       = true
}

resource "azurerm_cognitive_account" "translator" {
  name                = var.cognitive_translator_name
  location            = var.translator_location
  resource_group_name = azurerm_resource_group.rg.name
  kind                = "TextTranslation"
  sku_name            = "S1"
  
  custom_subdomain_name = var.cognitive_translator_name
}

resource "azurerm_cognitive_account" "speech" {
  name                = var.cognitive_speech_name
  location            = var.secondary_location
  resource_group_name = azurerm_resource_group.rg.name
  kind                = "SpeechServices"
  sku_name            = "F0"
}

resource "azurerm_key_vault" "vault" {
  name                        = var.key_vault_name
  location                    = var.secondary_location
  resource_group_name         = azurerm_resource_group.rg.name
  enabled_for_disk_encryption = false
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = 90
  purge_protection_enabled    = false
  enable_rbac_authorization   = true

  sku_name = "standard"
}

data "azurerm_client_config" "current" {}

resource "azurerm_container_app" "app" {
  name                         = var.container_app_name
  container_app_environment_id = azurerm_container_app_environment.ace.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  registry {
    server   = "${var.acr_name}.azurecr.io"
    identity = "system-environment"
  }

  template {
    container {
      name   = "languagecontainer"
      image  = "${azurerm_container_registry.acr.login_server}/translator-app:latest"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "GEMINI_API_KEY"
        value = var.gemini_api_key
      }
      env {
        name  = "TRANSLATOR_KEY"
        value = var.translator_key
      }
      env {
        name  = "TRANSLATOR_ENDPOINT"
        value = azurerm_cognitive_account.translator.endpoint
      }
      env {
        name  = "TRANSLATOR_REGION"
        value = var.translator_location
      }
      env {
        name  = "SPEECH_KEY"
        value = var.speech_key
      }
      env {
        name  = "SPEECH_REGION"
        value = var.secondary_location
      }
      env {
        name  = "AZURE_STORAGE_CONNECTION_STRING"
        value = var.storage_connection_string
      }
      env {
        name  = "PORT"
        value = "3000"
      }
    }
  }

  ingress {
    allow_insecure_connections = false
    external_enabled           = true
    target_port                = 3000
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}
