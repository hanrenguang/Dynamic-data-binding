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
