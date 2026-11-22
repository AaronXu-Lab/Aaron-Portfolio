---
title: 我是怎么写 Agent Skill 的（占位稿）
date: '2025-12-31T16:00:00.000Z'
author: Aaron Xu
tags:
  - Agent Skill
  - AI 工作流
categories:
  - 随笔
excerpt: >-
  这是一篇占位文章，正式内容还没写。首页 Skill 区块底部的介绍链接先指向这里，写好后用 npm run add:post force 覆盖即可。 我给
  Claude Code 和 Codex 写了一批 Agent Skill，从设计流程协调、组件选用，到写作和网络诊断。这篇文
minutes: 1
---
> 这是一篇占位文章，正式内容还没写。首页 Skill 区块底部的介绍链接先指向这里，写好后用 `npm run add:post -- --force` 覆盖即可。

我给 Claude Code 和 Codex 写了一批 Agent Skill，从设计流程协调、组件选用，到写作和网络诊断。这篇文章打算讲清楚三件事：为什么要把做事的方法写成 Skill，一个 Skill 是怎么从零打磨出来的，以及我自己怎么判断它「写好了」。



## 为什么写 Skill

同一件事反复交代给 AI，是一种浪费。把做法固定下来，让它每次都按同一套标准去做，结果才稳定，也才有机会被检查和改进。

## 一个 Skill 的样子

每个 Skill 是一个带 `SKILL.md` 的目录：说明它解决什么问题、什么时候触发、该怎么一步步做，必要时附上脚本和参考资料。

## 怎么判断写好了

（待补充：我用哪些真实任务来回归测试，哪些情况下会重写。）

完整的 Skill 列表在 [Skill 页面](/skills/)。
