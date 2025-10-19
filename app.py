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

# 基础配置
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data.json')
SYSTEM_FILE = os.path.join(BASE_DIR, 'system.json')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

# --- 性能优化：内存缓存与线程锁 ---
_data_cache = {}
_data_lock = threading.Lock()
# ------------------------------------

# 确保日志目录存在
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# 读取系统配置
def load_system_config():
    try:
        with open(SYSTEM_FILE, 'rb') as f:
            return orjson.loads(f.read())
    except Exception:
        return {"log_level": "warn"}  # 默认配置

# 配置日志记录
app = Flask(__name__)
handler = RotatingFileHandler(
    os.path.join(LOG_DIR, 'app.log'),
    maxBytes=1024 * 1024,  # 1MB
    backupCount=5
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
def get_port_from_config():
    """从 system.json 读取端口配置，供开发和生产环境共同调用"""
    port = 5000  # 默认端口
    sys_config_path = os.path.join(BASE_DIR, 'system.json')
    if os.path.exists(sys_config_path):
        try:
            with open(sys_config_path, 'rb') as f:
                sys_config = orjson.loads(f.read())
            port = sys_config.get('port', 5000)
        except Exception as e:
            warning_msg = f"警告: 无法读取 system.json, 将使用默认端口 5000。错误: {e}"
            app.logger.warning(warning_msg)
            print(warning_msg) # 在logger可能未完全配置的启动阶段，也打印出来
    return port

def initialize_data():
    """应用启动时，将数据加载到内存缓存中"""
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
        backup_file = f'{DATA_FILE}.{datetime.now().strftime("%Y%m%d_%H%M%S")}.bak'
        try:
            os.rename(DATA_FILE, backup_file)
            app.logger.info(f'Created backup of corrupted file: {backup_file}')
        except Exception as backup_e:
            app.logger.error(f'Failed to create backup: {str(backup_e)}')
        _data_cache = {}
    except Exception as e:
        app.logger.error(f'Error loading data during initialization: {str(e)}')
        _data_cache = {}

def load_data():
    """直接从内存缓存返回数据的深拷贝，避免直接修改缓存"""
    with _data_lock:
        return orjson.loads(orjson.dumps(_data_cache))

def save_data(data):
    """更新内存缓存，并异步写入文件，使用锁保证线程安全"""
    global _data_cache
    try:
        with _data_lock:
            _data_cache = data
            
            backup_path = os.path.join(BASE_DIR, 'backups')
            if not os.path.exists(backup_path):
                os.makedirs(backup_path)

            # Create a backup before saving new data
            if os.path.exists(DATA_FILE):
                backup_file = os.path.join(backup_path, f'data_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json.bak')
                os.rename(DATA_FILE, backup_file)
                app.logger.info(f'Created backup: {backup_file}')
            
            with open(DATA_FILE, 'wb') as f:
                f.write(orjson.dumps(data, option=orjson.OPT_INDENT_2 | orjson.OPT_NON_STR_KEYS))
            
            app.logger.info('Data cache updated and saved to file.')
        return True
    except Exception as e:
        app.logger.error(f'Error saving data: {str(e)}')
        raise

# -------------------- 路由 --------------------
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

# -------------- entryInput.html 相关 --------------
@app.route('/api/add_entry', methods=['POST'])
@handle_errors
def add_entry():
    category = request.form.get('category', '').strip()
    term = request.form.get('term', '').strip()
    trans = request.form.get('trans', '').strip()
    note = request.form.get('note', '').strip()

    if not all([category, term, trans]):
        return jsonify({'status': 'error', 'msg': '分类、词条和译文不能为空'})
    
    if any(len(s) > max_len for s, max_len in [(category, 20), (term, 50), (trans, 100), (note, 200)]):
        return jsonify({'status': 'error', 'msg': '输入内容超过长度限制'})

    data = load_data()
    
    if category not in data:
        data[category] = []

    entry = next((item for item in data[category] if item['term'] == term), None)
    if entry:
        entry.update({'trans': trans, 'note': note})
    else:
        data[category].append({'term': term, 'trans': trans, 'note': note})

    save_data(data)
    return jsonify({'status': 'ok'})

# 数据备份
@app.route('/backup')
@handle_errors
def backup_data():
    """下载 data.json 文件作为备份"""
    data_to_backup = orjson.dumps(_data_cache, option=orjson.OPT_INDENT_2 | orjson.OPT_NON_STR_KEYS)
    return send_file(
        io.BytesIO(data_to_backup),
        as_attachment=True,
        download_name=f'data_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json',
        mimetype='application/json'
    )

# -------------- promptOutput.html 相关 --------------
@app.route('/api/categories')
@handle_errors
def api_categories():
    data = load_data()
    return jsonify(list(data.keys()))

@app.route('/api/terms/<category>')
@handle_errors
def api_terms(category):
    data = load_data()
    return jsonify(data.get(category, []))

# ========== 数据编辑器相关API (已合并和优化) ==========
@app.route('/api/data', methods=['GET'])
@handle_errors
def api_get_data():
    """获取扁平化的词条列表供批量编辑器使用"""
    data = load_data()
    # 将嵌套字典转换为扁平列表
    arr = [{'category': cat, **item} for cat, items in data.items() for item in items]
    return jsonify(arr)

@app.route('/api/data', methods=['POST'])
@handle_errors
def api_save_data():
    """接收前端发送的嵌套结构数据并保存"""
    data = request.get_json(force=True)
    if not isinstance(data, dict):
        return jsonify({'status': 'error', 'msg': '无效的数据格式'})
    
    # 可在此处添加更复杂的数据验证逻辑
    
    save_data(data)
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    # 生产环境应使用 run_server.py
    initialize_data()
    port = get_port_from_config()
    app.run(debug=True,port=port)