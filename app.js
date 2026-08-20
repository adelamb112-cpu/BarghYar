const App = {
    currentPosItems: [],
    editingProductId: null,
    editingCustomerId: null,
    editingRepairId: null,
    editingChequeId: null,

    async init() {
        if (typeof DB !== 'undefined' && DB.init) {
            await DB.init();
        }
        this.applyTheme();
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        this.loadWeather();
        setInterval(() => this.loadWeather(), 30 * 60 * 1000);
        await this.renderCategoryOptions();
        await this.renderCustomerOptions();
        await this.renderInventory();
        await this.renderCustomersTable();
        await this.renderRepairsTable();
        await this.renderChequesTable();
        await this.updateDashboard();
        await this.refreshChequeAlerts();
    },

    getFaDateTime() {
        const now = new Date();
        const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        return new Intl.DateTimeFormat('fa-IR', options).format(now);
    },

    getFaDateTimeLong() {
        const now = new Date();
        return new Intl.DateTimeFormat('fa-IR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(now);
    },

    updateClock() {
        const clockEl = document.getElementById('live-clock');
        if (clockEl) clockEl.innerText = '⏱️ ' + this.getFaDateTimeLong();
        const hint = document.getElementById('pos-datetime-hint');
        if (hint) hint.innerText = 'تاریخ و ساعت ثبت: ' + this.getFaDateTimeLong();
    },

    showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        const targetTab = document.getElementById('tab-' + tabId);
        if (targetTab) targetTab.classList.add('active');
        if (window.event && window.event.currentTarget) {
            window.event.currentTarget.classList.add('active');
        }
    },

    closeModals() {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
    },

    async renderCategoryOptions() {
        const categories = await DB.getAll('categories');
        const posCatSelect = document.getElementById('pos-category-select');
        const prodCatSelect = document.getElementById('prod-cat-select');
        let optionsHtml = '<option value="">همه دسته‌ها</option>';
        categories.forEach(c => { optionsHtml += `<option value="${c.id}">${c.name}</option>`; });
        if (posCatSelect) posCatSelect.innerHTML = optionsHtml;
        if (prodCatSelect) prodCatSelect.innerHTML = optionsHtml;
        await this.onCategoryChange();
    },

    async renderCustomerOptions() {
        const customers = await DB.getAll('customers');
        const list = document.getElementById('pos-customer-list');
        if (list) {
            list.innerHTML = customers.map(c => `<option value="${c.name}" data-id="${c.id}" data-phone="${c.phone || ''}"></option>`).join('');
        }
        // keep hidden id field default
        const hid = document.getElementById('pos-customer');
        if (hid && !hid.value) hid.value = 'cash';
    },

    onCustomerNameInput() {
        const name = (document.getElementById('pos-customer-name')?.value || '').trim();
        const hid = document.getElementById('pos-customer');
        const phoneEl = document.getElementById('pos-customer-phone');
        DB.getAll('customers').then(customers => {
            const c = customers.find(x => x.name === name);
            if (c) {
                if (hid) hid.value = c.id;
                if (phoneEl && !phoneEl.value) phoneEl.value = c.phone || '';
            } else {
                if (hid) hid.value = 'new';
            }
            this.calcPosTotal();
        });
    },

    async onCategoryChange() {
        const catSelect = document.getElementById('pos-category-select');
        const catId = catSelect ? catSelect.value : '';
        const products = await DB.getAll('products');
        const filtered = catId ? products.filter(p => p.categoryId == catId) : products;
        const prodSelect = document.getElementById('pos-product-select');
        let html = '';
        filtered.forEach(p => { html += `<option value="${p.id}">${p.name} - ${p.sellPrice.toLocaleString()} تومان (موجودی: ${p.stock})</option>`; });
        if (prodSelect) prodSelect.innerHTML = html;
    },

    onCustomerChange() {
        this.calcPosTotal();
    },

    async addPosItem() {
        const prodSelect = document.getElementById('pos-product-select');
        if (!prodSelect || !prodSelect.value) return alert('لطفا یک کالا انتخاب کنید');
        const prodId = prodSelect.value;
        const qty = parseInt(document.getElementById('pos-qty').value) || 1;
        const products = await DB.getAll('products');
        const prod = products.find(p => p.id == prodId);
        if (!prod) return alert('کالای مورد نظر یافت نشد!');
        if (prod.stock < qty) return alert('موجودی کافی نیست!');

        const customerId = document.getElementById('pos-customer').value;
        const customers = await DB.getAll('customers');
        const cust = customers.find(c => c.id == customerId);

        let unitPrice = prod.sellPrice;
        const coopPct = parseFloat(document.getElementById('pos-coop-percent')?.value) || 0;
        if (cust && cust.isCoop) {
            unitPrice = prod.coopPrice || prod.sellPrice;
            const dp = cust.discountPercent || coopPct;
            if (dp > 0) unitPrice = unitPrice * (1 - dp / 100);
        } else if (coopPct > 0) {
            unitPrice = (prod.coopPrice || prod.sellPrice) * (1 - coopPct / 100);
        }

        const existing = this.currentPosItems.find(i => i.productId == prodId);
        if (existing) {
            existing.qty += qty;
            existing.totalPrice = existing.qty * unitPrice;
        } else {
            this.currentPosItems.push({ productId: prod.id, name: prod.name, unitPrice, qty, totalPrice: qty * unitPrice });
        }
        this.renderPosTable();
    },

    renderPosTable() {
        const tbody = document.getElementById('pos-items-table');
        if (!tbody) return;
        let html = '';
        this.currentPosItems.forEach((item, index) => {
            html += `<tr>
                <td>${item.name}</td>
                <td>${item.qty}</td>
                <td>${item.unitPrice.toLocaleString()}</td>
                <td>${item.totalPrice.toLocaleString()}</td>
                <td><button onclick="App.removePosItem(${index})" class="btn btn-danger btn-sm">❌</button></td>
            </tr>`;
        });
        tbody.innerHTML = html;
        this.calcPosTotal();
    },

    removePosItem(index) {
        this.currentPosItems.splice(index, 1);
        this.renderPosTable();
    },

    calcPosTotal() {
        const subtotal = this.currentPosItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const pct = parseFloat(document.getElementById('pos-discount-percent')?.value) || 0;
        let discount = parseFloat(document.getElementById('pos-discount')?.value) || 0;
        if (pct > 0) {
            discount = Math.round(subtotal * pct / 100);
            const di = document.getElementById('pos-discount');
            if (di && document.activeElement !== di) di.value = discount;
        }
        const paid = parseFloat(document.getElementById('pos-paid')?.value) || 0;
        const total = Math.max(0, subtotal - discount);
        const due = Math.max(0, total - paid);
        const set = (id, t) => { const el = document.getElementById(id); if (el) el.innerText = t; };
        set('pos-subtotal', subtotal.toLocaleString() + ' تومان');
        set('pos-total-amount', total.toLocaleString() + ' تومان');
        set('pos-due-amount', due.toLocaleString() + ' تومان');
    },

    async submitInvoice() {
        if (this.currentPosItems.length === 0) return alert('فاکتور خالی است!');
        let customerId = document.getElementById('pos-customer')?.value || 'cash';
        const custName = (document.getElementById('pos-customer-name')?.value || '').trim();
        const custPhone = (document.getElementById('pos-customer-phone')?.value || '').trim();
        if (custName && (customerId === 'cash' || customerId === 'new')) {
            const customers = await DB.getAll('customers');
            let existing = customers.find(c => c.name === custName);
            if (!existing) {
                existing = {
                    id: 'c-' + Date.now(),
                    name: custName,
                    phone: custPhone,
                    nationalId: '',
                    address: '',
                    note: '',
                    isCoop: false,
                    discountPercent: 0,
                    credit: 0,
                    createdAt: this.getFaDateTime()
                };
                await DB.put('customers', existing);
            } else if (custPhone && !existing.phone) {
                existing.phone = custPhone;
                await DB.put('customers', existing);
            }
            customerId = existing.id;
        }
        const pct = parseFloat(document.getElementById('pos-discount-percent')?.value) || 0;
        let discount = parseFloat(document.getElementById('pos-discount')?.value) || 0;
        const paid = parseFloat(document.getElementById('pos-paid')?.value) || 0;
        const subtotal = this.currentPosItems.reduce((sum, item) => sum + item.totalPrice, 0);
        if (pct > 0) discount = Math.round(subtotal * pct / 100);
        const total = Math.max(0, subtotal - discount);
        const due = Math.max(0, total - paid);

        const allInv = await DB.getAll('invoices');
        const invNum = (allInv.length + 1);
        const invoice = {
            id: "inv-" + Date.now(),
            number: invNum,
            date: this.getFaDateTime(),
            customerId,
            items: [...this.currentPosItems],
            subtotal,
            discount,
            total,
            paid,
            due
        };

        await DB.put('invoices', invoice);
        this.lastInvoiceId = invoice.id;

        const products = await DB.getAll('products');
        for (let item of this.currentPosItems) {
            const p = products.find(prod => prod.id == item.productId);
            if (p) {
                p.stock -= item.qty;
                await DB.put('products', p);
            }
        }

        alert('فاکتور شماره ' + invNum + ' در تاریخ ' + invoice.date + ' ثبت شد!');
        if (confirm('چاپ / ذخیره PDF فاکتور؟')) this.printInvoice(invoice);
        this.currentPosItems = [];
        this.renderPosTable();
        document.getElementById('pos-customer-name').value = '';
        document.getElementById('pos-customer-phone').value = '';
        document.getElementById('pos-customer').value = 'cash';
        document.getElementById('pos-discount').value = 0;
        document.getElementById('pos-discount-percent').value = 0;
        const cp=document.getElementById('pos-coop-percent'); if(cp) cp.value=0;
        document.getElementById('pos-paid').value = 0;
        this.calcPosTotal();
        await this.renderInventory();
        await this.renderCustomerOptions();
        await this.renderCustomersTable();
        await this.updateDashboard();
        // بعد از ثبت برو بخش مشتری برای اصلاح
        this.showTab('customers');
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('onclick')?.includes("'customers'"));
        });
    },

    openCategoryModal() {
        document.getElementById('cat-name-input').value = '';
        document.getElementById('modal-category').classList.add('active');
    },

    async saveCategory() {
        const name = document.getElementById('cat-name-input').value.trim();
        if (!name) return alert('نام دسته را وارد کنید');
        await DB.put('categories', { id: "cat-" + Date.now(), name });
        this.closeModals();
        await this.renderCategoryOptions();
        await this.renderInventory();
    },

    async openProductModal(prodId = null) {
        this.editingProductId = prodId;
        if (prodId) {
            const products = await DB.getAll('products');
            const p = products.find(x => x.id == prodId);
            if (p) {
                document.getElementById('prod-cat-select').value = p.categoryId;
                document.getElementById('prod-name-input').value = p.name;
                document.getElementById('prod-unit-input').value = p.unit;
                document.getElementById('prod-buy-price').value = p.buyPrice;
                document.getElementById('prod-sell-price').value = p.sellPrice;
                document.getElementById('prod-coop-price').value = p.coopPrice;
                document.getElementById('prod-stock').value = p.stock;
                document.getElementById('prod-min-stock').value = p.minStock;
                const bc=document.getElementById('prod-barcode'); if(bc) bc.value=p.barcode||'';
            }
        } else {
            document.getElementById('prod-name-input').value = '';
            document.getElementById('prod-buy-price').value = '';
            document.getElementById('prod-sell-price').value = '';
            document.getElementById('prod-coop-price').value = '';
            document.getElementById('prod-stock').value = '';
        }
        document.getElementById('modal-product').classList.add('active');
    },

    async saveProduct() {
        const categoryId = document.getElementById('prod-cat-select').value;
        const name = document.getElementById('prod-name-input').value.trim();
        const barcode = (document.getElementById('prod-barcode')?.value || '').trim();
        const unit = document.getElementById('prod-unit-input').value.trim();
        const buyPrice = parseFloat(document.getElementById('prod-buy-price').value) || 0;
        const sellPrice = parseFloat(document.getElementById('prod-sell-price').value) || 0;
        const coopPrice = parseFloat(document.getElementById('prod-coop-price').value) || 0;
        const stock = parseInt(document.getElementById('prod-stock').value) || 0;
        const minStock = parseInt(document.getElementById('prod-min-stock').value) || 5;

        if (!name) return alert('نام کالا را وارد کنید');
        if (!categoryId) return alert('دسته را انتخاب کنید یا دسته جدید بسازید');

        let productData = { categoryId, name, barcode, unit, buyPrice, sellPrice, coopPrice, stock, minStock, updatedAt: this.getFaDateTime() };

        if (this.editingProductId) {
            productData.id = this.editingProductId;
        } else {
            productData.id = "p-" + Date.now();
        }

        await DB.put('products', productData);
        this.closeModals();
        await this.renderInventory();
        await this.onCategoryChange();
    },

    async renderInventory() {
        const categories = await DB.getAll('categories');
        let products = await DB.getAll('products');
        const q = (document.getElementById('search-inventory')?.value || '').trim();
        if (q) products = products.filter(p => p.name.includes(q));
        const container = document.getElementById('inventory-tree');
        if (!container) return;

        let html = '';
        categories.forEach(cat => {
            const catProds = products.filter(p => p.categoryId == cat.id);
            html += `<div style="margin-bottom:15px; border:1px solid var(--border-color); padding:10px; border-radius:6px;">
                <h3>📁 ${cat.name}</h3>
                <div class="table-responsive"><table class="data-table">
                    <thead><tr><th>کالا</th><th>بارکد</th><th>خرید</th><th>فروش</th><th>همکار</th><th>موجودی</th><th>عملیات</th></tr></thead><tbody>`;
            catProds.forEach(p => {
                const isLow = p.stock <= p.minStock;
                html += `<tr style="${isLow ? 'background:#ef444422;' : ''}">
                    <td>${p.name} ${isLow ? '⚠️' : ''}</td>
                    <td>${p.barcode || '—'}</td>
                    <td>${p.buyPrice.toLocaleString()}</td>
                    <td>${p.sellPrice.toLocaleString()}</td>
                    <td>${p.coopPrice.toLocaleString()}</td>
                    <td>${p.stock} ${p.unit}</td>
                    <td><button onclick="App.openProductModal('${p.id}')" class="btn btn-primary btn-sm">ویرایش</button></td>
                </tr>`;
            });
            html += `</tbody></table></div></div>`;
        });
        container.innerHTML = html;
    },

    openCustomerModal(custId = null) {
        this.editingCustomerId = custId;
        if (custId) {
            DB.getAll('customers').then(customers => {
                const c = customers.find(x => x.id == custId);
                if (c) {
                    document.getElementById('cust-name-input').value = c.name;
                    document.getElementById('cust-national-id').value = c.nationalId || '';
                    document.getElementById('cust-phone-input').value = c.phone || '';
                    document.getElementById('cust-address-input').value = c.address || '';
                    document.getElementById('cust-note-input').value = c.note || '';
                    document.getElementById('cust-is-coop').checked = !!c.isCoop;
                    document.getElementById('cust-discount-select').value = c.discountPercent || 0;
                    document.getElementById('cust-credit-input').value = c.creditLimit || 0;
                }
            });
        } else {
            document.getElementById('cust-name-input').value = '';
            document.getElementById('cust-national-id').value = '';
            document.getElementById('cust-phone-input').value = '';
            document.getElementById('cust-address-input').value = '';
            document.getElementById('cust-note-input').value = '';
            document.getElementById('cust-is-coop').checked = false;
            document.getElementById('cust-discount-select').value = 0;
            document.getElementById('cust-credit-input').value = '';
        }
        document.getElementById('modal-customer').classList.add('active');
    },

    async saveCustomer() {
        const name = document.getElementById('cust-name-input').value.trim();
        const nationalId = document.getElementById('cust-national-id').value.trim();
        const phone = document.getElementById('cust-phone-input').value.trim();
        const address = document.getElementById('cust-address-input').value.trim();
        const note = document.getElementById('cust-note-input').value.trim();
        const isCoop = document.getElementById('cust-is-coop').checked;
        const discountPercent = parseFloat(document.getElementById('cust-discount-select').value) || 0;
        const creditLimit = parseFloat(document.getElementById('cust-credit-input').value) || 0;

        if (!name) return alert('نام مشتری را وارد کنید');

        let customerData = { name, nationalId, phone, address, note, isCoop, discountPercent, creditLimit };
        if (this.editingCustomerId) {
            customerData.id = this.editingCustomerId;
        } else {
            customerData.id = "cust-" + Date.now();
        }

        await DB.put('customers', customerData);
        this.closeModals();
        await this.renderCustomerOptions();
        await this.renderCustomersTable();
    },

    async getCustomerDueBalance(custId) {
        const invoices = await DB.getAll('invoices');
        return invoices.filter(inv => inv.customerId == custId).reduce((sum, inv) => sum + (inv.due || 0), 0);
    },

    async renderCustomersTable() {
        let customers = await DB.getAll('customers');
        const q = (document.getElementById('search-customers')?.value || '').trim();
        if (q) customers = customers.filter(c => (c.name||'').includes(q) || (c.phone||'').includes(q) || (c.note||'').includes(q));
        const tbody = document.getElementById('customers-table');
        if (!tbody) return;
        let html = '';
        for (let c of customers) {
            const dueBalance = await this.getCustomerDueBalance(c.id);
            html += `<tr>
                <td>${c.name} ${c.isCoop ? '🤝' : ''}</td>
                <td>${c.phone || '-'}</td>
                <td>${c.nationalId || '-'}</td>
                <td>${(c.creditLimit || 0).toLocaleString()}</td>
                <td style="color:${dueBalance > 0 ? '#ef4444' : '#22c55e'}; font-weight:bold;">${dueBalance.toLocaleString()}</td>
                <td>${c.note || '-'}</td>
                <td>
                    <button onclick="App.openCustomerModal('${c.id}')" class="btn btn-primary btn-sm">ویرایش</button>
                    <button onclick="App.openPaymentModal('${c.id}')" class="btn btn-success btn-sm">💵 دریافت</button>
                    <button onclick="App.viewCustomerProfile('${c.id}')" class="btn btn-secondary btn-sm">پرونده</button>
                </td>
            </tr>`;
        }
        tbody.innerHTML = html;
    },

    async viewCustomerProfile(custId) {
        const customers = await DB.getAll('customers');
        const c = customers.find(x => x.id == custId);
        if (!c) return;

        document.getElementById('profile-cust-name').innerText = 'پرونده مشتری: ' + c.name;
        const dueBalance = await this.getCustomerDueBalance(c.id);
        document.getElementById('profile-details').innerHTML = `
            <p><strong>تلفن:</strong> ${c.phone || '-'}</p>
            <p><strong>کد ملی:</strong> ${c.nationalId || '-'}</p>
            <p><strong>آدرس:</strong> ${c.address || '-'}</p>
            <p><strong>توضیحات:</strong> ${c.note || '-'}</p>
            <p><strong>مانده بدهی کل:</strong> <span style="color:#ef4444; font-weight:bold;">${dueBalance.toLocaleString()} تومان</span></p>
        `;

        const invoices = await DB.getAll('invoices');
        const custInvoices = invoices.filter(i => i.customerId == custId);
        let invHtml = '<table class="data-table"><thead><tr><th>تاریخ</th><th>مبلغ کل</th><th>پرداختی</th><th>مانده</th></tr></thead><tbody>';
        custInvoices.forEach(inv => {
            invHtml += `<tr>
                <td>${inv.date}</td>
                <td>${inv.total.toLocaleString()}</td>
                <td>${inv.paid.toLocaleString()}</td>
                <td>${inv.due.toLocaleString()}</td>
            </tr>`;
        });
        invHtml += '</tbody></table>';
        document.getElementById('profile-invoices-list').innerHTML = invHtml;

        document.getElementById('modal-customer-profile').classList.add('active');
    },

    async openRepairModal(id = null) {
        this.editingRepairId = id;
        if (id) {
            const repairs = await DB.getAll('repairs');
            const r = repairs.find(x => x.id == id);
            if (r) {
                document.getElementById('repair-cust-name').value = r.customerName;
                document.getElementById('repair-phone').value = r.phone;
                document.getElementById('repair-device').value = r.device;
                document.getElementById('repair-serial').value = r.serial;
                document.getElementById('repair-problem').value = r.problem;
                document.getElementById('repair-deposit').value = r.deposit;
                document.getElementById('repair-cost').value = r.cost;
                document.getElementById('repair-status').value = r.status;
            }
        } else {
            document.getElementById('repair-cust-name').value = '';
            document.getElementById('repair-phone').value = '';
            document.getElementById('repair-device').value = '';
            document.getElementById('repair-serial').value = '';
            document.getElementById('repair-problem').value = '';
            document.getElementById('repair-deposit').value = '';
            document.getElementById('repair-cost').value = '';
        }
        document.getElementById('modal-repair').classList.add('active');
    },

    async saveRepair() {
        const customerName = document.getElementById('repair-cust-name').value.trim();
        const phone = document.getElementById('repair-phone').value.trim();
        const device = document.getElementById('repair-device').value.trim();
        const serial = document.getElementById('repair-serial').value.trim();
        const problem = document.getElementById('repair-problem').value.trim();
        const deposit = parseFloat(document.getElementById('repair-deposit').value) || 0;
        const cost = parseFloat(document.getElementById('repair-cost').value) || 0;
        const status = document.getElementById('repair-status').value;

        if (!customerName || !device) return alert('نام مشتری و دستگاه را وارد کنید');

        let repairData = { customerName, phone, device, serial, problem, deposit, cost, status };
        if (this.editingRepairId) {
            repairData.id = this.editingRepairId;
        } else {
            repairData.id = "rep-" + Date.now();
            repairData.date = this.getFaDateTime();
        }

        await DB.put('repairs', repairData);
        this.closeModals();
        await this.renderRepairsTable();
    },

    async renderRepairsTable() {
        const repairs = await DB.getAll('repairs');
        const tbody = document.getElementById('repairs-table');
        if (!tbody) return;
        let html = '';
        repairs.forEach(r => {
            html += `<tr>
                <td>#${r.id.toString().slice(-4)}</td>
                <td>${r.date || '-'}</td>
                <td>${r.customerName} (${r.phone})</td>
                <td>${r.device} / ${r.serial || '-'}</td>
                <td>${r.problem}</td>
                <td>${r.deposit.toLocaleString()}</td>
                <td>${r.cost.toLocaleString()}</td>
                <td><span class="badge">${r.status}</span></td>
                <td><button onclick="App.openRepairModal('${r.id}')" class="btn btn-primary btn-sm">ویرایش</button></td>
            </tr>`;
        });
        tbody.innerHTML = html;
    },

    async openChequeModal(id = null) {
        this.editingChequeId = id;
        if (id) {
            const cheques = await DB.getAll('cheques');
            const ch = cheques.find(x => x.id == id);
            if (ch) {
                document.getElementById('cheque-number').value = ch.number;
                document.getElementById('cheque-bank').value = ch.bank;
                document.getElementById('cheque-cust-name').value = ch.customerName;
                document.getElementById('cheque-amount').value = ch.amount;
                document.getElementById('cheque-due-date').value = ch.dueDate;
                document.getElementById('cheque-status').value = ch.status;
            }
        } else {
            document.getElementById('cheque-number').value = '';
            document.getElementById('cheque-bank').value = '';
            document.getElementById('cheque-cust-name').value = '';
            document.getElementById('cheque-amount').value = '';
            document.getElementById('cheque-due-date').value = '';
        }
        document.getElementById('modal-cheque').classList.add('active');
    },

    async saveCheque() {
        const number = document.getElementById('cheque-number').value.trim();
        const bank = document.getElementById('cheque-bank').value.trim();
        const customerName = document.getElementById('cheque-cust-name').value.trim();
        const amount = parseFloat(document.getElementById('cheque-amount').value) || 0;
        const dueDate = document.getElementById('cheque-due-date').value.trim();
        const status = document.getElementById('cheque-status').value;

        if (!number || !amount) return alert('شماره چک و مبلغ را وارد کنید');

        let chequeData = { number, bank, customerName, amount, dueDate, status };
        if (this.editingChequeId) {
            chequeData.id = this.editingChequeId;
        } else {
            chequeData.id = "chq-" + Date.now();
            chequeData.registerDate = this.getFaDateTime();
        }

        await DB.put('cheques', chequeData);
        this.closeModals();
        await this.renderChequesTable();
    },

    async renderChequesTable() {
        const cheques = await DB.getAll('cheques');
        const tbody = document.getElementById('cheques-table');
        if (!tbody) return;
        let html = '';
        cheques.forEach(ch => {
            html += `<tr>
                <td>${ch.number}</td>
                <td>${ch.bank}</td>
                <td>${ch.customerName}</td>
                <td>${ch.amount.toLocaleString()}</td>
                <td>${ch.dueDate}</td>
                <td>${ch.registerDate || '-'}</td>
                <td><span class="badge">${ch.status}</span></td>
                <td><button onclick="App.openChequeModal('${ch.id}')" class="btn btn-primary btn-sm">ویرایش</button></td>
            </tr>`;
        });
        tbody.innerHTML = html;
    },

    async updateDashboard() {
        const invoices = await DB.getAll('invoices');
        const products = await DB.getAll('products');

        let totalSales = 0, totalProfit = 0, totalReceivables = 0, cashBalance = 0;

        invoices.forEach(inv => {
            totalSales += inv.total;
            cashBalance += inv.paid;
            totalReceivables += inv.due;

            inv.items.forEach(item => {
                const prod = products.find(p => p.id == item.productId);
                if (prod) {
                    const profitPerUnit = item.unitPrice - prod.buyPrice;
                    totalProfit += profitPerUnit * item.qty;
                }
            });
        });

        const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };

        setTxt('dash-sales-today', totalSales.toLocaleString() + ' تومان');
        setTxt('dash-sales-weekly', totalSales.toLocaleString() + ' تومان');
        setTxt('dash-sales-monthly', totalSales.toLocaleString() + ' تومان');
        setTxt('dash-sales-yearly', totalSales.toLocaleString() + ' تومان');
        setTxt('dash-cash-balance', cashBalance.toLocaleString() + ' تومان');
        setTxt('dash-total-profit', totalProfit.toLocaleString() + ' تومان');
        setTxt('dash-total-receivables', totalReceivables.toLocaleString() + ' تومان');
        await this.refreshChequeAlerts();
    },

    // --- Enhancements: search, payment, print PDF, cheque alerts ---
    lastInvoiceId: null,
    payingCustomerId: null,

    async printInvoice(invoice) {
        if (!invoice) {
            const invoices = await DB.getAll('invoices');
            invoice = invoices.find(i => i.id === this.lastInvoiceId) || invoices[invoices.length - 1];
        }
        if (!invoice) return alert('فاکتوری برای چاپ نیست');
        let custName = 'مشتری نقدی';
        if (invoice.customerId && invoice.customerId !== 'cash') {
            const customers = await DB.getAll('customers');
            const c = customers.find(x => x.id == invoice.customerId);
            if (c) custName = c.name + (c.phone ? ' - ' + c.phone : '');
        }
        let rows = (invoice.items || []).map(it =>
            `<tr><td>${it.name}</td><td>${it.qty}</td><td>${Number(it.unitPrice).toLocaleString()}</td><td>${Number(it.totalPrice).toLocaleString()}</td></tr>`
        ).join('');
        const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>فاکتور ${invoice.number || ''}</title>
        <style>body{font-family:Tahoma,sans-serif;padding:20px;color:#000} table{width:100%;border-collapse:collapse;margin:12px 0}
        th,td{border:1px solid #333;padding:8px;text-align:right} h2{margin:0} .meta{margin:10px 0;font-size:14px}
        @media print{button{display:none}}</style></head><body>
        <h2>⚡ فاکتور فروش برق‌یار</h2>
        <div class="meta">شماره: <b>${invoice.number || '—'}</b> | تاریخ: ${invoice.date}<br>مشتری: ${custName}</div>
        <table><thead><tr><th>کالا</th><th>تعداد</th><th>فی</th><th>جمع</th></tr></thead><tbody>${rows}</tbody></table>
        <p>جمع جزء: ${(invoice.subtotal||0).toLocaleString()} تومان<br>
        تخفیف: ${(invoice.discount||0).toLocaleString()} تومان<br>
        <b>مبلغ کل: ${(invoice.total||0).toLocaleString()} تومان</b><br>
        پرداختی: ${(invoice.paid||0).toLocaleString()} تومان<br>
        مانده: ${(invoice.due||0).toLocaleString()} تومان</p>
        <button onclick="window.print()">چاپ / PDF</button>
        <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script>
        </body></html>`;
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
    },

    async printLastInvoice() {
        const invoices = await DB.getAll('invoices');
        const inv = invoices.find(i => i.id === this.lastInvoiceId) || invoices.sort((a,b)=>String(b.id).localeCompare(String(a.id)))[0];
        if (!inv) return alert('فاکتوری ثبت نشده');
        this.printInvoice(inv);
    },

    openPaymentModal(custId) {
        this.payingCustomerId = custId;
        DB.getAll('customers').then(async customers => {
            const c = customers.find(x => x.id == custId);
            if (!c) return;
            const due = await this.getCustomerDue(custId);
            document.getElementById('pay-cust-info').innerText = c.name + ' — مانده بدهی: ' + due.toLocaleString() + ' تومان';
            document.getElementById('pay-amount').value = due > 0 ? due : '';
            document.getElementById('pay-note').value = '';
            document.getElementById('modal-payment').classList.add('active');
        });
    },

    async savePayment() {
        const amount = parseFloat(document.getElementById('pay-amount').value) || 0;
        const note = document.getElementById('pay-note').value.trim();
        if (amount <= 0) return alert('مبلغ را وارد کنید');
        const custId = this.payingCustomerId;
        const invoices = await DB.getAll('invoices');
        let remaining = amount;
        const dueInvs = invoices.filter(i => i.customerId == custId && (i.due || 0) > 0)
            .sort((a,b) => String(a.date).localeCompare(String(b.date)));
        for (let inv of dueInvs) {
            if (remaining <= 0) break;
            const pay = Math.min(inv.due, remaining);
            inv.due = Math.max(0, (inv.due || 0) - pay);
            inv.paid = (inv.paid || 0) + pay;
            await DB.put('invoices', inv);
            remaining -= pay;
        }
        await DB.put('payments', {
            id: 'pay-' + Date.now(),
            customerId: custId,
            amount,
            note,
            date: this.getFaDateTime()
        });
        this.closeModals();
        alert('دریافت وجه ثبت شد');
        await this.renderCustomersTable();
        await this.updateDashboard();
    },

    async refreshChequeAlerts() {
        const box = document.getElementById('cheque-alerts');
        if (!box) return;
        const cheques = await DB.getAll('cheques');
        const today = new Date(); today.setHours(0,0,0,0);
        const soon = new Date(today); soon.setDate(soon.getDate() + 3);
        const alerts = [];
        cheques.forEach(ch => {
            if (ch.status === 'وصول' || ch.status === 'برگشتی') return;
            const d = new Date(ch.dueDate || ch.due || '');
            if (isNaN(d)) return;
            d.setHours(0,0,0,0);
            if (d < today) alerts.push('⚠️ چک شماره ' + (ch.number||'') + ' سررسید گذشته — ' + Number(ch.amount||0).toLocaleString() + ' تومان');
            else if (d <= soon) alerts.push('🔔 چک شماره ' + (ch.number||'') + ' تا ۳ روز دیگر — ' + Number(ch.amount||0).toLocaleString() + ' تومان');
        });
        box.innerHTML = alerts.length ? alerts.map(a => '<div class="alert-item">'+a+'</div>').join('') : '';
    }
,

    toggleTheme() {
        const html = document.documentElement;
        const cur = html.getAttribute('data-theme') || 'dark';
        const next = cur === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('barghyar_theme', next);
    },

    applyTheme() {
        const t = localStorage.getItem('barghyar_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', t);
    },

    async loadWeather() {
        const box = document.getElementById('weather-box');
        if (!box) return;
        try {
            // تهران به‌صورت پیش‌فرض (می‌توان بعداً شهر را تنظیم کرد)
            const url = 'https://api.open-meteo.com/v1/forecast?latitude=35.69&longitude=51.39&current=temperature_2m,weather_code&timezone=Asia%2FTehran';
            const res = await fetch(url);
            const data = await res.json();
            const t = data?.current?.temperature_2m;
            const code = data?.current?.weather_code;
            const icons = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',51:'🌧️',61:'🌧️',71:'🌨️',80:'🌦️',95:'⛈️'};
            let icon = '🌤️';
            for (const k of Object.keys(icons)) { if (Number(code) >= Number(k)) icon = icons[k]; }
            box.innerText = icon + ' ' + (t != null ? Math.round(t) + '°C تهران' : '—');
        } catch {
            box.innerText = '🌤️ —';
        }
    },

    async globalSearch(q) {
        const box = document.getElementById('global-search-results');
        if (!box) return;
        q = (q || '').trim();
        if (!q) { box.innerHTML = ''; box.style.display = 'none'; return; }
        const [products, customers, invoices, repairs, cheques] = await Promise.all([
            DB.getAll('products'), DB.getAll('customers'), DB.getAll('invoices'),
            DB.getAll('repairs'), DB.getAll('cheques')
        ]);
        const items = [];
        products.filter(p => (p.name||'').includes(q)).slice(0,5).forEach(p =>
            items.push({type:'کالا', text: p.name + ' — موجودی ' + p.stock, tab:'inventory'}));
        customers.filter(c => (c.name||'').includes(q) || (c.phone||'').includes(q)).slice(0,5).forEach(c =>
            items.push({type:'مشتری', text: c.name + (c.phone?' — '+c.phone:''), tab:'customers', action: () => App.openCustomerProfile?.(c.id)}));
        invoices.filter(i => String(i.number).includes(q) || (i.date||'').includes(q)).slice(0,5).forEach(i =>
            items.push({type:'فاکتور', text: 'شماره ' + (i.number||'') + ' — ' + (i.total||0).toLocaleString() + ' ت', tab:'customers'}));
        repairs.filter(r => (r.device||'').includes(q) || (r.problem||'').includes(q) || (r.code||'').includes(q)).slice(0,5).forEach(r =>
            items.push({type:'تعمیر', text: (r.code||'') + ' ' + (r.device||''), tab:'repairs'}));
        cheques.filter(c => String(c.number||'').includes(q) || (c.customerName||'').includes(q)).slice(0,5).forEach(c =>
            items.push({type:'چک', text: (c.number||'') + ' — ' + (c.amount||0).toLocaleString(), tab:'cheques'}));
        if (!items.length) {
            box.innerHTML = '<div class="gs-item">موردی یافت نشد</div>';
            box.style.display = 'block';
            return;
        }
        box.innerHTML = items.map((it, idx) =>
            `<div class="gs-item" data-tab="${it.tab}"><span class="gs-type">${it.type}</span> ${it.text}</div>`
        ).join('');
        box.style.display = 'block';
        box.querySelectorAll('.gs-item').forEach(el => {
            el.onclick = () => {
                const tab = el.getAttribute('data-tab');
                if (tab) {
                    App.showTab(tab);
                    document.querySelectorAll('.tab-btn').forEach(b => {
                        b.classList.toggle('active', b.getAttribute('onclick')?.includes("'" + tab + "'"));
                    });
                }
                box.style.display = 'none';
                document.getElementById('global-search').value = '';
            };
        });
    },

    scanMode: null,
    scanStream: null,
    scanTimer: null,

    quickAddCategory() {
        const name = prompt('نام دسته جدید:');
        if (!name || !name.trim()) return;
        const id = 'cat-' + Date.now();
        DB.put('categories', { id, name: name.trim(), createdAt: this.getFaDateTime() }).then(async () => {
            await this.renderCategoryOptions();
            const sel = document.getElementById('prod-cat-select');
            if (sel) sel.value = id;
            alert('دسته «' + name.trim() + '» اضافه شد');
        });
    },

    async openScanner(mode) {
        this.scanMode = mode; // product | pos | customer
        document.getElementById('scanner-result').value = '';
        document.getElementById('scanner-qty').value = '1';
        document.getElementById('modal-scanner').classList.add('active');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false
            });
            this.scanStream = stream;
            const video = document.getElementById('scanner-video');
            video.srcObject = stream;
            await video.play();
            this.startScanLoop();
        } catch (e) {
            alert('دسترسی به دوربین ممکن نشد. بارکد را دستی وارد کنید.\n' + (e.message || ''));
        }
    },

    startScanLoop() {
        const video = document.getElementById('scanner-video');
        const canvas = document.getElementById('scanner-canvas');
        const ctx = canvas.getContext('2d');
        const supportsBD = 'BarcodeDetector' in window;
        let detector = null;
        if (supportsBD) {
            try { detector = new BarcodeDetector({ formats: ['qr_code','ean_13','ean_8','code_128','code_39','upc_a','upc_e'] }); } catch (_) {}
        }
        const tick = async () => {
            if (!this.scanStream) return;
            if (video.readyState >= 2) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);
                if (detector) {
                    try {
                        const codes = await detector.detect(canvas);
                        if (codes && codes[0] && codes[0].rawValue) {
                            document.getElementById('scanner-result').value = codes[0].rawValue;
                        }
                    } catch (_) {}
                }
            }
            this.scanTimer = requestAnimationFrame(tick);
        };
        this.scanTimer = requestAnimationFrame(tick);
    },

    stopScanner() {
        if (this.scanTimer) cancelAnimationFrame(this.scanTimer);
        this.scanTimer = null;
        if (this.scanStream) {
            this.scanStream.getTracks().forEach(t => t.stop());
            this.scanStream = null;
        }
        const video = document.getElementById('scanner-video');
        if (video) video.srcObject = null;
        document.getElementById('modal-scanner').classList.remove('active');
    },

    async confirmScan() {
        const code = (document.getElementById('scanner-result').value || '').trim();
        if (!code) return alert('کدی خوانده نشده. دستی وارد کنید یا دوباره اسکن کنید.');
        if (!confirm('تأیید می‌کنید؟\nکد: ' + code)) return;

        const qty = parseInt(document.getElementById('scanner-qty').value) || 1;
        const mode = this.scanMode;
        this.stopScanner();

        if (mode === 'product') {
            const bc = document.getElementById('prod-barcode');
            if (bc) bc.value = code;
            // اگر کالا با این بارکد هست، فرم را پر کن
            const products = await DB.getAll('products');
            const p = products.find(x => x.barcode === code);
            if (p) {
                await this.openProductModal(p.id);
                alert('کالای موجود پیدا شد و فرم پر شد. در صورت نیاز ویرایش و ذخیره کنید.');
            }
            return;
        }
        if (mode === 'pos') {
            const products = await DB.getAll('products');
            const p = products.find(x => x.barcode === code || x.id === code || x.name === code);
            if (!p) return alert('کالایی با این بارکد پیدا نشد. اول در انبارداری بارکد را روی کالا ثبت کنید.');
            document.getElementById('pos-product-select').innerHTML =
                `<option value="${p.id}">${p.name} - ${p.sellPrice.toLocaleString()} تومان</option>`;
            document.getElementById('pos-product-select').value = p.id;
            document.getElementById('pos-qty').value = qty;
            await this.addPosItem();
            alert('کالا به فاکتور اضافه شد. در صورت نیاز تعداد را اصلاح کنید.');
            return;
        }
        if (mode === 'customer') {
            // بارکد/کد ملی مشتری
            const el = document.getElementById('cust-national-id');
            if (el) el.value = code;
        }
    },

    async buildInvoiceText(invoice) {
        let custName = 'مشتری نقدی';
        let phone = '';
        if (invoice.customerId && invoice.customerId !== 'cash') {
            const customers = await DB.getAll('customers');
            const c = customers.find(x => x.id == invoice.customerId);
            if (c) { custName = c.name; phone = c.phone || ''; }
        }
        let lines = [];
        lines.push('⚡ فاکتور برق‌یار');
        lines.push('شماره: ' + (invoice.number || '—'));
        lines.push('تاریخ: ' + (invoice.date || ''));
        lines.push('مشتری: ' + custName + (phone ? ' | ' + phone : ''));
        lines.push('——————');
        (invoice.items || []).forEach(it => {
            lines.push(it.name + ' × ' + it.qty + ' = ' + Number(it.totalPrice).toLocaleString() + ' ت');
        });
        lines.push('——————');
        lines.push('جمع: ' + Number(invoice.subtotal || 0).toLocaleString() + ' ت');
        if (invoice.discount) lines.push('تخفیف: ' + Number(invoice.discount).toLocaleString() + ' ت');
        lines.push('مبلغ کل: ' + Number(invoice.total || 0).toLocaleString() + ' تومان');
        lines.push('پرداختی: ' + Number(invoice.paid || 0).toLocaleString() + ' ت');
        lines.push('مانده: ' + Number(invoice.due || 0).toLocaleString() + ' ت');
        lines.push('با تشکر از خرید شما');
        return lines.join('\n');
    },

    async shareLastInvoice() {
        const invoices = await DB.getAll('invoices');
        const inv = invoices.find(i => i.id === this.lastInvoiceId) ||
            invoices.sort((a,b) => String(b.id).localeCompare(String(a.id)))[0];
        if (!inv) return alert('فاکتوری برای ارسال نیست');
        const text = await this.buildInvoiceText(inv);
        if (navigator.share) {
            try {
                await navigator.share({ title: 'فاکتور برق‌یار', text });
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(text);
            alert('متن فاکتور کپی شد. می‌توانید در پیامک یا واتساپ بچسبانید.');
        } catch {
            prompt('متن فاکتور را کپی کنید:', text);
        }
    },

};

window.onload = () => App.init();
