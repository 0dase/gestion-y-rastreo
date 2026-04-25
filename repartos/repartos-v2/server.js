const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── DATOS EN MEMORIA (MVP) ──────────────────────────────────────────────────

let paquetes = [
  {
    id: 1,
    guia: 'RR-00001',
    remitente: 'Juan Pérez',
    destinatario: 'Ana García',
    direccion_destino: 'Calle 72 #10-34, Bogotá',
    peso: 1.5,
    descripcion: 'Documentos legales',
    estado: 'En ruta',
    repartidor_id: 1,
    fecha_creacion: new Date('2025-10-01T09:00:00Z').toISOString(),
    ultima_actualizacion: new Date('2025-10-01T11:30:00Z').toISOString()
  },
  {
    id: 2,
    guia: 'RR-00002',
    remitente: 'Empresa XY',
    destinatario: 'Carlos Ruiz',
    direccion_destino: 'Av. El Dorado #68B-45, Bogotá',
    peso: 3.2,
    descripcion: 'Equipos electrónicos',
    estado: 'En bodega',
    repartidor_id: null,
    fecha_creacion: new Date('2025-10-01T08:00:00Z').toISOString(),
    ultima_actualizacion: new Date('2025-10-01T08:00:00Z').toISOString()
  },
  {
    id: 3,
    guia: 'RR-00003',
    remitente: 'Librería Cristal',
    destinatario: 'Sofía Morales',
    direccion_destino: 'Cra 15 #93-47, Bogotá',
    peso: 0.8,
    descripcion: 'Libros',
    estado: 'Entregado',
    repartidor_id: 2,
    fecha_creacion: new Date('2025-09-30T14:00:00Z').toISOString(),
    ultima_actualizacion: new Date('2025-10-01T10:15:00Z').toISOString()
  }
];

let repartidores = [
  {
    id: 1,
    nombre: 'Carlos López',
    telefono: '310-555-0101',
    activo: true,
    lat: 4.6347,
    lng: -74.0628
  },
  {
    id: 2,
    nombre: 'María Torres',
    telefono: '320-555-0202',
    activo: true,
    lat: 4.6097,
    lng: -74.0817
  }
];

let nextId = 4;

// ── SIMULACIÓN DE MOVIMIENTO GPS ────────────────────────────────────────────
setInterval(() => {
  repartidores.forEach(r => {
    if (r.activo) {
      r.lat += (Math.random() - 0.5) * 0.002;
      r.lng += (Math.random() - 0.5) * 0.002;
    }
  });
}, 4000);

// ── VALIDACIONES ─────────────────────────────────────────────────────────────
const ESTADOS_VALIDOS = ['En bodega', 'En ruta', 'Entregado', 'Incidencia'];

// ── ENDPOINTS PAQUETES ────────────────────────────────────────────────────────

// POST /api/paquetes — Registrar nuevo envío
app.post('/api/paquetes', (req, res) => {
  const { remitente, destinatario, direccion_destino, peso, descripcion } = req.body;

  if (!remitente || !destinatario || !direccion_destino) {
    return res.status(400).json({
      error: 'Los campos remitente, destinatario y direccion_destino son requeridos.'
    });
  }

  const nuevo = {
    id: nextId,
    guia: `RR-${String(nextId).padStart(5, '0')}`,
    remitente,
    destinatario,
    direccion_destino,
    peso: peso || null,
    descripcion: descripcion || '',
    estado: 'En bodega',
    repartidor_id: null,
    fecha_creacion: new Date().toISOString(),
    ultima_actualizacion: new Date().toISOString()
  };

  paquetes.push(nuevo);
  nextId++;

  res.status(201).json({
    id: nuevo.id,
    guia: nuevo.guia,
    estado: nuevo.estado,
    repartidor_id: nuevo.repartidor_id,
    fecha_creacion: nuevo.fecha_creacion
  });
});

// GET /api/paquetes — Listar todos los envíos
app.get('/api/paquetes', (req, res) => {
  const resultado = paquetes.map(p => {
    const rep = repartidores.find(r => r.id === p.repartidor_id);
    return { ...p, repartidor_nombre: rep ? rep.nombre : null };
  });
  res.status(200).json(resultado);
});

// GET /api/paquetes/:id — Consultar por ID o guía
app.get('/api/paquetes/:id', (req, res) => {
  const param = req.params.id;
  const paquete = paquetes.find(
    p => p.id === parseInt(param) || p.guia.toLowerCase() === param.toLowerCase()
  );

  if (!paquete) {
    return res.status(404).json({ error: 'Paquete no encontrado.' });
  }

  const rep = repartidores.find(r => r.id === paquete.repartidor_id);
  res.status(200).json({
    ...paquete,
    repartidor: rep || null
  });
});

// PUT /api/paquetes/:id — Actualizar estado y/o repartidor
app.put('/api/paquetes/:id', (req, res) => {
  const paquete = paquetes.find(p => p.id === parseInt(req.params.id));

  if (!paquete) {
    return res.status(404).json({ error: 'Paquete no encontrado.' });
  }

  const { estado, repartidor_id } = req.body;

  if (estado !== undefined) {
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({
        error: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`
      });
    }
    paquete.estado = estado;
  }

  if (repartidor_id !== undefined) {
    if (repartidor_id !== null && !repartidores.find(r => r.id === repartidor_id)) {
      return res.status(400).json({ error: 'Repartidor no encontrado.' });
    }
    paquete.repartidor_id = repartidor_id;
  }

  paquete.ultima_actualizacion = new Date().toISOString();
  res.status(200).json(paquete);
});

// ── ENDPOINTS REPARTIDORES ────────────────────────────────────────────────────

// GET /api/repartidores — Lista completa
app.get('/api/repartidores', (req, res) => {
  res.status(200).json(repartidores);
});

// GET /api/repartidores/ubicaciones — Coordenadas GPS de activos
app.get('/api/repartidores/ubicaciones', (req, res) => {
  const activos = repartidores
    .filter(r => r.activo)
    .map(r => ({ id: r.id, nombre: r.nombre, lat: r.lat, lng: r.lng }));
  res.status(200).json(activos);
});

// ── RUTAS HTML ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/rastreo', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tracking.html')));

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Admin:   http://localhost:${PORT}/`);
  console.log(`   Rastreo: http://localhost:${PORT}/rastreo`);
});
