import { renderCategories, renderProducts, showLoading, hideLoading } from './ui.js';
import { getCategories, initData } from './data.js';
import { CONFIG } from './config.js';

// Estado de la aplicación
const state = {
    currentCategory: null,
    isAdmin: false
};

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker registrado'))
            .catch(err => console.error('Error al registrar SW:', err));
    }

    // Cargar datos iniciales
    showLoading();
    try {
        await initData();
        // Inicializar navegación solo DESPUÉS de cargar datos
        initNavigation();
        // Iniciar sincronización de fondo (2 minutos)
        startBackgroundSync();
    } catch (error) {
        console.error("Error inicializando app:", error);
        alert("Error cargando el catálogo. Revisa la consola o la configuración.");
    } finally {
        hideLoading();
    }
});

function startBackgroundSync() {
    setInterval(async () => {
        // No sincronizar si somos admin (para evitar colisiones al editar)
        const isAdmin = localStorage.getItem('adminSession') === 'true';
        if (isAdmin) return;

        console.log("🔄 Ejecutando sincronización de fondo...");
        const hasChanges = await initData();
        if (hasChanges) {
            refreshCurrentView();
        }
    }, 120000); // 2 minutos
}

function refreshCurrentView() {
    // Si estamos en admin, no refrescar agresivamente para no interrumpir formularios
    // pero si estamos en la vista de cliente, refrescar la parrilla
    if (!localStorage.getItem('adminSession') || localStorage.getItem('adminSession') === 'false') {
        if (state.currentCategory) {
            navigateToCategory(state.currentCategory);
        } else {
            loadHome();
        }
    }
}

function initNavigation() {
    const btnHome = document.getElementById('btnHome');
    const btnBack = document.getElementById('btnBack');
    const brandTitle = document.querySelector('.brand-title');
    const logoLink = document.getElementById('logoLink');
    const btnLogin = document.getElementById('btnLogin');

    // Navegación básica
    const goHome = () => {
        state.currentCategory = null;
        loadHome();
        btnHome.classList.add('active');
        btnBack.hidden = true;
    };

    btnHome.addEventListener('click', goHome);
    brandTitle.addEventListener('click', goHome);
    if (logoLink) {
        logoLink.addEventListener('click', (e) => {
            e.preventDefault();
            goHome();
        });
    }

    btnBack.addEventListener('click', () => {
        goHome();
    });

    // Verificamos sesión de admin o si hay ?admin en la URL
    import('./admin.js').then(module => {
        const urlParams = new URLSearchParams(window.location.search);
        const isAdminQuery = urlParams.has('admin');

        if (module.checkAdminSession()) {
            console.log("Sesión de admin restaurada");
        } else if (isAdminQuery) {
            module.toggleAdminMode();
        } else {
            loadHome();
        }
    });
}
// export function loadHome... (resto del archivo sigue igual, pero eliminamos la llamada explícita a loadHome() del final de initNavigation original si existía, o la manejamos arriba)

export function loadHome() {
    const main = document.getElementById('appMain');
    main.innerHTML = '<div class="category-grid" id="categoryGrid"></div>';

    import('./data.js').then(dataMod => {
        const categories = dataMod.getCategoryObjects();
        renderCategories(categories, document.getElementById('categoryGrid'), navigateToCategory);
    });

    document.getElementById('mainNav').style.display = 'flex';
    document.querySelector('.brand-subtitle').textContent = "Categorías";
}

function navigateToCategory(categoryName) {
    state.currentCategory = categoryName;
    const main = document.getElementById('appMain');
    main.innerHTML = `<div class="product-grid" id="productGrid"></div>`;

    // Mostrar botón volver
    document.getElementById('btnBack').hidden = false;
    document.getElementById('btnHome').classList.remove('active');
    document.querySelector('.brand-subtitle').textContent = categoryName;

    // Cargar productos de la categoría (simulado o real)
    // En la implementación real, filtraremos los productos cargados
    import('./data.js').then(dataMod => {
        dataMod.getProductsByCategory(categoryName).then(products => {
            renderProducts(products, document.getElementById('productGrid'));
        });
    });
}
