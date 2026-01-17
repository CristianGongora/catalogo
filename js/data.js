import { initGapi, signIn, getOrCreateDataFile, getFileContent, updateFileContent, uploadImage } from './drive-api.js';
import { CONFIG } from './config.js';

// Categorías iniciales como objetos { name, id }
let cachedCategories = [
    { name: 'Aretes', id: null },
    { name: 'Cadenas', id: null },
    { name: 'Candongas', id: null },
    { name: 'Pulseras', id: null },
    { name: 'Tobilleras', id: null }
];

let cachedProducts = [];


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
            // Intentar autenticación (usará token existente si está disponible)
            try {
                await signIn();
                isDriveConnected = true;
                console.log("✅ Conectado a Google Drive");
                await syncFromDrive();
            } catch (authErr) {
                console.error("Error en autenticación de Drive:", authErr);
                // Si falla la autenticación, continuamos en modo local
                console.warn("Continuando en modo local sin sincronización con Drive");
            }
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
            // Normalizar categorías antiguas (string) a objetos si es necesario
            cachedCategories = (content.categories || cachedCategories).map(cat =>
                typeof cat === 'string' ? { name: cat, id: null } : cat
            );
            cachedProducts = content.products || cachedProducts;
            console.log("✅ Datos sincronizados desde Drive");
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
    // Si la interfaz espera strings, mapeamos para compatibilidad si es necesario, 
    // pero idealmente devolvemos el objeto para tener el ID.
    return cachedCategories.map(c => c.name);
}

// Nueva función para obtener el objeto completo de categoría
export function getCategoryObjects() {
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
            // Buscar el Folder ID de la categoría
            const categoryObj = cachedCategories.find(c => c.name === product.category);
            const parentId = categoryObj ? categoryObj.id : null;

            const driveImageUrl = await uploadImage(product.image, product.title, parentId);
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

export async function addCategoryLocal(categoryName) {
    if (!cachedCategories.find(c => c.name === categoryName)) {
        let folderId = null;
        if (isDriveConnected) {
            try {
                folderId = await createFolder(categoryName);
            } catch (err) {
                console.error("Error creando carpeta para la categoría:", err);
            }
        }
        cachedCategories.push({ name: categoryName, id: folderId });
        await saveToDrive();
    }
}

export async function deleteCategoryLocal(categoryName) {
    cachedCategories = cachedCategories.filter(c => c.name !== categoryName);
    await saveToDrive();
}

export async function updateCategoryLocal(oldName, newName) {
    const index = cachedCategories.findIndex(c => c.name === oldName);
    if (index !== -1) {
        cachedCategories[index].name = newName;
        // Nota: El ID de la carpeta se mantiene igual, solo cambia el nombre visual en la app.
        // Podríamos renombrar la carpeta en Drive también si fuera necesario.
        cachedProducts.forEach(p => {
            if (p.category === oldName) p.category = newName;
        });
        await saveToDrive();
    }
}
