import { CONFIG } from './config.js';

let gapiInited = false;
let gisInited = false;
let tokenResponse = null;

/**
 * Inicializa GAPI (Google API Client)
 */
export async function initGapi() {
    return new Promise((resolve, reject) => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    apiKey: CONFIG.API_KEY,
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                });
                gapiInited = true;
                resolve();
            } catch (err) {
                console.error('Error al inicializar GAPI:', err);
                reject(err);
            }
        });
    });
}

/**
 * Autenticación mediante Google Identity Services (GIS)
 */
export async function signIn() {
    return new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.CLIENT_ID,
            scope: CONFIG.SCOPES,
            callback: (resp) => {
                if (resp.error) {
                    reject(resp);
                    return;
                }
                tokenResponse = resp;
                resolve(resp);
            },
        });
        client.requestAccessToken({ prompt: 'consent' });
    });
}

/**
 * Busca o Crea el archivo data.json en la carpeta configuradora
 */
export async function getOrCreateDataFile() {
    const fileName = 'data.json';
    const q = `name = '${fileName}' and '${CONFIG.FOLDER_ID}' in parents and trashed = false`;

    try {
        const response = await gapi.client.drive.files.list({
            q: q,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const files = response.result.files;
        if (files && files.length > 0) {
            return files[0].id;
        } else {
            // Crear archivo inicial si no existe
            const initialData = JSON.stringify({ categories: [], products: [] });
            const fileMetadata = {
                name: fileName,
                parents: [CONFIG.FOLDER_ID],
                mimeType: 'application/json'
            };
            const res = await gapi.client.drive.files.create({
                resource: fileMetadata,
                media: {
                    mimeType: 'application/json',
                    body: initialData
                }
            });
            return res.result.id;
        }
    } catch (err) {
        console.error('Error gestionando data.json:', err);
        throw err;
    }
}

/**
 * Descarga el contenido de un archivo por ID
 */
export async function getFileContent(fileId) {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        return response.result;
    } catch (err) {
        console.error('Error al leer archivo:', err);
        throw err;
    }
}

/**
 * Actualiza el contenido de un archivo JSON
 */
export async function updateFileContent(fileId, content) {
    try {
        await gapi.client.request({
            path: `/upload/drive/v3/files/${fileId}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            body: JSON.stringify(content)
        });
    } catch (err) {
        console.error('Error actualizando archivo:', err);
        throw err;
    }
}

/**
 * Sube una imagen Base64 a Drive y retorna su URL pública (enrutada para visualización)
 */
export async function uploadImage(base64Data, fileName) {
    // Extraer tipo y limpiar base64
    const parts = base64Data.split(';base64,');
    const mimeType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    const blob = new Blob([uInt8Array], { type: mimeType });

    const metadata = {
        name: fileName + '_' + Date.now(),
        parents: [CONFIG.FOLDER_ID],
        mimeType: mimeType
    };

    try {
        // En Drive v3 la subida multipart con gapi.client es compleja, usamos fetch para simplicidad y robustez
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.auth.getToken().access_token }),
            body: form
        });
        const result = await response.json();

        // Hacer el archivo público para lectura (requerido para el catálogo)
        await gapi.client.drive.permissions.create({
            fileId: result.id,
            resource: { role: 'reader', type: 'anyone' }
        });

        // Retornar URL de vista previa directa (thumbnailLink es pequeño, usamos webContentLink o similar)
        // Para visualización directa en <img> usamos la API de Drive con un proxy o el ID directamente
        return `https://lh3.googleusercontent.com/u/0/d/${result.id}`; // Hack común para Drive Images o usaría el ID
    } catch (err) {
        console.error('Error subiendo imagen:', err);
        throw err;
    }
}
