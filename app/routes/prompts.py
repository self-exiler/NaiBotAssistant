"""
词条管理API路由
"""
from flask import Blueprint, request
from sqlalchemy import or_
from app.models import db, Prompt
from app.utils.response import success_response, error_response
from app.utils.validators import validate_prompt_data, validate_pagination_params
from app.config import Config

bp = Blueprint('prompts', __name__, url_prefix='/api/v1')


@bp.route('/prompts', methods=['GET'])
def get_prompts():
    """获取词条列表（支持分页、筛选、排序）"""
    # 获取查询参数
    category = request.args.get('category', '')
    page = request.args.get('page', 1)
    limit = request.args.get('limit', Config.DEFAULT_PAGE_SIZE)
    sort = request.args.get('sort', 'created_desc')
    
    # 验证分页参数
    is_valid, errors, page, limit = validate_pagination_params(page, limit, Config.MAX_PAGE_SIZE)
    if not is_valid:
        return error_response('分页参数错误', 400, errors)
    
    # 构建查询
    query = Prompt.query
    
    # 分类筛选
    if category:
        query = query.filter(Prompt.category == category)
    
    # 排序
    if sort == 'name_asc':
        query = query.order_by(Prompt.name.asc())
    else:  # 默认使用 created_desc
        query = query.order_by(Prompt.created_at.desc())
    
    # 分页
    pagination = query.paginate(page=page, per_page=limit, error_out=False)
    
    data = {
        'prompts': [prompt.to_dict() for prompt in pagination.items],
        'pagination': {
            'page': page,
            'limit': limit,
            'total': pagination.total,
            'pages': pagination.pages
        }
    }
    
    return success_response(data, '获取成功')


@bp.route('/prompts/search', methods=['GET'])
def search_prompts():
    """搜索词条（支持分页）"""
    keyword = request.args.get('keyword', '').strip()
    category = request.args.get('category', '')
    page = request.args.get('page', 1)
    limit = request.args.get('limit', Config.DEFAULT_PAGE_SIZE)
    
    if not keyword:
        return error_response('搜索关键词不能为空', 400)
    
    is_valid, errors, page, limit = validate_pagination_params(page, limit, Config.MAX_PAGE_SIZE)
    if not is_valid:
        return error_response('分页参数错误', 400, errors)
    
    query = Prompt.query.filter(
        or_(
            Prompt.name.contains(keyword),
            Prompt.translation.contains(keyword),
            Prompt.comment.contains(keyword)
        )
    )
    
    if category:
        query = query.filter(Prompt.category == category)
    
    query = query.order_by(Prompt.created_at.desc())
    pagination = query.paginate(page=page, per_page=limit, error_out=False)
    
    data = {
        'prompts': [prompt.to_dict() for prompt in pagination.items],
        'pagination': {
            'page': page,
            'limit': limit,
            'total': pagination.total,
            'pages': pagination.pages
        }
    }
    
    return success_response(data, '搜索成功')


@bp.route('/prompts', methods=['POST'])
def create_prompt():
    """创建词条"""
    data = request.get_json()
    
    if not data:
        return error_response('请求数据不能为空', 400)
    
    is_valid, errors = validate_prompt_data(data)
    if not is_valid:
        return error_response('数据验证失败', 400, errors)
    
    prompt = Prompt(
        category=data['category'],
        name=data['name'],
        translation=data['translation'],
        comment=data.get('comment', '')
    )
    
    try:
        db.session.add(prompt)
        db.session.commit()
        return success_response(prompt.to_dict(), '词条创建成功', 201)
    except Exception as e:
        db.session.rollback()
        return error_response(f'创建失败: {str(e)}', 500)


@bp.route('/prompts/<int:id>', methods=['GET'])
def get_prompt(id):
    """获取词条详情"""
    prompt = db.session.get(Prompt, id)
    
    if not prompt:
        return error_response('词条不存在', 404)
    
    return success_response(prompt.to_dict(), '获取成功')


@bp.route('/prompts/<int:id>', methods=['PUT'])
def update_prompt(id):
    """更新词条"""
    prompt = db.session.get(Prompt, id)
    
    if not prompt:
        return error_response('词条不存在', 404)
    
    data = request.get_json()
    
    if not data:
        return error_response('请求数据不能为空', 400)
    
    is_valid, errors = validate_prompt_data(data)
    if not is_valid:
        return error_response('数据验证失败', 400, errors)
    
    try:
        prompt.category = data['category']
        prompt.name = data['name']
        prompt.translation = data['translation']
        prompt.comment = data.get('comment', '')
        
        db.session.commit()
        return success_response(prompt.to_dict(), '词条更新成功')
    except Exception as e:
        db.session.rollback()
        return error_response(f'更新失败: {str(e)}', 500)


@bp.route('/prompts/<int:id>', methods=['DELETE'])
def delete_prompt(id):
    """删除词条"""
    prompt = db.session.get(Prompt, id)
    
    if not prompt:
        return error_response('词条不存在', 404)
    
    try:
        db.session.delete(prompt)
        db.session.commit()
        return success_response(None, '词条删除成功')
    except Exception as e:
        db.session.rollback()
        return error_response(f'删除失败: {str(e)}', 500)


@bp.route('/prompts/batch', methods=['DELETE'])
def batch_delete_prompts():
    """批量删除词条"""
    data = request.get_json()
    
    if not data or 'ids' not in data:
        return error_response('请求数据不能为空', 400)
    
    ids = data['ids']
    
    if not isinstance(ids, list) or not ids:
        return error_response('ids必须是非空数组', 400)
    
    try:
        deleted_count = Prompt.query.filter(Prompt.id.in_(ids)).delete(synchronize_session=False)
        db.session.commit()
        return success_response(
            {'deleted_count': deleted_count},
            f'批量删除成功，删除{deleted_count}条记录'
        )
    except Exception as e:
        db.session.rollback()
        return error_response(f'批量删除失败: {str(e)}', 500)
