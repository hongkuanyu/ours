# OURS

只属于两个人的静态情侣网站，无账号、无服务器，部署在 GitHub Pages。

在线地址：https://hongkuanyu.github.io/ours/

## 已有功能

- 在一起天数与生日倒计时
- 回忆照片墙
- 本地保存的愿望清单
- 情侣翻牌配对游戏
- 星空动画与手机端布局
- 使用暗号解密的私人信件

## 修改内容

打开 `config.js`：

- `relationshipStart`：在一起的日期
- `herName`：她的名字或昵称
- `birthday`：生日月、日
- `memories`：照片、标题、日期、地点和文字
- `wishes`：初始愿望
- `gamePairs`：翻牌游戏配对内容

## 替换照片

把真实照片放进 `assets/`，再修改 `config.js` 中的 `memories[].src`。

```js
{ src: 'assets/us-01.jpg', date: '2026.10.25', location: '我们的家', title: '今天', text: '今天也很好。' }
```

建议先把照片压缩到每张 1 MB 以内，保证手机加载速度。

## 隐私边界

GitHub Pages 是公开静态托管。`robots.txt` 和 `noindex` 只能减少搜索引擎收录，不等于访问权限控制。

- 不要放身份证、住址、账号密码或高风险隐私
- 知道网址的人仍然可以访问公开内容
- 私人信件使用 AES-GCM 加密，默认暗号可在 `make-secret.cjs` 中修改后重新生成
- 如果以后需要真正的私人相册，应改用带登录和服务端鉴权的方案
