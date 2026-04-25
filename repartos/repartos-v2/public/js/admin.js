/* ══════════════════════════════════════════════════
   admin.js — Lógica del Panel de Administración
   Repartos Rápidos SAS
   ══════════════════════════════════════════════════ */

// ── ESTADO GLOBAL ─────────────────────────────────
let currentEditId = null;   // ID del paquete que se está editando en el modal
let mapaFlota     = null;   // Instancia del mapa Leaflet (se crea una sola vez)
let mapaMarkers   = {};     // { repartidor_id: L.Marker } — marcadores activos en el mapa

// ── UTILIDADES ────────────────────────────────────

/**
 * Genera el HTML de un badge de color según el estado del paquete.
 * @param {string} estado - 'En bodega' | 'En ruta' | 'Entregado' | 'Incidencia'
 * @returns {string} HTML del badge
 */
function badgeEstado(estado) {
  const clases = {
    'En bodega':  'bodega',
    'En ruta':    'ruta',
    'Entregado':  'entregado',
    'Incidencia': 'incidencia'
  };
  const clase = clases[estado] || 'bodega';
  return `<span class="badge badge-${clase}">${estado}</span>`;
}

/**
 * Muestra una notificación tipo "toast" en la esquina inferior derecha.
 * @param {string}  msg   - Texto a mostrar
 * @param {boolean} error - Si es true, el fondo es rojo (error)
 */
