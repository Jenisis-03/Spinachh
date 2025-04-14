import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'heatmap.js';
import chroma from 'chroma-js';

const Heatmap = ({ data, map }) => {
  const heatmapLayerRef = useRef(null);
  
  useEffect(() => {
    if (!map || !data || !data.features) return;
    
    // Clean up previous heatmap layer
    if (heatmapLayerRef.current) {
      map.removeLayer(heatmapLayerRef.current);
    }
    
    // Process GeoJSON data to extract points and values
    const points = [];
    data.features.forEach(feature => {
      if (feature.geometry && feature.geometry.type === 'Polygon') {
        // Calculate centroid of polygon
        const coordinates = feature.geometry.coordinates[0];
        let lat = 0;
        let lng = 0;
        
        coordinates.forEach(coord => {
          lng += coord[0];
          lat += coord[1];
        });
        
        lat /= coordinates.length;
        lng /= coordinates.length;
        
        // Get NDVI value from properties
        const ndviValue = feature.properties.ndvi || 0;
        
        // Invert NDVI for stress visualization (lower NDVI = higher stress)
        // NDVI ranges from -1 to 1, with healthy vegetation having higher values
        const stressValue = 1 - ((ndviValue + 1) / 2); // Normalize to 0-1 range and invert
        
        points.push({
          lat,
          lng,
          value: stressValue
        });
      }
    });
    
    // Configure heatmap
    const heatmapConfig = {
      radius: 25,
      maxOpacity: 0.8,
      scaleRadius: true,
      useLocalExtrema: true,
      latField: 'lat',
      lngField: 'lng',
      valueField: 'value',
      gradient: {
        '0.0': 'green',  // Low stress (high NDVI)
        '0.5': 'yellow', // Medium stress
        '0.8': 'orange', // High stress
        '1.0': 'red'     // Very high stress (low NDVI)
      }
    };
    
    // Create heatmap layer
    const heatmapLayer = new HeatmapOverlay(heatmapConfig);
    heatmapLayer.setData({
      max: 1,
      data: points
    });
    
    // Add to map
    heatmapLayer.addTo(map);
    heatmapLayerRef.current = heatmapLayer;
    
    // Identify stress hotspots (bonus feature)
    const hotspotThreshold = 0.7; // Corresponds to NDVI < 0.3
    const hotspots = points.filter(point => point.value > hotspotThreshold);
    
    // Highlight hotspots with markers
    hotspots.forEach(hotspot => {
      const marker = L.circleMarker([hotspot.lat, hotspot.lng], {
        radius: 10,
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.5,
        weight: 2,
        dashArray: '5, 5'
      }).addTo(map);
      
      marker.bindTooltip(`Stress Level: ${Math.round(hotspot.value * 100)}%`);
    });
    
    return () => {
      if (heatmapLayerRef.current) {
        map.removeLayer(heatmapLayerRef.current);
      }
    };
  }, [data, map]);
  
  return null; // This component doesn't render anything directly
};

// HeatmapOverlay implementation for Leaflet
class HeatmapOverlay extends L.Layer {
  constructor(config) {
    super();
    this.cfg = {
      radius: 25,
      maxOpacity: 0.8,
      scaleRadius: false,
      useLocalExtrema: false,
      latField: 'lat',
      lngField: 'lng',
      valueField: 'value',
      ...config
    };
    this._data = [];
    this._max = 1;
    this._min = 0;
  }
  
  onAdd(map) {
    this._map = map;
    
    // Create canvas element
    const size = this._map.getSize();
    this._el = L.DomUtil.create('canvas', 'leaflet-heatmap-layer');
    
    this._el.width = size.x;
    this._el.height = size.y;
    this._el.style.position = 'absolute';
    this._el.style.top = 0;
    this._el.style.left = 0;
    this._el.style.pointerEvents = 'none';
    
    this._map._panes.overlayPane.appendChild(this._el);
    
    this._ctx = this._el.getContext('2d');
    
    // Listen to map events
    map.on('moveend', this._reset, this);
    map.on('resize', this._resize, this);
    
    if (this._data.length > 0) {
      this._draw();
    }
    
    return this;
  }
  
  onRemove(map) {
    map.getPanes().overlayPane.removeChild(this._el);
    map.off('moveend', this._reset, this);
    map.off('resize', this._resize, this);
  }
  
  setData(data) {
    this._data = data.data || [];
    this._max = data.max || 1;
    this._min = data.min || 0;
    
    if (this._map) {
      this._draw();
    }
    return this;
  }
  
  _resize() {
    const size = this._map.getSize();
    this._el.width = size.x;
    this._el.height = size.y;
    this._draw();
  }
  
  _reset() {
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._el, topLeft);
    this._draw();
  }
  
  _draw() {
    if (!this._map) return;
    
    const ctx = this._ctx;
    const size = this._map.getSize();
    const bounds = this._map.getBounds();
    const colorScale = chroma.scale(['green', 'yellow', 'orange', 'red']).domain([0, 1]);
    
    ctx.clearRect(0, 0, size.x, size.y);
    
    // Draw points
    this._data.forEach(point => {
      const latLng = L.latLng(point[this.cfg.latField], point[this.cfg.lngField]);
      if (bounds.contains(latLng)) {
        const pixelPoint = this._map.latLngToContainerPoint(latLng);
        const value = point[this.cfg.valueField];
        const radius = this.cfg.scaleRadius ? this.cfg.radius * value : this.cfg.radius;
        
        // Draw gradient circle
        const gradient = ctx.createRadialGradient(
          pixelPoint.x, pixelPoint.y, 0,
          pixelPoint.x, pixelPoint.y, radius
        );
        
        const color = colorScale(value).hex();
        gradient.addColorStop(0, chroma(color).alpha(this.cfg.maxOpacity).css());
        gradient.addColorStop(1, chroma(color).alpha(0).css());
        
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(pixelPoint.x, pixelPoint.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

export default Heatmap;