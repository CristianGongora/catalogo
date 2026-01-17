import { fetchCatalog, saveCatalog } from './supabase-api.js';
import { uploadImage as uploadToCloudinary } from './cloudinary-api.js';
import { CONFIG } from './config.js';

let cachedCategories = [];
let cachedProducts = [];

let isConnected = false;
let hasSuccessfullyLoaded = false;

/**
 * Inicializa la persistencia con Supabase.
 */
export async function initData() {
    console.log("Inicializando datos con Supabase...");

    try {
        // En Supabase la conexión es instantánea mediante fetch
        const changes = await syncFromSupabase();
        isConnected = true;

        if (localStorage.getItem('adminSession') === 'true') {
            console.log("✅ Sesión de administrador activa");
        }

        return changes;
    } catch (err) {
        console.error("Error al inicializar datos:", err);
    }
    return false;
}

async function syncFromSupabase() {
    try {
        const content = await fetchCatalog();
        hasSuccessfullyLoaded = true;

        if (content) {
            const oldData = JSON.stringify({ categories: cachedCategories, products: cachedProducts });

            cachedCategories = (content.categories || []).map(cat =>
                typeof cat === 'string' ? { name: cat, id: null } : cat
            );
            cachedProducts = content.products || [];

            const newData = JSON.stringify({ categories: cachedCategories, products: cachedProducts });

            if (oldData !== newData) {
                console.log("🔄 Datos actualizados desde Supabase");
                return true;
            }
        }
    } catch (err) {
        console.error("Error sincronizando desde Supabase:", err);
    }
    return false;
}

async function saveToSupabase() {
    if (!hasSuccessfullyLoaded) {
        console.warn("⚠️ Guardado cancelado: No se han cargado datos previos.");
        return;
    }
    try {
        await saveCatalog({
            categories: cachedCategories,
            products: cachedProducts
        });
    } catch (err) {
        console.error("Error guardando en Supabase:", err);
    }
}

export function getCategories() {
    return cachedCategories.map(c => c.name);
}

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

    if (product.image && product.image.startsWith('data:image')) {
        try {
            product.image = await uploadToCloudinary(product.image);
        } catch (err) {
            console.error("Error subiendo imagen a Cloudinary:", err);
        }
    }

    cachedProducts.push(product);
    await saveToSupabase();
}

export async function deleteProductLocal(id) {
    cachedProducts = cachedProducts.filter(p => p.id != id);
    await saveToSupabase();
}

export async function updateProductLocal(id, updatedData) {
    const index = cachedProducts.findIndex(p => p.id == id);
    if (index !== -1) {
        if (updatedData.image && updatedData.image.startsWith('data:image')) {
            try {
                updatedData.image = await uploadToCloudinary(updatedData.image);
            } catch (err) {
                console.error("Error subiendo nueva imagen a Cloudinary:", err);
            }
        }
        cachedProducts[index] = { ...cachedProducts[index], ...updatedData };
        await saveToSupabase();
    }
}

export async function addCategoryLocal(categoryName, imageBase64 = null) {
    if (!cachedCategories.find(c => c.name === categoryName)) {
        let imageUrl = null;
        if (imageBase64) {
            try {
                imageUrl = await uploadToCloudinary(imageBase64);
            } catch (err) {
                console.error("Error subiendo imagen de categoría:", err);
            }
        }
        cachedCategories.push({ name: categoryName, id: null, image: imageUrl || imageBase64 });
        await saveToSupabase();
    }
}

export async function deleteCategoryLocal(categoryName) {
    cachedCategories = cachedCategories.filter(c => c.name !== categoryName);
    await saveToSupabase();
}

export async function updateCategoryLocal(oldName, newName, imageBase64 = null) {
    const index = cachedCategories.findIndex(c => c.name === oldName);
    if (index !== -1) {
        let imageUrl = cachedCategories[index].image;

        if (imageBase64 && imageBase64.startsWith('data:image')) {
            try {
                imageUrl = await uploadToCloudinary(imageBase64);
            } catch (err) {
                console.error("Error subiendo nueva imagen de categoría:", err);
            }
        } else if (imageBase64) {
            imageUrl = imageBase64;
        }

        cachedCategories[index].name = newName;
        cachedCategories[index].image = imageUrl;

        cachedProducts.forEach(p => {
            if (p.category === oldName) p.category = newName;
        });
        await saveToSupabase();
    }
}
