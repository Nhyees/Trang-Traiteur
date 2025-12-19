// panier.js
document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "siteTraiteur_panier_v1";

    const itemsEl = document.getElementById("commandeItems");
    const totalsEl = document.getElementById("commandeTotaux");
    const formEl = document.querySelector(".livraison-form");
    const hiddenJsonEl = document.getElementById("commandeJson");

    // ---------- Helpers ----------
    const formatCHF = (n) => `${Number(n).toFixed(2)} CHF`;

    function escapeHtml(str) {
        return String(str)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function loadCart() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : [];
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    }

    function calcDeliveryFee(subtotal) {
        if (subtotal <= 0) return 0;
        return subtotal < 100 ? 10 : 0;
    }

    function calcTotals(cart) {
        const subtotal = cart.reduce((sum, it) => sum + it.price * it.qty, 0);
        const delivery = calcDeliveryFee(subtotal);
        const total = subtotal + delivery;
        return { subtotal, delivery, total };
    }

    // ---------- Actions ----------
    function removeItem(id) {
        const cart = loadCart().filter((x) => x.id !== id);
        saveCart(cart);
        render();
    }

    function setQty(id, qty) {
        const cart = loadCart();
        const item = cart.find((x) => x.id === id);
        if (!item) return;

        const newQty = Math.max(0, parseInt(qty, 10) || 0);
        item.qty = newQty;

        // si qty = 0 -> on enlève l'article
        const cleaned = cart.filter((x) => x.qty > 0);
        saveCart(cleaned);
        render();
    }

    // (utile depuis les pages plats/entrées)
    function addItem({ id, name, price, qty }) {
        if (!id || !name) return;

        const p = Number(price);
        const q = parseInt(qty, 10);

        if (!Number.isFinite(p) || p <= 0) return;
        if (!Number.isFinite(q) || q <= 0) return;

        const cart = loadCart();
        const found = cart.find((x) => x.id === id);

        if (found) found.qty += q;
        else cart.push({ id, name, price: p, qty: q });

        saveCart(cart);
        render();
    }

    // ---------- Render ----------
    function render() {
        // Si on n'est pas sur la page commande, itemsEl/totalsEl n'existent pas => on sort.
        if (!itemsEl || !totalsEl) return;

        const cart = loadCart();

        // items
        itemsEl.innerHTML = "";
        if (cart.length === 0) {
            itemsEl.innerHTML = `<p style="margin:0;">(Panier vide)</p>`;
        } else {
            for (const item of cart) {
                const row = document.createElement("div");
                row.className = "commande-ligne";
                row.dataset.itemId = String(item.id);

                row.innerHTML = `
          <div class="commande-qte">
            <button type="button" class="btn-moins" aria-label="Diminuer la quantité">−</button>

            <input
              type="number"
              class="qte-commande"
              min="0"
              value="${item.qty}"
              aria-label="Quantité"
            />

            <button type="button" class="btn-plus" aria-label="Augmenter la quantité">+</button>
          </div>

          <div class="commande-nom">${escapeHtml(item.name)}</div>

          <button class="commande-supprimer" type="button" aria-label="Supprimer cet article">✖</button>

          <div class="commande-prix">${(item.price * item.qty).toFixed(2)}</div>
        `;

                // -
                row.querySelector(".btn-moins").addEventListener("click", () => {
                    setQty(item.id, item.qty - 1);
                });

                // +
                row.querySelector(".btn-plus").addEventListener("click", () => {
                    setQty(item.id, item.qty + 1);
                });

                // taper une quantité
                row.querySelector(".qte-commande").addEventListener("change", (e) => {
                    setQty(item.id, e.target.value);
                });

                // supprimer
                row.querySelector(".commande-supprimer").addEventListener("click", () => {
                    removeItem(item.id);
                });

                itemsEl.appendChild(row);
            }
        }

        // totals
        const { subtotal, delivery, total } = calcTotals(cart);
        totalsEl.innerHTML = `
      <hr class="commande-sep" />
      <div class="commande-totaux">
        <div class="ligne-total">
          <div class="label">Sous-total</div>
          <div class="valeur">${formatCHF(subtotal)}</div>
        </div>
        <div class="ligne-total">
          <div class="label">Frais de livraison</div>
          <div class="valeur">${formatCHF(delivery)}</div>
        </div>
        <div class="ligne-total total-final">
          <div class="label">Total</div>
          <div class="valeur">${formatCHF(total)}</div>
        </div>
      </div>
    `;
    }

    // ---------- Form submit ----------
    if (formEl) {
        formEl.addEventListener("submit", (e) => {
            e.preventDefault(); // ⛔ empêche le rechargement

            const cart = loadCart();
            if (cart.length === 0) {
                alert("Votre panier est vide. Ajoutez au moins un article.");
                return;
            }

            const dateLiv = document.getElementById("dateLivraison")?.value || "";
            const heureLiv = document.getElementById("heureLivraison")?.value || "";
            const message = document.getElementById("messageClient")?.value || "";

            const totals = calcTotals(cart);

            const payload = {
                createdAt: new Date().toISOString(),
                currency: "CHF",
                livraison: {
                    date: dateLiv,
                    heure: heureLiv,
                    message: message
                },
                items: cart,
                totals
            };

            // stocke la commande (temporaire, pour debug)
            console.log("📦 COMMANDE ENVOYÉE :", payload);

            if (hiddenJsonEl) {
                hiddenJsonEl.value = JSON.stringify(payload);
            }

            // ✅ message de confirmation
            const confirmation = document.getElementById("confirmationMessage");
            if (confirmation) confirmation.style.display = "block";

            // ✅ optionnel : vider le panier APRÈS confirmation
            localStorage.removeItem("siteTraiteur_panier_v1");
            render();

            // optionnel : reset formulaire
            formEl.reset();
        });
    }


    // ---------- Pages menu : boutons "Ajouter au panier" ----------
    document.querySelectorAll(".btn-ajouter").forEach((btn) => {
        btn.addEventListener("click", () => {
            const article = btn.closest("article");
            if (!article) return;

            const id = article.dataset.id;
            const name = article.dataset.name;
            const price = Number(article.dataset.price);

            const qteInput = article.querySelector(".qte");
            const qty = qteInput ? parseInt(qteInput.value, 10) : 1;

            if (!id || !name || !Number.isFinite(price) || price <= 0) {
                alert("Prix ou informations manquantes pour cet article.");
                return;
            }

            addItem({ id, name, price, qty });

            btn.textContent = "Ajouté ✓";
            btn.disabled = true;
            setTimeout(() => {
                btn.textContent = "Ajouter au panier";
                btn.disabled = false;
            }, 800);
        });
    });

    // ---------- Init ----------
    render();

    // pour tester vite dans la console
    window.TraiteurCart = { loadCart, saveCart, addItem, removeItem, setQty, render };
});

