import { CONFIG } from './config.js';

let gapiInited = false;
let gisInited = false;
let tokenResponse = null;

/**
 * Inicializa GAPI (Google API Client) con reintentos para errores transitorios (502)
 */
export async function initGapi(retries = 3) {
    if (gapiInited) return Promise.resolve();

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
                console.warn(`Intento de inicialización GAPI fallido (${retries} restantes):`, err);
                if (retries > 0) {
                    setTimeout(() => {
                        initGapi(retries - 1).then(resolve).catch(reject);
                    }, 2000); // Esperar 2 segundos antes de reintentar
                } else {
                    console.error('Error crítico al inicializar GAPI tras varios intentos:', err);
                    reject(err);
                }
            }
        });
    });
}

/**
 * Autenticación mediante Google Identity Services (GIS)
 */
export async function signIn(force = false) {
    // Verificar si hay un token guardado y válido
    const savedToken = localStorage.getItem('gdrive_token');
    const tokenExpiry = localStorage.getItem('gdrive_token_expiry');

    if (!force && savedToken && tokenExpiry) {
        const now = Date.now();
        if (now < parseInt(tokenExpiry)) {
            // Token aún válido, usarlo
            console.log("✅ Usando token guardado");
            tokenResponse = { access_token: savedToken };
            gapi.client.setToken({ access_token: savedToken });
            return Promise.resolve(tokenResponse);
        }
    }

    // Token expirado o forzado, limpiar
    console.log(force ? "🔄 Forzando nueva autenticación" : "⚠️ Token inexistente o expirado, solicitando nuevo");
    localStorage.removeItem('gdrive_token');
    localStorage.removeItem('gdrive_token_expiry');

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

        // Si es forzado, mostramos el prompt de selección de cuenta
        client.requestAccessToken({ prompt: force ? 'select_account' : '' });
    });
}

/**
 * Wrapper para reintentar llamadas si el token falla (401)
 */
async function withRetry(apiCall) {
    try {
        return await apiCall();
    } catch (err) {
        const status = err.status || (err.result && err.result.error ? err.result.error.code : null);
        if (status === 401) {
            console.warn("🚫 Token no autorizado (401). Intentando refrescar...");
            await signIn(true); // Forzar nuevo token
            return await apiCall(); // Reintentar la llamada original
        }
        throw err;
    }
}

/**
 * Busca o Crea el archivo data.json en la carpeta configuradora
 */
export async function getOrCreateDataFile() {
    try {
        const fileName = 'data.json';
        const q = `name = '${fileName}' and '${CONFIG.FOLDER_ID}' in parents and trashed = false`;

        const token = gapi.auth.getToken()?.access_token;
        let files = [];

        // Usar gapi client si está disponible (con o sin token), es mejor para CORS
        if (gapi.client && gapi.client.drive) {
            const response = await withRetry(() => gapi.client.drive.files.list({
                q: q,
                fields: 'files(id)', // Solo necesitamos el ID
                spaces: 'drive'
            }));
            files = response.result.files;
        } else {
            // Modo de emergencia: fetch directo con API Key (solo para metadatos suele funcionar)
            // Agregamos fields=files(id) para reducir el tamaño de la respuesta
            const cb = `&cb=${Date.now()}`;
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&key=${CONFIG.API_KEY}${cb}`);
            const result = await response.json();

            if (result.error && result.error.message && result.error.message.includes('suspended')) {
                console.error("🚨 CRÍTICO: El proyecto de Google Cloud ha sido SUSPENDIDO. Debes activar el nuevo proyecto o revisar la consola de Google.");
            }

            files = result.files;
        }

        if (files && files.length > 0) {
            return files[0].id;
        } else {
            // Solo intentar crear si tenemos token (admin)
            const token = gapi.auth.getToken();
            if (!token) {
                console.warn("⚠️ data.json no encontrado en búsqueda pública. Asegúrate de que la carpeta de Drive esté compartida como 'Cualquier persona con el enlace'.");
                return null;
            }

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

            const response = await withRetry(() => fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + gapi.auth.getToken().access_token }),
                body: form
            }));
            const result = await response.json();

            if (result.error) throw new Error(result.error.message);

            // Hacer el data.json público para lectura
            try {
                await withRetry(() => gapi.client.drive.permissions.create({
                    fileId: result.id,
                    resource: { role: 'reader', type: 'anyone' }
                }));
            } catch (pErr) {
                console.warn("No se pudo hacer el archivo público (normal si no hay gapi listo):", pErr);
            }

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
    const token = gapi.auth.getToken()?.access_token;

    // RUTA 1: GAPI Client (Ideal para Admins y usuarios autenticados)
    if (token && gapi.client.drive) {
        try {
            const response = await withRetry(() => gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            }));
            return response.result;
        } catch (err) {
            console.warn('Ruta 1 (GAPI Admin) fallida, intentando ruta pública...', err);
        }
    }

    // RUTA 2: Fetch Directo API v3 (Modo Público)
    // Eliminamos la ruta docs.google.com/uc por ser inestable y propensa a bloqueos
    try {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${CONFIG.API_KEY}`;
        const response = await fetch(url, {
            mode: 'cors',
            credentials: 'omit'
        });

        if (response.ok) {
            return await response.json();
        }

        const errData = await response.json().catch(() => ({}));
        if (errData.error && errData.error.message && errData.error.message.includes('suspended')) {
            console.error("🚨 CRÍTICO: Tu proyecto de Google está SUSPENDIDO. Las categorías no cargarán hasta que actualices las credenciales en config.js con el nuevo proyecto.");
        }

        throw new Error(errData.error?.message || `Error HTTP ${response.status}`);
    } catch (err) {
        console.error('Error final descargando data.json:', err);
        throw err;
    }
}

/**
 * Actualiza el contenido de un archivo JSON usando multipart para robustez
 */
export async function updateFileContent(fileId, content) {
    try {
        const token = gapi.auth.getToken()?.access_token;
        if (!token) throw new Error("No hay token para actualizar en Drive");

        const metadata = { mimeType: 'application/json' };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(content)], { type: 'application/json' }));

        const response = await withRetry(() => fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
            method: 'PATCH',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.auth.getToken().access_token }),
            body: form
        }));

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Error al actualizar archivo');
        }

        // Asegurar que sea público si lo estamos actualizando como Admin
        await ensurePublicPermission(fileId);

        console.log("✅ data.json actualizado correctamente");
    } catch (err) {
        console.error('Error actualizando archivo:', err);
        throw err;
    }
}

