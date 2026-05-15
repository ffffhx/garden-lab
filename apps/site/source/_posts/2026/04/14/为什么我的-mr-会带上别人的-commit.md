---
title: 为什么我的 MR 会带上别人的 commit？
date: 2026-04-14 10:23:08
categories:
  - 技术
tags:
  - Git
  - Rebase
  - Cherry-pick
  - MR
excerpt: "一次本地 rebase 之后又顺手执行了 `git pull -r`，结果 MR 里混进了别人的 commit。本文复盘这个问题为什么发生，以及如何用 `cherry-pick` 和 `git push --force-with-lease` 把分支救回来。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

当我准备提 MR 的时候，看到几千行改动，第一反应是哪里不对。点开提交记录后更离谱：除了我自己的 commit，里面还混进了其他人的提交，而且有些相似的 commit 甚至重复出现了 3 次。

{% asset_img figure-01.png %}

{% asset_img figure-02.png %}

## 问题场景还原

### 场景一：Author 是别人，commit 却像是我带进去的

{% asset_img figure-03.png %}

先看一个最常见的过程。假设我正在开发一个功能，同时需要持续跟团队的集成分支 `release` 对齐。

**初始状态：**

- 我的功能分支 `feature` 历史是 `A-B-D`
- 团队的 `release` 分支历史是 `A-B-C`
- 其中 `C` 是其他同事提交的

{% asset_img diagram-01.jpg %}

#### 第一步：在本地用 `git rebase release` 对齐 `feature`

```bash
git rebase release
```

假设 `C` 和 `D` 有冲突。由于这两个提交都基于 `B`，Git 没法自动合并，于是我手动解决了冲突。解决完以后，本地 `feature` 的历史就从 `A-B-D` 变成了 `A-B-C-D'`。

{% asset_img diagram-02.jpg %}

> **核心概念**
>
> `rebase` 的本质不是“把原来的提交搬过去”，而是“把原来的提交重新播放一遍”。
>
> 所以原来的 `D` 会被丢弃，Git 会生成一个新的提交 `D'`。虽然代码内容可能几乎一样，但因为父提交已经从 `B` 变成了 `C`，它的 SHA 也会变成一个全新的值。

此时，本地 `feature` 已经领先于远端 `origin/feature`。问题还没有真正爆发，真正的转折点在下一步。

#### 第二步：顺手执行 `git pull -r`

{% asset_img figure-04.png %}

我当时把 `git pull` 配成了 `git pull -r`，又习惯性地点了同步更改。这个动作展开后，本质上是两步：

1. `git fetch`
2. `git rebase origin/feature`

关键就在这里。Git 判断“哪些提交还没有推到远端”，是基于提交历史来算的，而不是基于“你主观上觉得这些代码是不是你写的”。

- 本地 `feature`：`A-B-C-D'`
- 远端 `origin/feature`：`A-B-D`

对 Git 来说，本地的 `C` 肯定是远端没有的新提交；`D'` 则要看它和远端已有的 `D` 是否还是同一份“补丁”。

Git 在 rebase 时会尝试识别已经在上游出现过的等价改动。如果 `D'` 和远端的 `D` 改的是同一批内容，虽然它们的 SHA 不一样，Git 也可能认为这两个 commit 是 patch-equivalent，也就是“提交对象不同，但 diff 基本等价”。这种情况下，Git 可能会跳过 `D'`，最后只把 `C` 复制成 `C'`：

`A-B-D-C'`

但我当时的问题在于，前面解决冲突时已经把 `D'` 改得不再等价于原来的 `D`。这时候 Git 会把 `C` 和 `D'` 都当成远端没有的新改动，继续在远端分支顶部重放，最后得到：

`A-B-D-C'-D''`

- `C'` 是对同事提交 `C` 的一次复制
- `D''` 是对我自己提交 `D'` 的再次复制

{% asset_img diagram-03.jpg %}

这时候，别人的提交就真的被“带”进了我的分支里。到了这里，这个分支其实已经脏了。

### 场景二：Author 和 commit 都是别人

{% asset_img figure-05.png %}

还有一种更迷惑的情况：MR 里出现的提交连 author 都是别人，看起来像是整段历史直接混进来了。这个过程一般类似下面这样。

先是 `feature` 分支 rebase 到 `release`：

{% asset_img diagram-04.jpg %}

接着，其他人的改动被合进了 `master`：

{% asset_img diagram-05.jpg %}

随后，`release` 又 rebase 到了 `master`：

{% asset_img diagram-06.jpg %}

这里真正容易误判的地方是：代码内容相似，不代表 Git 认为它们是同一个提交。

