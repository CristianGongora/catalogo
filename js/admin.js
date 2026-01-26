import { getCategories, getCategoryObjects, getAllProducts, addProductLocal, addCategoryLocal, deleteCategoryLocal, updateCategoryLocal, deleteProductLocal, updateProductLocal } from './data.js';
import { renderCategories } from './ui.js';
import { loadHome } from './app.js';
import { CONFIG } from './config.js';

export function checkAdminSession() {
    if (localStorage.getItem('adminSession') === 'true') {
        loadAdminDashboard();
        return true;
    }
    return false;
}

export function toggleAdminMode() {
    if (checkAdminSession()) return;
    openLoginModal();
}

// --- UTILS MODALES ---
function openInfoModal(title, msg) {
    const modal = document.getElementById('infoModal');
    if (!modal) {
        alert(msg);
        return;
    }
    document.getElementById('infoTitle').textContent = title;
    document.getElementById('infoMsg').textContent = msg;
    modal.hidden = false;

    document.getElementById('btnOkInfo').onclick = () => {
        modal.hidden = true;
    };
    modal.onclick = (e) => { if (e.target === modal) modal.hidden = true; };
}

function openGenericConfirmModal(title, msg, onConfirm) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;

    const btnYes = document.getElementById('btnYesConfirm');
    btnYes.className = 'btn btn-primary';
    btnYes.style = '';
    btnYes.textContent = 'Aceptar';

    modal.hidden = false;

    const newBtnYes = btnYes.cloneNode(true);
    btnYes.parentNode.replaceChild(newBtnYes, btnYes);

    const btnNo = document.getElementById('btnCancelConfirm');
    const newBtnNo = btnNo.cloneNode(true);
    btnNo.parentNode.replaceChild(newBtnNo, btnNo);

    newBtnYes.onclick = () => {
        modal.hidden = true;
        onConfirm();
    };
    newBtnNo.onclick = () => { modal.hidden = true; };
    modal.onclick = (e) => { if (e.target === modal) modal.hidden = true; };
}

function openDeleteConfirmModal(msg, onConfirm) {
    openGenericConfirmModal('Eliminar', msg, onConfirm);
    const btnYes = document.getElementById('btnYesConfirm');
    btnYes.className = 'btn btn-danger';
    btnYes.textContent = 'Eliminar';
}

function openLoginModal() {
    const modal = document.getElementById('loginModal');
    const input = document.getElementById('adminPasswordInput');
    const btnEnter = document.getElementById('btnLoginConfirm');
    const btnCancel = document.getElementById('btnCancelLogin');

    input.value = '';
    modal.hidden = false;
    input.focus();

    const newBtnEnter = btnEnter.cloneNode(true);
    btnEnter.parentNode.replaceChild(newBtnEnter, btnEnter);

    const newBtnCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    newBtnEnter.onclick = () => {
        const password = input.value;
        if (password === CONFIG.ADMIN_PASSWORD) {
            localStorage.setItem('adminSession', 'true');
            modal.hidden = true;

            // Disparar sincronización con Supabase inmediatamente sin recargar
            import('./data.js').then(dataMod => {
                dataMod.initData().then(() => {
                    console.log("🔄 Datos sincronizados tras login de admin");
                    loadAdminDashboard();
                });
            });

            // Limpiar parámetro de la URL
            const url = new URL(window.location);
            url.searchParams.delete('admin');
            window.history.replaceState({}, '', url);
        } else {
            openInfoModal('Error', 'Contraseña incorrecta');
            input.value = '';
            input.focus();
        }
    };

    newBtnCancel.onclick = () => {
        modal.hidden = true;
        // Si cancela y venía por ?admin, cargar home
        loadHome();
    };
    modal.onclick = (e) => { if (e.target === modal) modal.hidden = true; };

    input.onkeyup = (e) => {
        if (e.key === 'Enter') newBtnEnter.click();
    };
}

// Utilitario para mostrar precio formateado en admin
function formatPriceAdmin(value) {
    if (!value) return 'Sin precio';
    let clean = String(value).replace(/[^\d]/g, '');
    if (!clean) return value;
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(clean);
}


function loadAdminDashboard() {
    const main = document.getElementById('appMain');
    main.innerHTML = `
        <div class="admin-controls">
            <h2>Panel de Administración</h2>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button class="btn btn-primary" id="btnAddProduct">Nuevo Producto</button>
                <button class="btn" id="btnManageProducts">Gestionar Productos</button>
                <button class="btn" id="btnManageCats">Categorías</button>
                <button class="btn" id="btnExitAdmin" style="background:#eee; color:#333;">Salir</button>
            </div>
        </div>
        <div id="adminContent">
            <p>Seleccione una opción arriba para comenzar.</p>
        </div>
    `;

    document.getElementById('btnExitAdmin').onclick = () => {
        openGenericConfirmModal('Cerrar Sesión', '¿Estás seguro de que quieres salir del modo administrador?', () => {
            localStorage.removeItem('adminSession');
            window.location.reload();
        });
    };

    document.getElementById('btnAddProduct').onclick = showAddProductForm;
    document.getElementById('btnManageProducts').onclick = showManageProducts;
    document.getElementById('btnManageCats').onclick = showManageCategories;

    document.getElementById('mainNav').style.display = 'none';
}

