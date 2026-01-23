#!/usr/bin/env node
/**
 * Script para generar favicon.ico desde favicon.svg
 * Ejecutar: node scripts/generate-favicon.js
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import toIco from 'to-ico'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const svgPath = join(rootDir, 'public', 'favicon.svg')
const icoPath = join(rootDir, 'public', 'favicon.ico')

console.log('Generando favicon.ico desde favicon.svg...')

try {
  // Leer SVG
  const svgBuffer = readFileSync(svgPath)

  // Crear imágenes PNG en múltiples tamaños (16, 32, 48)
  const sizes = [16, 32, 48]
  const pngBuffers = await Promise.all(
    sizes.map(async (size) => {
      return await sharp(svgBuffer)
        .resize(size, size, { 
          fit: 'contain', 
          background: { r: 255, g: 255, b: 255, alpha: 0 } 
        })
        .png()
        .toBuffer()
    })
  )

  // Convertir PNGs a ICO con múltiples tamaños
  const icoBuffer = await toIco(pngBuffers, {
    sizes: sizes
  })

  // Escribir favicon.ico
  writeFileSync(icoPath, icoBuffer)
  
  console.log(`✅ favicon.ico generado exitosamente en ${icoPath}`)
  console.log(`   Tamaños incluidos: ${sizes.join(', ')}px`)
} catch (err) {
  console.error('❌ Error al generar favicon.ico:', err.message)
  process.exit(1)
}
