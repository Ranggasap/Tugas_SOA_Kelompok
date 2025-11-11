// public/js/home.js - Client-side JavaScript for Home Page

let currentProducts = [];
let allProducts = [];

// Load products from API
async function loadProductsFromAPI() {
  const productGrid = document.getElementById("productGrid");

  try {
    console.log("Loading products from API...");

    const response = await fetch("/api/products");
    const result = await response.json();

    if (result.success) {
      allProducts = result.data;
      console.log("Total products loaded:", allProducts.length);
      currentProducts = [...allProducts];
      renderProducts(currentProducts);
    } else {
      showErrorState("Gagal memuat produk dari database");
    }
  } catch (error) {
    console.error("Error loading products:", error);
    showErrorState("Tidak dapat terhubung ke database");
  }
}

// Render products with enhanced animations
function renderProducts(products) {
  const productGrid = document.getElementById("productGrid");
  productGrid.innerHTML = "";

  if (products.length === 0) {
    productGrid.innerHTML = `
      <div class="col-12 text-center py-5">
        <div class="alert-error">
          <i class="fas fa-search mb-3" style="font-size: 3rem;"></i>
          <h5>Tidak ada produk ditemukan</h5>
          <p class="mb-0">Coba gunakan kata kunci pencarian yang berbeda atau refresh halaman</p>
        </div>
      </div>
    `;
    return;
  }

  products.forEach((product, index) => {
    const col = document.createElement("div");
    col.className = "col-xl-4 col-lg-6 col-md-6 mb-4";
    col.style.animationDelay = `${index * 0.1}s`;
    col.innerHTML = `
      <div class="product-card h-100 animate-in" onclick="showProductModal('${product.id}')">
        <div class="product-badge">Premium</div>
        <img src="${product.image}" 
             class="product-img" 
             alt="${product.name}" 
             onerror="this.src='https://via.placeholder.com/400x300/556B2F/ffffff?text=Bunga'">
        <h5 class="product-title">${product.name}</h5>
        <div class="price-tag">Rp ${product.price.toLocaleString("id-ID")}</div>
        <p class="product-desc">${product.description.length > 100 ? product.description.substring(0, 100) + "..." : product.description}</p>
        <div class="mt-auto">
          <div class="rating mb-2">
            <i class="fas fa-star"></i>
            <i class="fas fa-star"></i>
            <i class="fas fa-star"></i>
            <i class="fas fa-star"></i>
            <i class="fas fa-star"></i>
            <span class="ms-1">(4.9)</span>
          </div>
          <small class="text-success">
            <i class="fas fa-shipping-fast me-1"></i>Pengiriman Cepat
          </small>
        </div>
      </div>
    `;
    productGrid.appendChild(col);
  });
}

// Show product modal
function showProductModal(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  document.getElementById("modalName").innerHTML = `<i class="fas fa-flower me-2"></i>${product.name}`;
  document.getElementById("modalDesc").textContent = product.description;
  document.getElementById("modalPrice").textContent = `Rp ${product.price.toLocaleString("id-ID")}`;
  document.getElementById("modalImg").src = product.image;

  document.getElementById("addToCartBtn").onclick = () => {
    addToCart(product);
  };

  new bootstrap.Modal(document.getElementById("productModal")).show();
}

// Add to cart
async function addToCart(product) {
  const formBody = new URLSearchParams({
    idProduct: product.id,
    productName: product.name,
    productPrice: product.price,
    qty: 1,
  }).toString();

  try {
    const response = await fetch("/cart/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody,
    });

    if (response.ok) {
      let cartCountElem = document.getElementById("cartCount");
      let currentCount = parseInt(cartCountElem.textContent, 10);
      if (isNaN(currentCount)) currentCount = 0;
      cartCountElem.textContent = currentCount + 1;
      showSuccessToast(`${product.name} berhasil ditambahkan ke keranjang!`);
      bootstrap.Modal.getInstance(document.getElementById("productModal")).hide();
    } else {
      const msg = await response.text();
      alert("Gagal menambahkan ke keranjang: " + msg);
    }
  } catch (error) {
    console.error("Error adding to cart:", error);
    alert("Terjadi kesalahan saat menambahkan ke keranjang.");
  }
}

// Search functionality
function performSearch() {
  const keyword = document.getElementById("mainSearch").value.toLowerCase().trim();
  filterProducts(keyword);
}

function filterProducts(keyword) {
  if (!keyword) {
    currentProducts = [...allProducts];
  } else {
    currentProducts = allProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(keyword) ||
        product.description.toLowerCase().includes(keyword)
    );
  }
  renderProducts(currentProducts);
}

// Show success toast
function showSuccessToast(message) {
  document.getElementById("toastMessage").textContent = message;
  const toast = new bootstrap.Toast(document.getElementById("successToast"));
  toast.show();
}

// Show error state
function showErrorState(message) {
  const productGrid = document.getElementById("productGrid");
  productGrid.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="alert-error">
        <i class="fas fa-exclamation-triangle mb-3" style="font-size: 3rem;"></i>
        <h5>Terjadi Kesalahan</h5>
        <p class="mb-3">${message}</p>
        <button class="btn btn-custom" onclick="location.reload()">
          <i class="fas fa-refresh me-2"></i>Coba Lagi
        </button>
      </div>
    </div>
  `;
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  // Load products on page load
  loadProductsFromAPI();

  // Search button click
  document.getElementById("searchBtn").addEventListener("click", performSearch);

  // Search on input (real-time)
  document.getElementById("mainSearch").addEventListener("input", (e) => {
    const keyword = e.target.value.toLowerCase().trim();
    if (keyword === "") {
      currentProducts = [...allProducts];
      renderProducts(currentProducts);
    }
  });

  // Enter key support for search
  document.getElementById("mainSearch").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      performSearch();
    }
  });
});