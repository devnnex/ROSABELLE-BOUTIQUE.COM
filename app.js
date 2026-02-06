const API_URL = "https://script.google.com/macros/s/AKfycbymsqqLVamHZedjgJwtANAFfcbVCCR-R8Lh_GUwQC8lv99RikW85xhlIiGYHTg7C4LZ/exec";



const tbody = document.getElementById("tbody");
const modal = document.getElementById("modal");
const form = document.getElementById("form");

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const btnEditCancelar = document.getElementById("btnEditCancelar");

const btnDeleteSelected = document.getElementById("btnDeleteInventorySelected");
const selectAllInventory = document.getElementById("selectAllInventory");

btnDeleteSelected.addEventListener("click", eliminarSeleccionadosInventario);




/* ======================
    NAVEGACIÓN ENTRE VISTAS
====================== */

const views = {
  inventario: document.getElementById("view-inventario"),
  ventas: document.getElementById("view-ventas"),
  analisis: document.getElementById("view-analisis"),
  clientes: document.getElementById("view-clientes") // 🔹 AÑADIDO
};


document.querySelectorAll(".nav-menu a").forEach(link => {
  link.onclick = () => {
    document.querySelectorAll(".nav-menu a")
      .forEach(a => a.classList.remove("active"));

    link.classList.add("active");

    Object.values(views).forEach(v => v.classList.remove("active"));
    const view = link.dataset.view;
    views[view].classList.add("active");

    if (view === "ventas") {
         cargarVentas();
    }

    if (view === "analisis") {
        if (!window.__analysisInit) {
            window.__analysisInit = true;
            ANALYSIS.init();
  }
}

  };
});



function getNombreProductoFromRow(row) {
  const nameContainer = row.children[1].querySelector(".product-name");
  if (!nameContainer) return "";

  return nameContainer.childNodes[0].textContent.trim();
}



/* ======================
    KPI MODO PARA MOSTRAR EN VENTAS Y CAMBIAR CON EL BOTON PARA MOSTRAR EL DESCUENTO O LAS VENTAS
====================== */

let kpiModo = "ventas"; // "ventas" | "descuentos"
let kpiAnimating = false;

//  estado básico de editar prenda en el moda, este es independiente
let editBasicState = {
  id: null,
  product: null // 👈 producto completo
};

/* ======================
    ESTADO EDICIÓN PRODUCTO
====================== */
let editState = {
  mode: "create", // "create" | "edit"
  id: null,
  precioVenta: 0,
  margenOriginal: 0
};


/* ======================
   ESTADO DE CANTIDADES
====================== */
const qtyState = {};
const stockState = {};

/* ======================
   ESTADO CARRITO (MULTI)
====================== */
let sellCartState = {
  items: [], // [{ id, nombre, marca, precio, qty }]
  pending: false
};


/* ======================
   MODAL
====================== */
btnNuevo.onclick = () => {
  editState = { mode: "create", id: null };
  form.reset();
  modal.classList.remove("hidden");
};

btnCancelar.onclick = () => modal.classList.add("hidden");


/* ===============================
   GLOBAL LOADER CONTROL
================================ */
const loader = document.getElementById("globalLoader");

function showLoader(text = "Cargando información...") {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.querySelector("span").textContent = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (!loader) return;

  loader.classList.add("hidden");
}




/* =====================
   TOAST SYSTEM (GLOBAL)
===================== */
(function injectToastStyles() {
  if (document.getElementById("toast-styles")) return;

  const style = document.createElement("style");
  style.id = "toast-styles";
  style.innerHTML = `
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: linear-gradient(135deg, #0a84ff, #0066ff);
      color: white;
      padding: 14px 22px;
      border-radius: 16px;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 10px 30px rgba(10,132,255,0.45);
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 9999;
      backdrop-filter: blur(10px);
    }

    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  `;
  document.head.appendChild(style);
})();

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}




/* ======================
  VERIFICA SI EL PRODUCTO ES NUEVO DURANTE 24H
====================== */
function isProductoNuevo(fechaProducto) {
  if (!fechaProducto) return false;

  const fecha = new Date(fechaProducto);
  if (isNaN(fecha.getTime())) return false;

  return (Date.now() - fecha.getTime()) < 24 * 60 * 60 * 1000;
}


/* ======================
    TIEMPO DESDE FECHA PARA CALCULAR LAS HORAS DESDE QUE SE AGREGÓ EL PRODUCTO
====================== */
function tiempoDesde(fecha) {
  const diff = Date.now() - new Date(fecha).getTime();
  const horas = Math.floor(diff / (1000 * 60 * 60));
  return horas <= 1 ? "Hace menos de 1h" : `Hace ${horas}h`;
}



/* ======================
   CARGAR INVENTARIO
====================== */
async function cargarInventario() {
  try {
    showLoader("Cargando inventario...");

    const res = await fetch(`${API_URL}?action=list`);
    const data = await res.json();

    // 👇 GUARDAMOS INVENTARIO GLOBAL
    window.inventario = data;

    // 🔠 ORDENAR INVENTARIO ALFABÉTICAMENTE POR NOMBRE (A–Z)
    data.sort((a, b) => {
      const nombreA = (a.nombre || "").toLowerCase().trim();
      const nombreB = (b.nombre || "").toLowerCase().trim();
      return nombreA.localeCompare(nombreB, "es");
    });

    tbody.innerHTML = data.map(p => {

      // 🔒 Normalización local (anti-NaN)
      const precio = Number(
        String(p.precio ?? 0).replace(/[^\d.-]/g, "")
      ) || 0;

      const costo = Number(
        String(p.costo ?? 0).replace(/[^\d.-]/g, "")
      ) || 0;

      const stock = Number(p.stock) || 0;

      qtyState[p.id] = 0;
      stockState[p.id] = stock;

      setTimeout(() => updateStockUI(p.id));

      const esNuevo = isProductoNuevo(p.fecha);
      const tiempoNuevo = esNuevo ? tiempoDesde(p.fecha) : "";

      return `
        <tr
          data-id="${p.id}"
          class="${esNuevo ? "row-new" : ""}"
          ${esNuevo ? `title="Producto agregado ${tiempoNuevo}"` : ""}>

          <td><input type="checkbox" class="row-check"></td>

          <td>
            <div class="product-name">
              ${p.nombre}
              ${esNuevo ? `<div class="product-new-time">${tiempoNuevo}</div>` : ""}
            </div>
          </td>

          <td>${p.marca}</td>

          <td>$ ${precio.toLocaleString("es-CO")}</td>

          <!-- oculto pero seguro -->
          <td style="display:none;">
            $ ${costo.toLocaleString("es-CO")}
          </td>
          <td style="display:none;">${p.categoria}</td>
          <td style="display:none;">${p.subcategoria}</td>
          <!-- fin de ocultos -->

          <td class="stock-cell" id="stock-${p.id}">
            ${
              stock > 0
                ? stock
                : '<span class="stock-out">Agotado</span>'
            }
          </td>

          <td style="color:#00ff88">${p.vendidos}</td>

          <td class="actions">
            <div class="qty">
              <button data-id="${p.id}" onclick="cambiarQty('${p.id}', -1)">-</button>
              <span id="qty-${p.id}">0</span>
              <button data-id="${p.id}" onclick="cambiarQty('${p.id}', 1)">+</button>
            </div>

            <button onclick="editarProducto('${p.id}')">Editar</button>
            <button onclick="eliminarProducto('${p.id}')">Eliminar</button>
          </td>
        </tr>
      `;
    }).join("");

    actualizarTotalGlobalVenta();

  } catch (err) {
    console.error(err);
    showToast("❌ Error cargando inventario");
  } finally {
    hideLoader();
  }

  updateSellCartBadge();

  // ======================
// CHECKBOX INVENTARIO
// ======================
const rowChecks = document.querySelectorAll(".row-check");

rowChecks.forEach(check => {
  check.addEventListener("change", updateDeleteSelectedUI);
});

// reset UI
if (selectAllInventory) selectAllInventory.checked = false;
updateDeleteSelectedUI();

  // ======================
//  FILTRO DE INVENTARIO
// ======================
if (inventoryFilter) {
  aplicarFiltroInventario();
}

}

cargarInventario();



// PRUEBA DE FILTRO DE INVENTARIO
const inventoryFilter = document.getElementById("inventoryFilter");

if (inventoryFilter) {
  inventoryFilter.addEventListener("change", aplicarFiltroInventario);
}

// PRUEBA DE FILTRO DE INVENTARIO
function aplicarFiltroInventario() {
  const value = inventoryFilter.value;
  const rows = tbody.querySelectorAll("tr");

  rows.forEach(row => {
    const id = row.dataset.id;
    const stock = stockState[id] ?? 0;
    const esNuevo = row.classList.contains("row-new");

    let mostrar = true;

    switch (value) {
      case "new":
        mostrar = esNuevo;
        break;

      case "out":
        mostrar = stock <= 0;
        break;

      case "all":
      default:
        mostrar = true;
    }

    row.style.display = mostrar ? "" : "none";
  });
}


// FUNCIONALIDAD SELECT ALL INVENTORY
if (selectAllInventory) {
  selectAllInventory.addEventListener("change", e => {
    const checked = e.target.checked;
    document.querySelectorAll(".row-check").forEach(c => {
      c.checked = checked;
    });
    updateDeleteSelectedUI();
  });
}




