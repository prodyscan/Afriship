const type = document.getElementById("type");
const airBox = document.getElementById("airBox");
const seaBox = document.getElementById("seaBox");

const transportMode = document.getElementById("transportMode");
const kgCalcBox = document.getElementById("kgCalcBox");
const cbmCalcBox = document.getElementById("cbmCalcBox");
const fixedCalcBox = document.getElementById("fixedCalcBox");

const menuBtn = document.getElementById("menuBtn");
const menu = document.getElementById("menu");

if (menuBtn && menu) {
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
      menu.classList.remove("show");
    }
  });
}

const SHIPLUS_API_URL = "https://prodyscana-pro.hf.space/chat";

const shiplusInput = document.getElementById("shiplusInput");
const aiSendBtn = document.getElementById("aiSendBtn");
const newRequestBtn = document.getElementById("newRequestBtn");
const shiplusMessages = document.getElementById("shiplusMessages");

let qualifiedShipmentType = null; // "AIR" ou "SEA"

let shiplusHistory = [
  {
    role: "assistant",
    content: "Bonjour, je suis Shiplus. Souhaitez-vous une expédition aérienne ou maritime ?"
  }
];


function cleanShiplusAnswer(answer) {
  let cleaned = answer;

  cleaned = cleaned.replaceAll(
    "Le client est-il prêt à expédier bientôt ?",
    "Êtes-vous prêt à expédier votre colis bientôt ?"
  );

  cleaned = cleaned.replaceAll(
    "Le client veut-il juste une information ou une vraie expédition ?",
    "Souhaitez-vous simplement une information ou créer une vraie expédition ?"
  );

  cleaned = cleaned.replaceAll(
    "Le client est prêt à expédier bientôt.",
    "Vous êtes prêt à expédier bientôt."
  );

  cleaned = cleaned.replaceAll(
    "La demande est suffisamment qualifiée pour la création d'une expédition.",
    "Votre demande est suffisamment complète pour créer une expédition."
  );

  return cleaned;
}


function showSection(sectionId) {
  document.getElementById("assistant").classList.add("hidden");
  document.getElementById("expedition").classList.add("hidden");
  document.getElementById("tracking").classList.add("hidden");
  document.getElementById("calculator").classList.add("hidden");

  document.getElementById(sectionId).classList.remove("hidden");
  menu.classList.remove("show");
}


showSection("assistant");

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
if (transportMode) {
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
}

// SHIPLUS
function lockShiplusChat() {
  shiplusInput.disabled = true;
  aiSendBtn.disabled = true;
}

function unlockShiplusChat() {
  shiplusInput.disabled = false;
  aiSendBtn.disabled = false;
}
function applyQualifiedType() {
  if (qualifiedShipmentType === "AIR") {
    type.value = "AIR";
    type.disabled = true;
    airBox.classList.remove("hidden");
    seaBox.classList.add("hidden");
  } else if (qualifiedShipmentType === "SEA") {
    type.value = "SEA";
    type.disabled = true;
    airBox.classList.add("hidden");
    seaBox.classList.remove("hidden");
  } else {
    type.disabled = false;
  }
}

function detectQualifiedTypeFromUserHistory() {
  const userTexts = shiplusHistory
    .filter(m => m.role === "user")
    .map(m => m.content.toLowerCase());

  for (let i = userTexts.length - 1; i >= 0; i--) {
    const txt = userTexts[i];

    if (txt.includes("maritime") || txt.includes("mer")) {
      return "SEA";
    }

    if (txt.includes("aérien") || txt.includes("aerien") || txt.includes("air")) {
      return "AIR";
    }
  }

  return null;
}

function detectTypeFromAnswer(answer) {
  const lower = answer.toLowerCase();
  if (lower.includes("maritime")) return "SEA";
  if (lower.includes("aérien") || lower.includes("aerien")) return "AIR";
  return null;
}

function scrollShiplusToBottom() {
  if (shiplusMessages) {
    shiplusMessages.scrollTop = shiplusMessages.scrollHeight;
  }
}

