# Baotuo Chat 部署指南

本指南介绍如何将 Baotuo Chat 部署到 Vercel，并配置多用户账号系统。

## 前置条件

- GitHub 账号
- Vercel 账号
- Neon（PostgreSQL）账号
- Upstash（Redis）账号（可选，推荐用于生产环境）

## 部署步骤

### 1. 准备数据库（Neon PostgreSQL）

1. 访问 [Neon Console](https://console.neon.tech/)
2. 创建新项目，选择离用户最近的区域
3. 创建数据库后，复制连接字符串（格式类似）：
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. 保存连接字符串，后续配置环境变量时使用

### 2. 准备 Redis（可选，推荐生产环境）

**如果只是个人使用或小规模部署，可以跳过此步骤。** 不配置 Redis 时，系统会使用内存存储（单实例有效）。

生产环境推荐使用 Upstash Redis 来存储：
- 速率限制状态
- 插件注册信息

#### 配置 Upstash Redis

1. 访问 [Upstash Console](https://console.upstash.com/)
2. 创建 Redis 数据库，选择离 Vercel 部署区域最近的区域
3. 在数据库详情页找到 **REST API** 部分
4. 复制以下两个值：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 3. 部署到 Vercel

#### 方式一：通过 Vercel Dashboard

1. 访问 [Vercel Dashboard](https://vercel.com/new)
2. 导入你的 GitHub 仓库
3. 配置环境变量（见下方"环境变量配置"）
4. 点击 Deploy

#### 方式二：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 配置环境变量（交互式）
vercel env add DATABASE_URL
vercel env add ACCOUNT_SESSION_SECRET
# ... 其他变量

# 重新部署使环境变量生效
vercel --prod
```

### 4. 环境变量配置

在 Vercel 项目的 **Settings > Environment Variables** 中配置以下变量：

#### 必需变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | Neon PostgreSQL 连接字符串 | `postgresql://user:pass@ep-xxx.neon.tech/db` |
| `ACCOUNT_SESSION_SECRET` | 会话签名密钥（随机字符串，至少 32 字符） | `your-random-secret-min-32-chars` |

#### 可选变量（生产环境推荐）

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL | - |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API Token | - |
| `RATE_LIMIT_STORE` | 速率限制存储类型 | `memory` (不填会自动选择) |
| `PLUGIN_REGISTRY_STORE` | 插件注册存储类型 | `memory` (不填会自动选择) |
| `DEFAULT_DAILY_QUOTA` | 默认每日请求配额 | `200` |
| `DEPLOYMENT_MODE` | 部署模式 | `local` (生产设为 `hosted`) |

#### 生成会话密钥

```bash
# 方式 1：使用 openssl
openssl rand -base64 32

# 方式 2：使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 方式 3：在线生成
# 访问 https://generate-secret.vercel.app/32
```

### 5. 初始化数据库

部署成功后，数据库表会自动创建（通过 Drizzle ORM）。

如果需要手动执行迁移：

```bash
# 本地开发环境
pnpm db:push

# 或运行迁移
pnpm db:migrate
```

### 6. 配置 AI 模型提供商

首次访问部署的网站后，进入 **设置 > 提供商**，配置你的 AI 模型 API Key：

- OpenAI
- Anthropic
- Google Gemini
- 等

## 数据库管理

由于项目采用 **无后台管理界面** 的设计，所有账号管理操作通过直接修改数据库完成。

### 连接数据库

#### 方式一：Neon Console (Web SQL 编辑器)

1. 访问 [Neon Console](https://console.neon.tech/)
2. 选择项目 > SQL Editor
3. 执行下方的 SQL 命令

#### 方式二：使用 psql 命令行

```bash
psql "postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require"
```

#### 方式三：使用 GUI 工具

推荐工具：
- [DBeaver](https://dbeaver.io/)
- [TablePlus](https://tableplus.com/)
- [pgAdmin](https://www.pgadmin.org/)

### 常用数据库操作

#### 查看所有用户

```sql
SELECT 
  id, 
  email, 
  "dailyQuota", 
  disabled, 
  "createdAt"
FROM users
ORDER BY "createdAt" DESC;
```

#### 调整用户配额

```sql
-- 设置用户每日配额为 500 次
UPDATE users 
SET "dailyQuota" = 500 
WHERE email = 'user@example.com';

-- 设置为 NULL 使用默认配额（200 次）
UPDATE users 
SET "dailyQuota" = NULL 
WHERE email = 'user@example.com';

-- 给所有用户设置统一配额
UPDATE users SET "dailyQuota" = 1000;
```

#### 禁用/启用用户

```sql
-- 禁用用户
UPDATE users 
SET disabled = true 
WHERE email = 'user@example.com';

-- 启用用户
UPDATE users 
SET disabled = false 
WHERE email = 'user@example.com';
```

#### 强制用户退出登录

```sql
-- 增加用户的 tokenVersion，使所有已签发的会话 cookie 失效
UPDATE users 
SET "tokenVersion" = "tokenVersion" + 1 
WHERE email = 'user@example.com';

-- 或者直接设置为一个新值
UPDATE users 
SET "tokenVersion" = 999 
WHERE email = 'user@example.com';
```

#### 查看审计日志

```sql
-- 查看最近的登录记录
SELECT 
  u.email,
  al.action,
  al."createdAt"
FROM "auditLogs" al
LEFT JOIN users u ON al."userId" = u.id
WHERE al.action IN ('login', 'login_failed', 'account_disabled_login_attempt')
ORDER BY al."createdAt" DESC
LIMIT 50;

-- 查看某用户的所有操作
SELECT 
  action, 
  detail, 
  "createdAt"
FROM "auditLogs"
WHERE "userId" = (SELECT id FROM users WHERE email = 'user@example.com')
ORDER BY "createdAt" DESC;

-- 查看配额超限记录
SELECT 
  u.email,
  al."createdAt"
FROM "auditLogs" al
JOIN users u ON al."userId" = u.id
WHERE al.action = 'quota_exceeded'
ORDER BY al."createdAt" DESC
LIMIT 100;
```

#### 清理旧审计日志

```sql
-- 删除 30 天前的审计日志
DELETE FROM "auditLogs"
WHERE "createdAt" < NOW() - INTERVAL '30 days';

-- 只保留最近 10000 条记录
DELETE FROM "auditLogs"
WHERE id NOT IN (
  SELECT id FROM "auditLogs"
  ORDER BY "createdAt" DESC
  LIMIT 10000
);
```

#### 删除用户

```sql
-- 先删除用户的审计日志（因为有外键约束）
DELETE FROM "auditLogs" WHERE "userId" = (
  SELECT id FROM users WHERE email = 'user@example.com'
);

-- 再删除用户
DELETE FROM users WHERE email = 'user@example.com';
```

## 环境变量完整参考

### 账号系统

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串，留空则禁用账号系统 |
| `ACCOUNT_SESSION_SECRET` | 是（启用账号时） | 会话 cookie 签名密钥 |
| `DEFAULT_DAILY_QUOTA` | 否 | 默认每日请求配额，默认 200 |

### 共享存储（可选）

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `RATE_LIMIT_STORE` | 否 | `upstash`/`redis`/`kv` 使用 Redis，留空自动选择 |
| `PLUGIN_REGISTRY_STORE` | 否 | 同上 |
| `UPSTASH_REDIS_REST_URL` | 配置共享存储时必需 | Upstash REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | 配置共享存储时必需 | Upstash REST API Token |

### 部署模式

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `DEPLOYMENT_MODE` | 否 | `local` 或 `hosted`。生产环境设为 `hosted` 启用严格安全策略 |
| `ALLOW_MEMORY_STORE_FALLBACK` | 否 | `hosted` 模式下是否允许内存存储降级，默认 false |

### 访问控制（传统单密码模式）

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `ACCESS_PASSWORD` | 否 | 设置后启用单密码访问控制（与账号系统可共存） |
| `DISABLE_AUTH` | 否 | `true` 禁用所有访问控制（仅限私有部署） |

## 故障排查

### 部署失败

1. **TypeScript 编译错误**：检查本地是否有 `pnpm run build` 通过
2. **环境变量未生效**：Vercel 环境变量修改后需要重新部署
3. **数据库连接失败**：
   - 检查 `DATABASE_URL` 是否正确
   - Neon 数据库是否开启并可访问
   - 连接字符串末尾是否有 `?sslmode=require`

### 登录后看到上一个用户的数据

这是客户端缓存隔离问题，已在最新版本修复。确保代码包含 AuthPage 的 100ms 延迟补丁。

### 配额统计不准确

如果使用内存存储（未配置 Upstash），Vercel 的多实例部署会导致每个实例有独立计数。解决方案：
1. 配置 Upstash Redis
2. 或设置 Vercel 函数为单实例（不推荐）

### 速率限制过于严格

编辑 `src/lib/security/requestGuards.ts` 中的 `RATE_LIMIT_RULES` 调整限制：

```typescript
export const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
  "/api/auth/register": { windowSeconds: 60, maxRequests: 5 },  // 改成 10
  "/api/auth/login": { windowSeconds: 60, maxRequests: 10 },    // 改成 20
  // ...
};
```

## 监控和维护

### 定期任务

1. **清理审计日志**：建议每月执行一次清理 SQL
2. **检查配额使用**：
   ```sql
   SELECT email, "dailyQuota" FROM users WHERE "dailyQuota" IS NOT NULL;
   ```
3. **监控异常登录**：
   ```sql
   SELECT COUNT(*) FROM "auditLogs" 
   WHERE action = 'login_failed' 
   AND "createdAt" > NOW() - INTERVAL '1 hour';
   ```

### Vercel 监控

在 Vercel Dashboard 查看：
- 函数执行时间
- 错误率
- 带宽使用

## 参考资源

- [Neon 文档](https://neon.tech/docs)
- [Upstash 文档](https://docs.upstash.com/)
- [Vercel 文档](https://vercel.com/docs)
- [Drizzle ORM 文档](https://orm.drizzle.team/)

## 安全建议

1. **定期轮换密钥**：每 3-6 个月更新 `ACCOUNT_SESSION_SECRET`
2. **启用 HTTPS**：Vercel 自动提供，自定义域名也会自动配置
3. **限制数据库访问**：Neon 控制台设置 IP 白名单
4. **监控异常活动**：定期检查 `auditLogs` 表
5. **备份数据库**：Neon 提供自动备份，建议额外配置定期导出

## 成本估算

**免费部署方案：**
- Vercel Hobby Plan（免费）
- Neon Free Tier（免费，0.5GB 存储 + 191.9 小时计算/月）
- 适合个人使用或小规模测试

**生产环境推荐：**
- Vercel Pro ($20/月)
- Neon Launch ($19/月)
- Upstash Pay as you go (前 10k 请求免费)
- 总计约 $40-50/月
