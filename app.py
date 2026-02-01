from flask import Flask, render_template, request, jsonify, send_file
import orjson
import os
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler
from functools import wraps
import traceback
import threading
import io
from pypinyin import lazy_pinyin
from typing import Dict, Any
from config import get_config

# 加载配置
app_config = get_config()

# 基础配置
BASE_DIR = app_config.BASE_DIR
DATA_FILE = app_config.get_absolute_path(app_config.DATA_FILE)
SYSTEM_FILE = app_config.get_absolute_path(app_config.SYSTEM_FILE)
LOG_DIR = app_config.get_absolute_path(app_config.LOG_DIR)

# 性能优化：内存缓存与线程锁
_data_cache = {}
_data_lock = threading.Lock()

# 确保日志目录存在
os.makedirs(LOG_DIR, exist_ok=True)

# 创建Flask应用并配置
app = Flask(__name__)
app.config.from_object(app_config)

# 配置日志
handler = RotatingFileHandler(
    os.path.join(LOG_DIR, 'app.log'),
    maxBytes=app_config.LOG_MAX_BYTES,
    backupCount=app_config.MAX_BACKUP_COUNT
)
handler.setFormatter(logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s'))
app.logger.addHandler(handler)
app.logger.setLevel(getattr(logging, app_config.LOG_LEVEL))

# 配置Flask使用orjson
from flask.json.provider import JSONProvider

class ORJSONProvider(JSONProvider):
    def dumps(self, obj, **kwargs):
        return orjson.dumps(obj, option=orjson.OPT_NON_STR_KEYS).decode('utf-8')
    
    def loads(self, s, **kwargs):
        return orjson.loads(s)

app.json = ORJSONProvider(app)

# 错误处理装饰器
def handle_errors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            app.logger.error(f'{f.__name__} error: {e}\n{traceback.format_exc()}')
            if request.path.startswith('/api/'):
                return jsonify({'status': 'error', 'msg': '操作失败'}), 500
            return render_template('error.html', error=str(e)), 500
    return decorated_function

# ==================== 数据管理函数 ====================

def get_port_from_config() -> int:
    """从system.json读取端口或使用默认值"""
    port = app_config.PORT
    if os.path.exists(SYSTEM_FILE):
        try:
            sys_config = orjson.loads(open(SYSTEM_FILE, 'rb').read())
            port = sys_config.get('port', port)
        except Exception as e:
            app.logger.warning(f'Failed to read system.json: {e}')
    return port

def initialize_data() -> None:
    """应用启动时加载数据到内存缓存"""
    global _data_cache
    try:
        if not os.path.exists(DATA_FILE):
            app.logger.warning(f'Data file not found: {DATA_FILE}')
            _data_cache = {}
            return
        
        with open(DATA_FILE, 'rb') as f:
            content = f.read()
            if not content.strip():
                _data_cache = {}
                return
            
            data = orjson.loads(content)
            _data_cache = data if isinstance(data, dict) else {}
            app.logger.info('Data loaded successfully')
    
    except Exception as e:
        app.logger.error(f'Error loading data: {e}')
        _data_cache = {}

def load_data() -> Dict[str, Any]:
    """从缓存返回数据的深拷贝"""
    with _data_lock:
        return orjson.loads(orjson.dumps(_data_cache))

def save_data(data: Dict[str, Any]) -> bool:
    """保存数据到缓存和文件"""
    global _data_cache
    try:
        with _data_lock:
            # 按拼音排序分类
            try:
                sorted_data = {cat: data[cat] for cat in sorted(data.keys(), key=lazy_pinyin)}
            except Exception:
                sorted_data = data
            
            _data_cache = sorted_data
            
            # 创建备份目录
            backup_dir = app_config.get_absolute_path(app_config.BACKUP_DIR)
            os.makedirs(backup_dir, exist_ok=True)
            
            # 备份原文件
            if os.path.exists(DATA_FILE):
                try:
                    backup = os.path.join(backup_dir, f'data_{datetime.now().strftime("%Y%m%d_%H%M%S_%f")}.bak')
                    os.rename(DATA_FILE, backup)
                except Exception as e:
                    app.logger.warning(f'Backup failed: {e}')
            
            # 保存文件
            with open(DATA_FILE, 'wb') as f:
                f.write(orjson.dumps(sorted_data, option=orjson.OPT_INDENT_2 | orjson.OPT_NON_STR_KEYS))
            
            app.logger.info('Data saved')
        return True
    except Exception as e:
        app.logger.error(f'Error saving data: {e}')
        raise

# ==================== HTTP缓存 ====================

@app.after_request
def add_cache_headers(response):
    """为响应添加缓存头"""
    if request.path.startswith('/static/'):
        response.cache_control.max_age = app_config.CACHE_STATIC_SECONDS
        response.cache_control.public = True
    elif request.path == '/api/categories':
        response.cache_control.max_age = app_config.CACHE_CATEGORIES_SECONDS
        response.cache_control.public = True
    elif request.path.startswith('/api/'):
        response.cache_control.no_cache = True
        response.cache_control.no_store = True
        response.cache_control.must_revalidate = True
    return response

# ==================== 注册蓝图和初始化 ====================

from api import api_bp
app.register_blueprint(api_bp)
initialize_data()

# ==================== 页面路由 ====================

@app.route('/')
@handle_errors
def index():
    return render_template('index.html')

@app.route('/entryEditor')
@handle_errors
def entry_editor():
    return render_template('entryEditor.html')

@app.route('/entryInput')
@handle_errors
def entry_input():
    return render_template('entryInput.html')

@app.route('/promptOutput')
@handle_errors
def prompt_output():
    return render_template('promptOutput.html')

@app.route('/backup')
@handle_errors
def backup_data():
    """下载 data.json 备份"""
    data_to_backup = orjson.dumps(_data_cache, option=orjson.OPT_INDENT_2 | orjson.OPT_NON_STR_KEYS)
    return send_file(
        io.BytesIO(data_to_backup),
        as_attachment=True,
        download_name=f'data_backup_{datetime.now().strftime("%Y%m%d_%H%M%S_%f")}.json',
        mimetype='application/json'
    )

if __name__ == '__main__':
    port = get_port_from_config()
    app.run(debug=app_config.DEBUG, port=port)