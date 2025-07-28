from flask import Flask, render_template, request, jsonify
import json
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data.json')

app = Flask(__name__)

# -------------------- 工具函数 --------------------
def load_data():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
        # 如果 data 不是 dict，返回空 dict 或做兼容处理
        if not isinstance(data, dict):
            return {}
        return data

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# -------------------- 路由 --------------------
@app.route('/')
def index():
    return render_template('index.html')

# 数据编辑器页面入口
@app.route('/entryEditor')
def entry_editor():
    return render_template('entryEditor.html')

@app.route('/entryInput')
def entry_input():
    return render_template('entryInput.html')

@app.route('/promptOutput')
def prompt_output():
    return render_template('promptOutput.html')

# -------------- entryInput.html 相关 --------------
@app.route('/api/add_entry', methods=['POST'])
def add_entry():
    """新增词条"""
    category = request.form.get('category', '').strip()
    term     = request.form.get('term', '').strip()
    trans    = request.form.get('trans', '').strip()
    note     = request.form.get('note', '').strip()

    if not all([category, term, trans]):
        return jsonify({'status': 'error', 'msg': '分类、词条、译文均不能为空'})

    data = load_data()
    if category not in data:
        data[category] = []

    # 去重：如果词条已存在，则覆盖
    exists = False
    for item in data[category]:
        if item['term'] == term:
            item['trans'] = trans
            item['note']  = note
            exists = True
            break
    if not exists:
        data[category].append({'term': term, 'trans': trans, 'note': note})

    save_data(data)
    return jsonify({'status': 'ok'})

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
def api_get_data():
    data = load_data()
    arr = []
    for cat, items in data.items():
        for item in items:
            arr.append({'category': cat, **item})
    return jsonify(arr)

# 保存 data.json
@app.route('/api/data', methods=['POST'])
def api_save_data():
    try:
        data = request.get_json(force=True)
        save_data(data)
        return jsonify({'status': 'ok'})
    except Exception as e:
        return jsonify({'status': 'error', 'msg': str(e)})

if __name__ == '__main__':
    # 从 system.json 读取端口号
    sys_config_path = os.path.join(BASE_DIR, 'system.json')
    if os.path.exists(sys_config_path):
        with open(sys_config_path, 'r', encoding='utf-8') as f:
            sys_config = json.load(f)
        port = sys_config.get('port', 5000)
    else:
        port = 5000
    app.run(debug=True, port=port)