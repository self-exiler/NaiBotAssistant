"""
数据库模型定义
"""
from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def _utcnow():
    return datetime.now(timezone.utc)


class Prompt(db.Model):
    """词条模型"""
    __tablename__ = 'prompts'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    category = db.Column(db.String(50), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    translation = db.Column(db.Text, nullable=False)
    comment = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'category': self.category,
            'name': self.name,
            'translation': self.translation,
            'comment': self.comment,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
            'updated_at': self.updated_at.isoformat() + 'Z' if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<Prompt {self.id}: {self.name}>'


class BackupHistory(db.Model):
    """备份历史记录模型"""
    __tablename__ = 'backup_history'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    operation = db.Column(db.String(50), nullable=False)  # csv_increment, csv_replace, db_increment, db_replace
    filename = db.Column(db.String(255), nullable=False)
    imported_count = db.Column(db.Integer, default=0)
    timestamp = db.Column(db.DateTime, default=_utcnow, nullable=False)
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'operation': self.operation,
            'filename': self.filename,
            'imported_count': self.imported_count,
            'timestamp': self.timestamp.isoformat() + 'Z' if self.timestamp else None
        }
    
    def __repr__(self):
        return f'<BackupHistory {self.id}: {self.operation}>'