// 🔍 BUSCADOR DE INVENTARIO
function filtrarInventario(texto) {
  const query = texto.toLowerCase().trim();
  const rows = tbody.querySelectorAll("tr");

  rows.forEach(row => {
    const nombre = row.children[1]?.textContent.toLowerCase() || "";
    const marca = row.children[2]?.textContent.toLowerCase() || "";

    // columnas ocultas pero existentes
    const categoria = row.children[5]?.textContent.toLowerCase() || "";
    const subcategoria = row.children[6]?.textContent.toLowerCase() || "";

    const match =
      nombre.includes(query) ||
      marca.includes(query) ||
      categoria.includes(query) ||
      subcategoria.includes(query);

    row.style.display = match ? "" : "none";
  });
}

// 🔌 EVENTO DEL INPUT .search
const searchInput = document.querySelector(".search");

if (searchInput) {
  searchInput.addEventListener("input", e => {
    filtrarInventario(e.target.value);
  });
}

// ACTUALIZAR BOTÓN ELIMINAR SELECCIONADOS
function updateDeleteSelectedUI() {
  const checks = document.querySelectorAll(".row-check");
  const selected = Array.from(checks).filter(c => c.checked);

  const count = selected.length;

  btnDeleteSelected.textContent = `Eliminar seleccionados (${count})`;
  btnDeleteSelected.disabled = count === 0;
}



