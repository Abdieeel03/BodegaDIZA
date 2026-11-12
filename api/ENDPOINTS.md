# Documentación de Endpoints - API BodegaDIZA

Documentación técnica y referencia de la API REST para el sistema de ventas e inventario de la bodega.

---

## 📌 Convenciones Generales

### Formato de Respuestas
Todos los endpoints devuelven un objeto JSON unificado con la siguiente estructura:

#### Respuesta Exitosa (`HTTP 200` / `HTTP 201`)
```json
{
  "success": true,
  "data": { ... },
  "message": null
}
```

#### Respuesta de Error (`HTTP 400`, `HTTP 401`, `HTTP 403`, `HTTP 404`, `HTTP 500`)
```json
{
  "success": false,
  "data": null,
  "message": "Descripción del error ocurrido"
}
```

### Seguridad y Autenticación
- A excepción de `POST /auth/login`, `POST /auth/register`, `POST /auth/recuperar-password`, `POST /auth/verificar-codigo` y `POST /auth/restablecer-password`, **todos los demás endpoints requieren autenticación mediante JWT**.
- Se debe enviar el encabezado HTTP:
  ```http
  Authorization: Bearer <TOKEN_JWT>
  ```
- El token incluye la identidad del usuario y su rol (`ADMIN` o `CAJERO`), lo que permite registrar automáticamente la auditoría de quién realizó cada venta, ingreso o ajuste de inventario.

---

## 📑 Resumen de Endpoints

| Módulo | Método | Endpoint | Descripción |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/auth/login` | Iniciar sesión y obtener token JWT |
| | `POST` | `/auth/register` | Registrar nuevo usuario y obtener token JWT |
| | `GET` | `/auth/profile` | Obtener perfil del usuario autenticado |
| | `POST` | `/auth/recuperar-password` | Solicitar código de recuperación por correo |
| | `POST` | `/auth/verificar-codigo` | Validar código de recuperación de 6 dígitos |
| | `POST` | `/auth/restablecer-password` | Actualizar contraseña con código verificado |
| **Usuarios** | `GET` | `/usuarios` | Listar todos los usuarios del sistema |
| | `GET` | `/usuarios/{id}` | Obtener detalle de un usuario por ID |
| | `POST` | `/usuarios` | Crear usuario con rol (`ADMIN` o `CAJERO`) |
| | `PUT` | `/usuarios/{id}` | Actualizar datos o rol de usuario |
| **Categorías** | `GET` | `/categorias` | Listar categorías (`?soloActivas=true/false`) |
| | `GET` | `/categorias/{id}` | Obtener categoría por ID |
| | `POST` | `/categorias` | Registrar nueva categoría |
| | `PUT` | `/categorias/{id}` | Actualizar datos de categoría |
| | `PATCH` | `/categorias/{id}/estado` | Activar o desactivar categoría |
| **Proveedores** | `GET` | `/proveedores` | Listar proveedores (`?soloActivos=true/false`) |
| | `GET` | `/proveedores/{id}` | Obtener proveedor por ID |
| | `POST` | `/proveedores` | Registrar nuevo proveedor (RUC de 11 dígitos) |
| | `PUT` | `/proveedores/{id}` | Actualizar datos de proveedor |
| | `PATCH` | `/proveedores/{id}/estado` | Activar o desactivar proveedor |
| **Productos** | `GET` | `/productos` | Listar productos con stock actual (`?search=&categoriaId=&soloActivos=`) |
| | `GET` | `/productos/{id}` | Obtener producto con stock actual |
| | `POST` | `/productos` | Registrar producto (con lote inicial opcional) |
| | `PUT` | `/productos/{id}` | Actualizar catálogo de producto |
| | `PATCH` | `/productos/{id}/estado` | Activar o desactivar producto |
| **Inventario** | `POST` | `/inventario/entradas` | Ingreso directo de stock / nuevo lote |
| | `POST` | `/inventario/ajustes` | Ajuste manual de stock por merma o conteo |
| | `GET` | `/inventario/lotes` | Listar lotes (`?productoId=&soloDisponibles=`) |
| | `GET` | `/inventario/movimientos` | Consultar Kardex (`?productoId=&tipo=`) |
| | `GET` | `/inventario/alertas/bajo-stock` | Productos en o por debajo del stock mínimo |
| | `GET` | `/inventario/alertas/vencimiento` | Lotes próximos a vencer o vencidos (`?dias=7`) |
| **Compras** | `POST` | `/compras` | Registrar orden de compra ingresando lotes |
| | `GET` | `/compras` | Listar compras (`?proveedorId=`) |
| | `GET` | `/compras/{id}` | Obtener detalle completo de compra |
| **Ventas** | `POST` | `/ventas` | Registrar venta (descuento automático FEFO o lote específico) |
| | `GET` | `/ventas` | Listar ventas (`?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`) |
| | `GET` | `/ventas/{id}` | Obtener detalle completo de venta con ítems y lotes |
| | `GET` | `/ventas/resumen` | Estadísticas: total vendido, ticket promedio y más vendidos |

---

## 🔐 1. Módulo de Autenticación (`/auth`)

### `POST /auth/login`
Permite a los administradores o empleados autenticarse con email y contraseña.
- **Acceso:** Público

#### Request Body
```json
{
  "email": "admin@diza.pe",
  "password": "passwordSeguro123"
}
```

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": 1,
      "nombre": "Administrador Diza",
      "email": "admin@diza.pe",
      "rol": "ADMIN"
    }
  },
  "message": null
}
```

