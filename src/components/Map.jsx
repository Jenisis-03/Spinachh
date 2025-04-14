/**
 * Map.jsx - Main component for visualizing stress data on an interactive map
 * 
 * Key Features:
 * - Displays a heatmap of stress data with color gradients
 * - Shows markers for high-stress areas
 * - Provides an overview panel with statistics
 * - Implements efficient data processing using Web Workers
 * - Uses batch processing for smooth marker rendering
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import Heatmap from './Heatmap';
import 'leaflet/dist/leaflet.css';

// Configuration Constants
/** Grid cell size in centimeters for data resolution */
const GRID_CELL_SIZE = 20;
/** Threshold value above which stress is considered high */
const STRESS_THRESHOLD = 0.7;
/** Default zoom level for initial map view */
const DEFAULT_ZOOM = 18;
/** Default center coordinates [latitude, longitude] */
const DEFAULT_CENTER = [-37.6868, 144.4569];
/** Default map bounds [[south, west], [north, east]] */
const DEFAULT_BOUNDS = [[-37.6870, 144.4567], [-37.6866, 144.4571]];

/** 
 * Heatmap visualization configuration
 * - radius: Size of each data point (smaller = better performance)
 * - blur: Smoothing effect (smaller = sharper boundaries)
 * - gradient: Color scheme for stress levels
 */
const HEATMAP_CONFIG = {
  radius: 12, // Reduced for better performance
  blur: 8,    // Reduced for better performance
  maxZoom: 20,
  minOpacity: 0.4,
  gradient: {
    0.0: '#00ff00',  // Healthy (green)
    0.4: '#ffff00',  // Moderate stress (yellow)
    0.7: '#ff0000'   // High stress (red)
  }
};

// Marker settings
const MARKER_CONFIG = {
  radius: 2,
  color: '#ff0000',
  fillColor: '#ff0000',
  fillOpacity: 0.6,
  weight: 1
};

/**
 * Creates and configures a Web Worker for processing GeoJSON data
 * @returns {Worker} Configured Web Worker instance
 */
