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
from pypinyin import lazy_pinyin # 导入 pypinyin

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
        backup_file = f'{DATA_FILE}.{datetime.now().strftime("%Y%m%d_%H%M%S_%f")}.bak' # <-- 修复：增加微秒
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
    """[已修改] 更新内存缓存并写入文件，确保分类键按拼音排序。"""
    global _data_cache
    try:
        with _data_lock:
            
            # --- 新增：按分类名称拼音排序 ---
            try:
                # 1. 按 pinyin 排序分类键
                sorted_categories = sorted(data.keys(), key=lambda k: lazy_pinyin(k))
                # 2. 创建一个新的字典，保持排序
                sorted_data = {category: data[category] for category in sorted_categories}
            except Exception as sort_e:
                app.logger.error(f"Failed to sort categories by pinyin: {sort_e}. Saving in default order.")
                sorted_data = data # 回退到未排序状态
            # --- 结束 ---

            _data_cache = sorted_data # [修改] 保存排序后的数据到缓存
            
            backup_path = os.path.join(BASE_DIR, 'backups')
            if not os.path.exists(backup_path):
                os.makedirs(backup_path)

            # Create a backup before saving new data
            if os.path.exists(DATA_FILE):
                # [已修复] 增加 %f (微秒) 来确保备份文件名唯一
                backup_file = os.path.join(backup_path, f'data_{datetime.now().strftime("%Y%m%d_%H%M%S_%f")}.json.bak')
                try:
                    os.rename(DATA_FILE, backup_file)
                    app.logger.info(f'Created backup: {backup_file}')
                except Exception as e:
                    # 捕获重命名失败，但允许继续写入（覆盖原文件）
                    app.logger.error(f"Failed to create backup: {e}. Proceeding with save...")

            
            with open(DATA_FILE, 'wb') as f:
                # [修改] 写入排序后的数据
                f.write(orjson.dumps(sorted_data, option=orjson.OPT_INDENT_2 | orjson.OPT_NON_STR_KEYS)) 
            
            app.logger.info('Data cache updated, sorted by category, and saved to file.')
        return True
    except Exception as e:
        app.logger.error(f'Error saving data: {str(e)}')
        raise # 重新引发异常，以便 handle_errors 能捕获它

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

    save_data(data) # [说明] 调用 save_data 时，分类会自动排序
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
        download_name=f'data_backup_{datetime.now().strftime("%Y%m%d_%H%M%S_%f")}.json', # <-- 修复：增加微秒
        mimetype='application/json'
    )

# -------------- promptOutput.html 相关 --------------
@app.route('/api/categories')
@handle_errors
def api_categories():
    data = load_data()
    return jsonify(list(data.keys())) # [说明] data.keys() 已经由 save_data 保证了顺序

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
    category_filter = request.args.get('category') 

    # [精简] 优化逻辑：只有当分类存在时才准备数据，否则返回空
    data_to_flatten = {}
    if category_filter and category_filter in data:
        data_to_flatten = {category_filter: data[category_filter]}

    arr = [{'category': cat, **item} for cat, items in data_to_flatten.items() for item in items]
    return jsonify(arr)

@app.route('/api/data', methods=['POST'])
@handle_errors
def api_save_data():
    """
    接收前端发送的 *部分* 嵌套结构数据（仅含当前编辑的分类），
    并将其 *合并* 到完整数据中，然后保存。
    """
    partial_data = request.get_json(force=True)
    if not isinstance(partial_data, dict):
        return jsonify({'status': 'error', 'msg': '无效的数据格式'}), 400
    
    if not partial_data:
        app.logger.warning("Received empty data for merge, proceeding.")

    try:
        full_data = load_data()
        
        # 1. 收集所有当前编辑的词条，用于后续的去重处理
        all_current_terms = set()
        for items in partial_data.values():
            if isinstance(items, list):
                for item in items:
                    if item.get('term') and item.get('term').strip():
                        all_current_terms.add(item['term'].strip())
        
        # 2. 从所有分类中移除当前编辑的词条（因为它们可能被移动到其他分类）
        for category in list(full_data.keys()):
            if category not in partial_data:  # 只处理不在当前编辑中的分类
                filtered_items = []
                for item in full_data[category]:
                    if item['term'] not in all_current_terms:
                        filtered_items.append(item)
                
                if filtered_items:
                    full_data[category] = filtered_items
                else:
                    # 如果分类为空，则删除该分类
                    del full_data[category]
                    app.logger.info(f"Category '{category}' removed as it became empty.")
        
        # 3. 处理当前编辑的分类
        for category, items in partial_data.items():
            if not isinstance(items, list):
                return jsonify({'status': 'error', 'msg': f'分类 {category} 的数据格式无效'}), 400
            
            valid_items = [item for item in items if item.get('term') and item.get('term').strip()]
            
            if valid_items:
                full_data[category] = valid_items
            elif category in full_data:
                # 如果分类为空，则删除该分类
                del full_data[category]
                app.logger.info(f"Category '{category}' removed as it became empty.")

        save_data(full_data) # [说明] 调用 save_data 时，分类会自动排序
        return jsonify({'status': 'ok', 'msg': '数据合并成功'})
    except Exception as e:
        app.logger.error(f'Error merging data: {str(e)}')
        return jsonify({'status': 'error', 'msg': '保存数据时发生内部错误'}), 500

# --- 后端排序API ---
@app.route('/api/sort', methods=['POST'])
@handle_errors
def api_sort_category():
    """
    对指定分类的词条按 'term' (拼音) 排序并保存。
    """
    payload = request.get_json(force=True)
    category_to_sort = payload.get('category')

    if not category_to_sort:
        return jsonify({'status': 'error', 'msg': '未提供分类名称'}), 400

    try:
        full_data = load_data()
        
        if category_to_sort not in full_data or not full_data[category_to_sort]:
            return jsonify({'status': 'error', 'msg': '分类不存在或为空'}), 404
            
        sorted_items = sorted(
            full_data[category_to_sort], 
            key=lambda item: lazy_pinyin(item.get('term', ''))
        )
        
        full_data[category_to_sort] = sorted_items
        
        save_data(full_data) # [说明] 调用 save_data 时，分类会自动排序
        
        app.logger.info(f'Category "{category_to_sort}" sorted by pinyin successfully.')
        return jsonify({'status': 'ok', 'msg': '拼音排序成功'})
        
    except Exception as e:
        app.logger.error(f'Error sorting data: {str(e)}')
        return jsonify({'status': 'error', 'msg': '排序时发生内部错误'}), 500


if __name__ == '__main__':
    initialize_data()
    port = get_port_from_config()
    app.run(debug=True,port=port)