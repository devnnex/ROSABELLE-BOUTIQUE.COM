 
const API = "https://script.google.com/macros/s/AKfycbyITEhISAxx8e0e_kBdei2IiUGFBZnEYhKRutcoiAqOAlD9qS9qB6xy8_MZJ5w3lT1U/exec";


/* ================================================================================================================================================================================================================================================================================================================================================================
  COMIENZO DE LA SECCION DE ANALISIS
==================================================================================================================================================================================================================================================================================================================================================================  */
// aqui empieza el desarrollo de la seccion de Analisis 🔹
const ANALYSIS_STATE = {
  month: new Date().getMonth(),
  year: new Date().getFullYear()
};

// MANEJAR CAMBIO DE MES Y POBLAR EL SELECTOR
const monthSelect = document.getElementById("analysisMonth");

const monthNames = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

monthNames.forEach((name, index) => {
  const opt = document.createElement("option");
  opt.value = index;
  opt.textContent = name;
  if (index === ANALYSIS_STATE.month) opt.selected = true;
  monthSelect.appendChild(opt);
});

// MANEJAR CAMBIO DE AÑO Y POBLAR EL SELECTOR
const yearSelect = document.getElementById("analysisYear");
let yearRange = 5; // Cantidad de años iniciales hacia el futuro
const currentYear = new Date().getFullYear();

function populateYearSelect(startYear = currentYear) {
  // Limpiar opciones actuales
  yearSelect.innerHTML = "";

  for (let y = startYear; y <= startYear + yearRange; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === ANALYSIS_STATE.year) opt.selected = true;
    yearSelect.appendChild(opt);
  }
}

// Llenado inicial
populateYearSelect();

// Detectar si el usuario selecciona el último año y agregar 5 más
yearSelect.addEventListener("change", e => {
  const selectedYear = Number(e.target.value);
  ANALYSIS_STATE.year = selectedYear;
  fetchData();

  const options = Array.from(yearSelect.options).map(o => Number(o.value));
  const lastYear = Math.max(...options);

  if (selectedYear === lastYear) {
    // Agregar 5 años más
    populateYearSelect(lastYear + 1);
    yearSelect.value = selectedYear; // mantener selección
  }
});


// ESCUCHAR CAMBIOS EN SELECTORES
monthSelect.addEventListener("change", e => {
  ANALYSIS_STATE.month = Number(e.target.value);
  fetchData();
});

yearSelect.addEventListener("change", e => {
  ANALYSIS_STATE.year = Number(e.target.value);
  fetchData();
});



// Variables globales para gráficos
let salesByMonthChart = null;
let topProductsChart = null;



// 🔹 Función para obtener los KPIs y top productos
function fetchData() {
  const { month, year } = ANALYSIS_STATE;

  fetch(`${API}?action=kpis&month=${month}&year=${year}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) return;

      animateNumber("kpiVentas", data.totalVentas);
      animateNumber("kpiGanancia", data.gananciaNeta);
      animateNumber("kpiDescuentos", data.totalDescuentos);
      animateNumber("kpiSinDescuento", data.ventasSinDescuento);
      animateNumber("ganancia_neta", data.gananciaNeta);

      document.getElementById("totalpagado").textContent =
        "$" + Number(data.totalGastos || 0).toLocaleString("es-CO");

      // Top productos
      const tbody = document.getElementById("top_productos");
      tbody.innerHTML = "";
      data.topProductos.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${p.producto}</td>
          <td>${p.marca}</td>
          <td>${p.cantidad}</td>
          <td>$${p.ganancia.toLocaleString("es-CO")}</td>
        `;
        tbody.appendChild(tr);
      });
    });
}





function showToast(msg) {
  const toast = document.createElement("div");
  toast.textContent = msg;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.background = "#111";
  toast.style.color = "#fff";
  toast.style.padding = "12px 16px";
  toast.style.borderRadius = "8px";
  toast.style.fontSize = "0.85rem";
  toast.style.zIndex = 9999;
  toast.style.opacity = "0";
  toast.style.transition = "opacity .3s ease";

  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = "1");

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}



// 🔹 Formato de números
function formatNumber(num) {
  return Number(num || 0).toLocaleString('es-CO');
}

