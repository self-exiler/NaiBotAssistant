"""
配置管理模块 - NaiAssistant
提供开发、生产等不同环境的配置
"""
import os
from typing import Optional


class Config:
    """基础配置类"""
    # 密钥配置
    SECRET_KEY: str = os.environ.get('SECRET_KEY', 'dev-secret-key-please-change-in-production')
    
    # 日志配置
    LOG_LEVEL: str = os.environ.get('LOG_LEVEL', 'WARNING')
    
    # 服务器配置
    PORT: int = int(os.environ.get('PORT', '5000'))
    HOST: str = os.environ.get('HOST', '0.0.0.0')
    
    # 文件路径配置
    BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))
    DATA_FILE: str = os.environ.get('DATA_FILE', 'data.json')
    SYSTEM_FILE: str = os.environ.get('SYSTEM_FILE', 'system.json')
    LOG_DIR: str = os.environ.get('LOG_DIR', 'logs')
    BACKUP_DIR: str = os.environ.get('BACKUP_DIR', 'backups')
    
    # 性能配置
    MAX_BACKUP_COUNT: int = int(os.environ.get('MAX_BACKUP_COUNT', '5'))
    LOG_MAX_BYTES: int = int(os.environ.get('LOG_MAX_BYTES', str(1024 * 1024)))  # 1MB
    
    # 缓存配置
    CACHE_CATEGORIES_SECONDS: int = 300  # 分类列表缓存5分钟
    CACHE_STATIC_SECONDS: int = 86400  # 静态资源缓存1天
    
    @classmethod
    def get_absolute_path(cls, relative_path: str) -> str:
        """获取相对于BASE_DIR的绝对路径"""
        return os.path.join(cls.BASE_DIR, relative_path)


class DevelopmentConfig(Config):
    """开发环境配置"""
    DEBUG: bool = True
    LOG_LEVEL: str = 'DEBUG'
    SECRET_KEY: str = 'dev-secret-key'


class ProductionConfig(Config):
    """生产环境配置"""
    DEBUG: bool = False
    LOG_LEVEL: str = os.environ.get('LOG_LEVEL', 'WARNING')
    
    # 生产环境必须设置SECRET_KEY
    SECRET_KEY: str = os.environ.get('SECRET_KEY', '')
    
    @classmethod
    def validate(cls) -> None:
        """验证生产环境配置"""
        if not cls.SECRET_KEY or cls.SECRET_KEY == 'dev-secret-key-please-change-in-production':
            raise ValueError(
                "生产环境必须设置 SECRET_KEY 环境变量！\n"
                "请使用: export SECRET_KEY='your-random-secret-key'"
            )


class TestingConfig(Config):
    """测试环境配置"""
    TESTING: bool = True
    DEBUG: bool = True
    LOG_LEVEL: str = 'DEBUG'
    DATA_FILE: str = 'test_data.json'


# 配置字典
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config(env: Optional[str] = None) -> type[Config]:
    """
    获取配置类
    
    Args:
        env: 环境名称 ('development', 'production', 'testing')
             如果为None，则从环境变量FLASK_ENV读取，默认为'development'
    
    Returns:
        配置类
    """
    if env is None:
        env = os.environ.get('FLASK_ENV', 'development')
    
    return config.get(env, config['default'])
