# 🚀 Guía de Despliegue: GitHub y Vercel (EDM AutoMix App)

Este documento detalla los pasos, configuraciones, comandos y cuentas necesarias para guardar, subir y desplegar con éxito las modificaciones del proyecto en **GitHub** y **Vercel**.

---

## 📋 1. Cuentas y Requisitos Previos

| Servicio | Detalle de Cuenta / Configuración |
| :--- | :--- |
| **Identidad Git (Committer)** | **Nombre**: `Juan Giron Salazar`<br>**Email**: `juangironsalazar@gmail.com` |
| **GitHub Repository** | `https://github.com/GironconG/OlaApp.git`<br>**Usuario**: `GironconG`<br>**Rama Principal**: `master`<br>*(Nota: Si es privado, requiere iniciar sesión en GitHub para ver la URL en el navegador)* |
| **Vercel Production** | **Proyecto**: `edm_automix_app`<br>**Equipo / Cuenta**: `juangironsalazar-5244s-projects`<br>**URL Producción**: [https://edmautomixapp.vercel.app](https://edmautomixapp.vercel.app) |
| **Herramientas Instaladas** | Git CLI, Node.js (v18+ / v24), Vercel CLI |

---

## 🛠️ 2. Paso a Paso para GitHub

### Paso 2.1: Configurar la Identidad del Propietario en Git
Asegúrate de ejecutar estos comandos antes de hacer commit para que el historial refleje tu cuenta real como owner:

```bash
git config user.name "Juan Giron Salazar"
git config user.email "juangironsalazar@gmail.com"
```

### Paso 2.2: Guardar los Cambios (Add & Commit)
Añade todos los archivos modificados y crea un commit con un mensaje descriptivo:

```bash
git add .
git commit -m "Actualizacion de metadatos de busqueda y reordenamiento armonico"
```

### Paso 2.3: Subir Cambios a GitHub (Push)
Envía los cambios a la rama principal de GitHub:

```bash
git push origin master
```

> **Nota sobre Autenticación GitHub**:
> Si Git te solicita credenciales en la terminal o abre una ventana del navegador (*Git Credential Manager*), inicia sesión con la cuenta de GitHub **`GironconG`** o ingresa un **Personal Access Token (PAT)** si tienes autenticación de 2 factores activada.

---

## ⚡ 3. Paso a Paso para Vercel Production

### Paso 3.1: Enlazar el Proyecto (Solo si es necesario o primera vez)
Si la carpeta del proyecto no está enlazada o perdiste el archivo `.vercel/project.json`, ejecuta:

```bash
npx vercel link --yes --project edm_automix_app
```

### Paso 3.2: Desplegar a Producción (Deploy --prod)
Ejecuta el siguiente comando para compilar las funciones Serverless (`api/search.js`), subir los recursos estáticos y actualizar la URL pública de producción:

```bash
npx vercel --prod --yes
```

### Paso 3.3: Verificación del Despliegue
Al terminar el despliegue, Vercel mostrará en la terminal:
```text
▲ Aliased https://edmautomixapp.vercel.app
```
Ingresa a [https://edmautomixapp.vercel.app](https://edmautomixapp.vercel.app) para confirmar que tus cambios están en vivo.

---

## 🪄 4. Script Automático Único (PowerShell)

Si deseas subir todo (GitHub y Vercel) de un solo golpe sin escribir comando por comando, puedes ejecutar esta secuencia en la terminal de PowerShell:

```powershell
# 1. Configurar identidad Git
git config user.name "Juan Giron Salazar"
git config user.email "juangironsalazar@gmail.com"

# 2. Commit local
git add .
git commit -m "Nuevas mejoras de mezcla y metadatos"

# 3. Subir a GitHub
git push origin master

# 4. Vincular y Desplegar a Vercel
npx vercel link --yes --project edm_automix_app
npx vercel --prod --yes
```

---

## ❓ 5. Solución de Problemas Frecuentes

- **Error de permisos en Vercel (`Not authorized`)**:
  - Ejecuta `npx vercel link --yes --project edm_automix_app` para renovar el token de acceso.
- **Push rechazado en GitHub (`Permission to ... denied`)**:
  - Revisa que estés autenticado con el usuario `GironconG` en tu administrador de credenciales de Windows (`Control Panel > Credential Manager > Windows Credentials > git:https://github.com`).
- **Error en nombre de proyecto Vercel**:
  - Asegúrate de usar siempre en minúsculas `edm_automix_app`.