// 🔹 Animación tipo "baloto" para cada KPI
function animateNumber(id, target) {
  const el = document.getElementById(id);
  let current = parseInt(el.getAttribute("data-current") || 0);
  const diff = target - current;
  const step = Math.ceil(Math.abs(diff)/20);
  if (diff === 0) return;
  const direction = diff > 0 ? 1 : -1;

  const interval = setInterval(() => {
    current += step * direction;
    if ((direction>0 && current >= target) || (direction<0 && current <= target)) {
      current = target;
      clearInterval(interval);
    }
    el.textContent = "$" + formatNumber(current);
    el.setAttribute("data-current", current);
  }, 50);
}


// 🔹 Agregar gasto
// 🔹 Agregar gasto
document.getElementById("btnAgregarGasto").addEventListener("click", async (e) => {
  e.preventDefault(); // 🔹 Evita que el formulario recargue la página

  const nombre = document.getElementById("gastoNombre").value.trim();
  const valor = Number(document.getElementById("gastoValor").value);
  if(!nombre || !valor) return alert("Ingrese nombre y valor del gasto");

  try {
    await fetch(API, {
      method: "POST",
      mode: "no-cors",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ action:"add_expense", nombre, valor })
    });

    document.getElementById("gastoNombre").value = "";
    document.getElementById("gastoValor").value = "";

    // 🔄 Actualizar KPIs y lista de gastos inmediatamente
    fetchData();
    fetchExpenses();

  } catch(err) {
    console.error("Error agregando gasto:", err);
  }
});



// 🔹 Obtener y renderizar lista de gastos
// 🔹 Obtener y renderizar lista de gastos
async function fetchExpenses() {
  try {
    const res = await fetch(API + "?action=expenses");
    const data = await res.json();

    if (!data || !Array.isArray(data)) return;

    const list = document.getElementById("expenseList");
    list.innerHTML = "";

    data.forEach(g => {
      const li = document.createElement("li");
      li.className = "expense-item";

      // Texto gasto
      const span = document.createElement("span");
      span.className = "expense-text";
      span.innerHTML = `
        ${g.nombre}:
        <span class="expense-value">
          $${Number(g.valor).toLocaleString("es-CO")}
        </span>
      `;

       // Botón eliminar
      const btn = document.createElement("button");
      btn.className = "expense-delete";
      btn.textContent = "🗑️";

      btn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar este gasto?")) return;

        await fetch(API, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "delete_expense",
            id: g.id
          })
        });

        fetchExpenses();
        fetchData();
      });

      li.appendChild(span);
      li.appendChild(btn);
      list.appendChild(li);
    });

  } catch (err) {
    console.error("Error obteniendo gastos:", err);
  }
}


function setTotalVentasAnio(total) {
  const card = document.querySelector(".chart-card");
  if (!card) return;

  const h3 = card.querySelector("h3");
  if (!h3) return;

  // Convertimos el h3 en contenedor flex
  h3.style.display = "flex";
  h3.style.justifyContent = "space-between";
  h3.style.alignItems = "center";
  h3.style.gap = "12px";

  // Texto izquierdo (Ventas por Mes)
  let title = h3.querySelector(".chart-title");
  if (!title) {
    title = document.createElement("span");
    title.className = "chart-title";
    title.textContent = h3.textContent.trim();
    h3.textContent = "";
    h3.appendChild(title);
  }

  // Bloque derecho (Ventas Año)
  let box = h3.querySelector(".ventas-anio-box");

  if (!box) {
    box = document.createElement("div");
    box.className = "ventas-anio-box";
    box.style.textAlign = "right";
    box.style.lineHeight = "1.1";

    const label = document.createElement("div");
    label.textContent = "Ventas Año";
    label.style.fontSize = "0.65rem";
    label.style.fontWeight = "500";
    label.style.opacity = "0.6";

    const value = document.createElement("div");
    value.className = "ventas-anio-value";
    value.style.fontSize = "0.85rem";
    value.style.fontWeight = "700";
    value.style.color = "#16a34a";

    box.appendChild(label);
    box.appendChild(value);
    h3.appendChild(box);
  }

  // Actualizar valor
  const valueEl = h3.querySelector(".ventas-anio-value");
  valueEl.textContent = `$${total.toLocaleString("es-CO")}`;
}



