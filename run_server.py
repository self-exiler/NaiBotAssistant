import os
from waitress import serve
from app import app, initialize_data, get_port_from_config
from config import get_config

if __name__ == '__main__':
    # 初始化配置
    app_config = get_config()
    
    # 载入端口（优先使用system.json，其次使用配置类）
    port = get_port_from_config()
    
    # 初始化数据缓存
    initialize_data()
    
    serve(app, host=app_config.HOST, port=port)