// ELIMINAR PRODUCTOS SELECCIONADOS
async function eliminarSeleccionadosInventario() {
  const rows = document.querySelectorAll("tbody tr");
  const ids = [];

  rows.forEach(row => {
    const check = row.querySelector(".row-check");
    if (check && check.checked) {
      ids.push(row.dataset.id);
    }
  });

  if (!ids.length) {
    await Swal.fire({
      icon: "info",
      title: "Sin selección",
      text: "No has seleccionado ningún producto",
      confirmButtonText: "Aceptar"
    });
    return;
  }

  const { isConfirmed } = await Swal.fire({
    title: "Eliminar productos",
    text: `¿Seguro que deseas eliminar ${ids.length} producto(s)? Esta acción no se puede deshacer.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar"
  });

  if (!isConfirmed) return;

  showLoader("Eliminando productos...");

  try {
    // Misma lógica que eliminarProducto(id)
    for (const id of ids) {
      await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "delete",
          id
        })
      });
    }

    showToast(`${ids.length} producto(s) eliminados correctamente`);
    cargarInventario();

  } catch (err) {
    console.error(err);
    showToast("Error eliminando productos");

  } finally {
    hideLoader();
  }
}







/* ======================
    ACTUALIZAR UI STOCK CON COLORES Y BLOQUEO DE BOTONES 
====================== */
function updateStockUI(id) {
  const stock = stockState[id];
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;

  const stockCell = document.getElementById(`stock-${id}`);
  const buttons = row.querySelectorAll('.qty button');

  if (stock <= 0) {
    // texto
    if (stockCell) {
      stockCell.innerHTML = `<span class="stock-out">Agotado</span>`;
    }

    // bloquear botones
    buttons.forEach(b => b.disabled = true);

    // reset qty por seguridad
    qtyState[id] = 0;
    const span = document.getElementById(`qty-${id}`);
    if (span) span.textContent = "0";

  } else {
    // texto normal
    if (stockCell) {
      stockCell.textContent = stock;
    }

    // desbloquear botones
    buttons.forEach(b => b.disabled = false);
  }
}



/* ======================
    CARGAR VENTAS
====================== */
//parsea la fecha y hora en formato español a timestamp para que cargarventas ordene bien
// ==============================
// PARSE FECHA + HORA ESPAÑOL
// ==============================
function parseFechaHoraES(fecha, hora) {
  if (!fecha || !hora) return 0;

  const meses = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
  };

  // "Lunes 5 enero 2025"
  const f = fecha.split(" ");
  const day = Number(f[1]);
  const month = meses[f[2]];
  const year = Number(f[3]);

  // "3:45 PM"
  let [time, ampm] = hora.split(" ");
  let [h, m] = time.split(":").map(Number);

  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;

  return new Date(year, month, day, h, m, 0, 0).getTime();
}

// ==============================
// CARGAR VENTAS
// ==============================
const salesTbody = document.getElementById("salesTbody");

// Selects
const filterFecha = document.getElementById("filterFecha");
const filterProducto = document.getElementById("filterProducto");
const filterMarca = document.getElementById("filterMarca");
const filterMetodo1 = document.getElementById("filterMetodo1");
const filterMetodo2 = document.getElementById("filterMetodo2");

let salesData = []; // datos originales

async function cargarVentas() {
  try {
    showLoader("Cargando ventas...");

    const res = await fetch(`${API_URL}?action=sales`);
    let data = await res.json();

    // Orden cronológico real
    data = data
      .map((v, i) => ({ ...v, __idx: i }))
      .sort((a, b) => {
        const ta = parseFechaHoraES(a.fecha, a.hora);
        const tb = parseFechaHoraES(b.fecha, b.hora);
        if (tb !== ta) return tb - ta;
        return b.__idx - a.__idx;
      })
      .map(v => { delete v.__idx; return v; });

    salesData = data;

    // Llenar selects con opciones únicas
    populateFilters(data);

    renderVentas(salesData);

  } catch (e) {
    console.error(e);
    showToast("Error cargando ventas");
  } finally {
    hideLoader();
  }
}

/* =========================
   RENDER DE LA TABLA
   ========================= */
function renderVentas(data) {
  salesTbody.innerHTML = data.map(v => {
    const metodo1 = v.metodo1
      ? `<div><strong>${v.metodo1}</strong><div class="payment-amount">$ ${Number(v.monto1 || 0).toLocaleString("es-CO")}</div></div>`
      : "N/A";

    const metodo2 = v.metodo2
      ? `<div><strong>${v.metodo2}</strong><div class="payment-amount">$ ${Number(v.monto2 || 0).toLocaleString("es-CO")}</div></div>`
      : "N/A";

    const descuento = Number(v.descuento || 0);

    return `
  <tr>
    <td>${v.producto}</td>
    <td>${v.marca}</td>
    <td>${v.cantidad}</td>
    <td>$ ${Number(v.total).toLocaleString("es-CO")}</td>
    <td class="discount">${descuento > 0 ? `- $ ${descuento.toLocaleString("es-CO")}` : "N/A"}</td>
    <td>${metodo1}</td>
    <td>${metodo2}</td>
    <td>${v.fecha}</td>
    <td>${v.hora}</td>
    <td>
      <button class="btn-delete-sale"
        onclick="eliminarVenta('${v.id}')">
        Eliminar
      </button>
    </td>
  </tr>
`;
  }).join("");
}

/* =========================
   POBLAR FILTROS
   ========================= */
/* =========================
   MÉTODOS DE PAGO FIJOS
   ========================= */
const METODOS_PAGO = [
  "Efectivo",
  "Transferencia",
  "Datafono",
  "Sistecredito",
  "Addi"
];

/* =========================
   POBLAR FILTROS
   ========================= */
function populateFilters(data) {
  const unique = (key) => [...new Set(data.map(d => d[key]).filter(Boolean))];

  fillSelect(filterProducto, unique('producto'), "Todos los productos");
  fillSelect(filterMarca, unique('marca'), "Todas las marcas");

  // 👇 métodos fijos
  fillSelect(filterMetodo1, METODOS_PAGO, "Todos los métodos de pago");
  fillSelect(filterMetodo2, METODOS_PAGO, "Todos los métodos de pago");
}

function fillSelect(select, items, placeholder) {
  select.innerHTML =
    `<option value="">${placeholder}</option>` +
    items.map(i => `<option value="${i}">${i}</option>`).join('');
}




/* =========================
   FILTRADO DINÁMICO
   ========================= */
function filtrarVentas() {
  const filtered = salesData.filter(v => {
    const fechaVenta = new Date(v.fecha.split("/").reverse().join("-")); // yyyy-mm-dd

    const now = new Date();
    let fechaMatch = true;

    switch(filterFecha.value) {
      case 'hoy':
        fechaMatch = fechaVenta.toDateString() === now.toDateString();
        break;
      case 'ayer':
        const ayer = new Date(now);
        ayer.setDate(now.getDate() - 1);
        fechaMatch = fechaVenta.toDateString() === ayer.toDateString();
        break;
      case 'ultimos7':
        const semana = new Date(now);
        semana.setDate(now.getDate() - 7);
        fechaMatch = fechaVenta >= semana && fechaVenta <= now;
        break;
      case 'ultimos30':
        const mes = new Date(now);
        mes.setDate(now.getDate() - 30);
        fechaMatch = fechaVenta >= mes && fechaVenta <= now;
        break;
      default:
        fechaMatch = true;
    }

    return (
      fechaMatch &&
      (!filterProducto.value || v.producto === filterProducto.value) &&
      (!filterMarca.value || v.marca === filterMarca.value) &&
      (!filterMetodo1.value || v.metodo1 === filterMetodo1.value) &&
      (!filterMetodo2.value || v.metodo2 === filterMetodo2.value)
    );
  });

  renderVentas(filtered);
}

// Eventos de select
[filterFecha, filterProducto, filterMarca, filterMetodo1, filterMetodo2].forEach(sel => {
  sel.addEventListener('change', filtrarVentas);
});

// Inicia carga 
cargarVentas();



// ==============================
//  ACTUALIZAR KPIS VENTAS DEL DÍA
// ==============================
const ventasKPIContainer = document.getElementById("ventasKPI");

let lastKPIsUpdate = 0; // timestamp para no recalcular mucho

async function actualizarKPIVentas() {
  return new Promise(resolve => {

    const now = new Date();

    // Hora Bogotá
    const bogotaOffset = -5 * 60;
    const diff = bogotaOffset + now.getTimezoneOffset();
    const bogotaTime = new Date(now.getTime() + diff * 60000);

    const hoy = new Date(bogotaTime);
    hoy.setHours(0, 0, 0, 0);

    // ⏱️ protección anti-recarga excesiva (NO rompe el toggle)
    if (Date.now() - lastKPIsUpdate < 500 && !ventasKPIContainer.dataset.force) {
      requestAnimationFrame(resolve);
      return;
    }
    lastKPIsUpdate = Date.now();
    delete ventasKPIContainer.dataset.force;

    const rows = Array.from(salesTbody.querySelectorAll("tr"));

    const kpis = {};
    let totalDia = 0;
    let totalDescuentos = 0;

    rows.forEach(row => {
      const fechaText = row.children[7].textContent.trim();
      const horaText = row.children[8].textContent.trim();
      const ts = parseFechaHoraES(fechaText, horaText);

      if (ts < hoy.getTime()) return;

      // 💸 DESCUENTOS
      const descuentoText = row.children[4].textContent.replace(/[^\d]/g, "");
      const descuento = Number(descuentoText) || 0;
      totalDescuentos += descuento;

      // 💳 MÉTODOS
      [5, 6].forEach(i => {
        const metodo = row.children[i].querySelector("strong");
        const monto = row.children[i].querySelector(".payment-amount");

        if (metodo && monto) {
          const m = metodo.textContent.trim();
          const v = Number(monto.textContent.replace(/[^\d]/g, "")) || 0;
          kpis[m] = (kpis[m] || 0) + v;
          totalDia += v;
        }
      });
    });

    const orden = ["Efectivo","Transferencia","Datafono","Sistecredito","Addi"];

    const kpiPrincipal =
      kpiModo === "ventas"
        ? `
          <div class="kpi-label">Total Ventas del Día</div>
          <div class="kpi-value">$ ${totalDia.toLocaleString("es-CO")}</div>
        `
        : `
          <div class="kpi-label">Total Descuentos</div>
          <div class="kpi-value">$ ${totalDescuentos.toLocaleString("es-CO")}</div>
        `;

    ventasKPIContainer.innerHTML = `
      <div class="kpi-card kpi-main kpi-fade-in"
           style="flex:1 1 100%;
           background:${kpiModo === "ventas"
             ? "linear-gradient(135deg,#0a0a0a,#00aaff)"
             : "linear-gradient(135deg,#1a0a0a,#ff3366)"}">

        ${kpiPrincipal}

        <button class="kpi-toggle" onclick="toggleKPI()">
          ${kpiModo === "ventas" ? "Ver descuentos" : "Ver ventas"}
        </button>
      </div>

      ${orden.map(m => `
        <div class="kpi-card" style="background:${colorMetodoPago(m)}">
          <div class="kpi-label">${m}</div>
          <div class="kpi-value">$ ${(kpis[m] || 0).toLocaleString("es-CO")}</div>
        </div>
      `).join("")}
    `;

    // ✅ DOM ya pintó
    requestAnimationFrame(resolve);
  });
}


//   TOGGLE ENTRE VENTAS Y DESCUENTOS
async function toggleKPI() {

  const card = document.querySelector(".kpi-main");
  if (!card || card.dataset.loading === "1") return;
  card.dataset.loading = "1";

  // 🔹 crear overlay GLOBAL (no se destruye)
  let overlay = ventasKPIContainer.querySelector(".kpi-loader-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "kpi-loader-overlay";
    overlay.innerHTML = `<div class="kpi-loader"></div>`;
    ventasKPIContainer.style.position = "relative";
    ventasKPIContainer.appendChild(overlay);
  }

  // blur visual
  card.classList.add("kpi-loading");

  // forzar render aunque exista protección
  ventasKPIContainer.dataset.force = "1";

  // 🔁 cambiar modo
  kpiModo = kpiModo === "ventas" ? "descuentos" : "ventas";

  // ⏳ esperar a que llegue el nuevo KPI
  await actualizarKPIVentas();

  // 🔍 nuevo card (el anterior fue reemplazado)
  const newCard = document.querySelector(".kpi-main");

  // ✅ ahora sí quitar loader
  overlay.remove();
  newCard?.classList.remove("kpi-loading");
  delete newCard?.dataset.loading;
}




// Color alusivo para cada método
function colorMetodoPago(m) {
  switch(m) {
    case "Efectivo": return "linear-gradient(135deg,#1b1b1b,#00ff99)";       // verde neón sobre fondo oscuro
    case "Transferencia": return "linear-gradient(135deg,#121212,#3399ff)"; // azul neón oscuro
    case "Datafono": return "linear-gradient(135deg,#1a1a1a,#ff9933)";      // naranja neón oscuro
    case "Sistecredito": return "linear-gradient(135deg,#1c1c1c,#ff3366)";  // rojo neón oscuro
    case "Addi": return "linear-gradient(135deg,#111111,#cc33ff)";          // morado neón oscuro
    default: return "linear-gradient(135deg,#0a0a0a,#00aaff)";              // azul neón neutro
  }
}



// Actualiza cada 5 segundos
setInterval(actualizarKPIVentas, 5000);








/* ======================
   GUARDAR y EDITAR PRODUCTO
====================== */
form.onsubmit = async e => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(form));

  // 🔒 normalización
  data.costo = Number(data.costo) || 0;
  data.margen = Number(data.margen) || 0;
  data.cantidad = Number(data.cantidad) || 0;

  // 🔥 precio SIEMPRE desde costo
  data.precio = Math.round(
    data.costo * (1 + data.margen / 100)
  );

  if (!data.precio || data.precio <= 0) {
    showToast("❌ El precio no puede ser 0", "error");
    return;
  }

  if (editState.mode === "edit") {
    data.action = "update";
    data.id = editState.id;
  } else {
    data.action = "create";
  }

  showLoader(
    data.action === "update"
      ? "Actualizando producto..."
      : "Creando producto..."
  );

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(data)
  });

  hideLoader();

  form.reset();
  modal.classList.add("hidden");

  // reset estado
  editState = {
    mode: "create",
    id: null
  };

  await cargarInventario();

  showToast(
    data.action === "update"
      ? "Producto actualizado correctamente"
      : "Producto creado correctamente"
  );
};







/* ======================
    ACTUALIZAR EL SPAN TOTAL A PAGAR 
====================== */
function actualizarTotalGlobalVenta() {
  let total = 0;
  let haySeleccion = false;

  Object.keys(qtyState).forEach(id => {
    const qty = qtyState[id];
    if (!qty || qty <= 0) return;

    haySeleccion = true;

    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    const precio = Number(
      row.children[3].textContent.replace(/[^\d]/g, "")
    );

    total += precio * qty;
  });

  const span = document.getElementById("sellTotal");
  if (!span) return;

  span.textContent = haySeleccion
    ? total.toLocaleString("es-CO")
    : "0";
}



/* ======================
   CAMBIAR CANTIDAD (+ / -)
====================== */
window.cambiarQty = function (id, delta) {

  const stock = stockState[id] || 0;

  if (delta > 0 && qtyState[id] >= stock) return;

  qtyState[id] += delta;

  if (qtyState[id] < 0) qtyState[id] = 0;
  if (qtyState[id] > stock) qtyState[id] = stock;

  const span = document.getElementById(`qty-${id}`);
  if (span) {
    span.textContent = qtyState[id];

    // 🔥 EFECTO VISUAL
    if (qtyState[id] > 0) {
      span.classList.add("qty-active");
    } else {
      span.classList.remove("qty-active");
    }
  }

  actualizarTotalGlobalVenta();
  updateSellCartBadge();
};


/* ======================
   VENDER (CON VALIDACIÓN)
====================== */
let sellState = {
  id: null,
  nombre: "",
  precio: 0,
  qty: 0,
  pending: false
};


window.venderDesdeFila = function (id) {
  const qty = qtyState[id];
  const stock = stockState[id];

  if (qty <= 0) {
    showToast("Selecciona una cantidad mayor a 0");
    return;
  }

  if (qty > stock) {
    showToast(`No es posible vender ${qty}. En stock solo hay ${stock}.`);
    return;
  }

  const row = document.querySelector(`tr[data-id="${id}"]`);
  const nombre = getNombreProductoFromRow(row);
  const precio = Number(row.children[3].textContent.replace(/[^\d]/g, ""));

  sellState = {
    id,
    nombre,
    precio,
    qty,
    pending: true
  };

  openSellModal();
};

/* ======================
    VENDER SELECCIONADOS
====================== */

window.venderSeleccionados = function () {
  const rows = document.querySelectorAll("tbody tr");
  const items = [];

  rows.forEach(row => {
    const id = row.dataset.id;
    const qty = qtyState[id];
    const stock = stockState[id];

    // 🔑 ÚNICA CONDICIÓN: cantidad > 0
    if (qty > 0) {
      if (qty > stock) {
        showToast(`Stock insuficiente para ${row.children[1].textContent}`);
        return;
      }

      items.push({
  id,
  nombre: getNombreProductoFromRow(row),
  marca: row.children[2].textContent.trim(),
  precio: Number(row.children[3].textContent.replace(/[^\d]/g, "")),
  qty
});

    }
  });

  if (!items.length) {
    return showToast("No hay productos con cantidad seleccionada");
  }

  // ✅ MISMO OBJETO, SOLO SE AGREGA CONTEXTO
  sellCartState = {
    items,
    pending: true,
    __from: "btnSellCart" // 👈 identifica venta múltiple
  };

  openSellCartModal();
};

/* ======================
    CALCULAR TOTAL VENTA MULTIPLE
====================== */
function calcularTotalVentaMultiple() {
  return sellCartState.items.reduce(
    (sum, i) => sum + i.precio * i.qty,
    0
  );
}


/* ======================
    MODAL VENDER SELECCIONADOS
====================== */
function openSellCartModal() {
  const old = document.getElementById("sellCartModal");
  if (old) old.remove();

  // 🎨 ESTILOS SOLO SI VIENE DE "VENDER SELECCIONADOS"
  if (sellCartState.__from === "btnSellCart") {
    if (!document.getElementById("sellModalStyles")) {
      const style = document.createElement("style");
      style.id = "sellModalStyles";
      style.innerHTML = `
        .sell-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.45);
          display: grid;
          place-items: center;
          z-index: 2000;
        }

        .sell-card {
          width: 520px;
          max-width: 94vw;
          background: rgba(20,20,30,.95);
          backdrop-filter: blur(30px);
          border-radius: 28px;
          padding: 28px;
          color: white;
          box-shadow: 0 30px 80px rgba(0,0,0,.6);
        }

        .sell-sub {
          font-size: 13px;
          opacity: .7;
          margin-bottom: 18px;
        }

        .sell-section {
          margin-bottom: 18px;
        }

        .sell-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .sell-field label {
          font-size: 12px;
          opacity: .7;
          margin-bottom: 6px;
          display: block;
        }

        .sell-field input,
        .sell-field select {
          width: 100%;
          padding: 13px 14px;
          border-radius: 14px;
          border: none;
          outline: none;
          background: rgba(15,20,35,.95);
          color: white;
        }

        .sell-total {
          background: linear-gradient(135deg,#0a84ff,#0066ff);
          padding: 14px;
          border-radius: 16px;
          text-align: center;
          font-weight: 700;
          margin-top: 14px;
        }

        .sell-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 22px;
        }

        .sell-actions .ghost {
          background: transparent;
          color: white;
          border: 1px solid rgba(255,255,255,.25);
        }

        .sell-actions .primary {
          background: linear-gradient(135deg,#0a84ff,#0066ff);
          color: white;
        }

        .sell-actions button {
        padding: 12px 18px;
        border-radius: 14px;
        border: none;
        cursor: pointer;
        font-weight: 600;
        transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
      }

       .sell-actions button:hover {
       transform: translateY(-1px);
       box-shadow: 0 8px 20px rgba(0,0,0,.35);
       }

      .sell-actions .ghost:hover {
      background: rgba(255,255,255,.08);
      }

      .sell-actions .primary:hover {
      opacity: .95;
     }

      `;
      document.head.appendChild(style);
    }
  }

  const total = calcularTotalVentaMultiple();


  const modal = document.createElement("div");
  modal.id = "sellCartModal";
  modal.className = "sell-overlay";

  // 🔒 HTML EXACTO COMO LO TENÍAS
  modal.innerHTML = `
    <div class="sell-card" style="width:520px">
      <h2>Venta múltiple</h2>
      <div class="sell-sub">Resumen de prendas seleccionadas</div>

      <div class="sell-section">
        ${sellCartState.items.map(i => `
          <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px">
            <span>${i.nombre} × ${i.qty}</span>
            <b>$ ${(i.precio * i.qty).toLocaleString("es-CO")}</b>
          </div>
        `).join("")}
      </div>

        <div class="sell-field">
          <label>Descuento</label>
          <input type="number" id="cartDiscount" value="0" min="0">
        </div>

      <div class="sell-section">
        <div class="sell-grid">
        
          <div class="sell-field">
            <label>Método de pago 1</label>
            <select id="cartPayMethod1">
               <option>Efectivo</option>
               <option>Transferencia</option>
               <option>Datafono</option>
               <option>Sistecredito</option>
               <option>Addi</option>
            </select>
          </div>

          <div class="sell-field">
            <label>Monto</label>
            <input type="number" id="cartPayAmount1" value="${total}">
          </div>

          <div class="sell-field">
            <label>Método de pago 2</label>
            <select id="cartPayMethod2">
               <option>Ninguno</option>
               <option>Efectivo</option>
               <option>Transferencia</option>
               <option>Datafono</option>
               <option>Sistecredito</option>
               <option>Addi</option>
            </select>
          </div>

          <div class="sell-field">
            <label>Monto</label>
            <input type="number" id="cartPayAmount2" value="0" readonly>
          </div>
        </div>
      </div>

      <div class="sell-total">
        Total Venta: $ <span id="cartTotal">${total.toLocaleString("es-CO")}</span>
      </div>

      <div class="sell-actions">
        <button class="ghost" onclick="closeSellCartModal()">Cancelar</button>
        <button class="primary" onclick="confirmarVentaMultiple()">Confirmar venta</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // ======================
// 🔗 REFERENCIAS DOM (MODAL)
// ======================
const cartDiscount = document.getElementById("cartDiscount");
const cartPayAmount1 = document.getElementById("cartPayAmount1");
const cartPayAmount2 = document.getElementById("cartPayAmount2");
const cartPayMethod2 = document.getElementById("cartPayMethod2");
const cartTotal = document.getElementById("cartTotal");

// ======================
// 🧠 LISTENERS INTELIGENTES
// ======================
cartDiscount.addEventListener("input", () => updateCartTotals("discount"));
cartPayAmount1.addEventListener("input", () => updateCartTotals("monto1"));
cartPayAmount2.addEventListener("input", () => updateCartTotals("monto2"));
cartPayMethod2.addEventListener("change", () => updateCartTotals("method"));

// estado inicial
updateCartTotals("init");

}





/* ======================
    CALCULAR TOTAL CON DESCUENTO
====================== */
function calcularTotalConDescuento() {
  const subtotal = calcularTotalVentaMultiple();
  const descuento = Number(document.getElementById("cartDiscount")?.value || 0);
  return Math.max(subtotal - descuento, 0);
}


/* ======================
    ACTUALIZAR TOTALES VENTA MULTIPLE
====================== */
function updateCartTotals(source = "init") {
  const subtotal = calcularTotalVentaMultiple();
  const descuento = Number(cartDiscount.value || 0);
  const totalFinal = Math.max(subtotal - descuento, 0);

  const metodo2 = cartPayMethod2.value;

  let monto1 = Number(cartPayAmount1.value || 0);
  let monto2 = Number(cartPayAmount2.value || 0);

  if (metodo2 === "Ninguno") {
    monto1 = totalFinal;
    monto2 = 0;
  } else {
    if (source === "discount" || source === "method" || source === "init") {
      monto1 = Math.floor(totalFinal / 2);
      monto2 = totalFinal - monto1;
    } else if (source === "monto1") {
      monto1 = Math.min(monto1, totalFinal);
      monto2 = totalFinal - monto1;
    } else if (source === "monto2") {
      monto2 = Math.min(monto2, totalFinal);
      monto1 = totalFinal - monto2;
    }
  }

  cartPayAmount1.value = Math.max(monto1, 0);
  cartPayAmount2.value = Math.max(monto2, 0);
  cartTotal.textContent = totalFinal.toLocaleString("es-CO");
}






/* ======================
    NORMALIZAR PAGOS VENTA MULTIPLE
====================== */
function normalizarPagos(metodo1, monto1, metodo2, monto2, total) {
  let m1 = metodo1;
  let v1 = Number(monto1) || 0;

  let m2 = metodo2;
  let v2 = Number(monto2) || 0;

  // 🔒 Si método 2 es "Ninguno", fuerza monto 2 = 0
  if (m2 === "Ninguno") {
    m2 = "";
    v2 = 0;
  }

  // 🔒 Si solo hay un método, absorbe todo
  if (!m2) {
    v1 = total;
    v2 = 0;
  }

  // 🔒 Ajuste final por seguridad
  if (v1 + v2 !== total) {
    v1 = total;
    v2 = 0;
    m2 = "";
  }

  return {
    metodo1: m1,
    monto1: v1,
    metodo2: m2,
    monto2: v2
  };
}

 
/* ======================
    CONFIRMAR VENTA MULTIPLE (PROPORCIONAL REAL)
====================== */
async function confirmarVentaMultiple() {
  try {
    showLoader("Procesando venta...");

    const metodo1 = document.getElementById("cartPayMethod1").value;
    const metodo2 = document.getElementById("cartPayMethod2").value;

    let monto1 = Number(document.getElementById("cartPayAmount1").value || 0);
    let monto2 = Number(document.getElementById("cartPayAmount2").value || 0);

    const descuento = Number(document.getElementById("cartDiscount").value || 0);

    const items = sellCartState.items;

    const totalVenta = items.reduce(
      (s, i) => s + i.precio * i.qty,
      0
    );

    const totalConDescuento = totalVenta - descuento;

    // 🛑 VALIDACIÓN CORRECTA (YA CON DESCUENTO)
    if (monto1 + monto2 !== totalConDescuento) {
      hideLoader();
      return showToast(
        "La suma de pagos no coincide con el total con descuento",
        "error"
      );
    }

    // 🔐 Normalizar métodos
    const pagos = normalizarPagos(
      metodo1,
      monto1,
      metodo2,
      monto2,
      totalConDescuento
    );

    // 📊 Porcentajes reales (SOBRE TOTAL CON DESCUENTO)
    const pct1 = pagos.monto1 / totalConDescuento;
    const pct2 = pagos.monto2 / totalConDescuento;

    let acumulado1 = 0;
    let acumulado2 = 0;

    let index = 1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      showLoader(`Procesando venta ${index}/${items.length}...`);

      const subtotalItem = item.precio * item.qty;

      // 🔻 Descuento proporcional por producto
      const descuentoItem = Math.round(subtotalItem * (descuento / totalVenta));

      const totalItem = subtotalItem - descuentoItem;

      // 💰 Montos proporcionales por producto
      let itemMonto1 = Math.round(totalItem * pct1);
      let itemMonto2 = Math.round(totalItem * pct2);

      acumulado1 += itemMonto1;
      acumulado2 += itemMonto2;

      // 🧮 Ajuste final por redondeo
      if (i === items.length - 1) {
        itemMonto1 += pagos.monto1 - acumulado1;
        itemMonto2 += pagos.monto2 - acumulado2;
      }

      await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "sell_full",

          id: item.id,
          producto: item.nombre,
          marca: item.marca,

          cantidad: item.qty,
          precioUnitario: item.precio,
          subtotal: subtotalItem,
          descuento: descuentoItem,
          total: totalItem,

          // ✅ PAGOS REALES POR PRODUCTO
          metodo1: pagos.metodo1,
          monto1: itemMonto1,
          metodo2: pagos.metodo2,
          monto2: itemMonto2
        })
      });

      index++;
    }

    closeSellCartModal();
    await cargarInventario();
    showToast("Venta múltiple registrada correctamente", "success");

  } catch (e) {
    console.error(e);
    showToast("Error en venta múltiple", "error");

  } finally {
    hideLoader();
  }

  updateSellCartBadge(); // 🔥 actualizamos badge del carrito
}





