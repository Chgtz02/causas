# Despliegue en Vercel

Para desplegar esta aplicación y hacerla pública, sigue estos pasos:

### 1. Instalar Vercel CLI (si no lo tienes)
Abre tu terminal local y ejecuta:
```bash
npm install -g vercel
```

### 2. Iniciar sesión
```bash
vercel login
```

### 3. Desplegar
Ejecuta el siguiente comando en la carpeta raíz del proyecto:
```bash
vercel
```
*   **Set up and deploy?** yes
*   **Which scope?** (tu cuenta personal)
*   **Link to existing project?** no
*   **What's your project's name?** causas-app (o el que prefieras)
*   **In which directory?** ./
*   **Want to modify settings?** no

### 4. Producción
Una vez verificado el despliegue de prueba, hazlo definitivo con:
```bash
vercel --prod
```

---

### Nota sobre Seguridad y Supabase
Actualmente, las credenciales de Supabase están en el archivo `app.js`. Esto es funcional para el desarrollo, pero para una aplicación profesional en producción, se recomienda usar variables de entorno en el panel de Vercel. Como estamos usando la **anon key**, es seguro dejarla en el código frontend ya que Supabase usa **Row Level Security (RLS)** para proteger los datos en el servidor.
