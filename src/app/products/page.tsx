"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  product_id: string;
  category: string;
  product_name: string;
  price: number;
  gst_rate: number;
  available_quantity: number;
  image_url: string | null;
  is_visible: boolean;
  created_at: string;
};

type CartItem = Product & {
  cart_quantity: number;
};

type IconProps = {
  className?: string;
};

export default function CustomerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [showProfile, setShowProfile] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  useEffect(() => {
    void loadProducts();
    loadSavedCart();
    const savedUser =
      localStorage.getItem("user");

    if (savedUser) {
      try {
        setCustomerProfile(
          JSON.parse(savedUser)
        );
      } catch { }
    }
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("products")
      .select("*")
      .eq("is_visible", true)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setProducts([]);
    } else {
      setProducts((data ?? []) as Product[]);
    }

    setLoading(false);
  }

  function loadSavedCart() {
    const savedCart = localStorage.getItem("customer_cart");

    if (!savedCart) {
      return;
    }

    try {
      const parsedCart = JSON.parse(savedCart) as CartItem[];
      setCart(parsedCart);
    } catch {
      localStorage.removeItem("customer_cart");
    }
  }

  const categories = useMemo(() => {
    const validCategories = products
      .map((product) => product.category?.trim())
      .filter((item): item is string => Boolean(item));

    return Array.from(new Set(validCategories)).sort();
  }, [products]);

  const priceCeiling = useMemo(() => {
    if (products.length === 0) {
      return 10000;
    }

    const highestPrice = Math.max(
      ...products.map((product) => Number(product.price))
    );

    return Math.max(
      1000,
      Math.ceil(highestPrice / 1000) * 1000
    );
  }, [products]);

  useEffect(() => {
    setMaxPrice(priceCeiling);
  }, [priceCeiling]);

  const filteredProducts = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return products.filter((product) => {
      const productPrice = Number(product.price);

      const matchesSearch =
        searchValue === "" ||
        product.product_name
          .toLowerCase()
          .includes(searchValue) ||
        product.category
          .toLowerCase()
          .includes(searchValue) ||
        product.product_id
          .toLowerCase()
          .includes(searchValue);

      const matchesCategory =
        category === "ALL" ||
        product.category === category;

      const matchesPrice =
        productPrice >= minPrice &&
        productPrice <= maxPrice;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesPrice
      );
    });
  }, [
    products,
    search,
    category,
    minPrice,
    maxPrice,
  ]);

  function addToCart(product: Product) {
    if (product.available_quantity <= 0) {
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (item) =>
          item.product_id === product.product_id
      );

      if (
        existingItem &&
        existingItem.cart_quantity >=
        product.available_quantity
      ) {
        return currentCart;
      }

      const updatedCart = existingItem
        ? currentCart.map((item) =>
          item.product_id === product.product_id
            ? {
              ...item,
              cart_quantity:
                item.cart_quantity + 1,
            }
            : item
        )
        : [
          ...currentCart,
          {
            ...product,
            cart_quantity: 1,
          },
        ];

      localStorage.setItem(
        "customer_cart",
        JSON.stringify(updatedCart)
      );

      return updatedCart;
    });
  }

  const cartCount = cart.reduce(
    (total, item) =>
      total + item.cart_quantity,
    0
  );

  function clearFilters() {
    setSearch("");
    setCategory("ALL");
    setMinPrice(0);
    setMaxPrice(priceCeiling);
  }

  return (
    <main className="h-screen overflow-y-auto bg-[#f3f7f9] text-[#101828]">
      <CustomerHeader
        search={search}
        setSearch={setSearch}
        cartCount={cartCount}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        setShowProfile={setShowProfile}
      />

      <div className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-7 sm:px-6 lg:px-8">
        <HeroSection />

        <section
          id="catalogue"
          className="mt-9"
        >
          <p className="text-xs font-semibold text-[#009b8c]">
            Explore the collection
          </p>

          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-[#101828]">
                Product catalogue
              </h1>

              <p className="mt-1 text-[13px] text-[#667085]">
                Quality sanitary and bathroom products
                for every space.
              </p>
            </div>

            <p className="text-xs font-medium text-[#667085]">
              {filteredProducts.length} products
            </p>
          </div>
        </section>

        <ProductFilters
          categories={categories}
          selectedCategory={category}
          setSelectedCategory={setCategory}
          minPrice={minPrice}
          setMinPrice={setMinPrice}
          maxPrice={maxPrice}
          setMaxPrice={setMaxPrice}
          priceCeiling={priceCeiling}
        />

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <ProductSkeleton />
        ) : filteredProducts.length === 0 ? (
          <EmptyState onClear={clearFilters} />
        ) : (
          <section className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.product_id}
                product={product}
                cart={cart}
                onAdd={addToCart}
              />
            ))}
          </section>
        )}
      </div>
      {showProfile && customerProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">

          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">

            <div className="flex items-center justify-between">

              <h2 className="text-[22px] font-semibold text-[#101828]">
                My Profile
              </h2>

              <button
                onClick={() =>
                  setShowProfile(false)
                }
                className="text-[#667085]"
              >
                ✕
              </button>

            </div>

            <div className="mt-6 space-y-4">

              <ProfileRow
                label="Customer ID"
                value={customerProfile.user_id}
              />

              <ProfileRow
                label="Name"
                value={customerProfile.name}
              />

              <ProfileRow
                label="Phone"
                value={customerProfile.phone}
              />

              <ProfileRow
                label="Address"
                value={customerProfile.address}
              />

              <ProfileRow
                label="Role"
                value={customerProfile.role}
              />

              <ProfileRow
                label="Account Status"
                value={
                  customerProfile.is_active
                    ? "Active"
                    : "Inactive"
                }
              />

            </div>

          </div>

        </div>
      )}
    </main>
  );
}