/* ======================
    CERRAR MODAL VENDER SELECCIONADOS
====================== */

function closeSellCartModal() {
  const modal = document.getElementById("sellCartModal");
  if (modal) modal.remove();
}



/* ======================
    MODAL VENDER INDIVIDUAL
====================== */

const sellModal = document.getElementById("sellModal");
const sellTitle = document.getElementById("sellTitle");
const sellInfo = document.getElementById("sellInfo");

function openSellModal() {
  const { nombre, precio, qty } = sellState;
  const totalInicial = precio * qty;

  // 🧹 eliminar modal previo
  const old = document.getElementById("sellModalDynamic");
  if (old) old.remove();

  // 🎨 estilos (una sola vez)
  if (!document.getElementById("sellModalStyles")) {
    const style = document.createElement("style");
    style.id = "sellModalStyles";
    style.innerHTML = `
      .sell-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.45);
        display: grid;
        place-items: center;
        z-index: 2000;
      }

      .sell-card {
        width: 420px;
        max-width: 94vw;
        background: rgba(20,20,30,.95);
        backdrop-filter: blur(30px);
        border-radius: 28px;
        padding: 28px;
        color: white;
        box-shadow: 0 30px 80px rgba(0,0,0,.6);
      }

      .sell-card h2 {
        margin-bottom: 4px;
      }

      .sell-sub {
        font-size: 13px;
        opacity: .7;
        margin-bottom: 18px;
      }

      .sell-section {
        margin-bottom: 18px;
      }

      .sell-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .sell-field label {
        font-size: 12px;
        opacity: .7;
        margin-bottom: 6px;
        display: block;
      }

      .sell-field input,
      .sell-field select {
        width: 100%;
        padding: 13px 14px;
        border-radius: 14px;
        border: none;
        outline: none;
        background: rgba(15,20,35,.95);
        color: white;
        appearance: none;
      }

      .sell-field select {
        cursor: pointer;
        background-image:
          linear-gradient(45deg, transparent 50%, #0a84ff 50%),
          linear-gradient(135deg, #0a84ff 50%, transparent 50%);
        background-position:
          calc(100% - 20px) 55%,
          calc(100% - 14px) 55%;
        background-size: 6px 6px;
        background-repeat: no-repeat;
      }

      .sell-total {
        background: linear-gradient(135deg,#0a84ff,#0066ff);
        padding: 14px;
        border-radius: 16px;
        text-align: center;
        font-weight: 700;
        margin-top: 14px;
      }

      .sell-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 22px;
      }

      .sell-actions button {
        padding: 12px 18px;
        border-radius: 14px;
        border: none;
        cursor: pointer;
        font-weight: 600;
      }

      .sell-actions .ghost {
        background: transparent;
        color: white;
        border: 1px solid rgba(255,255,255,.25);
      }

      .sell-actions .primary {
        background: linear-gradient(135deg,#0a84ff,#0066ff);
        color: white;
      }
    `;
    document.head.appendChild(style);
  }

  // 🧩 modal
  const modal = document.createElement("div");
  modal.id = "sellModalDynamic";
  modal.className = "sell-overlay";

  modal.innerHTML = `
    <div class="sell-card">
      <h2>${nombre}</h2>
      <div class="sell-sub">Confirma los detalles de la venta</div>

      <div class="sell-section">
        <div class="sell-grid">
          <div class="sell-field">
            <label>Cantidad *</label>
            <input type="number" id="sellQty" min="1" value="${qty}">
          </div>

          <div class="sell-field">
            <label>Descuento</label>
            <input type="number" id="sellDiscount" value="0">
          </div>
        </div>
      </div>

      <div class="sell-section">
        <div class="sell-grid">
          <div class="sell-field">
            <label>Método de pago 1</label>
            <select id="payMethod1">
               <option>Efectivo</option>
               <option>Transferencia</option>
               <option>Datafono</option>
               <option>Sistecredito</option>
               <option>Addi</option>
            </select>
          </div>

          <div class="sell-field">
            <label>Monto</label>
            <input type="number" id="payAmount1" value="${totalInicial}">
          </div>

          <div class="sell-field">
            <label>Método de pago 2</label>
            <select id="payMethod2">
              <option>Ninguno</option>
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Datafono</option>
              <option>Sistecredito</option>
              <option>Addi</option>
            </select>
          </div>

          <div class="sell-field">
            <label>Monto</label>
            <input type="number" id="payAmount2" value="0" readonly>
          </div>
        </div>
      </div>

      <div class="sell-total">
        Total Venta: $ <span id="sellTotal">${totalInicial.toLocaleString("es-CO")}</span>
      </div>

      <div class="sell-actions">
        <button class="ghost" onclick="closeSellModal()">Cancelar</button>
        <button class="primary" onclick="confirmarVenta()">Confirmar venta</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 🧠 listeners de lógica
  ["sellQty", "sellDiscount", "payAmount1"].forEach(id => {
    document.getElementById(id).addEventListener("input", updateSellTotals);
  });

  // estado inicial correcto
  updateSellTotals();
}




/* ======================
    ACTUALIZAR TOTALES VENTA
====================== */
function updateSellTotals() {
  const qty = Number(document.getElementById("sellQty").value) || 0;
  const discount = Number(document.getElementById("sellDiscount").value) || 0;

  const total = Math.max(
    sellState.precio * qty - discount,
    0
  );

  const amount1 = Number(document.getElementById("payAmount1").value) || 0;
  const amount2 = total - amount1;

  document.getElementById("payAmount2").value = amount2 >= 0 ? amount2 : 0;

  document.getElementById("sellTotal").textContent =
    total.toLocaleString("es-CO");
}

["sellQty", "sellDiscount", "payAmount1"].forEach(id => {
  document.getElementById(id).addEventListener("input", updateSellTotals);
});


/* ======================
    ACTUALIZAR BADGE CARRITO
====================== */
function updateSellCartBadge() {
  const badge = document.getElementById("sellCartBadge");
  if (!badge) return;

  let totalItems = 0;

  Object.values(qtyState).forEach(qty => {
    if (qty > 0) totalItems += qty;
  });

  if (totalItems <= 0) {
    badge.classList.add("hidden");
    badge.textContent = "0";
    return;
  }

  badge.textContent = totalItems;
  badge.classList.remove("hidden");

  // ✨ animación premium
  badge.classList.remove("bump");
  void badge.offsetWidth; // force reflow
  badge.classList.add("bump");

   //  Llamando a la funcion que replica todo igual en el carrito flotante
 if (window.syncSellBadge) {
  syncSellBadge();
}

}


 


/* ======================
    CONFIRMAR VENTA SIMPLE
====================== */
async function confirmarVenta() {
  if (!sellState) return;

  try {
    showLoader("Confirmando venta...");

    const qty = Number(document.getElementById("sellQty").value);
    const descuento = Number(document.getElementById("sellDiscount").value || 0);

    const metodo1 = document.getElementById("payMethod1").value;
    const metodo2 = document.getElementById("payMethod2").value;

    const monto1 = Number(document.getElementById("payAmount1").value || 0);
    const monto2 = Number(document.getElementById("payAmount2").value || 0);

    const { id, nombre, marca, precio } = sellState;

    const subtotal = precio * qty;
    const total = subtotal - descuento;

    // 🛑 validaciones duras
    if (qty <= 0) {
      hideLoader();
      return showToast("Cantidad inválida", "error");
    }

    if (monto1 + monto2 !== total) {
      hideLoader();
      return showToast(
        "La suma de los pagos no coincide con el total",
        "error"
      );
    }

    // ✅ normalizar pagos
    const pagos = normalizarPagos(
      metodo1,
      monto1,
      metodo2,
      monto2,
      total
    );

    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "sell_full",

        id,
        producto: nombre,
        marca,

        cantidad: qty,
        precioUnitario: precio,
        subtotal,
        descuento,
        total,

        metodo1: pagos.metodo1,
        monto1: pagos.monto1,
        metodo2: pagos.metodo2,
        monto2: pagos.monto2
      })
    });

    qtyState[id] = 0;
    sellState.pending = false;

    closeSellModal();
    await cargarInventario();

    showToast("Venta registrada correctamente", "success");

  } catch (err) {
    console.error(err);
    showToast("Error al registrar la venta", "error");

  } finally {
    hideLoader();
  }
}






/* ======================
    CERRAR MODAL VENDER
====================== */

function closeSellModal() {
  const modal = document.getElementById("sellModalDynamic");
  if (modal) modal.remove();
}



/* ====================== 
    EDITAR PRODUCTO
====================== */

function editarProducto(id) {
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (!row) return;

  const modal = document.getElementById("modal");
  const form = document.getElementById("form");

  const nombre = row.children[1].querySelector(".product-name").childNodes[0].textContent.trim();
  const marca = row.children[2].textContent.trim();

  const costo = Number(
    row.children[4].textContent.replace(/[^\d]/g, "")
  );

  const categoria = row.children[5].textContent.trim();
  const subcategoria = row.children[6].textContent.trim();
  const cantidad = Number(row.children[7].textContent) || 0;

  // 🔹 llenar solo campos editables
  form.nombre.value = nombre;
  form.marca.value = marca;
  form.categoria.value = categoria;
  form.subcategoria.value = subcategoria;
  form.cantidad.value = cantidad;

  // 🔹 costo real (base del cálculo)
  form.costo.value = costo;

  // margen solo como input de cálculo
  form.margen.value = 100;

  // 🔐 estado de edición (mínimo necesario)
  editState = {
    mode: "edit",
    id
  };

  modal.classList.remove("hidden");
}


/* ======================
   ELIMINAR PRODUCTO (CON VALIDACIÓN)
====================== */

async function eliminarProducto(id) {
  const confirmacion = confirm(
    "¿Seguro que deseas eliminar este producto?\nEsta acción no se puede deshacer."
  );

  if (!confirmacion) return;

  showLoader("Eliminando producto...");

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "delete",
      id
    })
  });

  hideLoader();
  showToast("Producto eliminado correctamente");
  cargarInventario();
};

/* ======================
   ELIMINAR VENTA (CON VALIDACIÓN)
====================== */
async function eliminarVenta(idVenta) {
  const ok = confirm(
    "¿Seguro que deseas eliminar esta venta?\n" +
    "El stock será restaurado y los KPIs se recalcularán."
  );

  if (!ok) return;

  try {
    showLoader("Eliminando venta...");

    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "delete_sale",
        id: idVenta
      })
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || "No se pudo eliminar la venta");
    }

    showToast("Venta eliminada correctamente");

    // 🔄 refrescos necesarios
    await cargarVentas();       // quita la fila
    await cargarInventario();   // devuelve stock
    ventasKPIContainer.dataset.force = "1";
    await actualizarKPIVentas();

  } catch (err) {
    console.error(err);
    showToast("Error al eliminar la venta");
  } finally {
    hideLoader();
  }
}

/* ==================================================
   👀 OBSERVADOR: BOTÓN VENDER SELECCIONADOS (FLOAT)
================================================== */
document.addEventListener("DOMContentLoaded", () => {

  const btnNormal = document.getElementById("btnSellCart");
  const btnFloating = document.getElementById("btnSellFloating");

  const badgeNormal = document.getElementById("sellCartBadge");
  const badgeFloating = document.getElementById("sellFloatingBadge");

  const headerActions = document.querySelector(".page-actions");

  if (!btnNormal || !btnFloating || !badgeNormal || !badgeFloating || !headerActions) {
    console.warn("Botón vender / badges no encontrados");
    return;
  }

  /* =========================
     🔁 SINCRONIZAR BADGE FLOAT
  ========================= */
  window.syncSellBadge = function () {
    const value = parseInt(badgeNormal.textContent, 10) || 0;

    badgeFloating.textContent = value;

    if (value <= 0) {
      badgeFloating.classList.add("hidden");
      btnFloating.classList.remove(
        "has-items",
        "glow",
        "nebula"
      );
      return;
    }

    // mostrar badge
    badgeFloating.classList.remove("hidden");

    // 🔮 activar modo místico
    btnFloating.classList.add("has-items", "glow", "nebula");

    // ✨ bump animado
    badgeFloating.classList.remove("bump");
    void badgeFloating.offsetWidth;
    badgeFloating.classList.add("bump");
  };

  /* =========================
     👁️ OBSERVER VISIBILIDAD
  ========================= */
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        btnFloating.classList.add("hidden");
      } else {
        btnFloating.classList.remove("hidden");
        syncSellBadge(); // asegura estado correcto
      }
    },
    { threshold: 0.15 }
  );

  observer.observe(headerActions);
});

/* =============================================================================================================================
   MODAL: PRENDAS RECIENTES (AGREGADAS O MODIFICADAS)
============================================================================================================================= */

function openRecentProductsModal(hours = 48) {
  const modal = document.getElementById("recentProductsModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  renderRecentProducts(hours);
}

function closeRecentProductsModal() {
  document.getElementById("recentProductsModal")?.classList.add("hidden");
}


// RENDERIZA PRODUCTOS MODIFICADOS / AGREGADOS EN LAS ÚLTIMAS X HORAS
function renderRecentProducts(hours = 48) {
  const tbody = document.getElementById("recentProductsTbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!Array.isArray(window.inventario)) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; opacity:.6">
          Inventario no disponible
        </td>
      </tr>
    `;
    return;
  }

  const now = Date.now();
  const limit = hours * 60 * 60 * 1000;

  const dias = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const recientes = window.inventario.filter(p => {
    if (!p.fecha) return false;
    const fechaProducto = new Date(p.fecha).getTime();
    return now - fechaProducto <= limit;
  });

  if (!recientes.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; opacity:.6">
          No hay prendas recientes
        </td>
      </tr>
    `;
    updateNotesBadge(0);
    return;
  }

  recientes.forEach(p => {
    const fecha = new Date(p.fecha);

    const diaSemana = dias[fecha.getDay()];
    const dia = fecha.getDate();
    const mes = meses[fecha.getMonth()];
    const año = fecha.getFullYear();

    let horas = fecha.getHours();
    const minutos = fecha.getMinutes().toString().padStart(2, "0");
    const ampm = horas >= 12 ? "PM" : "AM";

    horas = horas % 12 || 12;

    const fechaBonita = `${diaSemana} ${dia} ${mes} ${año} ${horas}:${minutos} ${ampm}`;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="recent-product-name">${p.nombre}</td>
      <td>${p.marca}</td>
      <td style="text-align:right;">${Number(p.stock) || 0}</td>
      <td style="text-align:center; color:#39ff14;">${p.vendidos}</td>
      <td>
        <div class="recent-date">
          <span>${fechaBonita}</span>
          <span class="badge-new">Nuevo</span>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  updateNotesBadge(recientes.length);
}



// BADGE VERDE DE NOTAS
function updateNotesBadge(count) {
  const badges = document.querySelectorAll(".js-notes-badge");

  badges.forEach(badge => {
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  });
}


/* ==================================================
   EXPORTAR TABLA INVENTARIO A PDF (HTML REAL)
================================================== */

/* ==================================================
   EXPORTAR INVENTARIO A PDF (HTML PURO)
================================================== */

/* ==================================================
   EXPORTAR INVENTARIO A PDF (HTML PURO - BLANCO)
================================================== */

function exportInventoryTablePDF() {
  const table = document.getElementById("inventoryTable");

  if (!table) {
    alert("No se encontró la tabla de inventario");
    return;
  }

  // 🔹 Clonamos la tabla
  const tableClone = table.cloneNode(true);

  // 🔹 Quitamos columnas que no sirven en PDF
  stripPdfColumns(tableClone);

  // 🔹 Forzamos estilos de tabla para PDF
  tableClone.style.width = "100%";
  tableClone.style.borderCollapse = "collapse";
  tableClone.style.background = "#ffffff";
  tableClone.style.color = "#000000";

  tableClone.querySelectorAll("th, td").forEach(cell => {
    cell.style.color = "#000";
    cell.style.background = "#fff";
    cell.style.border = "1px solid #ccc";
    cell.style.fontSize = "12px";
    cell.style.padding = "6px 8px";
  });

  tableClone.querySelectorAll("th").forEach(th => {
    th.style.background = "#f2f2f2";
    th.style.fontWeight = "600";
  });

  // 🔹 Contenedor PDF
  const pdfContainer = document.createElement("div");
  pdfContainer.style.background = "#ffffff";
  pdfContainer.style.color = "#000000";
  pdfContainer.style.padding = "20px";
  pdfContainer.style.fontFamily = "Arial, sans-serif";

  pdfContainer.innerHTML = `
    <h2 style="margin:0 0 4px 0; color:#000;">Inventario</h2>
    <div style="font-size:11px; color:#444; margin-bottom:12px;">
      Generado el ${new Date().toLocaleString("es-ES")}
    </div>
  `;

  pdfContainer.appendChild(tableClone);

  // 🔹 Configuración PDF
  const options = {
    margin: 0.4,
    filename: `Inventario_${new Date().toISOString().slice(0,10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      backgroundColor: "#ffffff"
    },
    jsPDF: {
      unit: "in",
      format: "letter",
      orientation: "landscape"
    }
  };

  html2pdf().set(options).from(pdfContainer).save();
}




