# vue.js动态数据绑定学习

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

## 从new一个实例开始谈起

网上的很多源码解读都是从 `Observer` 开始的，而我会从 `new` 一个MVVM实例开始，按照程序执行顺序去解释或许更容易理解。先来看一个简单的例子：

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>test</title>
</head>
<body>
    <div class="test">
        <p>{{user.name}}</p>
        <p>{{user.age}}</p>
    </div>

    <script type="text/javascript" src="hue.js"></script>
    <script type="text/javascript">
        let vm = new Hue({
            el: '.test',
            data: {
                user: {
                    name: 'Jack',
                    age: '18'
                }
            }
        });
    </script>
</body>
</html>
```

接下来都将以其为例来分析。下面来看一个简略的 `MVVM` 的实现，在此将其命名为 `hue`。为了方便起见，为 `data` 属性设置了一个代理，通过 `vm._data` 来访问 `data` 的属性显得麻烦且冗余，通过代理，可以很好地解决这个问题，在注释中也有说明。添加完属性代理后，调用了一个 `observe` 函数，这一步做的就是 `Observer` 的属性劫持了，这一步具体怎么实现，暂时先不展开。先记住他为 `data` 的属性添加了 `getter` 和 `setter`。

```javascript
function Hue(options) {
    this.$options = options || {};
    let data = this._data = this.$options.data,
        self = this;

    Object.keys(data).forEach(function(key) {
        self._proxyData(key);
    });

    observe(data);

    self.$compile = new Compile(self, options.el || document.body);
}

// 为 data 做了一个代理，
// 访问 vm.xxx 会触发 vm._data[xxx] 的getter，取得 vm._data[xxx] 的值，
// 为 vm.xxx 赋值则会触发 vm._data[xxx] 的setter
Hue.prototype._proxyData = function(key) {
    let self = this;
    Object.defineProperty(self, key, {
        configurable: false,
        enumerable: true,
        get: function proxyGetter() {
            return self._data[key];
        },
        set: function proxySetter(newVal) {
            self._data[key] = newVal;
        }
    });
};
```

再往下看，最后一步 `new` 了一个 `Compile`，下面我们就来讲讲 `Compile`。

## Compile

`new Compile(self, options.el || document.body)` 这一行代码中，第一个参数是当前 `Hue` 实例，第二个参数是绑定的元素，在上面的示例中为class为 `.test` 的div。

关于 `Compile`，这里只实现最简单的 `textContent` 的绑定。而 `Compile` 的代码没什么难点，很轻易就能读懂，所做的就是解析 `DOM`，并添加 `Watcher` 订阅。关于 `DOM` 的解析，先将根节点 `el` 转换成文档碎片 `fragment` 进行解析编译操作，解析完成后，再将 `fragment` 添加回原来的真实 `DOM` 节点中。来看看这部分的代码：

```javascript
function Compile(vm, el) {
    this.$vm = vm;
    this.$el = this.isElementNode(el)
        ? el
        : document.querySelector(el);

    if (this.$el) {
        this.$fragment = this.node2Fragment(this.$el);
        this.init();
        this.$el.appendChild(this.$fragment);
    }
}

Compile.prototype.node2Fragment = function(el) {
    let fragment = document.createDocumentFragment(),
        child;

    // 也许有同学不太理解这一步，不妨动手写个小例子观察一下他的行为
    while (child = el.firstChild) {
        fragment.appendChild(child);
    }

    return fragment;
};

Compile.prototype.init = function() {
    // 解析 fragment
    this.compileElement(this.$fragment);
};
```

以上面示例为例，此时若打印出 `fragment`，可观察到其包含两个p元素：

```html
<p>{{user.name}}</p>
<p>{{user.age}}</p>
```

下一步就是解析 `fragment`，直接看代码及注释吧：

```javascript
Compile.prototype.compileElement = function(el) {
    let childNodes = Array.from(el.childNodes),
        self = this;

    childNodes.forEach(function(node) {
        let text = node.textContent,
            reg = /\{\{(.*)\}\}/;

        // 若为 textNode 元素，且匹配 reg 正则
        // 在上例中会匹配 '{{user.name}}' 及 '{{user.age}}'
        if (self.isTextNode(node) && reg.test(text)) {
            // 解析 textContent，RegExp.$1 为匹配到的内容，在上例中为 'user.name' 及 'user.age'
            self.compileText(node, RegExp.$1);
        }

        // 递归
        if (node.childNodes && node.childNodes.length) {
            self.compileElement(node);
        }
    });
};

Compile.prototype.compileText = function(node, exp) {
    // this.$vm 即为 Hue 实例，exp 为正则匹配到的内容，即 'user.name' 或 'user.age'
    compileUtil.text(node, this.$vm, exp);
};