function showToast(msg, error = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show' + (error ? ' error' : '');
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// ── NAVEGACIÓN POR PESTAÑAS ───────────────────────

/**
 * Cambia la pestaña activa en el panel.
 * @param {string} nombre - 'dashboard' | 'paquetes' | 'mapa' | 'nuevo'
 */
function switchTab(nombre) {
  // Ocultar todos los paneles y desactivar todos los ítems del sidebar
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Mostrar el panel seleccionado
  document.getElementById('pane-' + nombre).classList.add('active');

  // Actualizar el subtítulo del topbar
  const titulos = { dashboard: 'Dashboard', paquetes: 'Paquetes', mapa: 'Mapa Flota', nuevo: 'Nuevo Envío' };
  document.getElementById('topbar-tab').textContent = titulos[nombre];

  // Marcar el ítem del sidebar como activo
  const orden = { dashboard: 0, paquetes: 1, mapa: 2, nuevo: 3 };
  document.querySelectorAll('.nav-item')[orden[nombre]].classList.add('active');

  // Cargar datos según la pestaña
  if (nombre === 'dashboard') cargarDashboard();
  if (nombre === 'paquetes')  cargarTablaPaquetes();
  if (nombre === 'mapa')      iniciarMapaFlota();
}

// ── DASHBOARD ─────────────────────────────────────

/**
 * Obtiene todos los paquetes y actualiza las tarjetas de estadísticas
 * y la tabla de envíos recientes.
 */
async function cargarDashboard() {
  const paquetes = await fetch('/api/paquetes').then(r => r.json());

  // Actualizar contadores
  document.getElementById('stat-total').textContent     = paquetes.length;
  document.getElementById('stat-bodega').textContent    = paquetes.filter(p => p.estado === 'En bodega').length;
  document.getElementById('stat-ruta').textContent      = paquetes.filter(p => p.estado === 'En ruta').length;
  document.getElementById('stat-incidencia').textContent= paquetes.filter(p => p.estado === 'Incidencia').length;

  // Renderizar los últimos 10 envíos (más recientes primero)
  const tbody = document.getElementById('tabla-dashboard');
  tbody.innerHTML = paquetes.slice(-10).reverse().map(p => `
    <tr>
      <td><strong>${p.guia}</strong></td>
      <td>${p.remitente}</td>
      <td>${p.destinatario}</td>
      <td>${badgeEstado(p.estado)}</td>
      <td><button class="btn btn-sm btn-ghost" onclick="abrirModal(${p.id})">Gestionar</button></td>
    </tr>
  `).join('');
}

// ── TABLA DE PAQUETES ──────────────────────────────

/**
 * Carga y renderiza la tabla completa de todos los paquetes
 * con todas las columnas (incluye peso y repartidor).
 */
async function cargarTablaPaquetes() {
  const paquetes = await fetch('/api/paquetes').then(r => r.json());

  const tbody = document.getElementById('tabla-paquetes');
  tbody.innerHTML = paquetes.map(p => `
    <tr>
      <td><strong>${p.guia}</strong></td>
      <td>${p.remitente}</td>
      <td>${p.destinatario}</td>
      <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
        ${p.direccion_destino}
      </td>
      <td>${p.peso ? p.peso + ' kg' : '–'}</td>
      <td>${p.repartidor_nombre || '<span style="color:var(--muted)">Sin asignar</span>'}</td>
      <td>${badgeEstado(p.estado)}</td>
      <td><button class="btn btn-sm btn-ghost" onclick="abrirModal(${p.id})">Editar</button></td>
    </tr>
  `).join('');
}

// ── MODAL DE EDICIÓN ──────────────────────────────

/**
 * Abre el modal para editar el estado y repartidor de un paquete.
 * @param {number} id - ID del paquete a editar
 */
async function abrirModal(id) {
  currentEditId = id;

  // Obtener datos actuales del paquete y la lista de repartidores
  const [paquete, repartidores] = await Promise.all([
    fetch(`/api/paquetes/${id}`).then(r => r.json()),
    fetch('/api/repartidores').then(r => r.json())
  ]);

  // Rellenar el modal con los datos actuales
  document.getElementById('modal-guia').value   = paquete.guia;
  document.getElementById('modal-estado').value = paquete.estado;

  // Poblar el selector de repartidores
  const selectRep = document.getElementById('modal-repartidor');
  selectRep.innerHTML =
    '<option value="">Sin asignar</option>' +
    repartidores.map(r =>
      `<option value="${r.id}" ${r.id === paquete.repartidor_id ? 'selected' : ''}>${r.nombre}</option>`
    ).join('');

  document.getElementById('modal').classList.add('open');
}

/** Cierra el modal de edición sin guardar cambios. */
function cerrarModal() {
  document.getElementById('modal').classList.remove('open');
  currentEditId = null;
}

/**
 * Envía los cambios del modal al servidor mediante PUT /api/paquetes/:id.
 * Si tiene éxito, recarga dashboard y tabla.
 */
async function guardarCambios() {
  const estado       = document.getElementById('modal-estado').value;
  const repartidorId = document.getElementById('modal-repartidor').value;

  const res = await fetch(`/api/paquetes/${currentEditId}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      estado,
      repartidor_id: repartidorId ? parseInt(repartidorId) : null
    })
  });

  if (res.ok) {
    showToast('✅ Envío actualizado correctamente');
    cerrarModal();
    cargarDashboard();
    cargarTablaPaquetes();
  } else {
    const err = await res.json();
    showToast(err.error || 'Error al actualizar', true);
  }
}

// ── FORMULARIO NUEVO ENVÍO ────────────────────────

/**
 * Lee el formulario, valida los campos obligatorios y llama
 * POST /api/paquetes para registrar el nuevo envío.
 */
async function registrarEnvio() {
  const remitente        = document.getElementById('f-remitente').value.trim();
  const destinatario     = document.getElementById('f-destinatario').value.trim();
  const direccion_destino= document.getElementById('f-direccion').value.trim();
  const peso             = parseFloat(document.getElementById('f-peso').value) || null;
  const descripcion      = document.getElementById('f-descripcion').value.trim();

  // Validación del lado cliente
  if (!remitente || !destinatario || !direccion_destino) {
    return showToast('❌ Remitente, destinatario y dirección son obligatorios', true);
  }

  const res = await fetch('/api/paquetes', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ remitente, destinatario, direccion_destino, peso, descripcion })
  });

  const data = await res.json();

  if (res.ok) {
    showToast(`✅ Paquete registrado: ${data.guia}`);
    // Limpiar formulario
    ['f-remitente', 'f-destinatario', 'f-direccion', 'f-peso', 'f-descripcion']
      .forEach(id => { document.getElementById(id).value = ''; });
  } else {
    showToast(data.error || 'Error al registrar', true);
  }
}

// ── MAPA DE FLOTA ──────────────────────────────────

/**
 * Inicializa el mapa Leaflet (solo la primera vez) y arranca
 * el intervalo de actualización automática de posiciones.
 */
function iniciarMapaFlota() {
  if (!mapaFlota) {
    mapaFlota = L.map('mapa-flota').setView([4.6218, -74.0816], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapaFlota);
  }

  actualizarPosicionesFlota();

  // Evitar crear múltiples intervalos si el usuario entra y sale de la pestaña
  if (!window._mapaInterval) {
    window._mapaInterval = setInterval(actualizarPosicionesFlota, 5000);
  }
}

/**
 * Consulta GET /api/repartidores/ubicaciones y actualiza (o crea)
 * los marcadores de cada repartidor activo en el mapa.
 */
async function actualizarPosicionesFlota() {
  const ubicaciones = await fetch('/api/repartidores/ubicaciones').then(r => r.json());

  ubicaciones.forEach(rep => {
    if (mapaMarkers[rep.id]) {
      // El marcador ya existe: solo moverlo
      mapaMarkers[rep.id].setLatLng([rep.lat, rep.lng]);
    } else {
      // Primera vez: crear marcador con ícono personalizado
      const icono = L.divIcon({
        className: '',
        html: `<div style="
          background:#3b82f6; width:36px; height:36px;
          border-radius:50%; border:3px solid #fff;
          display:flex; align-items:center; justify-content:center;
          color:#fff; font-size:16px;
          box-shadow:0 2px 8px rgba(0,0,0,.4)">🛵</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      mapaMarkers[rep.id] = L.marker([rep.lat, rep.lng], { icon: icono })
        .addTo(mapaFlota)
        .bindPopup(`<strong>${rep.nombre}</strong>`);
    }
  });
}

// ── INICIALIZACIÓN ─────────────────────────────────
// Cargar el dashboard al abrir la página
cargarDashboard();
