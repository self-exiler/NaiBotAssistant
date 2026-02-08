# NaiBotAssistant 快速启动指南

## ✅ 环境要求

- Python 3.8+ (已测试 Python 3.13)
- Windows 11 或 Ubuntu 24.04

## 🚀 快速启动步骤

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

> **注意**: 如果使用 Python 3.13,确保 SQLAlchemy >= 2.0.36

### 2. 初始化数据库

```bash
python app/init_db.py
```

预期输出:
```
正在创建数据库表...
数据库表创建成功！
正在插入初始测试数据...
成功插入 10 条测试数据！
数据库初始化完成！
```

### 3. 启动应用

**开发模式** (推荐用于测试):
```bash
python run.py --mode dev
```

**生产模式**:
```bash
python run.py --mode prod
```

### 4. 访问应用

打开浏览器访问: **http://localhost:5000**

## 📝 功能测试

1. **词条录入**: 点击"词条录入"菜单,添加新词条
2. **词条组合**: 点击"词条组合",选择词条并生成组合文本
3. **批量管理**: 点击"批量管理",查看、编辑、删除词条
4. **备份管理**: 点击"备份管理",导出/恢复数据

## 🔧 常见问题

### Python 3.13 兼容性错误

如果遇到 `AssertionError: Class ... TypingOnly` 错误:

```bash
pip install --upgrade "SQLAlchemy>=2.0.36"
```

### 端口被占用

```bash
python run.py --port 8080
```

### 数据库文件位置

默认位置: `./database/naibot.db`

## 📚 更多文档

- [完整部署指南](file:///c:/Users/dioha/OneDrive/project/NaiBotAssistant/docs/deployment_guide.md)
- [API文档](file:///c:/Users/dioha/OneDrive/project/NaiBotAssistant/docs/api_documentation.md)
- [项目完成报告](file:///C:/Users/dioha/.gemini/antigravity/brain/2fa10b0f-039f-4abf-acda-856250cae4b3/walkthrough.md)
