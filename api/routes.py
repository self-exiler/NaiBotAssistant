"""API蓝图 - 数据操作接口"""
from flask import Blueprint, request, jsonify
import orjson
from pypinyin import lazy_pinyin

api_bp = Blueprint('api', __name__, url_prefix='/api')

# 延迟导入避免循环依赖
def _get_handlers():
    from app import load_data, save_data, app
    return load_data, save_data, app.logger

@api_bp.route('/categories', methods=['GET'])
def get_categories():
    """获取所有分类列表"""
    try:
        load_data, _, _ = _get_handlers()
        return jsonify(list(load_data().keys()))
    except Exception as e:
        _, _, logger = _get_handlers()
        logger.error(f'get_categories error: {e}')
        return jsonify({'status': 'error', 'msg': '获取失败'}), 500


@api_bp.route('/terms/<category>', methods=['GET'])
def get_terms(category: str):
    """获取指定分类下的词条"""
    try:
        load_data, _, _ = _get_handlers()
        data = load_data()
        return jsonify(data.get(category, []))
    except Exception as e:
        _, _, logger = _get_handlers()
        logger.error(f'get_terms error: {e}')
        return jsonify([]), 500


@api_bp.route('/data', methods=['GET'])
def get_data():
    """获取扁平化的词条列表（批量编辑用）"""
    try:
        load_data, _, _ = _get_handlers()
        data = load_data()
        category_filter = request.args.get('category')
        
        # 过滤特定分类
        data_to_flatten = {category_filter: data[category_filter]} if category_filter in data else {}
        
        # 扁平化
        arr = [{'category': cat, **item} for cat, items in data_to_flatten.items() for item in items]
        return jsonify(arr)
    except Exception as e:
        _, _, logger = _get_handlers()
        logger.error(f'get_data error: {e}')
        return jsonify({'status': 'error', 'msg': '获取失败'}), 500


@api_bp.route('/data', methods=['POST'])
def save_data_endpoint():
    """保存批量编辑的数据"""
    load_data, save_data, logger = _get_handlers()
    
    try:
        payload = request.get_json(force=True)
        partial_data = payload.get('editorData', {})
        loaded_category = payload.get('loadedCategory')
        
        if not isinstance(partial_data, dict) or not loaded_category:
            return jsonify({'status': 'error', 'msg': '数据格式错误'}), 400
        
        full_data = load_data()
        
        # 获取编辑器中的所有词条
        terms_in_editor = {item.get('term', '').strip() for items in partial_data.values() 
                          if isinstance(items, list) for item in items if item.get('term', '').strip()}
        
        # 清理数据库中的旧词条
        for category in list(full_data.keys()):
            if category == loaded_category:
                full_data[category] = []
            else:
                # 移除已在编辑器中的词条
                full_data[category] = [item for item in full_data[category] 
                                      if item.get('term') not in terms_in_editor]
                if not full_data[category]:
                    del full_data[category]
        
        # 合并编辑器数据
        for category, items in partial_data.items():
            new_items = [item for item in items if item.get('term', '').strip()]
            if not new_items:
                continue
            
            existing = full_data.get(category, [])
            combined = existing + new_items
            
            try:
                full_data[category] = sorted(combined, key=lambda x: lazy_pinyin(x.get('term', '')))
            except Exception:
                full_data[category] = combined
        
        # 删除空分类
        if loaded_category in full_data and not full_data[loaded_category]:
            del full_data[loaded_category]
        
        save_data(full_data)
        return jsonify({'status': 'ok', 'msg': '保存成功'})
    
    except Exception as e:
        logger.error(f'save_data error: {e}')
        return jsonify({'status': 'error', 'msg': '保存失败'}), 500


@api_bp.route('/add_entry', methods=['POST'])
def add_entry():
    """添加或更新词条"""
    load_data, save_data, logger = _get_handlers()
    
    try:
        category = request.form.get('category', '').strip()
        term = request.form.get('term', '').strip()
        trans = request.form.get('trans', '').strip()
        note = request.form.get('note', '').strip()
        
        # 验证
        if not all([category, term, trans]):
            return jsonify({'status': 'error', 'msg': '字段不能为空'})
        
        if any(len(s) > max_len for s, max_len in [(category, 20), (term, 50), (trans, 100), (note, 200)]):
            return jsonify({'status': 'error', 'msg': '内容超长'})
        
        data = load_data()
        if category not in data:
            data[category] = []
        
        # 查找或创建词条
        entry = next((item for item in data[category] if item['term'] == term), None)
        if entry:
            entry.update({'trans': trans, 'note': note})
        else:
            data[category].append({'term': term, 'trans': trans, 'note': note})
        
        save_data(data)
        return jsonify({'status': 'ok'})
    
    except Exception as e:
        logger.error(f'add_entry error: {e}')
        return jsonify({'status': 'error', 'msg': '操作失败'}), 500
