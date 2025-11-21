# TGO 部署模式详解

本文档详细介绍 TGO 部署脚本支持的各种部署模式及其组合使用方式。

## 部署模式概览

TGO 部署脚本支持两个主要选项，可以单独或组合使用：

| 选项 | 说明 | 适用场景 |
|------|------|---------|
| `--source` | 从本地源码构建镜像 | 开发环境、自定义修改、离线部署 |
| `--cn` | 使用中国镜像源 | 中国境内网络环境 |

## 四种部署模式

### 模式 1: 默认模式（预构建镜像 + GHCR）

```bash
./tgo.sh install
```

**特点**：
- 使用 GitHub Container Registry (GHCR) 的预构建镜像
- 最快的部署方式（无需本地构建）
- 适合生产环境和国际网络环境

**镜像来源**：
- `ghcr.io/tgoai/tgo/tgo-rag:latest`
- `ghcr.io/tgoai/tgo/tgo-ai:latest`
- `ghcr.io/tgoai/tgo/tgo-api:latest`
- 等等...

**Compose 文件**：
```
docker-compose.yml
```

---

### 模式 2: 中国镜像模式（预构建镜像 + ACR）

```bash
./tgo.sh install --cn
```

**特点**：
- 使用阿里云容器镜像服务 (ACR) 的预构建镜像
- 在中国境内网络环境下速度最快
- 镜像与 GHCR 完全相同，只是存储位置不同

**镜像来源**：
- `registry.cn-shanghai.aliyuncs.com/tgoai/tgo-rag:latest`
- `registry.cn-shanghai.aliyuncs.com/tgoai/tgo-ai:latest`
- `registry.cn-shanghai.aliyuncs.com/tgoai/tgo-api:latest`
- 等等...

**Compose 文件**：
```
docker-compose.yml + docker-compose.cn.yml (自动生成)
```

**性能对比**：
- 镜像拉取速度：**5-10x** 提升
- 首次部署时间：**3-4x** 提升

---

### 模式 3: 源码构建模式

```bash
./tgo.sh install --source
```

**特点**：
- 从 `repos/` 目录的本地源码构建镜像
- 适合开发环境和自定义修改
- 构建时间较长，但可以完全控制代码

**镜像来源**：
- 本地构建，标签为 `tgo-rag:local`、`tgo-ai:local` 等

**Compose 文件**：
```
docker-compose.yml + docker-compose.source.yml
```

**适用场景**：
- 开发和调试
- 自定义功能开发
- 离线部署（无法访问镜像仓库）
- 验证代码修改

---

### 模式 4: 源码构建 + 中国网络优化

```bash
./tgo.sh install --source --cn
```

**特点**：
- 从本地源码构建镜像
- 标记为中国网络环境（未来可能添加更多优化）
- 适合中国境内的开发环境

**镜像来源**：
- 本地构建

**Compose 文件**：
```
docker-compose.yml + docker-compose.source.yml
```

**注意**：
- 当前 `--cn` 在 `--source` 模式下主要用于标记
- 未来可能添加：pip 国内镜像源、npm 国内镜像源等优化

---

## 模式选择指南

### 我应该使用哪种模式？

```
┌─────────────────────────────────────┐
│ 你在中国境内吗？                      │
└─────────────┬───────────────────────┘
              │
        ┌─────┴─────┐
        │           │
       是          否
        │           │
        ▼           ▼
  ┌─────────┐  ┌─────────┐
  │需要修改  │  │需要修改  │
  │代码吗？  │  │代码吗？  │
  └────┬────┘  └────┬────┘
       │            │
   ┌───┴───┐    ┌───┴───┐
   │       │    │       │
  是      否   是      否
   │       │    │       │
   ▼       ▼    ▼       ▼
--source  --cn  --source  默认
  --cn
```

### 具体建议

| 场景 | 推荐模式 | 命令 |
|------|---------|------|
| 🇨🇳 中国境内生产部署 | 中国镜像模式 | `./tgo.sh install --cn` |
| 🌍 国际生产部署 | 默认模式 | `./tgo.sh install` |
| 🇨🇳 中国境内开发 | 源码构建 + 中国优化 | `./tgo.sh install --source --cn` |
| 🌍 国际开发 | 源码构建模式 | `./tgo.sh install --source` |
| 📦 离线部署 | 源码构建模式 | `./tgo.sh install --source` |
| 🔧 快速测试 | 根据网络环境选择 | `./tgo.sh install [--cn]` |

---

## 参数组合规则

### 有效组合

```bash
# ✓ 单独使用
./tgo.sh install
./tgo.sh install --source
./tgo.sh install --cn

# ✓ 组合使用（任意顺序）
./tgo.sh install --source --cn
./tgo.sh install --cn --source
```

### 无效组合

```bash
# ✗ 重复参数
./tgo.sh install --cn --cn

# ✗ 未知参数
./tgo.sh install --fast
```

---

## 切换部署模式

### 从默认模式切换到中国镜像模式

```bash
# 停止当前服务
./tgo.sh uninstall

# 使用中国镜像重新部署
./tgo.sh install --cn
```

### 从镜像模式切换到源码模式

```bash
# 停止当前服务
./tgo.sh uninstall [--cn]

# 从源码构建并部署
./tgo.sh install --source [--cn]
```

---

## 相关文档

- [中国境内网络环境部署指南](CN_MIRROR_GUIDE.md)
- [主 README](../README.md)
- [更新日志](../CHANGELOG_CN_SUPPORT.md)

