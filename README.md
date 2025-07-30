
### Prerequisites
- **Python 3.8+** (for backend)
- **Node.js 18+** (for frontend)
- **Git**

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd test
```

### 1. Navigate to Backend Directory
```bash
cd backend
```

### 2. Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Set Up Environment Variables
```bash
# Copy example environment file
copy .env.example .env

# Edit .env file with your configuration
# Required variables:
# - SECRET_KEY=your-secret-key-here
# - DATABASE_URL=sqlite:///chat.db
# - FIREBASE_CREDENTIALS_PATH=path/to/firebase-credentials.json (optional)
```

### 5. Initialize Database
```bash
# Reset and create database
python reset_db.py
```

### 6. Run Backend Server

#### Development Mode:
```bash
python run.py
```
*Tries ports 5000, 5001, 5002, 5003, 8000 automatically*

#### Production Mode:
```bash
python run_production.py
```
*Runs on configured port with production settings*

#### Local Development Helper:
```bash
python run_local.py
```
*Sets up local development environment*

## 🎨 Frontend Setup

### 1. Navigate to Frontend Directory
```bash
cd frontend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
```bash
# Copy example environment file (if exists)
copy .env.example .env.local

# Or create .env.local with:
NODE_ENV=development
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 4. Run Frontend Development Server
```bash
npm run dev
```
*Runs on http://localhost:3000 (or next available port)*

### 5. Build for Production
```bash
# Build production bundle
npm run build

# Start production server
npm start
```

## 🏃‍♂️ Running Both Services

### Option 1: Separate Terminals
```bash
# Terminal 1 - Backend
cd backend
venv\Scripts\activate  # Windows
python run.py

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

## 📁 Project Structure

```
computer-systems-security/
├── backend/                 # Python Flask backend
│   ├── app.py              # Main Flask application
│   ├── run.py              # Development server
│   ├── run_production.py   # Production server
│   ├── requirements.txt    # Python dependencies
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   └── services/           # Business logic
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # Encryption & WebSocket services
│   │   ├── hooks/          # Custom React hooks
│   │   └── utils/          # Utility functions
│   ├── package.json        # Node.js dependencies
│   └── next.config.js      # Next.js configuration
└── README.md              # This file
```

## 🔐 Security Features

- **End-to-End Encryption**: RSA-2048 + AES-256-GCM
- **Message Signatures**: RSA digital signatures for authenticity
- **Forward Secrecy**: Unique AES key per message
- **Secure Key Storage**: Browser localStorage with validation
- **No Server Access**: Backend never sees plaintext messages

## 🌐 Default URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **WebSocket**: ws://localhost:5000


## 🚨 Troubleshooting

### Backend Issues
- **Port already in use**: `run.py` automatically tries different ports
- **Database errors**: Run `python reset_db.py`
- **Import errors**: Ensure virtual environment is activated

### Frontend Issues
- **WebSocket connection failed**: Check if backend is running on port 5000
- **Build errors**: Delete `node_modules` and run `npm install`
- **Environment variables**: Ensure `.env.local` exists with correct values

### Common Issues
- **CORS errors**: Check `CORS_ORIGINS` in backend `.env`
- **Authentication**: Verify Firebase credentials 
- **Encryption errors**: Check browser console for crypto API support

## 📝 Environment Variables

### Backend (.env)
```bash
FLASK_ENV=development
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///chat.db
FIREBASE_CREDENTIALS_PATH=path/to/firebase.json
CORS_ORIGINS=http://localhost:3000
```

### Frontend (.env.local)
```bash
NODE_ENV=development
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```


