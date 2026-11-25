"""Hill Climbing presupuestario: cantidades enteras por unidad comercial y dinero en céntimos."""
from decimal import Decimal, InvalidOperation
import math

MAX_SEED_STEPS = 10000
MAX_HILL_STEPS = 500
EPS = 1e-9


def cents(value, label):
    try:
        number = Decimal(str(value))
        if not number.is_finite() or number < 0 or number > Decimal('9999999999.99'):
            raise ValueError
        scaled = number * 100
        if scaled != scaled.to_integral_value():
            raise ValueError
        return int(scaled)
    except (InvalidOperation, ValueError, TypeError, OverflowError):
        raise ValueError(f'{label}: indica un importe válido con hasta dos decimales') from None


def _score(c, q):
    # Utilidad acumulada: prioridad y riesgo, déficit mínimo y rendimiento decreciente.
    # El riesgo no disponible no recibe un valor probabilístico inventado.
    m = min(q, c['deficit'])
    def spread_sum(n):
        return 1.25*n - 0.125*n*(n-1)/c['need']
    return c['weight'] * (spread_sum(q) + 0.65*spread_sum(m))


def optimize(replenishments, products, budget):
    limit = cents(budget, 'Presupuesto')
    if products['id_producto'].duplicated().any():
        raise ValueError('Existen SKU duplicados en el catálogo')
    indexed = products.set_index('id_producto')
    candidates = []
    seen = set()
    for item in sorted(replenishments, key=lambda x: str(x['productId'])):
        sku = str(item['productId'])
        if sku in seen:
            raise ValueError(f'Reposición duplicada para {sku}')
        seen.add(sku)
        raw = float(item['recommendedReplenishment'])
        if not math.isfinite(raw) or raw < 0:
            raise ValueError(f'Necesidad inválida para {sku}')
        need = math.ceil(raw)
        if need > 2147483647:
            raise ValueError(f'Necesidad fuera del rango permitido para {sku}')
        if not need:
            continue
        if sku not in indexed.index:
            raise ValueError(f'Producto {sku} no encontrado en el catálogo vigente')
        row = indexed.loc[sku]
        cost = cents(row.get('costo_compra_unitario'), f'Costo de adquisición de {sku}')
        if cost <= 0:
            raise ValueError(f'Falta un costo de adquisición válido para {sku}')
        if 'proveedor_activo' in row and not bool(row['proveedor_activo']):
            raise ValueError(f'El proveedor de {sku} está inactivo')
        risk = item.get('stockoutProbability')
        # El contrato de reposición usa probabilidades de 0 a 1.
        risk = float(risk) if risk is not None else None
        if risk is not None and (not math.isfinite(risk) or not 0 <= risk <= 1):
            raise ValueError(f'Riesgo inválido para {sku}')
        status = item['alertStatus']
        weight = {'ROJO': 3., 'AMARILLO': 1.6, 'VERDE': 1.}[status] * (1 + (risk if risk is not None else 0))
        deficit = math.ceil(max(0., float(item['stockMinimoSeguridad']) - float(item['stockActual'])))
        candidates.append(dict(sku=sku, item=item, need=need, cost=cost, risk=risk, weight=weight,
                               deficit=min(need, deficit), provider=str(row.get('proveedor', ''))))
    n = len(candidates)
    def score(q):
        return sum(_score(c, k) for c,k in zip(candidates,q))
    def spent(q):
        return sum(c['cost']*k for c,k in zip(candidates,q))
    def gain(i,q,count=1):
        c = candidates[i]
        return _score(c,q[i]+count)-_score(c,q[i])
    full = [c['need'] for c in candidates]
    iterations = 0
    limited = False
    if spent(full) <= limit:
        q = full
        initial = score(q)
    else:
        def seed(density):
            q = [0]*n
            balance = limit
            for step in range(MAX_SEED_STEPS):
                options = [i for i,c in enumerate(candidates) if q[i] < c['need'] and c['cost'] <= balance]
                if not options:
                    return q, False
                i = max(options, key=lambda i: (gain(i,q)/(candidates[i]['cost'] if density else 1),
                                                gain(i,q), -candidates[i]['cost'], -i))
                q[i] += 1
                balance -= candidates[i]['cost']
            return q, any(q[i] < c['need'] and c['cost'] <= balance for i,c in enumerate(candidates))
        raw, raw_limited = seed(False)
        ratio, ratio_limited = seed(True)
        initial = score(raw)
        q = max((raw, ratio), key=lambda v:(score(v), -spent(v)))
        limited = raw_limited if q is raw else ratio_limited
        # Ascenso local por adición e intercambio de una unidad por hasta cuatro de otro SKU.
        # Solo se aceptan vecinos factibles con mejora estricta de la utilidad.
        for _ in range(MAX_HILL_STEPS):
            balance = limit-spent(q)
            best = None
            best_gain = EPS
            for i,c in enumerate(candidates):
                if q[i] < c['need'] and c['cost'] <= balance:
                    g = gain(i,q)
                    if g > best_gain:
                        best,best_gain=(None,i,1),g
            for j,d in enumerate(candidates):
                if not q[j]:
                    continue
                loss = _score(d,q[j])-_score(d,q[j]-1)
                for i,c in enumerate(candidates):
                    if i == j:
                        continue
                    k = min(4, c['need']-q[i], (balance+d['cost'])//c['cost'])
                    if k > 0:
                        g = gain(i,q,k)-loss
                        if g > best_gain:
                            best,best_gain=(j,i,k),g
            if best is None:
                break
            j,i,k = best
            if j is not None:
                q[j] -= 1
            q[i] += k
            iterations += 1
        else:
            limited = True
    used = spent(q)
    items = []
    for c,k in zip(candidates,q):
        item = c['item']
        items.append(dict(productId=c['sku'], productName=item['productName'], category=item['category'],
                          alertStatus=item['alertStatus'], supplier=c['provider'], stockoutProbability=c['risk'],
                          recommendedReplenishment=c['need'], allocatedUnits=k, unmetUnits=c['need']-k,
                          unitCost=c['cost']/100, totalCost=c['cost']*k/100))
    items.sort(key=lambda x: (x['supplier'], {'ROJO':0,'AMARILLO':1,'VERDE':2}[x['alertStatus']], x['productId']))
    needed = sum(full)
    allocated = sum(q)
    return dict(algorithm='hill_climbing', budget=limit/100, budgetUsed=used/100,
                budgetRemaining=(limit-used)/100, iterations=iterations, coverageScore=round(score(q),3),
                initialCoverageScore=round(initial,3), totalNeededUnits=needed, totalAllocatedUnits=allocated,
                totalUnmetUnits=needed-allocated, coveragePercent=round(100*allocated/needed,2) if needed else None,
                searchLimited=limited, items=items)
