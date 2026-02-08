"""
分类管理API路由
"""
from datetime import datetime, timedelta
from flask import Blueprint
from sqlalchemy import func
from app.models import db, Prompt
from app.utils.response import success_response

bp = Blueprint('categories', __name__, url_prefix='/api/v1')


@bp.route('/categories', methods=['GET'])
def get_categories():
    """获取所有分类及其词条数量"""
    # 查询所有分类及其计数
    categories = db.session.query(
        Prompt.category,
        func.count(Prompt.id).label('count'),
        func.min(Prompt.created_at).label('created_at')
    ).group_by(Prompt.category).all()
    
    data = [
        {
            'id': idx + 1,
            'name': cat.category,
            'count': cat.count,
            'created_at': cat.created_at.isoformat() + 'Z' if cat.created_at else None
        }
        for idx, cat in enumerate(categories)
    ]
    
    return success_response(data, '获取成功')


@bp.route('/categories/stats', methods=['GET'])
def get_category_stats():
    """获取分类统计信息"""
    total_categories = db.session.query(func.count(func.distinct(Prompt.category))).scalar()
    total_prompts = db.session.query(func.count(Prompt.id)).scalar()
    
    # 最近7天新增的词条数
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_added = db.session.query(func.count(Prompt.id)).filter(
        Prompt.created_at >= seven_days_ago
    ).scalar()
    
    data = {
        'total_categories': total_categories or 0,
        'total_prompts': total_prompts or 0,
        'recent_added': recent_added or 0
    }
    
    return success_response(data, '获取成功')