let compileUtil = {
    text: function(node, vm, exp) {
        this.bind(node, vm, exp, 'text');
    },

    bind: function(node, vm, exp, dir) {
        // 获取更新视图的回调函数
        let updaterFn = updater[dir + 'Updater'];

        // 先调用一次 updaterFn，更新视图
        updaterFn && updaterFn(node, this._getVMVal(vm, exp));

        // 添加 Watcher 订阅
        new Watcher(vm, exp, function(value, oldValue) {
            updaterFn && updaterFn(node, value, oldValue);
        });
    },

    // 根据 exp，获得其值，在上例中即 'vm.user.name' 或 'vm.user.age'
    _getVMVal: function(vm, exp) {
        let val = vm;
        exp = exp.trim().split('.');
        exp.forEach(function(k) {
            val = val[k];
        });
        return val;
    }
};

let updater = {
    // Watcher 订阅的回调函数
    // 在此即更新 node.textContent，即 update view
    textUpdater: function(node, value) {
        node.textContent = typeof value === 'undefined'
            ? ''
            : value;
    }
};
```

正如代码中所看到的，`Compile` 在解析到 `{{xxx}}` 后便添加了 `xxx` 属性的订阅，即 `new Watcher(vm, exp, callback)`。理解了这一步后，接下来就需要了解怎么实现相关属性的订阅了。先从 `Observer` 开始谈起。

## Observer

从最简单的情况来考虑，即不考虑数组元素的变化。暂时先不考虑 `Dep` 与 `Observer` 的联系。先看看 `Observer` 构造函数：

```javascript
function Observer(data) {
    this.data = data;
    this.walk(data);
}

Observer.prototype.walk = function(data) {
    const keys = Object.keys(data);
    // 遍历 data 的所有属性
    for (let i = 0; i < keys.length; i++) {
        // 调用 defineReactive 添加 getter 和 setter
        defineReactive(data, keys[i], data[keys[i]]);
    }
};
```

接下来通过 `Object.defineProperty` 方法给所有属性添加 `getter` 和 `setter`，就达到了我们的目的。属性有可能也是对象，因此需要对属性值进行递归调用。

```javascript
function defineReactive(obj, key, val) {
    // 对属性值递归，对应属性值为对象的情况
    let childObj = observe(val);

    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function() {
            // 直接返回属性值
            return val;
        },
        set: function(newVal) {
            if (newVal === val) {
                return;
            }
            // 值发生变化时修改闭包中的 val，
            // 保证在触发 getter 时返回正确的值
            val = newVal;

            // 对新赋的值进行递归，防止赋的值为对象的情况
            childObj = observe(newVal);
        }
    });
}
```

最后补充上 `observe` 函数，也即 `Hue` 构造函数中调用的 `observe` 函数：

```javascript
function observe(val) {
    // 若 val 是对象且非数组，则 new 一个 Observer 实例，val 作为参数
    // 简单点说：是对象就继续。
    if (!Array.isArray(val) && typeof val === "object") {
        return new Observer(val);
    }
}
```

这样一来就对 `data` 的所有子孙属性（不知有没有这种说法。。）都进行了“劫持”。显然到目前为止，这并没什么用，或者说如果只做到这里，那么和什么都不做没差别。于是 `Dep` 上场了。我认为理解 `Dep` 与 `Observer` 和 `Watcher` 之间的联系是最重要的，先来谈谈 `Dep` 在 `Observer` 里做了什么。

## Observer & Dep

在每一次 `defineReactive` 函数被调用之后，都会在闭包中新建一个 `Dep` 实例，即 `let dep = new Dep()`。`Dep` 提供了一些方法，先来说说 `notify` 这个方法，它做了什么事？就是在属性值发生变化的时候通知 `Dep`，那么我们的代码可以增加如下：

```javascript
function defineReactive(obj, key, val) {
    let childObj = observe(val);
    const dep = new Dep();

    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function() {
            return val;
        },
        set: function(newVal) {
            if (newVal === val) {
                return;
            }

            val = newVal;
            childObj = observe(newVal);

            // 发生变动
            dep.notify();
        }
    });
}
```

如果仅考虑 `Observer` 与 `Dep` 的联系，即有变动时通知 `Dep`，那么这里就算完了，然而在 `vue.js` 的源码中，我们还可以看到一段增加在 `getter` 中的代码：

```javascript
// ...
get: function() {
    if (Dep.target) {
        dep.depend();
    }
    return val;
}
// ...
```

这个 `depend` 方法呢，它又做了啥？答案是为闭包中的 `Dep` 实例添加了一个 `Watcher` 的订阅，而 `Dep.target` 又是啥？他其实是一个 `Watcher` 实例，？？？一脸懵逼，先记住就好，先看一部份的 `Dep` 源码：

```javascript
// 标识符，在 Watcher 中有用到，先不用管
let uid = 0;

