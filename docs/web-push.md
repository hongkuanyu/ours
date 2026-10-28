# OURS Web Push 部署与验收

> 当前工作区已生成 VAPID 密钥，Supabase 项目、数据库迁移、Secrets、Edge Function 和每分钟 Cron 均已配置；Supabase 内部调用已返回 `ok: true`。当前 Windows 网络访问项目子域名会 TLS 重置，国外检测节点正常，因此真实手机客户端仍需在 VPN 或自定义域名网络下完成最终验收。

## 1. 架构

```text
业务模块保存到 localStorage
  -> cloud-sync 将记录提交到 ours_push_record
  -> 服务端在版本提交成功后比较前后业务对象
  -> 写入 ours_activity_events
  -> 按偏好生成 ours_notification_deliveries
  -> 定时调用 Edge Function ours-push-dispatch
  -> Web Push 送达接收者设备
  -> Service Worker 显示系统通知
  -> 点击后通过 Hash Router 打开对应记录
```

客户端不能提交任意 `event_type`、接收者或发送者。`actor_user_id` 来自已验证的 `auth.uid()`，接收者由服务端从当前双人空间另一位有效成员中确定。

## 2. 数据库

新项目：完整执行 `supabase/schema.sql`。

已有 OURS Cloud 数据库：执行：

```text
supabase/migrations/202610280001_activity_push.sql
```

该迁移创建：

- `ours_activity_events`
- `ours_notification_preferences`
- `ours_push_subscriptions`
- `ours_notification_deliveries`

并包含 RLS、服务端事件识别、幂等、安静时间、推送合并、失效订阅清理和成员移除时撤销订阅。

## 3. 生成 VAPID 密钥

在项目根目录运行：

```powershell
node scripts/generate-vapid-keys.mjs
```

输出三项：

```text
VAPID_PUBLIC_JWK=...
VAPID_PRIVATE_JWK=...
VAPID_PUBLIC_KEY=...
```

- `VAPID_PUBLIC_KEY` 填进 `cloud-config.js` 的 `vapidPublicKey`。
- 两个 JWK 只保存到 Supabase Secrets，不提交到 GitHub。
- `VAPID_PRIVATE_JWK` 绝对不能进入前端。

## 4. 配置 Supabase Secrets

先创建不入库的本地文件：

```text
supabase/functions/ours-push-dispatch/.env.local
```

内容参考 `.env.example`：

```text
VAPID_PUBLIC_JWK={"kty":"EC",...}
VAPID_PRIVATE_JWK={"kty":"EC",...}
VAPID_SUBJECT=mailto:你的邮箱
OURS_PUSH_DISPATCH_SECRET=一段足够长的随机服务端密钥
```

然后执行：

```powershell
npx supabase login
npx supabase link --project-ref 你的项目ref
npx supabase secrets set --env-file supabase/functions/ours-push-dispatch/.env.local
npx supabase functions deploy ours-push-dispatch --no-verify-jwt
```

Edge Function 使用 `jsr:@negrel/webpush@0.5.0`。它基于 Deno/Web Crypto、`fetch` 和标准 `aes128gcm` Web Push，不依赖 Node 私有 HTTP 服务。当前代码已通过本地 Deno 2.9.6 `deno check`、依赖解析和实际服务启动冒烟测试；无 VAPID 配置时按预期返回 `PUSH_ENV_NOT_CONFIGURED`。另用本地 HTTPS/HTTP 端点验证了 VAPID ES256 JWT、`aes128gcm` 加密载荷和 POST 请求头。Supabase 线上冷启动及真实推送服务仍待真实验收。

## 5. 配置前端

在 `cloud-config.js` 填写：

```js
window.OURS_CLOUD_CONFIG = Object.freeze({
  url: 'https://你的项目.supabase.co',
  anonKey: '公开 anon key',
  coupleBucket: 'ours-couple-media',
  vapidPublicKey: '生成脚本输出的 VAPID_PUBLIC_KEY'
});
```

在 Supabase 执行 `supabase/schema.sql` 或迁移 SQL 后，用账号 A、B 分别登录并绑定双人空间。

## 6. 定时派发

先在 Supabase 的 Database > Extensions 中启用 `pg_cron` 和 `pg_net`，然后使用 Supabase Cron 每分钟调用一次：

```text
supabase/cron-push.example.sql
```

把文件中的项目地址和 `OURS_PUSH_DISPATCH_SECRET` 替换为你自己的值，再在 SQL Editor 执行。该 Secret 只存在于服务端数据库与 Edge Function 环境中。

也可以先在 Edge Function 控制台手动调用一次，确认返回：

```json
{ "ok": true, "claimed": 0, "sent": 0, "failed": 0, "expired": 0 }
```

## 7. 设备开启方法

### Android / 桌面 Chromium

1. 通过 HTTPS 打开 OURS。
2. 登录并进入双人空间。
3. 打开“通知设置”。
4. 点击“开启系统通知”。
5. 在浏览器权限提示中允许通知。

### iPhone / iPad

Web Push 需要 iOS 16.4 及以上：

1. Safari 打开 OURS。
2. 分享 -> 添加到主屏幕。
3. 从主屏幕图标打开 OURS。
4. 登录双人空间。
5. 打开“通知设置”并点击“开启系统通知”。
6. 允许系统通知。

如果 iPhone 只在普通 Safari 标签页中打开，页面会显示先添加到主屏幕的引导，不会直接请求权限。

## 8. 测试通知

通知设置中点击“发送测试通知”会调用安全 RPC 创建一条仅发送给当前账号和当前设备的测试事件。定时派发执行后，通常一分钟内送达。

如果没有收到：

1. 检查 `ours_notification_deliveries` 是否有 pending/deferred 记录。
2. 检查 Edge Function 日志与 Secrets。
3. 检查浏览器通知权限。
4. 检查 Service Worker 是否为新版本。
5. 检查 Cron 是否已执行。

## 9. 安全与隐私

- VAPID 私钥、service role key、dispatch secret 均不得进入静态文件。
- 通知载荷只包含通用标题、正文、事件 ID 和目标路由，不包含日记正文、照片、私密礼物或密码。
- 默认开启“隐藏通知内容”，锁屏统一显示“OURS 有一条新动态”。
- 通知历史只允许当前接收者读取。
- 被移除成员失去事件读取权限，订阅也会被撤销。
- 点击通知后仍要经过 App 登录、双人空间和业务数据权限检查。
- 首次同步旧数据不会生成通知；备份导入后的首次云端同步带一次性静默保护，成功后才恢复正常通知。
- 同一类别 90 秒内只生成一次系统推送，但通知中心仍保留有效活动事件。
- 失效订阅收到 404/410 后自动撤销；卡在 sending 的任务会在 10 分钟后重新进入队列。

## 10. 仍需真实环境验收

当前环境没有真实 Supabase、VAPID 和真机，因此以下项目尚未验证：

- 受限网络下的客户端 Supabase 连接（当前 Windows 网络 TLS 重置，检测节点可访问）
- 两个真实账号之间的端到端 Web Push 送达
- iOS 主屏幕 PWA 的真实通知权限和点击
- Android Chrome / PWA 真机
- 桌面 Edge / Chrome 的真实系统通知
- Supabase 线上 Edge Function 冷启动（本地 Deno 类型检查、运行冒烟、VAPID JWT 和 aes128gcm 加密 POST 测试已通过）
- Cron 定时调用、失效订阅返回 404/410 的真实行为
- 第三方账号 RLS 隔离与成员移除后的即时撤权

完成部署后，必须按总需求中的 17 项双账号测试逐项记录结果。
