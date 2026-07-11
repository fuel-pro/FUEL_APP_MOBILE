// Vercel Serverless API Handler
// Unified handler for all FuelPro backend API routes

const allowedOrigins = [
  'https://fuel-app-mobile.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  /\.vercel\.app$/,
];

function corsHeaders(origin) {
  const allowed = allowedOrigins.some(o => 
    typeof o === 'string' ? o === origin : o.test(origin)
  );
  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, x-founder-token, X-Requested-With, X-Clerk-Auth',
    'Access-Control-Max-Age': '86400',
  };
}

// In-memory data store (persisted via global for warm starts)
const DATA_STORE_KEY = 'fuelpro_data_v1';

function getStore() {
  if (!global[DATA_STORE_KEY]) {
    global[DATA_STORE_KEY] = {
      users: [],
      stations: [],
      sales: [],
      audit_log: [],
      secrets: [],
      feature_flags: [
        { id: 'pos_system', name: 'POS System', description: 'Point of Sale module', enabled: true },
        { id: 'mpesa_live', name: 'M-PESA Live', description: 'Real-time M-PESA transactions', enabled: true },
        { id: 'ai_chatbot', name: 'AI Chatbot', description: 'AI assistant for fuel management', enabled: true },
        { id: 'cloud_sync', name: 'Cloud Sync', description: 'Cross-device data synchronization', enabled: true },
        { id: 'integration_hub', name: 'Integration Hub', description: 'KRA, ETR, POS, Payroll connectors', enabled: true },
        { id: 'regional_compliance', name: 'Regional Compliance', description: 'Multi-country compliance features', enabled: true },
        { id: 'advanced_analytics', name: 'Advanced Analytics', description: 'Deep analytics and forecasting', enabled: true },
        { id: 'customer_loyalty', name: 'Customer Loyalty', description: 'Loyalty program management', enabled: true },
        { id: 'fuel_quality', name: 'Fuel Quality Testing', description: 'Quality control and testing', enabled: true },
        { id: 'credit_management', name: 'Credit Management', description: 'Credit and debt tracking', enabled: true },
      ],
      config: [],
      transactions: [],
    };
  }
  return global[DATA_STORE_KEY];
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function verifyFounderToken(token) {
  const secrets = getStore().secrets;
  const found = secrets.find(s => s.key === 'FOUNDER_TOKEN' && s.value === token);
  return !!found;
}

function getFounderTokenFromHeader(headers) {
  return headers.get('x-founder-token') || headers.get('X-Founder-Token') || '';
}

function requireAuth(headers) {
  const token = getFounderTokenFromHeader(headers);
  if (!token || !verifyFounderToken(token)) {
    return { error: 'Unauthorized', status: 401 };
  }
  return null;
}

async function handleCloudSync(path, method, body, headers) {
  const store = getStore();
  const collection = path.replace('/api/cloud/', '').replace('/cloud/', '');
  
  // Handle collection routes
  if (collection === 'collections' || collection === '') {
    if (method === 'GET') {
      return { 
        json: { 
          success: true, 
          collections: Object.keys(store),
          counts: {
            users: store.users.length,
            stations: store.stations.length,
            sales: store.sales.length,
            audit_log: store.audit_log.length,
            secrets: store.secrets.length,
            feature_flags: store.feature_flags.length,
            config: store.config.length,
          }
        }
      };
    }
  }
  
  // Map collection names
  const collectionMap = {
    'users': 'users',
    'user': 'users',
    'stations': 'stations',
    'station': 'stations',
    'sales': 'sales',
    'sale': 'sales',
    'audit_log': 'audit_log',
    'audit': 'audit_log',
    'secrets': 'secrets',
    'secret': 'secrets',
    'feature_flags': 'feature_flags',
    'flags': 'feature_flags',
    'config': 'config',
    'transactions': 'transactions',
  };
  
  const storeKey = collectionMap[collection];
  if (!storeKey) {
    return { json: { error: 'Unknown collection', success: false }, status: 400 };
  }
  
  switch (method) {
    case 'GET':
      return { json: { success: true, data: store[storeKey] } };
      
    case 'POST':
      if (!body || !body.data) {
        return { json: { error: 'Missing data', success: false }, status: 400 };
      }
      const newItem = { ...body.data, id: body.data.id || generateId() };
      if (body.data._action === 'update' && body.id) {
        const idx = store[storeKey].findIndex(i => i.id === body.id);
        if (idx >= 0) {
          store[storeKey][idx] = { ...store[storeKey][idx], ...body.data };
          return { json: { success: true, data: store[storeKey][idx] } };
        }
      }
      store[storeKey].push(newItem);
      return { json: { success: true, data: newItem, id: newItem.id } };
      
    case 'PUT':
      if (!body || !body.data || !body.id) {
        return { json: { error: 'Missing id or data', success: false }, status: 400 };
      }
      const updateIdx = store[storeKey].findIndex(i => i.id === body.id);
      if (updateIdx >= 0) {
        store[storeKey][updateIdx] = { ...store[storeKey][updateIdx], ...body.data };
        return { json: { success: true, data: store[storeKey][updateIdx] } };
      }
      return { json: { error: 'Not found', success: false }, status: 404 };
      
    case 'DELETE':
      if (!body || !body.id) {
        return { json: { error: 'Missing id', success: false }, status: 400 };
      }
      const delIdx = store[storeKey].findIndex(i => i.id === body.id);
      if (delIdx >= 0) {
        store[storeKey].splice(delIdx, 1);
        return { json: { success: true } };
      }
      return { json: { error: 'Not found', success: false }, status: 404 };
      
    default:
      return { json: { error: 'Method not allowed', success: false }, status: 405 };
  }
}

async function handleDashboard(path, method, body, headers) {
  const store = getStore();
  
  if (path.includes('/dashboard/stats')) {
    const authError = requireAuth(headers);
    if (authError) return authError;
    
    const totalRevenue = store.sales.reduce((sum, s) => sum + (s.amount || 0), 0);
    const totalFuelSold = store.sales.reduce((sum, s) => sum + (s.quantity || 0), 0);
    
    return { 
      json: { 
        success: true, 
        data: {
          totalRevenue,
          netProfit: Math.round(totalRevenue * 0.15),
          fuelSold: totalFuelSold,
          balanceDue: Math.round(totalRevenue * 0.08),
        }
      }
    };
  }
  
  return { json: { error: 'Not found', success: false }, status: 404 };
}

async function handleAPI(path, method, body, headers) {
  // Cloud sync routes
  if (path.startsWith('/api/cloud/') || path.startsWith('/cloud/')) {
    return handleCloudSync(path, method, body, headers);
  }
  
  // Dashboard routes
  if (path.startsWith('/api/dashboard/')) {
    return handleDashboard(path, method, body, headers);
  }
  
  // Health check
  if (path === '/api/health' || path === '/health') {
    const store = getStore();
    return { 
      json: { 
        status: 'healthy', 
        service: 'FuelPro Cloud Sync API', 
        version: '1.0.1', 
        timestamp: new Date().toISOString(),
        dataStore: {
          collections: Object.keys(store),
          counts: {
            users: store.users.length,
            stations: store.stations.length,
            sales: store.sales.length,
            audit_log: store.audit_log.length,
            secrets: store.secrets.length,
            feature_flags: store.feature_flags.length,
            config: store.config.length,
          }
        }
      }
    };
  }
  
  // Auth routes - simple login
  if (path === '/api/auth/login' && method === 'POST') {
    if (!body || !body.email || !body.password) {
      return { json: { error: 'Missing credentials', success: false }, status: 400 };
    }
    
    const store = getStore();
    let user = store.users.find(u => u.email === body.email);
    
    if (!user) {
      // Auto-register for demo purposes
      user = {
        id: generateId(),
        email: body.email,
        name: body.name || body.email.split('@')[0],
        role: 'user',
        permissions: ['*'],
        stationIds: [],
        isActive: true,
        lastLogin: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.users.push(user);
    }
    
    const token = generateId() + '-' + generateId();
    
    return { 
      json: { 
        success: true, 
        user,
        token,
        message: 'Login successful'
      }
    };
  }
  
  // User routes
  if (path.startsWith('/api/users')) {
    const store = getStore();
    
    if (method === 'GET') {
      return { json: { success: true, data: store.users } };
    }
    
    if (method === 'POST' && path === '/api/users') {
      if (!body) return { json: { error: 'Missing data' }, status: 400 };
      const newUser = {
        id: body.id || generateId(),
        email: body.email,
        name: body.name,
        role: body.role || 'user',
        permissions: body.permissions || ['*'],
        stationIds: body.stationIds || [],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.users.push(newUser);
      return { json: { success: true, data: newUser } };
    }
  }
  
  // Station routes
  if (path.startsWith('/api/stations')) {
    const store = getStore();
    
    if (method === 'GET') {
      return { json: { success: true, data: store.stations } };
    }
    
    if (method === 'POST' && path === '/api/stations') {
      if (!body) return { json: { error: 'Missing data' }, status: 400 };
      const newStation = {
        id: body.id || generateId(),
        name: body.name,
        location: body.location,
        ownerId: body.ownerId,
        ownerName: body.ownerName,
        status: 'active',
        members: body.members || [],
        settings: body.settings || {},
        stats: body.stats || {},
        revenue: body.revenue || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.stations.push(newStation);
      return { json: { success: true, data: newStation } };
    }
  }
  
  // Sales routes
  if (path.startsWith('/api/sales')) {
    const store = getStore();
    
    if (method === 'GET') {
      return { json: { success: true, data: store.sales } };
    }
    
    if (method === 'POST' && path === '/api/sales') {
      if (!body) return { json: { error: 'Missing data' }, status: 400 };
      const newSale = {
        id: body.id || generateId(),
        ...body,
        createdAt: new Date().toISOString(),
      };
      store.sales.push(newSale);
      return { json: { success: true, data: newSale } };
    }
  }
  
  // Feature flags
  if (path === '/api/feature-flags' || path === '/api/flags') {
    const store = getStore();
    return { json: { success: true, data: store.feature_flags } };
  }
  
  // M-PESA STK Push
  if (path === '/api/mpesa/stkpush' && method === 'POST') {
    // Check auth
    const authError = requireAuth(headers);
    if (authError) {
      return { 
        json: { 
          success: false, 
          error: 'Not authorized. Please log in as founder to process payments.' 
        }, 
        status: 401 
      };
    }
    
    if (!body || !body.phoneNumber || !body.amount) {
      return { json: { success: false, error: 'Missing phoneNumber or amount' }, status: 400 };
    }
    
    // Simulate M-PESA response
    const checkoutRequestId = 'ws_' + generateId();
    return { 
      json: { 
        success: true, 
        checkoutRequestId,
        responseDescription: 'STK push sent successfully',
        merchantRequestId: 'mr_' + generateId(),
      }
    };
  }
  
  return { json: { error: 'Endpoint not found', success: false }, status: 404 };
}

module.exports = async (req, res) => {
  const { method, url, headers: reqHeaders, body } = req;
  const origin = reqHeaders.origin || reqHeaders.origin || '';
  
  // CORS preflight
  if (method === 'OPTIONS') {
    const cors = corsHeaders(origin);
    res.setHeader('Access-Control-Allow-Origin', cors['Access-Control-Allow-Origin']);
    res.setHeader('Access-Control-Allow-Methods', cors['Access-Control-Allow-Methods']);
    res.setHeader('Access-Control-Allow-Headers', cors['Access-Control-Allow-Headers']);
    res.setHeader('Access-Control-Max-Age', cors['Access-Control-Max-Age']);
    return res.status(200).send('OK');
  }
  
  // Parse path from URL
  const urlObj = new URL(url, 'https://fuel-app-mobile.vercel.app');
  const path = urlObj.pathname;
  
  // Handle API requests
  const result = await handleAPI(path, method, body, reqHeaders);
  
  // Set CORS headers
  const cors = corsHeaders(origin);
  Object.entries(cors).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  // Send response
  if (result.status) {
    res.status(result.status);
  }
  res.json(result.json);
};
