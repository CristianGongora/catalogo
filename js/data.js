import { initGapi, signIn, getOrCreateDataFile, getFileContent, updateFileContent, uploadImage, createFolder, deleteFile } from './drive-api.js';
import { CONFIG } from './config.js';

let cachedCategories = [];
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

        // Intentar cargar datos siempre (modo lectura pública)
        // syncFromDrive usará la API Key si no hay token OAuth
        await syncFromDrive();

        // Solo intentamos login OAuth si hay sesión de admin activa para habilitar edición
        if (localStorage.getItem('adminSession') === 'true') {
            try {
                await signIn();
                isDriveConnected = true;
                console.log("✅ Conectado a Google Drive (Modo Admin)");
            } catch (authErr) {
                console.error("Error en autenticación de Drive:", authErr);
            }
        }
    } catch (err) {
        console.error("Error al inicializar datos:", err);
    }
}

async function syncFromDrive() {
    // Para lectura pública solo necesitamos gapi init con la API Key (ya hecho en initGapi)
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
    const product = cachedProducts.find(p => p.id == id);
    if (product && isDriveConnected && product.image && product.image.includes('lh3.googleusercontent.com')) {
        try {
            // Extraer ID de la URL: https://lh3.googleusercontent.com/u/0/d/FILE_ID
            const parts = product.image.split('/');
            const fileId = parts[parts.length - 1];
            await deleteFile(fileId);
        } catch (err) {
            console.error("Error eliminando imagen de producto en Drive:", err);
        }
    }
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
    const categoryObj = cachedCategories.find(c => c.name === categoryName);
    if (categoryObj && categoryObj.id && isDriveConnected) {
        try {
            await deleteFile(categoryObj.id);
        } catch (err) {
            console.error("Error eliminando carpeta de categoría en Drive:", err);
        }
    }
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
