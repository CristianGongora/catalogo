import { initGapi, signIn, getOrCreateDataFile, getFileContent, updateFileContent, createFolder, deleteFile } from './drive-api.js';
import { uploadImage as uploadToCloudinary } from './cloudinary-api.js';
import { CONFIG } from './config.js';

let cachedCategories = [];
let cachedProducts = [];


let dataFileId = null;
let isDriveConnected = false;
let hasSuccessfullyLoaded = false; // Flag de seguridad para evitar sobreescribir con vacío

/**
 * Inicializa la persistencia. Intenta conectar con Drive si hay CONFIG.
 */
export async function initData() {
    console.log("Inicializando datos...");

    // Permitir re-inicialización si pasamos a modo admin
    if (isDriveConnected && localStorage.getItem('adminSession') !== 'true') {
        // Si ya estamos conectados y NO somos admin, no hace falta hacer nada
        // Pero si somos admin, queremos forzar el flujo de login de Drive
    }

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
                // Sincronizar de nuevo con privilegios de admin para asegurar data completa
                const changes = await syncFromDrive();
                return changes;
            } catch (authErr) {
                console.error("Error en autenticación de Drive:", authErr);
            }
        }
    } catch (err) {
        console.error("Error al inicializar datos:", err);
    }
    return false;
}

async function syncFromDrive() {
    // Para lectura pública solo necesitamos gapi init con la API Key (ya hecho en initGapi)
    try {
        dataFileId = await getOrCreateDataFile();
        if (!dataFileId) return; // Nada que sincronizar

        const content = await getFileContent(dataFileId);

        // Marcar como cargado si llegamos aquí (incluso si el JSON está vacío, el archivo existe)
        hasSuccessfullyLoaded = true;

        if (content) {
            const oldData = JSON.stringify({ categories: cachedCategories, products: cachedProducts });

            // Normalizar categorías antiguas (string) a objetos si es necesario
            cachedCategories = (content.categories || cachedCategories).map(cat =>
                typeof cat === 'string' ? { name: cat, id: null } : cat
            );
            cachedProducts = content.products || cachedProducts;

            const newData = JSON.stringify({ categories: cachedCategories, products: cachedProducts });

            if (oldData !== newData) {
                console.log("🔄 Datos actualizados desde Drive (Cambios detectados)");
                return true; // Indica que hubo cambios
            }
        }
    } catch (err) {
        console.error("Error sincronizando desde Drive:", err);
    }
    return false;
}

async function saveToDrive() {
    if (!isDriveConnected || !dataFileId || !hasSuccessfullyLoaded) {
        console.warn("⚠️ Guardado cancelado: No hay conexión o no se han cargado datos previos para evitar sobreescritura.");
        return;
    }
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

    // Si hay imagen base64, subirla a Cloudinary
    if (product.image && product.image.startsWith('data:image')) {
        try {
            const cloudinaryUrl = await uploadToCloudinary(product.image);
            product.image = cloudinaryUrl;
        } catch (err) {
            console.error("Error subiendo imagen a Cloudinary, se usará base64 local:", err);
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
        // Manejar cambio de imagen en Cloudinary si es base64
        if (updatedData.image && updatedData.image.startsWith('data:image')) {
            try {
                updatedData.image = await uploadToCloudinary(updatedData.image);
            } catch (err) {
                console.error("Error subiendo nueva imagen a Cloudinary:", err);
            }
        }
        cachedProducts[index] = { ...cachedProducts[index], ...updatedData };
        await saveToDrive();
    }
}

export async function addCategoryLocal(categoryName, imageBase64 = null) {
    if (!cachedCategories.find(c => c.name === categoryName)) {
        let folderId = null;
        let imageUrl = null;
        if (isDriveConnected) {
            try {
                folderId = await createFolder(categoryName);
            } catch (err) {
                console.error("Error creando carpeta en Drive:", err);
            }
        }
        if (imageBase64) {
            try {
                imageUrl = await uploadToCloudinary(imageBase64);
            } catch (err) {
                console.error("Error subiendo imagen de categoría a Cloudinary:", err);
            }
        }
        cachedCategories.push({ name: categoryName, id: folderId, image: imageUrl || imageBase64 });
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

export async function updateCategoryLocal(oldName, newName, imageBase64 = null) {
    const index = cachedCategories.findIndex(c => c.name === oldName);
    if (index !== -1) {
        let imageUrl = cachedCategories[index].image;

        if (imageBase64 && imageBase64.startsWith('data:image')) {
            try {
                imageUrl = await uploadToCloudinary(imageBase64);
            } catch (err) {
                console.error("Error subiendo nueva imagen de categoría a Cloudinary:", err);
            }
        } else if (imageBase64) {
            imageUrl = imageBase64;
        }

        cachedCategories[index].name = newName;
        cachedCategories[index].image = imageUrl;

        cachedProducts.forEach(p => {
            if (p.category === oldName) p.category = newName;
        });
        await saveToDrive();
    }
}