function updateActiveTab(buttonId) {
    const buttons = document.querySelectorAll('.admin-controls .btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(buttonId);
    if (activeBtn) activeBtn.classList.add('active');
}

function showAddProductForm() {
    updateActiveTab('btnAddProduct');
    const content = document.getElementById('adminContent');
    const categories = getCategories();

    content.innerHTML = `
        <div class="card" style="padding: 2rem; max-width: 600px; margin: 0 auto;">
            <h3 class="card-title">Agregar Nuevo Producto</h3>
            <form id="productForm">
                <div style="margin-bottom: 1rem;">
                    <label style="display:block; margin-bottom:0.5rem">Título</label>
                    <input type="text" name="title" required style="width:100%; padding:0.5rem; border:1px solid #ddd; border-radius:4px;">
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display:block; margin-bottom:0.5rem">Categoría</label>
                    <select name="category" required style="width:100%; padding:0.5rem; border:1px solid #ddd; border-radius:4px;">
                        ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>

                <div style="margin-bottom: 1rem;">
                    <label style="display:block; margin-bottom:0.5rem">Precio</label>
                    <input type="text" name="price" placeholder="Ej: $150.000" style="width:100%; padding:0.5rem; border:1px solid #ddd; border-radius:4px;">
                </div>

                <div style="margin-bottom: 1rem;">
                    <label style="display:block; margin-bottom:0.5rem">Imagen</label>
                    <input type="file" name="image" accept="image/*" required style="width:100%;">
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display:block; margin-bottom:0.5rem">Descripción</label>
                    <textarea name="description" rows="3" style="width:100%; padding:0.5rem; border:1px solid #ddd; border-radius:4px;"></textarea>
                </div>
                
                <button type="submit" class="btn btn-primary" style="width:100%">Guardar Producto</button>
            </form>
        </div>
    `;

    document.getElementById('productForm').onsubmit = handleProductSubmit;
}

async function handleProductSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const file = form.image.files[0];

    const reader = new FileReader();
    reader.onload = async function (event) {
        const product = {
            title: form.title.value,
            category: form.category.value,
            price: form.price.value,
            description: form.description.value,
            image: event.target.result
        };
        await addProductLocal(product);
        openInfoModal('Éxito', 'Producto agregado correctamente');
        form.reset();
    };
    reader.readAsDataURL(file);
}

function showManageProducts() {
    updateActiveTab('btnManageProducts');
    const content = document.getElementById('adminContent');
    const products = getAllProducts();

    const listHtml = products.map(p => `
        <li style="padding:0.8rem; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:1rem;">
                <img src="${p.image}" style="width:40px; height:40px; object-fit:contain; border-radius:4px; background:#fff; border:1px solid #eee;">
                <div>
                    <div style="font-weight:500;">${p.title}</div>
                    <div style="font-size:0.8rem; color:var(--color-gold-dark); font-weight:500;">${formatPriceAdmin(p.price)}</div>
                    <div style="font-size:0.8rem; color:#666;">${p.category}</div>
                </div>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn-edit-prod" data-id="${p.id}" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Editar">✏️</button>
                <button class="btn-delete-prod" data-id="${p.id}" data-title="${p.title}" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Eliminar">🗑️</button>
            </div>
        </li>
    `).join('');

    content.innerHTML = `
        <div class="card" style="padding: 2rem; max-width: 800px; margin: 0 auto;">
            <h3 class="card-title">Gestionar Productos (${products.length})</h3>
            <ul style="list-style:none; margin-bottom: 2rem; max-height:500px; overflow-y:auto;" id="prodList">
                ${listHtml}
            </ul>
        </div>
    `;

    content.querySelectorAll('.btn-edit-prod').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.id;
            const product = products.find(p => p.id == id);
            if (product) openEditProductModal(product);
        };
    });

    content.querySelectorAll('.btn-delete-prod').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.id;
            const title = btn.dataset.title;
            openDeleteConfirmModal(`¿Seguro que deseas eliminar el producto "${title}"?`, async () => {
                await deleteProductLocal(id);
                showManageProducts();
            });
        };
    });
}

