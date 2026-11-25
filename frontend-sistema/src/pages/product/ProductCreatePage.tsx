import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../../api/axios';
import { Button, FormField, PageHeader } from '../../components/ui';
import type { ApiResponse } from '../../types';
import '../demo/demo.css';
import '../../components/period/period-controls.css';
import './product-create.css';
import { VencimientoFields, pendingExpiry, type Vencimiento } from '../expiry/VencimientoFields';

type Category = { id: number; nombre: string; activa: boolean };
type Supplier = { id: number; nombre: string; activo: boolean };
type Product = { id: number; sku: string; nombre: string; stockTotal: number; unidadMedida: string; activo: boolean; permiteSinVencimiento: boolean };
type Mode = 'new' | 'restock';

const UNITS = ['UNIDAD', 'BOTELLA', 'CAJA', 'PACK', 'LITRO', 'BOLSA', 'LATA', 'KILOGRAMO'] as const;
type Unit = typeof UNITS[number];

function unwrap<T>(r: ApiResponse<T>): T {
  if (!r.success || r.data === null) throw Error(r.message || 'Error del servidor');
  return r.data;
}

const toNumber = (s: string) => Number(s);

export const ProductCreatePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode: Mode = searchParams.get('modo') === 'restock' ? 'restock' : 'new';
  const paramProductId = searchParams.get('productoId') ?? '';
  const paramSku = searchParams.get('sku') ?? '';
  const paramAmount = searchParams.get('cantidad') ?? '';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Campos de nuevo producto
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [unit, setUnit] = useState<Unit>('UNIDAD');
  const [withLot, setWithLot] = useState(false);
  const [lotCode, setLotCode] = useState('');
  const [lotAmount, setLotAmount] = useState('');
  const [expiry, setExpiry] = useState<Vencimiento>(pendingExpiry);

  // Campos de reposición de producto existente
  const [restockProductId, setRestockProductId] = useState('');
  const [restockLotCode, setRestockLotCode] = useState('');
  const [restockAmount, setRestockAmount] = useState(() => (Number(paramAmount) > 0 ? paramAmount : ''));
  const [restockExpiry, setRestockExpiry] = useState<Vencimiento>(pendingExpiry);
  const [extraLots, setExtraLots] = useState<{ key: number; code: string; amount: string; expiry: Vencimiento }[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [restockReason, setRestockReason] = useState('Reposición de stock');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [cat, sup, prod] = await Promise.all([
          apiClient.get<ApiResponse<Category[]>>('/categorias'),
          apiClient.get<ApiResponse<Supplier[]>>('/proveedores'),
          apiClient.get<ApiResponse<Product[]>>('/productos'),
        ]);
        if (!active) return;
        const activeProducts = unwrap(prod.data).filter(x => x.activo);
        setCategories(unwrap(cat.data).filter(x => x.activa));
        setSuppliers(unwrap(sup.data).filter(x => x.activo));
        setProducts(activeProducts);
        if (paramProductId && activeProducts.some(p => String(p.id) === paramProductId)) {
          setRestockProductId(paramProductId);
        } else if (paramSku) {
          const matched = activeProducts.find(p => p.sku.toLowerCase() === paramSku.trim().toLowerCase());
          if (matched) setRestockProductId(String(matched.id));
        }
        setReady(true);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Error al cargar datos');
      }
    })();
    return () => { active = false; };
  }, [paramProductId, paramSku]);

  const saveNew = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      if (!sku.trim() || !name.trim()) throw Error('Completa el SKU y el nombre del producto.');
      if (!categoryId || !supplierId) throw Error('Selecciona categoría y proveedor.');
      if (costPrice.trim() && (!Number.isFinite(toNumber(costPrice)) || toNumber(costPrice) <= 0 || toNumber(costPrice) > 9999999999.99)) throw Error('El costo de adquisición debe ser positivo.');
      if (!Number.isFinite(toNumber(salePrice)) || toNumber(salePrice) < 0 || !Number.isFinite(toNumber(minStock)) || toNumber(minStock) < 0) {
        throw Error('Precio y stock mínimo deben ser números válidos.');
      }
      if (withLot) {
        if (!lotCode.trim() || toNumber(lotAmount) <= 0) throw Error('Completa código, cantidad positiva y vencimiento del lote.');
      }
      const response = await apiClient.post<ApiResponse<Product>>('/productos', {
        sku: sku.trim().toUpperCase(),
        nombre: name.trim(),
        descripcion: description.trim(),
        categoriaId: Number(categoryId),
        proveedorId: Number(supplierId),
        precioVenta: toNumber(salePrice),
        precioCosto: costPrice.trim() ? toNumber(costPrice) : null,
        stockMinimo: toNumber(minStock),
        unidadMedida: unit,
        loteInicial: withLot ? { codigoLote: lotCode.trim(), cantidad: toNumber(lotAmount), vencimiento: expiry } : null,
      });
      unwrap(response.data);
      navigate('/inventario', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  const saveRestock = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      if (!restockProductId) throw Error('Selecciona el producto que deseas reponer.');
      if (!restockLotCode.trim() || !Number.isFinite(toNumber(restockAmount)) || toNumber(restockAmount) <= 0) {
        throw Error('Completa código de lote, cantidad positiva y fecha de vencimiento.');
      }
      const rows = [{ code: restockLotCode, amount: restockAmount, expiry: restockExpiry }, ...extraLots];
      if (rows.some(row => !row.code.trim() || !Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0)) throw Error('Completa el código y la cantidad de cada lote.');
      const response = await apiClient.post<ApiResponse<unknown>>('/inventario/recepciones', {
        lotes: rows.map(row => ({ productoId: Number(restockProductId), codigoLote: row.code.trim(), cantidad: Number(row.amount), vencimiento: row.expiry, motivo: restockReason.trim() || 'Recepción de mercadería' })),
      });
      unwrap(response.data);
      navigate('/inventario', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la reposición.');
    } finally {
      setSaving(false);
    }
  };

  const selectedProduct = products.find(p => String(p.id) === restockProductId);

  return (
    <main className="diza-test-page">
      <PageHeader
        eyebrow="INVENTARIO"
        title={mode === 'new' ? 'Agregar producto' : 'Reponer stock'}
        description={mode === 'new'
          ? 'Registra un producto nuevo o cambia a Reposición para sumar stock a uno existente.'
          : 'Registra una nueva entrada de lote para un producto existente en tu inventario.'}
        actions={<Link className="diza-test-link" to="/inventario">← Volver al inventario</Link>}
      />

      <div className="diza-create-tabs" role="tablist" aria-label="Tipo de registro en inventario">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'new'}
          className={`diza-create-tab ${mode === 'new' ? 'is-active' : ''}`}
          onClick={() => { setMode('new'); setError(''); }}
        >
          Nuevo producto
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'restock'}
          className={`diza-create-tab ${mode === 'restock' ? 'is-active' : ''}`}
          onClick={() => { setMode('restock'); setError(''); }}
        >
          Reponer producto existente
        </button>
      </div>

      {error && <p className="diza-test-error" role="alert">{error}</p>}

      {!ready ? (
        !error && <p className="diza-test-muted" role="status">Cargando catálogo, categorías y proveedores...</p>
      ) : mode === 'new' ? (
        <form className="diza-create-form" onSubmit={e => { void saveNew(e); }}>
          <section className="diza-test-panel" aria-labelledby="create-product-general">
            <h2 id="create-product-general">Información del producto</h2>
            <p className="diza-kpi-note">Identifica el producto y define su precio y stock mínimo.</p>
            <div className="diza-create-grid">
              <FormField controlId="create-sku" label="Código SKU" required>
                <input id="create-sku" required maxLength={50} value={sku} onChange={e => setSku(e.target.value)} placeholder="Ej. P021" autoComplete="off" />
              </FormField>
              <FormField controlId="create-name" label="Nombre del producto" required>
                <input id="create-name" required maxLength={150} value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del producto" />
              </FormField>
              <FormField controlId="create-category" label="Categoría" required>
                <select id="create-category" required value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">Selecciona categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </FormField>
              <FormField controlId="create-supplier" label="Proveedor" required>
                <select id="create-supplier" required value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                  <option value="">Selecciona proveedor</option>
                  {suppliers.map(provider => <option key={provider.id} value={provider.id}>{provider.nombre}</option>)}
                </select>
              </FormField>
              <FormField controlId="create-cost" label="Costo de adquisición (S/)">
                <input id="create-cost" type="number" min="0.01" max="9999999999.99" step="0.01" inputMode="decimal"
                  value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="Opcional" />
              </FormField>
              <FormField controlId="create-price" label="Precio de venta (S/)" required>
                <input id="create-price" required type="number" min="0" step="0.01" inputMode="decimal"
                  value={salePrice} onChange={e => setSalePrice(e.target.value)} />
              </FormField>
              <FormField controlId="create-minimum" label="Stock mínimo" required>
                <input id="create-minimum" required type="number" min="0" step="0.001" inputMode="decimal"
                  value={minStock} onChange={e => setMinStock(e.target.value)} />
              </FormField>
              <FormField controlId="create-unit" label="Unidad de medida" required>
                <select id="create-unit" value={unit} onChange={e => setUnit(e.target.value as Unit)}>
                  {UNITS.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </FormField>
              <FormField controlId="create-description" label="Descripción" className="diza-create-wide"
                hint="Opcional, hasta 500 caracteres.">
                <textarea id="create-description" rows={3} maxLength={500} value={description}
                  onChange={e => setDescription(e.target.value)} />
              </FormField>
            </div>
          </section>
          <section className="diza-test-panel" aria-labelledby="create-product-stock">
            <h2 id="create-product-stock">Stock inicial</h2>
            <label className="diza-create-check" htmlFor="create-with-lot">
              <input id="create-with-lot" type="checkbox" checked={withLot} onChange={e => setWithLot(e.target.checked)} />
              Registrar stock inicial con lote (opcional)
            </label>
            {withLot && <div className="diza-create-grid">
              <FormField controlId="create-lot-code" label="Código de lote" required>
                <input id="create-lot-code" required value={lotCode} onChange={e => setLotCode(e.target.value)} placeholder="Ej. LOTE-2026-01" />
              </FormField>
              <FormField controlId="create-lot-amount" label="Cantidad inicial" required>
                <input id="create-lot-amount" required type="number" min="0.001" step="0.001" inputMode="decimal"
                  value={lotAmount} onChange={e => setLotAmount(e.target.value)} />
              </FormField>
              <VencimientoFields prefix="create-lot" value={expiry} onChange={setExpiry} />
            </div>}
            <p className="diza-kpi-note">Si no registras un lote, el producto se creará con stock 0.</p>
          </section>
          <div className="diza-create-actions">
            <Link to="/inventario" className="diza-period-link">Cancelar</Link>
            <Button type="submit" loading={saving} disabled={!ready || categories.length === 0 || suppliers.length === 0}>
              {saving ? 'Guardando...' : 'Guardar producto'}
            </Button>
          </div>
          {(!categories.length || !suppliers.length) && <p className="diza-test-error" role="alert">
            Necesitas al menos una categoría activa y un proveedor activo antes de registrar productos.
          </p>}
        </form>
      ) : (
        <form className="diza-create-form" onSubmit={e => { void saveRestock(e); }}>
          <section className="diza-test-panel" aria-labelledby="restock-product-heading">
            <h2 id="restock-product-heading">Entrada de stock</h2>
            <p className="diza-kpi-note">
              {selectedProduct
                ? `Stock actual de ${selectedProduct.nombre}: ${Number(selectedProduct.stockTotal).toLocaleString('es-PE', { maximumFractionDigits: 3 })} ${selectedProduct.unidadMedida.toLowerCase()}.`
                : 'Selecciona un producto para sumar un nuevo lote al inventario.'}
            </p>
            <div className="diza-create-grid">
              <FormField controlId="restock-product" label="Producto existente" required className="diza-create-wide">
                <select id="restock-product" required value={restockProductId} onChange={e => { setRestockProductId(e.target.value); setRestockExpiry(pendingExpiry()); setExtraLots([]); }}>
                  <option value="">Selecciona un producto</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.nombre} · Stock actual: {Number(p.stockTotal).toLocaleString('es-PE', { maximumFractionDigits: 3 })}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField controlId="restock-lot-code" label="Código de lote" required>
                <input id="restock-lot-code" required maxLength={100} value={restockLotCode}
                  onChange={e => setRestockLotCode(e.target.value)} placeholder="Ej. LOTE-2026-11" />
              </FormField>
              <FormField controlId="restock-amount" label="Cantidad a ingresar" required>
                <input id="restock-amount" required type="number" min="0.001" step="0.001" inputMode="decimal"
                  value={restockAmount} onChange={e => setRestockAmount(e.target.value)} placeholder="Ej. 24" />
              </FormField>
              <VencimientoFields prefix="restock" value={restockExpiry} onChange={setRestockExpiry} allowsNone={selectedProduct?.permiteSinVencimiento} />
              <FormField controlId="restock-reason" label="Motivo" hint="Opcional, hasta 500 caracteres.">
                <input id="restock-reason" maxLength={500} value={restockReason}
                  onChange={e => setRestockReason(e.target.value)} placeholder="Reposición de stock" />
              </FormField>
            </div>
          </section>
          {extraLots.map((row, index) => <section className="diza-test-panel" key={row.key} aria-label={`Lote adicional ${index + 2}`}>
            <h2>Lote {index + 2}</h2>
            <div className="diza-create-grid">
              <FormField controlId={`extra-${row.key}-code`} label="Código de lote" required><input id={`extra-${row.key}-code`} required maxLength={100} value={row.code} onChange={e => setExtraLots(items => items.map(item => item.key === row.key ? { ...item, code: e.target.value } : item))} /></FormField>
              <FormField controlId={`extra-${row.key}-amount`} label="Cantidad a ingresar" required><input id={`extra-${row.key}-amount`} required type="number" min="0.001" step="0.001" value={row.amount} onChange={e => setExtraLots(items => items.map(item => item.key === row.key ? { ...item, amount: e.target.value } : item))} /></FormField>
              <VencimientoFields prefix={`extra-${row.key}`} value={row.expiry} allowsNone={selectedProduct?.permiteSinVencimiento} onChange={value => setExtraLots(items => items.map(item => item.key === row.key ? { ...item, expiry: value } : item))} />
            </div>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setExtraLots(items => items.filter(item => item.key !== row.key))}>Quitar lote {index + 2}</Button>
          </section>)}
          <Button type="button" variant="secondary" disabled={saving || extraLots.length >= 99} onClick={() => { setExtraLots(items => [...items, { key: nextKey, code: '', amount: '', expiry: pendingExpiry() }]); setNextKey(value => value + 1); }}>Añadir otro lote</Button>
          <p className="diza-kpi-note">Todos los lotes se registran juntos. Usa códigos distintos para fechas distintas. Las fechas pendientes, mes/año y vencidas no habilitan ventas.</p>
          <div className="diza-create-actions">
            <Link to="/inventario" className="diza-period-link">Cancelar</Link>
            <Button type="submit" loading={saving} disabled={!ready || products.length === 0}>
              {saving ? 'Registrando...' : 'Registrar entrada'}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
};

export default ProductCreatePage;
