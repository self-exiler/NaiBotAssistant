"""
Flask应用配置类
从config.json读取配置并提供给Flask应用
"""
import os
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

_config_path = BASE_DIR / 'config.json'
if not _config_path.exists():
    _config_path = Path('config.json').resolve()

with open(_config_path, 'r', encoding='utf-8') as f:
    _config = json.load(f)


def _resolve_path(path_str):
    """解析路径，支持相对路径和绝对路径"""
    if path_str.startswith('./') or path_str.startswith('.\\'):
        return str((BASE_DIR / path_str[2:]).resolve())
    elif Path(path_str).is_absolute():
        return str(Path(path_str).resolve())
    return str((BASE_DIR / path_str).resolve())


class Config:
    """基础配置类"""
    
    BASE_DIR = BASE_DIR
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + _resolve_path(_config['database']['path'])
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    APP_NAME = _config['app_name']
    VERSION = _config['version']
    
    SERVER_HOST = _config['server']['host']
    SERVER_PORT = _config['server']['port']
    DEBUG = _config['server']['debug']
    
    LOG_LEVEL = _config['logging']['level']
    LOG_FORMAT = _config['logging']['format']
    
    MAX_CONTENT_LENGTH = _config['upload']['max_file_size']
    ALLOWED_EXTENSIONS = set(_config['upload']['allowed_extensions'])
    
    DEFAULT_PAGE_SIZE = _config['pagination']['default_page_size']
    MAX_PAGE_SIZE = _config['pagination']['max_page_size']
    
    BACKUP_TEMP_DIR = _resolve_path(_config['backup']['temp_dir'])
    BACKUP_RETENTION_DAYS = _config['backup']['retention_days']
    AUTO_BACKUP = _config['backup']['auto_backup']
    BACKUP_HISTORY_LIMIT = _config['backup'].get('history_limit', 50)
    
    @staticmethod
    def init_app(app):
        """初始化应用配置"""
        db_path = Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')
        db_dir = Path(db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)
        Path(Config.BACKUP_TEMP_DIR).mkdir(parents=True, exist_ok=True)
        
        print(f" * BACKUP_TEMP_DIR: {Config.BACKUP_TEMP_DIR}")
        print(f" * DATABASE_PATH: {db_path}")


class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True


class ProductionConfig(Config):
    """生产环境配置"""
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
