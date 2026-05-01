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

resource "azurerm_application_insights" "insights" {
  name                = var.application_insights_name
  location            = var.secondary_location
  resource_group_name = azurerm_resource_group.rg.name
  workspace_id        = azurerm_log_analytics_workspace.logs.id
  application_type    = "web"
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

resource "azurerm_cognitive_account" "openai" {
  name                = var.cognitive_openai_name
  location            = var.openai_location
  resource_group_name = azurerm_resource_group.rg.name
  kind                = "OpenAI"
  sku_name            = "S0"
  custom_subdomain_name = lower(var.cognitive_openai_name)
}

resource "azurerm_cognitive_deployment" "gpt" {
  name                 = var.openai_deployment_name
  cognitive_account_id = azurerm_cognitive_account.openai.id
  model {
    format  = "OpenAI"
    name    = "gpt-5.4" 
    version = "2026-03-05"
  }
  scale {
    type     = "GlobalStandard"
    capacity = 150
  }
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

resource "azurerm_key_vault_secret" "openai_key" {
  name         = "openai-key"
  value        = azurerm_cognitive_account.openai.primary_access_key
  key_vault_id = azurerm_key_vault.vault.id
}

resource "azurerm_key_vault_secret" "translator_key" {
  name         = "translator-key"
  value        = var.translator_key
  key_vault_id = azurerm_key_vault.vault.id
}

resource "azurerm_key_vault_secret" "speech_key" {
  name         = "speech-key"
  value        = var.speech_key
  key_vault_id = azurerm_key_vault.vault.id
}

resource "azurerm_key_vault_secret" "storage_connection_string" {
  name         = "storage-connection-string"
  value        = var.storage_connection_string
  key_vault_id = azurerm_key_vault.vault.id
}

resource "azuread_application" "auth_app" {
  display_name     = "LanguageTranslatorAuth"
  identifier_uris  = ["api://a8d1fae3-68a9-4911-9d29-685fa82eaedf"]
  owners           = [data.azurerm_client_config.current.object_id]
  sign_in_audience = "AzureADandPersonalMicrosoftAccount"

  api {
    mapped_claims_enabled          = true
    requested_access_token_version = 2
    
    oauth2_permission_scope {
      admin_consent_description  = "Allow the application to access the translation services on behalf of the signed-in user."
      admin_consent_display_name = "Access Translation Services"
      enabled                    = true
      id                         = "c4603943-7f21-4f10-b984-b040e0176378"
      type                       = "User"
      user_consent_description   = "Allow the application to access the translation services on your behalf."
      user_consent_display_name  = "Access Translation Services"
      value                      = "access_as_user"
    }
  }

  single_page_application {
    redirect_uris = [
      "http://localhost:5173/",
      "https://languagecontainer.ambitiousbush-91dcd67b.centralindia.azurecontainerapps.io/"
    ]
  }

  required_resource_access {
    resource_app_id = "00000003-0000-0000-c000-000000000000" # Microsoft Graph

    resource_access {
      id   = "e1fe6dd8-ba31-4d61-89e7-88639da4683d" # User.Read
      type = "Scope"
    }
  }
}

resource "azuread_service_principal" "auth_sp" {
  client_id                    = azuread_application.auth_app.client_id
  app_role_assignment_required = false
  owners                       = [data.azurerm_client_config.current.object_id]
}

data "azurerm_client_config" "current" {}

resource "azurerm_user_assigned_identity" "aca_identity" {
  name                = "${var.container_app_name}-identity"
  location            = var.secondary_location
  resource_group_name = azurerm_resource_group.rg.name
}

resource "azurerm_container_app" "app" {
  name                         = var.container_app_name
  container_app_environment_id = azurerm_container_app_environment.ace.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.aca_identity.id]
  }

  secret {
    name                = "openai-key"
    key_vault_secret_id = azurerm_key_vault_secret.openai_key.versionless_id
    identity            = azurerm_user_assigned_identity.aca_identity.id
  }

  secret {
    name                = "translator-key"
    key_vault_secret_id = azurerm_key_vault_secret.translator_key.versionless_id
    identity            = azurerm_user_assigned_identity.aca_identity.id
  }

  secret {
    name                = "speech-key"
    key_vault_secret_id = azurerm_key_vault_secret.speech_key.versionless_id
    identity            = azurerm_user_assigned_identity.aca_identity.id
  }

  secret {
    name                = "storage-connection-string"
    key_vault_secret_id = azurerm_key_vault_secret.storage_connection_string.versionless_id
    identity            = azurerm_user_assigned_identity.aca_identity.id
  }

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
        name  = "AZURE_OPENAI_ENDPOINT"
        value = azurerm_cognitive_account.openai.endpoint
      }
      env {
        name  = "AZURE_OPENAI_KEY"
        secret_name = "openai-key"
      }
      env {
        name  = "AZURE_OPENAI_DEPLOYMENT_NAME"
        value = var.openai_deployment_name
      }
      env {
        name  = "TRANSLATOR_KEY"
        secret_name = "translator-key"
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
        secret_name = "speech-key"
      }
      env {
        name  = "SPEECH_REGION"
        value = var.secondary_location
      }
      env {
        name  = "AZURE_STORAGE_CONNECTION_STRING"
        secret_name = "storage-connection-string"
      }
      env {
        name  = "PORT"
        value = "3000"
      }
      env {
        name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        value = azurerm_application_insights.insights.connection_string
      }
      env {
        name  = "ENTRA_ID_CLIENT_ID"
        value = azuread_application.auth_app.client_id
      }
      env {
        name  = "ENTRA_ID_TENANT_ID"
        value = data.azurerm_client_config.current.tenant_id
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
resource "azurerm_role_assignment" "containerapp_kv_secrets" {
  scope                = azurerm_key_vault.vault.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.aca_identity.principal_id
}

resource "azurerm_role_assignment" "current_user_kv_officer" {
  scope                = azurerm_key_vault.vault.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_monitor_diagnostic_setting" "openai_diag" {
  name                       = "openai-diagnostics"
  target_resource_id         = azurerm_cognitive_account.openai.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id

  enabled_log {
    category = "Audit"
  }
  enabled_log {
    category = "RequestResponse"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

resource "azurerm_monitor_diagnostic_setting" "translator_diag" {
  name                       = "translator-diagnostics"
  target_resource_id         = azurerm_cognitive_account.translator.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id

  enabled_log {
    category = "Audit"
  }
  enabled_log {
    category = "RequestResponse"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

resource "azurerm_monitor_diagnostic_setting" "speech_diag" {
  name                       = "speech-diagnostics"
  target_resource_id         = azurerm_cognitive_account.speech.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id

  enabled_log {
    category = "Audit"
  }
  enabled_log {
    category = "RequestResponse"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

resource "azurerm_monitor_diagnostic_setting" "kv_diag" {
  name                       = "kv-diagnostics"
  target_resource_id         = azurerm_key_vault.vault.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id

  enabled_log {
    category = "AuditEvent"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}