function stripPdfColumns(table) {
  const headers = table.querySelectorAll("thead th");
  const removeIndexes = [];

  headers.forEach((th, index) => {
    const text = th.textContent.toLowerCase();
    if (
      th.querySelector("input") ||
      text.includes("acciones")
    ) {
      removeIndexes.push(index);
    }
  });

  table.querySelectorAll("tr").forEach(row => {
    [...removeIndexes].reverse().forEach(i => {
      if (row.children[i]) {
        row.children[i].remove();
      }
    });
  });
}


/* ==================================================
   EXPORTAR INVENTARIO A EXCEL (HTML REAL - FRONTEND)
================================================== */

function exportInventoryTableExcel() {
  const table = document.getElementById("inventoryTable");

  if (!table) {
    alert("No se encontró la tabla de inventario");
    return;
  }

  // 🔹 Clonamos la tabla original
  const tableClone = table.cloneNode(true);

  // 🔹 Quitamos columnas que no deben ir a Excel
  stripExcelColumns(tableClone);

  // 🔹 Creamos un libro de Excel
  const workbook = XLSX.utils.book_new();

  // 🔹 Convertimos la tabla HTML en una hoja
  const worksheet = XLSX.utils.table_to_sheet(tableClone, {
    raw: true
  });

  // 🔹 Ajuste automático del ancho de columnas
  const colWidths = [];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  rows.forEach(row => {
    row.forEach((cell, i) => {
      const cellLength = cell ? cell.toString().length : 10;
      colWidths[i] = Math.max(colWidths[i] || 10, cellLength);
    });
  });

  worksheet["!cols"] = colWidths.map(w => ({ wch: w + 2 }));

  // 🔹 Nombre de la hoja
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");

  // 🔹 Nombre del archivo
  const fileName = `Inventario_${new Date().toISOString().slice(0, 10)}.xlsx`;

  // 🔹 Descarga automática
  XLSX.writeFile(workbook, fileName);
}


