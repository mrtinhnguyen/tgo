# 数据目录权限问题修复

## 问题描述

### 问题 1: Kafka 权限错误

在 Ubuntu 上使用 `sudo ./tgo.sh install` 后，Kafka 容器报错：

```
tgo-api-kafka | uid=1000(appuser) gid=1000(appuser) groups=1000(appuser)
tgo-api-kafka | Running in KRaft mode...
tgo-api-kafka | Formatting metadata directory /var/lib/kafka/data with metadata.version 4.1-IV1.
Error while writing meta.properties file /var/lib/kafka/data: 
java.nio.file.AccessDeniedException: /var/lib/kafka/data/bootstrap.checkpoint.tmp
```

### 问题 2: 已存在目录的权限修改错误

当数据目录已经存在时，普通用户运行脚本会报错：

```
[INFO] Creating data directories...
  Directory ./data/postgres exists with current user ownership
chmod: changing permissions of './data/postgres': Operation not permitted
chmod: cannot read directory './data/postgres': Permission denied
```

## 根本原因

### Kafka 权限问题原因

1. **使用 sudo 运行脚本**：`sudo ./tgo.sh install`
2. **Docker 自动创建目录**：当卷挂载的目录不存在时，Docker 会自动创建
3. **目录归 root 所有**：使用 sudo 时，Docker 创建的目录归 root 所有
4. **容器内非 root 用户**：Kafka 容器内运行的是 `uid=1000` 的普通用户
5. **权限冲突**：容器内的 uid=1000 无法写入 root 拥有的目录

### 已存在目录问题原因

1. **目录已存在**：之前运行过脚本，目录已经创建
2. **目录属于其他用户**：可能是 root 或其他用户
3. **普通用户无权修改**：当前用户无法 chmod 其他用户的目录
4. **脚本未检查**：原脚本没有检查目录是否可写就尝试修改权限

## 解决方案

### 修改内容

在 `tgo.sh` 的 `install` 函数中，在启动服务之前添加数据目录创建和权限设置逻辑。

### 关键改进

#### 1. 检测 sudo 场景

```bash
# 使用 ${SUDO_USER:-} 避免 set -u 报错
if [ -n "${SUDO_USER:-}" ]; then
  TARGET_USER="$SUDO_USER"
  TARGET_UID=$(id -u "$SUDO_USER")
  TARGET_GID=$(id -g "$SUDO_USER")
else
  TARGET_USER="${USER:-$(whoami)}"
  TARGET_UID=$(id -u)
  TARGET_GID=$(id -g)
fi
```

#### 2. 智能目录处理

```bash
for dir in "${DATA_DIRS[@]}"; do
  # 检查目录是否存在且可写
  if [ -d "$dir" ] && [ -w "$dir" ]; then
    echo "  ✓ $dir (already exists and writable)"
    continue  # 跳过，无需处理
  fi
  
  # 目录不存在或不可写 - 需要创建/修复
  if [ ! -d "$dir" ]; then
    # 创建新目录并设置权限
    mkdir -p "$dir"
    # ... 设置所有权和权限
  else
    # 目录存在但不可写
    if [ "$(id -u)" -eq 0 ]; then
      # root 用户可以修复
      chown -R "$TARGET_UID:$TARGET_GID" "$dir"
      chmod -R 755 "$dir"
    else
      # 普通用户给出提示
      echo "  ⚠ Run with sudo to fix permissions"
    fi
  fi
done
```

#### 3. 错误抑制

```bash
# 普通用户尝试设置权限，失败时不中断
chmod -R 755 "$dir" 2>/dev/null || echo "  ⚠ Created but cannot set permissions (may need sudo)"
```

### 处理的数据目录

脚本会处理以下所有数据目录：

1. `./data/postgres` - PostgreSQL 数据
2. `./data/redis` - Redis 数据
3. `./data/wukongim` - WukongIM 数据
4. `./data/kafka/data` - Kafka 数据
5. `./data/tgo-rag/uploads` - RAG 上传文件
6. `./data/tgo-api/uploads` - API 上传文件

## 行为说明

### 场景 1: 使用 sudo 运行（推荐）

```bash
sudo ./tgo.sh install
```

**行为**：
- 检测到 `$SUDO_USER`（实际用户）
- 创建目录并设置所有权为实际用户
- 容器内的 uid=1000 可以正常写入

