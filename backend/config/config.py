import os

# configurations have been taken from previous project (sem 1...)

basedir = os.path.abspath(os.path.dirname(__file__)) 
instance_path = os.path.join(basedir, '..', 'instance')  
if not os.path.exists(instance_path): 
    os.makedirs(instance_path)  

class Config:
  SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(instance_path, 'database.db')
  SQLALCHEMY_TRACK_MODIFICATIONS = False 
  SECRET_KEY = 'AviPushGarAdi@004'
  
  # Session configuration - relaxed for local development
  SESSION_COOKIE_SECURE = os.environ.get('FLASK_ENV') == 'production'
  SESSION_COOKIE_SAMESITE = 'Lax' if os.environ.get('FLASK_ENV') != 'production' else 'None'
  SESSION_COOKIE_HTTPONLY = True