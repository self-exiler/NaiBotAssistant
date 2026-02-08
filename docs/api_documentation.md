---
AIGC:
    ContentProducer: Minimax Agent AI
    ContentPropagator: Minimax Agent AI
    Label: AIGC
    ProduceID: b5a58e8cc2d8fa6e8b4b61319507b6a1
    PropagateID: b5a58e8cc2d8fa6e8b4b61319507b6a1
    ReservedCode1: 3045022100b664061b9b13622126d6cb671b2dfd0b3f8c9181d095866a443faccce364b0d902200784744163ff0b2969c00d50baca303dfe3996d973a8a6eb2105cc7cff3da105
    ReservedCode2: 3045022100f9cf1cedf99d776098b71321cd3378d55bff61744c778840a1dc17bec221501f022030a462dca2bdd92ae5dd54d56aaf01687280258afc478a1c50dadf7353ea3376
---

# NaiBotAssistant 前后端API接口文档

## 1. API设计原则

### 1.1 通用规范
- **基础路径**：`/api/v1/`
- **请求格式**：JSON
- **响应格式**：JSON
- **字符编码**：UTF-8
- **时间格式**：ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)

### 1.2 HTTP状态码
- `200` - 成功
- `400` - 请求参数错误
- `404` - 资源不存在
- `422` - 业务逻辑错误
- `500` - 服务器内部错误

