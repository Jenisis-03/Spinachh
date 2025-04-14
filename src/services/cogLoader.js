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
      // Add headers for range requests to support COG streaming
      const response = await fetch(url, {
        headers: {
          'Range': 'bytes=0-16384' // Request initial bytes for header info
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch GeoTIFF: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      this.tiff = await fromArrayBuffer(arrayBuffer);
      this.image = await this.tiff.getImage();
      this.metadata = this.image.getFileDirectory();
      
      // Validate required metadata
      if (!this.metadata.ModelTiepoint || !this.metadata.ModelPixelScale) {
        throw new Error('Invalid GeoTIFF: Missing required georeference metadata');
      }
      
      // Get overviews for optimized loading
      this.overviews = await Promise.all(
        Array.from({ length: this.tiff.getImageCount() - 1 }, (_, i) => 
          this.tiff.getImage(i + 1)
        )
      );
      
      return this.getBounds();
    } catch (error) {
      console.error('Error initializing COGLoader:', error);
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
      // Use range requests to fetch only the required tiles
      const rasters = await optimalImage.readRasters({
        window,
        width: targetWidth,
        height: targetHeight,
        interleave: true,
        pool: false, // Disable worker pool for simpler streaming
        fillValue: 0, // Set default fill value for empty pixels
        enableStreamingRequest: true, // Enable streaming for COG
        maxRequestsPerTile: 4 // Limit concurrent requests per tile
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
    if (!this.image) {
      throw new Error('GeoTIFF not initialized');
    }

    const sourceWidth = this.image.getWidth();
    const sourceHeight = this.image.getHeight();
    
    // If target size is larger than source, use original image
    if (targetWidth >= sourceWidth || targetHeight >= sourceHeight) {
      return this.image;
    }
    
    // Find the overview with resolution closest to target
    const targetResolution = Math.max(
      sourceWidth / targetWidth,
      sourceHeight / targetHeight
    );
    
    let bestOverview = this.image;
    let bestResolutionDiff = Infinity;
    
    for (const overview of this.overviews) {
      const overviewWidth = overview.getWidth();
      const resolution = sourceWidth / overviewWidth;
      const resolutionDiff = Math.abs(resolution - targetResolution);
      
      if (resolutionDiff < bestResolutionDiff) {
        bestResolutionDiff = resolutionDiff;
        bestOverview = overview;
      }
    }
    
    return bestOverview;
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
    if (!Array.isArray(rasters) || rasters.length === 0) {
      throw new Error('Invalid raster data: Empty or not an array');
    }

    // Ensure we have valid numeric data
    const validRasters = rasters.map(band => {
      if (!band || !band.length) {
        throw new Error('Invalid raster band: Empty or undefined');
      }
      
      return Array.from(band).map(value => {
        // Handle NaN, Infinity, and null values
        if (!Number.isFinite(value)) {
          return 0; // or another appropriate default value
        }
        return value;
      });
    });

    return validRasters;
  }
}

export default COGLoader;