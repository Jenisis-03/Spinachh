import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import chroma from 'chroma-js';
import PropTypes from 'prop-types';

const Heatmap = ({ data, map }) => {
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map || !data?.data) return;

    // Create or update the canvas layer
    if (!layerRef.current) {
      const HeatmapLayer = L.Layer.extend({
        onAdd: function(map) {
          const size = map.getSize();
          const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer');
          
          canvas.width = size.x;
          canvas.height = size.y;
          canvas.style.position = 'absolute';
          canvas.style.top = '0';
          canvas.style.left = '0';
          canvas.style.pointerEvents = 'none';
          
          map.getPanes().overlayPane.appendChild(canvas);
          
          this._canvas = canvas;
          this._ctx = canvas.getContext('2d');
          this._map = map;
          
          map.on('moveend', this._reset, this);
          map.on('resize', this._resize, this);
          
          this._draw();
          return this;
        },

        onRemove: function(map) {
          if (this._canvas && this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
          }
          map.off('moveend', this._reset, this);
          map.off('resize', this._resize, this);
        },

        _resize: function() {
          const size = this._map.getSize();
          this._canvas.width = size.x;
          this._canvas.height = size.y;
          this._draw();
        },

        _reset: function() {
          const topLeft = this._map.containerPointToLayerPoint([0, 0]);
          L.DomUtil.setPosition(this._canvas, topLeft);
          this._draw();
        },

        _draw: function() {
          if (!this._map || !data.data) return;

          const ctx = this._ctx;
          const size = this._map.getSize();
          const bounds = this._map.getBounds();
          
          // Clear canvas
          ctx.clearRect(0, 0, size.x, size.y);

          // Create color scale
          const colorScale = chroma.scale(['#00ff00', '#ffff00', '#ff0000'])
            .domain([0, 1]);

          // Draw points
          data.data.forEach(point => {
            const latLng = L.latLng(point.lat, point.lng);
            if (bounds.contains(latLng)) {
              const pixelPoint = this._map.latLngToContainerPoint(latLng);
              const value = point.value;
              const radius = 30; // Adjust radius as needed
              
              // Create radial gradient
              const gradient = ctx.createRadialGradient(
                pixelPoint.x, pixelPoint.y, 0,
                pixelPoint.x, pixelPoint.y, radius
              );
              
              const color = colorScale(value).hex();
              gradient.addColorStop(0, chroma(color).alpha(0.8).css());
              gradient.addColorStop(1, chroma(color).alpha(0).css());
              
              // Draw circle
              ctx.beginPath();
              ctx.fillStyle = gradient;
              ctx.arc(pixelPoint.x, pixelPoint.y, radius, 0, Math.PI * 2);
              ctx.fill();
            }
          });
        }
      });

      layerRef.current = new HeatmapLayer();
      layerRef.current.addTo(map);
    }

    // Trigger redraw when data changes
    if (layerRef.current && layerRef.current._draw) {
      layerRef.current._draw();
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, data]);

  return null;
};

Heatmap.propTypes = {
  data: PropTypes.shape({
    max: PropTypes.number,
    min: PropTypes.number,
    data: PropTypes.arrayOf(PropTypes.shape({
      lat: PropTypes.number.isRequired,
      lng: PropTypes.number.isRequired,
      value: PropTypes.number.isRequired
    })).isRequired
  }).isRequired,
  map: PropTypes.object.isRequired
};

export default Heatmap;