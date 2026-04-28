output "resource_group_name" {
  value = azurerm_resource_group.rg.name
}

output "storage_account_name" {
  value = azurerm_storage_account.storage.name
}

output "translator_endpoint" {
  value = azurerm_cognitive_account.translator.endpoint
}

output "speech_region" {
  value = azurerm_cognitive_account.speech.location
}

output "acr_login_server" {
  value = azurerm_container_registry.acr.login_server
}

output "container_app_url" {
  value = azurerm_container_app.app.latest_revision_fqdn
}

output "key_vault_uri" {
  value = azurerm_key_vault.vault.vault_uri
}
