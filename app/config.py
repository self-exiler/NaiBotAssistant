"""
Flask应用配置类
从config.json读取配置并提供给Flask应用
"""
import os
import json
from pathlib import Path


class Config:
    """基础配置类"""
    
    # 获取项目根目录 (app/../)
    BASE_DIR = Path(__file__).resolve().parent.parent
    
    # 加载config.json
    _config_path = BASE_DIR / 'config.json'
    if not _config_path.exists():
        _config_path = Path('config.json').resolve()
    
    with open(_config_path, 'r', encoding='utf-8') as f:
        _config = json.load(f)
    
    # Flask配置
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # 数据库配置
    _db_path = _config['database']['path']
    if _db_path.startswith('./') or _db_path.startswith('.\\'):
        # 移除前面的 ./ 或 .\
        CLEAN_DB_PATH = _db_path[2:]
        SQLALCHEMY_DATABASE_URI = 'sqlite:///' + str((BASE_DIR / CLEAN_DB_PATH).resolve())
    elif Path(_db_path).is_absolute():
        SQLALCHEMY_DATABASE_URI = 'sqlite:///' + str(Path(_db_path).resolve())
    else:
        SQLALCHEMY_DATABASE_URI = 'sqlite:///' + str((BASE_DIR / _db_path).resolve())
        
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # 应用配置
    APP_NAME = _config['app_name']
    VERSION = _config['version']
    
    # 服务器配置
    SERVER_HOST = _config['server']['host']
    SERVER_PORT = _config['server']['port']
    DEBUG = _config['server']['debug']
    
    # 日志配置
    LOG_LEVEL = _config['logging']['level']
    LOG_FORMAT = _config['logging']['format']
    
    # 上传配置
    MAX_CONTENT_LENGTH = _config['upload']['max_file_size']
    ALLOWED_EXTENSIONS = set(_config['upload']['allowed_extensions'])
    
    # 分页配置
    DEFAULT_PAGE_SIZE = _config['pagination']['default_page_size']
    MAX_PAGE_SIZE = _config['pagination']['max_page_size']
    
    # 备份配置
    _temp_dir = _config['backup']['temp_dir']
    if _temp_dir.startswith('./') or _temp_dir.startswith('.\\'):
        CLEAN_TEMP_DIR = _temp_dir[2:]
        BACKUP_TEMP_DIR = str((BASE_DIR / CLEAN_TEMP_DIR).resolve())
    elif Path(_temp_dir).is_absolute():
        BACKUP_TEMP_DIR = str(Path(_temp_dir).resolve())
    else:
        BACKUP_TEMP_DIR = str((BASE_DIR / _temp_dir).resolve())
        
    BACKUP_RETENTION_DAYS = _config['backup']['retention_days']
    AUTO_BACKUP = _config['backup']['auto_backup']
    
    @staticmethod
    def init_app(app):
        """初始化应用配置"""
        # 确保目录存在
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


# 配置字典
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
