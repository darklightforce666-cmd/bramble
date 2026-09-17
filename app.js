const RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
const CHAIN_ID_HEX = "0x1237";

const state = {
  block: null,
  gasPrice: null,
  wallet: null,
  activeStep: 1,
  marketSort: "depth",
  selectedMarket: "orbit",
};

const markets = [
  { id: "orbit", name: "Orbit", symbol: "ORB", path: "BRAM → ORB", layer: "L1", depth: 1, liquidity: 412, holders: 2148, fee: .4, curve: 64, quote: "BRAM", age: 42, color: "#ccff33" },
  { id: "frame", name: "Frame", symbol: "FRM", path: "BRAM → FRM", layer: "L1", depth: 1, liquidity: 286, holders: 1337, fee: .35, curve: 51, quote: "BRAM", age: 28, color: "#87a7ff" },
  { id: "heath", name: "Heath", symbol: "HTH", path: "BRAM → HTH", layer: "L1", depth: 1, liquidity: 198, holders: 984, fee: .5, curve: 39, quote: "BRAM", age: 19, color: "#ff874d" },
  { id: "relay", name: "Relay", symbol: "RLY", path: "BRAM → ORB → RLY", layer: "L2", depth: 2, liquidity: 96, holders: 642, fee: .45, curve: 72, quote: "ORB", age: 15, color: "#d7c8ff" },
  { id: "plume", name: "Plume", symbol: "PLM", path: "BRAM → HTH → PLM", layer: "L2", depth: 2, liquidity: 74, holders: 418, fee: .6, curve: 47, quote: "HTH", age: 11, color: "#ffd37a" },
  { id: "axis", name: "Axis", symbol: "AXS", path: "BRAM → FRM → AXS", layer: "L2", depth: 2, liquidity: 61, holders: 307, fee: .4, curve: 33, quote: "FRM", age: 8, color: "#8ce8d2" },
  { id: "needle", name: "Needle", symbol: "NDL", path: "BRAM → ORB → RLY → NDL", layer: "L3", depth: 3, liquidity: 22, holders: 141, fee: .7, curve: 28, quote: "RLY", age: 3, color: "#f4a7c3" },
];

const views = [...document.querySelectorAll("[data-view-panel]")];
const navLinks = [...document.querySelectorAll("[data-view]")];
const toast = document.querySelector("#toast");

function formatCompact(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 3400);
}

function showView(name) {
  views.forEach((view) => view.classList.toggle("is-active", view.dataset.viewPanel === name));
  navLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.view === name));
  window.location.hash = name;
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "activity") refreshActivity();
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-view], [data-go]");
  if (!trigger) return;
  showView(trigger.dataset.view || trigger.dataset.go);
});

document.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-go]")) {
    event.preventDefault();
    showView(event.target.dataset.go);
  }
});

async function rpc(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  if (!response.ok) throw new Error(`RPC ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}

async function refreshNetwork() {
  const dot = document.querySelector("#networkDot");
  try {
    const [blockHex, gasHex] = await Promise.all([rpc("eth_blockNumber"), rpc("eth_gasPrice")]);
    state.block = Number.parseInt(blockHex, 16);
    state.gasPrice = Number.parseInt(gasHex, 16) / 1e9;
    document.querySelector("#blockNumber").textContent = formatCompact(state.block);
    document.querySelector("#gasPrice").textContent = `${state.gasPrice.toFixed(3)} GWEI`;
    document.querySelector("#networkHeight").textContent = `#${state.block.toLocaleString("en")}`;
    document.querySelector("#activityBlock").textContent = `#${state.block.toLocaleString("en")}`;
    document.querySelector("#activityGas").textContent = `${state.gasPrice.toFixed(3)} GWEI`;
    dot.classList.remove("is-offline");
    if (document.querySelector('[data-view-panel="activity"]').classList.contains("is-active")) refreshActivity();
  } catch (error) {
    dot.classList.add("is-offline");
    document.querySelector("#networkHeight").textContent = "RPC PAUSED";
    document.querySelector("#blockNumber").textContent = "—";
    document.querySelector("#gasPrice").textContent = "—";
  }
}