/**
 * Asegura que un archivo sea público para lectura
 */
export async function ensurePublicPermission(fileId) {
    try {
        const token = gapi.auth.getToken()?.access_token;
        if (!token || !gapi.client.drive) return;

        await withRetry(() => gapi.client.drive.permissions.create({
            fileId: fileId,
            resource: {
                role: 'reader',
                type: 'anyone'
            }
        }));
        console.log(`✅ Permisos públicos asegurados para: ${fileId}`);
    } catch (err) {
        console.warn(`No se pudieron actualizar los permisos para ${fileId}:`, err);
    }
}

export async function createFolder(folderName, parentId) {
    try {
        const metadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId || CONFIG.FOLDER_ID]
        };

        // Prioridad: Usar gapi client si está disponible (mejor manejo de CORS)
        if (gapiInited && gapi.client.drive) {
            const response = await withRetry(() => gapi.client.drive.files.create({
                resource: metadata,
                fields: 'id'
            }));
            console.log(`✅ Carpeta '${folderName}' creada (gapi):`, response.result.id);
            return response.result.id;
        }

        // Fallback: fetch directo (URL corregida sin /api/)
        const response = await withRetry(() => fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
            method: 'POST',
            headers: new Headers({
                'Authorization': 'Bearer ' + gapi.auth.getToken().access_token,
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify(metadata)
        }));

        const result = await response.json();
        if (result.error) throw new Error(result.error.message);

        console.log(`✅ Carpeta '${folderName}' creada (fetch):`, result.id);
        return result.id;
    } catch (err) {
        console.error('Error creando carpeta:', err);
        throw err;
    }
}

// La función uploadImage ha sido movida a cloudinary-api.js para evitar bloqueos de Google Drive.

/**
 * Elimina un archivo o carpeta de Google Drive usando fetch
 */
export async function deleteFile(fileId) {
    try {
        if (gapiInited && gapi.client.drive) {
            await withRetry(() => gapi.client.drive.files.delete({ fileId: fileId }));
            console.log("✅ Eliminado de Drive (gapi):", fileId);
            return;
        }

        const response = await withRetry(() => fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: new Headers({
                'Authorization': 'Bearer ' + gapi.auth.getToken().access_token
            })
        }));

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Error al eliminar de Drive');
        }

        console.log("✅ Eliminado de Drive (fetch):", fileId);
    } catch (err) {
        console.error('Error eliminando de Drive:', err);
        throw err;
    }
}