const createWorker = () => {
  const workerCode = `
    self.onmessage = function(e) {
      const { features, chunkSize, startIndex } = e.data;
      const endIndex = Math.min(startIndex + chunkSize, features.length);
      const processedPoints = [];

      for (let i = startIndex; i < endIndex; i++) {
        const feature = features[i];
        try {
          if (!feature?.geometry?.coordinates?.[0]?.[0] || !feature?.properties?.value) {
            continue;
          }

          const coordinates = feature.geometry.coordinates[0];
          const len = coordinates.length - 1;
          let sumLat = 0;
          let sumLng = 0;

          for (let j = 0; j < len; j++) {
            sumLng += coordinates[j][0];
            sumLat += coordinates[j][1];
          }

          processedPoints.push({
            lat: sumLat / len,
            lng: sumLng / len,
            value: parseFloat(feature.properties.value)
          });
        } catch {
          continue;
        }
      }

      self.postMessage({
        points: processedPoints,
        startIndex,
        endIndex,
        isLastChunk: endIndex >= features.length
      });
    };
  `;

  return new Worker(URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' })));
};

/**
 * Custom hook for managing stress hotspot markers
 * @param {L.Map} map - Leaflet map instance
 * @param {Object} stressData - Processed stress data
 * @returns {Array} Array of high-stress points
 */
const useStressHotspots = (map, stressData) => {
  const markersLayerRef = useRef(null);
  const highStressPointsRef = useRef([]);
  const markerBatchingRef = useRef(null);

  useEffect(() => {
    if (!map || !stressData?.data) return;

    try {
      // Remove existing markers
      if (markersLayerRef.current) {
        map.removeLayer(markersLayerRef.current);
      }

      // Create new markers group
      const markersLayer = L.layerGroup();
      markersLayerRef.current = markersLayer;

      // Filter and store high stress points
      highStressPointsRef.current = stressData.data
        .filter(point => point.value > STRESS_THRESHOLD && point.lat && point.lng)
        .slice(0, 1000); // Limit markers for performance

      // Add markers in batches for better performance
      const batchSize = 50; // Reduced batch size for smoother rendering
      let currentBatch = 0;
      let isProcessing = false;

      function addMarkerBatch() {
        if (!isProcessing) {
          isProcessing = true;
          const start = currentBatch * batchSize;
          const end = Math.min(start + batchSize, highStressPointsRef.current.length);
          
          if (start >= highStressPointsRef.current.length) {
            markersLayer.addTo(map);
            return;
          }

          for (let i = start; i < end; i++) {
            const point = highStressPointsRef.current[i];
            L.circle([point.lat, point.lng], {
              ...MARKER_CONFIG,
              radius: MARKER_CONFIG.radius
            })
            .bindTooltip(`Stress Level: ${Math.round(point.value * 100)}%`, {
              permanent: false,
              direction: 'top'
            })
            .addTo(markersLayer);
          }

          currentBatch++;
          isProcessing = false;
          markerBatchingRef.current = requestAnimationFrame(addMarkerBatch);
        } else {
          markerBatchingRef.current = requestAnimationFrame(addMarkerBatch);
        }
      }

      markerBatchingRef.current = requestAnimationFrame(addMarkerBatch);
    } catch (error) {
      console.error('Error creating markers:', error);
    }

    return () => {
      if (markerBatchingRef.current) {
        cancelAnimationFrame(markerBatchingRef.current);
      }
      if (markersLayerRef.current && map) {
        map.removeLayer(markersLayerRef.current);
      }
    };
  }, [map, stressData]);

  return highStressPointsRef.current;
};

/**
 * StressOverview Component
 * Displays statistics about stress levels and provides controls
 * @param {Object} props.stressData - Processed stress data
 */
const StressOverview = React.memo(({ stressData }) => {
  const map = useMap();
  
  const stats = useMemo(() => {
    if (!stressData?.data) return null;
    
    const total = stressData.data.length;
    const highStress = stressData.data.filter(p => p.value > STRESS_THRESHOLD).length;
    const percentage = ((highStress / total) * 100).toFixed(1);
    
    return { total, highStress, percentage };
  }, [stressData]);

  const handleFocusHotspots = useCallback(() => {
    const highStressPoints = stressData.data
      .filter(p => p.value > STRESS_THRESHOLD && p.lat && p.lng)
      .map(p => [p.lat, p.lng]);
    if (highStressPoints.length > 0) {
      map.fitBounds(L.latLngBounds(highStressPoints), { padding: [50, 50] });
    }
  }, [map, stressData]);

  if (!stats) return null;

  return (
    <div className="stress-overview leaflet-control" style={{
      backgroundColor: 'white',
      padding: '10px',
      borderRadius: '4px',
      boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
      margin: '10px',
      zIndex: 1000
    }}>
      <h4 style={{ margin: '0 0 8px 0' }}>Stress Overview</h4>
      <p style={{ margin: '0 0 8px 0' }}>High Stress Areas: {stats.highStress} ({stats.percentage}%)</p>
      <button 
        onClick={handleFocusHotspots}
        style={{
          padding: '8px 16px',
          backgroundColor: '#ff4444',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Focus on Stress Hotspots
      </button>
    </div>
  );
});

/**
 * Main Map Component
 * Manages the overall map state and data processing
 */
const Map = ({ stressData: propStressData }) => {
  // State management for map and data
  const [map, setMap] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Refs for persistent values and cleanup
  const mapRef = useRef(null);
  const workerRef = useRef(null);
  const dataProcessingRef = useRef(null);

  /**
   * Process stress data using Web Worker
   */
  useEffect(() => {
    if (!propStressData?.features?.length) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadingProgress(0);

    console.log('Processing features:', propStressData.features.length);

    // Initialize Web Worker
    workerRef.current = createWorker();
    const points = [];
    const chunkSize = 2000; // Increased chunk size for Web Worker
    let processedCount = 0;
    const totalFeatures = propStressData.features.length;

    // Process data in chunks using Web Worker
    function processNextChunk() {
      if (processedCount >= totalFeatures) {
        finalizeData(points);
        return;
      }

      workerRef.current.postMessage({
        features: propStressData.features,
        chunkSize,
        startIndex: processedCount
      });
    }

    workerRef.current.onmessage = (e) => {
      const { points: newPoints, endIndex, isLastChunk } = e.data;
      points.push(...newPoints);
      processedCount = endIndex;

      // Update progress
      const progress = Math.round((processedCount / totalFeatures) * 100);
      setLoadingProgress(progress);

      if (isLastChunk) {
        finalizeData(points);
      } else {
        dataProcessingRef.current = requestAnimationFrame(processNextChunk);
      }
    };

    processNextChunk();

    return () => {
      if (dataProcessingRef.current) {
        cancelAnimationFrame(dataProcessingRef.current);
      }
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [propStressData]);

  function finalizeData(points) {
    if (points.length === 0) {
      console.error('No valid points found');
      setMapBounds(DEFAULT_BOUNDS);
      setIsLoading(false);
      return;
    }

    const validPoints = points.filter(p => !isNaN(p.lat) && !isNaN(p.lng));
    const lats = validPoints.map(p => p.lat);
    const lngs = validPoints.map(p => p.lng);

    if (lats.length > 0 && lngs.length > 0) {
      setMapBounds([
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ]);
    }

    setProcessedData({
      max: 1,
      min: 0,
      data: points,
      gradient: HEATMAP_CONFIG.gradient
    });

    setIsLoading(false);
  }

  // Use custom hook for stress hotspots
  useStressHotspots(map, processedData);

  // Handle map instance
  const handleMapInstance = useCallback((mapInstance) => {
    mapRef.current = mapInstance;
    if (mapInstance) {
      setMap(mapInstance);
      if (mapBounds) {
        mapInstance.fitBounds(mapBounds, {
          padding: [50, 50],
          maxZoom: DEFAULT_ZOOM
        });
      }
    }
  }, [mapBounds]);

  return (
    <div style={{ height: '80vh', width: '100%', position: 'relative' }}>
      {isLoading && (
        <div className="loading-overlay" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="loading-spinner" style={{
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div>Processing stress data...</div>
            <div style={{ marginTop: '10px' }}>{loadingProgress}%</div>
          </div>
        </div>
      )}
      <Suspense fallback={null}>
        <MapContainer
          ref={handleMapInstance}
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          maxBounds={mapBounds || DEFAULT_BOUNDS}
          maxBoundsViscosity={1.0}
          zoomControl={false}
          preferCanvas={true}
        >
          <ZoomControl position="topright" />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            noWrap={true}
          />
          {map && processedData && (
            <>
              <Heatmap 
                data={processedData} 
                map={map}
                {...HEATMAP_CONFIG}
              />
              <StressOverview stressData={processedData} />
            </>
          )}
        </MapContainer>
      </Suspense>
    </div>
  );
};

export default React.memo(Map);