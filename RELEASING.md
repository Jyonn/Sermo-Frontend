# 前端发布说明

每次部署前只需要更新根目录的 `release-notes.json`：

1. 将 `id` 改为 `YYYY.MM.DD.N`，同一天发布多次时递增 `N`。
2. 同时填写中英文标题。
3. 每种语言填写 1 至 5 条面向用户的变化，描述结果，不写文件名或实现细节。
4. 运行 `npm run build`。构建会校验说明并生成 `release.json` 和 Service Worker 更新指纹。

发现新版本后，当前页面会显示这份更新列表；用户点击更新后再启用新版本。

## 镜像同步（每次前端发布必做）

Git 推送完成后运行 `npm run deploy:mirror`。脚本单独执行镜像构建，
通过 rsync 按内容校验增量上传，并验证 `https://sermo.6-79.cn/release.json`。
只有验证成功才可以报告镜像已更新；本脚本不部署后端。

部署参数在本地忽略的 `.env.deploy.local`（参考 `.env.deploy.example`）。
密钥路径为 `~/Resources/Subscription/Server/tencent`，用户 `ubuntu`，
端口 `22`，远程目录 `/home/ubuntu/sermo-frontend/dist`。
SSH 主机已由用户确认为 `175.178.125.57`，不要自行改用解析到的其他地址。首次连接须通过可信渠道
核对 SSH 主机指纹并加入 known_hosts；脚本不会跳过主机密钥验证。
不要把私钥、其内容或部署配置加入 Git，也不要使用 `VITE_*` 保存 SSH 参数。

`npm run deploy:mirror -- --dry-run` 会构建并预览 rsync 差异，不修改远端文件。
正式发布先传资源，再传 HTML/SW，最后传版本文件。不删除旧哈希资源，
避免旧网页懒加载失败。服务器会逐步累积旧文件，需另行安排审慎清理。
发布不是全目录原子切换；中途失败应重新执行并验证，不应继续宣布成功。
本机锁避免同目录并发发布；其他机器的发布者必须避免同时部署。