async function sendToShiplus() {
  const text = shiplusInput.value.trim();
  if (!text) return;

  // Message utilisateur
  if (shiplusMessages) {
    shiplusMessages.innerHTML += `<p><strong>Vous :</strong> ${text}</p>`;
    scrollShiplusToBottom();
  }

  shiplusHistory.push({ role: "user", content: text });

  // Détection type
  const lowerText = text.toLowerCase();

  if (lowerText.includes("maritime") || lowerText.includes("mer")) {
    qualifiedShipmentType = "SEA";
  }

  if (lowerText.includes("aérien") || lowerText.includes("aerien") || lowerText.includes("air")) {
    qualifiedShipmentType = "AIR";
  }

  shiplusInput.value = "";

  try {
    const response = await fetch(SHIPLUS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        messages: shiplusHistory,
        language: "fr"
      })
    });

    const data = await response.json();

    if (data.error) {
      if (shiplusMessages) {
        shiplusMessages.innerHTML += `<p><strong>Shiplus :</strong> ${data.error}</p>`;
        scrollShiplusToBottom();
      }
      return;
    }

    let answer = "";

    if (data.answer) {
      answer = data.answer;
    } else if (data.generated_text) {
      answer = data.generated_text;
    } else if (
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      answer = data.choices[0].message.content;
    } else {
      answer = "Réponse brute : " + JSON.stringify(data);
    }

    answer = cleanShiplusAnswer(answer);

    // Message assistant
    if (shiplusMessages) {
      shiplusMessages.innerHTML += `<p><strong>Shiplus :</strong> ${answer.replace(/\n/g, "<br>")}</p>`;
      scrollShiplusToBottom();
    }

    shiplusHistory.push({ role: "assistant", content: answer });

    /* ===== VALIDATION READY ===== */
    if (answer.includes("STATUS: READY")) {
      const minimumCheck = checkMinimumRequirementsFromHistory();

      if (!minimumCheck.ok) {
        if (shiplusMessages) {
          shiplusMessages.innerHTML += `<p><strong>Système :</strong> ${minimumCheck.message}</p>`;
          scrollShiplusToBottom();
        }
        return;
      }

      const detectedType = detectQualifiedTypeFromUserHistory();
      if (detectedType) {
        qualifiedShipmentType = detectedType;
      }

      applyQualifiedType();
      document.getElementById("expedition").classList.remove("hidden");

      if (shiplusMessages) {
        shiplusMessages.innerHTML += `
          <p><strong>Tarifs estimatifs :</strong><br>
          📦 Marchandises normales : 225 000 FCFA / CBM<br>
          🏷️ Produits de marque : 235 000 FCFA / CBM<br>
          🪵 Bois / spécial : 250 000 FCFA / CBM<br><br>
          Les prix affichés sont basés sur les conditions standard.</p>

          <p style="font-size:12px; color:gray;">
          🔒 AfriShipPlus est une plateforme de mise en relation avec des agents cargo partenaires.
          Le transport et les instructions finales sont assurés directement par le cargo.
          </p>

          <p><strong>Système :</strong> Vous pouvez maintenant créer votre expédition ✅</p>
        `;
        scrollShiplusToBottom();
      }

      lockShiplusChat();
    }

  } catch (error) {
    if (shiplusMessages) {
      shiplusMessages.innerHTML += `<p><strong>Shiplus :</strong> Erreur de connexion à Shiplus.</p>`;
      scrollShiplusToBottom();
    }
  }
}


function checkMinimumRequirementsFromHistory() {
  const userTexts = shiplusHistory
    .filter(m => m.role === "user")
    .map(m => m.content.toLowerCase());

  let detectedType = null;
  let detectedKg = null;
  let detectedCbm = null;

  for (const txt of userTexts) {
    if (txt.includes("maritime") || txt.includes("mer")) {
      detectedType = "SEA";
    }

    if (txt.includes("aérien") || txt.includes("aerien") || txt.includes("air")) {
      detectedType = "AIR";
    }

    const kgMatch = txt.match(/(\d+(?:[.,]\d+)?)\s*kg/);
    if (kgMatch) {
      detectedKg = parseFloat(kgMatch[1].replace(",", "."));
    }

    const cbmMatch = txt.match(/(\d+(?:[.,]\d+)?)\s*cbm/);
    if (cbmMatch) {
      detectedCbm = parseFloat(cbmMatch[1].replace(",", "."));
    }
  }

  if (detectedType === "AIR" && detectedKg !== null && detectedKg < 10) {
    return {
      ok: false,
      message: "Le minimum pour une expédition aérienne est de 10 kg."
    };
  }

  if (detectedType === "SEA" && detectedCbm !== null && detectedCbm < 0.3) {
    return {
      ok: false,
      message: "Le minimum pour une expédition maritime est de 0.3 CBM."
    };
  }

  return { ok: true };
}

