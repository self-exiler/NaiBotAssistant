"""
统一响应格式工具
"""
from datetime import datetime
from flask import jsonify


def success_response(data=None, message="操作成功", code=200):
    """
    成功响应
    
    Args:
        data: 响应数据
        message: 响应消息
        code: HTTP状态码
    
    Returns:
        Flask JSON响应
    """
    response = {
        'code': code,
        'message': message,
        'data': data,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }
    return jsonify(response), code


def error_response(message="操作失败", code=400, errors=None):
    """
    错误响应
    
    Args:
        message: 错误消息
        code: HTTP状态码
        errors: 详细错误信息
    
    Returns:
        Flask JSON响应
    """
    response = {
        'code': code,
        'message': message,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }
    
    if errors:
        response['errors'] = errors
    
    return jsonify(response), code
