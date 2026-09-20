# Despliegue de Café SofIA

## Requisitos

- Cuenta en GitHub
- Cuenta en Vercel
- Cuenta en Stripe
- Node.js 22 instalado localmente

## 1) Instalar dependencias

```bash
export PATH="/Users/kriss/Desktop/cafe-sofia-proyecto kriss/.runtime/node-v22.13.0-darwin-x64/bin:$PATH"
npm install
```

## 2) Configurar variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

Ejemplo:

```env
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
PORT=3000
```

## 3) Ejecutar localmente

```bash
npm start
```

La API queda disponible en:

```bash
http://localhost:3000
```

## 4) Publicar en Vercel

1. Subir el proyecto a GitHub.
2. Abrir https://vercel.com
3. Importar el repositorio
4. Seleccionar el proyecto
5. Agregar variables de entorno:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
6. Hacer deploy

## 5) Configurar Stripe

- Crear una cuenta de Stripe
- Generar clave secreta
- Crear un endpoint de webhook para esta URL:

```bash
https://tu-proyecto.vercel.app/api/webhook/stripe
```

- Seleccionar eventos:
  - `checkout.session.completed`

## 6) Endpoints principales

- `GET /api/health`
- `GET /api/products`
- `POST /api/orders`
- `GET /api/orders`
- `PATCH /api/orders/:id/status`
- `POST /api/checkout`
- `POST /api/webhook/stripe`
- `GET /api/admin/summary`

## 7) Recomendación final

Para producción real conviene:

- conectar Supabase/PostgreSQL en vez de datos en memoria
- guardar pedidos persistentes
- guardar pagos reales y eventos de Stripe
- proteger rutas de administrador
- preparar dashboard con autenticación
