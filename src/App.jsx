import { useState, useEffect } from 'react';
import Map from './components/Map';
import Controls from './components/Controls';
import StressHighlighter from './components/StressHighlighter';
import { loadStressData } from './services/dataProcessor';
import './App.css';

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
        const fileName = selectedGridSize === '20x20m' 
          ? 'https://drive.google.com/uc?export=download&id=1vxhgJLAmfK7o-IfQMUKeVsZTW1RqVw7N'  // stress_sample_2.json
          : 'https://drive.google.com/uc?export=download&id=1bSGUpQ7BH63sz9gzUGnd3xb-n2hoDwyz'; // stress_sample.json
        const data = await loadStressData(fileName);
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
        <Map selectedGridSize={selectedGridSize} />
      )}

      <footer>
        <p>Spinach Field Stress Visualization Tool | Grid Resolution: {selectedGridSize}</p>
      </footer>
    </div>
  );
}

export default App;
