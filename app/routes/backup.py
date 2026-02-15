"""
备份管理API路由
"""
import os
import csv
import shutil
from datetime import datetime
from flask import Blueprint, request, send_file, after_this_request
from werkzeug.utils import secure_filename
from app.models import db, Prompt, BackupHistory
from app.utils.response import success_response, error_response
from app.utils.validators import allowed_file
from app.config import Config

bp = Blueprint('backup', __name__, url_prefix='/api/v1/backup')


def _create_cleanup_callback(filepath):
    """创建文件清理回调函数"""
    @after_this_request
    def cleanup(response):
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception:
            pass
        return response
    return cleanup


def _validate_upload_file(allowed_extensions):
    """验证上传文件，返回 (file, filepath, filename) 或错误响应"""
    if 'file' not in request.files:
        return None, None, None, error_response('未上传文件', 400)
    
    file = request.files['file']
    
    if file.filename == '':
        return None, None, None, error_response('文件名为空', 400)
    
    if not allowed_file(file.filename, allowed_extensions):
        return None, None, None, error_response(f'只允许上传{allowed_extensions}文件', 400)
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(Config.BACKUP_TEMP_DIR, filename)
    os.makedirs(Config.BACKUP_TEMP_DIR, exist_ok=True)
    file.save(filepath)
    
    return file, filepath, filename, None


@bp.route('/export/csv', methods=['GET'])
def export_csv():
    """导出CSV格式备份"""
    category = request.args.get('category', '')
    
    query = Prompt.query
    if category:
        query = query.filter_by(category=category)
    
    prompts = query.all()
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'naibot_prompts_{timestamp}.csv'
    filepath = os.path.join(Config.BACKUP_TEMP_DIR, filename)
    
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
    
    _create_cleanup_callback(filepath)
    
    return send_file(
        os.path.abspath(filepath),
        as_attachment=True,
        download_name=filename,
        mimetype='text/csv'
    )


@bp.route('/export/db', methods=['GET'])
def export_db():
    """导出SQLite数据库备份"""
    db_path = Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')
    
    if not os.path.exists(db_path):
        return error_response('数据库文件不存在', 404)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'naibot_database_{timestamp}.db'
    filepath = os.path.join(Config.BACKUP_TEMP_DIR, filename)
    
    os.makedirs(Config.BACKUP_TEMP_DIR, exist_ok=True)
    shutil.copy2(db_path, filepath)
    
    _create_cleanup_callback(filepath)
    
    return send_file(
        os.path.abspath(filepath),
        as_attachment=True,
        download_name=filename,
        mimetype='application/octet-stream'
    )


def _restore_csv(filepath, filename, replace_mode=False):
    """CSV恢复核心逻辑"""
    try:
        imported_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        backup_filename = None
        
        if replace_mode:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_filename = f'naibot_backup_{timestamp}.db'
            db_path = Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')
            backup_path = os.path.join(Config.BACKUP_TEMP_DIR, backup_filename)
            shutil.copy2(db_path, backup_path)
            Prompt.query.delete()
        
        with open(filepath, 'r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile)
            rows = list(reader)
        
        if not replace_mode:
            existing_prompts = {}
            for p in Prompt.query.all():
                existing_prompts[(p.category, p.name)] = p
        
        for row in rows:
            try:
                if replace_mode:
                    prompt = Prompt(
                        category=row['分类'],
                        name=row['名称'],
                        translation=row['译文'],
                        comment=row.get('注释', '')
                    )
                    db.session.add(prompt)
                    imported_count += 1
                else:
                    key = (row['分类'], row['名称'])
                    existing = existing_prompts.get(key)
                    
                    if existing:
                        existing.translation = row['译文']
                        existing.comment = row.get('注释', '')
                        updated_count += 1
                    else:
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
        
        history = BackupHistory(
            operation='csv_replace' if replace_mode else 'csv_increment',
            filename=filename,
            imported_count=imported_count
        )
        db.session.add(history)
        db.session.commit()
        
        data = {
            'imported_count': imported_count,
            'updated_count': updated_count,
            'skipped_count': skipped_count,
            'errors': errors[:10]
        }
        
        if replace_mode:
            data['backup_before_restore'] = True
            data['backup_filename'] = backup_filename
        
        return success_response(data, '覆盖恢复成功' if replace_mode else '增量恢复成功')
        
    except Exception as e:
        db.session.rollback()
        return error_response(f'恢复失败: {str(e)}', 500)
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


@bp.route('/restore/csv/increment', methods=['POST'])
def restore_csv_increment():
    """增量恢复数据（从CSV）"""
    _, filepath, filename, err = _validate_upload_file({'csv'})
    if err:
        return err
    
    return _restore_csv(filepath, filename, replace_mode=False)


@bp.route('/restore/csv/replace', methods=['POST'])
def restore_csv_replace():
    """覆盖恢复数据（从CSV）"""
    _, filepath, filename, err = _validate_upload_file({'csv'})
    if err:
        return err
    
    return _restore_csv(filepath, filename, replace_mode=True)


@bp.route('/restore/db', methods=['POST'])
def restore_db():
    """从数据库恢复数据"""
    _, filepath, filename, err = _validate_upload_file({'db', 'sqlite', 'sqlite3'})
    if err:
        return err
    
    mode = request.form.get('mode', 'increment')
    
    try:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'naibot_backup_{timestamp}.db'
        db_path = Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')
        backup_path = os.path.join(Config.BACKUP_TEMP_DIR, backup_filename)
        shutil.copy2(db_path, backup_path)
        
        shutil.copy2(filepath, db_path)
        
        db.session.remove()
        db.engine.dispose()
        
        restored_count = Prompt.query.count()
        
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
        if os.path.exists(filepath):
            os.remove(filepath)


@bp.route('/history', methods=['GET'])
def get_backup_history():
    """获取恢复历史记录"""
    history = BackupHistory.query.order_by(BackupHistory.timestamp.desc()).limit(Config.BACKUP_HISTORY_LIMIT).all()
    data = [h.to_dict() for h in history]
    return success_response(data, '获取成功')
