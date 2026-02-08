"""
系统配置API路由
"""
import os
import json
import psutil
from flask import Blueprint, request
from app.models import db, Prompt
from app.utils.response import success_response, error_response
from app.config import Config
from datetime import datetime

bp = Blueprint('config', __name__, url_prefix='/api/v1')


@bp.route('/config', methods=['GET'])
def get_config():
    """获取系统配置"""
    # 读取config.json
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'config.json')
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config_data = json.load(f)
    
    data = {
        'app_name': config_data['app_name'],
        'version': config_data['version'],
        'log_level': config_data['logging']['level'],
        'server_port': config_data['server']['port'],
        'database_path': config_data['database']['path'],
        'max_upload_size': config_data['upload']['max_file_size'],
        'page_size': config_data['pagination']['default_page_size']
    }
    
    return success_response(data, '获取成功')


@bp.route('/config', methods=['PUT'])
def update_config():
    """更新系统配置"""
    data = request.get_json()
    
    if not data:
        return error_response('请求数据不能为空', 400)
    
    # 读取现有配置
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'config.json')
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config_data = json.load(f)
    
    # 更新配置
    restart_required = False
    
    if 'log_level' in data:
        config_data['logging']['level'] = data['log_level']
    
    if 'server_port' in data:
        config_data['server']['port'] = int(data['server_port'])
        restart_required = True
    
    if 'page_size' in data:
        config_data['pagination']['default_page_size'] = int(data['page_size'])
    
    # 保存配置
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config_data, f, indent=4, ensure_ascii=False)
    
    result = {
        'restart_required': restart_required,
        'restart_message': '请重启服务以使配置生效' if restart_required else ''
    }
    
    return success_response(result, '配置更新成功')


@bp.route('/system/status', methods=['GET'])
def get_system_status():
    """获取系统状态"""
    # 数据库状态
    try:
        total_prompts = Prompt.query.count()
        total_categories = db.session.query(db.func.count(db.func.distinct(Prompt.category))).scalar()
        
        db_path = Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')
        db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0
        db_size_mb = round(db_size / (1024 * 1024), 2)
        
        database_status = {
            'status': 'connected',
            'total_prompts': total_prompts,
            'total_categories': total_categories,
            'database_size': f'{db_size_mb}MB'
        }
    except Exception as e:
        database_status = {
            'status': 'error',
            'error': str(e)
        }
    
    # 服务器状态
    try:
        process = psutil.Process()
        memory_mb = round(process.memory_info().rss / (1024 * 1024), 2)
        cpu_percent = round(process.cpu_percent(interval=0.1), 2)
        
        # 计算运行时间
        create_time = datetime.fromtimestamp(process.create_time())
        uptime = datetime.now() - create_time
        uptime_str = str(uptime).split('.')[0]  # 去掉微秒
        
        server_status = {
            'status': 'running',
            'uptime': uptime_str,
            'memory_usage': f'{memory_mb}MB',
            'cpu_usage': f'{cpu_percent}%'
        }
    except Exception:
        server_status = {
            'status': 'running',
            'uptime': 'N/A',
            'memory_usage': 'N/A',
            'cpu_usage': 'N/A'
        }
    
    # 备份状态
    backup_status = {
        'last_backup': 'N/A',
        'auto_backup': Config.AUTO_BACKUP,
        'backup_retention_days': Config.BACKUP_RETENTION_DAYS
    }
    
    data = {
        'database': database_status,
        'server': server_status,
        'backup': backup_status
    }
    
    return success_response(data, '系统状态正常')
