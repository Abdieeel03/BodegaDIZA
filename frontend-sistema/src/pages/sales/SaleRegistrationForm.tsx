import { useMemo, useState, type FormEvent } from 'react';
import { Button, FormField } from '../../components/ui';
import { formatMoney } from '../../components/period/PeriodControls';
import type { ProductoOperativo, SaleItemPayload } from '../../services/testDataService';
import './sales-operations.css';

const formatQuantity = (value: number) => Number(value).toLocaleString('es-PE', { maximumFractionDigits: 3 });

type Props = {
  products: ProductoOperativo[];
  busy: boolean;
  loading: boolean;
  onRegister: (items: SaleItemPayload[]) => Promise<boolean>;
};

/** Cantidad positiva, con precisión máxima de tres decimales (BigDecimal escala 3 en API). */
function validQuantity(value: number): boolean {
  return Number.isFinite(value) && value >= 0.001
    && Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7;
}

/** Venta operativa: se envía el mismo contrato POST /ventas, ahora con varios ítems. */
export function SaleRegistrationForm({ products, busy, loading, onRegister }: Props) {
  const [productQuery, setProductQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('1');
  const [items, setItems] = useState<SaleItemPayload[]>([]);
  const [localError, setLocalError] = useState('');
  const availableProducts = useMemo(() => products.filter(p => p.activo && p.stockTotal > 0), [products]);
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return availableProducts;
    return availableProducts.filter(p => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [availableProducts, productQuery]);
  const product = availableProducts.find(p => String(p.id) === selectedId);
  const quantity = Number(amount);
  const alreadyAdded = items.find(item => String(item.productoId) === selectedId)?.cantidad ?? 0;
  const selectedStock = Number(product?.stockTotal ?? 0);
  const totalQuantity = Math.round((alreadyAdded + quantity) * 1000) / 1000;
  const cartTotal = items.reduce((sum, item) => {
    const p = products.find(prod => prod.id === item.productoId);
    return sum + item.cantidad * Number(p?.precioVenta ?? 0);
  }, 0);
  const validCart = items.every(item => {
    const p = availableProducts.find(prod => prod.id === item.productoId);
    return p && validQuantity(item.cantidad) && item.cantidad <= Number(p.stockTotal);
  });

  const addItem = () => {
    if (!product) { setLocalError('Selecciona un producto con stock disponible.'); return; }
    if (!validQuantity(quantity)) {
      setLocalError('Ingresa una cantidad mayor o igual a 0.001, con hasta 3 decimales.'); return;
    }
    if (totalQuantity > selectedStock) {
      setLocalError(`El stock mostrado para ${product.nombre} es ${formatQuantity(selectedStock)}; ya tienes ${formatQuantity(alreadyAdded)} en esta venta.`);
      return;
    }
    setItems(prev => prev.some(item => item.productoId === product.id)
      ? prev.map(item => item.productoId === product.id ? { ...item, cantidad: totalQuantity } : item)
      : [...prev, { productoId: product.id, cantidad: quantity }]);
    setSelectedId(''); setProductQuery(''); setAmount('1'); setLocalError('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !items.length) return;
    if (!validCart) {
      setLocalError('El stock disponible cambió. Revisa las cantidades antes de registrar la venta.');
      return;
    }
    setLocalError('');
    const success = await onRegister(items);
    if (success) { setItems([]); setSelectedId(''); setProductQuery(''); setAmount('1'); }
  };

  return (
    <form className="diza-sale-form" noValidate onSubmit={event => { void submit(event); }}>
      <FormField controlId="sale-product-search" label="Buscar producto">
        <input id="sale-product-search" type="search" placeholder="Filtrar por nombre o código SKU..."
          value={productQuery} disabled={busy || loading}
          onChange={event => {
            const val = event.target.value;
            setProductQuery(val);
            setLocalError('');
            const q = val.trim().toLowerCase();
            if (q) {
              const matches = availableProducts.filter(p => p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
              if (matches.length === 1) setSelectedId(String(matches[0].id));
            }
          }} />
      </FormField>
      <div className="diza-sale-entry">
        <FormField controlId="sale-product" label="Producto con stock disponible" required>
          <select id="sale-product" value={selectedId} disabled={busy || loading}
            onChange={event => { setSelectedId(event.target.value); setLocalError(''); }}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addItem(); } }}>
            <option value="">{filteredProducts.length ? 'Selecciona un producto' : 'Sin coincidencias'}</option>
            {filteredProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.sku} · {p.nombre} · {formatMoney(Number(p.precioVenta))} · Stock {formatQuantity(p.stockTotal)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField controlId="sale-amount" label="Cantidad" required>
          <input id="sale-amount" type="number" inputMode="decimal" min="0.001" step="0.001"
            placeholder="Ej. 1 o 0.500"
            value={amount} disabled={busy || loading}
            onChange={event => { setAmount(event.target.value); setLocalError(''); }}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addItem(); } }} />
        </FormField>
        <Button type="button" variant="secondary" onClick={addItem} disabled={busy || loading}>
          Añadir producto
        </Button>
      </div>
      {localError && <p className="diza-test-error" role="alert">{localError}</p>}
      {!!items.length && !validCart && <p className="diza-test-error" role="alert">
        Algún producto ya no tiene stock suficiente. Quítalo de esta venta y vuelve a agregar una cantidad disponible.
      </p>}
      <section className="diza-sale-cart" aria-label="Productos de la venta">
        <div className="diza-sale-cart-header">
          <h3>Productos de esta venta</h3>
          <span>{items.length} {items.length === 1 ? 'producto' : 'productos'}</span>
        </div>
        {!items.length ? (
          <p className="diza-sale-empty">Selecciona un producto y pulsa «Añadir producto». Puedes incluir varios en la misma venta.</p>
        ) : (
          <ul className="diza-sale-items">
            {items.map(item => {
              const p = products.find(prod => prod.id === item.productoId);
              return <li key={item.productoId}>
                <div className="diza-sale-item-name">
                  <strong>{p?.nombre ?? `Producto #${item.productoId}`}</strong>
                  <span>{p?.sku ?? 'No disponible'} · {formatQuantity(item.cantidad)} × {formatMoney(Number(p?.precioVenta ?? 0))}</span>
                </div>
                <strong className="diza-sale-item-subtotal">{formatMoney(item.cantidad * Number(p?.precioVenta ?? 0))}</strong>
                <Button type="button" size="sm" variant="ghost" disabled={busy}
                  aria-label={`Quitar ${p?.nombre ?? 'producto'} de la venta`}
                  onClick={() => { setItems(prev => prev.filter(v => v.productoId !== item.productoId)); setLocalError(''); }}>
                  Quitar
                </Button>
              </li>;
            })}
          </ul>
        )}
        <div className="diza-sale-cart-footer">
          <div>
            <span>Total estimado</span>
            <strong>{formatMoney(cartTotal)}</strong>
            <small>La API confirma el importe definitivo y descuenta el stock al registrar.</small>
          </div>
          <Button type="submit" disabled={!items.length || !validCart || loading} loading={busy}>
            {busy ? 'Registrando…' : 'Registrar venta'}
          </Button>
        </div>
      </section>
      {!loading && !availableProducts.length && (
        <p className="diza-test-muted">No hay productos activos con stock. Registra una entrada de inventario antes de vender.</p>
      )}
    </form>
  );
}
