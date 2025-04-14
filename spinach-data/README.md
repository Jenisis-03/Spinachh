# Spinach Data Files

This repository contains the data files for the Spinach Field Stress Visualization Tool.

## Files

- `stress_sample.json`: Primary stress data sample (10x10m grid)
- `stress_sample_2.json`: Secondary stress data sample (20x20m grid)
- `sample.tiff`: GeoTIFF sample data

## Usage

These files are served via jsDelivr CDN for the Spinach Field Stress Visualization Tool.

## CDN URLs

```javascript
const urls = {
  stressSample1: 'https://cdn.jsdelivr.net/gh/subhampreet/spinach-data@main/stress_sample.json',
  stressSample2: 'https://cdn.jsdelivr.net/gh/subhampreet/spinach-data@main/stress_sample_2.json',
  tiffData: 'https://cdn.jsdelivr.net/gh/subhampreet/spinach-data@main/sample.tiff'
};
```

## License

MIT 