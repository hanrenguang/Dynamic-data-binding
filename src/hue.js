function Hue(options) {
    this.$options = options || {};
    let data = this._data = this.$options.data,
        self = this;

    Object.keys(data).forEach(function(key) {
        self._proxyData(key);
    });

    observe(data);

    this.$compile = new Compile(this, options.el || document.body);
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
