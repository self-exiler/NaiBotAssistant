"""配置管理模块 - NaiAssistant"""
import os


class Config:
    """基础配置类"""
    # 服务器配置
    HOST: str = os.environ.get('HOST', '0.0.0.0')
    PORT: int = int(os.environ.get('PORT', '5000'))
    SECRET_KEY: str = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    
    # 文件路径配置
    BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))
    DATA_FILE: str = 'data.json'
    SYSTEM_FILE: str = 'system.json'
    LOG_DIR: str = 'logs'
    BACKUP_DIR: str = 'backups'
    
    # 性能配置
    MAX_BACKUP_COUNT: int = int(os.environ.get('MAX_BACKUP_COUNT', '5'))
    LOG_MAX_BYTES: int = 1024 * 1024  # 1MB
    
    # 缓存配置
    CACHE_CATEGORIES_SECONDS: int = 300  # 分类列表缓存5分钟
    CACHE_STATIC_SECONDS: int = 86400  # 静态资源缓存1天
    
    # 日志配置
    LOG_LEVEL: str = 'WARNING'
    DEBUG: bool = False
    
    @classmethod
    def get_absolute_path(cls, relative_path: str) -> str:
        """获取相对于BASE_DIR的绝对路径"""
        return os.path.join(cls.BASE_DIR, relative_path)


class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG = True
    LOG_LEVEL = 'DEBUG'


class ProductionConfig(Config):
    """生产环境配置"""
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'WARNING')


class TestingConfig(Config):
    """测试环境配置"""
    DEBUG = True
    LOG_LEVEL = 'DEBUG'
    DATA_FILE = 'test_data.json'


# 配置映射
_CONFIG_MAP = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
}


def get_config(env=None):
    """获取配置实例"""
    if env is None:
        env = os.environ.get('FLASK_ENV', 'development')
    return _CONFIG_MAP.get(env, DevelopmentConfig)()
