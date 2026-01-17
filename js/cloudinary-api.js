import { CONFIG } from './config.js';

/**
 * Sube una imagen a Cloudinary usando Unsigned Uploads
 * @param {string} base64Data - Imagen en formato Base64
 * @returns {Promise<string>} - URL de la imagen subida
 */
export async function uploadImage(base64Data) {
    try {
        const formData = new FormData();
        formData.append('file', base64Data);
        formData.append('upload_preset', CONFIG.CLOUDINARY_PRESET);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_NAME}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Error al subir a Cloudinary');
        }

        const data = await response.json();
        console.log('✅ Imagen subida a Cloudinary:', data.secure_url);
        return data.secure_url;
    } catch (error) {
        console.error('❌ Error en Cloudinary:', error);
        throw error;
    }
}