`release` 被 rebase 到 `master` 之后，原来那条历史里的 `C` 已经变成了另一条历史上的新提交。它可能和旧的 `C` 做了相似甚至相同的改动，但因为父提交变了，SHA 也变了，Git 会把它当成另一个 commit 对象。

MR 展示提交列表时，通常会根据源分支和目标分支的共同祖先，以及哪些 commit 只存在于源分支上来判断。此时两条历史的共同祖先仍然可能停在 `B`，于是我 `feature` 里那个旧的 `C` 就会被判断为“只在源分支上存在”，最终出现在 MR 的提交记录里：

{% asset_img diagram-07.jpg %}

## 为什么解决冲突之后还是会出问题

Git 在处理冲突时，并不是只看“当前文件长什么样”，而是同时对比三份内容：

1. 共同祖先里的版本
2. 当前基线里的版本
3. 当前这个 commit 想改成的版本

冲突大致会在下面这种情况下出现：

- 相比共同祖先，这一行在当前基线里已经被改过
- 同时，这个待重放的 commit 也改了同一行
- 而且两边改出来的结果不同，Git 又无法自动判断该保留哪一个

我当时主要踩了两类冲突：

1. 拉取 IDL 相关改动时，把不该带上的生成文件一并拉下来了，后面又反复回滚和修正，导致同一类文件被多次改写。
2. 为了临时验证功能，我直接改动了另一位同事还没抽到公共层的组件，结果后续 rebase 时这部分也反复冲突。

## 我实际踩过的几个坑

### 踩坑一：硬着头皮继续 rebase，冲突一个个解

我最开始真的是这么干的。大概连续处理了六七次冲突，想着总能把历史理顺。

但问题不是“只要解决冲突就会制造复制提交”。真正的问题是：我已经在本地改写过历史，却又继续在旧的远端分支或错误的基线上反复 `rebase` / `pull --rebase`。每做一次，Git 都会重新计算“哪些 commit 只在本地存在”，然后把这些 commit 再播放到新的基线后面。

冲突在这里起到的是放大作用。每次手动解决冲突，都可能让新生成的提交和原来的提交不再 patch-equivalent，于是 Git 更难把它识别成“已经应用过的改动”，最后就更容易看到一串重复 commit。

更坑的是，做完这些之后我又执行了一次 `git pull -r` 再 `git push`，相当于把已经脏掉的历史又重演了一遍。

{% asset_img diagram-08.jpg %}

### 踩坑二：尝试用 `rebase -i` 硬删历史

后面我又试过 `rebase -i`，想通过 `drop` 或 `squash` 把多余的提交整理掉。

问题是，只要这个分支本身已经因为错误的 rebase 链路变脏了，`rebase -i` 只是局部整理，依然绕不开“重新对齐 `release`”这一步。根因没解决，后面还是会继续出问题。

{% asset_img diagram-09.jpg %}

## 正确处理方式：`cherry-pick` + `git push --force-with-lease`

真正靠谱的做法，是直接基于最新的 `release` 新检出一个干净分支，然后只把我真正需要的那几个提交 `cherry-pick` 过去。

{% asset_img diagram-10.jpg %}

整理完以后，再用下面这条命令把远端分支同步成新的历史：

```bash
git push --force-with-lease
```

> **为什么是 `--force-with-lease`，不是 `--force`？**
>
> `git push --force` 会无条件用本地分支覆盖远端分支。如果在我处理 rebase 的过程中，其他人又往远端推了新提交，这个命令会直接把别人的代码抹掉。
>
> `git push --force-with-lease` 会先检查远端分支是否仍然是我上一次 `fetch` 时看到的那个状态。只有在远端没有悄悄变化的前提下，它才允许覆盖。这样能避免误删别人刚推上去的提交。

最终整理干净后的提交历史大致会长这样：

{% asset_img diagram-11.jpg %}

## 最后记一条经验

这次问题的根源，不是“冲突太多”，而是我在已经做过本地 `rebase` 的前提下，又对同一个分支执行了 `git pull -r`，结果把原本只是“改写过”的历史再次重放，最终把别人的提交也复制进了自己的 MR。

如果只记住一条经验，我会记这三点：

1. `rebase` 会改写提交历史，解决完冲突以后，本地提交已经不是原来的那个 commit 了。
2. 如果你 rebase 过一个已经存在远端分支的功能分支，后续同步远端时要非常谨慎，很多情况下应该直接 `git push --force-with-lease`，而不是再 `git pull -r`。
3. 一旦分支已经明显变脏，最省时间的做法通常不是继续修历史，而是从最新基线拉一个干净分支，把真正需要的提交重新 `cherry-pick` 过去。
