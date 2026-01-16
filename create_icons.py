from PIL import Image

# Colores
BG_COLOR = (10, 22, 40)  # #0A1628

def create_icon(source_path, output_path, size, logo_percentage=80):
    """
    Crea un ícono cuadrado con el logo circular centrado
    
    Args:
        source_path: Ruta del logo original
        output_path: Ruta donde guardar el ícono
        size: Tamaño del ícono (ancho = alto)
        logo_percentage: Porcentaje del canvas que ocupará el logo (default 80%)
    """
    # Crear canvas cuadrado con fondo azul oscuro
    icon = Image.new('RGB', (size, size), BG_COLOR)
    
    # Abrir logo original
    logo = Image.open(source_path)
    
    # Calcular tamaño del logo para que quepa completamente
    logo_size = int(size * (logo_percentage / 100))
    
    # Redimensionar logo manteniendo aspecto (debería ser cuadrado)
    logo = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    
    # Calcular posición para centrar
    position = ((size - logo_size) // 2, (size - logo_size) // 2)
    
    # Pegar logo en el centro
    icon.paste(logo, position)
    
    # Guardar
    icon.save(output_path, 'PNG', optimize=True)
    print(f'✓ Creado: {output_path} ({size}x{size}, logo al {logo_percentage}%)')

# Crear los tres íconos
source = 'assets/logo.jpg'

# Íconos estándar - logo al 80% para que el círculo completo quepa
create_icon(source, 'assets/icon-192.png', 192, logo_percentage=80)
create_icon(source, 'assets/icon-512.png', 512, logo_percentage=80)

# Ícono maskable - logo al 70% para la zona segura
create_icon(source, 'assets/icon-maskable-512.png', 512, logo_percentage=70)

print('\n✅ Todos los íconos creados correctamente')
