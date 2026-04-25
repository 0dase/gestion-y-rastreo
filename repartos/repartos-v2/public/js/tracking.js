/* ══════════════════════════════════════════════════
   tracking.js — Lógica de la Página de Rastreo
   Repartos Rápidos SAS
   ══════════════════════════════════════════════════ */

// ── ESTADO GLOBAL ─────────────────────────────────
let mapaRastreo        = null;  // Instancia del mapa Leaflet
let mapaMarker         = null;  // Marcador del repartidor en el mapa
let rastreoInterval    = null;  // Intervalo para actualizar la posición en vivo
let currentRepartidorId = null; // ID del repartidor cuya posición se está siguiendo

// ── UTILIDADES ────────────────────────────────────

/**
 * Genera el HTML de un badge de color según el estado del paquete.
 * @param {string} estado
 * @returns {string} HTML del badge
 */
function badgeEstado(estado) {
  const clases = {
    'En bodega':  'bodega',
    'En ruta':    'ruta',
    'Entregado':  'entregado',
    'Incidencia': 'incidencia'
  };
  return `<span class="badge badge-${clases[estado] || 'bodega'}">${estado}</span>`;
}

/**
 * Calcula el porcentaje de progreso de la barra del timeline.
 * @param {string} estado
 * @returns {number} 0–100
 */
function calcularProgreso(estado) {
  const mapa = { 'En bodega': 0, 'En ruta': 50, 'Entregado': 100, 'Incidencia': 25 };
  return mapa[estado] ?? 0;
}

/**
 * Determina la clase CSS ('done' | 'current' | '') de cada paso del timeline.
 * @param {string} paso   - El estado que representa este paso
 * @param {string} estado - El estado actual del paquete
 * @returns {string}
 */
function claseTimeline(paso, estado) {
  const orden   = ['En bodega', 'En ruta', 'Entregado'];
  const iActual = orden.indexOf(estado);
  const iPaso   = orden.indexOf(paso);

  if (estado === 'Incidencia' && paso === 'En bodega') return 'done';
  if (iPaso < iActual) return 'done';
  if (iPaso === iActual) return 'current';
  return '';
}

/**
 * Formatea un string ISO 8601 a fecha legible en español (Colombia).
 * @param {string} iso
 * @returns {string} Ej: "1 oct. 2025, 9:00 a. m."
 */
