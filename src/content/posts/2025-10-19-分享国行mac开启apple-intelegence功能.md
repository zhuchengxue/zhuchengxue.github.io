---
title: "分享国行Mac开启Apple Intelegence功能"
description: "国行Mac开启Apple Intelegence功能"
pubDate: 2025-10-19
sourceId: "分享国行Mac开启Apple Intelegence功能.md"
tags:
  - 公众号归档
draft: false
wechatUrl:
cover:
---

## 国行Mac开启Apple Intelegence功能

之前看新闻看到过苹果AI的相关新闻，但因为国内是用不了，也就没怎么在意。

最近苹果的电脑也升级了最新的系统，我也尝鲜也更新了，体验最新的“liquid glass"风格的新系统。

在网上摸索最新系统的特性时候，无意中发现居然可以通过脚本破解，然后打开苹果智能AI，忍不住就折腾了一会，成功开启苹果AI，这里稍微记录一下。

准备工作：

1. 升级到最新的Mac系统，必须是M系列的电脑
2. 美区苹果ID账号
3. 可以换美区的科学上网工具，设置全局

具体方法分享如下:

#### 第一步 关闭Mac的sip功能

具体操作：

1. 长按开机按键，进入rec
2. 点击左上角菜单栏，选择utility, 选择终端工具
3. 输入命令：csrutil disable 完成会提示重启电脑
4. 点击左上角的菜单栏，苹果图标，选择重启

开启Apple Intelegence后，可以按照相同步骤，关闭sip功能，只要换命令：csrutil enable

#### 第二步 配置环境运行脚本

具体操作：

1. 进入设置，退出苹果账号，登陆美区账号

2. 地区设置成美国

3. 打开终端，粘贴命令脚本

   ```curl -sL https://raw.githubusercontent.com/kanshurichard/enableAppleAI/main/enable_ai.sh | bash ```

4. 运行过程中，根据提示，选择激活
5. 成功后在设置就可以看到Apple Intelligence 的选项了

注意：地区和Siri语言要一致，如果是英文，siri也要是英文的

#### 苹果AI有哪些功能

玩了两天，分享觉得还不错的特性

1. 主要是整合到了Siri，让Siri变得不那么傻了。提问的时候可以直接让Siri调用ChatGPT来回答，比如说可以： 呼出Siri，调用ChatGPT来画一幅武松打虎的写实图画
2. 照片可以使用消除功能，移除照片中不想要的人物背景
3. 文字处理app，不论是信息，邮件，备忘录或者正在使用的Typora可以直接选择文本，右键调用AI修改润色
4. Safari浏览器进入阅读模式，可以使用AI总结文章

苹果AI在国内使用门槛非常高， 上面的任何一步出错，都不能使用，甚至节点不干净，ChatGPT也提示不可用，整体看还没有达到惊艳的，只是整合进了系统，调取更加方便一些。

人生很多时候做的事情可能都是无用功，但做和没做有一点点差别，其中做了探索是有一点点乐趣的。

参考链接：https://www.bilibili.com/video/BV1nW5gzmEBq/?spm_id_from=333.1391.0.0
