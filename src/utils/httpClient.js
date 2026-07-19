// utils/httpClient.js
const axios = require('axios');

class HttpClient {
  
  /**
   * Make HTTP POST request with timeout and retry
   */
  async post(url, data, config = {}) {
    const maxRetries = config.maxRetries || 0;
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(url, data, {
          timeout: config.timeout || 5000,
          headers: config.headers || {},
          validateStatus: (status) => status < 500 // Don't throw on 4xx
        });
        
        return response;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`[HttpClient] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Make HTTP GET request
   */
  async get(url, config = {}) {
    try {
      const response = await axios.get(url, {
        timeout: config.timeout || 5000,
        headers: config.headers || {}
      });
      
      return response;
      
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new HttpClient();