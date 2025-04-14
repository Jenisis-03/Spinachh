import { fromArrayBuffer } from 'geotiff';

class COGLoader {
  constructor() {
    this.tiff = null;
    this.image = null;
    this.metadata = null;
    this.overviews = [];
  }

  async initialize(url) {
    try {
      // Fetch headers first to check if server supports range requests
      const headResponse = await fetch(url, { method: 'HEAD' });
      const acceptRanges = headResponse.headers.get('Accept-Ranges');
      const contentLength = headResponse.headers.get('Content-Length');

      if (acceptRanges !== 'bytes') {
        console.warn('Server does not support range requests. COG optimizations will be limited.');
        // Continue with full file fetch when range requests aren't supported
        return this.initializeWithFullFile(url);
      }

      // Use range requests when supported
      const initialResponse = await fetch(url, {
        headers: { Range: 'bytes=0-32768' } // Request first 32KB for header info
      });
      if (!initialResponse.ok && initialResponse.status !== 206) {
        throw new Error(`Failed to fetch GeoTIFF: ${initialResponse.statusText}`);
      }

      const arrayBuffer = await initialResponse.arrayBuffer();
      this.tiff = await fromArrayBuffer(arrayBuffer);
      this.image = await this.tiff.getImage();
      this.metadata = this.image.getFileDirectory();

      // Get available overviews
      const imageCount = await this.tiff.getImageCount();
      for (let i = 1; i < imageCount; i++) {
        this.overviews.push(await this.tiff.getImage(i));
      }

      return this.getBounds();
    } catch (error) {
      console.error('Error initializing COG:', error);
      throw error;
    }
  }

  getBounds() {
    const width = this.image.getWidth();
    const height = this.image.getHeight();
    const tiepoint = this.metadata.ModelTiepoint;
    const pixelScale = this.metadata.ModelPixelScale;

    const xmin = tiepoint[3];
    const ymax = tiepoint[4];
    const xmax = xmin + width * pixelScale[0];
    const ymin = ymax - height * pixelScale[1];

    return {
      bounds: [[ymin, xmin], [ymax, xmax]],
      width,
      height,
      pixelScale
    };
  }

  async initializeWithFullFile(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch GeoTIFF: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      this.tiff = await fromArrayBuffer(arrayBuffer);
      this.image = await this.tiff.getImage();
      this.metadata = this.image.getFileDirectory();
      
      const imageCount = await this.tiff.getImageCount();
      for (let i = 1; i < imageCount; i++) {
        this.overviews.push(await this.tiff.getImage(i));
      }
      
      return this.getBounds();
    } catch (error) {
      console.error('Error initializing COG with full file:', error);
      throw error;
    }
  }

  async readOptimalResolution(bounds, targetWidth, targetHeight) {
    // Find the most appropriate overview level
    const optimalImage = this.selectOptimalOverview(targetWidth, targetHeight);
    
    // Calculate the window coordinates
    const window = this.calculateWindow(bounds, optimalImage);
    
    try {
      const rasters = await optimalImage.readRasters({
        window,
        width: targetWidth,
        height: targetHeight,
        interleave: true,
        pool: false, // Disable worker pool
        fillValue: 0 // Set default fill value for empty pixels
      });

      if (!rasters || !rasters.length) {
        throw new Error('Failed to read raster data');
      }

      return this.normalizeRasters(rasters);
    } catch (error) {
      console.error('Error reading rasters:', error);
      throw error;
    }
  }

  selectOptimalOverview(targetWidth, targetHeight) {
    const originalResolution = this.image.getWidth() / targetWidth;
    let optimalImage = this.image;
    let optimalResolution = originalResolution;

    for (const overview of this.overviews) {
      const overviewResolution = overview.getWidth() / targetWidth;
      if (Math.abs(overviewResolution - 1) < Math.abs(optimalResolution - 1)) {
        optimalImage = overview;
        optimalResolution = overviewResolution;
      }
    }

    return optimalImage;
  }

  calculateWindow(bounds, image) {
    const tiepoint = this.metadata.ModelTiepoint;
    const pixelScale = this.metadata.ModelPixelScale;
    const imageWidth = image.getWidth();
    const imageHeight = image.getHeight();

    // Convert geographic bounds to pixel coordinates
    const minX = Math.floor((bounds[0][1] - tiepoint[3]) / pixelScale[0]);
    const maxX = Math.ceil((bounds[1][1] - tiepoint[3]) / pixelScale[0]);
    const minY = Math.floor((tiepoint[4] - bounds[1][0]) / pixelScale[1]);
    const maxY = Math.ceil((tiepoint[4] - bounds[0][0]) / pixelScale[1]);

    // Ensure coordinates are within image bounds
    return [
      Math.max(0, minX),
      Math.max(0, minY),
      Math.min(imageWidth - 1, maxX),
      Math.min(imageHeight - 1, maxY)
    ];
  }

  normalizeRasters(rasters) {
    if (!rasters || !Array.isArray(rasters)) {
      throw new Error('Invalid raster data format');
    }

    const formattedValues = [];
    const bandCount = Array.isArray(rasters[0]) ? rasters.length : 1;

    for (let i = 0; i < bandCount; i++) {
      const band = Array.isArray(rasters[0]) ? rasters[i] : rasters;
      const bandArray = Array.from(band);
      
      if (bandArray.length > 0) {
        // Normalize values to 0-255 range
        const min = Math.min(...bandArray);
        const max = Math.max(...bandArray);
        const normalizedBand = bandArray.map(val => 
          Math.floor(((val - min) / (max - min)) * 255)
        );
        formattedValues.push(normalizedBand);
      }
    }

    return formattedValues;
  }
}

export default COGLoader;