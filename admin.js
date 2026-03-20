const SUPABASE_URL = "https://xcfqfzoxhxyvhrdnrknp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jBj2Jdk3H2S2yXfuVulQKg_E3Ls6tqR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAdminSession() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data.user) {
    window.location.href = "admin-login.html";
    return;
  }

  loadAdminStats();
  loadAdminShipments();
}

async function loadAdminStats() {
  const statsBox = document.getElementById("adminStats");

  const { data, error } = await supabaseClient
    .from("shipments")
    .select("*");

  if (error) {
    statsBox.innerHTML = "Erreur : " + error.message;
    return;
  }

  const total = data.length;
  const air = data.filter(x => x.shipment_type === "AIR").length;
  const sea = data.filter(x => x.shipment_type === "SEA").length;
  const contacted = data.filter(x => x.contact_opened === true).length;

  statsBox.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total expéditions</h3>
        <div class="stat-value">${total}</div>
      </div>
      <div class="stat-card">
        <h3>Aérien</h3>
        <div class="stat-value">${air}</div>
      </div>
      <div class="stat-card">
        <h3>Maritime</h3>
        <div class="stat-value">${sea}</div>
      </div>
      <div class="stat-card">
        <h3>Contacts cargo</h3>
        <div class="stat-value">${contacted}</div>
      </div>
    </div>
  `;
}

function formatStatus(status) {
  return `<span class="status-badge">${status || "—"}</span>`;
}

async function loadAdminShipments() {
  const box = document.getElementById("adminShipments");

  const { data, error } = await supabaseClient
    .from("shipments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    box.innerHTML = "Erreur : " + error.message;
    return;
  }

  if (!data.length) {
    box.innerHTML = "Aucune expédition.";
    return;
  }

  let html = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Client</th>
            <th>Téléphone</th>
            <th>Colis</th>
            <th>Type</th>
            <th>Quantité</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach(item => {
    html += `
      <tr>
        <td>${item.code || ""}</td>
        <td>${item.customer_name || ""}</td>
        <td>${item.customer_phone || ""}</td>
        <td>${item.goods_name || ""}</td>
        <td>${item.shipment_type || ""}</td>
        <td>${item.quantity || ""} ${item.unit || ""}</td>
        <td>${formatStatus(item.status)}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  box.innerHTML = html;
}

async function logoutAdmin() {
  await supabaseClient.auth.signOut();
  window.location.href = "admin-login.html";
}

checkAdminSession();
