import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import GeoRasterLayer from 'georaster-layer-for-leaflet';
import Heatmap from './Heatmap';
import COGLoader from '../services/cogLoader';

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const Map = ({ selectedGridSize }) => {
  const mapRef = useRef(null);
  const [geoTiffLayer, setGeoTiffLayer] = useState(null);
  const [stressData1, setStressData1] = useState(null);
  const [stressData2, setStressData2] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  
  // Load GeoTIFF data
  useEffect(() => {
    const loadGeoTiff = async () => {
      try {
        const cogLoader = new COGLoader();
        const { bounds, width, height, pixelScale } = await cogLoader.initialize('/sample_data/sample.tif');
        
        // Set map bounds immediately
        setMapBounds(bounds);
        
        // Read optimal resolution data
        const formattedValues = await cogLoader.readOptimalResolution(
          bounds,
          Math.min(width, 256),  // Target width
          Math.min(height, 256)  // Target height
        );
        
        // Create georaster object
        const georaster = {
          noDataValue: 0,
          pixelWidth: pixelScale[0],
          pixelHeight: pixelScale[1],
          xmin: bounds[0][1],
          ymin: bounds[0][0],
          xmax: bounds[1][1],
          ymax: bounds[1][0],
          values: formattedValues,
          width,
          height,
          projection: 4326
        };
        
        // Create GeoRasterLayer
        const layer = new GeoRasterLayer({
          georaster,
          opacity: 0.7,
          resolution: 256,
          pixelValuesToColorFn: values => {
            if (!values || values.length === 0) return null;
            const value = values[0];
            if (value === undefined || value === georaster.noDataValue) return null;
            const normalizedValue = Math.min(255, Math.max(0, Math.floor(value)));
            return `rgb(${normalizedValue}, ${normalizedValue}, ${normalizedValue})`;
          }
        });
        
        setGeoTiffLayer(layer);
        console.log('GeoRasterLayer created successfully');
      } catch (error) {
        console.error('Error loading GeoTIFF:', error);
        if (!mapBounds) {
          setMapBounds([[0, 0], [1, 1]]);
        }
      }
    };
    
    loadGeoTiff();
  }, []);
  
  // Load stress data based on selected grid size
  useEffect(() => {
    const loadStressData = async () => {
      try {
        // Load both stress data files simultaneously
        try {
          const [response1, response2] = await Promise.all([
            fetch(window.location.origin + '/sample_data/stress_sample.json'),
            fetch(window.location.origin + '/sample_data/stress_sample_2.json')
          ]);

          if (!response1.ok || !response2.ok) {
            console.warn('Some stress data files could not be loaded');
            const availableData = [];
            if (response1.ok) {
              const data = await response1.json();
              if (Array.isArray(data)) availableData.push(data);
            }
            if (response2.ok) {
              const data = await response2.json();
              if (Array.isArray(data)) availableData.push(data);
            }
            if (availableData.length > 0) {
              setStressData1(availableData[0]);
              if (availableData.length > 1) setStressData2(availableData[1]);
              return;
            }
            throw new Error(`Failed to load stress data files: ${response1.ok ? '' : response1.statusText} ${response2.ok ? '' : response2.statusText}`);
          }

          let data1, data2;
          try {
            [data1, data2] = await Promise.all([
              response1.json(),
              response2.json()
            ]);
          } catch (parseError) {
            console.error('Error parsing stress data JSON:', parseError);
            throw new Error('Invalid JSON format in stress data files');
          }

          // Validate data structure with more detailed error messages
          if (!Array.isArray(data1) || !Array.isArray(data2)) {
            console.warn('Invalid stress data format, expected array. Using empty arrays as fallback.');
            setStressData1([]);
            setStressData2([]);
            return;
          }

        console.log(`Successfully loaded stress data files: ${data1.length} and ${data2.length} points`);
        setStressData1(data1);
        setStressData2(data2);
      } catch (error) {
        console.error('Error loading stress data:', error);
      }
    };
    
    loadStressData();
  }, [selectedGridSize]);
  
  // Add GeoTIFF layer to map when available
  useEffect(() => {
    if (mapRef.current && geoTiffLayer && mapBounds) {
      const map = mapRef.current;
      
      // Add GeoTIFF layer
      geoTiffLayer.addTo(map);
      
      // Set map bounds
      map.fitBounds(mapBounds);
      
      return () => {
        map.removeLayer(geoTiffLayer);
      };
    }
  }, [mapRef, geoTiffLayer, mapBounds]);
  
  return (
    <div style={{ height: '80vh', width: '100%' }}>
      {mapBounds ? (
        <MapContainer
          ref={mapRef}
          center={[0, 0]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {stressData1 && <Heatmap data={stressData1} map={mapRef.current} />}
          {stressData2 && <Heatmap data={stressData2} map={mapRef.current} />}
        </MapContainer>
      ) : (
        <div>Loading map...</div>
      )}
    </div>
  );
};

export default Map;