### 1.3 统一响应格式
```json
{
    "code": 200,
    "message": "操作成功",
    "data": {},
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 1.4 错误响应格式
```json
{
    "code": 400,
    "message": "错误描述",
    "errors": {
        "field1": ["错误信息1"],
        "field2": ["错误信息2"]
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

## 2. 分类管理API

### 2.1 获取所有分类
```
GET /api/v1/categories
```

**响应示例**：
```json
{
    "code": 200,
    "message": "获取成功",
    "data": [
        {
            "id": 1,
            "name": "角色",
            "count": 15,
            "created_at": "2025-02-07T10:00:00.000Z"
        },
        {
            "id": 2,
            "name": "场景",
            "count": 23,
            "created_at": "2025-02-07T10:05:00.000Z"
        }
    ],
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 2.2 获取分类统计信息
```
GET /api/v1/categories/stats
```

**响应示例**：
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "total_categories": 8,
        "total_prompts": 156,
        "recent_added": 5
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

## 3. 词条管理API

### 3.1 获取词条列表
```
GET /api/v1/prompts
```

**查询参数**：
- `category` (string) - 分类筛选
- `page` (integer) - 页码，默认1
- `limit` (integer) - 每页条数，默认100，最大100
- `sort` (string) - 排序方式：name_asc（按名称升序），created_desc（按创建时间降序）

**响应示例**：
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "prompts": [
            {
                "id": 1,
                "category": "角色",
                "name": "可爱少女",
                "translation": "cute girl, kawaii",
                "comment": "适合二次元角色",
                "created_at": "2025-02-07T10:00:00.000Z",
                "updated_at": "2025-02-07T10:00:00.000Z"
            }
        ],
        "pagination": {
            "page": 1,
            "limit": 100,
            "total": 156,
            "pages": 2
        }
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 3.2 搜索词条
```
GET /api/v1/prompts/search
```

**查询参数**：
- `keyword` (string) - 搜索关键词
- `category` (string) - 分类筛选（可选）

**响应示例**：
```json
{
    "code": 200,
    "message": "搜索成功",
    "data": [
        {
            "id": 1,
            "category": "角色",
            "name": "可爱少女",
            "translation": "cute girl, kawaii",
            "comment": "适合二次元角色",
            "created_at": "2025-02-07T10:00:00.000Z",
            "updated_at": "2025-02-07T10:00:00.000Z"
        }
    ],
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 3.3 创建词条
```
POST /api/v1/prompts
```

**请求体**：
```json
{
    "category": "角色",
    "name": "可爱少女",
    "translation": "cute girl, kawaii",
    "comment": "适合二次元角色"
}
```

**响应示例**：
```json
{
    "code": 201,
    "message": "词条创建成功",
    "data": {
        "id": 1,
        "category": "角色",
        "name": "可爱少女",
        "translation": "cute girl, kawaii",
        "comment": "适合二次元角色",
        "created_at": "2025-02-07T22:49:30.000Z",
        "updated_at": "2025-02-07T22:49:30.000Z"
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 3.4 更新词条
```
PUT /api/v1/prompts/{id}
```

**路径参数**：
- `id` (integer) - 词条ID

**请求体**：
```json
{
    "category": "角色",
    "name": "可爱女孩",
    "translation": "cute girl, adorable",
    "comment": "适合二次元角色，更新注释"
}
```

**响应示例**：
```json
{
    "code": 200,
    "message": "词条更新成功",
    "data": {
        "id": 1,
        "category": "角色",
        "name": "可爱女孩",
        "translation": "cute girl, adorable",
        "comment": "适合二次元角色，更新注释",
        "created_at": "2025-02-07T10:00:00.000Z",
        "updated_at": "2025-02-07T22:49:30.000Z"
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 3.5 删除词条
```
DELETE /api/v1/prompts/{id}
```

**路径参数**：
- `id` (integer) - 词条ID

**响应示例**：
```json
{
    "code": 200,
    "message": "词条删除成功",
    "data": null,
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 3.6 批量删除词条
```
DELETE /api/v1/prompts/batch
```

**请求体**：
```json
{
    "ids": [1, 2, 3, 4, 5]
}
```

**响应示例**：
```json
{
    "code": 200,
    "message": "批量删除成功，删除5条记录",
    "data": {
        "deleted_count": 5
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 3.7 获取词条详情
```
GET /api/v1/prompts/{id}
```

**路径参数**：
- `id` (integer) - 词条ID

**响应示例**：
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "id": 1,
        "category": "角色",
        "name": "可爱少女",
        "translation": "cute girl, kawaii",
        "comment": "适合二次元角色",
        "created_at": "2025-02-07T10:00:00.000Z",
        "updated_at": "2025-02-07T10:00:00.000Z"
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

## 4. 词条组合API

### 4.1 按分类获取词条列表（用于组合页面）
```
GET /api/v1/combine/prompts/{category}
```

**路径参数**：
- `category` (string) - 分类名称

**响应示例**：
```json
{
    "code": 200,
    "message": "获取成功",
    "data": [
        {
            "id": 1,
            "name": "可爱少女",
            "translation": "cute girl, kawaii",
            "comment": "适合二次元角色"
        },
        {
            "id": 2,
            "name": "温柔女孩",
            "translation": "gentle girl, soft",
            "comment": "温柔气质"
        }
    ],
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 4.2 生成组合提示词
```
POST /api/v1/combine/generate
```

**请求体**：
```json
{
    "prompt_ids": [1, 2, 3],
    "add_prefix": true,
    "custom_prefix": "Nai"
}
```

**响应示例**：
```json
{
    "code": 200,
    "message": "组合生成成功",
    "data": {
        "combined_text": "Nai cute girl, kawaii, gentle girl, soft, beautiful eyes",
        "selected_count": 3,
        "add_prefix": true
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

## 5. 备份管理API

### 5.1 导出CSV格式备份
```
GET /api/v1/backup/export/csv
```

**查询参数**：
- `category` (string) - 指定分类导出（可选）

**响应示例**：
```json
{
    "code": 200,
    "message": "CSV导出成功",
    "data": {
        "download_url": "/api/v1/backup/download/csv_file_20250207.csv",
        "filename": "naibot_prompts_20250207.csv",
        "total_records": 156,
        "expires_at": "2025-02-07T23:49:30.000Z"
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 5.2 导出SQLite数据库备份
```
GET /api/v1/backup/export/db
```

**响应示例**：
```json
{
    "code": 200,
    "message": "数据库备份导出成功",
    "data": {
        "download_url": "/api/v1/backup/download/db_file_20250207.db",
        "filename": "naibot_database_20250207.db",
        "total_records": 156,
        "expires_at": "2025-02-07T23:49:30.000Z"
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 5.3 下载备份文件
```
GET /api/v1/backup/download/{filename}
```

**路径参数**：
- `filename` (string) - 文件名

### 5.4 增量恢复数据（从CSV）
```
POST /api/v1/backup/restore/csv/increment
```

**请求体**：multipart/form-data
- `file` (file) - CSV文件
- `encoding` (string) - 文件编码，默认utf-8

**响应示例**：
```json
{
    "code": 200,
    "message": "增量恢复成功",
    "data": {
        "imported_count": 25,
        "updated_count": 3,
        "skipped_count": 2,
        "errors": []
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 5.5 覆盖恢复数据（从CSV）
```
POST /api/v1/backup/restore/csv/replace
```

**请求体**：multipart/form-data
- `file` (file) - CSV文件
- `encoding` (string) - 文件编码，默认utf-8

**响应示例**：
```json
{
    "code": 200,
    "message": "覆盖恢复成功",
    "data": {
        "imported_count": 156,
        "backup_before_restore": true,
        "backup_filename": "naibot_backup_20250207.db"
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 5.6 从数据库恢复数据
```
POST /api/v1/backup/restore/db
```

**请求体**：multipart/form-data
- `file` (file) - SQLite数据库文件
- `mode` (string) - 恢复模式：increment或replace

**响应示例**：
```json
{
    "code": 200,
    "message": "数据库恢复成功",
    "data": {
        "restored_count": 156,
        "mode": "increment",
        "backup_before_operation": true
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 5.7 获取恢复历史记录
```
GET /api/v1/backup/history
```

**响应示例**：
```json
{
    "code": 200,
    "message": "获取成功",
    "data": [
        {
            "id": 1,
            "operation": "csv_increment",
            "filename": "user_prompts.csv",
            "imported_count": 25,
            "timestamp": "2025-02-07T20:30:00.000Z"
        }
    ],
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

## 6. 系统配置API

### 6.1 获取系统配置
```
GET /api/v1/config
```

**响应示例**：
```json
{
    "code": 200,
    "message": "获取成功",
    "data": {
        "app_name": "NaiBotAssistant",
        "version": "1.0.0",
        "log_level": "INFO",
        "server_port": 5000,
        "database_path": "./data/naibot.db",
        "max_upload_size": 10485760,
        "page_size": 100
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 6.2 更新系统配置
```
PUT /api/v1/config
```

**请求体**：
```json
{
    "log_level": "DEBUG",
    "server_port": 8080,
    "page_size": 50
}
```

**响应示例**：
```json
{
    "code": 200,
    "message": "配置更新成功",
    "data": {
        "restart_required": true,
        "restart_message": "请重启服务以使配置生效"
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

### 6.3 获取系统状态
```
GET /api/v1/system/status
```

**响应示例**：
```json
{
    "code": 200,
    "message": "系统状态正常",
    "data": {
        "database": {
            "status": "connected",
            "total_prompts": 156,
            "total_categories": 8,
            "database_size": "2.5MB"
        },
        "server": {
            "status": "running",
            "uptime": "2h 15m 30s",
            "memory_usage": "45MB",
            "cpu_usage": "5%"
        },
        "backup": {
            "last_backup": "2025-02-07T18:00:00.000Z",
            "auto_backup": true,
            "backup_retention_days": 30
        }
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

## 7. 健康检查API

### 7.1 健康检查
```
GET /api/v1/health
```

**响应示例**：
```json
{
    "code": 200,
    "message": "服务正常",
    "data": {
        "status": "healthy",
        "timestamp": "2025-02-07T22:49:30.000Z",
        "version": "1.0.0"
    },
    "timestamp": "2025-02-07T22:49:30.000Z"
}
```

## 8. 错误代码定义

### 8.1 通用错误代码
- `4001` - 请求参数错误
- `4002` - 必填参数缺失
- `4003` - 参数格式错误
- `4004` - 请求数据过大

### 8.2 业务错误代码
- `4101` - 词条不存在
- `4102` - 分类不存在
- `4103` - 词条已存在
- `4104` - 分类已存在

### 8.3 系统错误代码
- `5001` - 数据库连接错误
- `5002` - 文件操作错误
- `5003` - 内存不足
- `5004` - 服务不可用

## 9. 使用示例

### 9.1 前端JavaScript调用示例

#### 获取词条列表
```javascript
// 获取角色分类下的词条
async function loadPrompts(category = '角色', page = 1, limit = 100) {
    try {
        const response = await fetch(`/api/v1/prompts?category=${encodeURIComponent(category)}&page=${page}&limit=${limit}`);
        const result = await response.json();
        
        if (result.code === 200) {
            return result.data;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('获取词条列表失败:', error);
        throw error;
    }
}
```

#### 创建新词条
```javascript
// 创建新词条
async function createPrompt(promptData) {
    try {
        const response = await fetch('/api/v1/prompts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(promptData)
        });
        
        const result = await response.json();
        
        if (result.code === 201) {
            return result.data;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('创建词条失败:', error);
        throw error;
    }
}
```

#### 生成组合提示词
```javascript
// 生成组合提示词
async function generateCombinedPrompt(promptIds, addPrefix = true) {
    try {
        const response = await fetch('/api/v1/combine/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt_ids: promptIds,
                add_prefix: addPrefix,
                custom_prefix: 'Nai'
            })
        });
        
        const result = await response.json();
        
        if (result.code === 200) {
            return result.data.combined_text;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('生成组合提示词失败:', error);
        throw error;
    }
}
```

#### 复制到剪贴板
```javascript
// 复制文本到剪贴板
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            // 使用现代Clipboard API
            await navigator.clipboard.writeText(text);
        } else {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }
        return true;
    } catch (error) {
        console.error('复制到剪贴板失败:', error);
        return false;
    }
}
```

### 9.2 错误处理示例
```javascript
// 统一的API调用函数
async function apiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const result = await response.json();
        
        if (result.code >= 200 && result.code < 300) {
            return result;
        } else if (result.code >= 400 && result.code < 500) {
            // 客户端错误，显示友好提示
            showErrorMessage(result.message);
            throw new Error(result.message);
        } else if (result.code >= 500) {
            // 服务器错误
            showErrorMessage('服务器内部错误，请稍后重试');
            throw new Error('服务器内部错误');
        }
        
        return result;
    } catch (error) {
        console.error('API调用失败:', error);
        if (!error.message) {
            showErrorMessage('网络连接失败，请检查网络设置');
        }
        throw error;
    }
}

// 显示错误消息的辅助函数
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4757;
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(errorDiv);
    
    // 3秒后自动消失
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 3000);
}
```

## 10. 安全考虑

### 10.1 输入验证
- 所有用户输入都需要验证和转义
- SQL注入防护：使用参数化查询
- XSS防护：对输出进行HTML转义

### 10.2 文件上传安全
- 限制文件类型：仅允许CSV和DB文件
- 限制文件大小：最大10MB
- 文件名验证：防止路径遍历攻击

### 10.3 速率限制
- API调用频率限制
- 大批量操作限制
- 防止DDoS攻击

### 10.4 数据备份
- 操作前自动备份
- 备份文件加密存储
- 备份文件过期自动清理

这个API文档为前后端开发提供了完整的技术规范和接口定义，确保开发的系统具有良好的可维护性和扩展性。