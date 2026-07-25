---
title: GPT 5.4 发布，这是你感兴趣的一切
date: '2026-03-06T11:19:41.000Z'
author: Aaron Xu
tags:
  - 随笔
categories:
  - 随笔
excerpt: >-
  北京时间 3月6日 凌晨，OpenAI 正式发布了 GPT 新一版本，5.4。面向 Plus 及以上用户开始推出，取代 GPT 5.2
  Thinking，非推理模型。 不愧是 OpenAI，模型命名是一贯的乱。前几天推出的 5.3 Instant 取代了 5.2 Instant，
minutes: 6
---
北京时间 3月6日 凌晨，OpenAI 正式发布了 GPT 新一版本，5.4。面向 Plus 及以上用户开始推出，取代 GPT-5.2 Thinking，非推理模型。

![image-20260306182742087](https://cdn.jsdelivr.net/gh/XuWeinan123/blogImage/img/image-20260306182742087.png)

不愧是 OpenAI，模型命名是一贯的乱。前几天推出的 5.3-Instant 取代了 5.2-Instant，前几天还说会推出 5.3-Thinking 和 Pro，结果到了今天 Sam 反手直接掏出了 5.4 系列。



> GPT‑5.3 Instant is available starting today to all users in ChatGPT, as well as to developers in the API as ‘gpt-5.3-chat-latest.’ Updates to Thinking and Pro will follow soon.
>
> （以上是 3月3日 的官方消息）

## 亮点总结

Anyway，先简单看一下 5.4 的亮点：

* 推理、编程和 Agent 工作流一体化
* 专业知识工作大幅增强
* 可以写代码操作电脑，或者根据截图来操作鼠标和键盘
* 支持海量工具生态
* Thinking 模式交互优化，支持打断
* 长达 1M 的 token 上下文以及更高的定价

## 推理、编程和 Agent 工作流一体化

> GPT‑5.4 brings together the best of our recent advances in reasoning, coding, and agentic workflows into a single frontier model.

GPT 5.4 将之前在 GPT-5.3-Codex 等次级领域中的能力直接融合到了一个模型中，也就是说后续在 Codex 这些软件中不会再有（应该不会有了）GPT-5.4-Codex 这样的编程专用模型，而是直接使用 5.4，包括 API 请求中也是。

下方也提供了 5.4 与 5.3-Codex 的对比，均为胜出。

## 专业知识工作大幅增强

> On GDPval⁠, which tests agents’ abilities to produce well-specified knowledge work across 44 occupations, GPT‑5.4 achieves a new state of the art, matching or exceeding industry professionals in 83.0% of comparisons, compared to 70.9% for GPT‑5.2.

GDPval 是 OpenAI 推出的基准测试，用来评估模型在**真实世界、具有直接经济价值的任务**中的实际表现。

测试覆盖美国 GDP 贡献最高的 9 个行业中的 44 个岗位，模拟真实岗位的日常产出，让模型向员工一样交作业，再由人类专业人士打分。

GPT 5.4 最终的得分是 83%，即在 83% 的任务中相对于行业专业人士持平或超过。作为商代模型的 5.2 是 70.9%

## 可以写代码操作电脑，或者根据截图来操作鼠标和键盘

> GPT‑5.4 is our first general-purpose model with native **computer-use capabilities** and marks a major step forward for developers and agents alike.

5.4 是 OpenAI 首个具备原声计算机使用能力的通用模型。

看上去似乎是类似于 Claude Cowork 一样的东西。不过这不是说用户可以直接在 ChatGPT 客户端里要求 GPT 干这干那了，而是这个模型更适合用来看屏幕上有什么内容，以及设计对应的代码来操作电脑。

应该说是更适合结合 OpenClaw 这类产品使用了吧，操作电脑的效率将会直线上升。

## 支持海量工具生态

> In the API, GPT‑5.4 introduces tool search⁠(opens in a new window), which allows models to work efficiently when given many tools.
> GPT‑5.4 also improves tool calling, making it more accurate and efficient when deciding when and how to use tools during reasoning, particularly in the API. 

之前如果给 AI 一大堆 MCP 接口的工具，模型每次在决策要使用什么工具时会花很多的时间，5.4 则会将这个时间大幅减少。

官方提供的数据中，开启/未开启工具搜索所消耗的 token 是 65,320:123,139

## Thinking 模式交互优化，支持打断

> GPT‑5.4 Thinking in ChatGPT will now outline its work with a preamble for longer, more complex queries. 

一个有趣的交互小优化，之前调用 Thinking 模型，会直接开始推理，现在是用一段前段输出概述接下来要做的事情，然后再开始推理。这样就方便在中途进行打断操作，以防 AI 会错意了。

## 长达 1M 的 token 上下文以及更高的定价

> GPT‑5.4 is priced higher per token than GPT‑5.2 to reflect its improved capabilities, while its greater token efficiency helps reduce the total number of tokens required for many tasks.

看了一下列表，5.2 的输入输出分别是 1.75/0.175 M tokens，5.4 则是 2.50/0.25。对比下来价格上升了 40%！不过官方也提到，5.4 的执行效率会更高，因为各种能力的增强，实际消耗的 token 是会减少的。

不过整体的任务花费的价格就不太清楚了，官方没提这个。

---

原文地址：https://openai.com/index/introducing-gpt-5-4/
