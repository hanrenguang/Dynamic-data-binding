let uid = 0;

export default class Dep {
    constructor () {
        this.id = uid++;
        this.subs = [];
    }

    addSub (sub) {
        this.subs.push(sub);
    }

    removeSub (sub) {
        let idx = this.subs.indexOf(sub);
        idx !== -1 ? this.subs.splice(idx, 1) : void 0;
    }

    depend () {
        Dep.target.addDep(this);
    }

    notify () {
        this.subs.forEach(function (sub) {
            sub.update();
        });
    }
}

Dep.target = null;
