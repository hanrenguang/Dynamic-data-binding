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
