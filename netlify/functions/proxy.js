import fetch from 'node-fetch';
import { Buffer } from 'node:buffer';

export async function handler(event) {
  // Get the URL from query parameters
  const url = event.queryStringParameters.url;
  
  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'URL parameter is required' })
    };
  }

  try {
    // Fetch the data from the provided URL
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the content type from the response
    const contentType = response.headers.get('content-type');
    
    // Handle different content types appropriately
    let body;
    let isBase64Encoded = false;

    if (contentType && contentType.includes('application/json')) {
      // For JSON data, parse and stringify to ensure valid JSON
      const jsonData = await response.json();
      body = JSON.stringify(jsonData);
    } else {
      // For binary data (like images, GeoTIFF), use base64 encoding
      const arrayBuffer = await response.arrayBuffer();
      body = Buffer.from(arrayBuffer).toString('base64');
      isBase64Encoded = true;
    }

    // Return the proxied response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body,
      isBase64Encoded
    };
  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to fetch data',
        details: err.message
      })
    };
  }
} 