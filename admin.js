const SUPABASE_URL = "https://xcfqfzoxhxyvhrdnrknp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jBj2Jdk3H2S2yXfuVulQKg_E3Ls6tqR";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAdminSession() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data.user) {
    window.location.href = "admin-login.html";
    return;
  }

  await loadAdminStats();
  await loadAdminShipments();
}

function formatStatus(status) {
  return `<span class="status-badge">${status || "—"}</span>`;
}

async function getFilteredShipments() {
  let query = supabaseClient
    .from("shipments")
    .select("*")
    .order("created_at", { ascending: false });

  const filterType = document.getElementById("filterType")?.value || "";
  const filterStatus = document.getElementById("filterStatus")?.value || "";
  const filterPhone = document.getElementById("filterPhone")?.value.trim() || "";

  if (filterType) {
    query = query.eq("shipment_type", filterType);
  }

  if (filterStatus) {
    query = query.eq("status", filterStatus);
  }

  if (filterPhone) {
    query = query.ilike("customer_phone", `%${filterPhone}%`);
  }

  return await query;
}

async function loadAdminStats() {
  const statsBox = document.getElementById("adminStats");
  if (!statsBox) return;

  const { data, error } = await getFilteredShipments();

  if (error) {
    statsBox.innerHTML = "Erreur : " + error.message;
    return;
  }

  const total = data.length;
  const air = data.filter(x => x.shipment_type === "AIR").length;
  const sea = data.filter(x => x.shipment_type === "SEA").length;
  const contacted = data.filter(x => x.contact_opened === true).length;
  const inTransit = data.filter(x => x.status === "IN_TRANSIT").length;
  const delivered = data.filter(x => x.status === "DELIVERED").length;

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
      <div class="stat-card">
        <h3>En transit</h3>
        <div class="stat-value">${inTransit}</div>
      </div>
      <div class="stat-card">
        <h3>Livrées</h3>
        <div class="stat-value">${delivered}</div>
      </div>
    </div>
  `;
}

async function updateShipmentStatus(code, newStatus) {
  if (!newStatus) return;

  const { error } = await supabaseClient
    .from("shipments")
    .update({ status: newStatus })
    .eq("code", code);

  if (error) {
    alert("Erreur : " + error.message);
    return;
  }

  await loadAdminStats();
  await loadAdminShipments();
}

async function loadAdminShipments() {
  const box = document.getElementById("adminShipments");
  if (!box) return;

  const { data, error } = await getFilteredShipments();

  if (error) {
    box.innerHTML = "Erreur : " + error.message;
    return;
  }

  if (!data || !data.length) {
    box.innerHTML = "Aucune expédition.";
    return;
  }

  let html = "";

  data.forEach(item => {
    html += `
      <div class="card" style="margin-bottom: 14px;">
        <div><strong>Code :</strong> ${item.code || "-"}</div>
        <div><strong>Client :</strong> ${item.customer_name || "-"}</div>
        <div><strong>Téléphone :</strong> ${item.customer_phone || "-"}</div>
        <div><strong>Colis :</strong> ${item.goods_name || "-"}</div>
        <div><strong>Type :</strong> ${item.shipment_type || "-"}</div>
        <div><strong>Quantité :</strong> ${item.quantity || "-"} ${item.unit || ""}</div>
        <div><strong>Statut :</strong> ${formatStatus(item.status)}</div>
        <div><strong>Contact cargo :</strong> ${item.contact_opened ? "Oui" : "Non"}</div>
        <div><strong>Date :</strong> ${item.created_at ? new Date(item.created_at).toLocaleString("fr-FR") : "-"}</div>

        <div style="margin-top: 12px;">
          <select onchange="updateShipmentStatus('${item.code}', this.value)">
            <option value="">Changer statut</option>
            <option value="Demande créée">Demande créée</option>
            <option value="CONTACTED">Contacté</option>
            <option value="IN_TRANSIT">En transit</option>
            <option value="DELIVERED">Livré</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>
      </div>
    `;
  });

  box.innerHTML = html;
}
  
async function logoutAdmin() {
  await supabaseClient.auth.signOut();
  window.location.href = "admin-login.html";
}

checkAdminSession();
