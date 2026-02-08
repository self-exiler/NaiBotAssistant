# NaiBotAssistant

一个功能强大的 AI 提示词（Prompt）管理系统，支持提示词的创建、组合、管理、备份等操作。

## 功能特性

- **提示词录入**：灵活的表单录入提示词
- **词条组合**：随机组合提示词生成新的组合内容
- **批量管理**：支持查看、编辑、删除、搜索提示词
- **数据备份**：支持导出 CSV和DB格式备份和恢复功能
- **分类管理**：为提示词建立分类系统
- **搜索过滤**：快速搜索和过滤提示词
- **响应式设计**：支持桌面和移动设备

## 快速开始

### 环境要求

- Python 3.8+ （已测试 Python 3.13）
- pip 包管理工具
- 现代浏览器

### Linux服务器部署安装步骤

使用部署脚本：

```
wget https://raw.githubusercontent.com/self-exiler/NaiBotAssistant/refs/heads/main/script/deploy.sh && chmod +x deploy.sh && sudo ./deploy.sh
```

## 功能使用说明

### 词条录入

1. 点击左侧菜单中的"词条录入"
2. 填写词条的相关信息（标题、内容、分类等）
3. 点击"提交"按钮保存词条

### 词条组合

1. 进入"词条组合"页面
2. 选择不同分类的词条进行组合
3. 点击"生成"按钮获取组合结果
4. 支持复制生成的组合文本
5. 使用Nai前缀时方便一键复制到NovelAiBot驱动的聊天软件里生图。

### 批量管理

1. 进入"批量管理"页面
2. 查看所有保存的词条列表
3. 支持以下操作：
   - 编辑：修改词条内容
   - 删除：删除选中词条
   - 搜索：快速查找词条

### 备份管理

1. 进入"备份管理"页面
2. **导出**：将当前数据导出为 JSON 文件
3. **恢复**：上传之前备份的 JSON 文件进行数据恢复

## 项目结构

```
NaiBotAssistant/
├── app/                          # 应用主目录
│   ├── __init__.py
│   ├── config.py                 # 配置文件
│   ├── init_db.py                # 数据库初始化脚本
│   ├── models.py                 # 数据模型定义
│   ├── routes/                   # API 路由
│   │   ├── __init__.py
│   │   ├── backup.py             # 备份管理 API
│   │   ├── categories.py         # 分类管理 API
│   │   ├── combine.py            # 词条组合 API
│   │   ├── config.py             # 配置 API
│   │   ├── health.py             # 健康检查 API
│   │   └── prompts.py            # 提示词 API
│   └── utils/                    # 工具函数
│       ├── __init__.py
│       ├── response.py           # 响应格式化
│       └── validators.py         # 数据验证
├── static/                       # 前端静态文件
│   ├── index.html                # 主 HTML 文件
│   ├── css/
│   │   └── style.css             # 样式表
│   └── js/
│       └── app.js                 # 主要 JavaScript 逻辑
├── database/                     # 数据库文件目录
│   └── naibot.db                 # SQLite 数据库文件
├── docs/                         # 文档
│   ├── api_documentation.md      # API 详细文档
│   └── prompt.md                 # 提示词说明
├── script/                       # 脚本目录
│   ├── deploy.sh                 # 部署脚本
│   └── import_backup.py          # 备份导入脚本
├── temp/                         # 临时文件目录
├── config.json                   # 应用配置文件
├── requirements.txt              # Python 依赖列表
├── run.py                        # 应用启动脚本
├── README.md                     # 项目说明文档
└── .gitignore                    # Git 忽略文件
```

## 许可证

参考[灵感](https://tags.novelai.dev/)，并沿用了其部分数据，本项目采用AGPL-3.0许可证。

## 贡献指南

欢迎提交 Pull Request 或报告问题！
