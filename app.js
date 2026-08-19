const App = (() => {
    let currentInvoiceItems = [];
    let editingProductId = null;

    async function init() {
        await DB.init();
        Auth.init();
        Sync.checkOnlineStatus();
        loadCategories();
        loadProductsTree();
        loadCustomers();
        updateAccountingReport();
    }

    function showTab(tabId) {
        document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
        document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
        document.getElementById(`tab-${tabId}`).classList.add("active");
        event.target.classList.add("active");

        if (tabId === 'accounting') updateAccountingReport();
    }

    function closeModals() {
        document.querySelectorAll(".modal-overlay").forEach(m => {
            if (m.id !== "auth-overlay") m.classList.remove("active");
        });
    }

    // --- انبار و دسته ها ---
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
        select.innerHTML = '<option value="">انتخاب دسته کالا</option>';
        cats.forEach(c => select.innerHTML += `<option value="${c.id}">${c.name}</option>`);
    }

    async function onCategoryChange() {
        const catId = document.getElementById("pos-category-select").value;
        const products = await DB.getAll("products");
        const filtered = products.filter(p => p.categoryId === catId);
        const pSelect = document.getElementById("pos-product-select");
        pSelect.innerHTML = "";
        const priceType = document.getElementById("pos-price-type").value;

        filtered.forEach(p => {
            const pPrice = priceType === 'coop' ? p.coopPrice : p.sellPrice;
            pSelect.innerHTML += `<option value="${p.id}">${p.name} - ${pPrice.toLocaleString()} تومان (موجودی: ${p.stock} ${p.unit})</option>`;
        });
    }

    async function loadProductsTree() {
        const cats = await DB.getAll("categories");
        const products = await DB.getAll("products");
        const treeContainer = document.getElementById("inventory-tree");
        treeContainer.innerHTML = "";

        cats.forEach(c => {
            const catProducts = products.filter(p => p.categoryId === c.id);
            let html = `<div class="tree-cat"><strong>📂 ${c.name}</strong>`;
            catProducts.forEach(p => {
                const isLow = p.stock <= p.minStock;
                const lowBadge = isLow ? '<span style="color:red; font-weight:bold;"> (⚠️ کمبود موجودی)</span>' : '';
                html += `<div class="tree-prod-item">
                    <span>└─ <strong>${p.name}</strong> - قیمت: ${p.sellPrice.toLocaleString()} - موجودی: ${p.stock} ${p.unit}${lowBadge}</span>
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

    // --- مشتریان ---
    function openCustomerModal() {
        document.getElementById("cust-name-input").value = "";
        document.getElementById("cust-phone-input").value = "";
        document.getElementById("cust-credit-input").value = 0;
        document.getElementById("modal-customer").classList.add("active");
    }

    async function saveCustomer() {
        const name = document.getElementById("cust-name-input").value.trim();
        if (!name) return alert("نام مشتری را وارد کنید.");

        await DB.put("customers", {
            id: "cust-" + Date.now(),
            name: name,
            phone: document.getElementById("cust-phone-input").value,
            creditLimit: parseFloat(document.getElementById("cust-credit-input").value) || 0,
            balance: 0
        });

        closeModals();
        loadCustomers();
    }

    async function loadCustomers() {
        const customers = await DB.getAll("customers");
        const select = document.getElementById("pos-customer");
        const table = document.getElementById("customers-table");
        select.innerHTML = '<option value="">مشتری عبوری</option>';
        table.innerHTML = "";

        customers.forEach(c => {
            select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            table.innerHTML += `<tr>
                <td>${c.name}</td>
                <td>${c.phone || '-'}</td>
                <td>${c.creditLimit.toLocaleString()} تومان</td>
                <td>${c.balance.toLocaleString()} تومان</td>
                <td><button onclick="App.openCustomerProfile('${c.id}')" class="btn btn-primary btn-sm">پرونده کامل</button></td>
            </tr>`;
        });
    }

    async function openCustomerProfile(custId) {
        const customers = await DB.getAll("customers");
        const c = customers.find(x => x.id === custId);
        if (!c) return;

        document.getElementById("profile-cust-name").innerText = `پرونده مشتری: ${c.name}`;
        document.getElementById("profile-details").innerHTML = `
            <p><strong>تلفن:</strong> ${c.phone || '-'}</p>
            <p><strong>سقف اعتبار:</strong> ${c.creditLimit.toLocaleString()} تومان</p>
            <p><strong>مانده بدهی/طلب فعلی:</strong> ${c.balance.toLocaleString()} تومان</p>
        `;

        const invoices = await DB.getAll("invoices");
        const cInvoices = invoices.filter(inv => inv.customerId === custId);
        const invList = document.getElementById("profile-invoices-list");
        invList.innerHTML = "";

        if (cInvoices.length === 0) {
            invList.innerHTML = "<p>هیچ فاکتوری برای این مشتری ثبت نشده است.</p>";
        } else {
            cInvoices.forEach(inv => {
                invList.innerHTML += `<div class="tree-prod-item">
                    <span>فاکتور شماره ${inv.id} - تاریخ: ${inv.date} - مبلغ کل: ${inv.total.toLocaleString()} تومان</span>
                </div>`;
            });
        }

        document.getElementById("modal-customer-profile").classList.add("active");
    }

    // --- فاکتور ساز ---
    async function addPosItem() {
        const pId = document.getElementById("pos-product-select").value;
        const qty = parseFloat(document.getElementById("pos-qty").value);
        if (!pId || !qty) return alert("کالا و تعداد را مشخص کنید.");

        const products = await DB.getAll("products");
        const product = products.find(p => p.id === pId);
        const priceType = document.getElementById("pos-price-type").value;
        const price = priceType === 'coop' ? product.coopPrice : product.sellPrice;

        currentInvoiceItems.push({
            productId: product.id,
            name: product.name,
            buyPrice: product.buyPrice,
            qty: qty,
            price: price,
            total: qty * price
        });

        renderPosItems();
    }

    function renderPosItems() {
        const tbody = document.getElementById("pos-items-table");
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

    function calcPosTotal() {
        const total = currentInvoiceItems.reduce((acc, item) => acc + item.total, 0);
        const discount = parseFloat(document.getElementById("pos-discount").value) || 0;
        const paid = parseFloat(document.getElementById("pos-paid").value) || 0;

        const finalTotal = Math.max(0, total - discount);
        const due = finalTotal - paid;

        document.getElementById("pos-total-amount").innerText = finalTotal.toLocaleString();
        document.getElementById("pos-due-amount").innerText = due.toLocaleString();
    }

    async function submitInvoice() {
        if (currentInvoiceItems.length === 0) return alert("فاکتور خالی است.");

        const custId = document.getElementById("pos-customer").value;
        const total = currentInvoiceItems.reduce((a, b) => a + b.total, 0);
        const discount = parseFloat(document.getElementById("pos-discount").value) || 0;
        const paid = parseFloat(document.getElementById("pos-paid").value) || 0;
        const finalTotal = Math.max(0, total - discount);
        const due = finalTotal - paid;

        const invoice = {
            id: "INV-" + Math.floor(100000 + Math.random() * 900000),
            date: new Date().toLocaleDateString('fa-IR'),
            customerId: custId,
            items: [...currentInvoiceItems],
            totalAmount: finalTotal,
            paidAmount: paid,
            dueAmount: due
        };

        // کسر کالاها از انبار
        const products = await DB.getAll("products");
        for (let item of currentInvoiceItems) {
            const p = products.find(x => x.id === item.productId);
            if (p) {
                p.stock -= item.qty;
                await DB.put("products", p);
            }
        }

        // بروزرسانی مانده حساب مشتری
        if (custId && due !== 0) {
            const customers = await DB.getAll("customers");
            const c = customers.find(x => x.id === custId);
            if (c) {
                c.balance = (c.balance || 0) + due;
                await DB.put("customers", c);
            }
        }

        await DB.put("invoices", invoice);
        alert("فاکتور با موفقیت ثبت گردید.");
        window.print();

        currentInvoiceItems = [];
        renderPosItems();
        loadProductsTree();
        loadCustomers();
    }

    async function updateAccountingReport() {
        const invoices = await DB.getAll("invoices");
        const customers = await DB.getAll("customers");

        let cashBalance = 0;
        let totalReceivables = 0;
        let totalProfit = 0;

        invoices.forEach(inv => {
            cashBalance += inv.paidAmount || 0;
            inv.items.forEach(item => {
                totalProfit += (item.price - (item.buyPrice || 0)) * item.qty;
            });
        });

        customers.forEach(c => {
            if (c.balance > 0) totalReceivables += c.balance;
        });

        document.getElementById("cash-balance").innerText = cashBalance.toLocaleString() + " تومان";
        document.getElementById("total-receivables").innerText = totalReceivables.toLocaleString() + " تومان";
        document.getElementById("total-profit").innerText = totalProfit.toLocaleString() + " تومان";
    }

    window.onload = init;

    return {
        showTab,
        closeModals,
        openCategoryModal,
        saveCategory,
        openProductModal,
        saveProduct,
        deleteProduct,
        openCustomerModal,
        saveCustomer,
        openCustomerProfile,
        onCategoryChange,
        addPosItem,
        removePosItem,
        calcPosTotal,
        submitInvoice
    };
})();