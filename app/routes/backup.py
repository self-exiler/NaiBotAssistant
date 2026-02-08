"""
备份管理API路由
"""
import os
import csv
import shutil
from datetime import datetime
from flask import Blueprint, request, send_file
from werkzeug.utils import secure_filename
from app.models import db, Prompt, BackupHistory
from app.utils.response import success_response, error_response
from app.utils.validators import allowed_file
from app.config import Config

bp = Blueprint('backup', __name__, url_prefix='/api/v1/backup')


@bp.route('/export/csv', methods=['GET'])
def export_csv():
    """导出CSV格式备份"""
    category = request.args.get('category', '')
    
    # 查询词条
    query = Prompt.query
    if category:
        query = query.filter_by(category=category)
    
    prompts = query.all()
    
    # 生成CSV文件
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'naibot_prompts_{timestamp}.csv'
    filepath = os.path.join(Config.BACKUP_TEMP_DIR, filename)
    
    # 确保临时目录存在
    os.makedirs(Config.BACKUP_TEMP_DIR, exist_ok=True)
    
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['分类', '名称', '译文', '注释', '创建时间'])
        
        for prompt in prompts:
            writer.writerow([
                prompt.category,
                prompt.name,
                prompt.translation,
                prompt.comment or '',
                prompt.created_at.isoformat() if prompt.created_at else ''
            ])
    
    # 返回文件（使用 after_this_request 在响应后清理临时文件）
    from flask import after_this_request
    
    @after_this_request
    def cleanup(response):
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception:
            pass  # 清理失败不影响响应
        return response
    
    return send_file(
        os.path.abspath(filepath),
        as_attachment=True,
        download_name=filename,
        mimetype='text/csv'
    )


@bp.route('/export/db', methods=['GET'])
def export_db():
    """导出SQLite数据库备份"""
    # 数据库文件路径
    db_path = Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')
    
    if not os.path.exists(db_path):
        return error_response('数据库文件不存在', 404)
    
    # 生成备份文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'naibot_database_{timestamp}.db'
    filepath = os.path.join(Config.BACKUP_TEMP_DIR, filename)
    
    # 确保临时目录存在
    os.makedirs(Config.BACKUP_TEMP_DIR, exist_ok=True)
    
    # 复制数据库文件
    shutil.copy2(db_path, filepath)
    
    # 返回文件（使用 after_this_request 在响应后清理临时文件）
    from flask import after_this_request
    
    @after_this_request
    def cleanup(response):
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception:
            pass  # 清理失败不影响响应
        return response
    
    return send_file(
        os.path.abspath(filepath),
        as_attachment=True,
        download_name=filename,
        mimetype='application/octet-stream'
    )


