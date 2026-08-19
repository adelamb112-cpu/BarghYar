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
        this.updateClock();
        setInterval(() => this.updateClock(), 1000);
        await this.renderCategoryOptions();
        await this.renderCustomerOptions();
        await this.renderInventory();
        await this.renderCustomersTable();
        await this.renderRepairsTable();
        await this.renderChequesTable();
        await this.updateDashboard();
    },

    getFaDateTime() {
        const now = new Date();
        const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        return new Intl.DateTimeFormat('fa-IR', options).format(now);
    },

    updateClock() {
        const clockEl = document.getElementById('live-clock');
        if (clockEl) clockEl.innerText = '⏱️ ' + this.getFaDateTime();
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
        const select = document.getElementById('pos-customer');
        if (!select) return;
        let html = '<option value="cash">مشتری نقدی (متفرقه)</option>';
        customers.forEach(c => { html += `<option value="${c.id}">${c.name} (${c.phone || 'بدون تلفن'})</option>`; });
        select.innerHTML = html;
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
        if (cust && cust.isCoop) {
            unitPrice = prod.coopPrice || prod.sellPrice;
            if (cust.discountPercent > 0) {
                unitPrice = unitPrice * (1 - cust.discountPercent / 100);
            }
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
        const discountInput = document.getElementById('pos-discount');
        const paidInput = document.getElementById('pos-paid');
        const discount = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
        const paid = paidInput ? (parseFloat(paidInput.value) || 0) : 0;
        const total = Math.max(0, subtotal - discount);
        const due = Math.max(0, total - paid);

        const totalEl = document.getElementById('pos-total-amount');
        const dueEl = document.getElementById('pos-due-amount');
        if (totalEl) totalEl.innerText = total.toLocaleString();
        if (dueEl) dueEl.innerText = due.toLocaleString();
    },

    async submitInvoice() {
        if (this.currentPosItems.length === 0) return alert('فاکتور خالی است!');
        const customerId = document.getElementById('pos-customer').value;
        const discount = parseFloat(document.getElementById('pos-discount').value) || 0;
        const paid = parseFloat(document.getElementById('pos-paid').value) || 0;
        const subtotal = this.currentPosItems.reduce((sum, item) => sum + item.totalPrice, 0);
        const total = Math.max(0, subtotal - discount);
        const due = Math.max(0, total - paid);

        const invoice = {
            id: "inv-" + Date.now(),
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

        const products = await DB.getAll('products');
        for (let item of this.currentPosItems) {
            const p = products.find(prod => prod.id == item.productId);
            if (p) {
                p.stock -= item.qty;
                await DB.put('products', p);
            }
        }

        alert('فاکتور با موفقیت در تاریخ ' + invoice.date + ' ثبت شد!');
        this.currentPosItems = [];
        this.renderPosTable();
        await this.renderInventory();
        await this.updateDashboard();
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
        const unit = document.getElementById('prod-unit-input').value.trim();
        const buyPrice = parseFloat(document.getElementById('prod-buy-price').value) || 0;
        const sellPrice = parseFloat(document.getElementById('prod-sell-price').value) || 0;
        const coopPrice = parseFloat(document.getElementById('prod-coop-price').value) || 0;
        const stock = parseInt(document.getElementById('prod-stock').value) || 0;
        const minStock = parseInt(document.getElementById('prod-min-stock').value) || 5;

        if (!name) return alert('نام کالا را وارد کنید');

        const products = await DB.getAll('products');
        let productData = { categoryId, name, unit, buyPrice, sellPrice, coopPrice, stock, minStock };

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
        const products = await DB.getAll('products');
        const container = document.getElementById('inventory-tree');
        if (!container) return;

        let html = '';
        categories.forEach(cat => {
            const catProds = products.filter(p => p.categoryId == cat.id);
            html += `<div style="margin-bottom:15px; border:1px solid var(--border-color); padding:10px; border-radius:6px;">
                <h3>📁 ${cat.name}</h3>
                <div class="table-responsive"><table class="data-table">
                    <thead><tr><th>کالا</th><th>خرید</th><th>فروش</th><th>همکار</th><th>موجودی</th><th>عملیات</th></tr></thead><tbody>`;
            catProds.forEach(p => {
                const isLow = p.stock <= p.minStock;
                html += `<tr style="${isLow ? 'background:#ef444422;' : ''}">
                    <td>${p.name} ${isLow ? '⚠️' : ''}</td>
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
        const customers = await DB.getAll('customers');
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
    }
};

window.onload = () => App.init();
