// La actualización del modelo solo está disponible desde el botón del Resumen.
// Estas secciones son los únicos destinos visibles en el menú lateral y móvil.
export const predictionSections = [
  { to: '/prediccion-demanda', label: 'Resumen' },
  { to: '/prediccion-demanda/producto', label: 'Por producto' },
  { to: '/prediccion-demanda/reposicion', label: 'Reposición' },
  { to: '/prediccion-demanda/compras', label: 'Planificar compras' },
];
