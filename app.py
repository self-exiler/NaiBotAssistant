from flask import Flask, render_template, request, jsonify, send_file, make_response
import orjson
import os
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler
from functools import wraps
import traceback
import threading
import io
from pypinyin import lazy_pinyin  # 导入 pypinyin
from typing import Dict, List, Any, Optional, Callable
from config import get_config

# 加载配置
app_config = get_config()

# 基础配置
BASE_DIR = app_config.BASE_DIR
DATA_FILE = app_config.get_absolute_path(app_config.DATA_FILE)
SYSTEM_FILE = app_config.get_absolute_path(app_config.SYSTEM_FILE)
LOG_DIR = app_config.get_absolute_path(app_config.LOG_DIR)

# --- 性能优化：内存缓存与线程锁 ---
_data_cache: Dict[str, List[Dict[str, str]]] = {}
_data_lock: threading.Lock = threading.Lock()
# ------------------------------------

# 确保日志目录存在
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# 读取系统配置
def load_system_config() -> Dict[str, Any]:
    """从system.json读取系统配置
    
    Returns:
        配置字典，失败时返回默认配置
    """
    try:
        with open(SYSTEM_FILE, 'rb') as f:
            return orjson.loads(f.read())
    except Exception:
        return {"log_level": "warn"}  # 默认配置

# 配置日志记录
app = Flask(__name__)
app.config.from_object(app_config)

handler = RotatingFileHandler(
    os.path.join(LOG_DIR, 'app.log'),
    maxBytes=app_config.LOG_MAX_BYTES,
    backupCount=app_config.MAX_BACKUP_COUNT
)
handler.setFormatter(logging.Formatter(
    '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
))
app.logger.addHandler(handler)

# 设置日志等级
system_config = load_system_config()
log_level = system_config.get('log_level', 'warn').upper()
log_level_map = {
    'DEBUG': logging.DEBUG,
    'INFO': logging.INFO,
    'WARN': logging.WARNING,
    'WARNING': logging.WARNING,
    'ERROR': logging.ERROR,
    'CRITICAL': logging.CRITICAL
}
app.logger.setLevel(log_level_map.get(log_level, logging.WARNING))

# 配置Flask使用orjson作为JSON解析器
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
            app.logger.error(f'Error in {f.__name__}: {str(e)}')
            app.logger.error(traceback.format_exc())
            if request.path.startswith('/api/'):
                return jsonify({'status': 'error', 'msg': '操作失败，请稍后重试'}), 500
            return render_template('error.html', error=str(e)), 500
    return decorated_function

# -------------------- 工具函数 (已优化) --------------------
def get_port_from_config() -> int:
    """从 system.json 读取端口配置，供开发和生产环境共同调用
    
    Returns:
        端口号，默认5000
    """
    port = app_config.PORT  # 从配置类获取默认端口
    sys_config_path = os.path.join(BASE_DIR, 'system.json')
    if os.path.exists(sys_config_path):
        try:
            with open(sys_config_path, 'rb') as f:
                sys_config = orjson.loads(f.read())
            port = sys_config.get('port', app_config.PORT)
        except Exception as e:
            warning_msg = f"警告: 无法读取 system.json, 将使用默认端口 {app_config.PORT}。错误: {e}"
            app.logger.warning(warning_msg)
            print(warning_msg)  # 在logger可能未完全配置的启动阶段，也打印出来
    return port

def initialize_data() -> None:
    """应用启动时，将数据加载到内存缓存中
    
    加载失败时会创建备份并初始化为空数据
    """
    global _data_cache
    try:
        if not os.path.exists(DATA_FILE):
            app.logger.warning(f'Data file not found: {DATA_FILE}, initializing empty data.')
            _data_cache = {}
            return
            
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
            if not content.strip():
                _data_cache = {}
                return

            data = orjson.loads(content)
            if not isinstance(data, dict):
                app.logger.error(f'Invalid data format in {DATA_FILE}. Loading as empty.')
                _data_cache = {}
            else:
                _data_cache = data
                app.logger.info('Data loaded into memory cache successfully.')

    except orjson.JSONDecodeError as e:
        app.logger.error(f'JSON decode error in {DATA_FILE}: {str(e)}. Attempting to handle.')
        backup_file = f'{DATA_FILE}.{datetime.now().strftime("%Y%m%d_%H%M%S_%f")}.bak'
        try:
            os.rename(DATA_FILE, backup_file)
            app.logger.info(f'Created backup of corrupted file: {backup_file}')
        except Exception as backup_e:
            app.logger.error(f'Failed to create backup: {str(backup_e)}')
        _data_cache = {}
    except Exception as e:
        app.logger.error(f'Error loading data during initialization: {str(e)}')
        _data_cache = {}

