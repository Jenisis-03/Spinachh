/**
 * GeoTIFF loader service for handling GeoTIFF files
 */
import * as GeoTIFF from 'geotiff';
import GeoRasterLayer from 'georaster-layer-for-leaflet';

/**
 * Load a GeoTIFF file and create a Leaflet layer
 * @param {string} filePath - Path to the GeoTIFF file
 * @returns {Promise<Object>} - Object containing the layer and bounds
 */
export const loadGeoTiffLayer = async (filePath) => {
  try {
    const response = await fetch(filePath);
    const arrayBuffer = await response.arrayBuffer();
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
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
    
    // Create georaster
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
    
    // Create layer
    const layer = new GeoRasterLayer({
      georaster,
      opacity: 0.7,
      resolution: 256
    });
    
    return {
      layer,
      bounds: [[ymin, xmin], [ymax, xmax]]
    };
  } catch (error) {
    console.error('Error loading GeoTIFF:', error);
    throw error;
  }
};

/**
 * Extract pixel values from a GeoTIFF at specific coordinates
 * @param {Object} tiff - GeoTIFF object
 * @param {Array} coordinates - Array of [lon, lat] coordinates
 * @returns {Promise<Array>} - Array of pixel values
 */
export const getPixelValuesAtCoordinates = async (tiff, coordinates) => {
  try {
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const metadata = image.getFileDirectory();
    
    // Get geotransform information
    const tiepoint = metadata.ModelTiepoint;
    const pixelScale = metadata.ModelPixelScale;
    
    // Calculate pixel coordinates from geographic coordinates
    const pixelCoordinates = coordinates.map(coord => {
      const x = Math.floor((coord[0] - tiepoint[3]) / pixelScale[0]);
      const y = Math.floor((tiepoint[4] - coord[1]) / pixelScale[1]);
      
      // Check if within bounds
      if (x >= 0 && x < width && y >= 0 && y < height) {
        return [x, y];
      }
      return null;
    }).filter(coord => coord !== null);
    
    // Read values at pixel coordinates
    const values = await image.readRasters();
    
    return pixelCoordinates.map(coord => {
      const index = coord[1] * width + coord[0];
      return values[0][index]; // Assuming single band
    });
  } catch (error) {
    console.error('Error getting pixel values:', error);
    throw error;
  }
};