import { useState } from 'react';
import TranslatorWidget from './components/TranslatorWidget';
import FileUploadDropzone from './components/FileUploadDropzone';
import HistorySidebar from './components/HistorySidebar';
import './index.css';

function App() {
  const [refreshHistory, setRefreshHistory] = useState(0);

  const handleTranslationSaved = () => {
    setRefreshHistory(prev => prev + 1);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Smart Cloud Language Translator</h1>
        <p className="subtitle">Powered by Azure AI Services</p>
      </header>

      <div className="dashboard-grid">
        <div className="main-content">
          <TranslatorWidget onTranslationSaved={handleTranslationSaved} />
          <FileUploadDropzone onTranslationSaved={handleTranslationSaved} />
        </div>
        <div className="sidebar-content">
          <HistorySidebar refreshTrigger={refreshHistory} />
        </div>
      </div>
    </div>
  );
}

export default App;
