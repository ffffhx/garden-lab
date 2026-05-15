---
title: Pretext 源码解析：为什么它能脱离 DOM 做高性能文本测量与布局
date: 2026-04-14 13:42:00
categories:
  - 技术
tags:
  - 前端
  - 性能优化
  - 排版
  - Canvas
  - 源码解析
  - Unicode
excerpt: "从 `getBoundingClientRect()` 为什么会触发 reflow 讲起，系统拆解 `chenglou/pretext` 的 `prepare/layout` 两阶段设计、文本分析、Canvas 测量、换行热路径、多语言边界和验证体系，并说明它什么时候适合用、什么时候不适合用。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

最近看了 [chenglou/pretext](https://github.com/chenglou/pretext) 这个仓库，第一眼会觉得它像一个“文本布局库”，但如果只这么理解，反而会错过它最重要的价值。

它真正解决的问题其实是：

- 浏览器里要拿到一段文本的真实高度，往往得依赖 DOM
- 而像 `getBoundingClientRect()`、`offsetHeight` 这样的几何读，在布局失效的前提下会强制浏览器提前做一次同步布局
- 一旦业务代码把“写样式”和“读几何”交错起来，就很容易形成 reflow thrash，也就是反复的强制布局

Pretext 的核心思路并不花哨，但很有工程价值：

- 在 `prepare()` 阶段，把文本分析、分段、测量、缓存一次性做完
- 在 `layout()` 阶段，只基于缓存宽度做纯算术换行
- 让“频繁 resize 时的文本重排”脱离 DOM 热路径

这篇文章会按下面这条主线展开：

1. 为什么 DOM 文本测量会成为性能问题
1. Pretext 到底解决了什么
1. 它的 `prepare -> layout` 两阶段抽象为什么成立
1. 源码里 `analysis / measurement / line-break / rich-inline` 各自负责什么
1. 它怎么处理多语言、emoji、soft hyphen、`pre-wrap` 这些边界
1. 它怎么证明自己不是“看起来能跑”的 demo
1. 它什么时候适合用，什么时候不适合用

## 0. 阅读预备：先统一几个名词

这篇文章里会反复出现一些排版和浏览器底层术语。如果你不是经常看文本布局相关源码，建议先看完这一节，再往后读会顺很多。

### 0.1 reflow / layout / 几何读

- `layout`：浏览器计算一个元素最终多宽、多高、在页面什么位置的过程。很多文章也把这一步叫 `reflow`，两者在日常讨论里经常混用。
- `reflow`：更口语化的说法，强调“页面因为样式或内容变化，需要重新计算布局”。
- `几何读`：指读取元素几何信息的 API，比如 `getBoundingClientRect()`、`offsetHeight`、`scrollWidth`。它们关心的是元素的真实尺寸和位置。
- `forced synchronous layout`：指浏览器本来想把布局计算延后，但因为 JavaScript 立刻发起了几何读，只能同步把布局先算出来。

### 0.2 CJK 是什么，CJK 断行又是什么意思

- `CJK`：是 Chinese、Japanese、Korean 的缩写，也就是中文、日文、韩文这类东亚文字系统。
- `CJK 断行`：指这类文本在换行时，往往不像英文那样主要按空格断开，而更可能在字与字之间断开。

举个最直观的对比：

- 英文里 `hello world` 更像是按单词和空格组织
- 中文里 `今天天气很好` 中间没有空格，但浏览器依然可以在合适的位置换行

所以当文章里说“CJK 断行”时，意思通常是：

- 断行单位不再只是“单词”
- 某些字符可以在字与字之间换
- 但标点、引号等又有额外规则，不能随便跑到行首或行尾

### 0.3 segment 是什么

- `segment`：可以把它理解成“Pretext 内部拿来测量和断行的最小文本片段”。

它不一定等于：

- 一个原始字符
- 一个单词
- 也不一定等于你肉眼看到的一个“字”

更准确地说，segment 是 Pretext 在 `prepare()` 阶段分析文本之后，得到的一串内部单位。后面的测量、缓存、换行，都是围绕这些单位进行的。

举个例子：

- 英文句子里，一个 segment 可能是一个单词，也可能是“单词 + 标点”
- 中文句子里，一个 segment 可能被拆得更细，接近按字处理
- `soft hyphen`、`hard break`、`tab` 这类特殊东西，也可能被单独变成一个 segment

### 0.4 grapheme 是什么

- `grapheme`：可以把它近似理解成“用户肉眼看到的一个完整字符单位”。

之所以说“近似”，是因为在 Unicode 世界里，一个肉眼看到的字符，不一定只由一个 code point 组成。

例如：

- 一个 emoji 可能由多个 code point 组合出来
- 某些带声调、带组合符号的字符，也可能是多个码位共同组成一个显示单位

所以当文章里说“按 grapheme 拆”时，意思不是“按 JavaScript 字符串下标拆”，而是“按用户真正看到的字符单位拆”。

### 0.5 bidi 是什么

- `bidi`：是 bidirectional text 的缩写，也就是双向文本。

最常见的场景是：

- 英文、数字通常从左到右
- 阿拉伯文、希伯来文通常从右到左
- 一段文本里可能同时混着这两类内容

例如一行文字里既有阿拉伯文，又有英文 URL、数字、括号时，显示顺序和逻辑顺序可能就不是一回事。Pretext 在一些 API 里会保留简化的 bidi 信息，帮助自定义渲染器处理这类情况。

### 0.6 soft hyphen 是什么

- `soft hyphen`：软连字符，通常写作 `&shy;` 或 Unicode 字符 `U+00AD`。

它的特点是：

- 平时不一定显示出来
- 但如果浏览器刚好在这个位置断行，就可能在行尾显示一个 `-`

可以把它理解成“这里允许断开，而且如果断开了，最好给读者一个连字符提示”。

这和普通减号不一样：

- 普通减号本来就是可见字符
- `soft hyphen` 平时通常是隐藏的，只在断行时才显形

### 0.7 hard break 是什么

- `hard break`：硬换行，也就是作者明确写出来的换行。

最常见的来源就是：

- 文本里的 `\n`
- HTML/CSS 语义里等价的强制换行效果

它和普通自动换行的区别是：

- 自动换行是“这一行放不下了，所以浏览器自己断开”
- hard break 是“作者明确说这里必须换到下一行”

### 0.8 `white-space: normal` 和 `pre-wrap`

- `white-space: normal`：浏览器默认文本行为。连续空格会折叠，换行符通常不会按作者原样保留成空行。
- `white-space: pre-wrap`：会保留普通空格、换行和 tab 的更多原始信息，同时又允许在必要时自动换行。

这两个模式会直接影响：

- 空格是否保留
- `\n` 是否变成真实换行
- 行尾空格是否参与显示和测量

### 0.9 `word-break: keep-all`

- `word-break: keep-all`：可以简单理解成“尽量不要把文本随便拆开，尤其是在 CJK/Hangul 语境下更保守地断行”。

它不是“无论如何都不准断”，而是：

- 优先保持更大的连续文本块
- 但遇到实在太长、完全放不下的内容时，仍然需要有兜底策略

### 0.10 hanging space 是什么

- `hanging space`：指行尾空格虽然属于这行文本的一部分，但在决定“这一行还能不能继续塞内容”时，浏览器往往不会把它当成一个必须强占行宽的可见内容。

你可以把它粗略理解成：

- 它在语义上存在
- 但在 line fit 的判断上没那么“硬”

这也是为什么很多文本布局系统会把“能不能放得下”与“最终画出来看起来多宽”区分开。

### 0.11 最后再记住两个贯穿全文的词

- `prepare()`：一次性的准备阶段，负责分析文本、测量宽度、建立缓存
- `layout()`：反复执行的布局阶段，负责在给定宽度下计算行数和高度

后文所有实现细节，基本都围绕这两个阶段展开。

## 1. 先从问题本身说起：为什么文本测量会拖垮前端性能

很多 UI 组件都需要提前知道一段文本会占多高。典型场景包括：

- 虚拟列表要知道每一项高度，才能做正确的窗口裁剪
- 聊天列表要在消息插入后维持滚动锚点，避免跳动
- 瀑布流、卡片流、JS 驱动的多列布局，需要先算每张卡片文本高度
- Canvas、SVG、WebGL 或自绘编辑器，需要自己决定每一行文本放在哪
- 响应式布局里宽度变了，文本高度也会跟着变

浏览器当然能自己把文本排出来，但问题是：**你往往需要在布局发生之前，先拿到布局结果。**

于是很多人会写出下面这类代码：

```ts
for (const el of items) {
  el.style.width = `${nextWidth}px`
  const height = el.getBoundingClientRect().height
  cache.set(el, height)
}
```

这段代码看起来没问题，但它很容易让浏览器进入最不想看到的模式：**写一次，读一次，再写一次，再读一次。**

### 1.1 `getBoundingClientRect()` 为什么会触发 reflow

先说一个更准确的表述：

- `getBoundingClientRect()` 这类几何读，**不是在任何时候都会触发 reflow**
- 但当页面的样式或布局已经被前面的 DOM/样式修改标记为 dirty 时，浏览器为了返回“当前这一刻准确的几何值”，通常就必须先把 style 和 layout 结算出来

一个典型过程是这样的：

1. JavaScript 改了 DOM、class、inline style，或者插入了新节点
1. 浏览器把对应节点和相关树标记为“样式或布局可能失效”
1. 浏览器本来可以把这次 recalculation/layout 延后到本帧稍后的统一渲染阶段
1. 但你的代码马上调用了 `getBoundingClientRect()`、`offsetHeight`、`scrollHeight` 一类需要当前几何结果的 API
1. 浏览器没法返回旧值，因为旧值可能已经不对了
1. 于是只能同步执行一次 style recalc 和 layout，再把结果返回给 JavaScript

也就是说，这类 API 真正危险的地方不是“读”本身，而是：

- 它要求的是**已经结算完成的当前布局结果**
- 而你前面刚好又做了会使布局失效的写操作

这就是所谓的 **forced synchronous layout**。

{% asset_img figure-01.svg %}

如果把这件事再讲细一点，可以把浏览器想成一个“尽量延迟结算”的系统。

浏览器平时并不是你每改一行 DOM，它就立刻把页面从头到尾重新排一遍。更常见的做法是：

- 先记住“这里的样式可能变了”
- 再记住“这里的几何位置可能也变了”
- 等到本帧接近渲染阶段时，再把 style、layout、paint 一起批量做掉

这套延迟策略本来很好，因为它可以把很多零碎的小修改合并成一次大的计算。

问题出在：`getBoundingClientRect()`、`offsetHeight`、`scrollHeight` 这类 API 问的是一个非常具体的问题：

- 这个元素**现在这一刻**到底多宽、多高、在视口里的哪个位置？

而“现在这一刻的精确几何值”并不是浏览器手头总有的现成值。原因很简单：

- 你刚刚改了 `width`
- 或者改了 `font-size`
- 或者改了文案内容
- 或者插入了一个节点

那之前缓存的布局结果就有可能已经不对了。

所以当 JavaScript 在同一个调用栈里立刻追问几何信息时，浏览器就没有“等会儿再算”的空间了。它必须先把相关的 style 和 layout 补算出来，然后才能把结果同步返回给你。

这里面有两个非常容易混淆但很重要的点：

#### 1.1.1 不是所有 DOM 读都会触发 reflow

比如读一个普通属性、读 `textContent`、读 `className`，通常都不要求浏览器给出“最新几何结果”，因此不一定需要刷新布局。

真正危险的是**几何相关的同步读**，例如：

- `getBoundingClientRect()`
- `offsetWidth` / `offsetHeight`
- `clientWidth` / `clientHeight`
- `scrollWidth` / `scrollHeight`

这些 API 之所以贵，不是因为“读”这个动作贵，而是因为它们要求浏览器给出已经结算过的盒模型结果。

#### 1.1.2 也不是所有样式修改都会让 layout 失效

如果你改的是：

- `color`
- `background-color`
- `opacity`

它们通常只影响绘制，不一定影响布局尺寸。

但如果你改的是：

- `width`
- `height`
- `padding`
- `border`
- `font`
- `font-size`
- `line-height`
- 文本内容本身

那浏览器通常就得重新考虑盒子尺寸和位置，layout 就很可能失效。

#### 1.1.3 “触发 reflow” 更准确地说是“强制浏览器提前 flush 布局”

很多文章会简写成“`getBoundingClientRect()` 会触发 reflow”，这并不算错，但更严谨的说法是：

- 当布局结果已经 dirty 时，几何读会强制浏览器同步刷新 style/layout

如果页面当前没有任何相关失效，这次读可能很便宜；如果失效范围很大，这次读就可能非常贵。

### 1.1.4 用一个最小例子看它为什么必须同步

```ts
const el = document.querySelector('.card')!

el.style.width = '320px'
const rect = el.getBoundingClientRect()
console.log(rect.height)
```

这里的问题是：`rect.height` 应该返回什么？

- 返回旧宽度下的高度？不行，因为你刚把宽度改成了 `320px`
- 返回一个“可能之后会变”的估算值？也不行，因为这个 API 的语义就是返回当前真实值
- 异步等下一帧再给你？也不行，因为这个 API 是同步返回的

于是浏览器只剩一个选项：

1. 先把 `.card` 及其相关依赖的样式、布局算出来
1. 再把最新 `rect` 返回给 JavaScript

这就是几何读会变成同步屏障的原因。

### 1.2 为什么交错的读写会特别糟糕

如果你是这样写的：

```ts
for (const el of items) {
  el.style.width = `${nextWidth}px`
}

for (const el of items) {
  const height = el.getBoundingClientRect().height
  cache.set(el, height)
}
```

它仍然可能贵，但通常比“每个元素写完就立刻读”要好得多。原因是：

- 第一段循环把所有写操作先做完
- 浏览器更有机会把失效信息合并处理
- 第二段循环再统一读取几何值

而交错读写的坏处在于，浏览器可能被迫一遍又一遍地把布局提前算出来。

对于少量节点，这个代价也许不明显；但在这些场景下会迅速放大：

- 页面上有很多文本块
- 每个块的宽度都可能变化
- 组件彼此独立，各自都在“自己测自己的”
- 读和写分散在不同 hook、不同组件生命周期里
- resize、折叠展开、消息插入、列表滚动同时发生

Pretext README 里提到的那个核心背景，就是这个问题：**组件各自测量文本高度时，很容易把整个文档拖进反复 reflow。**

{% asset_img figure-02.svg %}

上图左边的模式最危险：

- 每次写完一个节点就立刻读一次几何
- 浏览器可能不得不一次次提前刷新布局

而右边虽然也有布局成本，但至少给了浏览器一次性合并处理的机会。

所以很多性能文章里才会反复强调两件事：

- 写 DOM 尽量批量写
- 几何读尽量批量读

Pretext 更进一步，它试图把这件事从根上改掉：**既然文本高度本质上是“字体 + 文本 + 宽度”决定的，那就不要每次都去 DOM 树里问。**

### 1.3 文本测量的难点不只是性能

如果只是英文单词换行，很多人会直觉上说：“那我自己用 `canvas.measureText()` 算一下宽度不就行了？”

问题在于，真实世界的文本没有这么简单。你马上会遇到：

- CJK（中文、日文、韩文这类东亚文字）按字断行，不是只按空格
- 泰文、缅文没有稳定的空格分词
- 阿拉伯文和混合方向文本有 bidi（双向文本方向）问题
- emoji 可能是一个 grapheme cluster（用户眼里一个完整字符），不是一个 code point
- soft hyphen（软连字符）平时不显示，断在这里时才显示 `-`
- `white-space: normal` 和 `pre-wrap`（保留更多空格和换行的模式）的行为差很多
- `word-break: keep-all`（尽量更保守地断行）会改变 CJK/Hangul 的策略
- 行尾空格在浏览器里往往是 hanging（存在，但不应强行主导 line fit）的，不应该主导断行

所以这个问题本质上不是“拿个宽度乘一乘”，而是：

**能不能在不依赖 DOM 热路径的前提下，做出足够接近浏览器的文本换行与测量。**

## 2. Pretext 到底是什么

Pretext 的定位可以概括成一句话：

**一个纯 JavaScript/TypeScript 的多行文本测量与布局库。**

注意它不是：

- 一个 React 组件库
- 一个完整的富文本排版引擎
- 一个浏览器排版内核的复刻

它解决的主要是两类问题：

### 2.1 用例一：先测高度，再决定怎么布局

```ts
import { prepare, layout } from '@chenglou/pretext'

const prepared = prepare(text, '16px Inter')
const { height, lineCount } = layout(prepared, width, 20)
```

这个用法最适合：

- 同一段文本会在多个宽度下重新排版
- 你需要文本高度，但又不想把 DOM 测量放进热路径
- 你希望 resize 时代价尽量小

### 2.2 用例二：你自己掌控每一行怎么渲染

```ts
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

const prepared = prepareWithSegments(article, '18px "Helvetica Neue"')
const { lines } = layoutWithLines(prepared, 320, 26)
```

这个模式适合：

- Canvas / SVG / WebGL 渲染
- 文字绕图
- 多列或 editorial layout
- 先算 line range，再按自己的方式 materialize 文本

它的野心并不是“取代浏览器排版”，而是：

- 尽量利用浏览器字体引擎给出的测量结果
- 把最贵、最容易抖动的 DOM 测量从热路径里拿掉
- 把文本布局变成一个可缓存、可复用、可验证的数据问题

## 3. 这套设计为什么成立：`prepare()` 和 `layout()` 的职责边界

Pretext 最值得学的地方，是它非常克制地把系统拆成了两个阶段。

### 3.1 `prepare()` 做什么

`prepare()` 是一次性、和文本内容强绑定的工作：

- 规范化空白字符
- 用 `Intl.Segmenter` 做分词/分段
- 处理标点粘连、CJK 断行、soft hyphen、hard break（作者明确写出的强制换行）等规则
- 用 canvas 测量 segment（内部文本片段）宽度
- 把需要 overflow break 的 segment 预先拆到 grapheme（用户看到的字符单位）级别
- 把这些结果缓存成一个宽度无关的 prepared handle

这里最重要的一点是：**`prepare()` 的产物与容器宽度无关。**

也就是说：

- 文本没变
- 字体没变
- 相关策略没变

那么同一个 `PreparedText` 就可以在不同宽度下反复布局，而不必重新测量。

### 3.2 `layout()` 做什么

`layout()` 则刻意只做和宽度有关、但和文本测量无关的工作：

- 在已有 segment 宽度上顺序累加
- 根据当前 `maxWidth` 决定在哪里断行
- 返回 `lineCount` 和 `height`

在 [src/layout.ts](https://github.com/chenglou/pretext/blob/main/src/layout.ts) 的注释里，作者其实把目标写得很直白：**hot path 必须保持成纯算术。**

这意味着 `layout()` 阶段：

- 不做 DOM 读
- 不做 canvas 测量
- 不做字符串重建
- 尽量不分配对象

这正是它能扛住高频 resize 的根本原因。

### 3.3 为什么这个抽象特别适合 UI 工程

因为前端里最常见的情况不是“文本内容每次都变”，而是：

- 内容相对稳定
- 容器宽度在变
- 布局策略在变
- 你要不断重新回答“这段文本此时会几行、多高”

这时候 `prepare -> layout` 是非常自然的边界。

如果你反过来，每次都重新 `prepare()`，那这套抽象的优势就会被你自己抵消掉。所以这也是后面“什么时候不适合用”的关键判断标准之一。

{% asset_img figure-03.svg %}

## 4. 先看源码地图：应该从哪些文件切入

这个仓库的源码入口非常清晰，主干基本都在 `src/` 下面：

- [src/layout.ts](https://github.com/chenglou/pretext/blob/main/src/layout.ts)：公开 API、核心数据结构、prepare/layout 编排
- [src/analysis.ts](https://github.com/chenglou/pretext/blob/main/src/analysis.ts)：文本分析、空白处理、分段规则、CJK/标点/soft hyphen 等语义
- [src/measurement.ts](https://github.com/chenglou/pretext/blob/main/src/measurement.ts)：canvas 测量、缓存、emoji 修正、浏览器 profile
- [src/line-break.ts](https://github.com/chenglou/pretext/blob/main/src/line-break.ts)：换行热路径
- [src/rich-inline.ts](https://github.com/chenglou/pretext/blob/main/src/rich-inline.ts)：行内富文本辅助层
- [src/bidi.ts](https://github.com/chenglou/pretext/blob/main/src/bidi.ts)：自定义渲染所需的简化 bidi（双向文本方向）元数据

如果只读一遍，我建议顺序是：

1. 先读 `layout.ts`，知道输入输出长什么样
1. 再读 `analysis.ts`，理解“文本会被准备成什么”
1. 然后读 `measurement.ts`，理解“宽度从哪里来”
1. 最后读 `line-break.ts`，理解热路径到底做了什么

## 5. 第一层：`analysis.ts` 把文本从字符串变成可布局的数据

如果把 Pretext 想成编译器，那 `analysis.ts` 就是前端编译阶段。

它做的不是“简单切词”，而是把原始字符串转换成一串更适合布局的 segment（内部测量和断行片段），并且给每个 segment 标出行为。

### 5.1 空白处理：先决定你在模拟哪种 CSS 语义

源码里首先区分了两种模式：

- `whiteSpace: 'normal'`
- `whiteSpace: 'pre-wrap'`

在 `normal` 下，逻辑接近浏览器的默认行为：

- 连续空白合并
- 首尾可折叠空白去掉
- 换行不保留成真实硬断行

在 `pre-wrap`（保留更多空格和换行的模式）下，则会保留：

- 普通空格
- `\n` 硬换行
- tab

这一步看起来基础，但它决定了后面整个数据流是否站在正确的语义模型上。

### 5.2 `Intl.Segmenter`：先借浏览器提供的语言工具

Pretext 没有从零开始自己写一套所有语言的分词器，而是直接利用 `Intl.Segmenter` 做：

- word 级分段
- grapheme（用户看到的字符单位）级分段

这是一个很现实的取舍：

- 先把平台已有的能力用起来
- 再在其上补浏览器排版需要的 glue rule 和边界修正

这也解释了为什么 Pretext 的多语言支持不是“手写一堆 if/else”，而是“平台分段 + 局部规则增强”。

### 5.3 Segment kind：它不是只有 text 和 space

源码里定义的 `SegmentBreakKind` 很值得关注：

- `text`
- `space`
- `preserved-space`
- `tab`
- `glue`
- `zero-width-break`
- `soft-hyphen`
- `hard-break`

这说明作者并不是简单地把文本切成“词 + 空格”，而是在准备阶段就把后续布局会遇到的语义差异显式编码进来了。

举几个例子：

- `soft-hyphen` 平时宽度是 `0`，但如果恰好在这里断行，行尾要补出一个可见的 `-`
- `hard-break` 不是普通宽度累加，而是强制结束当前行
- `preserved-space` 在 `pre-wrap` 下会真的占据可见宽度
- `zero-width-break` 允许断行，但自己不占可见宽度

这一步特别像“把 CSS 文本规则先编译成一套内部 IR”。

### 5.4 标点 glue 与 CJK 规则：真正有难度的地方在这里

Pretext 里有一大块逻辑都在做“哪些字符应该粘前面，哪些字符不能跑到行首/行尾”的处理。

这背后其实是在模拟浏览器文本布局里的几类现实规则：

- 英文标点往往应该和前一个词一起测量
- CJK 文本很多情况下可以按字断开
- 但某些标点不能出现在行首
- 某些开括号、引号不该挂在行尾

在源码里你能看到类似这些结构：

- `kinsokuStart`
- `kinsokuEnd`
- `leftStickyPunctuation`
- `endsWithClosingQuote`
- `canContinueKeepAllTextRun`

它们的意义不是为了“写得学术”，而是为了减少这种误差：

- 单独量字符宽度时看起来没问题
- 真到行边界时，却和浏览器换行结果差一位

这也是为什么 Pretext 的研究日志里会反复强调：**很多时候真正有效的优化不是更复杂的运行时修正，而是更正确的 prepare-time preprocessing。**

### 5.5 `keep-all`：不是简单禁止断词

`wordBreak: 'keep-all'`（尽量更保守地断行）也不是一句“不要拆词”能解释完的。

在 CJK/Hangul 场景里，它更像是：

- 尽量维持更大的连续 text run
- 但对于实在过长、无论如何都放不下的 run，仍然要保留 `overflow-wrap: break-word` 的退路

这也是为什么 `measureAnalysis()` 里还会判断：

- 这个 segment（内部片段）是否允许 overflow break
- 如果允许，是否要进一步准备 grapheme 级的 fit advance

换句话说，Pretext 不是在“绝对不拆”，而是在“尽量不拆，但仍保留兜底能力”。

## 6. 第二层：`measurement.ts` 用浏览器字体引擎，但绕开 DOM 布局树

Pretext 很聪明的一点，是它没有去和浏览器 font engine 对抗。

它并不尝试自己算字形宽度，而是直接调用浏览器已经会做的事：`canvas.measureText()`。

### 6.1 为什么 `canvas.measureText()` 是一个好支点

因为它同时满足两个条件：

- 它最终仍然依赖浏览器字体引擎
- 但它不要求把文本先塞进 DOM、等浏览器真的把 layout tree 跑一遍

这意味着它比纯 DOM 测量更轻，也比“自己拍脑袋估宽”更靠谱。

`measurement.ts` 里的 `getMeasureContext()` 会优先尝试：

- `OffscreenCanvas`
- 如果没有，再退回普通 DOM canvas

这也是它目前还偏浏览器环境的原因之一。

### 6.2 缓存的单位不是 paragraph，而是 `(font, segment)`

源码里最核心的缓存结构之一是：

```ts
Map<font, Map<segment, SegmentMetrics>>
```

也就是说，它缓存的是：

- 某个字体下
- 某个 segment（内部片段）的测量结果

而不是“某一整段话在某个宽度下的最终高度”。

这么做有几个好处：

- 相同词段可以跨多段文本复用
- `layout()` 阶段完全不必再测
- 只要文本和字体不变，宽度变化时无需重做测量

`SegmentMetrics` 也不只是 `width`，还会附带：

- `containsCJK`
- `emojiCount`
- `breakableFitAdvances`

这就为后面的换行热路径准备好了更细粒度的数据。

### 6.3 它不是盲信 canvas，源码里明显有一套“怀疑精神”

Pretext 很有意思的一点，是它虽然基于 `canvas.measureText()`，但并没有把 canvas 当绝对真理。

在 [RESEARCH.md](https://github.com/chenglou/pretext/blob/main/RESEARCH.md) 和 [src/measurement.ts](https://github.com/chenglou/pretext/blob/main/src/measurement.ts) 里，可以看到作者明确处理了几类偏差：

- macOS 上 `system-ui` 在 canvas 和 DOM 里的实际字体解析可能不一致
- Chrome/Firefox 小字号 emoji 的 canvas 宽度，可能比 DOM 宽
- Safari 和 Chromium 在某些 line-fit 边界上策略不同

这很关键，因为它说明这个库不是“数学上自洽就行”，而是始终拿浏览器实际行为做参照。

### 6.4 一个很值得讲的细节：emoji correction

仓库里专门有一套 emoji correction 逻辑，大意是：

- 先用 canvas 测一个 emoji 的宽度
- 如果发现它比期望的字体大小明显大
- 再在 DOM 里插一个隐藏 span，读一次真实宽度
- 算出 canvas 和 DOM 的差值
- 后续按 font 缓存这个 correction

这个细节很值得在分享里点出来，因为它揭示了一个事实：

**Pretext 宣称“脱离 DOM”，更准确地说是把 DOM 读从热路径里移出去了。**

对于某些字体和 emoji 场景，它仍然允许一次性的校准读。这个取舍我认为是合理的：

- 热路径里不要读 DOM
- 但为了一次性的精度校准，可以接受非常有限的 prepare-time fallback

这也是工程系统和教科书模型的区别。

### 6.5 `EngineProfile`：浏览器差异被显式建模了

`measurement.ts` 里还有一个特别有工程味的结构：`EngineProfile`。

里面包括：

- `lineFitEpsilon`
- `carryCJKAfterClosingQuote`
- `preferPrefixWidthsForBreakableRuns`
- `preferEarlySoftHyphenBreak`

这些开关说明 Pretext 并没有假设“Chrome/Safari/Firefox 本来就会完全一致”，而是把部分差异显式建模出来。

比如：

- Safari 的 line fit 允许误差不同
- Safari 更偏好 prefix width 策略
- Chromium 在某些 CJK closing quote 情况下要做额外处理

这让我对这个项目的评价更高，因为它没有停留在“理论上也许能对”，而是真的在针对浏览器差异做过系统验证。

### 6.6 为什么要准备 grapheme 级 fit advances

对于超长单词、URL、数字串这类 breakable run，光知道整段宽度还不够。

你还需要知道：

- 如果不得不拆开
- 每个 grapheme（一个个用户可见字符）逐步加进去时，累计宽度会怎么变化

仓库里针对这件事准备了几种策略：

- `sum-graphemes`
- `segment-prefixes`
- `pair-context`

它们本质上是在平衡三件事：

- prepare 阶段成本
- 局部上下文测量精度
- 对真实浏览器断行结果的贴近程度

这也是为什么 Pretext 的源码虽然整体不大，但读起来很有“实验归因”味道。很多实现不是从理论直接推出来的，而是从浏览器 sweep 和 corpus 验证里收敛出来的。

## 7. 第三层：`line-break.ts` 才是热路径真正的发动机

如果说 `analysis.ts` 和 `measurement.ts` 还带一点“复杂规则”的气质，那 `line-break.ts` 的目标就很明确：

**把一切能提前准备的东西都提前准备掉，让真正的换行阶段尽量只做线性扫描和加法。**

### 7.1 它消费的是并行数组，而不是高层对象树

在 `PreparedText` 里，你能看到很多并行数组：

- `widths`
- `lineEndFitAdvances`
- `lineEndPaintAdvances`
- `kinds`
- `breakableFitAdvances`
- `chunks`

这套设计说明作者优先考虑的是：

- 热路径局部性
- 线性扫描
- 减少对象分配

而不是“让内部结构看起来像一个很优雅的 AST”。

### 7.2 它不是全局最优排版，而是高吞吐 greedy layout

Pretext 的 line breaking 核心是 greedy 的：

- 从当前行起点往后累加
- 下一个 segment 如果还能放下，就继续放
- 放不下时，在最近的合法 break 点断行

这意味着它追求的不是 TeX/Knuth-Plass 那种全局最优美观断行，而是：

- 快
- 稳定
- 可复现
- 足够接近浏览器默认行为

对于 Web UI 场景，这其实是更合理的目标。

### 7.3 行尾 fit 和 paint 被拆开，是个很妙的设计

`lineEndFitAdvances` 和 `lineEndPaintAdvances` 这两个数组很值得专门提一下。

它们的存在，本质上是在区分两个问题：

- 某个东西在“决定这一行还能不能再放内容”时，应不应该算进 fit
- 某个东西在“这一行最终画出来”时，应不应该算进 paint

这可以很好地表达几类浏览器行为：

- 普通可折叠空格在行尾可以 hanging（存在，但不应强行主导行宽判断），不应成为导致提前换行的主因
- `pre-wrap` 下保留空格时，paint 语义又会变
- soft hyphen 只有真正断在这里时才会体现在行尾

这类设计说明作者不是只在“段落宽度总和”这个层面想问题，而是在逼近浏览器实际 line edge 行为。

### 7.4 超长词、tab、hard break 都在热路径里有明确分支

在 `line-break.ts` 中可以看到几类特殊处理：

- 超长 breakable segment：按 grapheme fit advance 一步步尝试
- soft hyphen：如果断点落在这里，额外加上可见连字符宽度
- tab：根据 `tabStopAdvance` 跳到下一个 tab stop
- hard break：直接结束当前行并切到下一行
- line start normalization：新行开头要跳过某些不应出现在行首的 segment

这部分逻辑的重点不是“功能多”，而是：

**这些复杂性已经被前面 prepare 好了，所以热路径只是在消费结果。**

### 7.5 `chunks` 的存在不是装饰，是为 `pre-wrap` 和长文本服务

Pretext 在 prepare 阶段会把 analysis 里的 chunk 信息映射到 prepared chunk。

这在 `pre-wrap`、大量 hard break、长文本场景下很有意义，因为它可以：

- 限制每次 line walk 的搜索范围
- 减少无意义扫描
- 让“从某个 cursor 继续往后排”更快

这也说明作者不是只盯着简单 paragraph，而是考虑过真实大文本和编辑器式场景。

## 8. `layout.ts` 暴露的能力，其实远不止“算一个高度”

很多人第一次看 README，只会记住：

- `prepare()`
- `layout()`

但如果继续往下读 API，你会发现它其实暴露了一整套不同层级的能力。

### 8.1 从高层到低层的 API 梯度很完整

高层 API：

- `prepare()`
- `layout()`
- `prepareWithSegments()`
- `layoutWithLines()`

中层 API：

- `measureLineStats()`
- `walkLineRanges()`

低层 API：

- `layoutNextLineRange()`
- `layoutNextLine()`
- `materializeLineRange()`

这个梯度很实用，因为不同业务的目标完全不同：

- 有的只要高度
- 有的只要 line count 和 max line width
- 有的只想先遍历 line range，最后再决定要不要 materialize string
- 有的要边走边画，每一行宽度都可能不一样

### 8.2 `LayoutCursor` 非常值得注意

Pretext 的 cursor 不是原始字符串 offset，而是：

- `segmentIndex`
- `graphemeIndex`

这说明它内部已经不再把“原始字符串的第几个字符”当作稳定单位，而是把布局过程建立在更贴近渲染语义的 segment/grapheme 粒度上。

这对这些场景很重要：

- 一行一行流式布局
- 文字绕图
- 富文本片段跟踪
- 自定义渲染器需要知道上一行结束到哪里

### 8.3 `measureNaturalWidth()` 是个很有产品感的 API

这个 API 的价值在于回答：

**如果不是容器宽度逼着它换行，这段文本自然最宽会有多宽？**

这类能力很适合：

- shrink-wrap
- “找到最紧的容器宽度”
- 自动平衡几列宽度
- 聊天气泡、卡片宽度自适应

这也是 Pretext 很有意思的一点：它并不是只服务一个“文本高度测量”用例，而是在往“用户态排版积木”方向生长。

## 9. `rich-inline.ts` 说明它很清楚自己的边界

`rich-inline` 是我很喜欢的一个设计点，因为它不是“越做越大”，而是“明确收窄”。

它解决的是这样一类问题：

- 行内 rich text
- mention / chip / code span
- 每个 item 字体不同
- 某些 item 必须整体不拆开
- item 之间仍然要保留类似浏览器的 boundary whitespace collapse

它支持的关键能力包括：

- `break: 'never'`，让某个 inline item 变成原子块
- `extraWidth`，把 padding/border 这类 UI chrome 的宽度算进 occupied width
- `gapBefore`，表达边界空白折叠后的间隙

但它又非常明确地不做这些事：

- 不接受任意嵌套 markup tree
- 不试图变成完整的 CSS inline formatting engine
- 只支持 `white-space: normal`

这恰恰是我认为它设计成熟的地方。

很多库是因为边界不清最后失控；Pretext 的做法则是：

- 把最常见、最有价值的一小块问题切出来
- 给你足够的低层数据
- 但拒绝宣称“我能替代浏览器完整富文本布局”

## 10. 它怎么处理 bidi 和“自定义渲染不是完整字体排版”这个现实

Pretext 里有一个很重要但容易被忽略的信号：

- `PreparedTextWithSegments` 会带 `segLevels`
- 但换行 API 自己并不读取它

这说明库的定位是：

- 帮你把文本断成正确的行
- 帮你保留足够的 bidi 元数据供自定义渲染参考
- 但并不直接承担“精确 glyph positioning”这一层责任

README 里也明确提醒了这一点：segment width 主要用于 line breaking，不等于完整字形定位数据。

这意味着如果你的诉求是：

- 精确 caret
- selection
- 光标 x 坐标
- 阿拉伯文或混合方向文本的精确 glyph 级 hit testing

那你要的就已经不是 Pretext 这类库，而是更靠近完整文本引擎的能力了。

## 11. 这个仓库最有说服力的地方：它不仅有实现，还有验证体系

如果一个排版库只给你一堆 demo，我通常不会太信。

Pretext 的可信度，恰恰来自它把“验证系统”也当作仓库主角之一。

### 11.1 不只有单元测试，还有浏览器 sweep

仓库里有一整套命令：

- `accuracy-check`
- `benchmark-check`
- `corpus-check`
- `corpus-sweep`
- `corpus-font-matrix`

这说明作者在验证三件不同的事：

- 是否和浏览器换行一致
- 是否真的比 DOM 热路径更适合高频重排
- 在真实语言长文本上会不会暴露边界问题

### 11.2 当前 snapshot 的一个重要结论

根据仓库里的 [status/dashboard.json](https://github.com/chenglou/pretext/blob/main/status/dashboard.json)，当前这份快照生成于 `2026-04-09`，主浏览器 accuracy sweep 的结果是：

- Chrome：`7680 / 7680` 匹配
- Safari：`7680 / 7680` 匹配
- Firefox：`7680 / 7680` 匹配

这个数字的意义不是“从此绝对不会错”，而是：

- 它已经把一个固定规模的跨浏览器 regression gate 建起来了
- 新改动不只是跑 demo，而是要过同一批样本

### 11.3 benchmark 的解读要非常小心

同一份 dashboard 里，Chrome 的部分 benchmark 大致是：

- `prepare()`：500 段文本冷启动约 `19.4ms`
- `layout()`：500 段文本热路径约 `0.146ms`
- DOM batch：一次 400 -> 300px 的 batched resize 约 `3.75ms`
- DOM interleaved：一次同规模的 write/read 交错 resize 约 `41.75ms`

这组数字特别适合拿来解释一个容易被误解的点：

**Pretext 不是“任何场景都比 DOM 快”。**

更准确地说，它最擅长优化的是：

- prepare 一次
- 后续多次 relayout
- 尽量避免 DOM interleaved 读写

如果你本来就能把 DOM 写和读很好地批处理，单次测量未必一定输给 Pretext。

但如果你的真实问题是：

- 多组件独立测量
- 高频 resize
- 大量文本块
- 很难保证不发生 layout thrash

那 Pretext 的优势就会变得很明显。

### 11.4 corpus 是这个项目最“像研究”的部分

仓库里维护了很多语言的长文本 canary，包括：

- Japanese
- Chinese
- Thai
- Khmer
- Myanmar
- Arabic
- Urdu
- mixed app text

这点非常重要，因为很多文本布局问题不会在十几个 toy case 里暴露，而会在：

- 真实小说段落
- 产品混合文本
- URL、数字串、引号、emoji 混排
- 细小宽度变化的 sweep

这些语料说明作者已经意识到：**排版精度的敌人不是简单 case，而是长文本、真语言和边界宽度。**

## 12. 那么，Pretext 什么时候适合用

我会把“适合用”的判断标准总结成一句话：

**当你面对的是“同一批文本需要反复重排”，而 DOM 测量已经开始成为瓶颈时，Pretext 很值得考虑。**

### 12.1 适合场景一：频繁 resize 下的大量文本重排

例如：

- 聊天列表
- 评论流
- 可拖拽宽度的侧栏和面板
- Masonry / 卡片流
- JS 驱动的响应式布局

这些场景里，文本内容往往相对稳定，但容器宽度经常变化，特别适合 `prepare()` 一次、`layout()` 多次。

### 12.2 适合场景二：你需要“先知道高度”，再决定怎么渲染

例如：

- 虚拟列表提前估算 item 高度
- 避免文本加载后导致 layout shift
- 需要保持 scroll anchor
- 在没有真实 DOM 元素时，先算出布局结果

这类需求本来很容易把你逼回 DOM 读；Pretext 的价值就在于给你一个替代方案。

### 12.3 适合场景三：Canvas / SVG / WebGL / 自绘编辑器

如果最终渲染介质不是 DOM，本来就没有 `getBoundingClientRect()` 这条路可走。

这时 Pretext 提供的：

- `layoutWithLines()`
- `walkLineRanges()`
- `layoutNextLineRange()`

就会很自然。

### 12.4 适合场景四：你想做“浏览器没有直接给你”的排版能力

比如：

- 多行 shrink-wrap
- 绕图排版
- 动态列宽探索
- 平衡文本宽度
- 某些更实验性的 userland layout

浏览器本身的 CSS 能力未必直接覆盖这些需求，而 Pretext 给的是一套更低层、更可组合的积木。

### 12.5 适合场景五：开发阶段做布局校验

README 里提到一个我觉得很实用的点：可以在开发或验证阶段，检查按钮文案、标签文案是否会溢出到下一行。

这类场景不一定是线上核心路径，但很适合用这类库做自动验证或预检查。

## 13. 什么时候不适合用

和“适合用”同样重要的，是明确它的非目标。

### 13.1 不适合场景一：普通 DOM 文本，数量不大，也没有性能瓶颈

如果你的页面只是几十个普通文本节点，布局也不频繁变化，那最简单、最稳定的方案仍然是：

- 直接交给浏览器布局
- 不要引入额外复杂度

Pretext 不是“默认就该上”的基础库，而是当你确实遇到文本测量瓶颈时的工程解法。

### 13.2 不适合场景二：文本内容本身高频变化，导致你总得重新 `prepare()`

Pretext 最大的收益建立在：

- 文本不怎么变
- 宽度常常变

如果你的场景是：

- 每个 keypress 都会改动超大量文本
- 每次都必须重做 prepare

那它的收益会明显下降，是否值得就要重新评估。

当然，像 textarea 风格的 `pre-wrap` 文本输入，Pretext 仍然支持；只是你要清楚 prepare 成本此时就会重新进入核心路径。

### 13.3 不适合场景三：你需要完整的 CSS inline formatting engine

Pretext 当前支持的重点是：

- `white-space: normal`
- `pre-wrap`
- `word-break: normal`
- `keep-all`
- `overflow-wrap: break-word` 风格的长词兜底

但如果你要的是：

- 完整 justification
- 更复杂的 `line-break` 规则
- 任意嵌套富文本树
- 完整 inline box model
- selection / caret / hit testing

那它就不是这类系统。

### 13.4 不适合场景四：你强依赖精确 glyph positioning

Pretext 的 segment width 足以支持 line breaking，但并不等于完整字形级定位数据。

如果需求是：

- 逐字点击检测
- 复杂脚本中的精确 x 坐标还原
- 编辑器级 selection/caret

你需要的是更底层、更完整的文本引擎。

### 13.5 不适合场景五：你必须完全依赖 `system-ui` 并要求极高精度

仓库研究日志明确提到，macOS 上 `system-ui` 在 canvas 和 DOM 的解析可能落到不同 optical variant。

这意味着：

- 如果精度要求高
- 你又必须使用 `system-ui`

那要格外谨慎。更稳妥的做法是显式使用命名字体。

### 13.6 不适合场景六：你把它当成熟的通用服务端排版引擎

README 里虽然提到未来会支持 server-side，但当前主路径依旧依赖：

- `OffscreenCanvas`
- 或 DOM canvas context

所以今天更准确的理解仍然是：

- 它首先是浏览器环境友好的文本测量与布局库
- 不是已经完全成熟的通用服务端排版方案

## 14. 我从这个仓库里学到的几个工程经验

### 14.1 真正好的抽象，通常先把“什么不做”说清楚

Pretext 的边界感非常强：

- 不做完整浏览器排版
- 不做完整富文本树
- 不把 glyph positioning 包装成自己已经解决的问题

这种克制反而让它在目标问题上更可靠。

### 14.2 性能优化不是“让某个 API 更快”，而是改变数据流

Pretext 的核心提升并不是把 `getBoundingClientRect()` 优化掉了，而是：

- 让布局计算尽量不依赖 DOM
- 把测量从“每次布局都做”改成“prepare 时一次性做”
- 把热路径改造成纯算术

这本质上是数据流重构，不是局部 micro-optimization。

### 14.3 真正难的不是算法，而是边界语义

读这个仓库最大的感受之一就是：

- 英文空格断词其实不难
- 难的是 CJK、RTL、emoji、软连字符、引号、混合文本、浏览器差异

而这些东西又不能只靠“我觉得应该这样”来处理，只能靠大量验证收敛。

### 14.4 一个排版库如果没有 corpus 和回归门禁，很难长期可信

Pretext 把：

- browser accuracy sweep
- benchmark snapshot
- long-form corpus canary

都做成了仓库内的一等公民。这一点我非常认同。

对这类系统来说，“我今天这 20 个 demo 看起来没问题”几乎没有意义。真正有价值的是：

- 改完还能不能过同一套验证
- 长文本和不同语言会不会退化
- 浏览器差异有没有被重新引入

## 15. 总结

如果只用一句话总结 Pretext，我会这么说：

**它不是另一个文本组件库，而是一套把“文本布局”从 DOM 热路径里拆出来的工程化方案。**

它最值得关注的，不只是 API 好不好用，而是它背后的设计原则：

- 用浏览器字体引擎做测量依据，而不是自己造字体世界
- 把 prepare 和 layout 明确拆开
- 把热路径压缩成纯算术
- 用真实浏览器和真实语料来约束实现
- 对能力边界保持克制

所以如果你的问题是：

- 为什么我的文本测量会拖慢页面
- 怎样避免 `getBoundingClientRect()` 之类的同步布局成本
- 如何在不依赖 DOM 的前提下得到接近浏览器的多语言换行结果

那 Pretext 是一个非常值得研究的仓库。

但如果你的问题已经变成：

- 完整富文本排版
- 精确字形定位
- 编辑器级光标和选择

那它就不该被拿来承担那个层级的职责。

我觉得这正是一个优秀工程项目最有价值的地方：**它不试图解决一切，但把自己真正要解决的问题，拆得非常对。**

## 参考资料

- [chenglou/pretext](https://github.com/chenglou/pretext)
- [README.md](https://github.com/chenglou/pretext/blob/main/README.md)
- [src/layout.ts](https://github.com/chenglou/pretext/blob/main/src/layout.ts)
- [src/analysis.ts](https://github.com/chenglou/pretext/blob/main/src/analysis.ts)
- [src/measurement.ts](https://github.com/chenglou/pretext/blob/main/src/measurement.ts)
- [src/line-break.ts](https://github.com/chenglou/pretext/blob/main/src/line-break.ts)
- [src/rich-inline.ts](https://github.com/chenglou/pretext/blob/main/src/rich-inline.ts)
- [RESEARCH.md](https://github.com/chenglou/pretext/blob/main/RESEARCH.md)
- [STATUS.md](https://github.com/chenglou/pretext/blob/main/STATUS.md)
- [corpora/STATUS.md](https://github.com/chenglou/pretext/blob/main/corpora/STATUS.md)