function formatearFecha(iso) {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

// ── RASTREO PRINCIPAL ──────────────────────────────

/**
 * Punto de entrada principal. Lee el número de guía, consulta la API
 * y renderiza el resultado (o un mensaje de error si no existe).
 */
async function rastrear() {
  const guia = document.getElementById('input-guia').value.trim();
  if (!guia) return;

  // Limpiar estado anterior
  if (rastreoInterval) { clearInterval(rastreoInterval); rastreoInterval = null; }
  if (mapaRastreo)     { mapaRastreo.remove(); mapaRastreo = null; mapaMarker = null; }

  const res = await fetch(`/api/paquetes/${encodeURIComponent(guia)}`);
  const div = document.getElementById('resultado');
  div.style.display = 'block';

  // ── Paquete no encontrado ──
  if (!res.ok) {
    div.innerHTML = `
      <div class="msg-box">
        <div class="msg-icon">📭</div>
        <div class="msg-title">Paquete no encontrado</div>
        <div class="msg-sub">
          El número de guía <strong>${guia.toUpperCase()}</strong>
          no existe en nuestro sistema.
        </div>
      </div>`;
    return;
  }

  // ── Paquete encontrado ──
  const paquete = await res.json();
  renderizarResultado(paquete, div);

  // Si está en ruta, activar el mapa y el polling de posición
  if (paquete.estado === 'En ruta' && paquete.repartidor) {
    currentRepartidorId = paquete.repartidor.id;
    // Pequeño timeout para que el DOM se renderice antes de inicializar Leaflet
    setTimeout(() => iniciarMapaRastreo(paquete.repartidor), 100);
    rastreoInterval = setInterval(() => actualizarPosicion(currentRepartidorId), 5000);
  }
}

// ── RENDERIZADO DEL RESULTADO ──────────────────────

/**
 * Construye y inyecta el HTML completo del resultado en el contenedor.
 * @param {Object} p   - Objeto paquete devuelto por la API (incluye .repartidor)
 * @param {Element} div - Contenedor donde se inyecta el HTML
 */
function renderizarResultado(p, div) {
  const progreso = calcularProgreso(p.estado);
  const c1 = claseTimeline('En bodega', p.estado);
  const c2 = claseTimeline('En ruta',   p.estado);
  const c3 = claseTimeline('Entregado', p.estado);

  // Tarjeta de información del repartidor
  const tarjetaRepartidor = p.repartidor
    ? `<div class="info-card">
         <div class="info-card-title">🛵 Repartidor Asignado</div>
         <div class="info-row">
           <span class="info-label">Nombre</span>
           <span class="info-value">${p.repartidor.nombre}</span>
         </div>
         <div class="info-row">
           <span class="info-label">Teléfono</span>
           <span class="info-value">${p.repartidor.telefono}</span>
         </div>
         <div class="info-row">
           <span class="info-label">Estado</span>
           <span class="info-value">${p.repartidor.activo ? '🟢 Activo' : '🔴 Inactivo'}</span>
         </div>
       </div>`
    : `<div class="info-card">
         <div class="info-card-title">🛵 Repartidor</div>
         <div style="color:var(--muted); font-size:13px; padding:8px 0">
           Sin repartidor asignado aún.
         </div>
       </div>`;

  // Sección de mapa (solo si está "En ruta")
  const seccionMapa = (p.estado === 'En ruta' && p.repartidor)
    ? `<div class="map-card">
         <div class="map-header">
           <span class="map-header-title">📍 Ubicación del Repartidor</span>
           <span class="live-badge">● En vivo — actualiza cada 5s</span>
         </div>
         <div id="mapa-rastreo"></div>
       </div>`
    : '';

  div.innerHTML = `
    <!-- Cabecera con guía y badge de estado -->
    <div class="result-header">
      <div>
        <div class="guia-code">${p.guia}</div>
        <div class="guia-meta">
          Registrado: ${formatearFecha(p.fecha_creacion)} ·
          Actualizado: ${formatearFecha(p.ultima_actualizacion)}
        </div>
      </div>
      ${badgeEstado(p.estado)}
    </div>

    <!-- Timeline de progreso -->
    <div class="timeline-wrap">
      <div class="timeline-title">Progreso del Envío</div>
      <div class="timeline">
        <div class="timeline-line"></div>
        <div class="timeline-progress" style="width:${progreso}%"></div>
        <div class="tl-step">
          <div class="tl-dot ${c1}">📦</div>
          <div class="tl-label ${c1}">En bodega</div>
        </div>
        <div class="tl-step">
          <div class="tl-dot ${c2}">🛵</div>
          <div class="tl-label ${c2}">En ruta</div>
        </div>
        <div class="tl-step">
          <div class="tl-dot ${c3}">✅</div>
          <div class="tl-label ${c3}">Entregado</div>
        </div>
      </div>
    </div>

    <!-- Datos del envío y del repartidor -->
    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-title">📋 Datos del Envío</div>
        <div class="info-row">
          <span class="info-label">Remitente</span>
          <span class="info-value">${p.remitente}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Destinatario</span>
          <span class="info-value">${p.destinatario}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Dirección</span>
          <span class="info-value">${p.direccion_destino}</span>
        </div>
        ${p.peso       ? `<div class="info-row"><span class="info-label">Peso</span><span class="info-value">${p.peso} kg</span></div>` : ''}
        ${p.descripcion? `<div class="info-row"><span class="info-label">Contenido</span><span class="info-value">${p.descripcion}</span></div>` : ''}
      </div>
      ${tarjetaRepartidor}
    </div>

    ${seccionMapa}
  `;
}

// ── MAPA DE RASTREO ────────────────────────────────

/**
 * Inicializa el mapa Leaflet centrado en la posición del repartidor
 * y coloca su marcador con un popup con su nombre.
 * @param {Object} repartidor - { id, nombre, lat, lng }
 */
function iniciarMapaRastreo(repartidor) {
  mapaRastreo = L.map('mapa-rastreo').setView([repartidor.lat, repartidor.lng], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(mapaRastreo);

  const icono = L.divIcon({
    className: '',
    html: `<div style="
      background:#3b82f6; width:40px; height:40px;
      border-radius:50%; border:3px solid #fff;
      display:flex; align-items:center; justify-content:center;
      font-size:18px; box-shadow:0 3px 10px rgba(0,0,0,.5)">🛵</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  mapaMarker = L.marker([repartidor.lat, repartidor.lng], { icon: icono })
    .addTo(mapaRastreo)
    .bindPopup(`<strong>${repartidor.nombre}</strong><br>En camino a tu dirección`)
    .openPopup();
}

/**
 * Consulta las ubicaciones activas y mueve el marcador del repartidor
 * al que se está siguiendo actualmente.
 * @param {number} repId - ID del repartidor
 */
async function actualizarPosicion(repId) {
  const ubicaciones = await fetch('/api/repartidores/ubicaciones').then(r => r.json());
  const rep = ubicaciones.find(r => r.id === repId);
  if (rep && mapaMarker) {
    mapaMarker.setLatLng([rep.lat, rep.lng]);
  }
}

// ── EVENTOS ────────────────────────────────────────
// Permitir buscar presionando Enter en el campo de guía
document.getElementById('input-guia')
  .addEventListener('keydown', e => { if (e.key === 'Enter') rastrear(); });
