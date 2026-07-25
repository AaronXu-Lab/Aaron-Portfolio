---
title: 关于 Android R 的第一印象
date: '2020-02-24T08:02:44.000Z'
author: Aaron Xu
tags:
  - 随笔
  - 交互设计
categories:
  - 随笔
excerpt: >-
  前段时间发了谷歌发了个 Android R 的开发者预览版，本来想下下来刷个机体验下，不过手头上的 pixel 3a
  不知道为什么一直不成功，所以就只能拿虚拟机试试看。用虚拟机对着官网上的新特性一个个试试，再结合外网媒体的一些资料，大概比较全面地总结了一些我能看懂的
  Androi
minutes: 3
---
> 前段时间发了谷歌发了个 Android R 的开发者预览版，本来想下下来刷个机体验下，不过手头上的 pixel 3a 不知道为什么一直不成功，所以就只能拿虚拟机试试看。用虚拟机对着官网上的新特性一个个试试，再结合外网媒体的一些资料，大概比较全面地总结了一些我能看懂的 Android R 新特性。

## [](#1-One-time-permissions-一次性权限 "1. One-time permissions|一次性权限")1. One-time permissions|一次性权限

　　Android 11 里面，可以将位置、麦克风、相机权限临时赋予一次给应用(参考Android Q 的位置权限)。

## [](#2-User-choice-can-restrict-when-a-permission-dialog-appears-用户的行为可以限制权限弹窗的出现 "2. User choice can restrict when a permission dialog appears|用户的行为可以限制权限弹窗的出现")2. User choice can restrict when a permission dialog appears|用户的行为可以限制权限弹窗的出现

　　Android 不鼓励应用重复请求权限，所以如果用户对某一个权限连续点击两次拒绝的话,那就当成是
不再询问。
　　如果是使用返回操作退出权限请求对话框，那不作数。
　　如果应用帮用户跳到系统设置的对应应用权限页面诱导用户开启权限，但用户选择了返回，这个就也算一次拒绝。

## [](#3-Background-location-access-后台位置权限获取 "3. Background location access|后台位置权限获取")3. Background location access|后台位置权限获取

![](https://tva1.sinaimg.cn/large/0082zybpgy1gc7qmg9wd5j30u01po7b4.jpg)
　　Android 删除了弹窗中一直允许在后台获取位置权限的选项，如果应用需要用户一直开权限，Android 官方建议你做个页面让用户了解你要干啥，了解完之后给跳到应用设置页面去，哄用户打开。
　　或者提供一种不要后台位置权限的服务模式。

## [](#4-All-Files-Access-全文件访问 "4. All Files Access|全文件访问")4. All Files Access|全文件访问

　　部分应用可以声明一个特殊的权限`MANAGE_EXTERNAL_STORAGE`来获取到全文件的访问权限，包括一些潜在的敏感数据。

# [](#以上是官网向开发者展示中我能看懂的部分。 "以上是官网向开发者展示中我能看懂的部分。")以上是官网向开发者展示中我能看懂的部分。

# [](#以下是从一些媒体上获取到的比较亲民的内容。 "以下是从一些媒体上获取到的比较亲民的内容。")以下是从一些媒体上获取到的比较亲民的内容。

## [](#1-支持-5G "1. 支持 5G")1. 支持 5G

  引入了 `Dynamic meteredness API`，这个 API 可以让应用检查当前的流量是不是免费的（例如腾讯王卡？）如果是免费的那就提供更好的服务（例如更好的分辨率或质量）。也可以把免费的流量不计入整体的系统流量统计中。
  `Bandwidth estimator API`
  消耗流量较少，较方便的估计网速的接口。

## [](#2-支持折叠屏 "2. 支持折叠屏")2. 支持折叠屏

  引入新的API让开发者可以自己设置应用的边缘误触区域。

## [](#3-分区存储 "3. 分区存储")3. 分区存储

  去年就有，不过正式版本里面被去掉了，然后今年又回来了。
  简单来说类似 iOS 的沙盒应用，APP只能在自己的目录里面和一部分指定的公共目录里面写文件，不能再在公共存储中创建文件。
![左未启用，右启用](https://tva1.sinaimg.cn/large/0082zybpgy1gc7s1vazf1j30v40p5myw.jpg)
  不过可喜可贺的是，这个强制要求仅会要求那些目标设计版本是 R 的应用才有效，如果应用把目标设计版本 调为 Q 或更早，那就不用遵循这个规则。

  `目标设计版本：`开发者设置应用程序想要在什么版本的Android上跑，如果版本设成以前的版本的话，就没有办法使用最新版本的开发接口来开发应用。

## [](#4-勿扰模式改进 "4. 勿扰模式改进")4. 勿扰模式改进

  Android R 的勿扰模式现在可以设置允许打扰的应用。
  ![](https://tva1.sinaimg.cn/large/0082zybpgy1gc7svptl9uj30u01poacw.jpg)
  提供新的 API 让应用可以自己设置什么时候临时开启暗色模式，比如相机可以在录像的时候临时开启勿扰模式。
  ![](https://tva1.sinaimg.cn/large/0082zybpgy1gc7sgqk4ywj30u01rbq4n.jpg)

## [](#5-在通知中心单独给通知类应用开辟了一个区域显示通知 "5. 在通知中心单独给通知类应用开辟了一个区域显示通知")5. 在通知中心单独给通知类应用开辟了一个区域显示通知

## [](#6-Android-闪回键-“Bubble” "6. Android 闪回键 “Bubble”")6. Android 闪回键 “Bubble”

![](https://tva1.sinaimg.cn/large/0082zybpgy1gc7sof1rcoj30u014ewf4.jpg)

## [](#7-暗色模式可以自动切换了 "7. 暗色模式可以自动切换了")7. 暗色模式可以自动切换了

![](https://tva1.sinaimg.cn/large/0082zybpgy1gc7srbesrpj30u01pomz7.jpg)

## [](#8-开飞行模式可以不关蓝牙了（连着蓝牙的时候） "8. 开飞行模式可以不关蓝牙了（连着蓝牙的时候）")8. 开飞行模式可以不关蓝牙了（连着蓝牙的时候）
