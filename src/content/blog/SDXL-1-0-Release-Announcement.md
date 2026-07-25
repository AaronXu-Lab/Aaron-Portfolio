---
title: SDXL 1.0 Release Announcement
date: '2023-07-29T13:32:10.000Z'
author: Aaron Xu
tags:
  - SDXL 1.0
  - Stable Diffusion
  - Stability AI
  - 文本生成图像
  - 扩散模型
  - AIGC
  - 模型架构
categories:
  - 教程
excerpt: >-
  本文由 ChatGPT 根据 https://stability.ai/blog/stable diffusion sdxl 1 announcement
  总结生成。
minutes: 3
---
> 本文由 ChatGPT 根据 https://stability.ai/blog/stable-diffusion-sdxl-1-announcement 总结生成。



## 发布
Stability AI团队自豪地宣布，他们已经发布了开放模型SDXL 1.0，这是文本到图像生成模型的新一代迭代。在对SDXL 0.9进行了有限的、仅供研究的发布后，SDXL的全新版本已经得到了显著的改进，现已成为全球最优秀的开放图像生成模型。

## 优势
SDXL 1.0不仅是Stability AI的旗舰图像模型，也是图像生成领域最优秀的开放模型。经过对各种模型的深度测试，结果显示人们更倾向于选择由SDXL 1.0生成的图像。这一研究结果来自于在Discord上对实验模型的几代进行了数周的偏好数据收集，以及来自外部的测试数据。

## 图像生成能力
SDXL能够生成几乎任何艺术风格的高质量图像，是实现照片真实感的最佳开放模型。用户可以生成独特的图像，而不需要由模型赋予任何特定的“feel”，从而确保了风格的绝对自由。SDXL 1.0特别适合生动和准确的颜色，与其前身相比，具有更好的对比度、光照和阴影，所有这些都是在原生的1024x1024分辨率中实现的。

## 概念生成能力
此外，SDXL能够生成图像模型难以呈现的概念，例如手和文本或空间排列的构图（例如，背景中的女人在追赶前景中的狗）。

## 语言理解能力
SDXL只需要几个词就可以创建复杂、详细和美观的图像。用户不再需要调用像“masterpiece”这样的限定词来获取高质量的图像。此外，SDXL可以理解像“The Red Square”（一个著名的地方）和“red square”（一个形状）之间的概念差异。

## 架构设计
SDXL 1.0是任何开放访问图像模型中参数数量最大的之一，基于一个创新的新架构构建，由一个3.5B参数的base model和一个6.6B参数的refiner组成。

完整的模型由一个mixture-of-experts pipeline组成，用于latent diffusion：在第一步中，base model生成（noisy）latents，然后进一步用专门用于最后去噪步骤的refinement model进行处理。注意，base model也可以作为一个独立的模块使用。

这种两阶段的架构允许在图像生成中保持稳健性，而不会妨碍速度或需要过多的计算资源。SDXL 1.0应该能在具有8GB VRAM的消费者GPU或者随时可用的云实例上有效工作。

SDXL目前还不支持图像控制，但是即将到来。
