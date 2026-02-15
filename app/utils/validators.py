"""
数据验证工具
"""


def validate_prompt_data(data):
    """
    验证词条数据
    
    Args:
        data: 词条数据字典
    
    Returns:
        (is_valid, errors) 元组
    """
    errors = {}
    
    if not data.get('category'):
        errors['category'] = ['分类不能为空']
    
    if not data.get('name'):
        errors['name'] = ['名称不能为空']
    
    if not data.get('translation'):
        errors['translation'] = ['译文不能为空']
    
    if data.get('category') and len(data['category']) > 50:
        errors.setdefault('category', []).append('分类长度不能超过50个字符')
    
    if data.get('name') and len(data['name']) > 100:
        errors.setdefault('name', []).append('名称长度不能超过100个字符')
    
    if data.get('translation') and len(data['translation']) > 5000:
        errors.setdefault('translation', []).append('译文长度不能超过5000个字符')
    
    return len(errors) == 0, errors


def validate_pagination_params(page, limit, max_limit=100):
    """
    验证分页参数
    
    Args:
        page: 页码
        limit: 每页条数
        max_limit: 最大每页条数
    
    Returns:
        (is_valid, errors, validated_page, validated_limit) 元组
    """
    errors = {}
    
    try:
        page = int(page) if page else 1
        if page < 1:
            page = 1
    except (ValueError, TypeError):
        errors['page'] = ['页码必须是正整数']
        page = 1
    
    try:
        limit = int(limit) if limit else max_limit
        if limit < 1:
            limit = max_limit
        elif limit > max_limit:
            limit = max_limit
    except (ValueError, TypeError):
        errors['limit'] = ['每页条数必须是正整数']
        limit = max_limit
    
    return len(errors) == 0, errors, page, limit


def allowed_file(filename, allowed_extensions):
    """
    检查文件扩展名是否允许
    
    Args:
        filename: 文件名
        allowed_extensions: 允许的扩展名集合
    
    Returns:
        bool
    """
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions
