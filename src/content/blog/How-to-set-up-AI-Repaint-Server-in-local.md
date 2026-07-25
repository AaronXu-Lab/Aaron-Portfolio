---
title: How to Set Up AI Repaint Server Locally
date: '2025-03-24T03:14:56.000Z'
author: Aaron Xu
tags:
  - AI绘画
  - ComfyUI
  - 重绘
  - 服务器搭建
  - Stable Diffusion
  - 自定义节点
categories:
  - 教程
excerpt: >-
  This article will teach you how to set up an AI repaint server, so you can use
  your own computer as an AI server to perform AI repainting. 本
minutes: 3
---
This article will teach you how to set up an AI repaint server, so you can use your own computer as an AI server to perform AI repainting.

本教程将指导你如何搭建一台 AI 重绘服务器，让你的电脑充当 AI 服务器来执行图像重绘任务。



AI server uses the [ComfyUI](https://github.com/comfyanonymous/ComfyUI) project, you need to have some basic knowledge of how to use comfyUI.

该 AI 服务器依赖 [ComfyUI](https://github.com/comfyanonymous/ComfyUI) 项目，因此你需要具备一些 ComfyUI 的基础使用知识。

## Materials

### Checkpoints

Two checkpoint are required, [WAI-ANI-NSFW-PONYXL](https://civitai.com/models/404154/wai-ani-nsfw-ponyxl) and [WAI-REALMIX](https://civitai.com/models/393905/wai-realmix). Thank author [WAI0731](https://civitai.com/user/WAI0731) for your amazing work!

需要两个模型检查点：[WAI‑ANI‑NSFW‑PONYXL](https://civitai.com/models/404154/wai-ani-nsfw-ponyxl) 和 [WAI‑REALMIX](https://civitai.com/models/393905/wai-realmix)。感谢作者 [WAI0731](https://civitai.com/user/WAI0731) 的精彩贡献！

### Custom nodes

Some custom nodes must also be installed. I recommend using [ComfyUI-Manager](https://github.com/Comfy-Org/ComfyUI-Manager) to install them.

还需要安装一些自定义节点。我推荐使用 [ComfyUI‑Manager](https://github.com/Comfy-Org/ComfyUI-Manager) 来完成安装。

1. [**Comfyroll Studio**](https://github.com/Suzie1/ComfyUI_Comfyroll_CustomNodes)
2. [**ComfyUI WD 1.4 Tagger**](https://github.com/pythongosssss/ComfyUI-WD14-Tagger)
3. [**ComfyUI-Logic**](https://github.com/theUpsider/ComfyUI-Logic)
4. [**ComfyUI-Advanced-ControlNet**](https://github.com/Kosinkadink/ComfyUI-Advanced-ControlNet)
5. [**ComfyUI Essentials**](https://github.com/cubiq/ComfyUI_essentials)

These are all important for the AI server

这些组件对 AI 服务器都至关重要。

## Run the server

Start the ComfyUI Server by running `python main.py --listen` in your ComfyUI directory, which will open a port in your local network.

在 ComfyUI 目录中运行 `python main.py --listen` 即可启动 ComfyUI 服务器，这将在你的本地网络上打开一个端口。



For example, if your computer's IP address is `192.168.1.125`, you can enter the address `192.168.1.125:8188` to the app. Then, you can generate AI images using your computer's computing power.

例如，如果你的电脑 IP 地址是 192.168.1.125，则可在应用中输入 192.168.1.125:8188。随后，你就可以利用电脑的算力生成 AI 图像了。



---

PS: The first time you run it, it needs to download some extra models, so may take a while. 

附注：第一次运行时需要下载一些额外模型，因此可能会花费一些时间。



If you have any questions, feel free to send feedback to woshixwn@gmail.com

如有任何疑问，欢迎发送邮件至 woshixwn@gmail.com 反馈。
