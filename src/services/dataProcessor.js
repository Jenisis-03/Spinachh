/**
 * Data processing service for handling GeoTIFF and stress data
 */
import * as GeoTIFF from 'geotiff';

/**
 * Load and process GeoTIFF data
 * @param {string} filePath - Path to the GeoTIFF file
 * @returns {Promise<Object>} - Processed GeoTIFF data and bounds
 */
export const loadGeoTiffData = async (filePath) => {
  try {
    console.log('Starting GeoTIFF fetch for:', filePath);
    const response = await fetch(filePath, {
      method: 'GET',
      headers: {
        'Accept': 'image/tiff,*/*',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store',
      credentials: 'omit'
    });

    if (!response.ok) {
      console.error('GeoTIFF response error:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('GeoTIFF response received:', {
      status: response.status,
      type: response.type,
      headers: Object.fromEntries(response.headers.entries())
    });

    const arrayBuffer = await response.arrayBuffer();
    console.log('GeoTIFF array buffer size:', arrayBuffer.byteLength);

    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    console.log('GeoTIFF dimensions:', { width, height });

    const values = await image.readRasters();
    const metadata = image.getFileDirectory();
    
    // Get geotransform information
    const tiepoint = metadata.ModelTiepoint;
    const pixelScale = metadata.ModelPixelScale;
    
    // Calculate bounds
    const xmin = tiepoint[3];
    const ymax = tiepoint[4];
    const xmax = xmin + width * pixelScale[0];
    const ymin = ymax - height * pixelScale[1];
    
    // Create georaster object
    const georaster = {
      noDataValue: 0,
      pixelWidth: pixelScale[0],
      pixelHeight: pixelScale[1],
      xmin,
      ymin,
      xmax,
      ymax,
      values: values,
      width,
      height,
      projection: 4326 // Assuming WGS84
    };
    
    console.log('GeoTIFF processing complete');
    return {
      georaster,
      bounds: [[ymin, xmin], [ymax, xmax]]
    };
  } catch (error) {
    console.error('Error loading GeoTIFF:', error);
    throw error;
  }
};

/**
 * Load stress data from JSON file
 * @param {string} filePath - Path to the JSON file
 * @returns {Promise<Object>} - Processed stress data
 */
export const loadStressData = async (filePath) => {
  try {
    console.log('Starting fetch for:', filePath);
    const response = await fetch(filePath, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store',
      credentials: 'omit'
    });

    if (!response.ok) {
      console.error('Response error:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Response received:', {
      status: response.status,
      type: response.type,
      headers: Object.fromEntries(response.headers.entries())
    });

    // Get the text content first
    const textContent = await response.text();
    console.log('Raw response text (first 100 chars):', textContent.substring(0, 100));
    
    try {
      // Try to parse the text content as JSON
      const data = JSON.parse(textContent);
      console.log('Successfully parsed JSON data');
      return data;
    } catch (parseError) {
      console.error('Parse error details:', {
        error: parseError.message,
        rawData: textContent.substring(0, 200) // Show first 200 chars of raw data
      });
      throw new Error(`Failed to parse response as JSON: ${parseError.message}`);
    }
  } catch (error) {
    console.error('Error loading stress data:', error);
    throw error;
  }
};

/**
 * Process GeoJSON features to extract heatmap points
 * @param {Object} geojson - GeoJSON data
 * @returns {Array} - Array of points with lat, lng, and value
 */
export const processStressData = (geojson) => {
  if (!geojson || !geojson.features) return [];
  
  const points = [];
  geojson.features.forEach(feature => {
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
        value: stressValue,
        originalNdvi: ndviValue
      });
    }
  });
  
  return points;
};

/**
 * Identify stress hotspots based on NDVI threshold
 * @param {Object} geojson - GeoJSON data
 * @param {number} threshold - NDVI threshold for stress (default: 0.3)
 * @returns {Array} - Array of stress hotspot features
 */
export const identifyStressHotspots = (geojson, threshold = 0.3) => {
  if (!geojson || !geojson.features) return [];
  
  return geojson.features.filter(feature => {
    return feature.properties.ndvi < threshold;
  });
};