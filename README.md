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

接下来都将以其为例来分析。下面来看一个简略的 `MVVM` 的实现，在此将其命名为 `hue`。为了方便起见，为 `data` 属性设置了一个代理，通过 `vm._data` 来访问 `data` 的属性显得麻烦且冗余，通过代理，可以很好地解决这个问题，在注释中也有说明。添加完属性代理后，调用了一个 `observe` 函数，这一步做的就是 `Observer` 的属性劫持了，这一步具体怎么实现，暂时先不展开。先记住他为 `data` 的属性添加了 `getter` 和 `setter`。再往下看，`new` 了一个 `Compile`，下面我们就来讲讲 `Compile`。

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
// 访问 vm.data 会触发 vm._data 的getter，取得 vm._data 的值，
// 为 vm.data 赋值则会触发 vm._data 的setter
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

正如代码中所看到的，`Compile` 在解析到 `{{xxx}}` 后便添加了 `xxx` 属性的订阅，即 `new Watcher(vm, exp, callback)`。理解了这一步后，接下来就需要了解怎么实现相关属性的订阅了。

<!-- ## Observer & Dep

从最简单的情况来考虑，即不考虑数组元素的变化。首先需要了解的知识是 `Object.defineProperty` 这个方法，通过该方法给所有属性添加 `getter` 和 `setter`，就达到了我们的目的。属性有可能也是对象，因此需要对属性值进行递归调用。下面来看看具体代码：

```javascript
function Observer(data) {
    this.data = data;
    this.walk(data);
}

Observer.prototype.walk = function(data) {
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
        defineReactive(data, keys[i], data[keys[i]]);
    }
};

function defineReactive(obj, key, val) {
    let childObj = observe(val);

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
        }
    });
}

function observe(val) {
    if (!Array.isArray(val) && typeof val === "object") {
        return new Observer(val);
    }
}

``` -->
