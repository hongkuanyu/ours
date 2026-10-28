# OURS 双人云端空间

> 状态：客户端、Supabase 项目、活动事件、RLS、VAPID Secrets、通知 Edge Function 和 Cron 已配置。Local Mode 仍可直接使用。当前 Windows 网络访问 `*.supabase.co` 会被 TLS 重置，因此客户端双账号和真机推送仍需在 VPN 或自定义域名环境中验收。

## 已实现

- 邮箱 / 密码注册、登录、退出和会话恢复
- 创建双人空间、一次性邀请码、加入空间
- 每个空间最多 2 位活跃成员；邀请码 24 小时过期且单次使用
- Supabase Postgres RLS：只有当前空间成员能读取对应记录
- 私有 Bucket `ours-couple-media`，单张照片上限 16 MiB，并限制为常见图片 MIME 类型
- 只有用户明确点击“确认并开启双向同步”后，才读取云端内容或上传本机记录与照片
- 本地修改队列、联网恢复、自动同步和手动同步
- 版本冲突审阅：保留本机或使用云端，不做静默最后写入覆盖
- 未配置、未登录、离线、等待同步授权、同步中、冲突等状态都有明确 UI
- Local Mode 始终可用，不依赖 Supabase
- 服务端业务差分活动事件与幂等通知
- 多设备 Push Subscription、通知偏好、安静时间、隐私预览和失效订阅清理
- Service Worker 系统通知及登录后的业务详情深链

## 启用步骤

1. 在 Supabase 创建项目，并启用 Email 登录方式。
2. 打开 Supabase SQL Editor，完整执行 `supabase/schema.sql`。
3. 在 Supabase Project Settings 中找到 Project URL 和公开的 anon key。
4. 在 `cloud-config.js` 填写：

```js
window.OURS_CLOUD_CONFIG = Object.freeze({
  url: 'https://你的项目.supabase.co',
  anonKey: '公开 anon key',
  coupleBucket: 'ours-couple-media',
  vapidPublicKey: 'Web Push VAPID 公钥'
});
```

5. 用两个不同浏览器或隐私窗口创建两个账号。账号 A 创建空间并生成邀请码，账号 B 加入。
6. 两端分别点击“确认并开启双向同步”，先测试读取，再测试新增、修改、离线和冲突。
7. 在 Supabase 检查 Storage Bucket 必须保持 private，且 SQL 中的所有 RLS 策略存在。
8. Web Push 还需要执行 `supabase/migrations/202610280001_activity_push.sql`、生成 VAPID、部署 `ours-push-dispatch` 并配置 Cron，详见 `docs/web-push.md`。

不要把 `service_role` key、数据库密码或私有管理令牌放进 `cloud-config.js`。公开 anon key 不能代替 RLS。

## 安全约束

- 未登录时不读取远程私人记录或照片。
- 前端不直接查询或写入 `couple_records` / `couple_photos` 表；记录读取与照片元数据登记通过带成员检查的 RPC 完成。
- Storage 路径首段必须等于 `couple_id`，并由 RLS 验证成员身份。
- 邀请码只在数据库中保存 SHA-256 哈希，不保存明文。
- 同步授权默认关闭；用户退出账号不会自动删除本地数据。
- 发生冲突时保留双方版本供选择，不自动丢弃本机创作内容。

## 发布前必须实测

以下项目需要真实 Supabase 和两个独立账号，当前 mock 测试不能替代：

- 第三方账号无法访问该双人空间
- 第 3 个账号无法接受邀请，邀请码不能复用
- 成员被移除后立即失去数据库和 Storage 权限
- 邮箱验证、会话过期和刷新
- 私有照片上传、签名 URL、文件类型及大小限制
- 两端同时编辑同一记录并正确处理冲突
- 离线新增 / 修改 / 删除后重连
- 完整导出、迁移回滚和账号删除
- Realtime 或轮询恢复；当前客户端以定时拉取为主
- 真实 iPhone Safari、Android Chrome 和已安装 PWA
- 真实 VAPID Web Push、Edge Function 派发和系统通知点击

## 已知未完成

- 当前没有“成员移除 / 主动退出双人空间 / 删除云端空间”的完整 UI。
- 当前没有建立 Supabase Realtime 订阅；系统通知使用活动事件、Edge Function Cron 和 Web Push，通知中心使用 45 秒轮询及页面重新可见时刷新。
- 没有端到端加密；服务端数据库管理员在理论上仍可读取明文记录。
- 未配置真实后端前，页面只展示配置引导，不提供虚假同步能力。

在这些门槛完成前，Cloud Mode 继续保持默认关闭。
