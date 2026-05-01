import React from 'react'
import ReactDOM from 'react-dom/client'
import { PublicClientApplication, EventType } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import App from './App.jsx'
import './index.css'

// Dynamic initialization to support Container App environment variables
const renderApp = async () => {
    let clientId = import.meta.env.VITE_ENTRA_ID_CLIENT_ID;
    let tenantId = import.meta.env.VITE_ENTRA_ID_TENANT_ID;

    // In production, fetch from the backend to support runtime env vars
    if (!clientId || clientId === "undefined") {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                clientId = config.clientId;
                tenantId = config.tenantId;
            }
        } catch (err) {
            console.error("Failed to fetch runtime config:", err);
        }
    }

    const msalConfig = {
        auth: {
            clientId: clientId || "",
            authority: "https://login.microsoftonline.com/common",
            redirectUri: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
                ? "http://localhost:5173/" 
                : "https://languagecontainer.ambitiousbush-91dcd67b.centralindia.azurecontainerapps.io/",
        },
        cache: {
            cacheLocation: "sessionStorage",
            storeAuthStateInCookie: false,
        }
    };

    const msalInstance = new PublicClientApplication(msalConfig);

    // Default to the first account if one exists
    if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
        msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
    }

    msalInstance.addEventCallback((event) => {
        if (event.eventType === EventType.LOGIN_SUCCESS && event.payload.account) {
            msalInstance.setActiveAccount(event.payload.account);
        }
    });

    ReactDOM.createRoot(document.getElementById('root')).render(
        <React.StrictMode>
            <MsalProvider instance={msalInstance}>
                <App clientId={clientId} />
            </MsalProvider>
        </React.StrictMode>,
    );
};

renderApp();
