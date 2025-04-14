import { useState, useEffect } from 'react';
import Map from './components/Map';
import Controls from './components/Controls';
import StressHighlighter from './components/StressHighlighter';
import { loadStressData } from './services/dataProcessor';
import './App.css';

// Data URLs configuration using direct Dropbox download links
const DATA_CONFIG = {
  urls: {
    // Using direct download links with the correct format
    stressSample1: 'https://dl.dropboxusercontent.com/scl/fi/wyd4lyva8j2a32tmz88xt/stress_sample.json?rlkey=k1gsltqlbpsxq9xe5bj6l3yi4&dl=1',
    stressSample2: 'https://dl.dropboxusercontent.com/scl/fi/ydwlolj2e6ejdrgu4tu2d/stress_sample_2.json?rlkey=xihy80jprjyqpswo8b9cmaev4&dl=1',
    tiffData: 'https://dl.dropboxusercontent.com/scl/fi/3xwie7omdavo1xz6wr2z1/sample.tif?rlkey=hrj3tmo2cj6g5d7b08un8q174&dl=1'
  }
};

function App() {
  const [selectedGridSize, setSelectedGridSize] = useState('10x10m');
  const [stressData, setStressData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load stress data based on selected grid size
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const dataUrl = selectedGridSize === '20x20m' 
          ? DATA_CONFIG.urls.stressSample2
          : DATA_CONFIG.urls.stressSample1;
        
        console.log('Fetching data from:', dataUrl); // Debug log
        const data = await loadStressData(dataUrl);
        console.log('Received data:', data); // Debug log
        setStressData(data);
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load stress data. Please try again.');
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedGridSize]);

  return (
    <div className="app-container">
      <header>
        <h1>Spinach Field Stress Visualization</h1>
        <p>Interactive visualization tool for monitoring crop stress in spinach fields</p>
      </header>

      <Controls 
        selectedGridSize={selectedGridSize} 
        setSelectedGridSize={setSelectedGridSize} 
      />

      {loading ? (
        <div className="loading">Loading data...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <Map 
          selectedGridSize={selectedGridSize}
          stressData={stressData}
          tiffUrl={DATA_CONFIG.urls.tiffData}
        />
      )}

      <footer>
        <p>Spinach Field Stress Visualization Tool | Grid Resolution: {selectedGridSize}</p>
      </footer>
    </div>
  );
}

export default App;
