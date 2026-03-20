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
    <p>Total expéditions : <strong>${total}</strong></p>
    <p>Aérien : <strong>${air}</strong></p>
    <p>Maritime : <strong>${sea}</strong></p>
    <p>Contacts cargo ouverts : <strong>${contacted}</strong></p>
  `;
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
    <div style="overflow-x:auto;">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Code</th>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Client</th>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Téléphone</th>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Colis</th>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Type</th>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Quantité</th>
            <th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Statut</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach(item => {
    html += `
      <tr>
        <td style="padding:8px; border-bottom:1px solid #eee;">${item.code || ""}</td>
        <td style="padding:8px; border-bottom:1px solid #eee;">${item.customer_name || ""}</td>
        <td style="padding:8px; border-bottom:1px solid #eee;">${item.customer_phone || ""}</td>
        <td style="padding:8px; border-bottom:1px solid #eee;">${item.goods_name || ""}</td>
        <td style="padding:8px; border-bottom:1px solid #eee;">${item.shipment_type || ""}</td>
        <td style="padding:8px; border-bottom:1px solid #eee;">${item.quantity || ""} ${item.unit || ""}</td>
        <td style="padding:8px; border-bottom:1px solid #eee;">${item.status || ""}</td>
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