---

### `POST /auth/register`
Permite registrar un nuevo usuario en la base de datos y genera inmediatamente su token JWT.
- **Acceso:** Público

#### Request Body
```json
{
  "nombre": "Carlos Cajero",
  "email": "carlos.cajero@bodegadiza.com",
  "password": "PasswordCajero123",
  "rol": "CAJERO"
}
```
> *Nota: El campo `rol` es opcional; si se omite, se asigna `ADMIN` por defecto.*

#### Response Body (`201 Created`)
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": 2,
      "nombre": "Carlos Cajero",
      "email": "carlos.cajero@bodegadiza.com",
      "rol": "CAJERO"
    }
  },
  "message": null
}
```

---

### `GET /auth/profile`
Retorna los datos del usuario correspondiente al token Bearer enviado.

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nombre": "Administrador Diza",
    "email": "admin@diza.pe",
    "rol": "ADMIN"
  },
  "message": null
}
```

---

### `POST /auth/recuperar-password`
Genera un código de 6 dígitos numéricos, lo asocia a la cuenta con una vigencia de **15 minutos** y lo envía por correo electrónico mediante Google SMTP.
- **Acceso:** Público

#### Request Body
```json
{
  "email": "admin@diza.pe"
}
```

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": "Se ha enviado un código de verificación de 6 dígitos a su correo electrónico",
  "message": null
}
```

---

### `POST /auth/verificar-codigo`
Valida si el código de 6 dígitos ingresado por el usuario es correcto, no ha expirado y no ha sido utilizado previamente.
- **Acceso:** Público

#### Request Body
```json
{
  "email": "admin@diza.pe",
  "codigo": "489215"
}
```

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": "Código de verificación válido",
  "message": null
}
```

---

### `POST /auth/restablecer-password`
Actualiza la contraseña del usuario tras verificar el código. La nueva contraseña se encripta de forma segura con BCrypt y el código queda marcado como utilizado.
- **Acceso:** Público

#### Request Body
```json
{
  "email": "admin@diza.pe",
  "codigo": "489215",
  "nuevaPassword": "MiNuevaPasswordSegura2026"
}
```

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": "La contraseña ha sido restablecida exitosamente. Ahora puede iniciar sesión con su nueva contraseña.",
  "message": null
}
```

---

## 🏷️ 2. Módulo de Categorías (`/categorias`)

### `GET /categorias`
- **Query Params:**
  - `soloActivas` (opcional, booleano): `true` para listar solo categorías activas.

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "Lácteos",
      "descripcion": "Leches, yogures, quesos y mantequillas",
      "activa": true
    },
    {
      "id": 2,
      "nombre": "Bebidas",
      "descripcion": "Aguas, gaseosas y jugos",
      "activa": true
    }
  ],
  "message": null
}
```

---

### `POST /categorias`
Crea una nueva categoría. El nombre debe ser único.

#### Request Body
```json
{
  "nombre": "Abarrotes",
  "descripcion": "Arroz, azúcar, fideos y conservas"
}
```

#### Response Body (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": 3,
    "nombre": "Abarrotes",
    "descripcion": "Arroz, azúcar, fideos y conservas",
    "activa": true
  },
  "message": null
}
```

---

### `PUT /categorias/{id}`
Actualiza el nombre y descripción de la categoría.

#### Request Body
```json
{
  "nombre": "Abarrotes y Granos",
  "descripcion": "Arroz, azúcar, fideos, menestras y granos"
}
```

---

### `PATCH /categorias/{id}/estado`
Activa o desactiva la categoría.

#### Request Body
```json
{
  "activo": false
}
```

---

## 🚚 3. Módulo de Proveedores (`/proveedores`)

### `GET /proveedores`
- **Query Params:** `soloActivos` (opcional, booleano).

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "Distribuidora Gloria S.A.",
      "ruc": "20100010724",
      "telefono": "987654321",
      "email": "contacto@gloria.pe",
      "activo": true
    }
  ],
  "message": null
}
```

