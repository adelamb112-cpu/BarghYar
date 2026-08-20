const DB = (() => {
    let db = null;

    function init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("BarghYarDB", 4);
            request.onupgradeneeded = (e) => {
                db = e.target.result;
                if (!db.objectStoreNames.contains("categories")) db.createObjectStore("categories", { keyPath: "id" });
                if (!db.objectStoreNames.contains("products")) db.createObjectStore("products", { keyPath: "id" });
                if (!db.objectStoreNames.contains("customers")) db.createObjectStore("customers", { keyPath: "id" });
                if (!db.objectStoreNames.contains("invoices")) db.createObjectStore("invoices", { keyPath: "id" });
                if (!db.objectStoreNames.contains("cheques")) db.createObjectStore("cheques", { keyPath: "id" });
                if (!db.objectStoreNames.contains("repairs")) db.createObjectStore("repairs", { keyPath: "id" });
                if (!db.objectStoreNames.contains("payments")) db.createObjectStore("payments", { keyPath: "id" });
            };
            request.onsuccess = (e) => {
                db = e.target.result;
                seedDefaults();
                resolve();
            };
            request.onerror = (e) => reject(e);
        });
    }

    async function seedDefaults() {
        const cats = await getAll("categories");
        if (cats.length === 0) {
            const defaultCats = [
                { id: "cat-1", name: "لامپ" },
                { id: "cat-2", name: "سیم و کابل" },
                { id: "cat-3", name: "فیوز" }
            ];
            for (let c of defaultCats) await put("categories", c);

            const defaultProducts = [
                { id: "p-1", categoryId: "cat-1", name: "7 وات", unit: "عدد", buyPrice: 15000, sellPrice: 22000, coopPrice: 19000, stock: 40, minStock: 10 },
                { id: "p-2", categoryId: "cat-1", name: "9 وات", unit: "عدد", buyPrice: 20000, sellPrice: 28000, coopPrice: 25000, stock: 50, minStock: 10 },
                { id: "p-3", categoryId: "cat-2", name: "سیم 1.5", unit: "متر", buyPrice: 12000, sellPrice: 18000, coopPrice: 15000, stock: 500, minStock: 100 },
                { id: "p-4", categoryId: "cat-3", name: "16A", unit: "عدد", buyPrice: 35000, sellPrice: 50000, coopPrice: 43000, stock: 25, minStock: 5 }
            ];
            for (let p of defaultProducts) await put("products", p);
        }
    }

    function put(storeName, data) {
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).put(data);
            tx.oncomplete = () => resolve();
        });
    }

    function deleteItem(storeName, id) {
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).delete(id);
            tx.oncomplete = () => resolve();
        });
    }

    function getAll(storeName) {
        return new Promise((resolve) => {
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
        });
    }

    async function exportBackup() {
        const data = {
            categories: await getAll("categories"),
            products: await getAll("products"),
            customers: await getAll("customers"),
            invoices: await getAll("invoices"),
            cheques: await getAll("cheques"),
            repairs: await getAll("repairs"),
            payments: await getAll("payments")
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `BarghYar-Backup-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    }

    function importBackup(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = JSON.parse(event.target.result);
            for (let key in data) {
                for (let item of data[key]) {
                    await put(key, item);
                }
            }
            alert("بازیابی فایل پشتیبان با موفقیت انجام شد.");
            location.reload();
        };
        reader.readAsText(file);
    }

    return { init, put, deleteItem, getAll, exportBackup, importBackup };
})();
