# Script de PowerShell para crear íconos PWA sin recortar el logo circular

Add-Type -AssemblyName System.Drawing

$bgColor = [System.Drawing.Color]::FromArgb(10, 22, 40) # #0A1628
$sourcePath = "assets\logo.jpg"

function Create-Icon {
    param(
        [string]$OutputPath,
        [int]$Size,
        [int]$LogoPercentage = 80
    )
    
    # Crear canvas cuadrado
    $icon = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($icon)
    
    # Rellenar fondo azul oscuro
    $brush = New-Object System.Drawing.SolidBrush($bgColor)
    $graphics.FillRectangle($brush, 0, 0, $Size, $Size)
    
    # Cargar logo original
    $logo = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePath))
    
    # Calcular tamaño del logo
    $logoSize = [int]($Size * ($LogoPercentage / 100))
    
    # Calcular posición centrada
    $x = ($Size - $logoSize) / 2
    $y = ($Size - $logoSize) / 2
    
    # Configurar alta calidad de renderizado
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # Dibujar logo redimensionado
    $destRect = New-Object System.Drawing.Rectangle($x, $y, $logoSize, $logoSize)
    $graphics.DrawImage($logo, $destRect)
    
    # Guardar como PNG
    $icon.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Limpiar
    $graphics.Dispose()
    $icon.Dispose()
    $logo.Dispose()
    $brush.Dispose()
    
    Write-Host "✓ Creado: $OutputPath ($Size x $Size, logo al $LogoPercentage%)" -ForegroundColor Green
}

# Crear los íconos
Write-Host "`nCreando íconos PWA..." -ForegroundColor Cyan

# Íconos estándar - logo al 80% para que el círculo completo quepa
Create-Icon -OutputPath "assets\icon-192.png" -Size 192 -LogoPercentage 80

Create-Icon -OutputPath "assets\icon-512.png" -Size 512 -LogoPercentage 80

# Ícono maskable - logo al 70% para zona segura
Create-Icon -OutputPath "assets\icon-maskable-512.png" -Size 512 -LogoPercentage 70

Write-Host "`n✅ Todos los íconos creados correctamente" -ForegroundColor Green
Write-Host "El logo circular ahora se muestra completo sin recortes." -ForegroundColor Yellow
