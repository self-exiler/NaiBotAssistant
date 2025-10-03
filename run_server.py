import os
import orjson
from waitress import serve
# 从 app.py 模块中导入 app 应用实例和 initialize_data 函数
from app import app, initialize_data

# 定义项目的基础目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    """
    配置并运行生产服务器的主函数
    """
    # --- 1. 加载配置 ---
    port = 5000  # 设置默认端口
    sys_config_path = os.path.join(BASE_DIR, 'system.json')
    
    if os.path.exists(sys_config_path):
        try:
            with open(sys_config_path, 'r', encoding='utf-8') as f:
                sys_config = orjson.loads(f.read())
            port = sys_config.get('port', 5000)
        except Exception as e:
            # 如果配置文件读取失败，打印警告并使用默认端口
            print(f"警告: 无法读取 system.json, 将使用默认端口 5000。错误: {e}")
    else:
        print("警告: 未找到 system.json, 将使用默认端口 5000。")

    # --- 2. 初始化数据缓存 ---
    # 在服务器启动前，必须先将数据加载到内存中
    print("正在初始化数据缓存...")
    initialize_data()
    print("数据缓存初始化完成。")
    
    # --- 3. 启动生产服务器 ---
    print(f"正在通过 Waitress 启动生产服务器，监听地址 http://0.0.0.0:{port}")
    serve(app, host='0.0.0.0', port=port)

if __name__ == '__main__':
    main()
