const App = (() => {
    let currentInvoiceItems = [];
    let editingProductId = null;
    let editingCustomerId = null;
    let editingRepairId = null;
    let editingChequeId = null;

    async function init() {
        await DB.init();
        Auth.init();
        Sync.checkOnlineStatus();
        startClock();
        loadCategories();
        loadProductsTree();
        loadCustomers();
        loadCheques();
        loadRepairs();
        updateDashboard();
    }

    function getFaDateTime() {
        const n = new Date();
        return n.toLocaleDateString('fa-IR') + ' ' + n.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function startClock() {
        setInterval(() => {
            const clockEl = document.getElementById("live-clock");
            if (clockEl) clockEl.innerText = getFaDateTime();
        }, 1000);
    }

    function showTab(tabId) {
        document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
        document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
        document.getElementById(`tab-${tabId}`).classList.add("active");
        if (event && event.target) event.target.classList.add("active");

        if (tabId === 'dashboard') updateDashboard();
        if (tabId === 'repairs') loadRepairs();
        if (tabId === 'cheques') loadCheques();
        if (tabId === 'customers') loadCustomers();
    }

    function closeModals() {
        document.querySelectorAll(".modal-overlay").forEach(m => {
            if (m.id !== "auth-overlay") m.classList.remove("active");
        });
    }

    function openCategoryModal() {
        document.getElementById("cat-name-input").value = "";
        document.getElementById("modal-category").classList.add("active");
    }

    async function saveCategory() {
        const name = document.getElementById("cat-name-input").value.trim();
        if (!name) return alert("نام دسته‌بندی را وارد کنید.");
        await DB.put("categories", { id: "cat-" + Date.now(), name: name });
        closeModals();
        loadCategories();
        loadProductsTree();
    }

    async function deleteCategory(catId) {
        if (confirm("آیا از حذف این دسته‌بندی مطمئن هستید؟")) {
            await DB.deleteItem("categories", catId);
            loadCategories();
            loadProductsTree();
        }
    }

    async function openProductModal(prodId = null) {
        editingProductId = prodId;
        const cats = await DB.getAll("categories");
        const catSelect = document.getElementById("prod-cat-select");
        catSelect.innerHTML = "";
        cats.forEach(c => catSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`);

        if (prodId) {
            const products = await DB.getAll("products");
            const p = products.find(x => x.id === prodId);
            if (p) {
                document.getElementById("prod-cat-select").value = p.categoryId;
                document.getElementById("prod-name-input").value = p.name;
                document.getElementById("prod-unit-input").value = p.unit;
                document.getElementById("prod-buy-price").value = p.buyPrice;
                document.getElementById("prod-sell-price").value = p.sellPrice;
                document.getElementById("prod-coop-price").value = p.coopPrice;
                document.getElementById("prod-stock").value = p.stock;
                document.getElementById("prod-min-stock").value = p.minStock;
            }
        } else {
            document.getElementById("prod-name-input").value = "";
            document.getElementById("prod-buy-price").value = 0;
            document.getElementById("prod-sell-price").value = 0;
            document.getElementById("prod-coop-price").value = 0;
            document.getElementById("prod-stock").value = 0;
        }

        document.getElementById("modal-product").classList.add("active");
    }

    async function saveProduct() {
        const name = document.getElementById("prod-name-input").value.trim();
        if (!name) return alert("نام کالا را وارد کنید.");

        const productData = {
            id: editingProductId || "p-" + Date.now(),
            categoryId: document.getElementById("prod-cat-select").value,
            name: name,
            unit: document.getElementById("prod-unit-input").value,
            buyPrice: parseFloat(document.getElementById("prod-buy-price").value) || 0,
            sellPrice: parseFloat(document.getElementById("prod-sell-price").value) || 0,
            coopPrice: parseFloat(document.getElementById("prod-coop-price").value) || 0,
            stock: parseFloat(document.getElementById("prod-stock").value) || 0,
            minStock: parseFloat(document.getElementById("prod-min-stock").value) || 5
        };

        await DB.put("products", productData);
        closeModals();
        loadProductsTree();
    }

    async function deleteProduct(id) {
        if (confirm("آیا از حذف این کالا اطمینان دارید؟")) {
            await DB.deleteItem("products", id);
            loadProductsTree();
        }
    }

    async function loadCategories() {
        const cats = await DB.getAll("categories");
        const select = document.getElementById("pos-category-select");
        if (select) {
            select.innerHTML = '<option value="">انتخاب دسته کالا</option>';
            cats.forEach(c => select.innerHTML += `<option value="${c.id}">${c.name}</option>`);
        }
    }

    async function onCategoryChange() {
        const catId = document.getElementById("pos-category-select").value;
        const products = await DB.getAll("products");
        const filtered = products.filter(p => p.categoryId === catId);
        const pSelect = document.getElementById("pos-product-select");
        pSelect.innerHTML = "";

        filtered.forEach(p => {
            pSelect.innerHTML += `<option value="${p.id}">${p.name} - ${p.sellPrice.toLocaleString()} تومان (موجودی: ${p.stock} ${p.unit})</option>`;
        });
    }

    async function loadProductsTree() {
        const cats = await DB.getAll("categories");
        const products = await DB.getAll("products");
        const treeContainer = document.getElementById("inventory-tree");
        if (!treeContainer) return;
        treeContainer.innerHTML = "";

        cats.forEach(c => {
            const catProducts = products.filter(p => p.categoryId === c.id);
            let html = `<div class="tree-cat">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>📂 ${c.name}</strong>
                    <button onclick="App.deleteCategory('${c.id}')" class="btn btn-danger btn-sm">حذف دسته</button>
                </div>`;
            catProducts.forEach(p => {
                const isLow = p.stock <= p.minStock;
                const lowBadge = isLow ? '<span style="color:#ef4444; font-weight:bold;"> (⚠️ کمبود موجودی)</span>' : '';
                html += `<div class="tree-prod-item">
                    <span>└─ <strong>${p.name}</strong> - قیمت: ${p.sellPrice.toLocaleString()} - همکار: ${p.coopPrice.toLocaleString()} - موجودی: ${p.stock} ${p.unit}${lowBadge}</span>
                    <div>
                        <button onclick="App.openProductModal('${p.id}')" class="btn btn-secondary btn-sm">ویرایش</button>
                        <button onclick="App.deleteProduct('${p.id}')" class="btn btn-danger btn-sm">حذف</button>
                    </div>
                </div>`;
            });
            html += `</div>`;
            treeContainer.innerHTML += html;
        });
    }

    async function openCustomerModal(custId = null) {
        editingCustomerId = custId;
        if (custId) {
            const customers = await DB.getAll("customers");
            const c = customers.find(x => x.id === custId);
            if (c) {
                document.getElementById("cust-name-input").value = c.name || "";
                document.getElementById("cust-national-id").value = c.nationalId || "";
                document.getElementById("cust-phone-input").value = c.phone || "";
                document.getElementById("cust-address-input").value = c.address || "";
                document.getElementById("cust-note-input").value = c.notes || "";
                document.getElementById("cust-is-coop").checked = !!c.isCoop;
                document.getElementById("cust-discount-select").value = c.discountPercent || 0;
                document.getElementById("cust-credit-input").value = c.creditLimit || 0;
            }
        } else {
            document.getElementById("cust-name-input").value = "";
            document.getElementById("cust-national-id").value = "";
            document.getElementById("cust-phone-input").value = "";
            document.getElementById("cust-address-input").value = "";
            document.getElementById("cust-note-input").value = "";
            document.getElementById("cust-is-coop").checked = false;
            document.getElementById("cust-discount-select").value = 0;
            document.getElementById("cust-credit-input").value = 0;
        }
        document.getElementById("modal-customer").classList.add("active");
    }

    async function saveCustomer() {
        const name = document.getElementById("cust-name-input").value.trim();
        if (!name) return alert("نام مشتری را وارد کنید.");

        const custData = {
            id: editingCustomerId || "cust-" + Date.now(),
            name: name,
            nationalId: document.getElementById("cust-national-id").value,
            phone: document.getElementById("cust-phone-input").value,
            address: document.getElementById("cust-address-input").value,
            notes: document.getElementById("cust-note-input").value,
            isCoop: document.getElementById("cust-is-coop").checked,
            discountPercent: parseFloat(document.getElementById("cust-discount-select").value) || 0,
            creditLimit: parseFloat(document.getElementById("cust-credit-input").value) || 0,
            createdAt: editingCustomerId ? undefined : getFaDateTime(),
            balance: 0
        };

        if (editingCustomerId) {
            const existing = (await DB.getAll("customers")).find(x => x.id === editingCustomerId);
            if (existing) {
                custData.balance = existing.balance || 0;
                custData.createdAt = existing.createdAt || getFaDateTime();
            }
        }

        await DB.put("customers", custData);
        closeModals();
        loadCustomers();
    }

    async function deleteCustomer(id) {
        if (confirm("آیا از حذف این مشتری اطمینان دارید؟")) {
            await DB.deleteItem("customers", id);
            loadCustomers();
        }
    }

    async function loadCustomers() {
        const customers = await DB.getAll("customers");
        const select = document.getElementById("pos-customer");
        const table = document.getElementById("customers-table");
        if (select) select.innerHTML = '<option value="">مشتری عبوری</option>';
        if (table) table.innerHTML = "";

        customers.forEach(c => {
            if (select) select.innerHTML += `<option value="${c.id}">${c.name} ${c.isCoop ? '(همکار)' : ''}</option>`;
            if (table) {
                table.innerHTML += `<tr>
                    <td>${c.name} ${c.isCoop ? '<span class="badge">همکار</span>' : ''}</td>
                    <td>${c.phone || '-'}</td>
                    <td>${c.nationalId || '-'}</td>
                    <td>${c.creditLimit ? c.creditLimit.toLocaleString() : 0} تومان</td>
                    <td><strong style="color:${(c.balance || 0) > 0 ? '#ef4444' : '#22c55e'}">${(c.balance || 0).toLocaleString()} تومان</strong></td>
                    <td>${c.notes || '-'}</td>
                    <td>
                        <button onclick="App.openCustomerProfile('${c.id}')" class="btn btn-primary btn-sm">پرونده</button>
                        <button onclick="App.openCustomerModal('${c.id}')" class="btn btn-secondary btn-sm">ویرایش</button>
                        <button onclick="App.deleteCustomer('${c.id}')" class="btn btn-danger btn-sm">حذف</button>
                    </td>
                </tr>`;
            }
        });
    }

    async function openCustomerProfile(custId) {
        const customers = await DB.getAll("customers");
        const c = customers.find(x => x.id === custId);
        if (!c) return;

        document.getElementById("profile-cust-name").innerText = `پرونده مشتری: ${c.name}`;
        document.getElementById("profile-details").innerHTML = `
            <p><strong>کد ملی:</strong> ${c.nationalId || '-'}</p>
            <p><strong>تلفن:</strong> ${c.phone || '-'}</p>
            <p><strong>آدرس:</strong> ${c.address || '-'}</p>
            <p><strong>توضیحات تکمیلی:</strong> ${c.notes || '-'}</p>
            <p><strong>تاریخ ثبت:</strong> ${c.createdAt || '-'}</p>
            <p><strong>نوع مشتری:</strong> ${c.isCoop ? `همکار (تخفیف ${c.discountPercent}٪)` : 'عادی'}</p>
            <p><strong>سقف اعتبار:</strong> ${(c.creditLimit || 0).toLocaleString()} تومان</p>
            <p><strong>مانده بدهی:</strong> <span style="color:${(c.balance || 0) > 0 ? '#ef4444' : '#22c55e'}; font-weight:bold;">${(c.balance || 0).toLocaleString()} تومان</span></p>
        `;

        const invoices = await DB.getAll("invoices");
        const cInvoices = invoices.filter(inv => inv.customerId === custId);
        const invList = document.getElementById("profile-invoices-list");
        invList.innerHTML = "";

        if (cInvoices.length === 0) {
            invList.innerHTML = "<p>هیچ فاکتوری ثبت نشده است.</p>";
        } else {
            cInvoices.forEach(inv => {
                let itemsList = inv.items.map(i => `${i.name} (${i.qty})`).join(', ');
                invList.innerHTML += `<div class="tree-prod-item" style="flex-direction:column; align-items:flex-start;">
                    <div><strong>فاکتور: ${inv.id}</strong> | تاریخ و ساعت: ${inv.dateTime}</div>
                    <div style="font-size:12px; color:#cbd5e1;">اقلام: ${itemsList}</div>
                    <div style="font-size:13px;">کل: ${inv.totalAmount.toLocaleString()} | دریافتی: ${inv.paidAmount.toLocaleString()} | مانده: ${inv.dueAmount.toLocaleString()} تومان</div>
                </div>`;
            });
        }

        document.getElementById("modal-customer-profile").classList.add("active");
    }

    async function onCustomerChange() {
        calcPosTotal();
    }

    async function addPosItem() {
        const pId = document.getElementById("pos-product-select").value;
        const qty = parseFloat(document.getElementById("pos-qty").value);
        if (!pId || !qty) return alert("کالا و تعداد را مشخص کنید.");

        const products = await DB.getAll("products");
        const product = products.find(p => p.id === pId);

        currentInvoiceItems.push({
            productId: product.id,
            name: product.name,
            buyPrice: product.buyPrice,
            qty: qty,
            price: product.sellPrice,
            coopPrice: product.coopPrice,
            total: qty * product.sellPrice
        });

        renderPosItems();
    }

    function renderPosItems() {
        const tbody = document.getElementById("pos-items-table");
        if (!tbody) return;
        tbody.innerHTML = "";
        currentInvoiceItems.forEach((item, index) => {
            tbody.innerHTML += `<tr>
                <td>${item.name}</td>
                <td>${item.qty}</td>
                <td>${item.price.toLocaleString()} تومان</td>
                <td>${item.total.toLocaleString()} تومان</td>
                <td><button onclick="App.removePosItem(${index})" class="btn btn-danger btn-sm">حذف</button></td>
            </tr>`;
        });
        calcPosTotal();
    }

    function removePosItem(index) {
        currentInvoiceItems.splice(index, 1);
        renderPosItems();
    }

    async function calcPosTotal() {
        const custId = document.getElementById("pos-customer").value;
        let discountPercent = 0;
        let isCoop = false;

        if (custId) {
            const customers = await DB.getAll("customers");
            const c = customers.find(x => x.id === custId);
            if (c) {
                isCoop = c.isCoop;
                discountPercent = c.discountPercent || 0;
            }
        }

        let total = 0;
        currentInvoiceItems.forEach(item => {
            let basePrice = isCoop && item.coopPrice > 0 ? item.coopPrice : item.price;
            item.total = item.qty * basePrice;
            total += item.total;
        });

        const manualDiscount = parseFloat(document.getElementById("pos-discount").value) || 0;
        const autoDiscount = (total * discountPercent) / 100;
        const finalDiscount = manualDiscount + autoDiscount;

        const paid = parseFloat(document.getElementById("pos-paid").value) || 0;
        const finalTotal = Math.max(0, total - finalDiscount);
        const due = finalTotal - paid;

        document.getElementById("pos-total-amount").innerText = finalTotal.toLocaleString();
        document.getElementById("pos-due-amount").innerText = due.toLocaleString();
    }

    async function submitInvoice() {
        if (currentInvoiceItems.length === 0) return alert("فاکتور خالی است.");

        const custId = document.getElementById("pos-customer").value;
        const manualDiscount = parseFloat(document.getElementById("pos-discount").value) || 0;
        const paid = parseFloat(document.getElementById("pos-paid").value) || 0;

        let total = currentInvoiceItems.reduce((a, b) => a + b.total, 0);
        let discountPercent = 0;

        if (custId) {
            const customers = await DB.getAll("customers");
            const c = customers.find(x => x.id === custId);
            if (c) discountPercent = c.discountPercent || 0;
        }

        const autoDiscount = (total * discountPercent) / 100;
        const finalTotal = Math.max(0, total - (manualDiscount + autoDiscount));
        const due = finalTotal - paid;

        const dtStr = getFaDateTime();
        const invoice = {
            id: "INV-" + Math.floor(100000 + Math.random() * 900000),
            dateTime: dtStr,
            date: dtStr.split(' ')[0],
            customerId: custId,
            items: [...currentInvoiceItems],
            totalAmount: finalTotal,
            paidAmount: paid,
            dueAmount: due
        };

        const products = await DB.getAll("products");
        for (let item of currentInvoiceItems) {
            const p = products.find(x => x.id === item.productId);
            if (p) {
                p.stock -= item.qty;
                await DB.put("products", p);
            }
        }

        if (custId && due !== 0) {
            const customers = await DB.getAll("customers");
            const c = customers.find(x => x.id === custId);
            if (c) {
                c.balance = (c.balance || 0) + due;
                await DB.put("customers", c);
            }
        }

        await DB.put("invoices", invoice);
        alert(`فاکتور در تاریخ و ساعت ${dtStr} با موفقیت ثبت شد.`);
        window.print();

        currentInvoiceItems = [];
        renderPosItems();
        loadProductsTree();
        loadCustomers();
    }

    function openRepairModal(repairId = null) {
        editingRepairId = repairId;
        if (repairId) {
            DB.getAll("repairs").then(repairs => {
                const r = repairs.find(x => x.id === repairId);
                if (r) {
                    document.getElementById("repair-cust-name").value = r.customerName || "";
                    document.getElementById("repair-phone").value = r.phone || "";
                    document.getElementById("repair-device").value = r.device || "";
                    document.getElementById("repair-serial").value = r.serial || "";
                    document.getElementById("repair-problem").value = r.problem || "";
                    document.getElementById("repair-deposit").value = r.deposit || 0;
                    document.getElementById("repair-cost").value = r.cost || 0;
                    document.getElementById("repair-status").value = r.status || "درحال بررسی";
                }
            });
        } else {
            document.getElementById("repair-cust-name").value = "";
            document.getElementById("repair-phone").value = "";
            document.getElementById("repair-device").value = "";
            document.getElementById("repair-serial").value = "";
            document.getElementById("repair-problem").value = "";
            document.getElementById("repair-deposit").value = 0;
            document.getElementById("repair-cost").value = 0;
            document.getElementById("repair-status").value = "درحال بررسی";
        }
        document.getElementById("modal-repair").classList.add("active");
    }

    async function saveRepair() {
        const custName = document.getElementById("repair-cust-name").value.trim();
        if (!custName) return alert("نام مشتری را وارد کنید.");

        const repairData = {
            id: editingRepairId || "REP-" + Date.now(),
            dateTime: editingRepairId ? undefined : getFaDateTime(),
            customerName: custName,
            phone: document.getElementById("repair-phone").value,
            device: document.getElementById("repair-device").value,
            serial: document.getElementById("repair-serial").value,
            problem: document.getElementById("repair-problem").value,
            deposit: parseFloat(document.getElementById("repair-deposit").value) || 0,
            cost: parseFloat(document.getElementById("repair-cost").value) || 0,
            status: document.getElementById("repair-status").value
        };

        if (editingRepairId) {
            const existing = (await DB.getAll("repairs")).find(x => x.id === editingRepairId);
            if (existing) repairData.dateTime = existing.dateTime;
        }

        await DB.put("repairs", repairData);
        closeModals();
        loadRepairs();
    }

    async function deleteRepair(id) {
        if (confirm("آیا از حذف این پذیرش تعمیر اطمینان دارید؟")) {
            await DB.deleteItem("repairs", id);
            loadRepairs();
        }
    }

    async function loadRepairs() {
        const repairs = await DB.getAll("repairs");
        const table = document.getElementById("repairs-table");
        if (!table) return;
        table.innerHTML = "";

        repairs.forEach(r => {
            table.innerHTML += `<tr>
                <td>${r.id}</td>
                <td>${r.dateTime || '-'}</td>
                <td>${r.customerName} (${r.phone || '-'})</td>
                <td>${r.device} - ${r.serial || '-'}</td>
                <td>${r.problem || '-'}</td>
                <td>${(r.deposit || 0).toLocaleString()} تومان</td>
                <td>${(r.cost || 0).toLocaleString()} تومان</td>
                <td><span class="badge">${r.status}</span></td>
                <td>
                    <button onclick="App.openRepairModal('${r.id}')" class="btn btn-secondary btn-sm">ویرایش</button>
                    <button onclick="App.deleteRepair('${r.id}')" class="btn btn-danger btn-sm">حذف</button>
                </td>
            </tr>`;
        });
    }

    function openChequeModal(chequeId = null) {
        editingChequeId = chequeId;
        if (chequeId) {
            DB.getAll("cheques").then(cheques => {
                const ch = cheques.find(x => x.id === chequeId);
                if (ch) {
                    document.getElementById("cheque-number").value = ch.number || "";
                    document.getElementById("cheque-bank").value = ch.bank || "";
                    document.getElementById("cheque-amount").value = ch.amount || 0;
                    document.getElementById("cheque-due-date").value = ch.dueDate || "";
                    document.getElementById("cheque-cust-name").value = ch.customerName || "";
                    document.getElementById("cheque-status").value = ch.status || "پاس نشده";
                }
            });
        } else {
            document.getElementById("cheque-number").value = "";
            document.getElementById("cheque-bank").value = "";
            document.getElementById("cheque-amount").value = 0;
            document.getElementById("cheque-due-date").value = "";
            document.getElementById("cheque-cust-name").value = "";
            document.getElementById("cheque-status").value = "پاس نشده";
        }
        document.getElementById("modal-cheque").classList.add("active");
    }

    async function saveCheque() {
        const num = document.getElementById("cheque-number").value.trim();
        if (!num) return alert("شماره چک را وارد کنید.");

        const chequeData = {
            id: editingChequeId || "CHQ-" + Date.now(),
            number: num,
            bank: document.getElementById("cheque-bank").value,
            amount: parseFloat(document.getElementById("cheque-amount").value) || 0,
            dueDate: document.getElementById("cheque-due-date").value,
            customerName: document.getElementById("cheque-cust-name").value,
            status: document.getElementById("cheque-status").value,
            createdAt: editingChequeId ? undefined : getFaDateTime()
        };

        if (editingChequeId) {
            const existing = (await DB.getAll("cheques")).find(x => x.id === editingChequeId);
            if (existing) chequeData.createdAt = existing.createdAt;
        }

        await DB.put("cheques", chequeData);
        closeModals();
        loadCheques();
    }

    async function deleteCheque(id) {
        if (confirm("آیا از حذف این چک اطمینان دارید؟")) {
            await DB.deleteItem("cheques", id);
            loadCheques();
        }
    }

    async function loadCheques() {
        const cheques = await DB.getAll("cheques");
        const table = document.getElementById("cheques-table");
        if (!table) return;
        table.innerHTML = "";

        cheques.forEach(ch => {
            table.innerHTML += `<tr>
                <td>${ch.number}</td>
                <td>${ch.bank || '-'}</td>
                <td>${ch.customerName || '-'}</td>
                <td>${(ch.amount || 0).toLocaleString()} تومان</td>
                <td>${ch.dueDate || '-'}</td>
                <td>${ch.createdAt || '-'}</td>
                <td><span class="badge">${ch.status}</span></td>
                <td>
                    <button onclick="App.openChequeModal('${ch.id}')" class="btn btn-secondary btn-sm">ویرایش</button>
                    <button onclick="App.deleteCheque('${ch.id}')" class="btn btn-danger btn-sm">حذف</button>
                </td>
            </tr>`;
        });
    }

    async function updateDashboard() {
        const invoices = await DB.getAll("invoices");
        const customers = await DB.getAll("customers");

        let todaySales = 0, weeklySales = 0, monthlySales = 0, yearlySales = 0;
        let cashBalance = 0, totalProfit = 0, totalReceivables = 0;

        const todayDate = new Date().toLocaleDateString('fa-IR');

        invoices.forEach(inv => {
            cashBalance += inv.paidAmount || 0;

            if (inv.date === todayDate) todaySales += inv.totalAmount;
            weeklySales += inv.totalAmount;
            monthlySales += inv.totalAmount;
            yearlySales += inv.totalAmount;

            inv.items.forEach(item => {
                totalProfit += (item.price - (item.buyPrice || 0)) * item.qty;
            });
        });

        customers.forEach(c => {
            if (c.balance > 0) totalReceivables += c.balance;
        });

        if (document.getElementById("dash-sales-today")) document.getElementById("dash-sales-today").innerText = todaySales.toLocaleString() + " تومان";
        if (document.getElementById("dash-sales-weekly")) document.getElementById("dash-sales-weekly").innerText = weeklySales.toLocaleString() + " تومان";
        if (document.getElementById("dash-sales-monthly")) document.getElementById("dash-sales-monthly").innerText = monthlySales.toLocaleString() + " تومان";
        if (document.getElementById("dash-sales-yearly")) document.getElementById("dash-sales-yearly").innerText = yearlySales.toLocaleString() + " تومان";
        if (document.getElementById("dash-cash-balance")) document.getElementById("dash-cash-balance").innerText = cashBalance.toLocaleString() + " تومان";
        if (document.getElementById("dash-total-profit")) document.getElementById("dash-total-profit").innerText = totalProfit.toLocaleString() + " تومان";
        if (document.getElementById("dash-total-receivables")) document.getElementById("dash-total-receivables").innerText = totalReceivables.toLocaleString() + " تومان";
    }

    window.onload = init;

    return {
        showTab,
        closeModals,
        openCategoryModal,
        saveCategory,
        deleteCategory,
        openProductModal,
        saveProduct,
        deleteProduct,
        openCustomerModal,
        saveCustomer,
        deleteCustomer,
        openCustomerProfile,
        onCategoryChange,
        onCustomerChange,
        addPosItem,
        removePosItem,
        calcPosTotal,
        submitInvoice,
        openRepairModal,
        saveRepair,
        deleteRepair,
        openChequeModal,
        saveCheque,
        deleteCheque
    };
})();
