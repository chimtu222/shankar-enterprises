"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type Product = {
  product_id: string;
  category: string;
  product_name: string;
  price: number;
  available_quantity: number;
  image_url: string | null;
  image_size_bytes?: number | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

type ProductForm = {
  category: string;
  product_name: string;
  price: string;
  available_quantity: string;
};

const emptyForm: ProductForm = {
  category: "",
  product_name: "",
  price: "",
  available_quantity: "",
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState("ALL");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setProducts([]);
    } else {
      setProducts((data ?? []) as Product[]);
    }

    setLoading(false);
  }

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((product) => product.category?.trim())
          .filter(Boolean)
      )
    ).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalisedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !normalisedSearch ||
        product.product_name
          .toLowerCase()
          .includes(normalisedSearch) ||
        product.product_id
          .toLowerCase()
          .includes(normalisedSearch) ||
        product.category
          .toLowerCase()
          .includes(normalisedSearch);

      const matchesCategory =
        categoryFilter === "ALL" ||
        product.category === categoryFilter;

      const matchesStock =
        stockFilter === "ALL" ||
        (stockFilter === "IN_STOCK" &&
          product.available_quantity > 5) ||
        (stockFilter === "LOW_STOCK" &&
          product.available_quantity > 0 &&
          product.available_quantity <= 5) ||
        (stockFilter === "OUT_OF_STOCK" &&
          product.available_quantity === 0);

      const matchesVisibility =
        visibilityFilter === "ALL" ||
        (visibilityFilter === "VISIBLE" &&
          product.is_visible) ||
        (visibilityFilter === "HIDDEN" &&
          !product.is_visible);

      const matchesMinimumPrice =
        minPrice === "" ||
        Number(product.price) >= Number(minPrice);

      const matchesMaximumPrice =
        maxPrice === "" ||
        Number(product.price) <= Number(maxPrice);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStock &&
        matchesVisibility &&
        matchesMinimumPrice &&
        matchesMaximumPrice
      );
    });
  }, [
    products,
    search,
    categoryFilter,
    stockFilter,
    visibilityFilter,
    minPrice,
    maxPrice,
  ]);

  function openAddModal() {
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview("");
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);

    setForm({
      category: product.category,
      product_name: product.product_name,
      price: String(product.price),
      available_quantity: String(
        product.available_quantity
      ),
    });

    setImageFile(null);
    setImagePreview(product.image_url ?? "");
    setError("");
    setMessage("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingProduct(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview("");
    setError("");
  }

  function handleImageChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    console.log("Image Size (Bytes)", file.size);
    console.log("Image Size (KB)", (file.size / 1024).toFixed(2));
    console.log("Image Size (MB)", (file.size / (1024 * 1024)).toFixed(2));

    const allowedTypes = ["image/jpeg", "image/png", "image/webp",];

    if (!allowedTypes.includes(file.type)) {
      setError("Select a JPG, PNG or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size cannot exceed 5 MB.");
      event.target.value = "";
      return;
    }

    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadProductImage(file: File) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const storagePath = `product-images/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("Products")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from("Products")
      .getPublicUrl(storagePath);

    return data.publicUrl;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    const category = form.category.trim();
    const productName = form.product_name.trim();
    const price = Number(form.price);
    const quantity = Number(form.available_quantity);

    if (!productName || !category) {
      setError("Product name and category are required.");
      return;
    }

    if (
      form.price === "" ||
      Number.isNaN(price) ||
      price < 0
    ) {
      setError("Enter a valid product price.");
      return;
    }

    if (
      form.available_quantity === "" ||
      Number.isNaN(quantity) ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      setError("Enter a valid whole-number quantity.");
      return;
    }

    if (!editingProduct && !imageFile) {
      setError("Select a product image.");
      return;
    }

    try {
      setSaving(true);

      let finalImageUrl =
        editingProduct?.image_url ?? null;

      if (imageFile) {
        finalImageUrl =
          await uploadProductImage(imageFile);
      }

      const productData = {
        category,
        product_name: productName,
        price,
        available_quantity: quantity,
        image_url: finalImageUrl,
        image_size_bytes: imageFile ? imageFile.size : editingProduct?.image_size_bytes ?? 0,
      };

      if (editingProduct) {
        const { error: updateError } = await supabase
          .from("products")
          .update(productData)
          .eq(
            "product_id",
            editingProduct.product_id
          );

        if (updateError) {
          throw new Error(updateError.message);
        }

        setMessage("Product updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("products")
          .insert(productData);

        if (insertError) {
          throw new Error(insertError.message);
        }

        setMessage("Product added successfully.");
      }

      setModalOpen(false);
      setEditingProduct(null);
      setForm(emptyForm);
      setImageFile(null);
      setImagePreview("");

      await fetchProducts();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save the product."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility(product: Product) {
    setError("");
    setMessage("");

    const newVisibility = !product.is_visible;

    const { error: updateError } = await supabase
      .from("products")
      .update({
        is_visible: newVisibility,
      })
      .eq("product_id", product.product_id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.map((currentProduct) =>
        currentProduct.product_id === product.product_id
          ? {
            ...currentProduct,
            is_visible: newVisibility,
          }
          : currentProduct
      )
    );

    setMessage(
      newVisibility
        ? "Product is now visible to customers."
        : "Product is now hidden from customers."
    );
  }

  async function deleteProduct(product: Product) {
    const confirmed = window.confirm(
      `Permanently delete "${product.product_name}"?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("product_id", product.product_id);

    if (deleteError) {
      setError(
        "Unable to delete this product. Hide it instead if it is linked to an existing order."
      );
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.filter(
        (currentProduct) =>
          currentProduct.product_id !== product.product_id
      )
    );

    setMessage("Product deleted successfully.");
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("ALL");
    setStockFilter("ALL");
    setVisibilityFilter("ALL");
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <div className="text-[#101828]">
      <section className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[#009d8b]">
            Catalogue management
          </p>

          <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.04em] text-[#101828]">
            Products
          </h1>

          <p className="mt-2 text-[13px] text-[#667085]">
            Add, update and control the products visible
            to your customers.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex w-fit items-center gap-2 rounded-xl bg-[#101828] px-5 py-3 text-[13px] font-semibold text-white shadow-[0_5px_14px_rgba(16,24,40,0.16)] transition hover:bg-[#1d2939]"
        >
          <PlusIcon className="h-4 w-4" />
          Add product
        </button>
      </section>

      {(message || error) && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-[13px] ${error
              ? "border-[#fecaca] bg-[#fff1f2] text-[#be123c]"
              : "border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]"
            }`}
        >
          {error || message}
        </div>
      )}

      <section className="overflow-hidden rounded-[24px] border border-[#e4e9ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03),0_10px_26px_rgba(16,24,40,0.045)]">
        <div className="flex flex-col gap-4 border-b border-[#edf1f0] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium text-[#667085]">
              {filteredProducts.length} of{" "}
              {products.length} products in catalogue
            </p>
          </div>

          <div className="flex w-full gap-3 sm:w-auto">
            <div className="relative flex-1 sm:w-[260px]">
              <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />

              <input
                type="search"
                placeholder="Search products"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="w-full rounded-xl border border-[#dfe5e8] bg-[#fbfcfc] py-2.5 pl-10 pr-4 text-[13px] text-[#101828] outline-none placeholder:text-[#98a2b3] focus:border-[#81cdc5] focus:bg-white focus:ring-4 focus:ring-[#e6f6f3]"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setShowFilters((current) => !current)
              }
              className="flex items-center gap-2 rounded-xl border border-[#74d4c9] bg-[#f0fbf9] px-4 py-2.5 text-[13px] font-semibold text-[#008f80] transition hover:bg-[#e5f8f4]"
            >
              <FilterIcon className="h-4 w-4" />
              Filters
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="border-b border-[#edf1f0] bg-[#fbfcfc] px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <FilterField label="Category">
                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value)
                  }
                  className={filterInputClass}
                >
                  <option value="ALL">
                    All categories
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Stock status">
                <select
                  value={stockFilter}
                  onChange={(event) =>
                    setStockFilter(event.target.value)
                  }
                  className={filterInputClass}
                >
                  <option value="ALL">
                    All statuses
                  </option>

                  <option value="IN_STOCK">
                    In stock
                  </option>

                  <option value="LOW_STOCK">
                    Low stock
                  </option>

                  <option value="OUT_OF_STOCK">
                    Out of stock
                  </option>
                </select>
              </FilterField>

              <FilterField label="Visibility">
                <select
                  value={visibilityFilter}
                  onChange={(event) =>
                    setVisibilityFilter(
                      event.target.value
                    )
                  }
                  className={filterInputClass}
                >
                  <option value="ALL">
                    All products
                  </option>

                  <option value="VISIBLE">
                    Visible
                  </option>

                  <option value="HIDDEN">
                    Hidden
                  </option>
                </select>
              </FilterField>

              <FilterField label="Minimum price">
                <input
                  type="number"
                  min="0"
                  placeholder="₹0"
                  value={minPrice}
                  onChange={(event) =>
                    setMinPrice(event.target.value)
                  }
                  className={filterInputClass}
                />
              </FilterField>

              <FilterField label="Maximum price">
                <input
                  type="number"
                  min="0"
                  placeholder="No limit"
                  value={maxPrice}
                  onChange={(event) =>
                    setMaxPrice(event.target.value)
                  }
                  className={filterInputClass}
                />
              </FilterField>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-lg border border-[#d8e0e4] bg-white px-4 py-2 text-[12px] font-semibold text-[#475467] transition hover:bg-[#f8faf9]"
            >
              Clear filters
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center text-[13px] text-[#667085]">
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eafbf7] text-[#009d8b]">
              <PackageIcon className="h-6 w-6" />
            </div>

            <p className="mt-4 text-[15px] font-semibold text-[#344054]">
              No products found
            </p>

            <p className="mt-1 text-[12px] text-[#98a2b3]">
              Add your first product or change the
              filters.
            </p>

            <button
              type="button"
              onClick={openAddModal}
              className="mt-5 rounded-xl bg-[#101828] px-5 py-2.5 text-[12px] font-semibold text-white"
            >
              Add product
            </button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-[#edf1f0] bg-white text-left">
                    <TableHeading label="Product" />
                    <TableHeading label="Category" />
                    <TableHeading label="Price" />
                    <TableHeading label="Quantity" />
                    <TableHeading label="Status" />
                    <TableHeading label="Visibility" />

                    <th className="px-5 py-4 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-[#98a2b3]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => (
                    <ProductRow
                      key={product.product_id}
                      product={product}
                      onEdit={openEditModal}
                      onToggleVisibility={
                        toggleVisibility
                      }
                      onDelete={deleteProduct}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 md:hidden">
              {filteredProducts.map((product) => (
                <ProductMobileCard
                  key={product.product_id}
                  product={product}
                  onEdit={openEditModal}
                  onToggleVisibility={
                    toggleVisibility
                  }
                  onDelete={deleteProduct}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#101828]/45 backdrop-blur-[3px] sm:items-center sm:p-5">
          <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-[26px] bg-white shadow-2xl sm:max-w-[620px] sm:rounded-[26px]">
            <div className="flex items-start justify-between border-b border-[#edf1f0] px-6 py-5">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[#009d8b]">
                  Product catalogue
                </p>

                <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[#101828]">
                  {editingProduct
                    ? "Edit product"
                    : "Add product"}
                </h2>

                {editingProduct && (
                  <p className="mt-1 text-[11px] text-[#98a2b3]">
                    {editingProduct.product_id}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e4e7ec] text-[#667085] hover:bg-[#f8faf9]"
                aria-label="Close"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="px-6 py-6"
            >
              <div className="grid gap-5">
                <FormField label="Product name">
                  <input
                    type="text"
                    placeholder="Example: Premium Wash Basin"
                    value={form.product_name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        product_name:
                          event.target.value,
                      })
                    }
                    className={formInputClass}
                  />
                </FormField>

                <FormField label="Category">
                  <input
                    type="text"
                    list="product-categories"
                    placeholder="Example: Wash Basins"
                    value={form.category}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        category: event.target.value,
                      })
                    }
                    className={formInputClass}
                  />

                  <datalist id="product-categories">
                    {categories.map((category) => (
                      <option
                        key={category}
                        value={category}
                      />
                    ))}
                  </datalist>
                </FormField>

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField label="Price">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="₹0.00"
                      value={form.price}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          price: event.target.value,
                        })
                      }
                      className={formInputClass}
                    />
                  </FormField>

                  <FormField label="Available quantity">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={
                        form.available_quantity
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          available_quantity:
                            event.target.value,
                        })
                      }
                      className={formInputClass}
                    />
                  </FormField>
                </div>

                <FormField label="Product image">
                  <label className="flex min-h-[170px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[18px] border-2 border-dashed border-[#d8e3e0] bg-[#f8fbfa] p-4 text-center transition hover:border-[#73cfc4] hover:bg-[#f0faf8]">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Product preview"
                        className="h-[170px] w-full rounded-[14px] object-cover"
                      />
                    ) : (
                      <>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eafbf7] text-[#009d8b]">
                          <UploadIcon className="h-5 w-5" />
                        </div>

                        <p className="mt-3 text-[13px] font-semibold text-[#344054]">
                          Select product image
                        </p>

                        <p className="mt-1 text-[11px] text-[#98a2b3]">
                          JPG, PNG or WebP, maximum 5 MB
                        </p>
                      </>
                    )}

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>

                  {imagePreview && (
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#d8e0e4] px-3 py-2 text-[11px] font-semibold text-[#475467] hover:bg-[#f8faf9]">
                      <UploadIcon className="h-3.5 w-3.5" />
                      Change image

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </FormField>
              </div>

              {error && (
                <div className="mt-5 rounded-xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[12px] text-[#be123c]">
                  {error}
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#edf1f0] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-[#d8e0e4] bg-white px-5 py-2.5 text-[12px] font-semibold text-[#475467] hover:bg-[#f8faf9]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#101828] px-6 py-2.5 text-[12px] font-semibold text-white shadow-sm hover:bg-[#1d2939] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingProduct
                      ? "Save changes"
                      : "Add product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const filterInputClass =
  "w-full rounded-xl border border-[#d8e0e4] bg-white px-3 py-2.5 text-[12px] text-[#101828] outline-none placeholder:text-[#98a2b3] focus:border-[#81cdc5] focus:ring-4 focus:ring-[#e6f6f3]";

const formInputClass =
  "w-full rounded-xl border border-[#d8e0e4] bg-white px-4 py-3 text-[13px] text-[#101828] outline-none placeholder:text-[#98a2b3] focus:border-[#81cdc5] focus:ring-4 focus:ring-[#e6f6f3]";

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-[11px] font-semibold text-[#475467]">
        {label}
      </span>

      {children}
    </label>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-[12px] font-semibold text-[#344054]">
        {label}
      </label>

      {children}
    </div>
  );
}

function TableHeading({
  label,
}: {
  label: string;
}) {
  return (
    <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-[#98a2b3]">
      {label}
    </th>
  );
}

function ProductRow({
  product,
  onEdit,
  onToggleVisibility,
  onDelete,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onToggleVisibility: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  return (
    <tr className="border-b border-[#f0f2f3] transition last:border-0 hover:bg-[#fbfcfc]">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <ProductImage product={product} />

          <div className="min-w-0">
            <p className="max-w-[220px] truncate text-[13px] font-semibold text-[#1d2939]">
              {product.product_name}
            </p>

            <p className="mt-1 text-[10px] text-[#98a2b3]">
              {product.product_id}
            </p>
          </div>
        </div>
      </td>

      <td className="px-5 py-4 text-[12px] text-[#667085]">
        {product.category}
      </td>

      <td className="px-5 py-4 text-[12px] font-semibold text-[#1d2939]">
        ₹{Number(product.price).toFixed(2)}
      </td>

      <td className="px-5 py-4 text-[12px] text-[#475467]">
        {product.available_quantity}
      </td>

      <td className="px-5 py-4">
        <StockBadge
          quantity={product.available_quantity}
        />
      </td>

      <td className="px-5 py-4">
        <VisibilityBadge
          visible={product.is_visible}
        />
      </td>

      <td className="px-5 py-4">
        <div className="flex justify-end gap-1">
          <IconButton
            label={
              product.is_visible
                ? "Hide product"
                : "Show product"
            }
            onClick={() =>
              onToggleVisibility(product)
            }
          >
            {product.is_visible ? (
              <EyeIcon className="h-4 w-4" />
            ) : (
              <EyeOffIcon className="h-4 w-4" />
            )}
          </IconButton>

          <IconButton
            label="Edit product"
            onClick={() => onEdit(product)}
          >
            <EditIcon className="h-4 w-4" />
          </IconButton>

          <IconButton
            label="Delete product"
            danger
            onClick={() => onDelete(product)}
          >
            <DeleteIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

function ProductMobileCard({
  product,
  onEdit,
  onToggleVisibility,
  onDelete,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onToggleVisibility: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  return (
    <article className="rounded-[18px] border border-[#e4e9ec] bg-white p-4">
      <div className="flex gap-3">
        <ProductImage product={product} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[#1d2939]">
            {product.product_name}
          </p>

          <p className="mt-1 text-[10px] text-[#98a2b3]">
            {product.product_id}
          </p>

          <p className="mt-2 text-[12px] text-[#667085]">
            {product.category}
          </p>

          <p className="mt-1 text-[14px] font-semibold text-[#101828]">
            ₹{Number(product.price).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StockBadge
          quantity={product.available_quantity}
        />

        <VisibilityBadge
          visible={product.is_visible}
        />

        <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-[10px] font-semibold text-[#475467]">
          Quantity: {product.available_quantity}
        </span>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-[#edf1f0] pt-3">
        <IconButton
          label={
            product.is_visible
              ? "Hide product"
              : "Show product"
          }
          onClick={() =>
            onToggleVisibility(product)
          }
        >
          {product.is_visible ? (
            <EyeIcon className="h-4 w-4" />
          ) : (
            <EyeOffIcon className="h-4 w-4" />
          )}
        </IconButton>

        <IconButton
          label="Edit product"
          onClick={() => onEdit(product)}
        >
          <EditIcon className="h-4 w-4" />
        </IconButton>

        <IconButton
          label="Delete product"
          danger
          onClick={() => onDelete(product)}
        >
          <DeleteIcon className="h-4 w-4" />
        </IconButton>
      </div>
    </article>
  );
}

function ProductImage({
  product,
}: {
  product: Product;
}) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#edf1f0] bg-[#f7f9f9]">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt="Product image"
          className="h-full w-full object-cover"
        />
      ) : (
        <PackageIcon className="h-5 w-5 text-[#98a2b3]" />
      )}
    </div>
  );
}

function StockBadge({
  quantity,
}: {
  quantity: number;
}) {
  if (quantity === 0) {
    return (
      <span className="inline-flex rounded-full border border-[#fecdd3] bg-[#fff1f2] px-3 py-1 text-[10px] font-semibold text-[#e11d48]">
        Out of stock
      </span>
    );
  }

  if (quantity <= 5) {
    return (
      <span className="inline-flex rounded-full border border-[#fde68a] bg-[#fffbeb] px-3 py-1 text-[10px] font-semibold text-[#b45309]">
        Low stock
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-[#a7f3d0] bg-[#ecfdf5] px-3 py-1 text-[10px] font-semibold text-[#047857]">
      In stock
    </span>
  );
}

function VisibilityBadge({
  visible,
}: {
  visible: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold ${visible
          ? "border-[#bae6fd] bg-[#f0f9ff] text-[#0369a1]"
          : "border-[#e4e7ec] bg-[#f8fafc] text-[#667085]"
        }`}
    >
      {visible ? "Visible" : "Hidden"}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${danger
          ? "text-[#f43f5e] hover:bg-[#fff1f2]"
          : "text-[#8293aa] hover:bg-[#f2f6f6] hover:text-[#009d8b]"
        }`}
    >
      {children}
    </button>
  );
}

type IconProps = {
  className?: string;
};

function PlusIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SearchIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function FilterIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" />
    </svg>
  );
}

function UploadIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function PackageIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" />
    </svg>
  );
}

function EyeIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function EyeOffIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-2.1 2.8" />
      <path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 6 10 6a9.6 9.6 0 0 0 4.1-.9" />
    </svg>
  );
}

function EditIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z" />
    </svg>
  );
}

function DeleteIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function CloseIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}