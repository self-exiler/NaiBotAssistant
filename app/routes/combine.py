"""
词条组合API路由
"""
from flask import Blueprint, request
from app.models import Prompt
from app.utils.response import success_response, error_response

bp = Blueprint('combine', __name__, url_prefix='/api/v1/combine')


@bp.route('/prompts/<category>', methods=['GET'])
def get_prompts_by_category(category):
    """按分类获取词条列表（用于组合页面）"""
    prompts = Prompt.query.filter_by(category=category).order_by(Prompt.name).all()
    
    data = [
        {
            'id': prompt.id,
            'name': prompt.name,
            'translation': prompt.translation,
            'comment': prompt.comment
        }
        for prompt in prompts
    ]
    
    return success_response(data, '获取成功')


@bp.route('/generate', methods=['POST'])
def generate_combined_prompt():
    """生成组合提示词"""
    data = request.get_json()
    
    if not data:
        return error_response('请求数据不能为空', 400)
    
    prompt_ids = data.get('prompt_ids', [])
    add_prefix = data.get('add_prefix', False)
    custom_prefix = data.get('custom_prefix', 'Nai')
    
    if not prompt_ids:
        return error_response('prompt_ids不能为空', 400)
    
    # 查询词条
    prompts = Prompt.query.filter(Prompt.id.in_(prompt_ids)).all()
    
    # 提取译文
    translations = [prompt.translation for prompt in prompts]
    combined_text = ', '.join(translations)
    
    # 添加前缀
    if add_prefix and combined_text:
        combined_text = f'{custom_prefix} {combined_text}'
    
    result = {
        'combined_text': combined_text,
        'selected_count': len(prompts),
        'add_prefix': add_prefix
    }
    
    return success_response(result, '组合生成成功')
