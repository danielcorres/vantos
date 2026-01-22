export default {
    multipass: true,
    plugins: [
      // preset sin overrides raros
      'preset-default',
  
      // Asegura que NO se elimine el viewBox (clave para responsive)
      { name: 'removeViewBox', active: false },
  
      // Quita width/height fijos si existen
      'removeDimensions',
  
      // Quita xmlns:xlink / atributos viejos
      'removeXMLNS',
  
      // Prefija IDs (clipPath, etc.) para evitar colisiones
      {
        name: 'prefixIds',
        params: {
          prefix: (node, info) =>
            `vant-${info.path?.split('/').pop()?.replace('.svg', '') || 'svg'}`,
        },
      },
    ],
  }
  