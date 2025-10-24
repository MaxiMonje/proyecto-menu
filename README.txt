# Proyecto Menú Multitenant

## 🧠 Tecnologías usadas
- Node.js (v18 o superior)
- Express
- TypeScript
- Sequelize ORM
- MySQL
- Argon2 (para hashear contraseñas)
- Zod (validación de datos)
- Dotenv (configuración por entorno)

---

## ⚙️ Qué necesitás tener instalado
1. **Node.js y npm**
   - Descargar desde https://nodejs.org/
2. **MySQL**
   - Versión 8.0+
   - Crear una base de datos vacía, por ejemplo: `menu_db`
3. **Instalar dependencias del proyecto**
   ```bash
   npm install
   ```

---

## ⚙️ Configuración
1. Crear un archivo `.env` en la raíz del proyecto con estos valores:
	PORT=3000
	DB_HOST=localhost
	DB_PORT=3306
	DB_NAME=catalogo
	DB_USER=root
	DB_PASSWORD=12345678
   ```

## ▶️ Cómo correr el proyecto

### 1️ Ejecutar el seeder general
Antes de levantar el servidor, corré el seeder para generar los datos iniciales (usuarios, roles, etc):

```bash
npm run seed
```

### 2️ Modo desarrollo
```bash
npm run dev
```

### 3️ Modo producción
```bash
npm run build
npm start
```

El servidor corre en: [http://localhost:3000](http://localhost:3000)

---

## 🧩 Endpoints principales

### Usuarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/users` | Crear usuario (genera subdominio automático) |
| GET | `/api/users` | Listar usuarios |
| PUT | `/api/users/:id` | Actualizar usuario |
| DELETE | `/api/users/:id` | Baja lógica |

### Menús (por tenant)
> Todos los endpoints requieren el header: `x-tenant-subdomain: <subdominio>`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/menus` | Listar menús del tenant |
| GET | `/api/menus/:id` | Obtener menú por ID |
| POST | `/api/menus` | Crear nuevo menú |
| PUT | `/api/menus/:id` | Actualizar menú |
| DELETE | `/api/menus/:id` | Baja lógica (active=false) |

---

## ✅ Ejemplo rápido

### Crear usuario
```bash
curl -X POST http://localhost:3000/api/users   -H "Content-Type: application/json"   -d '{
    "name": "Maxi",
    "lastName": "Laraia",
    "email": "maxi@amax.com",
    "cel": "1122334455",
    "roleId": 1,
    "password": "12345678"
  }'
```

### Crear menú (usando el tenant generado)
```bash
curl -X POST http://localhost:3000/api/menus   -H "Content-Type: application/json"   -H "x-tenant-subdomain: maxi-laraia"   -d '{
    "title": "Catálogo AMAX",
    "pos": "Sucursal Avellaneda"
  }'
```
