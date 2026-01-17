import { CONFIG } from './config.js';

/**
 * Supabase API Client
 * Usamos fetch directo a la REST API para mantener la app ligera sin dependencias externas pesadas.
 */

const BASE_URL = `${CONFIG.SUPABASE_URL}/rest/v1`;
const HEADERS = {
    'apikey': CONFIG.SUPABASE_KEY,
    'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

export async function fetchCatalog() {
    try {
        console.log("🔗 URL Supabase:", `${BASE_URL}/catalog?select=data&limit=1`);
        const response = await fetch(`${BASE_URL}/catalog?select=data&limit=1`, {
            method: 'GET',
            headers: HEADERS
        });

        console.log("📡 Status Supabase:", response.status, response.statusText);

        if (!response.ok) {
            const errText = await response.text();
            console.error("❌ Error Supabase Detalle:", errText);
            throw new Error('Error al conectar con Supabase: ' + response.status);
        }

        const result = await response.json();
        console.log("📊 Resultado JSON Supabase:", result);
        if (result && result.length > 0) {
            return result[0].data;
        }

        // Si no hay datos, devolvemos un estado inicial
        return { categories: [], products: [] };
    } catch (error) {
        console.error('Error en fetchCatalog:', error);
        throw error;
    }
}

export async function saveCatalog(data) {
    try {
        // Actualizamos la fila con ID 1 (asumimos que existe según las instrucciones al usuario)
        // Usamos upsert o simplemente update si sabemos el ID.
        // Dado el script SQL, la primera fila tendrá ID auto-generado, buscaremos la primera.

        // Primero buscamos el ID de la primera fila
        const searchResponse = await fetch(`${BASE_URL}/catalog?select=id&limit=1`, {
            method: 'GET',
            headers: HEADERS
        });
        const rows = await searchResponse.json();

        if (rows && rows.length > 0) {
            const rowId = rows[0].id;
            const response = await fetch(`${BASE_URL}/catalog?id=eq.${rowId}`, {
                method: 'PATCH',
                headers: HEADERS,
                body: JSON.stringify({ data: data, updated_at: new Date().toISOString() })
            });
            if (!response.ok) throw new Error('Error al actualizar Supabase');
            return true;
        } else {
            // Si por alguna razón no hay filas, creamos una
            const response = await fetch(`${BASE_URL}/catalog`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({ data: data })
            });
            if (!response.ok) throw new Error('Error al crear fila en Supabase');
            return true;
        }
    } catch (error) {
        console.error('Error en saveCatalog:', error);
        throw error;
    }
}
