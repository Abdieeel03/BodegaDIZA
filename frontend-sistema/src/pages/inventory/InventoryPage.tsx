export const InventoryPage = () => {
  const sampleProducts = [
    { id: 101, sku: 'VIN-MAL-01', nombre: 'Vino Tinto Malbec Reserva', categoria: 'Vinos', stock: 45, precio: 68.00 },
    { id: 102, sku: 'PIS-QUE-02', nombre: 'Pisco Quebranta 750ml', categoria: 'Licores', stock: 24, precio: 45.50 },
    { id: 103, sku: 'CER-IPA-03', nombre: 'Cerveza Artesanal IPA Six-Pack', categoria: 'Cervezas', stock: 120, precio: 38.00 },
    { id: 104, sku: 'GIO-WHI-04', nombre: 'Whisky 12 Años Botella', categoria: 'Destilados', stock: 8, precio: 155.00 },
  ];

  return (
    <div className="page-container">
      <div className="page-header flex-between">
        <div>
          <h1>📦 Inventario de Bodega</h1>
          <p>Gestión de existencias, precios y categorías de productos.</p>
        </div>
        <button type="button" className="btn-primary">
          + Nuevo Producto
        </button>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Stock</th>
              <th>Precio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sampleProducts.map((p) => (
              <tr key={p.id}>
                <td><code>{p.sku}</code></td>
                <td><strong>{p.nombre}</strong></td>
                <td><span className="badge">{p.categoria}</span></td>
                <td>{p.stock} unid.</td>
                <td>S/. {p.precio.toFixed(2)}</td>
                <td>
                  <button type="button" className="btn-small">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryPage;
