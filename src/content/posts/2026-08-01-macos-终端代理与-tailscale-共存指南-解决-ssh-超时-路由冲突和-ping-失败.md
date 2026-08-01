---
title: "macOS 终端代理与 Tailscale 共存指南：解决 SSH 超时、路由冲突和 ping 失败"
description: "这次故障很怪：公司电脑可以 SSH 回家，同一账号换到 Mac 就失败。"
pubDate: 2026-08-01
sourceId: "macOS 终端代理与 Tailscale 共存指南.md"
tags:
  - "随笔"
draft: false
wechatUrl: 
cover: 
---

![封面：终端代理与私网隧道并行](../../images/macos-终端代理与-tailscale-共存指南-解决-ssh-超时-路由冲突和-ping-失败/macos-终端代理与-tailscale-共存指南-解决-ssh-超时-路由冲突和-ping-失败-01.webp)

这次故障很怪：公司电脑可以 SSH 回家，同一账号换到 Mac 就失败。

最后发现它不是 1 个问题，而是 2 层冲突：短主机名一度无法解析，代理软件的 TUN 又抢走了 Tailscale 路由。

更有意思的是，修好后 `curl` 已经能通过代理访问网络，`ping` 仍然全部超时。

代理到底有没有生效？为什么同一个终端里的命令会走不同的路？

> 作者手记：这篇文章来自一次真实排障。本文隐藏了用户名、设备名和公网 IP，但保留了完整判断过程与命令。

## 先说结论

我最后采用的方案很简单：

• Tailscale 负责访问家中设备和私网资源

• Clash Verge 关闭 TUN，只提供本机 HTTP/SOCKS 代理端口

• 终端按需设置代理环境变量

• `ssh`、`ping` 和 Tailscale 私网继续走系统路由

这套组合的好处是职责清楚。互联网访问交给 Clash，私网访问交给 Tailscale，两边不再抢路由。

| 流量类型 | 处理方式 | 示例 |
|---|---|---|
| HTTP/HTTPS | Clash 本地代理 | `curl`、Git HTTPS、Homebrew |
| SOCKS | Clash 本地代理 | 支持 `all_proxy` 的工具 |
| Tailscale 私网 | 系统路由直连 | `ssh user@home` |
| ICMP | 系统路由直连 | `ping` |

## 故障是怎么暴露的

最开始执行：

```bash
ssh user@home
```

终端直接报错：

```text
Could not resolve hostname home
```

这说明连接甚至没有进入密码或密钥认证阶段。`home` 还没有被解析成 IP，查私钥没有意义。

我先让 SSH 打印完整调试信息：

```bash
ssh -vvv -o ConnectTimeout=8 user@home
```

接着确认 Tailscale 是否真的能找到目标设备：

```bash
tailscale status
tailscale ping home
```

结果很关键：`tailscale ping home` 成功，目标设备在线，而且能建立点对点连接。

这时问题从“远程电脑是不是关机了”，缩小到了“macOS 怎样解析名称和选择路由”。

| 检查结果 | 能说明什么 | 不能说明什么 |
|---|---|---|
| `tailscale status` 显示在线 | 节点已加入同一私网 | SSH 端口一定可达 |
| `tailscale ping` 成功 | Tailscale 隧道本身可用 | 系统 TCP 流量一定走该隧道 |
| 完整域名能解析 | MagicDNS 基本可用 | 短名称和路由一定正常 |
| SSH 端口超时 | TCP 包没有正常到达服务端 | 密码或密钥错误 |

## 真正的转折点：查路由

DNS 修复后，我直接连接 Tailscale IP，SSH 仍然超时。

如果 Tailscale 自己能 ping 通，普通 SSH 却超时，下一步应该看什么？

答案是系统路由：

```bash
route -n get <TAILSCALE_IP>
```

故障时看到的是类似结果：

```text
gateway: <WIFI_GATEWAY>
interface: en0
```

目标明明是 Tailscale 的 `100.x` 地址，系统却把它发给了 Wi-Fi 网关。

与此同时，系统里同时存在 Tailscale 和代理软件建立的虚拟网卡。代理 TUN 声明了更强的默认路由，把本该进入 Tailscale 的包截走了。