/* ==================================================
   ELIMINAR COLUMNAS NO NECESARIAS PARA EXCEL
================================================== */

function stripExcelColumns(table) {
  const headers = table.querySelectorAll("thead th");
  const removeIndexes = [];

  headers.forEach((th, index) => {
    const text = th.textContent.toLowerCase();

    if (
      th.querySelector("input") || // columnas con inputs
      text.includes("acciones")    // columna acciones
    ) {
      removeIndexes.push(index);
    }
  });

  table.querySelectorAll("tr").forEach(row => {
    [...removeIndexes].reverse().forEach(i => {
      if (row.children[i]) {
        row.children[i].remove();
      }
    });
  });
}


/* ==================================================
   EXPORTAR TABLA VENTAS A PDF
================================================== */
function exportSalesTablePDF() {
  const table = document.getElementById("salesTable");

  if (!table) {
    alert("No se encontró la tabla de ventas");
    return;
  }

  const tableClone = table.cloneNode(true);
  stripSalesPdfColumns(tableClone);

  /* === ESTILOS GENERALES === */
  tableClone.style.width = "100%";
  tableClone.style.borderCollapse = "collapse";
  tableClone.style.background = "#ffffff";
  tableClone.style.color = "#000000";
  tableClone.style.tableLayout = "fixed";

  tableClone.querySelectorAll("th, td").forEach(cell => {
    cell.style.border = "1px solid #ccc";
    cell.style.fontSize = "11px";
    cell.style.padding = "6px";
    cell.style.color = "#000";
    cell.style.background = "#fff";
    cell.style.overflowWrap = "break-word";
  });

  tableClone.querySelectorAll("th").forEach(th => {
    th.style.background = "#f2f2f2";
    th.style.fontWeight = "600";
  });

  /* === FORZAR SALTO DE LÍNEA EN PRODUCTO Y FECHA === */
  const headers = tableClone.querySelectorAll("thead th");
  let productoIndex = -1;
  let fechaIndex = -1;

  headers.forEach((th, index) => {
    const text = th.textContent.toLowerCase();
    if (text.includes("producto")) productoIndex = index;
    if (text.includes("fecha")) fechaIndex = index;
  });

  tableClone.querySelectorAll("tbody tr").forEach(row => {
    if (row.children[productoIndex]) {
      row.children[productoIndex].style.whiteSpace = "normal";
      row.children[productoIndex].style.wordBreak = "break-word";
      row.children[productoIndex].style.lineHeight = "1.3";
    }
    if (row.children[fechaIndex]) {
      row.children[fechaIndex].style.whiteSpace = "normal";
      row.children[fechaIndex].style.wordBreak = "break-word";
      row.children[fechaIndex].style.lineHeight = "1.3";
    }
  });

  /* === CONTENEDOR PDF === */
  const pdfContainer = document.createElement("div");
  pdfContainer.style.padding = "20px";
  pdfContainer.style.fontFamily = "Arial, sans-serif";
  pdfContainer.style.background = "#ffffff";
  pdfContainer.style.color = "#000000";
  pdfContainer.style.overflow = "visible";

  pdfContainer.innerHTML = `
    <h2 style="margin-bottom:4px;">Ventas</h2>
    <div style="font-size:11px; margin-bottom:12px;">
      Generado el ${new Date().toLocaleString("es-ES")}
    </div>
  `;

  pdfContainer.appendChild(tableClone);

  /* === EXPORT === */
  html2pdf().set({
    margin: [0.6, 0.4, 0.6, 0.4],
    filename: `Ventas_${new Date().toISOString().slice(0,10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true
    },
    jsPDF: {
      unit: "in",
      format: "letter",
      orientation: "landscape"
    }
  }).from(pdfContainer).save();
}


function stripSalesPdfColumns(table) {
  const headers = table.querySelectorAll("thead th");
  const removeIndexes = [];

  headers.forEach((th, index) => {
    const text = th.textContent.toLowerCase();
    if (text.includes("acciones")) {
      removeIndexes.push(index);
    }
  });

  table.querySelectorAll("tr").forEach(row => {
    [...removeIndexes].reverse().forEach(i => {
      if (row.children[i]) row.children[i].remove();
    });
  });
}


/* ==================================================
   EXPORTAR TABLA VENTAS A EXCEL
================================================== */
function exportSalesTableExcel() {
  const table = document.getElementById("salesTable");

  if (!table) {
    alert("No se encontró la tabla de ventas");
    return;
  }

  const tableClone = table.cloneNode(true);

  stripSalesExcelColumns(tableClone);

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.table_to_sheet(tableClone, { raw: true });

  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  worksheet["!cols"] = rows[0].map((_, i) => ({ wch: 18 }));

  XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas");

  XLSX.writeFile(
    workbook,
    `Ventas_${new Date().toISOString().slice(0,10)}.xlsx`
  );
}


function stripSalesExcelColumns(table) {
  const headers = table.querySelectorAll("thead th");
  const removeIndexes = [];

  headers.forEach((th, index) => {
    const text = th.textContent.toLowerCase();
    if (text.includes("acciones")) {
      removeIndexes.push(index);
    }
  });

  table.querySelectorAll("tr").forEach(row => {
    [...removeIndexes].reverse().forEach(i => {
      if (row.children[i]) row.children[i].remove();
    });
  });
}




/* ==================================================
   GUARDAR MENSAJE / SITUACIÓN DEL DÍA
================================================== */

async function guardarSituacion(event) {
  
  // 🔹 Referencias a los campos del formulario
  const textareaMensaje = document.getElementById("mensajeTexto");
  const selectTipo = document.getElementById("mensajeTipo");
  const selectImportancia = document.getElementById("mensajeImportancia");

  // 🔹 Valores actuales
  const mensaje = textareaMensaje.value.trim();
  const tipo = selectTipo.value;
  const importancia = selectImportancia.value;

  // 🔹 Validación básica
  if (!mensaje) {
    alert("Escribe una situación antes de guardar");
    textareaMensaje.focus();
    return;
  }

  // 🔹 Payload EN JSON (CLAVE)
  const payload = {
    action: "add_situacion",
    mensaje: mensaje,
    tipo: tipo,
    importancia: importancia,
    autor: "Trabajador" // 👉 luego puedes hacerlo dinámico
  };

  try {
    // 🔹 Llamada al backend (Apps Script)
    const response = await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    // 🔹 Resultado
    if (result.success) {
      Swal.fire({
        icon: "success",
        title: "Guardado",
        text: "La situación fue registrada correctamente",
        timer: 1800,
        showConfirmButton: false
      });

      // 🔹 Limpiar formulario
      textareaMensaje.value = "";
      selectTipo.value = "Nota";
      selectImportancia.value = "1";

      // 🔹 Cerrar modal
      closeMessagesModal();

      // 👉 aquí luego puedes refrescar la lista
      // loadSituacionesDelDia();

    } else {
      throw new Error(result.message || "Error desconocido");
    }

  } catch (error) {
    console.error("Error al guardar situación:", error);

    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo guardar la situación"
    });
  }
}



/* ==================================================
   MODAL MENSAJES / SITUACIONES
================================================== */

function openMessagesModal() {
  const modal = document.getElementById("messagesModal");
  modal.classList.remove("hidden");

  mostrarFormularioSituacion();
}

function closeMessagesModal() {
  document.getElementById("messagesModal").classList.add("hidden");
}

function mostrarFormularioSituacion() {
  document.getElementById("mensajeFormView").classList.remove("hidden");
  document.getElementById("mensajeTableView").classList.add("hidden");
}

function mostrarTablaSituaciones() {
  document.getElementById("mensajeFormView").classList.add("hidden");
  document.getElementById("mensajeTableView").classList.remove("hidden");
}


async function cargarSituaciones() {
  const res = await fetch(`${API_URL}?action=list_situaciones`);
  const json = await res.json();

  if (!json.success) return;

  const tbody = document.getElementById("situacionesTableBody");
  tbody.innerHTML = "";

  json.data.forEach(s => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${s.mensaje}</td>
      <td>${s.fecha}</td>
      <td>${s.hora}</td>
      <td>
        <button class="danger ghost"
          onclick="eliminarSituacion('${s.id}')">
          🗑️
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}


function closeMessagesModal() {
  const modal = document.getElementById("messagesModal");
  if (!modal) return;

  modal.classList.add("hidden");
}

// Referencias
const messagesModal = document.getElementById('messagesModal');
const cancelBtn = document.getElementById('cancelMessageBtn');

// Cerrar modal al cancelar
cancelBtn.addEventListener('click', () => {
  messagesModal.style.display = 'none';
});

// (Opcional) Cerrar al hacer click fuera de la tarjeta
messagesModal.addEventListener('click', (e) => {
  if (e.target === messagesModal) {
    messagesModal.style.display = 'none';
  }
});


// ==================================================
// HISTORIAL DE SITUACIONES (DESDE BACKEND)
// ==================================================

// ==================================================
// HISTORIAL DE SITUACIONES (DESDE BACKEND + UI SMART)
// ==================================================

let historialData = []; // datos ya interpretados para UI

// --------------------------------------------------
// Mostrar / ocultar panel historial
// --------------------------------------------------
function toggleHistorial() {
  mostrarTablaSituaciones();
  cargarSituaciones();
}


// --------------------------------------------------
// Obtener situaciones desde Apps Script
// --------------------------------------------------
async function cargarHistorial() {
  try {
    const res = await fetch(`${API_URL}?action=list_situaciones`);
    const json = await res.json();

    if (!json.success || !Array.isArray(json.data)) {
      console.error("Respuesta inválida del backend", json);
      historialData = [];
      renderHistorial();
      return;
    }

    // 👉 interpretación inteligente AQUÍ
    historialData = json.data.map(interpretarSituacion);

    renderHistorial();

  } catch (err) {
    console.error("Error de conexión", err);
    historialData = [];
    renderHistorial();
  }
}

// --------------------------------------------------
// Interpretar una situación (backend → UI)
// --------------------------------------------------
function interpretarSituacion(raw) {
  return {
    id: raw.id,
    mensaje: limpiarTexto(raw.mensaje),
    tipo: interpretarTipo(raw.tipo),
    importancia: interpretarImportancia(raw.importancia),
    fecha: interpretarFecha(raw.fecha, raw.hora)
  };
}

// --------------------------------------------------
// Helpers de interpretación
// --------------------------------------------------
function limpiarTexto(texto) {
  if (!texto || typeof texto !== "string") return "—";
  return texto.trim();
}

function interpretarTipo(tipo) {
  const map = {
    Nota: "📝 Nota",
    Venta: "💰 Venta",
    Problema: "⚠️ Problema",
    Cliente: "👤 Cliente",
    Decisión: "📌 Decisión"
  };
  return map[tipo] || "—";
}

function interpretarImportancia(valor) {
  if (valor == 3) return "🔴 Alta";
  if (valor == 2) return "🟡 Media";
  if (valor == 1) return "🟢 Baja";
  return "—";
}

function interpretarFecha(fecha, hora) {
  if (!fecha) return "—";

  const d = new Date(fecha);
  if (isNaN(d)) return "—";

  const fechaTexto = d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  return hora ? `${fechaTexto} · ${hora}` : fechaTexto;
}

// --------------------------------------------------
// Renderizar tabla
// --------------------------------------------------
function renderHistorial() {
  const tbody = document.getElementById("historialBody");
  tbody.innerHTML = "";

  if (!historialData || historialData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; opacity:.6;">
          No hay situaciones registradas
        </td>
      </tr>
    `;
    return;
  }

  historialData.forEach(item => {
    tbody.innerHTML += `
      <tr>
        <td>${item.mensaje}</td>
        <td>${item.tipo}</td>
        <td>${item.importancia}</td>
        <td>${item.fecha}</td>
        <td>
          <button
            class="delete-btn"
            onclick="eliminarSituacion('${item.id}')"
            title="Eliminar"
          >
            🗑️
          </button>
        </td>
      </tr>
    `;
  });
}

// --------------------------------------------------
// Eliminar situación
// --------------------------------------------------
async function eliminarSituacion(id) {
  const { isConfirmed } = await Swal.fire({
    title: "Eliminar situación",
    text: "Esta acción no se puede deshacer",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar"
  });

  if (!isConfirmed) return;

  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "delete_situacion",
      id
    })
  });

  cargarSituaciones();
}