function Dep() {
    this.id = uid++;
    this.subs = [];
}

Dep.prototype.depend = function() {
    // 这一步相当于做了这么一件事：this.subs.push(Dep.target)
    // 即添加了 Watcher 订阅，addDep 是 Watcher 的方法
    Dep.target.addDep(this);
};

// 通知更新
Dep.prototype.notify = function() {
    // this.subs 的每一项都为一个 Watcher 实例
    this.subs.forEach(function(sub) {
        // update 为 Watcher 的一个方法，更新视图
        // 没错，实际上这个方法最终会调用到 Compile 中的 updaterFn，
        // 也即 new Watcher(vm, exp, callback) 中的 callback
        sub.update();
    });
};

// 在 Watcher 中调用
Dep.prototype.addSub = function(sub) {
    this.subs.push(sub);
};

// 初始时引用为空
Dep.target = null;
```

也许看到这还是一脸懵逼，没关系，接着往下。大概有同学会疑惑，为什么要把添加 `Watcher` 订阅放在 `getter` 中，接下来我们来说说这 `Watcher` 和 `Dep` 的故事。

## Watcher & Dep

先让我们回顾一下 `Compile` 做的事，解析 `fragment`，然后给相应属性添加订阅：`new Watcher(vm, exp, cb)`。`new` 了这个 `Watcher` 之后，`Watcher` 怎么办呢，就有了下面这样的对话：

Watcher：hey `Dep`，我需要订阅 `exp` 属性的变动。

Dep：这我可做不到，你得去找 `exp` 属性中的 `dep`，他能做到这件事。

Watcher：可是他在闭包中啊，我无法和他联系。

Dep：你拿到了整个 `Hue` 实例 `vm`，又知道属性 `exp`，你可以触发他的 `getter` 啊，你在 `getter` 里动些手脚不就行了。

Watcher：有道理，可是我得让 `dep` 知道是我订阅的啊，不然他通知不到我。

Dep：这个简单，我帮你，你每次触发 `getter` 前，把你的引用告诉 `Dep.target` 就行了。记得办完事后给 `Dep.target` 置空。

于是就有了上面 `getter` 中的代码：

```javascript
// ...
get: function() {
    // 是否是 Watcher 触发的
    if (Dep.target) {
        // 是就添加进来
        dep.depend();
    }
    return val;
}
// ...
```

现在再回头看看 `Dep` 部分的代码，是不是好理解些了。如此一来， `Watcher` 需要做的事情就简单明了了：

```javascript
function Watcher(vm, exp, cb) {
    this.$vm = vm;
    this.cb = cb;
    this.exp = exp;
    this.depIds = new Set();

    // 返回一个用于获取相应属性值的函数
    this.getter = parseGetter(exp.trim());

    // 调用 get 方法，触发 getter
    this.value = this.get();
}

Watcher.prototype.get = function() {
    const vm = this.$vm;
    // 将 Dep.target 指向当前 Watcher 实例
    Dep.target = this;
    // 触发 getter
    let value = this.getter.call(vm, vm);
    // Dep.target 置空
    Dep.target = null;
    return value;
};

Watcher.prototype.addDep = function(dep) {
    const id = dep.id;
    if (!this.depIds.has(id)) {
        // 添加订阅，相当于 dep.subs.push(this)
        dep.addSub(this);
        this.depIds.add(id);
    }
};

function parseGetter(exp) {
    if (/[^\w.$]/.test(exp)) {
        return;
    }

    let exps = exp.split(".");

    return function(obj) {
        for (let i = 0; i < exps.length; i++) {
            if (!obj)
                return;
            obj = obj[exps[i]];
        }
        return obj;
    };
}
```

最后还差一部分，即 `Dep` 通知变化后，`Watcher` 的处理，具体的函数调用流程是这样的：`dep.notify()` -> `sub.update()`，直接上代码：

```javascript
Watcher.prototype.update = function() {
    this.run();
};

Watcher.prototype.run = function() {
    let value = this.get();
    let oldVal = this.value;

    if (value !== oldVal) {
        this.value = value;
        // 调用回调函数更新视图
        this.cb.call(this.$vm, value, oldVal);
    }
};
```

## 结语

到这就算写完了，本人水平有限，若有不足之处欢迎指出，一起探讨。

## 参考资料

[https://github.com/DMQ/mvvm](https://github.com/DMQ/mvvm)