@bp.route('/restore/csv/increment', methods=['POST'])
def restore_csv_increment():
    """增量恢复数据（从CSV）"""
    if 'file' not in request.files:
        return error_response('未上传文件', 400)
    
    file = request.files['file']
    
    if file.filename == '':
        return error_response('文件名为空', 400)
    
    if not allowed_file(file.filename, {'csv'}):
        return error_response('只允许上传CSV文件', 400)
    
    # 保存上传的文件
    filename = secure_filename(file.filename)
    filepath = os.path.join(Config.BACKUP_TEMP_DIR, filename)
    os.makedirs(Config.BACKUP_TEMP_DIR, exist_ok=True)
    file.save(filepath)
    
    try:
        # 读取CSV文件
        imported_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        
        with open(filepath, 'r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile)
            
            for row in reader:
                try:
                    # 检查是否已存在相同名称和分类的词条
                    existing = Prompt.query.filter_by(
                        category=row['分类'],
                        name=row['名称']
                    ).first()
                    
                    if existing:
                        # 更新现有词条
                        existing.translation = row['译文']
                        existing.comment = row.get('注释', '')
                        updated_count += 1
                    else:
                        # 创建新词条
                        prompt = Prompt(
                            category=row['分类'],
                            name=row['名称'],
                            translation=row['译文'],
                            comment=row.get('注释', '')
                        )
                        db.session.add(prompt)
                        imported_count += 1
                except Exception as e:
                    skipped_count += 1
                    errors.append(f"行错误: {str(e)}")
        
        db.session.commit()
        
        # 记录恢复历史
        history = BackupHistory(
            operation='csv_increment',
            filename=filename,
            imported_count=imported_count
        )
        db.session.add(history)
        db.session.commit()
        
        data = {
            'imported_count': imported_count,
            'updated_count': updated_count,
            'skipped_count': skipped_count,
            'errors': errors[:10]  # 只返回前10个错误
        }
        
        return success_response(data, '增量恢复成功')
        
    except Exception as e:
        db.session.rollback()
        return error_response(f'恢复失败: {str(e)}', 500)
    finally:
        # 清理临时文件
        if os.path.exists(filepath):
            os.remove(filepath)


@bp.route('/restore/csv/replace', methods=['POST'])
def restore_csv_replace():
    """覆盖恢复数据（从CSV）"""
    if 'file' not in request.files:
        return error_response('未上传文件', 400)
    
    file = request.files['file']
    
    if file.filename == '':
        return error_response('文件名为空', 400)
    
    if not allowed_file(file.filename, {'csv'}):
        return error_response('只允许上传CSV文件', 400)
    
    # 保存上传的文件
    filename = secure_filename(file.filename)
    filepath = os.path.join(Config.BACKUP_TEMP_DIR, filename)
    os.makedirs(Config.BACKUP_TEMP_DIR, exist_ok=True)
    file.save(filepath)
    
    try:
        # 备份当前数据库
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'naibot_backup_{timestamp}.db'
        db_path = Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')
        backup_path = os.path.join(Config.BACKUP_TEMP_DIR, backup_filename)
        shutil.copy2(db_path, backup_path)
        
        # 清空现有数据
        Prompt.query.delete()
        
        # 读取CSV文件
        imported_count = 0
        
        with open(filepath, 'r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile)
            
            for row in reader:
                prompt = Prompt(
                    category=row['分类'],
                    name=row['名称'],
                    translation=row['译文'],
                    comment=row.get('注释', '')
                )
                db.session.add(prompt)
                imported_count += 1
        
        db.session.commit()
        
        # 记录恢复历史
        history = BackupHistory(
            operation='csv_replace',
            filename=filename,
            imported_count=imported_count
        )
        db.session.add(history)
        db.session.commit()
        
        data = {
            'imported_count': imported_count,
            'backup_before_restore': True,
            'backup_filename': backup_filename
        }
        
        return success_response(data, '覆盖恢复成功')
        
    except Exception as e:
        db.session.rollback()
        return error_response(f'恢复失败: {str(e)}', 500)
    finally:
        # 清理临时文件
        if os.path.exists(filepath):
            os.remove(filepath)


@bp.route('/restore/db', methods=['POST'])
def restore_db():
    """从数据库恢复数据"""
    if 'file' not in request.files:
        return error_response('未上传文件', 400)
    
    file = request.files['file']
    mode = request.form.get('mode', 'increment')
    
    if file.filename == '':
        return error_response('文件名为空', 400)
    
    if not allowed_file(file.filename, {'db', 'sqlite', 'sqlite3'}):
        return error_response('只允许上传数据库文件', 400)
    
    # 保存上传的文件
    filename = secure_filename(file.filename)
    filepath = os.path.join(Config.BACKUP_TEMP_DIR, filename)
    os.makedirs(Config.BACKUP_TEMP_DIR, exist_ok=True)
    file.save(filepath)
    
    try:
        # 备份当前数据库
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'naibot_backup_{timestamp}.db'
        db_path = Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')
        backup_path = os.path.join(Config.BACKUP_TEMP_DIR, backup_filename)
        shutil.copy2(db_path, backup_path)
        
        # 替换数据库文件
        shutil.copy2(filepath, db_path)
        
        # 重新加载数据库
        db.session.remove()
        db.engine.dispose()
        
        restored_count = Prompt.query.count()
        
        # 记录恢复历史
        history = BackupHistory(
            operation=f'db_{mode}',
            filename=filename,
            imported_count=restored_count
        )
        db.session.add(history)
        db.session.commit()
        
        data = {
            'restored_count': restored_count,
            'mode': mode,
            'backup_before_operation': True
        }
        
        return success_response(data, '数据库恢复成功')
        
    except Exception as e:
        db.session.rollback()
        return error_response(f'恢复失败: {str(e)}', 500)
    finally:
        # 清理临时文件
        if os.path.exists(filepath):
            os.remove(filepath)


@bp.route('/history', methods=['GET'])
def get_backup_history():
    """获取恢复历史记录"""
    history = BackupHistory.query.order_by(BackupHistory.timestamp.desc()).limit(50).all()
    data = [h.to_dict() for h in history]
    return success_response(data, '获取成功')