// ================================
// MODAL HISTORIAL SITUACIONES
// ================================
function openSituacionesModal() {
  document.getElementById("situacionesModal").classList.remove("hidden");

  // cargar una sola vez
  const panel = document.getElementById("situacionesModal");
  if (!panel.classList.contains("loaded")) {
    cargarHistorial();
    panel.classList.add("loaded");
  }
}

function closeSituacionesModal() {
  document.getElementById("situacionesModal").classList.add("hidden");
}




// function buildPdfHtmlDocument(tableHtml) {
//   const today = new Date().toLocaleDateString("es-ES");

//   return `
// <!DOCTYPE html>
// <html lang="es">
// <head>
// <meta charset="UTF-8">
// <title>Inventario PDF</title>
// <style>
//   body {
//     font-family: Inter, Arial, sans-serif;
//     padding: 20px;
//   }
//   h1 {
//     font-size: 18px;
//     margin-bottom: 6px;
//   }
//   .meta {
//     font-size: 12px;
//     color: #666;
//     margin-bottom: 14px;
//   }
//   table {
//     width: 100%;
//     border-collapse: collapse;
//     font-size: 12px;
//   }
//   th {
//     background: #f2f2f2;
//     text-align: left;
//     padding: 6px;
//     border-bottom: 1px solid #ccc;
//   }
//   td {
//     padding: 6px;
//     border-bottom: 1px solid #e0e0e0;
//   }
// </style>
// </head>
// <body>

