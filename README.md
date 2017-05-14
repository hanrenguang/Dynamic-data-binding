# vue.js动态数据双向绑定学习

对于`vue.js`的动态数据绑定，经过反复地看源码和博客讲解，总算能够理解它的实现了，心累~ 分享一下学习成果，同时也算是做个记录。

## 整体思路

不知道有没有同学和我一样，看着`vue`的源码却不知从何开始，真叫人头大。硬生生地看了`observer`, `watcher`, `compile`这几部分的源码，只觉得一脸懵逼。最终，从[这里](https://github.com/DMQ/mvvm)得到启发，作者写得很好，值得一读。

关于动态数据绑定呢，需要搞定的是 `Dep` , `Observer` , `Watcher` , `Compile` 这几个类，他们之间有着各种联系，想要搞懂源码，就得先了解他们之间的联系。下面来理一理：

- `Observer` 所做的就是劫持监听所有属性，当有变动时通知 `Dep`  
- `Watcher` 向 `Dep` 添加订阅，同时，属性有变化时，`Observer` 通知 `Dep`，`Dep` 则通知 `Watcher`  
- `Watcher` 得到通知后，调用回调函数更新视图  
- `Compile` 则是解析所绑定元素的 `DOM` 结构，对所有需要绑定的属性添加 `Watcher` 订阅  

由此可以看出，当属性发生变化时，是由`Observer` -> `Dep` -> `Watcher` -> `update view`，`Compile` 在最开始解析 `DOM` 并添加 `Watcher` 订阅后就功成身退了。

从程序执行的顺序来看的话，即 `new Vue({})` 之后，应该是这样的：先通过 `Observer` 劫持所有属性，然后 `Compile` 解析 `DOM` 结构，并添加 `Watcher` 订阅，再之后就是属性变化 -> `Observer` -> `Dep` -> `Watcher` -> `update view`，接下来就说说具体的实现。

## Observer & Dep
