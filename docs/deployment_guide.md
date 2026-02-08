# NaiBotAssistant 部署指南

## 系统要求

- Python 3.8+
- Windows 11 或 Ubuntu 24.04
- 至少 100MB 可用磁盘空间

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
python app/init_db.py
```

### 3. 启动应用

#### 开发模式（Flask）

```bash
python run.py --mode dev
```

或简写：
```bash
python run.py
```

访问地址: http://localhost:5000

#### 生产模式（Waitress）

```bash
python run.py --mode prod
```

访问地址: http://localhost:5000

### 4. 自定义配置

修改 `config.json` 文件来自定义配置：

```json
{
    "server": {
        "host": "0.0.0.0",
        "port": 5000
    }
}
```

然后使用自定义端口启动：

```bash
python run.py --mode prod --port 8080
```

## 配置说明

### config.json 配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `app_name` | 应用名称 | NaiBotAssistant |
| `version` | 版本号 | 1.0.0 |
| `server.host` | 服务器地址 | 0.0.0.0 |
| `server.port` | 服务器端口 | 5000 |
| `server.debug` | 调试模式 | false |
| `database.path` | 数据库路径 | ./database/naibot.db |
| `logging.level` | 日志级别 | INFO |
| `upload.max_file_size` | 最大上传文件大小 | 10485760 (10MB) |
| `pagination.default_page_size` | 默认分页大小 | 100 |
| `backup.temp_dir` | 临时文件目录 | ./temp |
| `backup.retention_days` | 备份保留天数 | 30 |

## 功能说明

### 1. 词条录入

- 访问"词条录入"页面
- 选择或输入分类
- 填写词条名称和英文译文
- 可选填写注释
- 点击"录入词条"按钮

### 2. 词条组合

- 访问"词条组合"页面
- 选择分类筛选词条
- 勾选需要组合的词条
- 预览组合结果
- 点击"复制文本"按钮

### 3. 批量管理

- 访问"批量管理"页面
- 可按分类筛选
- 支持编辑、删除单个词条
- 支持批量选择和删除

### 4. 备份管理

#### 导出备份

- **CSV格式**: 导出为CSV文件，可在Excel中打开
- **数据库格式**: 导出完整的SQLite数据库文件

#### 恢复数据

- **增量恢复**: 追加新数据，更新已存在的词条
- **覆盖恢复**: 完全替换现有数据（会自动备份）

## API 文档

详细的API文档请查看 `docs/api_documentation.md`

### 主要端点

- `GET /api/v1/health` - 健康检查
- `GET /api/v1/categories` - 获取分类列表
- `GET /api/v1/prompts` - 获取词条列表
- `POST /api/v1/prompts` - 创建词条
- `PUT /api/v1/prompts/{id}` - 更新词条
- `DELETE /api/v1/prompts/{id}` - 删除词条
- `POST /api/v1/combine/generate` - 生成组合提示词
- `GET /api/v1/backup/export/csv` - 导出CSV
- `POST /api/v1/backup/restore/csv/increment` - 增量恢复CSV

## 数据库管理

### 数据库位置

默认位置: `./database/naibot.db`

### 重新初始化数据库

```bash
# 备份现有数据库
cp database/naibot.db database/naibot_backup.db

# 删除现有数据库
rm database/naibot.db

# 重新初始化
python app/init_db.py
```

### 数据库结构

#### prompts 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| category | VARCHAR(50) | 分类 |
| name | VARCHAR(100) | 名称 |
| translation | TEXT | 英文译文 |
| comment | TEXT | 注释 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

#### backup_history 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| operation | VARCHAR(50) | 操作类型 |
| filename | VARCHAR(255) | 文件名 |
| imported_count | INTEGER | 导入数量 |
| timestamp | DATETIME | 时间戳 |

## 故障排除

### 1. 端口已被占用

错误信息: `Address already in use`

解决方案:
```bash
# 使用其他端口
python run.py --port 8080
```

### 2. 数据库锁定

错误信息: `database is locked`

解决方案:
```bash
# 停止所有运行的实例
# 删除锁文件
rm database/naibot.db-journal
```

### 3. 依赖安装失败

解决方案:
```bash
# 升级pip
python -m pip install --upgrade pip

# 使用国内镜像源
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 4. 文件上传失败

检查:
- 文件大小是否超过限制（默认10MB）
- 文件格式是否正确（CSV或DB）
- 临时目录是否有写入权限

## 生产环境部署

### 使用 Waitress (推荐)

```bash
python run.py --mode prod --host 0.0.0.0 --port 5000
```

### 使用 Nginx 反向代理

nginx.conf 配置示例:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /static {
        alias /path/to/NaiBotAssistant/static;
    }
}
```

### 使用 systemd 服务（Linux）

创建服务文件 `/etc/systemd/system/naibot.service`:

```ini
[Unit]
Description=NaiBotAssistant Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/NaiBotAssistant
ExecStart=/usr/bin/python3 /path/to/NaiBotAssistant/run.py --mode prod
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务:

```bash
sudo systemctl daemon-reload
sudo systemctl start naibot
sudo systemctl enable naibot
```

## 安全建议

1. **修改SECRET_KEY**: 在生产环境中设置环境变量
   ```bash
   export SECRET_KEY="your-secret-key-here"
   ```

2. **限制访问**: 配置防火墙规则
   ```bash
   # 只允许本地访问
   python run.py --host 127.0.0.1
   ```

3. **定期备份**: 设置定时任务备份数据库
   ```bash
   # crontab -e
   0 2 * * * cp /path/to/database/naibot.db /path/to/backup/naibot_$(date +\%Y\%m\%d).db
   ```

4. **日志监控**: 检查日志文件
   ```bash
   tail -f logs/app.log
   ```

## 更新日志

### v1.0.0 (2026-02-08)

- ✅ 完整的词条管理功能
- ✅ 词条组合生成
- ✅ CSV和数据库备份/恢复
- ✅ 分类管理和统计
- ✅ 响应式前端界面
- ✅ RESTful API设计
- ✅ 双模式启动（开发/生产）

## 许可证

MIT License

## 技术支持

如有问题，请查看:
- API文档: `docs/api_documentation.md`
- 项目README: `static/README.md`
- GitHub Issues: https://github.com/naibotassistant/issues
