import { initGapi, signIn, getOrCreateDataFile, getFileContent, updateFileContent, uploadImage } from './drive-api.js';
import { CONFIG } from './config.js';

let cachedCategories = ['Aretes', 'Cadenas', 'Candongas', 'Pulseras', 'Tobilleras'];
let cachedProducts = [
    { id: 1, title: 'Aretes de Oro 18k', category: 'Aretes', price: '$150.000', description: 'Aretes elegantes con diseño floral.', image: 'https://placehold.co/400x400/D4AF37/white?text=Aretes' },
    { id: 2, title: 'Cadena Cubana', category: 'Cadenas', price: '$450.000', description: 'Cadena tejido cubano, alta calidad.', image: 'https://placehold.co/400x400/2C2C2C/white?text=Cadena' },
    { id: 3, title: 'Candongas Medianas', category: 'Candongas', price: '$120.000', description: 'Candongas clásicas para uso diario.', image: 'https://placehold.co/400x400/F4E5B2/2C2C2C?text=Candongas' }
];

let dataFileId = null;
let isDriveConnected = false;

/**
 * Inicializa la persistencia. Intenta conectar con Drive si hay CONFIG.
 */
export async function initData() {
    console.log("Inicializando datos...");

    // Si no hay Folder ID o API Key, trabajamos solo en local (Demo)
    if (!CONFIG.FOLDER_ID || !CONFIG.API_KEY || !CONFIG.CLIENT_ID) {
        console.warn("Faltan credenciales de Google Drive en config.js. Iniciando en modo DEMO local.");
        return;
    }

    try {
        await initGapi();
        // Solo intentamos login si hay sesión de admin activa
        if (localStorage.getItem('adminSession') === 'true') {
            await signIn();
            isDriveConnected = true;
            await syncFromDrive();
        } else {
            // Cargar desde caché local si existe (opcional, por ahora demo)
            console.log("Modo visualizador: Usando datos locales.");
        }
    } catch (err) {
        console.error("Error al conectar con Drive:", err);
    }
}

async function syncFromDrive() {
    if (!isDriveConnected) return;
    try {
        dataFileId = await getOrCreateDataFile();
        const content = await getFileContent(dataFileId);
        if (content) {
            cachedCategories = content.categories || cachedCategories;
            cachedProducts = content.products || cachedProducts;
        }
    } catch (err) {
        console.error("Error sincronizando desde Drive:", err);
    }
}

async function saveToDrive() {
    if (!isDriveConnected || !dataFileId) return;
    try {
        await updateFileContent(dataFileId, {
            categories: cachedCategories,
            products: cachedProducts
        });
    } catch (err) {
        console.error("Error guardando en Drive:", err);
    }
}

export function getCategories() {
    return cachedCategories;
}

export async function getProductsByCategory(category) {
    return cachedProducts.filter(p => p.category === category);
}

export function getAllProducts() {
    return cachedProducts;
}

export async function addProductLocal(product) {
    product.id = Date.now();

    // Si hay imagen base64 y Drive está conectado, subirla primero
    if (product.image && product.image.startsWith('data:image') && isDriveConnected) {
        try {
            const driveImageUrl = await uploadImage(product.image, product.title);
            product.image = driveImageUrl;
        } catch (err) {
            console.error("Error subiendo imagen a Drive, se usará base64 local:", err);
        }
    }

    cachedProducts.push(product);
    await saveToDrive();
}

export async function deleteProductLocal(id) {
    cachedProducts = cachedProducts.filter(p => p.id != id);
    await saveToDrive();
}

export async function updateProductLocal(id, updatedData) {
    const index = cachedProducts.findIndex(p => p.id == id);
    if (index !== -1) {
        // Manejar cambio de imagen en Drive si es base64
        if (updatedData.image && updatedData.image.startsWith('data:image') && isDriveConnected) {
            try {
                updatedData.image = await uploadImage(updatedData.image, updatedData.title);
            } catch (err) {
                console.error("Error subiendo nueva imagen:", err);
            }
        }
        cachedProducts[index] = { ...cachedProducts[index], ...updatedData };
        await saveToDrive();
    }
}

export async function addCategoryLocal(category) {
    if (!cachedCategories.includes(category)) {
        cachedCategories.push(category);
        await saveToDrive();
    }
}

export async function deleteCategoryLocal(category) {
    cachedCategories = cachedCategories.filter(c => c !== category);
    await saveToDrive();
}

export async function updateCategoryLocal(oldName, newName) {
    const index = cachedCategories.indexOf(oldName);
    if (index !== -1) {
        cachedCategories[index] = newName;
        cachedProducts.forEach(p => {
            if (p.category === oldName) p.category = newName;
        });
        await saveToDrive();
    }
}