function openEditProductModal(product) {
    const modal = document.getElementById('editProductModal');
    const form = document.getElementById('editProductForm');

    document.getElementById('editProdId').value = product.id;
    document.getElementById('editProdTitle').value = product.title;
    document.getElementById('editProdPrice').value = product.price || '';
    document.getElementById('editProdDesc').value = product.description || '';

    const catSelect = document.getElementById('editProdCategory');
    const categories = getCategories();
    catSelect.innerHTML = categories.map(c =>
        `<option value="${c}" ${c === product.category ? 'selected' : ''}>${c}</option>`
    ).join('');

    modal.hidden = false;

    form.onsubmit = async (e) => {
        e.preventDefault();

        const fileInput = document.getElementById('editProdImage');
        let newImage = product.image;

        if (fileInput.files && fileInput.files[0]) {
            const reader = new FileReader();
            const promise = new Promise((resolve) => {
                reader.onload = (event) => resolve(event.target.result);
            });
            reader.readAsDataURL(fileInput.files[0]);
            newImage = await promise;
        }

        const updatedData = {
            title: document.getElementById('editProdTitle').value,
            category: document.getElementById('editProdCategory').value,
            price: document.getElementById('editProdPrice').value,
            description: document.getElementById('editProdDesc').value,
            image: newImage
        };

        await updateProductLocal(product.id, updatedData);
        modal.hidden = true;
        fileInput.value = '';
        showManageProducts();
    };

    document.getElementById('btnCancelEditProd').onclick = () => {
        document.getElementById('editProdImage').value = '';
        modal.hidden = true;
    };
    modal.onclick = (e) => { if (e.target === modal) modal.hidden = true; };
}

function showManageCategories() {
    updateActiveTab('btnManageCats');
    const content = document.getElementById('adminContent');
    const categories = getCategories();

    const allCategoryObjects = getCategoryObjects();
    const listHtml = categories.map(c => {
        const catObj = allCategoryObjects.find(cat => cat.name === c) || {};
        return `
        <li style="padding:0.8rem; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:1rem;">
                ${catObj.image ? `<img src="${catObj.image}" style="width:40px; height:40px; object-fit:contain; border-radius:4px; background:#fff; border:1px solid #eee;">` : '<span style="font-size:1.5rem;">❖</span>'}
                <span class="cat-name">${c}</span>
            </div>
            <div style="display:flex; gap:0.5rem;">
                <button class="btn-edit" data-cat="${c}" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Editar">✏️</button>
                <button class="btn-delete-cat" data-cat="${c}" style="background:none; border:none; cursor:pointer; font-size:1.2rem;" title="Eliminar">🗑️</button>
            </div>
        </li>
    `}).join('');

    content.innerHTML = `
        <div class="card" style="padding: 2rem; max-width: 600px; margin: 0 auto;">
            <h3 class="card-title">Gestionar Categorías</h3>
            <ul style="list-style:none; margin-bottom: 2rem;" id="catList">
                ${listHtml}
            </ul>
            <div style="display:flex; flex-direction:column; gap:0.5rem; border-top: 1px solid #eee; padding-top: 1rem;">
                <input type="text" id="newCatInput" placeholder="Nombre de categoría..." style="padding:0.8rem; border:1px solid #ddd; border-radius:4px;">
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <input type="file" id="newCatImage" accept="image/*" style="flex:1;">
                    <button id="btnAddCat" class="btn btn-primary">Agregar</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btnAddCat').onclick = async () => {
        const input = document.getElementById('newCatInput');
        const fileInput = document.getElementById('newCatImage');
        const val = input.value.trim();

        let imageBase64 = null;
        if (fileInput.files && fileInput.files[0]) {
            const reader = new FileReader();
            imageBase64 = await new Promise(resolve => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(fileInput.files[0]);
            });
        }

        if (val) {
            await addCategoryLocal(val, imageBase64);
            showManageCategories();
        }
    };

    content.querySelectorAll('.btn-edit').forEach(btn => {
        btn.onclick = () => {
            openEditCategoryModal(btn.dataset.cat);
        };
    });

    content.querySelectorAll('.btn-delete-cat').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.cat; // Usar id o nombre según implementación, data.js usa nombre
            openDeleteConfirmModal(`¿Seguro que deseas eliminar la categoría "${btn.dataset.cat}"?`, async () => {
                await deleteCategoryLocal(btn.dataset.cat);
                showManageCategories();
            });
        };
    });
}

function openEditCategoryModal(currentName) {
    const modal = document.getElementById('editCategoryModal');
    const input = document.getElementById('editCatInput');
    const btnSave = document.getElementById('btnSaveEdit');
    const btnCancel = document.getElementById('btnCancelEdit');

    input.value = currentName;
    modal.hidden = false;
    input.focus();

    const newBtnSave = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtnSave, btnSave);

    const newBtnCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    newBtnSave.onclick = async () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            await updateCategoryLocal(currentName, newName);
            modal.hidden = true;
            showManageCategories();
        } else {
            modal.hidden = true;
        }
    };
    newBtnCancel.onclick = () => { modal.hidden = true; };
    modal.onclick = (e) => { if (e.target === modal) modal.hidden = true; };
}
