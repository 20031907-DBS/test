# Deployment Guide

This guide covers deploying the WhatsApp-like chat application to production.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.9+ (for local development)
- Firebase project with Authentication enabled
- SSL certificates (for HTTPS)

## Environment Setup

### 1. Backend Environment Variables

Create `backend/.env`:

```bash
# Flask Configuration
FLASK_ENV=production
SECRET_KEY=your-super-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key

# Database
DATABASE_URL=postgresql://username:password@localhost/dbname

# Firebase
FIREBASE_CREDENTIALS={"type": "service_account", ...}
# OR
FIREBASE_CREDENTIALS_PATH=/path/to/firebase-credentials.json

# CORS
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Security
BCRYPT_LOG_ROUNDS=12
RATE_LIMIT_ENABLED=True
RATE_LIMIT_PER_MINUTE=60

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/app.log
```

### 2. Frontend Environment Variables

Create `frontend/.env.local`:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Backend URLs
NEXT_PUBLIC_WEBSOCKET_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api

# Environment
NODE_ENV=production
```

## Deployment Options

### Option 1: Docker Compose (Recommended)

1. **Clone and setup:**
   ```bash
   git clone <your-repo>
   cd chat-app
   ```

2. **Configure environment:**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   # Edit the files with your actual values
   ```

3. **Deploy:**
   ```bash
   docker-compose up -d
   ```

4. **Check status:**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

### Option 2: Manual Deployment

#### Backend Deployment

1. **Setup Python environment:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   pip install gunicorn eventlet
   ```

2. **Setup database:**
   ```bash
   python run_production.py
   ```

3. **Run with Gunicorn:**
   ```bash
   gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 run_production:app
   ```

#### Frontend Deployment

1. **Build the application:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Start production server:**
   ```bash
   npm start
   ```

### Option 3: Cloud Deployment

#### Vercel (Frontend)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   cd frontend
   vercel --prod
   ```

3. **Configure environment variables in Vercel dashboard**

#### Heroku (Backend)

1. **Create Heroku app:**
   ```bash
   heroku create your-chat-app-backend
   ```

2. **Set environment variables:**
   ```bash
   heroku config:set SECRET_KEY=your-secret-key
   heroku config:set DATABASE_URL=your-postgres-url
   heroku config:set FIREBASE_CREDENTIALS='{"type": "service_account", ...}'
   ```

3. **Deploy:**
   ```bash
   git subtree push --prefix backend heroku main
   ```

## SSL/HTTPS Setup

### Using Let's Encrypt with Nginx

1. **Install Certbot:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Get certificates:**
   ```bash
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

3. **Auto-renewal:**
   ```bash
   sudo crontab -e
   # Add: 0 12 * * * /usr/bin/certbot renew --quiet
   ```

## Database Setup

### PostgreSQL (Recommended for Production)

1. **Install PostgreSQL:**
   ```bash
   sudo apt install postgresql postgresql-contrib
   ```

2. **Create database and user:**
   ```sql
   sudo -u postgres psql
   CREATE DATABASE chatapp;
   CREATE USER chatuser WITH ENCRYPTED PASSWORD 'your-password';
   GRANT ALL PRIVILEGES ON DATABASE chatapp TO chatuser;
   \q
   ```

3. **Update DATABASE_URL in backend/.env**

## Monitoring and Logging

### Application Logs

- Backend logs: `backend/logs/app.log`
- Frontend logs: Browser console and server logs
- Docker logs: `docker-compose logs -f [service]`

### Health Checks

- Backend: `GET /` returns `{"status": "ok"}`
- Frontend: `GET /` returns the application
- Database: Connection test in backend startup

### Monitoring Tools (Optional)

- **Sentry** for error tracking
- **LogRocket** for session replay
- **Prometheus + Grafana** for metrics
- **Uptime Robot** for uptime monitoring

## Security Checklist

- [ ] HTTPS enabled with valid SSL certificates
- [ ] Environment variables properly set
- [ ] Database credentials secured
- [ ] Firebase security rules configured
- [ ] CORS origins restricted to your domains
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] Security headers configured
- [ ] Regular security updates scheduled

## Performance Optimization

### Backend
- Use Redis for session storage
- Enable database connection pooling
- Implement proper indexing
- Use CDN for static assets

### Frontend
- Enable Next.js optimizations
- Use service worker for caching
- Implement lazy loading
- Optimize images and assets

## Backup Strategy

### Database Backup
```bash
# Daily backup
pg_dump -h localhost -U chatuser chatapp > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U chatuser chatapp < backup_20231201.sql
```

### File Backup
- User uploads (if implemented)
- SSL certificates
- Configuration files

## Troubleshooting

### Common Issues

1. **WebSocket connection fails:**
   - Check CORS settings
   - Verify WebSocket URL
   - Check firewall rules

2. **Authentication not working:**
   - Verify Firebase configuration
   - Check environment variables
   - Validate Firebase project settings

3. **Database connection errors:**
   - Check DATABASE_URL format
   - Verify database server is running
   - Check network connectivity

4. **Build failures:**
   - Clear node_modules and reinstall
   - Check Node.js version compatibility
   - Verify environment variables

### Logs to Check

- Application logs: `backend/logs/app.log`
- Docker logs: `docker-compose logs [service]`
- Nginx logs: `/var/log/nginx/error.log`
- System logs: `journalctl -u your-service`

## Scaling Considerations

### Horizontal Scaling
- Use load balancer (Nginx, HAProxy)
- Implement sticky sessions for WebSocket
- Use Redis for shared session storage
- Consider microservices architecture

### Database Scaling
- Read replicas for read-heavy workloads
- Connection pooling (PgBouncer)
- Database sharding for large datasets

### CDN and Caching
- CloudFlare or AWS CloudFront
- Redis for application caching
- Browser caching headers

## Maintenance

### Regular Tasks
- [ ] Update dependencies monthly
- [ ] Monitor disk space and logs
- [ ] Review security alerts
- [ ] Test backup restoration
- [ ] Performance monitoring
- [ ] SSL certificate renewal

### Update Process
1. Test updates in staging environment
2. Create database backup
3. Deploy during low-traffic hours
4. Monitor application health
5. Rollback if issues occur

## Support

For deployment issues:
1. Check the troubleshooting section
2. Review application logs
3. Verify environment configuration
4. Test individual components
5. Create GitHub issue with details