// 🔹 Cargar gráfico de ventas por mes
async function loadSalesByMonthChart() {
  const { year } = ANALYSIS_STATE; // Tomamos el año seleccionado
  const res = await fetch(`${API}?action=chart_sales_month&year=${year}`);
  const data = await res.json();
  if (!data.success) return;

  // 🔹 TOTAL ANUAL del año seleccionado
  const totalAnual = data.data.reduce(
    (sum, val) => sum + Number(val || 0),
    0
  );

  setTotalVentasAnio(totalAnual); // Actualiza la tarjeta del total anual

  const ctx = document.getElementById("salesByMonthChart");

  if (salesByMonthChart) salesByMonthChart.destroy();

  salesByMonthChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [{
        label: `Ventas del Año ${year}`,
        data: data.data,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}




// 🔹 Cargar gráfico de top productos
async function loadTopProductsChart() {
  const res = await fetch(API + "?action=chart_top_products");
  const data = await res.json();
  if (!data.success) return;

  const ctx = document.getElementById("topProductsChart");

  if (topProductsChart) topProductsChart.destroy();

  topProductsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Cantidad Vendida",
        data: data.data
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

/* ======================
  MODAL DE MARCAS
====================== */
const brandModal = document.getElementById("brandModal");
const brandModalTitle = document.getElementById("brandModalTitle");
const brandProductsTableBody = document.querySelector("#brandProductsTable tbody");
const brandModalClose = document.getElementById("brandModalClose");

// Cerrar modal
brandModalClose.addEventListener("click", () => {
  brandModal.classList.add("hidden");
  brandProductsTableBody.innerHTML = "";
});

// Función para mostrar productos de una marca
function showBrandProducts(marca) {
  brandModalTitle.textContent = `Productos de ${marca}`;
  
  // Obtener productos del inventario
  fetch(API + "?action=list")
    .then(res => res.json())
    .then(products => {
      const filtered = products.filter(p => p.marca === marca);
      brandProductsTableBody.innerHTML = "";
      
      filtered.forEach(p => {
        const totalInversion = p.costo * p.stock;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${p.nombre}</td>
          <td>${p.stock}</td>
          <td>$${Number(p.costo).toLocaleString()}</td>
          <td>$${Number(totalInversion).toLocaleString()}</td>
        `;
        brandProductsTableBody.appendChild(tr);
      });

      brandModal.classList.remove("hidden");
    });
}

// 🔹 Agregar evento click a cada marca en la tabla de análisis
document.querySelectorAll(".brand-analysis-card tbody tr td:first-child").forEach(td => {
  td.style.cursor = "pointer"; // indica que es clickeable
  td.addEventListener("click", () => {
    showBrandProducts(td.textContent);
  });
});


// 🔹 Cargar análisis por marca
async function renderBrandAnalysis() {
  try {
    const res = await fetch(API + "?action=analysis_by_brand");
    const data = await res.json();

    const tbody = document.querySelector("#brandAnalysisTable tbody");
    tbody.innerHTML = "";

    if (data.success && data.data.length > 0) {
      data.data.forEach(b => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${b.marca}</td>
          <td>${b.productos}</td>
          <td>${b.vendidos}</td>
          <td>$${b.inversion.toLocaleString()}</td>
          <td>$${b.ventas.toLocaleString()}</td>
          <td>$${b.ganancia.toLocaleString()}</td>
        `;

        // 🔹 Agregar click al nombre de la marca
        tr.querySelector("td:first-child").style.cursor = "pointer";
        tr.querySelector("td:first-child").addEventListener("click", () => {
          showBrandProducts(b.marca);
        });

        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = `<tr><td colspan="6">No hay datos</td></tr>`;
    }

  } catch (err) {
    console.error("Error al cargar análisis por marca:", err);
  }
}


// Llamar al cargar la vista Análisis
document.addEventListener("DOMContentLoaded", () => {
  renderBrandAnalysis();
});





// 🔄 Actualizar KPIs y gastos cada segundo
setInterval(() => {
  fetchData();
  fetchExpenses();
  renderBrandAnalysis();
}, 3000);


setInterval(() => {
  loadSalesByMonthChart();
  loadTopProductsChart();
}, 120000);

// Primera carga
fetchData();
fetchExpenses();

// Cargar gráficos solo una vez
loadSalesByMonthChart();
loadTopProductsChart();
/* ================================================================================================================================================================================================================================================================================================================================================================
 FINAL DE LA SECCION DE ANALISIS
==================================================================================================================================================================================================================================================================================================================================================================  */






/* ======================================================================================================================
 COMIENZO DE LA SECCION DE CLIENTES
====================================================================================================================== */

// =======================
// CLIENTES EN MEMORIA (SESIÓN)
// =======================
let sessionClients = [];

// =======================
// FORMATO FECHAS
// =======================
function formatDateLong(d) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date)) return "";
  return date.toLocaleDateString("es-CO", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

// =======================
// RENDER CLIENTES
// =======================
async function renderClients() {
  try {
    const res = await fetch(API + "?action=list_clients");
    const data = await res.json();

    const tbody = document.querySelector("#clientsTable tbody");
    tbody.innerHTML = "";

    if (data.success && data.data.length) {
      sessionClients = data.data; // 🔥 guardamos en sesión

      data.data.forEach(c => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><input type="checkbox" data-id="${c.id}"></td>
          <td>${c.nombre}</td>
          <td>${c.telefono || ""}</td>
          <td>${c.correo || ""}</td>
          <td>${formatDateLong(c.fechacumple)}</td>
          <td>${formatDateLong(c.registrado)}</td>
          <td>
            <button class="edit-client" data-id="${c.id}">Editar</button>
            <button class="delete-client" data-id="${c.id}">Eliminar</button>
            <button class="email-client" data-id="${c.id}">📧</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      attachClientEvents();
      updateClientKPIs(sessionClients);
    } else {
      sessionClients = [];
      tbody.innerHTML = `<tr><td colspan="7">No hay clientes</td></tr>`;
      updateClientKPIs([]);
    }
  } catch (err) {
    console.error("Error cargando clientes:", err);
  }
}



/* =======================
   MODAL NUEVO CLIENTE
======================= */

const btnAddClient = document.getElementById("btnAddClient");
const clientModal = document.getElementById("clientModal");
const clientForm = document.getElementById("clientForm");

const clientName = document.getElementById("clientName");
const clientPhone = document.getElementById("clientPhone");
const clientEmail = document.getElementById("clientEmail");
const clientBirthday = document.getElementById("clientBirthday");
const clientId = document.getElementById("clientId");
const clientModalTitle = document.getElementById("clientModalTitle");
const clientModalClose = document.getElementById("clientModalClose");

/* ➕ ABRIR MODAL NUEVO CLIENTE */
btnAddClient.onclick = () => {
  clientModal.classList.remove("hidden");

  clientModalTitle.textContent = "Nuevo Cliente";

  clientForm.reset();
  clientId.value = ""; // 🔑 importante para que NO edite
};

/* ❌ CERRAR MODAL */
clientModalClose.onclick = () => {
  clientModal.classList.add("hidden");
};


/* =======================
   GUARDAR CLIENTE (CREATE / UPDATE)
======================= */

clientForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    nombre: clientName.value.trim(),
    telefono: clientPhone.value.trim(),
    correo: clientEmail.value.trim(),
    fechacumple: clientBirthday.value
  };

  // Validación mínima
  if (!payload.nombre) {
    return Swal.fire("Falta nombre", "El nombre es obligatorio", "warning");
  }

  let action = "create_client";

  // ✏️ EDITAR
  if (clientId.value) {
    payload.id = clientId.value;
    action = "update_client";
  }

  try {
    await fetch(API, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        ...payload
      })
    });

    clientModal.classList.add("hidden");
    clientForm.reset();
    clientId.value = "";

    renderClients(); // 🔄 refrescar tabla

    Swal.fire({
      icon: "success",
      title: action === "create_client"
        ? "Cliente registrado"
        : "Cliente actualizado",
      timer: 1600,
      showConfirmButton: false,
      background: "#111",
      color: "#fff"
    });

  } catch (err) {
    console.error("Error guardando cliente:", err);
    Swal.fire("Error", "No se pudo guardar el cliente", "error");
  }
});