function renderMarkets() {
  const query = document.querySelector("#marketSearch").value.trim().toLowerCase();
  const rows = [...markets]
    .filter((market) => `${market.name} ${market.symbol} ${market.path}`.toLowerCase().includes(query))
    .sort((a, b) => {
      if (state.marketSort === "liquidity") return b.liquidity - a.liquidity;
      if (state.marketSort === "newest") return a.age - b.age;
      return b.depth - a.depth || b.liquidity - a.liquidity;
    });

  const list = document.querySelector("#marketList");
  if (!rows.length) {
    list.innerHTML = '<div class="registry-empty">No market matches that search.</div>';
    return;
  }

  list.innerHTML = rows.map((market) => `
    <article class="market-row ${market.id === state.selectedMarket ? "is-selected" : ""}" data-market-id="${market.id}" tabindex="0">
      <div class="market-identity">
        <span class="token-icon" style="--token-color:${market.color}">${market.symbol.slice(0, 2)}</span>
        <span><b>${market.name} / ${market.symbol}</b><small>${market.path}</small></span>
      </div>
      <span class="row-layer">${market.layer}</span>
      <span class="row-stat"><small>Liquidity</small><strong>${market.liquidity} ETH</strong></span>
      <span class="row-stat"><small>Holders</small><strong>${market.holders.toLocaleString("en")}</strong></span>
      <span class="row-arrow">↗</span>
    </article>`).join("");
}

function selectMarket(id) {
  const market = markets.find((item) => item.id === id);
  if (!market) return;
  state.selectedMarket = market.id;
  document.querySelector("#selectedMarketName").textContent = `${market.name} / ${market.symbol}`;
  document.querySelector("#selectedMarketPath").textContent = market.path;
  document.querySelector("#selectedCurve").textContent = `${market.curve}%`;
  document.querySelector("#selectedQuote").textContent = market.quote;
  document.querySelector("#selectedLiquidity").textContent = `${market.liquidity} ETH`;
  document.querySelector("#selectedHolders").textContent = market.holders.toLocaleString("en");
  document.querySelector("#selectedFee").textContent = `${market.fee.toFixed(2)}%`;
  renderMarkets();
}

document.querySelector("#marketSearch").addEventListener("input", renderMarkets);
document.querySelectorAll("[data-sort]").forEach((button) => button.addEventListener("click", () => {
  state.marketSort = button.dataset.sort;
  document.querySelectorAll("[data-sort]").forEach((item) => item.classList.toggle("is-active", item === button));
  renderMarkets();
}));
document.querySelector("#marketList").addEventListener("click", (event) => {
  const row = event.target.closest("[data-market-id]");
  if (row) selectMarket(row.dataset.marketId);
});
document.querySelector("#marketList").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-market-id]")) selectMarket(event.target.dataset.marketId);
});
document.querySelector("#openMarketButton").addEventListener("click", () => showToast("Market contracts are in preview mode until the Bramble factory address is configured."));

async function refreshActivity() {
  const container = document.querySelector("#blockRows");
  if (!state.block) {
    container.innerHTML = '<div class="loading-row">Waiting for Robinhood Chain…</div>';
    return;
  }
  try {
    const heights = Array.from({ length: 7 }, (_, index) => state.block - index);
    const blocks = await Promise.all(heights.map((height) => rpc("eth_getBlockByNumber", [`0x${height.toString(16)}`, false])));
    container.innerHTML = blocks.map((block) => {
      const number = Number.parseInt(block.number, 16);
      const transactions = block.transactions?.length || 0;
      const gasUsed = Number.parseInt(block.gasUsed, 16);
      const when = new Date(Number.parseInt(block.timestamp, 16) * 1000);
      return `<a class="block-row" href="https://robinhoodchain.blockscout.com/block/${number}" target="_blank" rel="noreferrer">
        <b>#${number.toLocaleString("en")}</b>
        <span><small>TRANSACTIONS</small><strong>${transactions.toLocaleString("en")}</strong></span>
        <span class="block-time"><small>TIME</small><strong>${when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong></span>
        <span><small>GAS USED</small><strong>${formatCompact(gasUsed)}</strong></span>
        <span>↗</span>
      </a>`;
    }).join("");
  } catch (error) {
    container.innerHTML = '<div class="loading-row">The public RPC is rate-limited right now. Try the explorer ↗</div>';
  }
}

function setStep(step) {
  state.activeStep = Math.max(1, Math.min(4, step));
  document.querySelectorAll("[data-step]").forEach((panel) => panel.classList.toggle("is-active", Number(panel.dataset.step) === state.activeStep));
  document.querySelectorAll("[data-step-target]").forEach((button) => {
    const target = Number(button.dataset.stepTarget);
    button.classList.toggle("is-active", target === state.activeStep);
    button.classList.toggle("is-complete", target < state.activeStep);
  });
  document.querySelector("#backStep").disabled = state.activeStep === 1;
  document.querySelector("#nextStep").innerHTML = state.activeStep === 4 ? 'Connect to deploy <span>↗</span>' : 'Continue <span>↗</span>';
  updateLaunchPreview();
}

