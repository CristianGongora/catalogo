import { CONFIG } from './config.js';

// Funciones de utilidad para el DOM

export function showLoading() {
    const spinner = document.getElementById('loading-container');
    if (spinner) spinner.style.display = 'flex';
}

export function hideLoading() {
    const spinner = document.getElementById('loading-container');
    if (spinner) spinner.style.display = 'none';
}

export function renderCategories(categories, container, onCategoryClick) {
    container.innerHTML = '';
    categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'card';
        // Animación de entrada
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';

        card.innerHTML = `
            <div class="card-content">
                <i class="icon-folder" style="font-size: 2rem; color: var(--color-gold); margin-bottom: 1rem; display:block;">❖</i>
                <h3 class="card-title">${cat}</h3>
                <span class="card-label">Explorar Colección</span>
            </div>
        `;

        card.addEventListener('click', () => onCategoryClick(cat));
        container.appendChild(card);

        // Trigger reflow para animación
        requestAnimationFrame(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        });
    });
}

export function renderProducts(products, container) {
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = '<p style="text-align:center; width:100%; grid-column: 1/-1;">No hay productos en esta categoría aún.</p>';
        return;
    }

    products.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'card';

        const imgSrc = prod.image || 'assets/placeholder.png'; // Fallback

        card.innerHTML = `
            <div class="card-image-container">
                <img src="${imgSrc}" alt="${prod.title}" class="card-image" loading="lazy">
            </div>
            <div class="card-content">
                <h3 class="card-title" style="font-size: 1.2rem;">${prod.title}</h3>
                <div class="card-price" style="color: var(--color-gold-dark); font-weight: 500;">${prod.price || 'Consultar'}</div>
            </div>
        `;

        card.addEventListener('click', () => showProductModal(prod));
        container.appendChild(card);
    });
}

function showProductModal(product) {
    const modal = document.getElementById('productModal');
    const body = document.getElementById('modalBody');

    const imgSrc = product.image || 'assets/placeholder.png';

    const phone = typeof CONFIG !== 'undefined' && CONFIG.WHATSAPP_PHONE ? CONFIG.WHATSAPP_PHONE : 'YOUR_PHONE';

    // Construir mensaje detallado
    let msg = `Hola, me interesa este producto:%0A`;
    msg += `*${product.title}*`; // Negrita
    if (product.price) msg += `%0A💰 Precio: ${product.price}`;
    if (product.category) msg += `%0A📂 Categoría: ${product.category}`;

    // Solo agregar link de imagen si es una URL http/https (evitar Base64 largos)
    if (imgSrc.startsWith('http')) {
        msg += `%0A🖼️ Imagen de referencia: ${encodeURIComponent(imgSrc)}`;
    }

    body.innerHTML = `
        <div style="text-align: center;">
            <img src="${imgSrc}" style="max-width: 100%; max-height: 50vh; object-fit: contain; margin-bottom: 1rem; border-radius: 8px;">
            <h2 style="font-family: var(--font-heading); margin-bottom: 0.5rem;">${product.title}</h2>
            <div style="color: var(--color-gold-dark); font-weight: 500; font-size: 1.2rem; margin-bottom: 0.5rem;">${product.price ? product.price : ''}</div>
            <p style="color: var(--color-gray); margin-bottom: 1.5rem;">${product.description || 'Sin descripción'}</p>
            <a href="https://wa.me/${phone}?text=${msg}" target="_blank" class="btn btn-primary" style="display:inline-block; text-decoration:none; padding: 1rem 2rem;">
                <span style="font-size: 1.2rem; vertical-align: middle;">✆</span> Consultar por WhatsApp
            </a>
        </div>
    `;

    modal.hidden = false;

    modal.querySelector('.close-modal').onclick = () => {
        modal.hidden = true;
    };

    modal.onclick = (e) => {
        if (e.target === modal) modal.hidden = true;
    }
}
