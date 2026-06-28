const { z } = require('zod');

// Validation schemas
const schemas = {
  // Auth schemas
  register: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    role: z.string().optional(),
  }),
  
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
  
  // User schemas
  updateUser: z.object({
    email: z.string().email().optional(),
    name: z.string().min(2).optional(),
    role: z.string().optional(),
    permissions: z.array(z.string()).optional(),
  }),
  
  // Station schemas
  createStation: z.object({
    name: z.string().min(2, 'Station name is required'),
    location: z.string().min(2, 'Location is required'),
  }),
  
  updateStation: z.object({
    name: z.string().min(2).optional(),
    location: z.string().min(2).optional(),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
  }),
  
  // Sales schemas
  createSale: z.object({
    stationId: z.string().min(1, 'Station ID is required'),
    fuelType: z.string().min(1, 'Fuel type is required'),
    quantity: z.number().positive('Quantity must be positive'),
    pricePerUnit: z.number().positive('Price must be positive'),
    total: z.number().optional(),
    paymentMethod: z.enum(['cash', 'mpesa', 'card', 'credit']).optional(),
  }),
  
  // Secret schemas
  createSecret: z.object({
    key: z.string().min(1, 'Key is required'),
    value: z.string().min(1, 'Value is required'),
  }),
};

// Validation middleware factory
const validate = (schemaName) => {
  return (req, res, next) => {
    try {
      const schema = schemas[schemaName];
      if (!schema) {
        return res.status(500).json({ error: `Unknown validation schema: ${schemaName}` });
      }
      
      const dataToValidate = ['POST', 'PUT', 'PATCH'].includes(req.method) 
        ? req.body 
        : req.params;
      
      const result = schema.safeParse(dataToValidate);
      
      if (!result.success) {
        const errors = result.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return res.status(400).json({ 
          error: 'Validation failed',
          details: errors,
        });
      }
      
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        req.body = result.data;
      }
      
      next();
    } catch (error) {
      console.error('Validation error:', error);
      return res.status(500).json({ error: 'Validation middleware error' });
    }
  };
};

module.exports = { validate, schemas };
