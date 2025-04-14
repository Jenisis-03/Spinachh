/**
 * Color scale utilities for stress visualization
 */
import chroma from 'chroma-js';

/**
 * Generate a color scale for stress visualization
 * @param {string} type - Type of color scale ('stress', 'ndvi', or 'custom')
 * @returns {Function} - Color scale function that takes a value and returns a color
 */
export const createColorScale = (type = 'stress') => {
  switch (type) {
    case 'stress':
      // Stress scale: green (low stress) to red (high stress)
      return chroma.scale(['green', 'yellow', 'orange', 'red'])
        .domain([0, 1]);
    
    case 'ndvi':
      // NDVI scale: red (low NDVI) to green (high NDVI)
      return chroma.scale(['red', 'orange', 'yellow', 'green'])
        .domain([-1, 1]);
    
    case 'custom':
      // Custom scale with more gradations
      return chroma.scale([
        '#d73027', // Very high stress (red)
        '#fc8d59', // High stress (orange)
        '#fee08b', // Moderate stress (yellow)
        '#d9ef8b', // Low stress (light green)
        '#91cf60', // Very low stress (green)
        '#1a9850'  // No stress (dark green)
      ]).domain([1, 0]);
    
    default:
      return chroma.scale(['green', 'red']).domain([0, 1]);
  }
};

/**
 * Generate legend data for a color scale
 * @param {string} type - Type of color scale
 * @param {number} steps - Number of steps in the legend
 * @returns {Array} - Array of {value, color} objects
 */
export const generateLegendData = (type = 'stress', steps = 5) => {
  const colorScale = createColorScale(type);
  const data = [];
  
  for (let i = 0; i < steps; i++) {
    const value = i / (steps - 1);
    data.push({
      value,
      color: colorScale(value).hex()
    });
  }
  
  return data;
};

/**
 * Convert NDVI value to stress value
 * @param {number} ndvi - NDVI value (-1 to 1)
 * @returns {number} - Stress value (0 to 1)
 */
export const ndviToStress = (ndvi) => {
  // Normalize NDVI from -1,1 to 0,1 and invert
  return 1 - ((ndvi + 1) / 2);
};

/**
 * Get color for NDVI value
 * @param {number} ndvi - NDVI value (-1 to 1)
 * @returns {string} - Hex color code
 */
export const getColorForNdvi = (ndvi) => {
  const ndviScale = createColorScale('ndvi');
  return ndviScale(ndvi).hex();
};

/**
 * Get color for stress value
 * @param {number} stress - Stress value (0 to 1)
 * @returns {string} - Hex color code
 */
export const getColorForStress = (stress) => {
  const stressScale = createColorScale('stress');
  return stressScale(stress).hex();
};