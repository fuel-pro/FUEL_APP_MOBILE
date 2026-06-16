# FuelPro Backend API

Backend API for the FuelPro Founder/Admin Panel with versioning, real-time updates, and role-based access control.

## Features

- **Version Control**: Every content change is automatically versioned with rollback capability
- **Real-Time Updates**: Socket.io pushes instant updates to the frontend
- **Role-Based Access**: JWT authentication with founder, admin, developer, and user roles
- **Audit Logging**: Complete audit trail of all changes
- **Station Management**: Manage fuel stations and track analytics

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Real-Time**: Socket.io
- **Authentication**: JWT with bcrypt password hashing

## Quick Start

### Prerequisites

- Node.js 18+ installed
- MongoDB instance (local or MongoDB Atlas)

### Installation

```bash
cd backend
npm install
```

### Configuration

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
MONGO_URI=mongodb://localhost:27017/fuelapp
JWT_SECRET=your-super-secret-key
PORT=5000
NODE_ENV=development
```

### Run Development Server

```bash
npm run dev
```

Server will start on http://localhost:5000

### Run Production Server

```bash
npm start
```

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login user | No |
| GET | `/api/auth/me` | Get current user | Yes |
| PUT | `/api/auth/password` | Update password | Yes |
| POST | `/api/auth/logout` | Logout user | Yes |

### Content Management

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/api/content` | List all content | Yes | founder, admin, developer |
| GET | `/api/content/:key` | Get content by key | No | - |
| PUT | `/api/content/:key` | Update content | Yes | founder, admin, developer |
| GET | `/api/content/:key/versions` | Get version history | Yes | founder, admin, developer |
| POST | `/api/content/:key/rollback/:versionId` | Rollback to version | Yes | founder, admin |
| DELETE | `/api/content/:key` | Delete content | Yes | founder |

### Users

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/api/users` | List all users | Yes | founder, admin |
| GET | `/api/users/:id` | Get user by ID | Yes | founder, admin |
| PUT | `/api/users/:id` | Update user | Yes | founder, admin |
| DELETE | `/api/users/:id` | Deactivate user | Yes | founder |

### Stations

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/api/stations` | List stations | No | - |
| GET | `/api/stations/:id` | Get station | No | - |
| POST | `/api/stations` | Create station | Yes | founder, admin |
| PUT | `/api/stations/:id` | Update station | Yes | founder, admin |
| DELETE | `/api/stations/:id` | Delete station | Yes | founder |

### Audit Logs

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/api/audit` | List audit logs | Yes | founder, admin |
| GET | `/api/audit/stats/summary` | Get audit summary | Yes | founder, admin |
| POST | `/api/audit` | Create audit entry | Yes | - |
| GET | `/api/audit/export/csv` | Export CSV | Yes | founder, admin |

## Deployment

### Render.com (Recommended)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the following:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add environment variables from `.env.example`
5. Deploy!

### Railway.app

1. Create a new project
2. Add a MongoDB database
3. Deploy from GitHub
4. Configure environment variables

### MongoDB Atlas (Database)

1. Create a free cluster at mongodb.com/atlas
2. Create a database user
3. Get the connection string
4. Add to `MONGO_URI` environment variable

## WebSocket Events

### Client → Server

```javascript
socket.emit('join_room', 'admin');  // Join admin room
socket.emit('leave_room', 'admin'); // Leave admin room
```

### Server → Client

```javascript
'content_updated'  // Content has been modified
'content_deleted'  // Content has been deleted  
'audit_update'     // New audit log entry
'station_updated'  // Station has been modified
```

## Frontend Integration

Add these environment variables to your Vercel project:

```env
VITE_API_URL=https://your-backend.onrender.com
```

### Example API Client

```javascript
const API_URL = import.meta.env.VITE_API_URL;

export const api = {
  // Login
  login: async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return res.json();
  },

  // Get content
  getContent: async (key, token) => {
    const res = await fetch(`${API_URL}/api/content/${key}`);
    return res.json();
  },

  // Update content (requires auth)
  updateContent: async (key, data, token, note) => {
    const res = await fetch(`${API_URL}/api/content/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ data, note })
    });
    return res.json();
  }
};
```

### Real-Time Updates with Socket.io

```javascript
import { io } from 'socket.io-client';

const socket = io(API_URL);

// Listen for content updates
socket.on('content_updated', (data) => {
  console.log('Content updated:', data);
  // Refetch the updated content
});

// Join admin room for audit updates
socket.on('connect', () => {
  socket.emit('join_room', 'admin');
});
```

## License

MIT
