"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type OrderStatus =
  | "PENDING"
  | "IN_PROCESS"
  | "PARTIAL"
  | "DELIVERED"
  | "CANCELLED";

type PaymentStatus =
  | "NOT_PAID"
  | "PARTIALLY_PAID"
  | "PAID";

type OrderItem = {
  order_item_id: string;
  product_name_snapshot: string | null;
  quantity: number;
  price_at_order: number;
  gst_rate: number;
  gst_amount: number;
  line_total: number;
  products:
    | {
        product_name: string;
        image_url: string | null;
      }
    | {
        product_name: string;
        image_url: string | null;
      }[]
    | null;
};

type CustomerOrder = {
  order_id: string;
  customer_id: string;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  paid_amount: number;
  created_at: string;
  order_items: OrderItem[];
};

type LoggedInUser = {
  user_id: string;
  name: string;
  role: string;
};

export default function CustomerOrdersPage() {
  const [orders, setOrders] =
    useState<CustomerOrder[]>([]);

  const [customer, setCustomer] =
    useState<LoggedInUser | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOrders = useCallback(
    async (customerId: string) => {
      const { data, error: queryError } =
        await supabase
          .from("orders")
          .select(`
            order_id,
            customer_id,
            subtotal,
            gst_amount,
            total_amount,
            status,
            payment_status,
            paid_amount,
            created_at,
            order_items (
              order_item_id,
              product_name_snapshot,
              quantity,
              price_at_order,
              gst_rate,
              gst_amount,
              line_total,
              products (
                product_name,
                image_url
              )
            )
          `)
          .eq("customer_id", customerId)
          .order("created_at", {
            ascending: false,
          });

      if (queryError) {
        setError(queryError.message);
        setOrders([]);
      } else {
        setOrders(
          (data ?? []) as unknown as CustomerOrder[]
        );

        setError("");
      }

      setLoading(false);
    },
    []
  );

  useEffect(() => {
    const savedUser =
      localStorage.getItem("user");

    if (!savedUser) {
      setError("Please log in to view your orders.");
      setLoading(false);
      return;
    }

    try {
      const parsedUser =
        JSON.parse(savedUser) as LoggedInUser;

      if (
        parsedUser.role !== "CUSTOMER" ||
        !parsedUser.user_id
      ) {
        setError(
          "Only customer accounts can view this page."
        );

        setLoading(false);
        return;
      }

      setCustomer(parsedUser);
      void loadOrders(parsedUser.user_id);

      const channel = supabase
        .channel(
          `customer-orders-${parsedUser.user_id}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter:
              `customer_id=eq.${parsedUser.user_id}`,
          },
          () => {
            void loadOrders(parsedUser.user_id);
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      setError(
        "Your login session is invalid. Please log in again."
      );

      setLoading(false);
    }
  }, [loadOrders]);

  const orderCount = orders.length;

  const totalSpent = useMemo(() => {
    return orders
      .filter(
        (order) =>
          order.payment_status === "PAID"
      )
      .reduce(
        (total, order) =>
          total + Number(order.total_amount),
        0
      );
  }, [orders]);

  return (
    <main className="h-screen min-h-screen overflow-y-auto bg-[#f3f7f9] text-[#101828]">
      <header className="sticky top-0 z-30 border-b border-[#e7ecef] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[70px] max-w-[1100px] items-center justify-between px-4 sm:px-6">
          <Link href="/products" className="flex items-center gap-3">
            <img src="/SE_logo.png" alt="Shankar Enterprises" className="h-10 w-10 object-contain" />

            <span className="text-[15px] font-semibold">
              Shankar Enterprises
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/products" className="rounded-lg px-3 py-2 text-[13px] font-medium text-[#475467]">
              Products
            </Link>

            <Link href="/cart" className="rounded-lg px-3 py-2 text-[13px] font-medium text-[#475467]">
              Cart
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
        <section>
          <p className="text-[12px] font-semibold text-[#009d8b]">
            Order history
          </p>

          <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.04em]">
            My orders
          </h1>

          <p className="mt-2 text-[13px] text-[#667085]">
            {customer
              ? `${customer.name}, track your orders and payment status here.`
              : "Track your orders and payment status here."}
          </p>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <SummaryCard
            label="Total orders"
            value={String(orderCount)}
          />

          <SummaryCard
            label="Paid order value"
            value={formatMoney(totalSpent)}
          />
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-7 rounded-[22px] border border-[#e1e7ea] bg-white py-20 text-center text-[13px] text-[#667085]">
            Loading your orders...
          </div>
        ) : orders.length === 0 ? (
          <section className="mt-7 rounded-[22px] border border-dashed border-[#d4dfdf] bg-white py-20 text-center">
            <h2 className="text-[16px] font-semibold">
              No orders yet
            </h2>

            <p className="mt-2 text-[12px] text-[#98a2b3]">
              Your placed orders will appear here.
            </p>

            <Link href="/products" className="mt-5 inline-flex rounded-xl bg-[#009d8b] px-5 py-3 text-[13px] font-semibold text-white">
              Browse products
            </Link>
          </section>
        ) : (
          <section className="mt-7 space-y-5">
            {orders.map((order) => (
              <OrderCard
                key={order.order_id}
                order={order}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function OrderCard({
  order,
}: {
  order: CustomerOrder;
}) {
  const balance = Math.max(
    0,
    Number(order.total_amount) -
      Number(order.paid_amount)
  );

  return (
    <article className="overflow-hidden rounded-[22px] border border-[#e1e7ea] bg-white shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
      <div className="flex flex-col gap-4 border-b border-[#edf1f2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#2563eb]">
              {order.order_id}
            </span>

            <OrderStatusBadge
              status={order.status}
            />
          </div>

          <p className="mt-2 text-[10px] text-[#98a2b3]">
            Placed on {formatDate(order.created_at)}
          </p>
        </div>

        <div className="sm:text-right">
          <p className="text-[19px] font-bold text-[#101828]">
            {formatMoney(order.total_amount)}
          </p>

          <PaymentBadge
            status={order.payment_status}
          />
        </div>
      </div>

      <div className="px-5 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">
          Ordered items
        </p>

        <div className="mt-4 space-y-3">
          {order.order_items.map((item) => {
            const product =
              Array.isArray(item.products)
                ? item.products[0]
                : item.products;

            const productName =
              item.product_name_snapshot ||
              product?.product_name ||
              "Product";

            return (
              <div
                key={item.order_item_id}
                className="flex items-center justify-between gap-4 rounded-2xl bg-[#f8fafb] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-[#344054]">
                    {productName}
                  </p>

                  <p className="mt-1 text-[9px] text-[#98a2b3]">
                    {item.quantity} ×{" "}
                    {formatMoney(item.price_at_order)}
                    {" "}• GST {Number(item.gst_rate)}%
                  </p>
                </div>

                <p className="shrink-0 text-[12px] font-semibold text-[#101828]">
                  {formatMoney(item.line_total)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <AmountBox
            label="Subtotal"
            value={formatMoney(order.subtotal)}
          />

          <AmountBox
            label="GST"
            value={formatMoney(order.gst_amount)}
          />

          <AmountBox
            label="Paid"
            value={formatMoney(order.paid_amount)}
          />

          <AmountBox
            label="Balance"
            value={formatMoney(balance)}
          />
        </div>
      </div>
    </article>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[20px] border border-[#e4e9ec] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-medium text-[#667085]">
        {label}
      </p>

      <p className="mt-3 text-[27px] font-semibold tracking-[-0.04em]">
        {value}
      </p>
    </article>
  );
}

function AmountBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#edf1f2] bg-white px-3 py-3">
      <p className="text-[9px] uppercase tracking-[0.08em] text-[#98a2b3]">
        {label}
      </p>

      <p className="mt-1 text-[12px] font-semibold text-[#344054]">
        {value}
      </p>
    </div>
  );
}

function OrderStatusBadge({
  status,
}: {
  status: OrderStatus;
}) {
  const labels: Record<OrderStatus, string> = {
    PENDING: "Pending",
    IN_PROCESS: "In Process",
    PARTIAL: "Partial",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };

  const colours: Record<OrderStatus, string> = {
    PENDING:
      "border-amber-200 bg-amber-50 text-amber-700",
    IN_PROCESS:
      "border-purple-200 bg-purple-50 text-purple-700",
    PARTIAL:
      "border-blue-200 bg-blue-50 text-blue-700",
    DELIVERED:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    CANCELLED:
      "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${colours[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function PaymentBadge({
  status,
}: {
  status: PaymentStatus;
}) {
  const labels: Record<PaymentStatus, string> = {
    NOT_PAID: "Not paid",
    PARTIALLY_PAID: "Partially paid",
    PAID: "Paid",
  };

  const colours: Record<PaymentStatus, string> = {
    NOT_PAID: "text-red-600",
    PARTIALLY_PAID: "text-amber-700",
    PAID: "text-emerald-700",
  };

  return (
    <p
      className={`mt-1 text-[10px] font-semibold ${colours[status]}`}
    >
      {labels[status]}
    </p>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}