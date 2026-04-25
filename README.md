# Repartos Rápidos SAS — Plataforma de Gestión y Rastreo

Ingeniería Web I — Guía 4 / Guía 5 · Fase 1

## Equipo
- Dery Sanchez
- Elkin Aldana  
- Sebastian Ñuztes

## Descripción
Plataforma web para modernizar la logística de "Repartos Rápidos SAS".  
Reemplaza el caos manual (cuaderno + WhatsApp + Excel) con un sistema digitalizado.

## Stack
| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express.js |
| Frontend | HTML5, CSS3, JS Vanilla |
| Mapas | Leaflet.js + OpenStreetMap |
| API | REST / JSON (Fetch API) |
| Persistencia | En memoria (MVP) |

## Instalación y ejecución

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor
node server.js
```

## Acceso
- **Panel Admin:** http://localhost:3000
- **Rastreo Público:** http://localhost:3000/rastreo

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/paquetes | Registrar nuevo envío |
| GET | /api/paquetes | Listar todos los envíos |
| GET | /api/paquetes/:id | Consultar por ID o guía |
| PUT | /api/paquetes/:id | Actualizar estado/repartidor |
| GET | /api/repartidores | Lista de repartidores |
| GET | /api/repartidores/ubicaciones | GPS activos |

## Datos de prueba
El servidor inicia con 3 paquetes y 2 repartidores precargados:
- **RR-00001** — Ana García — En ruta (Carlos López)
- **RR-00002** — Carlos Ruiz — En bodega
- **RR-00003** — Sofía Morales — Entregado
