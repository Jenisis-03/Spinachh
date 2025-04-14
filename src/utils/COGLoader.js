import { fromArrayBuffer } from 'geotiff';

export class COGLoader {
  constructor() {
    this.tiff = null;
    this.image = null;
    this.width = 0;
    this.height = 0;
    this.bounds = null;
    this.pixelScale = null;
  }

  async initialize(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch GeoTIFF');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      this.tiff = await fromArrayBuffer(arrayBuffer);
      this.image = await this.tiff.getImage();
      
      // Get image dimensions
      this.width = this.image.getWidth();
      this.height = this.image.getHeight();
      
      // Get geospatial information
      const bbox = await this.image.getBoundingBox();
      this.bounds = [[bbox[1], bbox[0]], [bbox[3], bbox[2]]];
      
      const resolution = await this.image.getResolution();
      this.pixelScale = resolution[0];
      
      return {
        width: this.width,
        height: this.height,
        bounds: this.bounds,
        pixelScale: this.pixelScale
      };
    } catch (error) {
      console.error('Error initializing COGLoader:', error);
      throw error;
    }
  }

  async readOptimalResolution() {
    if (!this.image) {
      throw new Error('GeoTIFF not initialized');
    }

    try {
      const rasterData = await this.image.readRasters();
      if (!rasterData || !rasterData[0]) {
        throw new Error('Invalid raster data');
      }

      // Normalize data to 0-255 range
      const data = rasterData[0];
      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min;

      const normalizedData = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        normalizedData[i] = Math.round(((data[i] - min) / range) * 255);
      }

      return {
        width: this.width,
        height: this.height,
        data: normalizedData
      };
    } catch (error) {
      console.error('Error reading raster data:', error);
      throw error;
    }
  }
}

export default COGLoader; 