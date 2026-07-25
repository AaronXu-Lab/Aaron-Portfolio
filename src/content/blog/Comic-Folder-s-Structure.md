---
title: Comic Folder's Structure
date: '2025-03-26T09:12:51.000Z'
author: Aaron Xu
tags:
  - 漫画
  - 文件夹结构
  - 命名规范
  - 排序规则
  - 封面设置
  - 图像格式
  - APP使用指南
categories:
  - 教程
excerpt: >-
  Thank you for using my comic parsing APP! This guide will help you understand
  how to organize your folder structure so that the APP can corr
minutes: 5
---
Thank you for using my comic parsing APP! This guide will help you understand how to organize your folder structure so that the APP can correctly parse your comic content.  
感谢你使用我的漫画解析应用！本指南将帮助你了解如何组织文件夹结构，以便应用能够正确解析你的漫画内容。

  

## Basic Folder Structure | 基本文件夹结构

Our APP uses a three-level hierarchical structure to organize comic content:  
我们的应用使用三级层次结构来组织漫画内容：

1. **Main Folder**: Represents a complete comic series  
   **主文件夹**：代表一个完整的漫画系列  
2. **Subfolders**: Represents each individual comic book in the series  
   **子文件夹**：代表系列中的单本漫画  
3. **Image Files**: Represents each page in the comic  
   **图像文件**：代表漫画中的每一页  

## Folder Naming and Sorting | 文件夹命名与排序

### Comic Book Sorting (Subfolders) | 漫画分卷排序（子文件夹）

Subfolders are sorted by name by default. To customize the sorting order, we provide a special naming convention:  
子文件夹默认按名称排序。要自定义排序顺序，我们提供了以下命名规范：

```
number_name
```

For example:  
例如：

- 1_Volume One  
  1_第一卷  
- 2_Volume Two  
  2_第二卷  
- 10_Volume Ten  
  10_第十卷  

**Important Note**: When using the "number_name" format, the APP will automatically omit the number and underscore during parsing, displaying only the "name" part. This allows you to control sorting while keeping the display names clean.  
**重要提示**：使用 “数字_名称” 格式时，应用在解析时会自动去除数字和下划线，只显示 “名称” 部分。这样既能控制排序，又能保持显示名称的整洁。

### Comic Page Sorting (Image Files) | 漫画页排序（图像文件）

Image files are also sorted by name. To ensure the correct page order, we strongly recommend using simple numerical naming:  
图像文件同样按名称排序。为了确保页码顺序正确，强烈建议使用简单的数字命名：

```
1.jpg, 2.jpg, 3.jpg...
```

## Cover Image Setting | 封面图像设置

If you want to set a specific cover image for a comic book, simply place an image file named `thumbnail.png` (or `thumbnail.jpg`/`thumbnail.jpeg`/`thumbnail.webp`) in the subfolder.  
如果你想为某本漫画设置特定的封面，只需在子文件夹中放置名为 `thumbnail.png`（或 `thumbnail.jpg`/`thumbnail.jpeg`/`thumbnail.webp`）的图像文件即可。

**Special Notes**:  
**特别说明**：

- This specially named image will be used as the cover display for that comic book  
  此命名图片将作为该漫画的封面展示  
- The cover image will not be counted as a content page in the comic  
  封面图像不会被视为漫画的内容页  

## Supported Image Formats | 支持的图像格式

The APP currently supports the following image formats:  
本应用当前支持以下图像格式：

- JPG/JPEG  
- PNG  
- WEBP  

## Complete Example | 完整示例

A standard comic folder structure example:  
标准漫画文件夹结构示例：

```
My Comic Series/
├── 1_Volume One/
│   ├── thumbnail.jpg
│   ├── 1.jpg
│   ├── 2.jpg
│   └── 3.jpg
├── 2_Volume Two/
│   ├── 1.png
│   ├── 2.png
│   └── 3.png
└── 3_Volume Three/
    ├── 01.webp
    ├── 02.webp
    └── 03.webp
```

By organizing your folders according to this structure, the APP will correctly recognize "My Comic Series" as a complete comic series containing three independent comic books: "Volume One", "Volume Two", and "Volume Three", each with 3 pages of content, and "Volume One" has its own dedicated cover images.  
按照此结构组织文件夹后，应用会正确识别 “My Comic Series” 是一个包含三本独立漫画的完整系列：“第一卷”、“第二卷”和“第三卷”，每本包含 3 页内容，其中 “第一卷” 还带有专用封面图。

Enjoy using the APP!  
祝你使用愉快！