![代理 TUN 抢路由与正确路由对比](../../images/macos-终端代理与-tailscale-共存指南-解决-ssh-超时-路由冲突和-ping-失败/macos-终端代理与-tailscale-共存指南-解决-ssh-超时-路由冲突和-ping-失败-02.webp)

这也解释了一个看起来矛盾的现象：

• `tailscale ping` 使用 Tailscale 自己的能力，所以成功

• `ssh` 使用系统 TCP 路由，所以走错网卡后超时

> 我当时最容易误判的地方，就是看到 ping 成功后，下意识认为 SSH 路由也一定正常。实际上，这两个命令走的链路并不完全相同。

## Shadowrocket 与 Tailscale 怎样共存

如果仍要使用 Shadowrocket，不能只添加一条普通 `DIRECT` 规则。

普通直连规则解决的是“是否经过代理服务器”，而 TUN 旁路解决的是“流量是否先进入 Shadowrocket 虚拟网卡”。这是两层不同的问题。

在 Shadowrocket 中找到：

```text
设置 → 隧道 → TUN 旁路路由
```

加入：

```text
100.64.0.0/10
fd7a:115c:a1e0::/48
```

同时关闭“强制路由”。

| 配置 | 作用 |
|---|---|
| `100.64.0.0/10` | 排除 Tailscale IPv4 地址段 |
| `fd7a:115c:a1e0::/48` | 排除 Tailscale IPv6 地址段 |
| 关闭强制路由 | 不让代理路由压过本机已有路由 |
| TUN 旁路 | 让私网包交回 Tailscale 虚拟网卡 |

如果同时运行两个代理工具的 TUN，再叠加 Tailscale，路由会变得更难预测。

我的建议是：同一时间只开一个代理 TUN。

## 换成 Clash 后，终端怎么代理

我后来换成了更稳的组合：Clash Verge 关闭 TUN，终端通过本机混合端口代理。

先在 Clash 配置里确认 `mixed-port`。不同机器可能是 `7890`、`1080` 或其他端口，不要照抄。

macOS 上可以这样查：

```bash
rg -n '^(mixed-port|port|socks-port):' \
  "$HOME/Library/Application Support/io.github.clash-verge-rev.clash-verge-rev/config.yaml"
```

假设查到混合端口是 `1082`，当前终端临时开启代理：

```bash
export http_proxy="http://127.0.0.1:1082"
export https_proxy="http://127.0.0.1:1082"
export all_proxy="socks5h://127.0.0.1:1082"

export HTTP_PROXY="$http_proxy"
export HTTPS_PROXY="$https_proxy"
export ALL_PROXY="$all_proxy"
```

再设置不经过代理的地址：

```bash
export no_proxy="localhost,127.0.0.1,::1,home,.ts.net,100.64.0.0/10"
export NO_PROXY="$no_proxy"
```

这里同时设置大小写，是因为不同命令行工具读取的变量名并不统一。

## 一键开关，写进 zsh

每次手动输入 8 行命令当然很烦。

把下面内容加入 `~/.zshrc`，以后只需要记住 3 个命令：

```bash
proxy_on() {
  export http_proxy="http://127.0.0.1:1082"
  export https_proxy="http://127.0.0.1:1082"
  export all_proxy="socks5h://127.0.0.1:1082"
  export HTTP_PROXY="$http_proxy"
  export HTTPS_PROXY="$https_proxy"
  export ALL_PROXY="$all_proxy"

  export no_proxy="localhost,127.0.0.1,::1,home,.ts.net,100.64.0.0/10"
  export NO_PROXY="$no_proxy"
  echo "Terminal proxy enabled"
}

proxy_off() {
  unset http_proxy https_proxy all_proxy
  unset HTTP_PROXY HTTPS_PROXY ALL_PROXY
  unset no_proxy NO_PROXY
  echo "Terminal proxy disabled"
}

proxy_status() {
  if  -n "$https_proxy" ; then
    echo "Terminal proxy: ON ($https_proxy)"
  else
    echo "Terminal proxy: OFF"
  fi

  if nc -z 127.0.0.1 1082 >/dev/null 2>&1; then
    echo "Clash port 1082: listening"
  else
    echo "Clash port 1082: not listening"
  fi
}
```

