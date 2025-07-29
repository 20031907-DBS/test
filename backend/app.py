from flask import Flask, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
from config.config import Config
from extensions import db
from routes.user_routes import user_bp
from routes.auth_routes import auth_bp
from services.messaging.socket_handler import SocketHandler

app = Flask(__name__)
app.config.from_object(Config)

#CORS(app, supports_credentials=True)
CORS(app, supports_credentials=True, origins=["http://localhost:3000", "http://localhost:3001"])
#socketio = SocketIO(app, cors_allowed_origins="*")
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:3000", "http://localhost:3001"])

# Initialize extensions
db.init_app(app)

# Register blueprints
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api/auth')

# Initialize socket handler
socket_handler = SocketHandler(socketio)

@app.route('/')
def index():
    return jsonify({"status": "ok", "message": "Server is running"})


