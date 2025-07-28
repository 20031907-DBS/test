import eventlet
eventlet.monkey_patch() 
from app import app, socketio
from extensions import db

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    # Try different ports if 5000 is busy
    ports_to_try = [5000, 5001, 5002, 5003, 8000]
    
    for port in ports_to_try:
        try:
            print(f"Trying to start server on port {port}...")
            socketio.run(app, debug=True, host='0.0.0.0', port=port)
            break
        except OSError as e:
            if "Address already in use" in str(e) or "WinError 10048" in str(e):
                print(f"Port {port} is busy, trying next port...")
                continue
            else:
                raise e
    else:
        print("Could not find an available port. Please close other applications using ports 5000-5003 or 8000.")
