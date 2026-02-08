"""
健康检查API路由
"""
from flask import Blueprint
from app.utils.response import success_response
from app.config import Config

bp = Blueprint('health', __name__, url_prefix='/api/v1')


@bp.route('/health', methods=['GET'])
def health_check():
    """健康检查"""
    data = {
        'status': 'healthy',
        'version': Config.VERSION
    }
    return success_response(data, '服务正常')
