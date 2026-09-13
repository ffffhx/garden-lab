# 投递簿

两人使用的2027届求职记录网站。Node.js 22.14+，SQLite，前后端同源，无第三方运行依赖。

## 本地运行

`node server.mjs`，默认 http://127.0.0.1:8796 。生产必须通过 HTTPS 反向代理。

仅支持 GitHub 登录，无公开注册。先用 `node server.mjs add-user <内部用户名> <显示名称>` 创建本地用户，再用 `node server.mjs bind-github <内部用户名> <GitHub用户名>` 关联账号。绑定时查询 GitHub 固定用户 ID，不按可变用户名自动认领旧记录。旧版密码登录和密码修改接口已关闭，升级时旧会话失效；原数据库记录和所有者 ID 保留。

默认双方可查看记录、仅本人可修改；`SHARING=private` 可关闭互相查看。进度手动维护，不会自动向招聘网站查询。

`node server.mjs import <用户名> <本地JSON路径>` 导入记录；按所有者、公司及岗位去重。JSON字段与表单一致。真实数据放在被git忽略的 `data/` 或 `seed-private.json`，不要提交个人记录或密码。

`node --test test.mjs` 验证账号隔离、权限、CRUD、会话注销、并发编辑冲突及持久化。

## 腾讯云部署

当前入口：https://124-221-36-36.anyip.dev:8443/applications/ 。应用目录 `/home/ubuntu/apps/job-tracker`，独立容器 `job-tracker`，数据卷 `job-tracker_tracker-data`。不依赖本地电脑运行。

将本目录复制到独立目录，运行 `docker compose up -d --build`。容器仅绑定127.0.0.1:8796，SQLite保存到命名卷。不要使用 `docker compose down -v`，它会删除数据。

HTTPS反向代理可挂载 `/applications/`：上游 `http://127.0.0.1:8796`，保留或去掉此前缀均支持；需保持原始Host头。访问入口必须以 `/` 结尾。COOKIE_SECURE生产应为true。本地HTTP默认false。

生产使用 `docker compose exec job-tracker node server.mjs bind-github friend <朋友GitHub用户名>` 关联原朋友账号。`PUBLIC_URL` 必须是带尾斜杠的固定站点地址；`GARDEN_AUTH_URL` 为已有 Garden API 的公开根地址，`GARDEN_VERIFY_URL` 为其身份验证接口。复用现有 GitHub OAuth App，无需复制 client secret；回调校验一次性状态和浏览器 Cookie，并向服务端验证身份后签发本站 HttpOnly 会话。生产不设置任何模拟身份验证器。

本地预览可使用默认配置；真实本地 GitHub 回跳需要认证服务允许本地 PUBLIC_URL。自动化测试使用注入的身份验证替身测试完整回调与授权边界。数据导入文件用完删除，勿放入 public/。

## 备份

SQLite使用WAL。不能只复制正在运行的tracker.sqlite文件。可短暂停容器后备份完整数据卷，或使用SQLite在线备份/VACUUM INTO生成一致性快照。恢复前停止服务，保留原数据副本，将快照恢复到/data/tracker.sqlite，确保node用户可读写，然后启动并检查登录和记录。服务器磁盘快照可作为额外备份。