function splitTotal(form) {
  return ["liquidity", "holders", "parentHolders", "protocol"].reduce((sum, key) => sum + Number(form.elements[key].value || 0), 0);
}

function updateLaunchPreview() {
  const form = document.querySelector("#launchForm");
  const data = new FormData(form);
  const name = String(data.get("name") || "Untitled asset");
  const symbol = String(data.get("symbol") || "—").toUpperCase();
  const parent = String(data.get("parent") || "ETH");
  const fee = Number(data.get("fee") || 0) / 100;
  const supply = Number(data.get("supply") || 0);
  document.querySelector("#previewMonogram").textContent = symbol.slice(0, 2) || "—";
  document.querySelector("#previewName").textContent = name;
  document.querySelector("#previewSymbol").textContent = symbol;
  document.querySelector("#previewSupply").textContent = supply ? formatCompact(supply) : "—";
  document.querySelector("#previewParent").textContent = parent;
  document.querySelector("#previewLayer").textContent = parent === "ETH" ? "ROOT" : parent === "BRAM" ? "L1" : "L2";
  document.querySelector("#previewTarget").textContent = `${data.get("target") || 250} ETH`;
  document.querySelector("#previewFee").textContent = `${fee.toFixed(2)}%`;
  document.querySelector("#feeOutput").textContent = `${fee.toFixed(2)}%`;
  document.querySelector("#reviewToken").textContent = `${name} / ${symbol}`;
  document.querySelector("#reviewMarket").textContent = `${parent === "ETH" ? "ROOT" : "CHILD"} · quoted in ${parent}`;

  const total = splitTotal(form);
  const message = document.querySelector("#splitMessage");
  message.textContent = total === 100 ? "Split totals 100%." : `Split totals ${total}%. Adjust to 100%.`;
  message.classList.toggle("is-error", total !== 100);
  ["liquidity", "holders", "parentHolders", "protocol"].forEach((key) => {
    form.elements[key].closest("label").querySelector("i").style.setProperty("--share", `${Math.min(100, Number(form.elements[key].value || 0))}%`);
  });
}

document.querySelectorAll("[data-step-target]").forEach((button) => button.addEventListener("click", () => setStep(Number(button.dataset.stepTarget))));
document.querySelector("#backStep").addEventListener("click", () => setStep(state.activeStep - 1));
document.querySelector("#nextStep").addEventListener("click", () => {
  const form = document.querySelector("#launchForm");
  if (state.activeStep === 1 && !form.reportValidity()) return;
  if (state.activeStep === 3 && splitTotal(form) !== 100) {
    showToast("Fee recipients must total 100% before review.");
    return;
  }
  if (state.activeStep < 4) setStep(state.activeStep + 1);
  else connectWallet();
});
document.querySelector("#launchForm").addEventListener("input", updateLaunchPreview);

async function connectWallet() {
  const button = document.querySelector("#walletButton");
  if (!window.ethereum) {
    showToast("No EVM wallet found. Install Robinhood Wallet or another compatible wallet to continue.");
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CHAIN_ID_HEX,
        chainName: "Robinhood Chain",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: [RPC_URL],
        blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
      }],
    });
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    state.wallet = accounts[0];
    button.querySelector("span:first-child").textContent = `${state.wallet.slice(0, 6)}…${state.wallet.slice(-4)}`;
    showToast("Wallet connected to Robinhood Chain.");
  } catch (error) {
    showToast(error?.message || "Wallet connection was cancelled.");
  }
}

document.querySelector("#walletButton").addEventListener("click", connectWallet);

const initialView = window.location.hash.replace("#", "");
if (views.some((view) => view.dataset.viewPanel === initialView)) showView(initialView);
window.addEventListener("hashchange", () => {
  const nextView = window.location.hash.replace("#", "");
  if (views.some((view) => view.dataset.viewPanel === nextView) && !document.querySelector(`[data-view-panel="${nextView}"]`).classList.contains("is-active")) {
    showView(nextView);
  }
});

refreshNetwork();
window.setInterval(refreshNetwork, 12000);
renderMarkets();
updateLaunchPreview();