---

### `POST /proveedores`
Registra un nuevo proveedor. El RUC debe tener exactamente 11 dígitos numéricos y ser único.

#### Request Body
```json
{
  "nombre": "Distribuidora San Fernando",
  "ruc": "20100154301",
  "telefono": "944556677",
  "email": "ventas@sanfernando.pe"
}
```

#### Response Body (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": 2,
    "nombre": "Distribuidora San Fernando",
    "ruc": "20100154301",
    "telefono": "944556677",
    "email": "ventas@sanfernando.pe",
    "activo": true
  },
  "message": null
}
```

---

### `PATCH /proveedores/{id}/estado`
Activa o desactiva el proveedor.

#### Request Body
```json
{
  "activo": true
}
```

---

## 📦 4. Módulo de Productos (`/productos`)

Unidades de medida disponibles: `UNIDAD`, `BOTELLA`, `CAJA`, `PACK`, `LITRO`, `BOLSA`, `LATA`, `KILOGRAMO`.

### `GET /productos`
Lista productos del catálogo incluyendo el cálculo en tiempo real del **`stockTotal`** (suma de lotes no vencidos) y el indicador de **`bajoStock`** (`stockTotal <= stockMinimo`).

- **Query Params:**
  - `search` (opcional, string): busca por coincidencia en SKU o nombre.
  - `categoriaId` (opcional, número): filtra por ID de categoría.
  - `soloActivos` (opcional, booleano): `true` para solo productos habilitados.

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sku": "LEC-GLO-AZU",
      "nombre": "Leche Evaporada Gloria Azul 400g",
      "descripcion": "Lata de leche evaporada entera",
      "categoria": {
        "id": 1,
        "nombre": "Lácteos",
        "descripcion": "Lácteos y derivados",
        "activa": true
      },
      "proveedor": {
        "id": 1,
        "nombre": "Distribuidora Gloria S.A.",
        "ruc": "20100010724",
        "telefono": "987654321",
        "email": "contacto@gloria.pe",
        "activo": true
      },
      "precioVenta": 4.50,
      "stockMinimo": 24.000,
      "unidadMedida": "LATA",
      "activo": true,
      "stockTotal": 48.000,
      "bajoStock": false
    }
  ],
  "message": null
}
```

---

### `POST /productos`
Crea un nuevo producto en el catálogo. Se puede incluir opcionalmente el bloque `loteInicial` para crear su stock inicial y movimiento de `ENTRADA` en una sola operación.

#### Request Body (con Lote Inicial)
```json
{
  "sku": "LEC-GLO-AZU",
  "nombre": "Leche Evaporada Gloria Azul 400g",
  "descripcion": "Lata de leche entera",
  "categoriaId": 1,
  "proveedorId": 1,
  "precioVenta": 4.50,
  "stockMinimo": 24.000,
  "unidadMedida": "LATA",
  "loteInicial": {
    "codigoLote": "LT-2026-05",
    "cantidad": 48.000,
    "fechaVencimiento": "2027-01-15"
  }
}
```

#### Request Body (sin Lote Inicial)
```json
{
  "sku": "ARR-COS-001",
  "nombre": "Arroz Costeño Extra 1kg",
  "descripcion": "Bolsa de 1kg",
  "categoriaId": 3,
  "proveedorId": 1,
  "precioVenta": 5.20,
  "stockMinimo": 20.000,
  "unidadMedida": "BOLSA"
}
```

---

### `PUT /productos/{id}`
Actualiza los datos del producto (categoría, proveedor, precio de venta, stock mínimo, etc.).

---

### `PATCH /productos/{id}/estado`
Activa o desactiva el producto en catálogo.

---

## 📊 5. Módulo de Inventario y Lotes (`/inventario`)

### `POST /inventario/entradas`
Permite ingresar mercadería directamente a un lote existente o crear un nuevo lote para un producto, generando automáticamente el registro en el Kardex (`MovimientoInventario` de tipo `ENTRADA`).

