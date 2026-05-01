import { useState, useEffect } from 'react';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { setAuthToken } from './services/api';
import TranslatorWidget from './components/TranslatorWidget';
import FileUploadDropzone from './components/FileUploadDropzone';
import HistorySidebar from './components/HistorySidebar';
import './index.css';

function App() {
  const [refreshHistory, setRefreshHistory] = useState(0);
  const [tokenReady, setTokenReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    if (isAuthenticated && accounts.length > 0) {
      const request = {
        scopes: [`api://${instance.config.auth.clientId}/access_as_user`],
        account: accounts[0]
      };

      instance.acquireTokenSilent(request)
        .then(response => {
          setAuthToken(response.accessToken);
          setTimeout(() => {
            setTokenReady(true);
          }, 500);
        })
        .catch(error => {
          console.error("Silent token acquisition failed, trying popup:", error);
          // If silent fails, try popup for personal accounts (needs consent)
          instance.acquireTokenPopup(request)
            .then(response => {
              setAuthToken(response.accessToken);
              setTokenReady(true);
            })
            .catch(popupError => {
              console.error("Popup token acquisition failed:", popupError);
              setAuthError(`Security check failed: ${popupError.message}`);
              setTokenReady(false);
            });
        });
    } else {
      setTokenReady(false);
    }
  }, [isAuthenticated, accounts, instance]);

  const handleTranslationSaved = () => {
    setRefreshHistory(prev => prev + 1);
  };

  const handleLogin = () => {
    setAuthError(null);
    instance.loginPopup({
      scopes: [`api://${instance.config.auth.clientId}/access_as_user`],
    }).then(response => {
      setAuthToken(response.accessToken);
      setTimeout(() => {
        setTokenReady(true);
      }, 500);
    }).catch(error => {
      console.error("Login failed:", error);
      setAuthError(`Sign-in failed: ${error.message}`);
    });
  };

  const handleLogout = () => {
    setAuthToken(null);
    setTokenReady(false);
    instance.logoutPopup();
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-top">
          <div className="title-group">
            <h1>Smart Cloud Language Translator</h1>
            <p className="subtitle">Powered by Azure AI Services</p>
          </div>
          <div className="user-nav">
            <AuthenticatedTemplate>
              {accounts[0] && <span className="user-name">Welcome, {accounts[0].name}</span>}
              <button className="auth-button logout" onClick={handleLogout}>Sign Out</button>
            </AuthenticatedTemplate>
            <UnauthenticatedTemplate>
              <button className="auth-button login" onClick={handleLogin}>Sign In</button>
            </UnauthenticatedTemplate>
          </div>
        </div>
      </header>

      <main>
        <AuthenticatedTemplate>
          {tokenReady ? (
            <div className="dashboard-grid">
              <div className="main-content">
                <TranslatorWidget onTranslationSaved={handleTranslationSaved} />
                <FileUploadDropzone onTranslationSaved={handleTranslationSaved} />
              </div>
              <div className="sidebar-content">
                <HistorySidebar refreshTrigger={refreshHistory} />
              </div>
            </div>
          ) : (
            <div className="loading-container" style={{ textAlign: 'center', padding: '50px' }}>
              <p>Initializing secure session...</p>
            </div>
          )}
        </AuthenticatedTemplate>

        <UnauthenticatedTemplate>
          <div className="login-prompt">
            <div className="prompt-card">
              <h2>Secure Access Required</h2>
              <p>Please sign in with your Microsoft account to use the translation services.</p>
              
              {authError && (
                <div className="auth-error-box" style={{ color: '#ff4d4d', backgroundColor: 'rgba(255, 77, 77, 0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid rgba(255, 77, 77, 0.3)' }}>
                  <strong>Error:</strong> {authError}
                </div>
              )}

              <button className="cta-button" onClick={handleLogin}>Sign In with Microsoft</button>
            </div>
          </div>
        </UnauthenticatedTemplate>
      </main>
    </div>
  );
}

export default App;
