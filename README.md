# BodegaDIZA - API

API backend para el sistema **BodegaDIZA**, desarrollada con **Spring Boot 4**, **Java 21**, **Spring Data JPA**, **PostgreSQL** y **Spring Security con JWT**.

---

## 📋 Requisitos Previos

- **Java JDK 21** o superior instalado.
- **Docker** instalado y en ejecución en el sistema.

---

## 🐳 Contenedor Docker de PostgreSQL

Para levantar la base de datos PostgreSQL requerida por la API, se puede utilizar directamente **Docker CLI** o **Docker Compose**.

### Opción 1: Crear y Levantar con Docker CLI (Recomendado)

Ejecuta el siguiente comando en tu terminal para crear e iniciar el contenedor:

```bash
docker run -d \
  --name bodega_diza_postgres \
  -p 5432:5432 \
  -e POSTGRES_DB=bodega_diza \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -v bodega_diza_postgres_data:/var/lib/postgresql/data \
  --restart unless-stopped \
  postgres:16-alpine
```

#### Explicación de los Parámetros:
- `-d`: Ejecuta el contenedor en segundo plano (*detached mode*).
- `--name bodega_diza_postgres`: Asigna un nombre único y representativo al contenedor.
- `-p 5432:5432`: Mapea el puerto local `5432` al puerto `5432` del contenedor.
- `-e POSTGRES_DB=bodega_diza`: Crea automáticamente la base de datos inicial con el nombre `bodega_diza`.
- `-e POSTGRES_USER=postgres`: Establece el usuario administrador de PostgreSQL.
- `-e POSTGRES_PASSWORD=postgres`: Establece la contraseña del usuario administrador.
- `-v bodega_diza_postgres_data:/var/lib/postgresql/data`: Crea un volumen persistente para que los datos no se pierdan al reiniciar o eliminar el contenedor.
- `--restart unless-stopped`: Configura el reinicio automático del contenedor en caso de reinicio del daemon de Docker o del sistema.
- `postgres:16-alpine`: Imagen oficial liviana y optimizada de PostgreSQL 16.

---

### Opción 2: Usar Docker Compose

El proyecto incluye un archivo `docker-compose.yml` preconfigurado que lee automáticamente las variables del archivo `.env`:

```bash
# Iniciar el servicio en segundo plano
docker compose up -d

# Detener el servicio
docker compose down
```

---

### 🛠️ Comandos Útiles para Gestionar el Contenedor

- **Verificar que el contenedor está corriendo:**
  ```bash
  docker ps -f name=bodega_diza_postgres
  ```

- **Ver registros (logs) del contenedor:**
  ```bash
  docker logs -f bodega_diza_postgres
  ```

- **Ingresar a la consola interactiva `psql`:**
  ```bash
  docker exec -it bodega_diza_postgres psql -U postgres -d bodega_diza
  ```

- **Detener el contenedor:**
  ```bash
  docker stop bodega_diza_postgres
  ```

- **Iniciar el contenedor nuevamente:**
  ```bash
  docker start bodega_diza_postgres
  ```

- **Eliminar el contenedor (los datos permanecen en el volumen):**
  ```bash
  docker rm -f bodega_diza_postgres
  ```

---

## ⚙️ Variables de Entorno (`.env`)

El proyecto cuenta con un archivo `.env` en la raíz del módulo de la API. Estas variables son leídas e inyectadas dinámicamente en el archivo `application.properties`:

```env
# Configuración del Servidor
SERVER_PORT=8080

# Configuración de Base de Datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bodega_diza
DB_USER=postgres
DB_PASSWORD=postgres

# Configuración de JPA / Hibernate
SPRING_JPA_HIBERNATE_DDL_AUTO=update
SPRING_JPA_SHOW_SQL=true

# Configuración de JWT
JWT_SECRET=404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970
JWT_EXPIRATION=86400000
```

Se incluye además una plantilla `.env.example` para facilitar la configuración en otros entornos o nuevos desarrolladores.

---

## 🔌 Configuración de `application.properties`

El archivo `src/main/resources/application.properties` vincula las propiedades del API con las variables del `.env` usando valores por defecto de respaldo:

- **Carga de variables:** `spring.config.import=optional:file:.env[.properties],optional:file:../.env[.properties]`
- **Conexión a Base de Datos:**
  - `spring.datasource.url=jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:bodega_diza}`
  - `spring.datasource.username=${DB_USER:postgres}`
  - `spring.datasource.password=${DB_PASSWORD:postgres}`
  - `spring.datasource.driver-class-name=org.postgresql.Driver`
- **JPA & Hibernate:** DDL automático en modo `update` y formateo de consultas SQL activado para desarrollo.
- **JWT:** Claves de configuración `jwt.secret` y `jwt.expiration` disponibles para ser inyectadas en los servicios de autenticación.

---

## 🛡️ Estado de Spring Security (Deshabilitada Temporalmente)

Para facilitar el desarrollo y pruebas de los nuevos endpoints sin requerir tokens ni autenticación HTTP Basic previa, se agregó la clase `com.diza.api.config.SecurityConfig`:

- Se deshabilitó CSRF (`AbstractHttpConfigurer::disable`).
- Se deshabilitó CORS restrictivo para desarrollo.
- Se configuró `.authorizeHttpRequests(auth -> auth.anyRequest().permitAll())`.
- Cuando se termine la implementación de los servicios de autenticación JWT, bastará con actualizar `SecurityConfig` para proteger las rutas deseadas y registrar el filtro JWT.

---

## 🔑 Dependencias JWT Instaladas

En el archivo `build.gradle` se incluyeron las librerías oficiales de **JJWT (Java JSON Web Token)** versión `0.12.6`:

```groovy
// JWT (JSON Web Token)
implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
runtimeOnly 'io.jsonwebtoken:jjwt-impl:0.12.6'
runtimeOnly 'io.jsonwebtoken:jjwt-jackson:0.12.6'
```

- `jjwt-api`: Interfaces y contratos para creación, parseo y validación de tokens JWT.
- `jjwt-impl`: Implementación interna de JJWT en tiempo de ejecución.
- `jjwt-jackson`: Serializador y deserializador JSON basado en Jackson para el payload de los tokens.

---

## 🚀 Ejecución del Proyecto

1. **Asegurarse de que el contenedor de PostgreSQL esté corriendo:**
   ```bash
   docker start bodega_diza_postgres
   ```

2. **Ejecutar la API con Gradle:**
   ```bash
   ./gradlew bootRun
   ```
   La API iniciará en `http://localhost:8080`.

3. **Ejecutar las pruebas unitarias y de integración:**
   ```bash
   ./gradlew test
   ```

4. **Compilar y generar el JAR de producción:**
   ```bash
   ./gradlew build
   ```
