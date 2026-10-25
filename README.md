# OURS — A Little World for Two

两个人的私人数字空间：回忆相册、恋爱纪念日、共同愿望、每日心里话、私人餐厅、学做菜、采购清单、小游戏和加密情书。无需账号，数据默认只保存在当前设备。

线上版本：https://hongkuanyu.github.io/ours/

## 当前功能

- 温暖日记式首页、拍立得照片拼贴和每日小情书
- 在一起天数、下一个纪念日、生日和下次见面倒计时
- 本地照片回忆相册：年份筛选、查看、新增、编辑、删除、上一张/下一张和滑动切换
- 18 道默认菜谱与菜单分类筛选
- 自定义菜品、照片压缩与菜谱编辑/删除
- 菜品学习状态、她的最爱、步骤勾选、做菜心得、评分和成长统计
- 今晚点单、订单确认、复制菜单和自动生成买菜清单
- 愿望新增日期与备注、完成日期和进度
- 每日心里话记录、回看与删除
- 约会盲盒、可收藏灵感和加入愿望
- 情侣默契问答、自定义问题和本机轮流作答
- 翻牌配对游戏、私人 AES-GCM 加密情书
- 本地数据导出与导入
- PWA 安装、离线访问和更新后的网络优先脚本加载

## 修改属于你们的内容

打开 `config.js`：

- `relationshipStart`：在一起的日期，格式 `YYYY-MM-DD`
- `herName`：她的名字或昵称
- `birthday`：生日月份和日期
- `memories`：初始占位回忆
- `wishes`：初始愿望
- `gamePairs`：翻牌配对内容
- `vault`：加密信件数据

默认扩展菜谱在 `menu-extra.js`。真实照片放进 `assets/` 后，可在页面内新增回忆，也可以修改 `config.js` 中 `memories[].src`。不要虚构真实合照。

私人暗号默认是 `5201314`。修改 `make-secret.cjs` 中的暗号与信件内容后重新生成，再把 `salt`、`iv` 和 `ciphertext` 替换进 `config.js`。

## 本地数据

- 回忆照片优先保存到 IndexedDB（数据库 `ours-local-media`）
- 自定义菜谱、愿望、做菜记录、采购清单、见面日期、每日记录和问答结果保存在 localStorage
- 浏览器页面底部的「导出备份」会同时导出记录与 IndexedDB 照片
- 导入备份会覆盖当前设备上的同名本地记录，页面前会再次确认
- 数据不会自动同步到另一台设备，也不会自动上传到第三方服务
- 清除浏览器站点数据会删除本地记录；重要内容请定期导出备份

## 本地运行与测试

```powershell
cd C:\Users\cristiano\Desktop\大学\ours-public
python -m http.server 4192 --bind 127.0.0.1
```

打开 `http://127.0.0.1:4192/`。项目是纯静态 HTML/CSS/JavaScript，不需要安装依赖或配置 API Key。

## GitHub Pages

推送到 `main` 后，`.github/workflows/pages.yml` 会自动发布。静态文件需包含：

`index.html`、`styles.css`、`app.js`、`config.js`、`menu-extra.js`、`store.js`、`features.js`、`manifest.webmanifest`、`service-worker.js` 和 `assets/`。

更新脚本或样式后应提升 `service-worker.js` 中的缓存版本。

## 隐私边界

GitHub Pages 是公开静态托管，知道网址的人仍可访问公开页面源码与静态资源。`noindex` 和 `robots.txt` 不能提供访问控制。客户端加密信件也不等于完整的访问权限系统。

不要放身份证、住址、账号密码、私密联系方式或高风险隐私。若未来需要两台设备实时同步，应独立设计账号、授权、数据库权限和端到端加密。

## 回退版本

改造前的稳定版本已保存在 Git 标签：`pre-uiux-upgrade-2026-10-25`。