// =======================
// KPIs CLIENTES
// =======================
function updateClientKPIs(clients) {
  const totalClientes = document.getElementById("totalClientes");
  const nextBirthdayInfo = document.getElementById("nextBirthdayInfo");
  const birthdaysThisMonth = document.getElementById("birthdaysThisMonth");
  const emailNextBirthday = document.getElementById("emailNextBirthday");

  if (!clients.length) {
    totalClientes.textContent = 0;
    nextBirthdayInfo.textContent = "—";
    birthdaysThisMonth.textContent = 0;
    emailNextBirthday.style.display = "none";
    return;
  }

  totalClientes.textContent = clients.length;

  const today = new Date();
  const upcoming = clients
    .filter(c => c.fechacumple)
    .map(c => {
      const b = new Date(c.fechacumple);
      const next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      return { ...c, nextBirthday: next };
    })
    .sort((a, b) => a.nextBirthday - b.nextBirthday);

  let index = 0;

  function renderBirthday(i) {
    const c = upcoming[i];
    const diff = Math.ceil((c.nextBirthday - today) / 86400000);

    nextBirthdayInfo.innerHTML = `
      <div class="birthday-name">${c.nombre}</div>
      <div class="birthday-date">${formatDateLong(c.fechacumple)}</div>
      <div class="birthday-days">En ${diff} días</div>
    `;

    emailNextBirthday.style.display = c.correo ? "inline-flex" : "none";
    emailNextBirthday.onclick = () => sendClientEmailForm(c);
  }

  renderBirthday(index);

  document.getElementById("prevBirthday").onclick = () => {
    index = (index - 1 + upcoming.length) % upcoming.length;
    renderBirthday(index);
  };

  document.getElementById("nextBirthday").onclick = () => {
    index = (index + 1) % upcoming.length;
    renderBirthday(index);
  };

  const month = today.getMonth();
  birthdaysThisMonth.textContent = clients.filter(c => {
    if (!c.fechacumple) return false;
    return new Date(c.fechacumple).getMonth() === month;
  }).length;
}