def load_data() -> Dict[str, List[Dict[str, str]]]:
    """直接从内存缓存返回数据的深拷贝，避免直接修改缓存
    
    Returns:
        数据字典的深拷贝
    """
    with _data_lock:
        return orjson.loads(orjson.dumps(_data_cache))

def save_data(data: Dict[str, List[Dict[str, str]]]) -> bool:
    """更新内存缓存并写入文件，确保分类键按拼音排序
    
    Args:
        data: 要保存的数据字典
        
    Returns:
        保存成功返回True
        
    Raises:
        Exception: 保存失败时抛出异常
    """
    global _data_cache
    try:
        with _data_lock:
            
            # --- 按分类名称拼音排序 ---
            try:
                # 1. 按 pinyin 排序分类键
                sorted_categories = sorted(data.keys(), key=lambda k: lazy_pinyin(k))
                # 2. 创建一个新的字典，保持排序
                sorted_data = {category: data[category] for category in sorted_categories}
            except Exception as sort_e:
                app.logger.error(f"Failed to sort categories by pinyin: {sort_e}. Saving in default order.")
                sorted_data = data  # 回退到未排序状态
            # --- 结束 ---

            _data_cache = sorted_data  # 保存排序后的数据到缓存
            
            backup_path = app_config.get_absolute_path(app_config.BACKUP_DIR)
            if not os.path.exists(backup_path):
                os.makedirs(backup_path)

            # Create a backup before saving new data
            if os.path.exists(DATA_FILE):
                backup_file = os.path.join(backup_path, f'data_{datetime.now().strftime("%Y%m%d_%H%M%S_%f")}.json.bak')
                try:
                    os.rename(DATA_FILE, backup_file)
                    app.logger.info(f'Created backup: {backup_file}')
                except Exception as e:
                    # 捕获重命名失败，但允许继续写入（覆盖原文件）
                    app.logger.error(f"Failed to create backup: {e}. Proceeding with save...")

            
            with open(DATA_FILE, 'wb') as f:
                # 写入排序后的数据
                f.write(orjson.dumps(sorted_data, option=orjson.OPT_INDENT_2 | orjson.OPT_NON_STR_KEYS)) 
            
            app.logger.info('Data cache updated, sorted by category, and saved to file.')
        return True
    except Exception as e:
        app.logger.error(f'Error saving data: {str(e)}')
        raise  # 重新引发异常，以便 handle_errors 能捕获它

# -------------------- HTTP缓存优化 --------------------
@app.after_request
def add_cache_headers(response):
    """为响应添加适当的缓存头
    
    - 静态资源: 缓存1天
    - API分类列表: 缓存5分钟
    - 其他API: 不缓存
    """
    # 为静态资源添加缓存
    if request.path.startswith('/static/'):
        response.cache_control.max_age = app_config.CACHE_STATIC_SECONDS
        response.cache_control.public = True
    
    # 为API添加缓存策略（具体在blueprint中处理）
    elif request.path == '/api/categories':
        response.cache_control.max_age = app_config.CACHE_CATEGORIES_SECONDS
        response.cache_control.public = True
    elif request.path.startswith('/api/'):
        response.cache_control.no_cache = True
        response.cache_control.no_store = True
        response.cache_control.must_revalidate = True
    
    return response

# -------------------- 注册API蓝图 --------------------
from api import api_bp
app.register_blueprint(api_bp)

# -------------------- 页面路由 --------------------
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

# -------------------- 数据备份路由 --------------------
@app.route('/backup')
@handle_errors
def backup_data():
    """下载 data.json 文件作为备份"""
    data_to_backup = orjson.dumps(_data_cache, option=orjson.OPT_INDENT_2 | orjson.OPT_NON_STR_KEYS)
    return send_file(
        io.BytesIO(data_to_backup),
        as_attachment=True,
        download_name=f'data_backup_{datetime.now().strftime("%Y%m%d_%H%M%S_%f")}.json',
        mimetype='application/json'
    )

if __name__ == '__main__':
    initialize_data()
    port = get_port_from_config()
    app.run(debug=True,port=port)