重新加载配置：

```bash
source ~/.zshrc
```

以后这样使用：

```bash
proxy_on
proxy_status
proxy_off
```

## 为什么 curl 成功，ping 还是超时

设置代理变量后，我用下面的命令测试：

```bash
curl https://ipinfo.io/ip
```

它返回了代理出口 IP，说明 Clash 正常工作。

但执行：

```bash
ping google.com
```

仍然全部超时。

这不是故障。

`curl` 使用 HTTP/HTTPS，能够读取 `http_proxy` 和 `https_proxy`。`ping` 使用 ICMP，不认识 HTTP 或 SOCKS 代理变量。

同理，OpenSSH 默认也不会因为设置了这些变量，就自动通过 Clash 建立连接。

![终端代理变量的生效范围](../../images/macos-终端代理与-tailscale-共存指南-解决-ssh-超时-路由冲突和-ping-失败/macos-终端代理与-tailscale-共存指南-解决-ssh-超时-路由冲突和-ping-失败-03.webp)

所以，“终端开启代理”并不等于“终端所有网络包都被接管”。

| 命令或协议 | 默认读取代理变量 | 推荐测试方式 |
|---|---:|---|
| `curl` | 是 | 查看网页响应或出口 IP |
| Git HTTPS | 通常是 | `git ls-remote` |
| Homebrew | 通常是 | 执行下载或更新检查 |
| `ping` | 否 | 只判断 ICMP 直连情况 |
| `ssh` | 否 | 直接检查目标端口和认证 |
| DNS | 不一定 | 使用 `dig` 或系统 DNS 工具 |

## 最后做一次完整验收

代理软件和 Tailscale 同时打开后，我会按下面顺序检查：

```bash
# 1. Clash 本地端口是否存在
nc -z 127.0.0.1 1082

# 2. 终端代理是否开启
proxy_status

# 3. HTTP 代理出口是否变化
curl https://ipinfo.io/ip

# 4. Tailscale 节点是否在线
tailscale ping home

# 5. 私网 IP 是否走 Tailscale 网卡
route -n get <TAILSCALE_IP>

# 6. SSH 是否能到达认证阶段
ssh -vv user@home
```

正确状态应该满足：

• `curl` 显示代理出口 IP

• `route -n get` 的接口是 Tailscale 对应的 `utun`

• `ssh` 能进入密码或密钥认证，而不是连接超时

• `ping` 是否成功，不作为 HTTP 代理生效的判断依据

## 一张表记住排障顺序

| 报错 | 先查什么 | 常用命令 |
|---|---|---|
| 无法解析主机名 | DNS、MagicDNS、SSH 别名 | `dscacheutil`、`ssh -G` |
| 连接超时 | 路由、VPN、TUN、防火墙 | `route -n get`、`scutil --nc list` |
| 连接被拒绝 | 服务是否监听、端口是否正确 | `nc -vz` |
| 权限被拒绝 | 用户名、密码、公钥 | `ssh -vv` |
| `curl` 成功但 `ping` 失败 | 协议差异 | 不要用 `ping` 测 HTTP 代理 |

排障时最容易浪费时间的，就是跳过错误发生的层级。

主机名还没解析，就不要先折腾密钥。TCP 还没连上，也不要先怀疑密码。

**先看报错停在哪一层，再决定下一条命令。**

这次问题表面上是“SSH 连不上”，本质却是 3 套网络工具同时修改 DNS、默认路由和虚拟网卡。

如果你的终端也出现“`curl` 正常、`ping` 失败、SSH 偶尔超时”，你会先查代理端口，还是先查系统路由？

## 参考资料

• [Tailscale：能否与其他 VPN 同时使用](https://tailscale.com/docs/reference/faq/other-vpns)

• [Tailscale：100.x.y.z 地址与 CGNAT 网段](https://tailscale.com/docs/concepts/tailscale-ip-addresses)

• [OpenSSH 客户端手册](https://man.openbsd.org/ssh)
