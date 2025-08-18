from flask import Flask, render_template, request, jsonify, send_file
import orjson
import os
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler
from functools import wraps
import traceback

# 基础配置
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data.json')
LOG_DIR = os.path.join(BASE_DIR, 'logs')

# 确保日志目录存在
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

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
app.logger.setLevel(logging.INFO)

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
            # 记录错误详情
            app.logger.error(f'Error in {f.__name__}: {str(e)}')
            app.logger.error(traceback.format_exc())
            
            # API 端点返回 JSON 错误
            if request.path.startswith('/api/'):
                return jsonify({
                    'status': 'error',
                    'msg': '操作失败，请稍后重试'
                }), 500
            
            # 页面端点返回错误页面
            return render_template('error.html', error=str(e)), 500
    return decorated_function

# -------------------- 工具函数 --------------------
def load_data():
    """加载数据文件，包含错误处理和日志记录"""
    try:
        if not os.path.exists(DATA_FILE):
            app.logger.warning(f'Data file not found: {DATA_FILE}')
            return {}
            
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
            data = orjson.loads(content)
            
            if not isinstance(data, dict):
                app.logger.error(f'Invalid data format in {DATA_FILE}')
                return {}
                
            return data
    except orjson.JSONDecodeError as e:
        app.logger.error(f'JSON decode error in {DATA_FILE}: {str(e)}')
        # 创建损坏文件的备份
        backup_file = f'{DATA_FILE}.{datetime.now().strftime("%Y%m%d_%H%M%S")}.bak'
        try:
            os.rename(DATA_FILE, backup_file)
            app.logger.info(f'Created backup of corrupted file: {backup_file}')
        except Exception as e:
            app.logger.error(f'Failed to create backup: {str(e)}')
        return {}
    except Exception as e:
        app.logger.error(f'Error loading data: {str(e)}')
        return {}

