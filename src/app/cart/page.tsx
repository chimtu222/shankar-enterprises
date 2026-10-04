"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type CartItem = {
  product_id: string;
  product_name: string;
  category: string;
  price: number;
  gst_rate: number;
  available_quantity: number;
  image_url: string | null;
  cart_quantity: number;
};

type LoggedInUser = {
  user_id: string;
  name: string;
  phone: string;
  role: string;
};

export default function CartPage() {
  const router = useRouter();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [generatedOrderId, setGeneratedOrderId] =
    useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadCart();
  }, []);

  function loadCart() {
    const savedCart =
      localStorage.getItem("customer_cart");

    if (!savedCart) {
      return;
    }

    try {
      const parsedCart =
        JSON.parse(savedCart) as CartItem[];

      setCartItems(parsedCart);
    } catch {
      localStorage.removeItem("customer_cart");
      setCartItems([]);
    }
  }

  const calculatedItems = useMemo(() => {
    return cartItems.map((item) => {
      const unitPrice = Number(item.price);
      const quantity = Number(item.cart_quantity);
      const gstRate = Number(item.gst_rate ?? 0);

      const itemSubtotal =
        unitPrice * quantity;

      const itemGst =
        itemSubtotal * gstRate / 100;

      const itemTotal =
        itemSubtotal + itemGst;

      return {
        ...item,
        itemSubtotal,
        itemGst,
        itemTotal,
      };
    });
  }, [cartItems]);

  const totalItemCount = useMemo(() => {
    return calculatedItems.reduce(
      (total, item) =>
        total + item.cart_quantity,
      0
    );
  }, [calculatedItems]);

  const subtotal = useMemo(() => {
    return calculatedItems.reduce(
      (total, item) =>
        total + item.itemSubtotal,
      0
    );
  }, [calculatedItems]);

  const totalGst = useMemo(() => {
    return calculatedItems.reduce(
      (total, item) =>
        total + item.itemGst,
      0
    );
  }, [calculatedItems]);

  const grandTotal = useMemo(() => {
    return subtotal + totalGst;
  }, [subtotal, totalGst]);

  function saveCart(updatedCart: CartItem[]) {
    setCartItems(updatedCart);

    localStorage.setItem(
      "customer_cart",
      JSON.stringify(updatedCart)
    );
  }

  function increaseQuantity(item: CartItem) {
    if (
      item.cart_quantity >=
      item.available_quantity
    ) {
      setError(
        `Only ${item.available_quantity} units of ${item.product_name} are available.`
      );

      return;
    }

    setError("");

    const updatedCart = cartItems.map(
      (cartItem) =>
        cartItem.product_id === item.product_id
          ? {
              ...cartItem,
              cart_quantity:
                cartItem.cart_quantity + 1,
            }
          : cartItem
    );

    saveCart(updatedCart);
  }

  function decreaseQuantity(item: CartItem) {
    setError("");

    if (item.cart_quantity <= 1) {
      removeItem(item.product_id);
      return;
    }

    const updatedCart = cartItems.map(
      (cartItem) =>
        cartItem.product_id === item.product_id
          ? {
              ...cartItem,
              cart_quantity:
                cartItem.cart_quantity - 1,
            }
          : cartItem
    );

    saveCart(updatedCart);
  }

  function removeItem(productId: string) {
    setError("");

    const updatedCart = cartItems.filter(
      (item) => item.product_id !== productId
    );

    saveCart(updatedCart);
  }

  async function placeOrder() {
    setError("");
    setGeneratedOrderId("");

    if (cartItems.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    const savedUser =
      localStorage.getItem("user");

    if (!savedUser) {
      router.push("/login");
      return;
    }

    let customer: LoggedInUser;

    try {
      customer =
        JSON.parse(savedUser) as LoggedInUser;
    } catch {
      setError(
        "Your login session is invalid. Please log in again."
      );

      return;
    }

    if (
      customer.role !== "CUSTOMER" ||
      !customer.user_id
    ) {
      setError(
        "Only customer accounts can place orders."
      );

      return;
    }

    const itemsForDatabase = cartItems.map(
      (item) => ({
        product_id: item.product_id,
        quantity: item.cart_quantity,
      })
    );

    setPlacingOrder(true);

    const {
      data: orderId,
      error: orderError,
    } = await supabase.rpc(
      "place_customer_order",
      {
        p_customer_id: customer.user_id,
        p_items: itemsForDatabase,
      }
    );

    setPlacingOrder(false);

    if (orderError) {
      setError(orderError.message);
      return;
    }

    const finalOrderId = String(orderId);

    setGeneratedOrderId(finalOrderId);
    setCartItems([]);

    localStorage.removeItem("customer_cart");
  }

  if (generatedOrderId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f7f9] px-4 text-[#101828]">
        <section className="w-full max-w-md rounded-[24px] border border-[#e1e7ea] bg-white p-8 text-center shadow-[0_16px_40px_rgba(16,24,40,0.08)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ecfdf5] text-2xl font-bold text-[#047857]">
            ✓
          </div>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#009d8b]">
            Order confirmed
          </p>

          <h1 className="mt-2 text-[25px] font-semibold tracking-[-0.04em]">
            Order placed successfully
          </h1>

          <p className="mt-3 text-[13px] text-[#667085]">
            Your unique Order ID is:
          </p>

          <div className="mt-4 rounded-2xl border border-[#dceeea] bg-[#f3f8f7] px-5 py-4">
            <p className="text-[22px] font-bold tracking-[0.06em] text-[#008f80]">
              {generatedOrderId}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link href="/orders">
              View my orders
            </Link>

            <Link href="/products">
              Continue shopping
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="h-screen min-h-screen overflow-y-auto bg-[#f3f7f9] text-[#101828]">
      <header className="border-b border-[#e7ecef] bg-white">
        <div className="mx-auto flex h-[70px] max-w-[1100px] items-center justify-between px-4 sm:px-6">
          <Link
            href="/products"
            className="flex items-center text-[#101828]"
            aria-label="Shankar Enterprises">
            <img src="/SE_logo.png" height={40} width={40} alt="" />
            <span>Shankar Enterprises</span>
          </Link>

          <Link href="/products">
            Continue shopping
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
        <section>
          <p className="text-[12px] font-semibold text-[#009d8b]">
            Checkout
          </p>

          <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.04em]">
            Your cart
          </h1>

          <p className="mt-2 text-[13px] text-[#667085]">
            Review item quantities, GST and final
            amount before placing the order.
          </p>
        </section>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
            {error}
          </div>
        )}

        {calculatedItems.length === 0 ? (
          <section className="mt-7 rounded-[22px] border border-dashed border-[#d4dfdf] bg-white px-6 py-20 text-center">
            <h2 className="text-[16px] font-semibold">
              Your cart is empty
            </h2>

            <Link href="/products">
              Browse products
            </Link>
          </section>
        ) : (
          <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="space-y-4">
              {calculatedItems.map((item) => (
                <article
                  key={item.product_id}
                  className="rounded-[20px] border border-[#e1e7ea] bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#eef2f3]">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.product_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-[#98a2b3]">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#009d8b]">
                        {item.category}
                      </p>

                      <h2 className="mt-1 text-[15px] font-semibold">
                        {item.product_name}
                      </h2>

                      <p className="mt-1 text-[10px] text-[#98a2b3]">
                        {item.product_id}
                      </p>

                      <div className="mt-4 grid gap-2 text-[11px] text-[#667085] sm:grid-cols-4">
                        <div>
                          <p className="text-[9px] uppercase text-[#98a2b3]">
                            Unit price
                          </p>

                          <p className="mt-1 font-semibold text-[#344054]">
                            {formatMoney(item.price)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[9px] uppercase text-[#98a2b3]">
                            Quantity
                          </p>

                          <p className="mt-1 font-semibold text-[#344054]">
                            {item.cart_quantity}
                          </p>
                        </div>

                        <div>
                          <p className="text-[9px] uppercase text-[#98a2b3]">
                            GST
                          </p>

                          <p className="mt-1 font-semibold text-[#344054]">
                            {formatMoney(item.itemGst)}
                            {" "}
                            ({Number(item.gst_rate ?? 0)}%)
                          </p>
                        </div>

                        <div>
                          <p className="text-[9px] uppercase text-[#98a2b3]">
                            Item total
                          </p>

                          <p className="mt-1 font-semibold text-[#008f80]">
                            {formatMoney(item.itemTotal)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                      <div className="flex items-center overflow-hidden rounded-xl border border-[#dfe5e8]">
                        <button
                          type="button"
                          onClick={() =>
                            decreaseQuantity(item)
                          }
                          className="h-9 w-9 hover:bg-[#f4f7f7]"
                        >
                          -
                        </button>

                        <span className="min-w-9 text-center text-[12px] font-semibold">
                          {item.cart_quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            increaseQuantity(item)
                          }
                          disabled={
                            item.cart_quantity >=
                            item.available_quantity
                          }
                          className="h-9 w-9 hover:bg-[#f4f7f7] disabled:text-[#c8ced6]"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeItem(item.product_id)
                        }
                        className="text-[10px] font-semibold text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="h-fit rounded-[22px] border border-[#e1e7ea] bg-white p-5 shadow-sm">
              <h2 className="text-[17px] font-semibold">
                Order summary
              </h2>

              <div className="mt-5 space-y-3">
                {calculatedItems.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-start justify-between gap-4 text-[11px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#475467]">
                        {item.product_name}
                      </p>

                      <p className="mt-0.5 text-[9px] text-[#98a2b3]">
                        {item.cart_quantity} ×{" "}
                        {formatMoney(item.price)}
                      </p>
                    </div>

                    <p className="shrink-0 font-semibold text-[#344054]">
                      {formatMoney(item.itemSubtotal)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-[#edf1f2] pt-4">
                <SummaryRow
                  label="Total quantity"
                  value={String(totalItemCount)}
                />

                <SummaryRow
                  label="Items subtotal"
                  value={formatMoney(subtotal)}
                />

                <SummaryRow
                  label="Total GST"
                  value={formatMoney(totalGst)}
                />
              </div>

              <div className="mt-5 rounded-2xl bg-[#eafbf7] px-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#047857]">
                    Final amount
                  </span>

                  <span className="text-[19px] font-bold text-[#006f65]">
                    {formatMoney(grandTotal)}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-[9px] leading-4 text-[#98a2b3]">
                Final values are securely recalculated
                by Supabase when the order is placed.
              </p>

              <button
                type="button"
                onClick={() => void placeOrder()}
                disabled={placingOrder}
                className="mt-5 w-full rounded-xl bg-[#101828] px-5 py-3 text-[12px] font-semibold text-white hover:bg-[#1d2939] disabled:opacity-60"
              >
                {placingOrder
                  ? "Placing order..."
                  : "Place order"}
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between text-[11px]">
      <span className="text-[#667085]">
        {label}
      </span>

      <span className="font-semibold text-[#344054]">
        {value}
      </span>
    </div>
  );
}

function formatMoney(
  value: number | string | null
) {
  return `₹${Number(value ?? 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}