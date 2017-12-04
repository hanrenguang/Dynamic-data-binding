// dep
let uid = 0;

function Dep() {
    this.id = uid++;
    this.subs = [];
}

Dep.prototype.addSub = function(sub) {
    this.subs.push(sub);
};

Dep.prototype.removeSub = function(sub) {
    let idx = this.subs.indexOf(sub);
    idx !== -1
        ? this.subs.splice(idx, 1)
        : void 0;
};

Dep.prototype.depend = function() {
    Dep.target.addDep(this);
};

Dep.prototype.notify = function() {
    this.subs.forEach(function(sub) {
        sub.update();
    });
};

Dep.target = null;

// observer
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
    const dep = new Dep();

    let childObj = observe(val);

    Object.defineProperty(obj, key, {
        enumerable: true,
        configurable: true,
        get: function() {
            if (Dep.target) {
                dep.depend();
            }

            return val;
        },
        set: function(newVal) {
            if (newVal === val) {
                return;
            }

            val = newVal;
            childObj = observe(newVal);
            dep.notify();
        }
    });
}

function observe(val) {
    if (!Array.isArray(val) && typeof val === "object") {
        return new Observer(val);
    }
}

// Watcher
function Watcher(vm, expOrFn, cb) {
    this.$vm = vm;
    this.cb = cb;
    this.expOrFn = expOrFn;
    this.depIds = new Set();

    if (typeof expOrFn === "function") {
        this.getter = expOrFn;
    } else {
        this.getter = parseGetter(expOrFn.trim());
    }

    this.value = this.get();
}

Watcher.prototype.get = function() {
    const vm = this.$vm;
    Dep.target = this;
    let value = this.getter.call(vm, vm);
    Dep.target = null;
    return value;
};

Watcher.prototype.addDep = function(dep) {
    const id = dep.id;
    if (!this.depIds.has(id)) {
        dep.addSub(this);
        this.depIds.add(id);
    }
};

Watcher.prototype.update = function() {
    this.run();
};

Watcher.prototype.run = function() {
    let value = this.get();
    let oldVal = this.value;

    if (value !== oldVal) {
        this.value = value;
        this.cb.call(this.$vm, value, oldVal);
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

// compile
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

    while (child = el.firstChild) {
        fragment.appendChild(child);
    }

    return fragment;
};

Compile.prototype.init = function() {
    this.compileElement(this.$fragment);
};

Compile.prototype.compileElement = function(el) {
    let childNodes = Array.from(el.childNodes),
        self = this;

    childNodes.forEach(function(node) {
        let text = node.textContent,
            reg = /\{\{(.*)\}\}/;

        if (self.isElementNode(node)) {
            self.compile(node);
        } else if (self.isTextNode(node) && reg.test(text)) {
            self.compileText(node, RegExp.$1);
        }

        if (node.childNodes && node.childNodes.length) {
            self.compileElement(node);
        }
    });
};

Compile.prototype.compile = function(node) {
    // pass
};

Compile.prototype.compileText = function(node, exp) {
    compileUtil.text(node, this.$vm, exp);
};

Compile.prototype.isElementNode = function(node) {
    return node.nodeType === 1;
};

Compile.prototype.isTextNode = function(node) {
    return node.nodeType === 3;
};

let compileUtil = {
    text: function(node, vm, exp) {
        this.bind(node, vm, exp, 'text');
    },

    bind: function(node, vm, exp, dir) {
        let updaterFn = updater[dir + 'Updater'];

        updaterFn && updaterFn(node, this._getVMVal(vm, exp));

        new Watcher(vm, exp, function(value, oldValue) {
            updaterFn && updaterFn(node, value, oldValue);
        });
    },

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
    textUpdater: function(node, value) {
        node.textContent = typeof value === 'undefined'
            ? ''
            : value;
    }
};

// hue
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

Hue.prototype.$watch = function(key, cb) {
    new Watcher(this, key, cb);
};

Hue.prototype._proxyData = function(key, setter, getter) {
    let self = this;
    setter = setter || Object.defineProperty(self, key, {
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