#### Request Body
```json
{
  "productoId": 1,
  "codigoLote": "LT-2026-06",
  "cantidad": 24.000,
  "fechaVencimiento": "2027-03-30",
  "motivo": "Ingreso por reposición de stock en bodega"
}
```

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": 5,
    "productoId": 1,
    "productoNombre": "Leche Evaporada Gloria Azul 400g",
    "productoSku": "LEC-GLO-AZU",
    "codigoLote": "LT-2026-06",
    "cantidadDisponible": 24.000,
    "fechaIngreso": "2026-11-12",
    "fechaVencimiento": "2027-03-30",
    "vencido": false,
    "diasParaVencer": 138
  },
  "message": null
}
```

---

### `POST /inventario/ajustes`
Ajusta la cantidad disponible de un lote específico por motivos de merma, producto roto, producto vencido o descuadre de inventario físico. Registra un movimiento de tipo `AJUSTE`.

#### Request Body
```json
{
  "loteId": 5,
  "nuevaCantidadDisponible": 22.000,
  "motivo": "Merma por rotura de 2 latas durante acomodo en estante"
}
```

---

### `GET /inventario/lotes`
Lista los lotes registrados en el sistema.
- **Query Params:**
  - `productoId` (opcional, número): filtra los lotes de un producto en específico.
  - `soloDisponibles` (opcional, booleano): `true` para solo lotes con stock mayor a cero.

---

### `GET /inventario/movimientos`
Historial de trazabilidad y Kardex de movimientos de inventario.
- **Query Params:**
  - `productoId` (opcional, número): filtrar por producto.
  - `tipo` (opcional, enum): `ENTRADA`, `SALIDA` o `AJUSTE`.

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "productoId": 1,
      "productoNombre": "Leche Evaporada Gloria Azul 400g",
      "productoSku": "LEC-GLO-AZU",
      "loteId": 5,
      "codigoLote": "LT-2026-06",
      "tipo": "SALIDA",
      "cantidad": 3.000,
      "fecha": "2026-11-12T11:45:00",
      "motivo": "Salida por venta #8",
      "usuarioNombre": "Administrador Diza",
      "compraId": null,
      "ventaId": 8
    }
  ],
  "message": null
}
```

---

### `GET /inventario/alertas/bajo-stock`
Retorna todos los productos activos cuyo stock actual disponible es menor o igual al stock mínimo configurado, indicando el déficit exacto necesario para reabastecimiento.

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "productoId": 2,
      "sku": "YOG-FRE-1L",
      "nombre": "Yogurt de Fresa 1 Litro",
      "stockActual": 4.000,
      "stockMinimo": 12.000,
      "deficit": 8.000,
      "unidadMedida": "BOTELLA"
    }
  ],
  "message": null
}
```

---

### `GET /inventario/alertas/vencimiento`
Retorna lotes que tengan stock disponible y cuya fecha de vencimiento ya expiró o esté próxima a expirar. Ideal para la rotación oportuna de productos lácteos y perecibles.
- **Query Params:**
  - `dias` (opcional, entero, por defecto `7`): ventana de días hacia adelante.

---

## 🛒 6. Módulo de Compras a Proveedores (`/compras`)

### `POST /compras`
Registra una compra formal a un proveedor, ingresando múltiples ítems en una única transacción atómica. Crea o incrementa los lotes y genera los movimientos de `ENTRADA` en inventario vinculados a la compra.

#### Request Body
```json
{
  "proveedorId": 1,
  "items": [
    {
      "productoId": 1,
      "codigoLote": "LT-GLO-99",
      "cantidad": 48.000,
      "costoUnitario": 3.80,
      "fechaVencimiento": "2027-02-15"
    }
  ]
}
```

#### Response Body (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "proveedorId": 1,
    "proveedorNombre": "Distribuidora Gloria S.A.",
    "proveedorRuc": "20100010724",
    "fecha": "2026-11-12T11:50:00",
    "estado": "RECIBIDA",
    "total": 182.40,
    "detalles": [
      {
        "id": 1,
        "productoId": 1,
        "productoNombre": "Leche Evaporada Gloria Azul 400g",
        "productoSku": "LEC-GLO-AZU",
        "loteId": 6,
        "codigoLote": "LT-GLO-99",
        "cantidad": 48.000,
        "costoUnitario": 3.80,
        "subtotal": 182.40
      }
    ]
  },
  "message": null
}
```

---

### `GET /compras`
Lista el historial de compras.
- **Query Params:** `proveedorId` (opcional).

---

### `GET /compras/{id}`
Obtiene el detalle completo de una compra por su ID.

---

## 💰 7. Módulo de Ventas (`/ventas`)

### `POST /ventas`
Registra una venta en el punto de atención de la bodega.