**输出示例**：
```
[INFO] Creating data directories...
  Creating ./data/kafka/data...
  Set ownership to username (1000:1000)
```

### 场景 2: 普通用户运行

```bash
./tgo.sh install
```

**行为**：
- 使用当前用户创建目录
- 尝试设置权限，失败时给出提示
- 如果目录已存在且不可写，提示使用 sudo

**输出示例**：
```
[INFO] Creating data directories...
  Creating ./data/kafka/data...
  ⚠ Created but cannot set permissions (may need sudo)
```

### 场景 3: 目录已存在且可写

```bash
./tgo.sh install  # 第二次运行
```

**行为**：
- 检测到目录存在且可写
- 跳过，不做任何修改
- 避免不必要的权限操作

**输出示例**：
```
[INFO] Creating data directories...
  ✓ ./data/postgres (already exists and writable)
  ✓ ./data/redis (already exists and writable)
  ✓ ./data/kafka/data (already exists and writable)
```

### 场景 4: 目录存在但不可写（需要修复）

```bash
./tgo.sh install  # 目录归 root 所有
```

**行为**：
- 检测到目录不可写
- 如果是 root：自动修复权限
- 如果是普通用户：给出明确的修复指令

**输出示例（普通用户）**：
```
[INFO] Creating data directories...
  ⚠ ./data/postgres exists but not writable
  ⚠ Run with sudo to fix permissions, or manually run: sudo chown -R $USER:1000 ./data/postgres
```

**输出示例（root 用户）**：
```
[INFO] Creating data directories...
  ⚠ ./data/postgres exists but not writable
  Fixed permissions
```

## 技术细节

### 为什么需要预创建目录

Docker Compose 的卷挂载行为：

1. **目录不存在**：Docker 自动创建，使用运行 docker 命令的用户权限
2. **使用 sudo**：目录归 root 所有（uid=0, gid=0）
3. **容器内用户**：大多数容器使用非 root 用户（通常 uid=1000）
4. **权限冲突**：uid=1000 无法写入 root 拥有的目录

**解决方案**：在 Docker 创建目录之前，我们先创建并设置正确的权限。

### UID/GID 映射

| 场景 | 宿主机目录所有者 | 容器内用户 | 结果 |
|------|----------------|-----------|------|
| sudo 运行，未预创建 | root (0:0) | appuser (1000:1000) | ❌ 无权写入 |
| sudo 运行，预创建 | 实际用户 (1000:1000) | appuser (1000:1000) | ✅ 可以写入 |
| 普通用户运行 | 当前用户 (1000:1000) | appuser (1000:1000) | ✅ 可以写入 |

### 为什么使用 1000:1000

- **Docker 惯例**：大多数 Docker 镜像的非 root 用户使用 uid=1000
- **Linux 惯例**：第一个普通用户通常是 uid=1000
- **兼容性**：即使宿主机用户不是 1000，容器内通常是 1000

## 最佳实践

### 推荐做法

1. **首次部署**：使用 `sudo ./tgo.sh install`
   - 确保所有目录正确创建
   - 自动设置为实际用户所有权

2. **后续操作**：可以不使用 sudo
   - 目录已存在且可写
   - 脚本会跳过权限设置

3. **权限问题**：使用 sudo 修复
   ```bash
   sudo ./tgo.sh install  # 自动修复权限
   ```

### 手动修复权限

如果遇到权限问题，可以手动修复：

```bash
# 修复所有数据目录
sudo chown -R $USER:$USER ./data

# 或者设置为 Docker 默认用户
sudo chown -R 1000:1000 ./data

# 设置权限
sudo chmod -R 755 ./data
```

## 验证修复

### 检查目录权限

```bash
ls -la ./data/
```

应该看到：
```
drwxr-xr-x  username  groupname  kafka/
drwxr-xr-x  username  groupname  postgres/
drwxr-xr-x  username  groupname  redis/
...
```

### 检查容器日志

```bash
docker compose logs kafka
```

不应该再看到 `AccessDeniedException` 错误。

## 相关问题

如果遇到其他服务的权限问题（PostgreSQL、Redis、WukongIM 等），解决方案相同：

1. 确保数据目录在容器启动前创建
2. 设置正确的所有权（实际用户或 1000:1000）
3. 设置适当的权限（755 或 775）

---

**修复日期**: 2024-11-21  
**影响范围**: 所有使用数据卷挂载的服务  
**修复文件**: `tgo.sh`

