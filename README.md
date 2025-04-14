# Stress Data Visualization Application 🌍

A React-based web application for visualizing geographical stress data using interactive heatmaps and markers. The application processes GeoJSON and Cloud-Optimized GeoTIFF (COG) data to create intuitive visualizations of stress patterns across different locations.

## 🚀 Features

- Interactive heatmap visualization
- Real-time stress data processing
- High-performance data handling with Web Workers
- Customizable stress thresholds
- Zoom and pan controls
- Stress hotspot identification
- Statistical overview panel

## 📊 Data Flow & Architecture

### 1. Data Loading Pipeline
```mermaid
graph TD
    A[JSON/GeoTIFF Data] --> B[Web Worker]
    B --> C[Data Processing]
    C --> D[Batch Processing]
    D --> E[Visualization Layer]
```

1. **Initial Data Loading**
   - Loads GeoJSON data from `sample_data/stress_sample.json`
   - Processes Cloud-Optimized GeoTIFF files
   - Validates data structure and format

2. **Data Processing**
   - Web Worker handles heavy computation
   - Chunks data for efficient processing
   - Normalizes values to 0-255 range
   - Filters invalid data points

3. **Visualization Preparation**
   - Converts coordinates to map points
   - Calculates stress intensity
   - Prepares heatmap data layer
   - Creates marker data for hotspots

### 2. Map Component Workflow

```javascript
// Key configuration
const STRESS_THRESHOLD = 0.7;  // High stress threshold
const GRID_CELL_SIZE = 20;     // Grid resolution in cm
```

1. **Map Initialization**
   - Sets up Leaflet map instance
   - Configures initial bounds and zoom
   - Prepares layer containers

2. **Heatmap Layer**
   - Configures heatmap settings
   - Applies color gradient
   - Handles zoom levels
   - Updates on data changes

3. **Marker Management**
   - Batch processes markers
   - Implements efficient rendering
   - Handles marker cleanup

