"""
数据库初始化脚本
创建数据库表并插入初始测试数据
"""
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models import db, Prompt, BackupHistory
from datetime import datetime


def init_database():
    """初始化数据库"""
    app = create_app()
    
    with app.app_context():
        # 创建所有表
        print("正在创建数据库表...")
        db.create_all()
        print("数据库表创建成功！")
        
        # 检查是否已有数据
        if Prompt.query.first():
            print("数据库已包含数据，跳过初始数据插入。")
            return
        
        # 插入初始测试数据
        print("正在插入初始测试数据...")
        
        test_prompts = [
            Prompt(category='角色', name='可爱少女', translation='cute girl, kawaii', comment='适合二次元角色'),
            Prompt(category='角色', name='温柔女孩', translation='gentle girl, soft', comment='温柔气质'),
            Prompt(category='角色', name='黑发少女', translation='black hair girl, dark hair', comment='黑色头发'),
            Prompt(category='场景', name='樱花飞舞', translation='cherry blossom, sakura, petals', comment='春季场景'),
            Prompt(category='场景', name='夜景', translation='night scene, moonlight', comment='夜晚场景'),
            Prompt(category='风格', name='动漫风格', translation='anime style, manga style', comment='二次元风格'),
            Prompt(category='风格', name='写实风格', translation='realistic style, photorealistic', comment='真实感风格'),
            Prompt(category='质量', name='高质量', translation='high quality, masterpiece', comment='提升图像质量'),
            Prompt(category='质量', name='详细面部', translation='detailed face, facial details', comment='面部细节'),
            Prompt(category='其他', name='特殊效果', translation='special effects, glowing', comment='特效处理'),
        ]
        
        for prompt in test_prompts:
            db.session.add(prompt)
        
        db.session.commit()
        print(f"成功插入 {len(test_prompts)} 条测试数据！")
        
        print("\n数据库初始化完成！")
        print(f"数据库路径: {app.config['SQLALCHEMY_DATABASE_URI']}")


if __name__ == '__main__':
    init_database()