function resetShiplusFlow() {
  shiplusHistory = [
    {
      role: "assistant",
      content: "Bonjour, je suis Shiplus. Souhaitez-vous une expédition aérienne ou maritime ?"
    }
  ];

  qualifiedShipmentType = null;

  shiplusMessages.innerHTML =
    `<p><strong>Shiplus :</strong> Bonjour, je suis Shiplus. Souhaitez-vous une expédition aérienne ou maritime ?</p>`;

  scrollShiplusToBottom();
  shiplusInput.value = "";
  unlockShiplusChat();
  type.disabled = false;

  document.getElementById("expedition").classList.add("hidden");
  document.getElementById("result").innerHTML = "";
  document.getElementById("cargoContactBox").innerHTML = "";

  document.getElementById("name").value = "";
  document.getElementById("phone").value = "";
  document.getElementById("goods").value = "";
  document.getElementById("kg").value = "";
  document.getElementById("cbm").value = "";

  newRequestBtn.classList.add("hidden");
  showSection("assistant");
}

// CREATION EXPEDITION
async function createShipment() {
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const goods = document.getElementById("goods").value.trim();
  const t = type.value;
  const result = document.getElementById("result");
  const cargoContactBox = document.getElementById("cargoContactBox");

  result.innerHTML = "";
  cargoContactBox.innerHTML = "";

  if (!name || !phone || !goods) {
    result.innerHTML = "Remplis tous les champs.";
    return;
  }

/* ===== Vérification des produits interdits en aérien ===== */

  const goodsLower = goods.toLowerCase();

  const forbiddenAirKeywords = [
    "batterie",
    "lithium",
    "power bank",
    "powerbank",
    "pile",
    "batterie solaire"
  ];

  const isForbiddenAirItem = forbiddenAirKeywords.some(keyword =>
    goodsLower.includes(keyword)
  );

  if (t === "AIR" && isForbiddenAirItem) {
    result.innerHTML =
      "Les batteries et produits contenant du lithium ne sont pas acceptés en aérien à notre niveau. Veuillez choisir maritime.";
    return;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentShipments, error: countError } = await supabaseClient
    .from("shipments")
    .select("id, created_at")
    .eq("customer_phone", phone)
    .gte("created_at", sevenDaysAgo);

  if (countError) {
    result.innerHTML = "Erreur de vérification : " + countError.message;
    return;
  }

  if (recentShipments && recentShipments.length >= 3) {
    result.innerHTML = "Limite atteinte : vous avez déjà créé 3 expéditions sur les 7 derniers jours.";
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
      result.innerHTML = "Le minimum pour le maritime est de 0.3 CBM.";
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

  result.innerHTML =
    "Code : " + code +
    "<br>Votre demande a été enregistrée avec succès ✅" +
    "<br>Gardez ce code pour suivre votre expédition.";

  document.getElementById("trackCode").value = code;

/* ===== Génération du message WhatsApp ===== */

  const message =
    "Bonjour,%0A%0A" +
    "Je viens de AfriShipPlus.%0A" +
    "Code expédition : " + code + "%0A" +
    "Nom : " + name + "%0A" +
    "Nom du colis : " + goods + "%0A" +
    "Type : " + (t === "AIR" ? "Aérien" : "Maritime") + "%0A" +
    "Détail : " + quantity + " " + unit + "%0A%0A" +
    "Je souhaite finaliser cette expédition.";

  const waLink = "https://wa.me/" + agentPhone + "?text=" + message;

  cargoContactBox.innerHTML = `
    <button type="button" onclick="openCargoContact('${code}', '${agentName}', '${agentPhone}', '${waLink}')">
      Contacter le cargo
    </button>
  `;
  newRequestBtn.classList.remove("hidden");
}

async function openCargoContact(code, agentName, agentPhone, waLink) {
  const { error } = await supabaseClient
    .from("shipments")
    .update({
      contact_opened: true,
      contact_opened_at: new Date().toISOString(),
      contact_agent_name: agentName,
      contact_agent_phone: agentPhone,
      status: "CONTACTED"
    })
    .eq("code", code);

  console.log("CONTACT UPDATE ERROR:", error);

  if (error) {
    alert("Erreur contact cargo : " + error.message);
    return;
  }

  window.open(waLink, "_blank");
}
// CALCULATEUR
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

// TRACKING
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
