# TGO-Tech API Service - AI Agents Guide

本文件旨在为 AI 代理（如 Cursor, GitHub Copilot, Claude 等）提供项目上下文、开发规范和架构指南。

## 1. 项目概述

TGO-Tech API Service 是 TGO 客服平台的核心业务逻辑微服务。

- **多租户架构**: 通过项目 (Project) 实现数据的逻辑隔离。
- **双服务架构**:
  - **Main API (Port 8000)**: 面向客户端/管理后台，需要 JWT 或 API Key 认证。入口：`app/main.py`
  - **Internal API (Port 8001)**: 面向内部微服务通信，无需认证（应仅暴露在内部网络）。入口：`app/internal.py`
- **主要实体**: 项目 (Project)、平台 (Platform)、员工/AI代理 (Staff)、访客 (Visitor)、会话 (Session)、消息 (Chat)。

## 2. 技术栈

- **语言**: Python 3.11+
- **框架**: FastAPI
- **数据库**: PostgreSQL (SQLAlchemy 2.0 + Alembic)
- **缓存/Session**: Redis
- **依赖管理**: Poetry
- **IM 引擎**: WuKongIM

## 3. 项目结构

```text
app/
├── api/
│   ├── v1/             # 公开 API 接口
│   │   └── endpoints/  # 具体业务端点 (staff, visitor, chat, ai_*, etc.)
│   └── internal/       # 内部微服务接口
├── core/               # 核心配置 (config, security, database, logging)
├── models/             # SQLAlchemy 数据模型 (表名前缀: api_)
├── schemas/            # Pydantic 数据验证模型
├── services/           # 业务逻辑服务层 (核心逻辑在此)
├── tasks/              # 定时任务或后台任务 (apscheduler/asyncio)
├── utils/              # 通用工具函数
├── main.py             # Main API 入口
└── internal.py         # Internal API 入口
```

## 4. 开发规范

### 4.1 代码风格
- **格式化**: 使用 `black` (88 字符行宽) 和 `isort`。
- **类型检查**: 严格执行 `mypy` 类型注解，尽可能避免 `Any`。
- **异步**: 优先使用 `async/await`。数据库操作使用异步 session (`AsyncSession`)，但在迁移或某些特定任务中可能使用同步。

### 4.2 数据库规范
- **表名**: 所有项目相关的表名必须以 `api_` 开头（例如 `api_projects`, `api_staff`）。
- **字段**: 使用小写下划线命名（snake_case）。
- **迁移**: 任何模型更改需要生成 Alembic 脚本。

### 4.3 常量与枚举
- **禁止硬编码**: 严禁在业务代码中硬编码重复使用的字符串、整数或类型 ID。
- **统一管理**: 所有共享的常量、枚举（如消息类型、频道类型等）必须定义在 `app/utils/const.py` 中。

### 4.4 认证与授权
- **JWT**: 用于员工 (Staff) 登录后的操作。


## 5. 常用开发命令



## 6. 核心业务逻辑参考

- **消息流转**: `app/services/chat_service.py` 负责核心消息处理逻辑。
- **访客分配**: `app/services/visitor_service.py` 和 `app/tasks/process_waiting_queue.py`。
- **AI 集成**: `app/services/ai_client.py` 封装了与外部 AI 服务的通信。
- **多平台同步**: `app/services/platform_sync.py` 负责各社交平台消息同步。

## 7. 给 AI 代理的建议

1. **查阅现有 Service**: 在实现新接口前，先检查 `app/services/` 下是否有现成的业务逻辑。
2. **遵循依赖注入**: 在 API Endpoint 中，始终使用 `Depends(get_db)` 获取数据库会话。
3. **错误处理**: 使用 `app.core.exceptions.TGOAPIException` 及其子类抛出业务错误。
4. **日志**: 使用 `logging` 记录关键路径，避免使用 `print`。

---
*Created on 2026-01-11*
