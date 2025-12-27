"""
API路由蓝图 - NaiAssistant
将所有API路由组织到蓝图中，提高代码可维护性
"""
from flask import Blueprint, request, jsonify
from typing import Dict, List, Any, Tuple
import orjson
from pypinyin import lazy_pinyin

# 创建API蓝图
api_bp = Blueprint('api', __name__, url_prefix='/api')


def get_data_functions():
    """
    延迟导入app模块中的数据函数，避免循环导入
    
    Returns:
        tuple: (load_data, save_data, app_logger)
    """
    from app import load_data, save_data, app
    return load_data, save_data, app.logger


# -------------- API端点 --------------

@api_bp.route('/categories', methods=['GET'])
def get_categories():
    """获取所有分类列表（已按拼音排序）"""
    load_data, _, logger = get_data_functions()
    try:
        data = load_data()
        return jsonify(list(data.keys()))
    except Exception as e:
        logger.error(f'Error getting categories: {str(e)}')
        return jsonify({'status': 'error', 'msg': '获取分类失败'}), 500


@api_bp.route('/terms/<category>', methods=['GET'])
def get_terms(category: str):
    """
    获取指定分类下的所有词条
    
    Args:
        category: 分类名称
    """
    load_data, _, logger = get_data_functions()
    try:
        data = load_data()
        return jsonify(data.get(category, []))
    except Exception as e:
        logger.error(f'Error getting terms for category {category}: {str(e)}')
        return jsonify([]), 500


@api_bp.route('/data', methods=['GET'])
def get_data():
    """
    获取扁平化的词条列表供批量编辑器使用
    支持按分类过滤
    """
    load_data, _, logger = get_data_functions()
    try:
        data = load_data()
        category_filter = request.args.get('category')
        
        # 只有当分类存在时才准备数据，否则返回空
        data_to_flatten = {}
        if category_filter and category_filter in data:
            data_to_flatten = {category_filter: data[category_filter]}
        
        # 扁平化数据
        arr = [
            {'category': cat, **item} 
            for cat, items in data_to_flatten.items() 
            for item in items
        ]
        return jsonify(arr)
    except Exception as e:
        logger.error(f'Error getting data: {str(e)}')
        return jsonify({'status': 'error', 'msg': '获取数据失败'}), 500


@api_bp.route('/data', methods=['POST'])
def save_data_endpoint():
    """
    保存批量编辑器的数据
    支持智能合并和自动排序
    """
    load_data, save_data, logger = get_data_functions()
    
    try:
        payload = request.get_json(force=True)
        
        # 解包数据
        partial_data = payload.get('editorData')  # 编辑器里的数据
        loaded_category = payload.get('loadedCategory')  # 用户加载的分类
        
        if not isinstance(partial_data, dict) or not loaded_category:
            return jsonify({'status': 'error', 'msg': '无效的数据格式 (缺少 editorData 或 loadedCategory)'}), 400
        
        # 加载完整数据库
        full_data = load_data()
        
        # 提取编辑器中的所有词条(terms)，用于后续的去重
        terms_in_editor = set()
        for items in partial_data.values():
            if isinstance(items, list):
                for item in items:
                    if item.get('term') and item.get('term').strip():
                        terms_in_editor.add(item['term'].strip())
        
        # 清理数据库 (full_data)
        for category in list(full_data.keys()):
            # 如果这个分类是用户加载的分类，无条件清空它
            if category == loaded_category:
                full_data[category] = []
                continue
            
            # 否则，清理掉那些"即将被移动过来"的词条的旧版本
            original_items = full_data.get(category, [])
            filtered_items = [
                item for item in original_items 
                if item.get('term') not in terms_in_editor
            ]
            
            if not filtered_items:
                if category in full_data: 
                    del full_data[category]
            else:
                full_data[category] = filtered_items
        
        # 合并编辑器数据回数据库
        for category, items in partial_data.items():
            # 提取编辑器中这个分类的有效词条
            new_items_from_editor = [
                item for item in items 
                if item.get('term') and item.get('term').strip()
            ]
            
            if not new_items_from_editor:
                continue
            
            # 获取数据库中该分类的"幸存"词条
            existing_items = full_data.get(category, [])
            
            # 合并
            combined_items = existing_items + new_items_from_editor
            
            # 排序并存回 full_data
            try:
                sorted_items = sorted(
                    combined_items, 
                    key=lambda item: lazy_pinyin(item.get('term', ''))
                )
                full_data[category] = sorted_items
                logger.info(f"Category '{category}' merged and sorted.")
            except Exception as sort_e:
                logger.error(f"Failed to sort items for category '{category}': {sort_e}")
                full_data[category] = combined_items  # 回退
        
        # 清理空的loaded_category
        if loaded_category not in partial_data and loaded_category in full_data:
            if not full_data[loaded_category]:
                del full_data[loaded_category]
                logger.info(f"Loaded category '{loaded_category}' removed as it's no longer in editor.")
        
        # 保存数据（会自动对分类进行排序）
        save_data(full_data)
        return jsonify({'status': 'ok', 'msg': '数据合并并自动排序成功'})
        
    except Exception as e:
        logger.error(f'Error saving data: {str(e)}')
        return jsonify({'status': 'error', 'msg': '保存数据时发生内部错误'}), 500


@api_bp.route('/add_entry', methods=['POST'])
def add_entry():
    """添加或更新单个词条"""
    load_data, save_data, logger = get_data_functions()
    
    try:
        category = request.form.get('category', '').strip()
        term = request.form.get('term', '').strip()
        trans = request.form.get('trans', '').strip()
        note = request.form.get('note', '').strip()
        
        # 验证必填字段
        if not all([category, term, trans]):
            return jsonify({'status': 'error', 'msg': '分类、词条和译文不能为空'})
        
        # 验证长度限制
        if any(len(s) > max_len for s, max_len in [(category, 20), (term, 50), (trans, 100), (note, 200)]):
            return jsonify({'status': 'error', 'msg': '输入内容超过长度限制'})
        
        # 加载数据
        data = load_data()
        
        # 创建或更新分类
        if category not in data:
            data[category] = []
        
        # 查找是否存在相同词条
        entry = next((item for item in data[category] if item['term'] == term), None)
        if entry:
            # 更新现有词条
            entry.update({'trans': trans, 'note': note})
        else:
            # 添加新词条
            data[category].append({'term': term, 'trans': trans, 'note': note})
        
        # 保存数据（会自动排序）
        save_data(data)
        return jsonify({'status': 'ok'})
        
    except Exception as e:
        logger.error(f'Error adding entry: {str(e)}')
        return jsonify({'status': 'error', 'msg': '操作失败，请稍后重试'}), 500
