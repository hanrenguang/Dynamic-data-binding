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