// =======================
// EVENTOS CLIENTES
// =======================
function attachClientEvents() {

  // EDITAR
  document.querySelectorAll(".edit-client").forEach(btn => {
    btn.onclick = () => {
      const c = sessionClients.find(x => x.id === btn.dataset.id);
      if (!c) return;

      clientModal.classList.remove("hidden");
      clientName.value = c.nombre;
      clientPhone.value = c.telefono || "";
      clientEmail.value = c.correo || "";
      clientBirthday.value = c.fechacumple || "";
      clientId.value = c.id;
    };
  });

  // ELIMINAR
 document.querySelectorAll(".delete-client").forEach(btn => {
  btn.onclick = async () => {

    const result = await Swal.fire({
      title: "🗑️ Eliminar cliente",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",

      background: "#0b0b0b",
      color: "#ffffff",

      customClass: {
        popup: "neo-glass",
        title: "neo-title",
        confirmButton: "neo-confirm danger",
        cancelButton: "neo-cancel"
      },

      buttonsStyling: false
    });

    if (!result.isConfirmed) return;

    await fetch(API, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_client",
        id: btn.dataset.id
      })
    });

    Swal.fire({
      icon: "success",
      title: "Cliente eliminado",
      timer: 1400,
      showConfirmButton: false,
      background: "#0b0b0b",
      color: "#fff",
      customClass: {
        popup: "neo-glass-success"
      }
    });

    renderClients();
  };
});


  // ENVIAR CORREO
  document.querySelectorAll(".email-client").forEach(btn => {
    btn.onclick = () => {
      const c = sessionClients.find(x => x.id === btn.dataset.id);
      if (!c || !c.correo) {
        return Swal.fire("Sin correo", "Este cliente no tiene correo", "warning");
      }

      Swal.fire({
        title: `¿Enviar correo a ${c.nombre}?`,
        confirmButtonText: "Enviar",
        showCancelButton: true,
        background: "#111",
        color: "#fff"
      }).then(r => r.isConfirmed && sendClientEmailForm(c));
    };
  });
}

