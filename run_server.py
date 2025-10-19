import os
from waitress import serve
from app import app, initialize_data, get_port_from_config

if __name__ == '__main__':
    port = get_port_from_config() #载入端口
    initialize_data() #初始化数据缓存
    serve(app, host='0.0.0.0', port=port) #使用waitress部署应用，适合生产环境，监听所有IP地址。