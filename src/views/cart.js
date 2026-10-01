/* AURYX — Carrito. Depende de: utils/format.js. */

/* ---------------------------------------------------------------------- */
/* CARRITO                                                                  */
/* ---------------------------------------------------------------------- */
function renderCart(state) {
  const cart = state.cart;
  if (cart.length === 0) {
    return `
    <div class="max-w-2xl mx-auto px-5 py-24 text-center">
      ${iconTag("shopping-cart", 32, "--line")}
      <h1 class="sf-display text-2xl font-semibold mb-2 mt-4">Tu carrito está vacío</h1>
      <p class="text-sm mb-6" style="color:var(--text-mid)">Agregá productos individuales o armá un sistema completo desde el configurador.</p>
      <a href="#store" class="sf-btn-primary px-5 py-2.5 inline-block">Ver productos</a>
    </div>`;
  }

  const totalARS = cart.reduce((s, it) => s + it.product.priceARS * it.qty, 0);
  const totalUSD = cart.reduce((s, it) => s + it.product.priceUSD * it.qty, 0);

  const groups = {};
  cart.forEach((it, idx) => {
    const key = it.systemId || "individual";
    (groups[key] = groups[key] || []).push({ ...it, idx });
  });

  const groupsHTML = Object.entries(groups).map(([key, items]) => `
    <div>
      ${key !== "individual" ? `<p class="sf-mono text-xs mb-3" style="color:var(--text-dim)">SISTEMA CONFIGURADO</p>` : ""}
      <div class="space-y-3">
        ${items.map(({ product, qty, idx }) => `
          <div class="sf-card p-4 flex items-center justify-between gap-4">
            <div><p class="font-medium">${product.name}</p><p class="text-xs" style="color:var(--text-dim)">${product.brand}</p></div>
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2">
                <button onclick="App.cartQtyStep(${idx}, -1)" class="sf-btn-outline p-1.5">${iconTag("minus", 13)}</button>
                <span class="w-6 text-center sf-mono text-sm">${qty}</span>
                <button onclick="App.cartQtyStep(${idx}, 1)" class="sf-btn-outline p-1.5">${iconTag("plus", 13)}</button>
              </div>
              ${priceTagHTML(product, state.currency)}
              <button onclick="App.cartRemove(${idx})" style="color:var(--bad)">${iconTag("trash-2", 16)}</button>
            </div>
          </div>`).join("")}
      </div>
    </div>`).join("");

  return `
  <div class="max-w-3xl mx-auto px-5 py-12">
    <h1 class="sf-display text-3xl font-semibold mb-8">Tu carrito</h1>
    <div class="space-y-8">${groupsHTML}</div>
    <div class="sf-card p-6 mt-8 flex justify-between items-center">
      <span class="font-semibold">Total</span>
      ${priceTagHTML({ priceARS: totalARS, priceUSD: totalUSD }, state.currency, "lg")}
    </div>
    <button class="sf-btn-primary w-full py-3.5 mt-4 font-semibold">Solicitar cotización</button>
    <p class="text-xs text-center mt-3" style="color:var(--text-dim)">Esta primera versión no procesa pagos: te contactamos para coordinar la compra.</p>
  </div>`;
}