// =======================
// EMAILJS
// =======================
function sendClientEmailForm(cliente) {
  if (!cliente?.correo) return;

  const form = document.createElement("form");
  form.style.display = "none";

  const data = {
    to_name: cliente.nombre,
    to_email: cliente.correo,
    telefono: cliente.telefono || "No registrado",
    fecha: new Date().toLocaleDateString("es-CO"),
    year: new Date().getFullYear()
  };

  Object.keys(data).forEach(k => {
    const i = document.createElement("input");
    i.type = "hidden";
    i.name = k;
    i.value = data[k];
    form.appendChild(i);
  });

  document.body.appendChild(form);

  emailjs
    .sendForm("service_klqo261", "template_rt5dymj", form)
    .then(() =>
      Swal.fire({
        icon: "success",
        title: "Correo enviado",
        text: `Mensaje enviado a ${cliente.nombre}`,
        timer: 2500,
        showConfirmButton: false,
        background: "#111",
        color: "#fff"
      })
    )
    .catch(() =>
      Swal.fire("Error", "No se pudo enviar el correo", "error")
    )
    .finally(() => form.remove());
}

// =======================
// INICIALIZAR
// =======================
document.addEventListener("DOMContentLoaded", renderClients);




const ANALYSIS_PASSWORD = "9999"; // 🔒 CAMBIAR


/* ==================================================
   🔐 BLOQUEO PREMIUM — SOLO VISTA ANÁLISIS
================================================== */

document.addEventListener("DOMContentLoaded", () => {

  const ANALYSIS_PASSWORD = "believe2026"; // 🔒 CAMBIAR
  const analysisView = document.getElementById("view-analisis");

  let unlocked = false;

  function isAnalysisActive() {
    return analysisView.classList.contains("active");
  }

  function lockAnalysis() {
    unlocked = false;
    analysisView.classList.add("locked");
  }

  function unlockAnalysis() {
    unlocked = true;
    analysisView.classList.remove("locked");
  }

async function requestPassword() {
  const { value: password } = await Swal.fire({
    title: "🔒 Acceso restringido",
    html: `<p class="neo-subtitle">Autenticación requerida</p>`,
    input: "password",
    inputPlaceholder: "Contraseña de análisis",
    inputAttributes: {
      autocapitalize: "off",
      autocorrect: "off",
    },
    showCancelButton: true,
    confirmButtonText: "ACCEDER",
    cancelButtonText: "SALIR",
    allowOutsideClick: false,
    allowEscapeKey: false,

    customClass: {
      popup: "neo-glass",
      title: "neo-title",
      input: "neo-input",
      confirmButton: "neo-confirm",
      cancelButton: "neo-cancel",
      backdrop: "neo-backdrop"
    },

    backdrop: true
  });

  if (password === ANALYSIS_PASSWORD) {
    unlockAnalysis();

    Swal.fire({
      icon: "success",
      title: "Acceso concedido",
      timer: 1200,
      showConfirmButton: false,
      customClass: {
        popup: "neo-glass-success"
      }
    });

  } else {
    lockAnalysis();
    exitAnalysis();
  }
}


  function exitAnalysis() {
    document
      .querySelector('[data-view="inventario"]')
      ?.click();
  }

  function checkAnalysisAccess() {
    if (isAnalysisActive()) {
      if (!unlocked) {
        lockAnalysis();
        requestPassword();
      }
    }
  }

  // 👀 Detectar cuando se activa Análisis
  const observer = new MutationObserver(checkAnalysisAccess);
  observer.observe(analysisView, {
    attributes: true,
    attributeFilter: ["class"]
  });

  // 🔁 Al cambiar de vista, se vuelve a bloquear
  document.querySelectorAll(".nav-menu a").forEach(link => {
    link.addEventListener("click", () => {
      if (!isAnalysisActive()) {
        lockAnalysis();
      }
    });
  });

  // 🚀 Caso recarga estando en análisis
  if (isAnalysisActive()) {
    lockAnalysis();
    requestPassword();
  }

});




