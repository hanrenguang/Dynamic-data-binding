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