// <h1>Inventario – Exportación PDF</h1>
// <div class="meta">Generado el ${today}</div>

// ${tableHtml}

// </body>
// </html>
// `;
// }



/* ======================
   TOAST NEÓN (ESTILOS EN JS)
====================== */
// (function injectToastStyles() {
//   if (document.getElementById("toastStyles")) return;

//   const style = document.createElement("style");
//   style.id = "toastStyles";
//   style.innerHTML = `
//     .toast {
//       position: fixed;
//       bottom: 24px;
//       left: 50%;
//       transform: translateX(-50%) translateY(20px);
//       background: linear-gradient(135deg, #0a84ff, #0066ff);
//       color: white;
//       padding: 14px 22px;
//       border-radius: 16px;
//       font-weight: 600;
//       font-size: 14px;
//       box-shadow: 0 10px 30px rgba(10,132,255,0.45);
//       opacity: 0;
//       transition: all 0.3s ease;
//       z-index: 10000; /* MÁS QUE EL MODAL */
//       pointer-events: none;
//       isolation: isolate;
//     }

//     .toast.show {
//       opacity: 1;
//       transform: translateX(-50%) translateY(0);
//     }
//   `;
//   document.head.appendChild(style);
// })();


// function showToast(message) {
//   const toast = document.createElement("div");
//   toast.className = "toast";
//   toast.textContent = message;

//   document.body.appendChild(toast);

//   requestAnimationFrame(() => {
//     toast.classList.add("show");
//   });

//   setTimeout(() => {
//     toast.classList.remove("show");
//     setTimeout(() => toast.remove(), 300);
//   }, 3000);
// }





