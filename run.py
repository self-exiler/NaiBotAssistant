"""
NaiBotAssistant 应用启动脚本
支持Flask开发模式和Waitress生产模式
"""
import sys
import argparse
from app import create_app
from app.config import Config


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='NaiBotAssistant 应用启动脚本')
    parser.add_argument(
        '--dev',
        action='store_true',
        help='启用开发模式 (Flask调试模式，支持热重载)'
    )
    parser.add_argument(
        '--host',
        default=Config.SERVER_HOST,
        help=f'服务器地址 (默认: {Config.SERVER_HOST})'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=Config.SERVER_PORT,
        help=f'服务器端口 (默认: {Config.SERVER_PORT})'
    )
    
    args = parser.parse_args()
    
    # 创建应用
    if args.dev:
        app = create_app('development')
        print(f"""
╔════════════════════════════════════════════════════════════╗
║         NaiBotAssistant - 开发模式                         ║
╚════════════════════════════════════════════════════════════╝
  应用名称: {Config.APP_NAME}
  版本号:   {Config.VERSION}
  运行模式: 开发模式 (Flask)
  访问地址: http://{args.host}:{args.port}
  API文档:  http://{args.host}:{args.port}/api/v1/health
  
  提示: 开发模式支持热重载，代码修改后自动重启
╔════════════════════════════════════════════════════════════╗
        """)
        app.run(host=args.host, port=args.port, debug=True)
    
    else:  # prod mode
        try:
            from waitress import serve
        except ImportError:
            print("错误: Waitress未安装。请运行: pip install waitress")
            sys.exit(1)
        
        app = create_app('production')
        print(f"""
╔════════════════════════════════════════════════════════════╗
║         NaiBotAssistant - 生产模式                         ║
╚════════════════════════════════════════════════════════════╝
  应用名称: {Config.APP_NAME}
  版本号:   {Config.VERSION}
  运行模式: 生产模式 (Waitress)
  访问地址: http://{args.host}:{args.port}
  API文档:  http://{args.host}:{args.port}/api/v1/health
  
  提示: 生产模式使用Waitress WSGI服务器，性能更好
╔════════════════════════════════════════════════════════════╗
        """)
        serve(app, host=args.host, port=args.port, threads=4)


if __name__ == '__main__':
    main()
