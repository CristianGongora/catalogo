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
    // Verificar si hay un token guardado y válido
    const savedToken = localStorage.getItem('gdrive_token');
    const tokenExpiry = localStorage.getItem('gdrive_token_expiry');

    if (savedToken && tokenExpiry) {
        const now = Date.now();
        if (now < parseInt(tokenExpiry)) {
            // Token aún válido, usarlo
            console.log("✅ Usando token guardado");
            tokenResponse = { access_token: savedToken };
            gapi.client.setToken({ access_token: savedToken });
            return Promise.resolve(tokenResponse);
        } else {
            // Token expirado, limpiar
            console.log("⚠️ Token expirado, solicitando nuevo");
            localStorage.removeItem('gdrive_token');
            localStorage.removeItem('gdrive_token_expiry');
        }
    }

    // No hay token válido, solicitar nuevo
    return new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.CLIENT_ID,
            scope: CONFIG.SCOPES,
            callback: (resp) => {
                if (resp.error) {
                    reject(resp);
                    return;
                }

                // Guardar token en localStorage
                tokenResponse = resp;
                localStorage.setItem('gdrive_token', resp.access_token);

                // Calcular expiración (los tokens normalmente duran 1 hora = 3600000 ms)
                const expiryTime = Date.now() + (3600 * 1000); // 1 hora
                localStorage.setItem('gdrive_token_expiry', expiryTime.toString());

                // Configurar el token en gapi
                gapi.client.setToken({ access_token: resp.access_token });

                console.log("✅ Token nuevo guardado");
                resolve(resp);
            },
        });

        // Solo mostrar prompt si no hay token válido
        client.requestAccessToken({ prompt: '' });
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

            // Usamos multipart para asegurar que el nombre se asigne correctamente
            const metadata = {
                name: fileName,
                parents: [CONFIG.FOLDER_ID],
                mimeType: 'application/json'
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([initialData], { type: 'application/json' }));

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + gapi.auth.getToken().access_token }),
                body: form
            });
            const result = await response.json();

            if (result.error) throw new Error(result.error.message);

            console.log("✅ data.json creado con ID:", result.id);
            return result.id;
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
 * Actualiza el contenido de un archivo JSON usando multipart para robustez
 */
export async function updateFileContent(fileId, content) {
    try {
        const metadata = {
            mimeType: 'application/json'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(content)], { type: 'application/json' }));

        const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
            method: 'PATCH',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.auth.getToken().access_token }),
            body: form
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Error al actualizar archivo');
        }

        console.log("✅ data.json actualizado en Drive");
    } catch (err) {
        console.error('Error actualizando archivo:', err);
        throw err;
    }
}

/**
 * Crea una carpeta en Google Drive
 */
export async function createFolder(folderName, parentId) {
    try {
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId || CONFIG.FOLDER_ID]
        };

        const response = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });

        console.log(`✅ Carpeta '${folderName}' creada:`, response.result.id);
        return response.result.id;
    } catch (err) {
        console.error('Error creando carpeta:', err);
        throw err;
    }
}

/**
 * Sube una imagen Base64 a Drive y retorna su URL pública
 */
export async function uploadImage(base64Data, fileName, parentId) {
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
        parents: [parentId || CONFIG.FOLDER_ID],
        mimeType: mimeType
    };

    try {
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.auth.getToken().access_token }),
            body: form
        });
        const result = await response.json();

        if (result.error) throw new Error(result.error.message);

        // Hacer el archivo público para lectura
        await gapi.client.drive.permissions.create({
            fileId: result.id,
            resource: { role: 'reader', type: 'anyone' }
        });

        return `https://lh3.googleusercontent.com/u/0/d/${result.id}`;
    } catch (err) {
        console.error('Error subiendo imagen:', err);
        throw err;
    }
}

/**
 * Elimina un archivo o carpeta de Google Drive
 */
export async function deleteFile(fileId) {
    try {
        await gapi.client.drive.files.delete({
            fileId: fileId
        });
        console.log("✅ Eliminado de Drive:", fileId);
    } catch (err) {
        console.error('Error eliminando de Drive:', err);
        throw err;
    }
}
