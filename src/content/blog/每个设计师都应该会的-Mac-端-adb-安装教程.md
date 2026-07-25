---
title: 每个设计师都应该会的 Mac 端 adb 安装教程
date: '2019-09-01T00:51:50.000Z'
author: Aaron Xu
tags:
  - 教程
  - 交互设计
  - 代码
categories:
  - 教程
excerpt: >-
  adb，全称“Android Debug Bridge”，直译为 Android 调试桥，不仅可用来调试 Android
  应用，平时在安装、卸载一些系统核心应用的时候也需要用到，这篇文章就是教如何在 Mac 下安装这个神奇的工具的。
minutes: 2
---
> adb，全称“Android Debug Bridge”，直译为 Android 调试桥，不仅可用来调试 Android 应用，平时在安装、卸载一些系统核心应用的时候也需要用到，这篇文章就是教如何在 Mac 下安装这个神奇的工具的。

#### [](#1-安装-Xcode-Command-Line-Tools "1. 安装 Xcode Command Line Tools")1. 安装 Xcode Command Line Tools

该步骤目的为激活 Mac 命令行工具的开发能力，让其可以调用一些神奇的接口去安装东西。
先打开”终端“这个工具，command + 空格搜索”终端“就能找到。

然后在命令行中输入
`xcode-select --install`
若系统尚未安装命令行工具，那么就会提示安装
![命令行提示](https://upload-images.jianshu.io/upload_images/1101711-008ebde2ea2441f5.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1000)
一路同意，基本都可以安装成功。

#### [](#2-安装-homebrew "2. 安装 homebrew")2. 安装 homebrew

该步骤是去安装安装adb所必须的工具。
直接在终端中输入
`ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"`
即可安装。

#### [](#3-安装-adb "3. 安装 adb")3. 安装 adb

该步骤是安装 adb
直接在终端中输入
`brew install --cask android-platform-tools`
即可安装。

#### [](#4-常用的-adb-命令 "4. 常用的 adb 命令")4. 常用的 adb 命令

安装应用：
`adb install -r -t 应用路径`
例如”adb install -r -t /Users/xuweinan/Downloads/ProtoPie_Player.apk”
请注意文件名中不要有空格，有空格就需要加上转义符，会很麻烦。
当然也可以直接把文件拖到终端工具里面，会自动生成路径。
输完敲回车，出现 Success 提示就好了。
(-r 表示覆盖安装，-t 表示test only，不需要这些选项的可以不输)

查看应用包名：
`adb shell pm list packages`
可以列出手机中所安装的所有应用的包名。

卸载应用：
`adb uninstall 应用包名`
上一步获取的包名，这一步可以用来卸载。
部分系统核心应用是无法卸载的，这个请注意。

#### [](#5-异常处理 "5. 异常处理")5. 异常处理

若上述 adb 指令没有效果，那么可能是手机没有连上，使用
`adb devices`
来看看设备有没有连上
如果连上那么在“List of devices attached”下面会出现你设备的序列号
![](https://tva1.sinaimg.cn/large/006y8mN6ly1g6hfs6015gj30wi0ka0xb.jpg)

如果这边没识别到设备，那可能是开发者选项里面USB调试没有打开，去打开，然后重新插拔手机，第一次使用USB调试模式的话需要在手机端允许电脑调试这台手机。
