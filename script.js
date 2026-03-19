const type = document.getElementById("type");
const airBox = document.getElementById("airBox");
const seaBox = document.getElementById("seaBox");

const transportMode = document.getElementById("transportMode");
const kgCalcBox = document.getElementById("kgCalcBox");
const cbmCalcBox = document.getElementById("cbmCalcBox");
const fixedCalcBox = document.getElementById("fixedCalcBox");

const menuBtn = document.getElementById("menuBtn");
const menu = document.getElementById("menu");

// MENU
menuBtn.addEventListener("click", () => {
  menu.classList.toggle("show");
});

function showSection(sectionId) {
  document.getElementById("expedition").classList.add("hidden");
  document.getElementById("tracking").classList.add("hidden");
  document.getElementById("calculator").classList.add("hidden");

  document.getElementById(sectionId).classList.remove("hidden");
  menu.classList.remove("show");
}

// Fermer menu si on clique ailleurs
document.addEventListener("click", (e) => {
  if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
    menu.classList.remove("show");
  }
});

// EXPEDITION AIR / SEA
type.addEventListener("change", () => {
  if (type.value === "AIR") {
    airBox.classList.remove("hidden");
    seaBox.classList.add("hidden");
  } else {
    airBox.classList.add("hidden");
    seaBox.classList.remove("hidden");
  }
});

// CALCULATEUR
transportMode.addEventListener("change", () => {
  kgCalcBox.classList.add("hidden");
  cbmCalcBox.classList.add("hidden");
  fixedCalcBox.classList.add("hidden");

  if (transportMode.value === "kg") {
    kgCalcBox.classList.remove("hidden");
  } else if (transportMode.value === "cbm") {
    cbmCalcBox.classList.remove("hidden");
  } else {
    fixedCalcBox.classList.remove("hidden");
  }
});

async function createShipment() {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const goods = document.getElementById("goods").value.trim();
  const t = type.value;
  const result = document.getElementById("result");

  result.innerHTML = "";

  if (!name || !phone || !goods) {
    result.innerHTML = "Remplis tous les champs.";
    return;
  }

  let quantity = 0;
  let unit = "";
  let agentPhone = "";
  let agentName = "";

  if (t === "AIR") {
    const kg = parseFloat(document.getElementById("kg").value);
    if (isNaN(kg) || kg < 10) {
      result.innerHTML = "Le minimum pour l'aérien est 10 kg.";
      return;
    }
    quantity = kg;
    unit = "kg";
    agentPhone = "8615070697279";
    agentName = "Katy";
  } else {
    const cbm = parseFloat(document.getElementById("cbm").value);
    if (isNaN(cbm) || cbm < 0.3) {
      result.innerHTML = "Le minimum pour le maritime est 0.3 CBM.";
      return;
    }
    quantity = cbm;
    unit = "CBM";
    agentPhone = "8619127720244";
    agentName = "Ethan";
  }

  const code = t + "-CI-" + Math.floor(1000 + Math.random() * 9000);

  const { error } = await supabaseClient.from("shipments").insert({
    code: code,
    customer_name: name,
    customer_phone: phone,
    goods_name: goods,
    shipment_type: t,
    quantity: quantity,
    unit: unit,
    agent_name: agentName,
    agent_phone: agentPhone,
    status: "Demande créée"
  });

  if (error) {
    result.innerHTML = "Erreur Supabase : " + error.message;
    return;
  }

  const message =
    "Bonjour,%0A%0A" +
    "Je viens de AfriShipPlus.%0A" +
    "Agent : " + agentName + "%0A" +
    "Code expédition : " + code + "%0A" +
    "Nom : " + name + "%0A" +
    "Nom du colis : " + goods + "%0A" +
    "Détail : " + quantity + " " + unit + "%0A%0A" +
    "Je souhaite faire une expédition.";

  const link = "https://wa.me/" + agentPhone + "?text=" + message;

  result.innerHTML =
    "Code : " + code +
    "<br>Agent : " + agentName +
    "<br><a href='" + link + "' target='_blank'>Contacter le cargo via WhatsApp</a>";
}

function calculateCost() {
  const currency = document.getElementById("currency").value.trim() || "FCFA";
  const productCost = parseFloat(document.getElementById("productCost").value) || 0;
  const localDelivery = parseFloat(document.getElementById("localDelivery").value) || 0;
  const taxesPercent = parseFloat(document.getElementById("taxes").value) || 0;
  const mode = transportMode.value;
  const calcResult = document.getElementById("calcResult");

  let transport = 0;

  if (mode === "kg") {
    const pricePerKg = parseFloat(document.getElementById("pricePerKg").value) || 0;
    const weightKg = parseFloat(document.getElementById("weightKg").value) || 0;
    transport = pricePerKg * weightKg;
  } else if (mode === "cbm") {
    const pricePerCbm = parseFloat(document.getElementById("pricePerCbm").value) || 0;
    const volumeCbm = parseFloat(document.getElementById("volumeCbm").value) || 0;
    transport = pricePerCbm * volumeCbm;
  } else {
    transport = parseFloat(document.getElementById("fixedTransport").value) || 0;
  }

  const subtotal = productCost + localDelivery + transport;
  const taxes = subtotal * (taxesPercent / 100);
  const total = subtotal + taxes;

  calcResult.classList.remove("hidden");
  calcResult.innerHTML =
    "Montant fournisseur : " + productCost.toLocaleString("fr-FR") + " " + currency + "<br>" +
    "Livraison locale : " + localDelivery.toLocaleString("fr-FR") + " " + currency + "<br>" +
    "Transport : " + transport.toLocaleString("fr-FR") + " " + currency + "<br>" +
    "Taxes : " + taxes.toLocaleString("fr-FR") + " " + currency + "<br>" +
    "<strong>Total final : " + total.toLocaleString("fr-FR") + " " + currency + "</strong>";
}

async function trackShipment() {
  const code = document.getElementById("trackCode").value.trim();
  const trackingResult = document.getElementById("trackingResult");

  if (!code) {
    trackingResult.innerHTML = "Entre un code expédition.";
    return;
  }

  const { data, error } = await supabaseClient
    .from("shipments")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    trackingResult.innerHTML = "Erreur : " + error.message;
    return;
  }

  if (!data) {
    trackingResult.innerHTML = "Code introuvable.";
    return;
  }

  trackingResult.innerHTML =
    "Code : <strong>" + data.code + "</strong><br>" +
    "Client : " + data.customer_name + "<br>" +
    "Type : " + data.shipment_type + "<br>" +
    "Quantité : " + data.quantity + " " + data.unit + "<br>" +
    "Statut : <strong>" + data.status + "</strong>";
}