function CustomerHeader({
  search,
  setSearch,
  cartCount,
  mobileMenuOpen,
  setMobileMenuOpen,
  setShowProfile,
}: {
  search: string;
  setSearch: (value: string) => void;
  cartCount: number;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (value: boolean) => void;
  setShowProfile: (value: boolean) => void;
}) {

  return (
    <header className="sticky top-0 z-40 border-b border-[#e7ecef] bg-white/95 shadow-[0_1px_4px_rgba(16,24,40,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link href="/products" className="flex shrink-0 items-center gap-3">
          <img src="/SE_logo.png" alt="Logo" className="w-10 h-10" />

          <span className="hidden text-[15px] font-semibold text-[#101828] sm:block">
            Shankar Enterprises
          </span>
        </Link>

        <div className="relative hidden flex-1 md:block">
          <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />

          <input
            type="search"
            placeholder="Search sanitary products"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="w-full rounded-xl border border-transparent bg-[#f7f9fa] py-3 pl-11 pr-4 text-[13px] text-[#101828] outline-none placeholder:text-[#98a2b3] focus:border-[#9ddbd4] focus:bg-white focus:ring-4 focus:ring-[#e5f7f4]"
          />
        </div>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          <NavigationLink href="/products" active>
            Home
          </NavigationLink>

          <NavigationLink href="/orders">
            Orders
          </NavigationLink>
        </nav>

        <Link href="/cart" aria-label="Shopping cart" className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[#101828] hover:bg-[#f4f7f7]">
          <CartIcon className="h-5 w-5" />

          {cartCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#009d8b] px-1 text-[9px] font-bold text-white">
              {cartCount > 99
                ? "99+"
                : cartCount}
            </span>
          )}
        </Link>

        <button
          type="button"
          aria-label="Customer profile"
          onClick={() =>
            setShowProfile(true)
          }
          className="hidden h-10 w-10 items-center justify-center rounded-xl text-[#101828] transition hover:bg-[#f4f7f7] sm:flex"
        >
          <UserIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() =>
            setMobileMenuOpen(!mobileMenuOpen)
          }
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[#101828] hover:bg-[#f4f7f7] lg:hidden"
        >
          {mobileMenuOpen ? (
            <CloseIcon className="h-5 w-5" />
          ) : (
            <MenuIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="border-t border-[#edf1f2] px-4 py-3 md:hidden">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />

          <input
            type="search"
            placeholder="Search products"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="w-full rounded-xl border border-[#e1e7ea] bg-[#f8fafb] py-3 pl-11 pr-4 text-[13px] text-[#101828] outline-none placeholder:text-[#98a2b3] focus:border-[#9ddbd4] focus:bg-white"
          />
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="grid gap-1 border-t border-[#edf1f2] bg-white px-4 py-3 lg:hidden">
          <MobileNavigationLink href="/products">
            Home
          </MobileNavigationLink>

          <MobileNavigationLink href="/orders">
            Orders
          </MobileNavigationLink>
          <MobileNavigationLink href="/cart">
            Cart
          </MobileNavigationLink>
        </nav>
      )}
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-[310px] overflow-hidden rounded-[26px] bg-[#151d2d] shadow-[0_16px_40px_rgba(16,24,40,0.16)] sm:min-h-[330px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(42,148,244,0.34),transparent_34%),radial-gradient(circle_at_68%_86%,rgba(0,169,153,0.28),transparent_33%),linear-gradient(115deg,#101828_0%,#1b2942_56%,#284968_100%)]" />

      <div className="absolute right-[9%] top-[12%] h-[76%] w-[34%] rotate-6 rounded-[60px] border border-white/10 bg-white/[0.055] shadow-2xl backdrop-blur-sm" />

      <div className="absolute right-[16%] top-[24%] h-[52%] w-[18%] -rotate-6 rounded-[46px] border border-white/10 bg-white/[0.06]" />

      <div className="relative z-10 flex min-h-[310px] max-w-[700px] flex-col justify-center px-7 py-10 sm:min-h-[330px] sm:px-11 lg:px-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#77e4d8]">
          Sankar spotlight
        </p>

        <h2 className="mt-4 text-[35px] font-semibold leading-[1.07] tracking-[-0.045em] text-white sm:text-[46px]">
          Premium bathroom solutions for modern
          spaces
        </h2>

        <p className="mt-4 max-w-lg text-[13px] leading-6 text-white/70">
          Explore quality basins, taps, fittings
          and sanitary essentials selected for
          lasting everyday use.
        </p>

        <Link
          href="/products"
          className="mt-7 inline-flex items-center gap-2 self-start rounded-full bg-[#77e4d8] px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#101828] transition hover:bg-[#9bece3]"
        >
          Explore products
          <ArrowIcon className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function ProductFilters({
  categories,
  selectedCategory,
  setSelectedCategory,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  priceCeiling,
}: {
  categories: string[];
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  minPrice: number;
  setMinPrice: (value: number) => void;
  maxPrice: number;
  setMaxPrice: (value: number) => void;
  priceCeiling: number;
}) {
  return (
    <section className="mt-6 rounded-[20px] border border-[#e1e7ea] bg-white p-5 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <label>
          <span className="mb-2 block text-[11px] font-semibold text-[#344054]">
            Category
          </span>

          <select
            value={selectedCategory}
            onChange={(event) =>
              setSelectedCategory(
                event.target.value
              )
            }
            className={controlClass}
          >
            <option value="ALL">
              All categories
            </option>

            {categories.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>
        </label>

        <RangeFilter
          label="Minimum price"
          value={minPrice}
          maximum={priceCeiling}
          onChange={(value) =>
            setMinPrice(
              Math.min(value, maxPrice)
            )
          }
        />

        <RangeFilter
          label="Maximum price"
          value={maxPrice}
          maximum={priceCeiling}
          onChange={(value) =>
            setMaxPrice(
              Math.max(value, minPrice)
            )
          }
        />
      </div>
    </section>
  );
}

function RangeFilter({
  label,
  value,
  maximum,
  onChange,
}: {
  label: string;
  value: number;
  maximum: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-[11px] font-semibold text-[#344054]">
        {label}
      </span>

      <input
        type="range"
        min="0"
        max={maximum}
        step="100"
        value={value}
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
        className="mt-2 w-full accent-[#009d8b]"
      />

      <div className="mt-2 flex justify-between text-[10px] font-medium text-[#667085]">
        <span>₹0</span>

        <span>
          ₹{value.toLocaleString("en-IN")}
        </span>
      </div>
    </label>
  );
}

function ProductCard({
  product,
  cart,
  onAdd,
}: {
  product: Product;
  cart: CartItem[];
  onAdd: (product: Product) => void;
}) {
  const cartItem = cart.find(
    (item) =>
      item.product_id === product.product_id
  );

  const outOfStock =
    product.available_quantity === 0;

  const reachedStockLimit = Boolean(
    cartItem &&
    cartItem.cart_quantity >=
    product.available_quantity
  );

  function getStockLabel() {
    if (outOfStock) {
      return "Out of stock";
    }

    if (product.available_quantity <= 5) {
      return "Low stock";
    }

    return "In stock";
  }

  function getStockClasses() {
    if (outOfStock) {
      return "border-red-200 bg-red-50/95 text-red-600";
    }

    if (product.available_quantity <= 5) {
      return "border-amber-200 bg-amber-50/95 text-amber-700";
    }

    return "border-emerald-200 bg-emerald-50/95 text-emerald-700";
  }

  function getButtonText() {
    if (outOfStock) {
      return "Out of stock";
    }

    if (reachedStockLimit) {
      return "Maximum available added";
    }

    if (cartItem) {
      return "Add another";
    }

    return "Add to cart";
  }

  return (
    <article className="group overflow-hidden rounded-[20px] border border-[#e1e7ea] bg-white shadow-[0_2px_8px_rgba(16,24,40,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(16,24,40,0.10)]">
      <div className="relative h-[210px] overflow-hidden bg-[#eef2f3]">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.product_name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-[#98a2b3]">
            <PackageIcon className="h-8 w-8" />

            <span className="mt-2 text-[11px]">
              Image unavailable
            </span>
          </div>
        )}

        <span
          className={`absolute right-3 top-3 rounded-full border px-3 py-1 text-[9px] font-semibold backdrop-blur ${getStockClasses()}`}
        >
          {getStockLabel()}
        </span>
      </div>

      <div className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#009d8b]">
          {product.category}
        </p>

        <h3 className="mt-2 line-clamp-2 min-h-[40px] text-[15px] font-semibold leading-5 text-[#1d2939]">
          {product.product_name}
        </h3>

        <p className="mt-1 text-[10px] text-[#98a2b3]">
          Product ID: {product.product_id}
        </p>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[19px] font-semibold tracking-[-0.03em] text-[#101828]">
              ₹
              {Number(
                product.price
              ).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>

            <p className="mt-1 text-[10px] text-[#98a2b3]">
              {product.available_quantity} available
            </p>
          </div>

          {cartItem && (
            <span className="rounded-full bg-[#eafbf7] px-2.5 py-1 text-[9px] font-semibold text-[#008f80]">
              {cartItem.cart_quantity} in cart
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={
            outOfStock ||
            reachedStockLimit
          }
          onClick={() => onAdd(product)}
          className="mt-4 w-full rounded-xl bg-[#101828] px-4 py-3 text-[11px] font-semibold text-white transition hover:bg-[#1d2939] disabled:cursor-not-allowed disabled:bg-[#e4e7ec] disabled:text-[#98a2b3]"
        >
          {getButtonText()}
        </button>
      </div>
    </article>
  );
}

function ProductSkeleton() {
  return (
    <section className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-[20px] border border-[#e1e7ea] bg-white"
        >
          <div className="h-[210px] animate-pulse bg-[#e9eef0]" />

          <div className="p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-[#e9eef0]" />

            <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-[#e9eef0]" />

            <div className="mt-3 h-4 w-2/5 animate-pulse rounded bg-[#e9eef0]" />

            <div className="mt-5 h-10 animate-pulse rounded-xl bg-[#e9eef0]" />
          </div>
        </div>
      ))}
    </section>
  );
}

function EmptyState({
  onClear,
}: {
  onClear: () => void;
}) {
  return (
    <section className="mt-7 flex min-h-[300px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#d4dfdf] bg-white px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eafbf7] text-[#009d8b]">
        <PackageIcon className="h-6 w-6" />
      </div>

      <h2 className="mt-4 text-[16px] font-semibold text-[#344054]">
        No matching products
      </h2>

      <p className="mt-1 text-[12px] text-[#98a2b3]">
        Change the search, category or price
        range.
      </p>

      <button
        type="button"
        onClick={onClear}
        className="mt-5 rounded-xl bg-[#101828] px-5 py-2.5 text-[11px] font-semibold text-white"
      >
        Clear filters
      </button>
    </section>
  );
}

function NavigationLink({
  href,
  children,
  active = false,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-[12px] font-medium transition ${active ? "bg-[#eafbf7] text-[#008878]" : "text-[#667085] hover:bg-[#f4f7f7] hover:text-[#101828]"}`}
    >
      {children}
    </Link>
  );
}

function MobileNavigationLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-3 text-[13px] font-medium text-[#344054] hover:bg-[#f4f7f7]"
    >
      {children}
    </Link>
  );
}

const controlClass =
  "h-12 w-full rounded-xl border border-[#dce4e8] bg-[#f9fbfc] px-4 text-[12px] text-[#101828] outline-none focus:border-[#81cdc5] focus:bg-white focus:ring-4 focus:ring-[#e6f6f3]";

function SearchIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CartIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 4h2l2.2 10a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

function UserIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function MenuIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function ArrowIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M5 12h14M14 6l6 6-6 6" />
    </svg>
  );
}
function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] p-3">

      <p className="text-[10px] uppercase tracking-[0.08em] text-[#98a2b3]">
        {label}
      </p>

      <p className="mt-1 text-[13px] font-medium text-[#101828]">
        {value}
      </p>

    </div>
  );
}
function PackageIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" />
    </svg>
  );
}