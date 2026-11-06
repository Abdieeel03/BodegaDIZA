# 🍷 BodegaDIZA - Frontend Sistema

Sistema de gestión comercial y de inventario para BodegaDIZA desarrollado con **React 19**, **TypeScript**, **Vite**, **React Router** y **Axios**.

---

## 📦 Herramientas y Dependencias Instaladas

| Herramienta | Estado | Detalle |
| :--- | :--- | :--- |
| **Context API** | ✅ Verificado | Nativo de React (`createContext`, `useContext`), no requiere paquete externo adicional. Implementado en `src/context/`. |
| **React Router** | ✅ Instalado | `react-router-dom` versión `^7.18.5` para enrutamiento declarativo y rutas protegidas. |
| **Axios** | ✅ Instalado | `axios` versión `^1.21.0` configurado con middleware/interceptores para gestión centralizada de JWT. |

---

## 📁 Estructura de Carpetas Recomendada

La estructura de carpetas ha sido diseñada siguiendo las mejores prácticas para aplicaciones empresariales escalables con múltiples módulos y vistas:

```
frontend-sistema/
├── public/                     # Archivos estáticos públicos servidos directamente
├── src/
│   ├── api/                    # Configuración central de Axios e interceptores HTTP
│   │   ├── axios.ts            # Instancia configurada, variable JWT y middlewares
│   │   └── index.ts            # Re-exportación pública del módulo API
│   │
│   ├── assets/                 # Recursos gráficos (imágenes, logos, íconos SVG)
│   │
│   ├── components/             # Componentes de interfaz de usuario reutilizables
│   │   ├── common/             # Componentes globales genéricos (Navbar, Sidebar, etc.)
│   │   │   ├── Navbar.tsx      # Barra de navegación superior con perfil de usuario
│   │   │   └── Sidebar.tsx     # Menú de navegación lateral
│   │   └── feedback/           # Modales, loaders, notificaciones y alertas
│   │
│   ├── context/                # Estado global con React Context API
│   │   ├── authContextDef.ts   # Definición del contexto e interfaces
│   │   ├── AuthProvider.tsx    # Proveedor de estado de autenticación y token
│   │   └── index.ts            # Exportaciones de contextos
│   │
│   ├── hooks/                  # Custom hooks para encapsular lógica de componentes
│   │   ├── useAuth.ts          # Hook simplificado para acceder a AuthContext
│   │   └── index.ts            # Exportaciones de hooks
│   │
│   ├── layouts/                # Plantillas maestras de estructura de páginas
│   │   ├── MainLayout.tsx      # Layout con Navbar, Sidebar y contenido dinámico (<Outlet />)
│   │   └── AuthLayout.tsx      # Layout limpio y centrado para login y recuperación
│   │
│   ├── pages/                  # Vistas/Páginas organizadas por módulo de negocio
│   │   ├── auth/               # Páginas de inicio de sesión y registro
│   │   │   └── LoginPage.tsx
│   │   ├── dashboard/          # Panel principal con indicadores y resumen
│   │   │   └── DashboardPage.tsx
│   │   ├── inventory/          # Gestión de inventario, stock y productos
│   │   │   └── InventoryPage.tsx
│   │   ├── api-status/         # Pantalla para inspeccionar en vivo el JWT y Axios
│   │   │   └── ApiStatusPage.tsx
│   │   └── not-found/          # Página 404 para URLs no encontradas
│   │       └── NotFoundPage.tsx
│   │
│   ├── routes/                 # Configuración del sistema de rutas
│   │   ├── AppRoutes.tsx       # Mapeo de rutas con BrowserRouter, Routes y Route
│   │   └── ProtectedRoute.tsx  # Guard para restringir acceso a rutas privadas
│   │
│   ├── services/               # Funciones de comunicación con endpoints de la API
│   │   └── authService.ts      # Servicio de ejemplo consumiendo la instancia Axios
│   │
│   ├── types/                  # Definiciones de tipos e interfaces TypeScript
│   │   └── index.ts            # User, AuthState, ApiResponse, etc.
│   │
│   ├── utils/                  # Funciones utilitarias (fechas, formateadores de moneda)
│   ├── App.css                 # Estilos globales y temas del sistema
│   ├── index.css               # Resets y variables CSS de diseño
│   ├── App.tsx                 # Componente raíz envuelto en AuthProvider y AppRoutes
│   └── main.tsx                # Punto de entrada de la aplicación React
│
├── package.json                # Dependencias y scripts del proyecto
├── tsconfig.app.json           # Configuración TypeScript con alias `@/*` -> `./src/*`
├── vite.config.ts              # Configuración de Vite con resolución de alias
└── README.md                   # Documentación del proyecto
```

---

## ⚡ Configuración de Axios y Middleware de JWT

La configuración de Axios se encuentra en `src/api/axios.ts`.

### 1. Manejo del JWT por Variable
Por ahora, el token JWT se mantiene en una variable interna exportada `jwtToken` junto con funciones para consultarlo o modificarlo:

```typescript
// Variable en memoria
export let jwtToken: string | null = 'token_jwt_de_ejemplo_bodega_diza';

// Funciones para sincronizar el token
export const setAuthToken = (token: string | null): void => {
  jwtToken = token;
};

export const getAuthToken = (): string | null => {
  return jwtToken;
};
```

### 2. Middleware / Interceptor de Petición (Request)
Cada vez que se ejecuta una petición HTTP con `apiClient`, el interceptor se activa automáticamente y añade el encabezado `Authorization`:

```typescript
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});
```

### 3. Middleware / Interceptor de Respuesta (Response)
Permite capturar errores de forma centralizada (por ejemplo, códigos `401 Unauthorized` si el token expiró):

```typescript
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[Axios Interceptor] Sesión inválida o expirada (401).');
    }
    return Promise.reject(error);
  }
);
```

---

## 🔄 Integración con Context API

La aplicación ya tiene preparado el enlace entre **Context API** y la **variable de Axios**:

1. En `src/context/AuthProvider.tsx`, el hook `useEffect` detecta cualquier cambio en el token del contexto y ejecuta `setAuthToken(token)` automáticamente:
   ```typescript
   useEffect(() => {
     setAuthToken(token);
   }, [token]);
   ```
2. Cualquier componente puede consumir el estado o cambiar de usuario simplemente llamando al hook `useAuth()`:
   ```tsx
   import { useAuth } from '@/hooks/useAuth';

   const { user, token, login, logout } = useAuth();
   ```

---

## 🚀 Cómo Ejecutar el Proyecto

```bash
# Instalar dependencias (si es necesario)
pnpm install

# Iniciar servidor de desarrollo en local
pnpm dev

# Construir para producción (TypeScript + Vite build)
pnpm build

# Ejecutar el linter
pnpm lint

# Previsualizar el build de producción
pnpm preview
```

---

## 🧭 Rutas Disponibles

- `/` : Dashboard principal (muestra estadísticas y bienvenida).
- `/inventario` : Vista de productos y stock (Ruta protegida).
- `/conexion-api` : Panel interactivo para probar en tiempo real la inyección de cabeceras JWT en Axios.
- `/login` : Formulario de inicio de sesión con simulación de token JWT.
