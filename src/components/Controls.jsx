import React from 'react';

const Controls = ({ selectedGridSize, setSelectedGridSize }) => {
  return (
    <div className="controls-container" style={styles.container}>
      <div style={styles.controlGroup}>
        <h3 style={styles.heading}>Grid Resolution</h3>
        <div style={styles.buttonGroup}>
          <button 
            style={{
              ...styles.button,
              ...(selectedGridSize === '10x10m' ? styles.activeButton : {})
            }}
            onClick={() => setSelectedGridSize('10x10m')}
          >
            10x10m
          </button>
          <button 
            style={{
              ...styles.button,
              ...(selectedGridSize === '20x20m' ? styles.activeButton : {})
            }}
            onClick={() => setSelectedGridSize('20x20m')}
          >
            20x20m
          </button>
        </div>
      </div>
      
      <div style={styles.legend}>
        <h3 style={styles.heading}>Stress Level</h3>
        <div style={styles.gradientBar}>
          <div style={styles.gradient}></div>
          <div style={styles.labels}>
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </div>
        <div style={styles.legendNote}>
          <p>NDVI Values: Green (healthy) to Red (stressed)</p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '5px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    margin: '10px 0',
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap'
  },
  controlGroup: {
    marginBottom: '10px',
    flex: '1',
    minWidth: '200px'
  },
  heading: {
    margin: '0 0 10px 0',
    fontSize: '16px',
    fontWeight: 'bold'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px'
  },
  button: {
    padding: '8px 15px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease'
  },
  activeButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    borderColor: '#3e8e41'
  },
  legend: {
    flex: '1',
    minWidth: '200px'
  },
  gradientBar: {
    marginBottom: '5px'
  },
  gradient: {
    height: '20px',
    width: '100%',
    borderRadius: '4px',
    background: 'linear-gradient(to right, green, yellow, orange, red)',
    marginBottom: '5px'
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#666'
  },
  legendNote: {
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic'
  }
};

export default Controls;