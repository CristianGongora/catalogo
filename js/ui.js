import { CONFIG } from './config.js';

let modalState = {
    products: [],
    currentIndex: -1
};

// Utilitario para formatear precios como COP
function formatPrice(value) {
    if (!value) return 'Consultar';

    // Si ya viene formateado con $, retornarlo tal cual pero limpiar espacios extras si hay
    if (typeof value === 'string' && value.includes('$')) {
        return value.trim();
    }

    // Si es un número o string con solo dígitos, formatear
    const num = parseFloat(String(value).replace(/[^\d]/g, ''));
    if (isNaN(num)) return value;

    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

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
    categories.forEach(catName => {
        const catObj = typeof catName === 'object' ? catName : { name: catName };
        const card = document.createElement('div');
        card.className = 'card';
        // Animación de entrada
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';

        const hasImage = catObj.image;

        card.innerHTML = `
            ${hasImage ? `
                <div class="card-image-container">
                    <img src="${catObj.image}" alt="${catObj.name}" class="card-image" loading="lazy">
                </div>
            ` : ''}
            <div class="card-content">
                ${!hasImage ? '<i class="icon-folder" style="font-size: 2rem; color: var(--color-gold); margin-bottom: 1rem; display:block;">❖</i>' : ''}
                <h3 class="card-title">${catObj.name}</h3>
                <span class="card-label">Explorar Colección</span>
            </div>
        `;

        card.addEventListener('click', () => onCategoryClick(catObj.name));
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

    products.forEach((prod, index) => {
        const card = document.createElement('div');
        card.className = 'card';

        const imgSrc = prod.image || 'assets/placeholder.png'; // Fallback

        card.innerHTML = `
            <div class="card-image-container">
                <img src="${imgSrc}" alt="${prod.title}" class="card-image" loading="lazy">
            </div>
            <div class="card-content">
                <h3 class="card-title" style="font-size: 1.2rem;">${prod.title}</h3>
                <div class="card-price" style="color: var(--color-gold-dark); font-weight: 500;">${formatPrice(prod.price)}</div>
            </div>
        `;

        card.addEventListener('click', () => {
            modalState.products = products;
            modalState.currentIndex = index;
            showProductModal();
        });
        container.appendChild(card);
    });
}

function showProductModal() {
    const modal = document.getElementById('productModal');
    const body = document.getElementById('modalBody');

    const updateModalContent = () => {
        const product = modalState.products[modalState.currentIndex];
        const imgSrc = product.image || 'assets/placeholder.png';
        const phone = typeof CONFIG !== 'undefined' && CONFIG.WHATSAPP_PHONE ? CONFIG.WHATSAPP_PHONE : 'YOUR_PHONE';

        let msg = `Hola, me interesa este producto:%0A`;
        msg += `*${product.title}*`;
        if (product.price) msg += `%0A💰 Precio: ${product.price}`;
        if (product.category) msg += `%0A📂 Categoría: ${product.category}`;
        if (imgSrc.startsWith('http')) {
            msg += `%0A🖼️ Imagen de referencia: ${encodeURIComponent(imgSrc)}`;
        }

        body.innerHTML = `
            <div class="modal-nav-container">
                <button class="modal-nav-btn prev-btn" id="prevProduct">❮</button>
                <div class="modal-product-info">
                    <div class="zoom-container" id="zoomContainer">
                        <img src="${imgSrc}" class="modal-image" id="modalImage">
                    </div>
                    <h2 style="font-family: var(--font-heading); margin-bottom: 0.5rem;">${product.title}</h2>
                    <div style="color: var(--color-gold-dark); font-weight: 500; font-size: 1.2rem; margin-bottom: 0.5rem;">${formatPrice(product.price)}</div>
                    <p style="color: var(--color-gray); margin-bottom: 1.5rem;">${product.description || 'Sin descripción'}</p>
                    <a href="https://wa.me/${phone}?text=${msg}" target="_blank" class="btn btn-whatsapp">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.031 6.172c-2.32 0-4.518.953-6.193 2.627-1.675 1.675-2.628 3.873-2.628 6.193 0 .914.149 1.807.438 2.651l-1.642 6.007 6.132-1.611c.884.343 1.83.524 2.809.524 2.32 0 4.518-.953 6.193-2.627 1.675-1.675 2.628-3.873 2.628-6.193 0-2.32-.953-4.518-2.628-6.193-1.675-1.674-3.873-2.627-6.193-2.627zm5.541 12.385c-1.48 1.48-3.447 2.295-5.541 2.295-.873 0-1.731-.144-2.547-.428l-.364-.127-3.666.963.978-3.58-.142-.234c-.26-.426-.441-.892-.538-1.378-.052-.258-.291-.433-.538-.346-.247.087-.384.354-.306.611.116.58.333 1.141.643 1.652l-.464 1.697 1.696-.464c.732.328 1.53.501 2.342.501 1.91 0 3.704-.744 5.051-2.091 1.347-1.348 2.091-3.141 2.091-5.051 0-1.91-.744-3.703-2.091-5.051-1.347-1.347-3.141-2.091-5.051-2.091-1.91 0-3.704.744-5.051 2.091-1.347 1.348-2.091 3.141-2.091 5.051 0 .614.079 1.214.234 1.791.066.251-.082.507-.333.573-.25.068-.506-.084-.573-.333-.186-.694-.282-1.416-.282-2.152 0-2.321.953-4.518 2.628-6.193s3.873-2.628 6.193-2.628c2.32 0 4.518.953 6.193 2.628 1.675 1.675 2.628 3.873 2.628 6.193 0 1.91-.744 3.703-2.091 5.051z"/>
                            <path d="M17.523 15.341c-.225-.112-1.332-.657-1.539-.732-.207-.074-.358-.112-.511.112-.152.225-.584.732-.716.882-.132.15-.264.169-.489.056-.225-.113-.951-.351-1.812-1.117-.671-.599-1.124-1.338-1.256-1.563-.132-.224-.014-.346.099-.458.102-.101.225-.263.338-.393.113-.132.15-.225.225-.376.075-.15.037-.282-.019-.393-.056-.113-.511-1.236-.7-1.69-.184-.442-.37-.381-.511-.388-.132-.007-.284-.008-.435-.008-.152 0-.399.056-.607.282-.207.225-.792.775-.792 1.89s.81 2.197.923 2.348c.113.15 1.594 2.433 3.861 3.411.539.233.959.372 1.288.477.545.173 1.04.149 1.431.09.435-.066 1.331-.544 1.519-1.07.188-.526.188-.976.132-1.07-.056-.094-.207-.15-.432-.262z"/>
                        </svg>
                        <span>Consultar por WhatsApp</span>
                    </a>
                </div>
                <button class="modal-nav-btn next-btn" id="nextProduct">❯</button>
            </div>
        `;

        const zoomContainer = document.getElementById('zoomContainer');
        const modalImage = document.getElementById('modalImage');

        // Alternar Zoom
        const toggleZoom = (e) => {
            zoomContainer.classList.toggle('zoomed');
            if (!zoomContainer.classList.contains('zoomed')) {
                modalImage.style.transformOrigin = 'center';
            } else {
                // Posicionar origen donde se hizo clic inicial si es posible
                updateZoomPosition(e);
            }
        };

        const updateZoomPosition = (e) => {
            if (!zoomContainer.classList.contains('zoomed')) return;

            const rect = zoomContainer.getBoundingClientRect();
            let x, y;

            if (e.type.startsWith('touch')) {
                x = e.touches[0].clientX - rect.left;
                y = e.touches[0].clientY - rect.top;
            } else {
                x = e.clientX - rect.left;
                y = e.clientY - rect.top;
            }

            const xPercent = (x / rect.width) * 100;
            const yPercent = (y / rect.height) * 100;

            modalImage.style.transformOrigin = `${xPercent}% ${yPercent}%`;
        };

        zoomContainer.onclick = toggleZoom;
        zoomContainer.onmousemove = updateZoomPosition;

        // Soporte Touch para Panning
        zoomContainer.ontouchmove = (e) => {
            if (zoomContainer.classList.contains('zoomed')) {
                e.preventDefault(); // Evitar scroll de página mientras se panea
                updateZoomPosition(e);
            }
        };

        // Re-adjuntar eventos de navegación
        document.getElementById('prevProduct').onclick = (e) => {
            e.stopPropagation();
            navigateModal(-1);
        };
        document.getElementById('nextProduct').onclick = (e) => {
            e.stopPropagation();
            navigateModal(1);
        };

        // Ocultar flechas si no hay más productos
        if (modalState.currentIndex <= 0) document.getElementById('prevProduct').style.visibility = 'hidden';
        if (modalState.currentIndex >= modalState.products.length - 1) document.getElementById('nextProduct').style.visibility = 'hidden';
    };

    const navigateModal = (direction) => {
        const newIndex = modalState.currentIndex + direction;
        if (newIndex >= 0 && newIndex < modalState.products.length) {
            modalState.currentIndex = newIndex;
            updateModalContent();
        }
    };

    updateModalContent();
    modal.hidden = false;

    // Gestión de gestos (Swipe)
    let touchstartX = 0;
    let touchendX = 0;

    modal.ontouchstart = (e) => {
        touchstartX = e.changedTouches[0].screenX;
    };

    modal.ontouchend = (e) => {
        touchendX = e.changedTouches[0].screenX;
        handleSwipe();
    };

    const handleSwipe = () => {
        const threshold = 50;
        if (touchendX < touchstartX - threshold) {
            navigateModal(1); // Swipe left -> Next
        }
        if (touchendX > touchstartX + threshold) {
            navigateModal(-1); // Swipe right -> Previous
        }
    };

    // Close modal settings
    modal.querySelector('.close-modal').onclick = () => {
        modal.hidden = true;
    };

    modal.onclick = (e) => {
        if (e.target === modal) modal.hidden = true;
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (modal.hidden) return;
        if (e.key === 'ArrowLeft') navigateModal(-1);
        if (e.key === 'ArrowRight') navigateModal(1);
        if (e.key === 'Escape') modal.hidden = true;
    };
    document.removeEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleKeyDown);
}
