import React, { useEffect, useState } from 'react';
import L from 'leaflet';

const StressHighlighter = ({ data, map }) => {
  const [hotspotLayers, setHotspotLayers] = useState([]);
  
  useEffect(() => {
    if (!map || !data || !data.features) return;
    
    // Clean up previous layers
    hotspotLayers.forEach(layer => {
      map.removeLayer(layer);
    });
    
    // Process GeoJSON data to identify stress hotspots
    const hotspotThreshold = 0.3; // NDVI threshold for stress
    const hotspotFeatures = data.features.filter(feature => {
      return feature.properties.ndvi < hotspotThreshold;
    });
    
    // Group hotspots by proximity
    const hotspotGroups = groupHotspotsByProximity(hotspotFeatures);
    
    // Create layers for each hotspot group
    const newLayers = hotspotGroups.map((group, index) => {
      // Create a polygon that encompasses the group
      const points = group.map(feature => {
        const coords = feature.geometry.coordinates[0];
        return coords.map(coord => [coord[1], coord[0]]);
      }).flat();
      
      // Calculate convex hull or simple bounding area
      const boundaryPoints = calculateBoundary(points);
      
      // Create a polygon layer with dashed red border
      const polygon = L.polygon(boundaryPoints, {
        color: 'red',
        weight: 2,
        fillOpacity: 0.1,
        dashArray: '5, 5',
        className: 'stress-hotspot'
      });
      
      // Add tooltip with information
      const avgNdvi = group.reduce((sum, feature) => sum + feature.properties.ndvi, 0) / group.length;
      polygon.bindTooltip(`Stress Hotspot #${index + 1}<br>Average NDVI: ${avgNdvi.toFixed(2)}<br>Affected Areas: ${group.length}`);
      
      // Add to map
      polygon.addTo(map);
      
      return polygon;
    });
    
    setHotspotLayers(newLayers);
    
    return () => {
      newLayers.forEach(layer => {
        map.removeLayer(layer);
      });
    };
  }, [data, map]);
  
  // Group hotspots by proximity
  const groupHotspotsByProximity = (features) => {
    if (features.length === 0) return [];
    
    const groups = [];
    const processed = new Set();
    
    features.forEach((feature, index) => {
      if (processed.has(index)) return;
      
      const group = [feature];
      processed.add(index);
      
      // Find neighbors recursively
      const findNeighbors = (currentFeature) => {
        features.forEach((otherFeature, otherIndex) => {
          if (processed.has(otherIndex)) return;
          
          if (arePolygonsClose(currentFeature, otherFeature, 0.001)) { // ~100m proximity threshold
            group.push(otherFeature);
            processed.add(otherIndex);
            findNeighbors(otherFeature);
          }
        });
      };
      
      findNeighbors(feature);
      groups.push(group);
    });
    
    return groups;
  };
  
  // Check if two polygons are close to each other
  const arePolygonsClose = (poly1, poly2, threshold) => {
    // Simple centroid distance check
    const centroid1 = calculateCentroid(poly1.geometry.coordinates[0]);
    const centroid2 = calculateCentroid(poly2.geometry.coordinates[0]);
    
    const distance = Math.sqrt(
      Math.pow(centroid1[0] - centroid2[0], 2) + 
      Math.pow(centroid1[1] - centroid2[1], 2)
    );
    
    return distance < threshold;
  };
  
  // Calculate centroid of a polygon
  const calculateCentroid = (coordinates) => {
    let x = 0;
    let y = 0;
    
    coordinates.forEach(coord => {
      x += coord[0];
      y += coord[1];
    });
    
    return [x / coordinates.length, y / coordinates.length];
  };
  
  // Calculate a simple boundary for a group of points
  const calculateBoundary = (points) => {
    // For simplicity, we'll just use a convex hull approximation
    // In a real implementation, you might want to use a proper convex hull algorithm
    
    // Find extremes
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    points.forEach(point => {
      minX = Math.min(minX, point[0]);
      minY = Math.min(minY, point[1]);
      maxX = Math.max(maxX, point[0]);
      maxY = Math.max(maxY, point[1]);
    });
    
    // Create a simple bounding box with some padding
    const padding = 0.0001; // ~10m
    return [
      [minX - padding, minY - padding],
      [minX - padding, maxY + padding],
      [maxX + padding, maxY + padding],
      [maxX + padding, minY - padding]
    ];
  };
  
  return null; // This component doesn't render anything directly
};

export default StressHighlighter;