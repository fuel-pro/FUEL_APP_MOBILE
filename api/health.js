// Health check endpoint
module.exports = (req, res) => {
  const allowedOrigins = [
    'https://fuel-app-mobile.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  
  const origin = req.headers.origin || '';
  const allowed = allowedOrigins.includes(origin) || origin.includes('vercel.app');
  
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }
  
  res.json({
    status: 'healthy',
    service: 'FuelPro Cloud Sync API',
    version: '1.0.1',
    timestamp: new Date().toISOString(),
    platform: 'vercel',
    mode: 'serverless',
  });
};