def save_data(data):
    """保存数据文件，包含错误处理、备份和日志记录"""
    try:
        # 创建备份
        if os.path.exists(DATA_FILE):
            backup_path = os.path.join(BASE_DIR, 'backups')
            if not os.path.exists(backup_path):
                os.makedirs(backup_path)
            
            backup_file = os.path.join(
                backup_path, 
                f'data_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            )
            
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                with open(backup_file, 'w', encoding='utf-8') as bf:
                    bf.write(f.read())
            
            app.logger.info(f'Created backup: {backup_file}')
        
        # 保存新数据
        with open(DATA_FILE, 'wb') as f:
            f.write(orjson.dumps(data, option=orjson.OPT_INDENT_2 | orjson.OPT_NON_STR_KEYS))
            
        app.logger.info('Data saved successfully')
        return True
    except Exception as e:
        app.logger.error(f'Error saving data: {str(e)}')
        raise

# -------------------- 路由 --------------------
@app.route('/')
@handle_errors
def index():
    """首页"""
    app.logger.info('Access index page')
    return render_template('index.html')

@app.route('/entryEditor')
@handle_errors
def entry_editor():
    """词条编辑器页面"""
    app.logger.info('Access entry editor page')
    return render_template('entryEditor.html')

@app.route('/entryInput')
@handle_errors
def entry_input():
    """词条录入页面"""
    app.logger.info('Access entry input page')
    return render_template('entryInput.html')

@app.route('/promptOutput')
@handle_errors
def prompt_output():
    """提示词输出页面"""
    app.logger.info('Access prompt output page')
    return render_template('promptOutput.html')

# -------------- entryInput.html 相关 --------------
@app.route('/api/add_entry', methods=['POST'])
@handle_errors
def add_entry():
    """新增词条"""
    # 获取并验证输入
    category = request.form.get('category', '').strip()
    term = request.form.get('term', '').strip()
    trans = request.form.get('trans', '').strip()
    note = request.form.get('note', '').strip()

    # 输入验证
    if not category:
        app.logger.warning('Add entry attempt with empty category')
        return jsonify({'status': 'error', 'msg': '请输入分类名称'})
    
    if not term:
        app.logger.warning('Add entry attempt with empty term')
        return jsonify({'status': 'error', 'msg': '请输入词条'})
    
    if not trans:
        app.logger.warning('Add entry attempt with empty translation')
        return jsonify({'status': 'error', 'msg': '请输入译文'})

    # 长度验证
    if len(category) > 20:
        return jsonify({'status': 'error', 'msg': '分类名称不能超过20个字符'})
    
    if len(term) > 50:
        return jsonify({'status': 'error', 'msg': '词条不能超过50个字符'})
    
    if len(trans) > 100:
        return jsonify({'status': 'error', 'msg': '译文不能超过100个字符'})
    
    if len(note) > 200:
        return jsonify({'status': 'error', 'msg': '备注不能超过200个字符'})

    try:
        data = load_data()
        
        # 初始化分类
        if category not in data:
            data[category] = []
            app.logger.info(f'Created new category: {category}')

        # 检查重复并更新
        exists = False
        for item in data[category]:
            if item['term'] == term:
                old_trans = item['trans']
                old_note = item['note']
                item['trans'] = trans
                item['note'] = note
                exists = True
                app.logger.info(f'Updated existing term: {term} in {category}')
                app.logger.debug(f'Changed translation from "{old_trans}" to "{trans}"')
                if old_note != note:
                    app.logger.debug(f'Changed note from "{old_note}" to "{note}"')
                break

        # 添加新词条
        if not exists:
            data[category].append({
                'term': term,
                'trans': trans,
                'note': note
            })
            app.logger.info(f'Added new term: {term} to {category}')

        # 保存数据
        save_data(data)
        return jsonify({'status': 'ok'})

    except Exception as e:
        app.logger.error(f'Error while adding entry: {str(e)}')
        return jsonify({'status': 'error', 'msg': '保存失败，请重试'})

# 数据备份
@app.route('/backup')
def backup_data():
    """下载 data.json 文件作为备份"""
    if os.path.exists(DATA_FILE):
        return send_file(
            DATA_FILE,
            as_attachment=True,
            download_name=f'data_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json',
            mimetype='application/json'
        )
    return 'data.json not found', 404

# -------------- entryEditor.html 相关 --------------
@app.route('/api/get_all_entries')
@handle_errors
def get_all_entries():
    """获取全部词条"""
    app.logger.info('Fetching all entries')
    try:
        data = load_data()
        return jsonify(data)
    except Exception as e:
        app.logger.error(f'Error while fetching entries: {str(e)}')
        return jsonify({'status': 'error', 'msg': '获取词条失败'})

@app.route('/api/update_entry', methods=['POST'])
@handle_errors
def update_entry():
    """更新词条"""
    # 获取并验证输入
    category = request.form.get('category', '').strip()
    term = request.form.get('term', '').strip()
    trans = request.form.get('trans', '').strip()
    note = request.form.get('note', '').strip()
    
    # 输入验证
    if not category:
        app.logger.warning('Update attempt with empty category')
        return jsonify({'status': 'error', 'msg': '请输入分类名称'})
    
    if not term:
        app.logger.warning('Update attempt with empty term')
        return jsonify({'status': 'error', 'msg': '请输入词条'})
    
    if not trans:
        app.logger.warning('Update attempt with empty translation')
        return jsonify({'status': 'error', 'msg': '请输入译文'})

    # 长度验证
    if len(category) > 20:
        return jsonify({'status': 'error', 'msg': '分类名称不能超过20个字符'})
    
    if len(term) > 50:
        return jsonify({'status': 'error', 'msg': '词条不能超过50个字符'})
    
    if len(trans) > 100:
        return jsonify({'status': 'error', 'msg': '译文不能超过100个字符'})
    
    if len(note) > 200:
        return jsonify({'status': 'error', 'msg': '备注不能超过200个字符'})

    try:
        data = load_data()
        
        if category not in data:
            app.logger.warning(f'Update attempt for non-existent category: {category}')
            return jsonify({'status': 'error', 'msg': f'分类 {category} 不存在'})

        # 查找并更新词条
        for item in data[category]:
            if item['term'] == term:
                old_trans = item['trans']
                old_note = item['note']
                item['trans'] = trans
                item['note'] = note
                app.logger.info(f'Updated term: {term} in {category}')
                app.logger.debug(f'Changed translation from "{old_trans}" to "{trans}"')
                if old_note != note:
                    app.logger.debug(f'Changed note from "{old_note}" to "{note}"')
                save_data(data)
                return jsonify({'status': 'ok'})
        
        app.logger.warning(f'Update attempt for non-existent term: {term} in {category}')
        return jsonify({'status': 'error', 'msg': f'词条 {term} 不存在'})

    except Exception as e:
        app.logger.error(f'Error while updating entry: {str(e)}')
        return jsonify({'status': 'error', 'msg': '更新失败，请重试'})

@app.route('/api/delete_entry', methods=['POST'])
@handle_errors
def delete_entry():
    """删除词条"""
    # 获取并验证输入
    category = request.form.get('category', '').strip()
    term = request.form.get('term', '').strip()
    
    # 输入验证
    if not category:
        app.logger.warning('Delete attempt with empty category')
        return jsonify({'status': 'error', 'msg': '请输入分类名称'})
    
    if not term:
        app.logger.warning('Delete attempt with empty term')
        return jsonify({'status': 'error', 'msg': '请输入词条'})

    try:
        data = load_data()
        
        if category not in data:
            app.logger.warning(f'Delete attempt from non-existent category: {category}')
            return jsonify({'status': 'error', 'msg': f'分类 {category} 不存在'})

        # 查找并删除词条
        for i, item in enumerate(data[category]):
            if item['term'] == term:
                data[category].pop(i)
                app.logger.info(f'Deleted term: {term} from {category}')
                
                # 如果分类为空则删除该分类
                if not data[category]:
                    del data[category]
                    app.logger.info(f'Deleted empty category: {category}')
                
                save_data(data)
                return jsonify({'status': 'ok'})
        
        app.logger.warning(f'Delete attempt for non-existent term: {term} in {category}')
        return jsonify({'status': 'error', 'msg': f'词条 {term} 不存在'})

    except Exception as e:
        app.logger.error(f'Error while deleting entry: {str(e)}')
        return jsonify({'status': 'error', 'msg': '删除失败，请重试'})

# -------------- promptOutput.html 相关 --------------
@app.route('/api/categories')
def api_categories():
    """返回所有一级分类"""
    data = load_data()
    return jsonify(list(data.keys()))

@app.route('/api/terms/<category>')
def api_terms(category):
    """返回某分类下的所有词条"""
    data = load_data()
    terms = data.get(category, [])
    # 返回列表，元素为 dict(term, trans, note)
    return jsonify(terms)


# ========== 数据编辑器相关API ==========
# 获取扁平化数组
@app.route('/api/data', methods=['GET'])
@handle_errors
def api_get_data():
    """获取所有数据的扁平化数组"""
    app.logger.info('Fetching flattened data array')
    try:
        data = load_data()
        arr = []
        for cat, items in data.items():
            for item in items:
                arr.append({'category': cat, **item})
        app.logger.debug(f'Found {len(arr)} total entries')
        return jsonify(arr)
    except Exception as e:
        app.logger.error(f'Error while getting flattened data: {str(e)}')
        return jsonify({'status': 'error', 'msg': '获取数据失败'})

# 保存 data.json
@app.route('/api/data', methods=['POST'])
@handle_errors
def api_save_data():
    """保存所有数据"""
    app.logger.info('Saving data')
    try:
        data = request.get_json(force=True)
        if not isinstance(data, dict):
            app.logger.warning('Invalid data format received')
            return jsonify({'status': 'error', 'msg': '无效的数据格式'})
        
        # 数据验证
        for category, items in data.items():
            if not isinstance(category, str) or len(category) > 20:
                app.logger.warning(f'Invalid category name: {category}')
                return jsonify({'status': 'error', 'msg': f'无效的分类名称: {category}'})
            
            if not isinstance(items, list):
                app.logger.warning(f'Invalid items format for category: {category}')
                return jsonify({'status': 'error', 'msg': f'分类 {category} 的数据格式无效'})
            
            for item in items:
                if not isinstance(item, dict):
                    app.logger.warning(f'Invalid item format in category {category}')
                    return jsonify({'status': 'error', 'msg': '词条数据格式无效'})
                
                if not all(key in item for key in ['term', 'trans', 'note']):
                    app.logger.warning(f'Missing required fields in item: {item}')
                    return jsonify({'status': 'error', 'msg': '词条缺少必要字段'})
                
                if len(item['term']) > 50:
                    return jsonify({'status': 'error', 'msg': f'词条长度超过限制: {item["term"]}'})
                if len(item['trans']) > 100:
                    return jsonify({'status': 'error', 'msg': f'译文长度超过限制: {item["term"]}'})
                if len(item['note']) > 200:
                    return jsonify({'status': 'error', 'msg': f'备注长度超过限制: {item["term"]}'})
        
        save_data(data)
        app.logger.info('Data saved successfully')
        return jsonify({'status': 'ok'})
    except orjson.JSONDecodeError:
        app.logger.error('Invalid JSON data received')
        return jsonify({'status': 'error', 'msg': '无效的 JSON 数据'})
    except Exception as e:
        app.logger.error(f'Error while saving data: {str(e)}')
        return jsonify({'status': 'error', 'msg': '保存失败，请重试'})

if __name__ == '__main__':
    # 从 system.json 读取端口号
    sys_config_path = os.path.join(BASE_DIR, 'system.json')
    if os.path.exists(sys_config_path):
        with open(sys_config_path, 'r', encoding='utf-8') as f:
            content = f.read()
            sys_config = orjson.loads(content)
        port = sys_config.get('port', 5000)
    else:
        port = 5000
    app.run(debug=True, port=port)