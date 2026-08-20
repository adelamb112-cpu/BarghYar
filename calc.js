const Calc = {
    expr: '0',
    press(key) {
        const d = document.getElementById('calc-display');
        if (!d) return;
        if (key === 'C') { this.expr = '0'; d.value = '0'; return; }
        if (key === '±') {
            if (this.expr.startsWith('-')) this.expr = this.expr.slice(1);
            else if (this.expr !== '0') this.expr = '-' + this.expr;
            d.value = this.expr;
            return;
        }
        if (key === '=') {
            try {
                const safe = this.expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
                // eslint-disable-next-line no-new-func
                const result = Function('"use strict"; return (' + safe + ')')();
                this.expr = String(result);
                d.value = this.expr;
            } catch {
                d.value = 'خطا';
                this.expr = '0';
            }
            return;
        }
        if (key === '%') {
            try {
                const n = parseFloat(this.expr) / 100;
                this.expr = String(n);
                d.value = this.expr;
            } catch { /* ignore */ }
            return;
        }
        if (this.expr === '0' && '0123456789.'.includes(key)) this.expr = key;
        else this.expr += key;
        d.value = this.expr;
    }
};
