"""
Flask应用初始化
"""
from flask import Flask
from flask_cors import CORS
from app.models import db
from app.config import config
import logging


def create_app(config_name='default'):
    """
    创建Flask应用实例
    
    Args:
        config_name: 配置名称 ('development', 'production', 'default')
    
    Returns:
        Flask应用实例
    """
    app = Flask(__name__, static_folder='../static', static_url_path='')
    
    # 加载配置
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    
    # 配置日志
    logging.basicConfig(
        level=getattr(logging, app.config['LOG_LEVEL']),
        format=app.config['LOG_FORMAT']
    )
    
    # 初始化扩展
    db.init_app(app)
    
    # 配置CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # 注册蓝图
    from app.routes import health, categories, prompts, combine, backup, config as config_routes
    
    app.register_blueprint(health.bp)
    app.register_blueprint(categories.bp)
    app.register_blueprint(prompts.bp)
    app.register_blueprint(combine.bp)
    app.register_blueprint(backup.bp)
    app.register_blueprint(config_routes.bp)
    
    # 注册静态文件路由
    @app.route('/')
    def index():
        return app.send_static_file('index.html')
    
    # 全局错误处理
    @app.errorhandler(404)
    def not_found(error):
        from app.utils.response import error_response
        return error_response('资源不存在', 404)
    
    @app.errorhandler(500)
    def internal_error(error):
        from app.utils.response import error_response
        db.session.rollback()
        return error_response('服务器内部错误', 500)
    
    @app.errorhandler(413)
    def request_entity_too_large(error):
        from app.utils.response import error_response
        return error_response('上传文件过大', 413)
    
    return app