#### Características clave:
1. **Descuento Automático FEFO (*First Expired, First Out*)**: Si no se especifica `loteId` (o se envía `null`), el sistema descuenta automáticamente de los lotes no vencidos con fecha de vencimiento más próxima. Si la cantidad solicitada abarca más de un lote, el sistema divide la venta de forma transparente en los detalles correspondientes.
2. **Selección Manual de Lote**: Si se envía `loteId`, el descuento se realiza específicamente de ese lote validando que tenga stock suficiente y no esté vencido.
3. **Precio Automático**: Si `precioUnitario` se omite, se usa el `precioVenta` fijado en el producto.
4. **Trazabilidad Completa**: Registra movimientos de `SALIDA` en el Kardex y asigna el usuario vendedor autenticado mediante el JWT.

#### Request Body
```json
{
  "items": [
    {
      "productoId": 1,
      "cantidad": 3.000,
      "loteId": null,
      "precioUnitario": null
    }
  ]
}
```

#### Response Body (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "fecha": "2026-11-12T11:55:00",
    "total": 13.50,
    "usuarioId": 1,
    "usuarioNombre": "Administrador Diza",
    "detalles": [
      {
        "id": 1,
        "productoId": 1,
        "productoNombre": "Leche Evaporada Gloria Azul 400g",
        "productoSku": "LEC-GLO-AZU",
        "loteId": 5,
        "codigoLote": "LT-2026-06",
        "cantidad": 3.000,
        "precioUnitario": 4.50,
        "subtotal": 13.50
      }
    ]
  },
  "message": null
}
```

---

### `GET /ventas`
Lista las ventas realizadas en orden cronológico descendente.
- **Query Params:**
  - `desde` (opcional, formato `YYYY-MM-DD`): fecha de inicio.
  - `hasta` (opcional, formato `YYYY-MM-DD`): fecha de fin.

---

### `GET /ventas/{id}`
Consulta una venta específica por su identificador.

---

### `GET /ventas/resumen`
Genera un balance y resumen estadístico de ventas para el corte de caja o análisis gerencial.
- **Query Params:**
  - `desde` (opcional, formato `YYYY-MM-DD`): por defecto hoy.
  - `hasta` (opcional, formato `YYYY-MM-DD`): por defecto hoy.

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": {
    "totalVentas": 15,
    "ingresosTotales": 485.50,
    "ticketPromedio": 32.37,
    "desde": "2026-11-12T00:00:00",
    "hasta": "2026-11-12T23:59:59",
    "topProductos": [
      {
        "productoId": 1,
        "productoNombre": "Leche Evaporada Gloria Azul 400g",
        "productoSku": "LEC-GLO-AZU",
        "cantidadVendida": 36.000,
        "totalVendido": 162.00
      }
    ]
  },
  "message": null
}
```

---

## 👥 8. Módulo de Usuarios (`/usuarios`)

### `GET /usuarios`
Lista todos los usuarios del sistema ordenados por nombre.
- **Acceso:** Autenticado (`Authorization: Bearer <token>`)

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nombre": "Administrador Diza",
      "email": "admin@bodegadiza.com",
      "rol": "ADMIN"
    },
    {
      "id": 2,
      "nombre": "Carlos Cajero",
      "email": "carlos.cajero@bodegadiza.com",
      "rol": "CAJERO"
    }
  ],
  "message": null
}
```

---

### `GET /usuarios/{id}`
Obtiene el detalle de un usuario por su ID.
- **Acceso:** Autenticado

#### Response Body (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": 2,
    "nombre": "Carlos Cajero",
    "email": "carlos.cajero@bodegadiza.com",
    "rol": "CAJERO"
  },
  "message": null
}
```

---

### `POST /usuarios`
Crea un nuevo usuario (útil para que administradores den de alta a nuevos cajeros o administradores desde el panel).
- **Acceso:** Autenticado

#### Request Body
```json
{
  "nombre": "Carlos Cajero",
  "email": "carlos.cajero@bodegadiza.com",
  "password": "PasswordCajero123",
  "rol": "CAJERO"
}
```

#### Response Body (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": 2,
    "nombre": "Carlos Cajero",
    "email": "carlos.cajero@bodegadiza.com",
    "rol": "CAJERO"
  },
  "message": null
}
```

---

### `PUT /usuarios/{id}`
Actualiza el nombre, email o rol de un usuario existente. Si el campo `password` se envía con texto, se actualizará también la contraseña; si se omite o viene vacío, se mantiene la actual.
- **Acceso:** Autenticado

#### Request Body
```json
{
  "nombre": "Carlos Cajero Pérez",
  "email": "carlos.cajero@bodegadiza.com",
  "rol": "CAJERO",
  "password": ""
}
```

