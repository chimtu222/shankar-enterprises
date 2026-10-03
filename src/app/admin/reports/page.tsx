"use client";

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
  | "PACKED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

type PaymentStatus =
  | "NOT_PAID"
  | "PARTIALLY_PAID"
  | "PAID";

type CustomerDetails =
  | {
      name: string;
      phone: string;
      address: string;
    }
  | {
      name: string;
      phone: string;
      address: string;
    }[]
  | null;

type ProductDetails =
  | {
      product_name: string;
      category: string;
    }
  | {
      product_name: string;
      category: string;
    }[]
  | null;

type ReportOrderItem = {
  order_item_id: string;
  product_id: string;
  product_name_snapshot: string | null;
  quantity: number;
  price_at_order: number;
  gst_rate: number;
  gst_amount: number;
  line_total: number;
  products: ProductDetails;
};

type ReportOrder = {
  order_id: string;
  customer_id: string;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  paid_amount: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
  users: CustomerDetails;
  order_items: ReportOrderItem[];
};

type IconProps = {
  className?: string;
};

export default function AdminReportsPage() {
  const [orders, setOrders] = useState<ReportOrder[]>([]);

  const [startDate, setStartDate] = useState(
    getFirstDayOfCurrentMonth()
  );

  const [endDate, setEndDate] = useState(
    getTodayDate()
  );

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] =
    useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadReport = useCallback(async () => {
    setError("");
    setMessage("");

    if (!startDate || !endDate) {
      setError(
        "Please select both the start date and end date."
      );
      return;
    }

    if (startDate > endDate) {
      setError(
        "The start date cannot be after the end date."
      );
      return;
    }

    setLoading(true);

    const startDateTime =
      getStartOfDateIso(startDate);

    const endDateTimeExclusive =
      getNextDateStartIso(endDate);

    const { data, error: queryError } =
      await supabase
        .from("orders")
        .select(`
          order_id,
          customer_id,
          subtotal,
          gst_amount,
          total_amount,
          paid_amount,
          status,
          payment_status,
          created_at,
          updated_at,
          users!orders_customer_fk (
            name,
            phone,
            address
          ),
          order_items (
            order_item_id,
            product_id,
            product_name_snapshot,
            quantity,
            price_at_order,
            gst_rate,
            gst_amount,
            line_total,
            products (
              product_name,
              category
            )
          )
        `)
        .gte("created_at", startDateTime)
        .lt(
          "created_at",
          endDateTimeExclusive
        )
        .order("created_at", {
          ascending: false,
        });

    if (queryError) {
      console.error(queryError);

      setError(queryError.message);
      setOrders([]);
    } else {
      const reportOrders =
        (data ?? []) as unknown as ReportOrder[];

      setOrders(reportOrders);

      setMessage(
        `${reportOrders.length} ${
          reportOrders.length === 1
            ? "order"
            : "orders"
        } found for the selected dates.`
      );
    }

    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    const reportsChannel = supabase
      .channel(
        `admin-reports-${Date.now()}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          void loadReport();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
        },
        () => {
          void loadReport();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(
        reportsChannel
      );
    };
  }, [loadReport]);

  const summary = useMemo(() => {
    return orders.reduce(
      (result, order) => {
        const orderQuantity =
          order.order_items.reduce(
            (quantity, item) =>
              quantity +
              Number(item.quantity ?? 0),
            0
          );

        result.orderCount += 1;
        result.quantity += orderQuantity;

        result.subtotal += Number(
          order.subtotal ?? 0
        );

        result.gst += Number(
          order.gst_amount ?? 0
        );

        result.total += Number(
          order.total_amount ?? 0
        );

        result.paid += Number(
          order.paid_amount ?? 0
        );

        if (
          order.status === "DELIVERED"
        ) {
          result.delivered += 1;
        }

        return result;
      },
      {
        orderCount: 0,
        quantity: 0,
        subtotal: 0,
        gst: 0,
        total: 0,
        paid: 0,
        delivered: 0,
      }
    );
  }, [orders]);

  const outstandingAmount = Math.max(
    0,
    summary.total - summary.paid
  );

  function applyTodayFilter() {
    const today = getTodayDate();

    setStartDate(today);
    setEndDate(today);
  }

  function applyLastSevenDaysFilter() {
    const end = new Date();
    const start = new Date();

    start.setDate(end.getDate() - 6);

    setStartDate(
      toDateInputValue(start)
    );

    setEndDate(
      toDateInputValue(end)
    );
  }

  function applyCurrentMonthFilter() {
    setStartDate(
      getFirstDayOfCurrentMonth()
    );

    setEndDate(getTodayDate());
  }

  function resetFilter() {
    setStartDate(
      getFirstDayOfCurrentMonth()
    );

    setEndDate(getTodayDate());
    setError("");
    setMessage("");
  }

  async function downloadExcelReport() {
    if (orders.length === 0) {
      setError(
        "There are no orders available for the selected date range."
      );
      return;
    }

    setDownloading(true);
    setError("");
    setMessage("");

    try {
      const XLSX = await import("xlsx");

      const orderDetailRows =
  orders.map((order) => {
    const customer =
      getCustomer(order.users);

    const totalQuantity =
      order.order_items.reduce(
        (sum, item) =>
          sum + Number(item.quantity),
        0
      );

    const productNames =
      order.order_items
        .map(
          (item) =>
            `${getProductName(item)} (${item.quantity})`
        )
        .join(", ");

    const productIds =
      order.order_items
        .map((item) => item.product_id)
        .join(", ");

    return {
      "Order ID": order.order_id,

      "Order Date": formatDateTime(
        order.created_at
      ),

      "Customer ID":
        order.customer_id,

      "Customer Name":
        customer.name,

      "Customer Phone":
        customer.phone,

      "Customer Address":
        customer.address,

      "Product IDs":
        productIds,

      Products:
        productNames,

      Quantity:
        totalQuantity,

      Subtotal:
        Number(order.subtotal),

      GST:
        Number(order.gst_amount),

      "Order Total":
        Number(order.total_amount),

      "Paid Amount":
        Number(order.paid_amount),

      Balance:
        Math.max(
          0,
          Number(order.total_amount) -
            Number(order.paid_amount)
        ),

      "Payment Status":
        getPaymentLabel(
          order.payment_status
        ),

      "Order Status":
        getOrderStatusLabel(
          order.status
        ),

      "Last Updated":
        formatDateTime(
          order.updated_at
        ),
    };
  });

      const summaryRows = [
        {
          Metric: "Business",
          Value: "Sankar Enterprises",
        },
        {
          Metric: "Report start date",
          Value:
            formatDateOnly(startDate),
        },
        {
          Metric: "Report end date",
          Value:
            formatDateOnly(endDate),
        },
        {
          Metric: "Total orders",
          Value: summary.orderCount,
        },
        {
          Metric: "Total quantity",
          Value: summary.quantity,
        },
        {
          Metric: "Delivered orders",
          Value: summary.delivered,
        },
        {
          Metric: "Items subtotal",
          Value: summary.subtotal,
        },
        {
          Metric: "Total GST",
          Value: summary.gst,
        },
        {
          Metric: "Total order value",
          Value: summary.total,
        },
        {
          Metric: "Amount paid",
          Value: summary.paid,
        },
        {
          Metric:
            "Outstanding amount",
          Value: outstandingAmount,
        },
      ];

      const workbook =
        XLSX.utils.book_new();

      const summarySheet =
        XLSX.utils.json_to_sheet(
          summaryRows
        );

      const detailsSheet =
        XLSX.utils.json_to_sheet(
          orderDetailRows
        );

      summarySheet["!cols"] = [
        { wch: 25 },
        { wch: 25 },
      ];

      detailsSheet["!cols"] = [
        { wch: 14 },
        { wch: 21 },
        { wch: 14 },
        { wch: 22 },
        { wch: 16 },
        { wch: 30 },
        { wch: 14 },
        { wch: 25 },
        { wch: 18 },
        { wch: 12 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 15 },
        { wch: 16 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 21 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        summarySheet,
        "Summary"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        detailsSheet,
        "Order Details"
      );

      const fileName =
        `Sankar_Enterprises_Orders_` +
        `${startDate}_to_${endDate}.xlsx`;

      XLSX.writeFile(
        workbook,
        fileName
      );

      setMessage(
        "Excel report downloaded successfully."
      );
    } catch (downloadError) {
      console.error(downloadError);

      setError(
        "Unable to generate the Excel report."
      );
    }

    setDownloading(false);
  }

  return (
    <div className="min-h-full text-[#101828]">
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold text-[#009d8b]">
            Business reports
          </p>

          <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.04em]">
            Order reports
          </h1>

          <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#667085]">
            Select a date range to view matching
            orders and download complete order
            details in Excel.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void downloadExcelReport()
          }
          disabled={
            loading ||
            downloading ||
            orders.length === 0
          }
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#101828] px-4 py-3 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#1d2939] disabled:cursor-not-allowed disabled:bg-[#e4e7ec] disabled:text-[#98a2b3]"
        >
          <DownloadIcon className="h-4 w-4" />

          {downloading
            ? "Preparing Excel..."
            : "Download Excel"}
        </button>
      </section>

      <section className="rounded-[22px] border border-[#e1e7ea] bg-white p-5 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
          <label>
            <span className="mb-2 block text-[11px] font-semibold text-[#344054]">
              Start date
            </span>

            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) =>
                setStartDate(
                  event.target.value
                )
              }
              className={dateControlClass}
            />
          </label>

          <label>
            <span className="mb-2 block text-[11px] font-semibold text-[#344054]">
              End date
            </span>

            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) =>
                setEndDate(
                  event.target.value
                )
              }
              className={dateControlClass}
            />
          </label>

          <button
            type="button"
            onClick={() =>
              void loadReport()
            }
            disabled={loading}
            className="mt-auto h-12 rounded-xl bg-[#009d8b] px-6 text-[11px] font-semibold text-white transition hover:bg-[#008b7d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Loading..."
              : "Apply filter"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <DateShortcut
            label="Today"
            onClick={applyTodayFilter}
          />

          <DateShortcut
            label="Last 7 days"
            onClick={
              applyLastSevenDaysFilter
            }
          />

          <DateShortcut
            label="This month"
            onClick={
              applyCurrentMonthFilter
            }
          />

          <DateShortcut
            label="Reset"
            onClick={resetFilter}
          />
        </div>
      </section>

      {(error || message) && (
        <div
          className={`mt-5 rounded-xl border px-4 py-3 text-[12px] ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total orders"
          value={String(
            summary.orderCount
          )}
          colour="blue"
        />

        <MetricCard
          label="Total quantity"
          value={String(
            summary.quantity
          )}
          colour="purple"
        />

        <MetricCard
          label="GST collected"
          value={formatMoney(
            summary.gst
          )}
          colour="orange"
        />

        <MetricCard
          label="Order value"
          value={formatMoney(
            summary.total
          )}
          colour="green"
        />
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <SmallMetric
          label="Amount paid"
          value={formatMoney(
            summary.paid
          )}
        />

        <SmallMetric
          label="Outstanding"
          value={formatMoney(
            outstandingAmount
          )}
        />

        <SmallMetric
          label="Delivered orders"
          value={String(
            summary.delivered
          )}
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-[22px] border border-[#e1e7ea] bg-white shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-2 border-b border-[#edf1f2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[#101828]">
              Filtered orders
            </h2>

            <p className="mt-1 text-[10px] text-[#98a2b3]">
              {formatDateOnly(startDate)}
              {" to "}
              {formatDateOnly(endDate)}
            </p>
          </div>

          <p className="text-[10px] font-semibold text-[#009d8b]">
            {orders.length} matching{" "}
            {orders.length === 1
              ? "order"
              : "orders"}
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[13px] text-[#667085]">
            Loading report...
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center">
            <CalendarIcon className="mx-auto h-8 w-8 text-[#98a2b3]" />

            <p className="mt-4 text-[15px] font-semibold text-[#344054]">
              No orders found
            </p>

            <p className="mt-1 text-[11px] text-[#98a2b3]">
              Select another date range and apply
              the filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="border-b border-[#edf1f2] bg-[#fbfcfc] text-left">
                  <TableHeading label="Order" />
                  <TableHeading label="Date" />
                  <TableHeading label="Customer" />
                  <TableHeading label="Items" />
                  <TableHeading label="Qty" />
                  <TableHeading label="GST" />
                  <TableHeading label="Total" />
                  <TableHeading label="Payment" />
                  <TableHeading label="Status" />
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => {
                  const customer =
                    getCustomer(
                      order.users
                    );

                  const quantity =
                    order.order_items.reduce(
                      (total, item) =>
                        total +
                        Number(
                          item.quantity
                        ),
                      0
                    );

                  const itemDescription =
                    order.order_items
                      .map(
                        (item) =>
                          `${getProductName(
                            item
                          )} x${
                            item.quantity
                          }`
                      )
                      .join(", ");

                  return (
                    <tr
                      key={order.order_id}
                      className="border-b border-[#f0f2f3] last:border-0 hover:bg-[#fbfcfc]"
                    >
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-[10px] font-semibold tracking-wide text-[#2563eb]">
                          {order.order_id}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-[10px] text-[#667085]">
                        {formatDateTime(
                          order.created_at
                        )}
                      </td>

                      <td className="max-w-[190px] px-4 py-4">
                        <p className="truncate text-[11px] font-semibold text-[#344054]">
                          {customer.name}
                        </p>

                        <p className="mt-1 text-[9px] text-[#98a2b3]">
                          {order.customer_id}
                        </p>
                      </td>

                      <td className="max-w-[250px] px-4 py-4">
                        <p className="line-clamp-2 text-[10px] leading-4 text-[#667085]">
                          {itemDescription ||
                            "No items"}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-[11px] font-semibold text-[#344054]">
                        {quantity}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-[11px] text-[#667085]">
                        {formatMoney(
                          order.gst_amount
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-[11px] font-semibold text-[#101828]">
                        {formatMoney(
                          order.total_amount
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <PaymentBadge
                          status={
                            order.payment_status
                          }
                        />
                      </td>

                      <td className="px-4 py-4">
                        <OrderStatusBadge
                          status={
                            order.status
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function createExcelRow(
  order: ReportOrder,
  customer: {
    name: string;
    phone: string;
    address: string;
  },
  item: ReportOrderItem | null
) {
  const product = item
    ? getProduct(item.products)
    : null;

  const itemSubtotal = item
    ? Number(item.price_at_order) *
      Number(item.quantity)
    : 0;

  return {
    "Order ID": order.order_id,

    "Order Date": formatDateTime(
      order.created_at
    ),

    "Customer ID": order.customer_id,

    "Customer Name": customer.name,

    "Customer Phone": customer.phone,

    "Customer Address":
      customer.address,

    "Product ID":
      item?.product_id ?? "",

    "Product Name": item
      ? getProductName(item)
      : "",

    Category:
      product?.category ?? "",

    Quantity: item?.quantity ?? 0,

    "Unit Price": Number(
      item?.price_at_order ?? 0
    ),

    "Item Subtotal": itemSubtotal,

    "GST Rate (%)": Number(
      item?.gst_rate ?? 0
    ),

    "Item GST": Number(
      item?.gst_amount ?? 0
    ),

    "Item Total": Number(
      item?.line_total ?? 0
    ),

    "Order Subtotal": Number(
      order.subtotal ?? 0
    ),

    "Order GST": Number(
      order.gst_amount ?? 0
    ),

    "Order Total": Number(
      order.total_amount ?? 0
    ),

    "Paid Amount": Number(
      order.paid_amount ?? 0
    ),

    "Balance Amount": Math.max(
      0,
      Number(order.total_amount) -
        Number(order.paid_amount)
    ),

    "Payment Status":
      getPaymentLabel(
        order.payment_status
      ),

    "Order Status":
      getOrderStatusLabel(
        order.status
      ),

    "Last Updated": formatDateTime(
      order.updated_at
    ),
  };
}

function DateShortcut({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[#d8e0e4] bg-white px-3 py-2 text-[10px] font-semibold text-[#667085] transition hover:border-[#9ddbd4] hover:bg-[#f5fbfa] hover:text-[#008f80]"
    >
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  colour,
}: {
  label: string;
  value: string;
  colour:
    | "blue"
    | "purple"
    | "orange"
    | "green";
}) {
  const colourClasses = {
    blue: "bg-[#edf4ff] text-[#2563eb]",

    purple:
      "bg-[#faf0ff] text-[#a855f7]",

    orange:
      "bg-[#fff4e8] text-[#f97316]",

    green:
      "bg-[#eafbf7] text-[#009d8b]",
  };

  return (
    <article className="rounded-[20px] border border-[#e4e9ec] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-medium text-[#667085]">
        {label}
      </p>

      <div
        className={`mt-4 inline-flex rounded-xl px-3 py-2 text-[20px] font-semibold tracking-[-0.03em] ${colourClasses[colour]}`}
      >
        {value}
      </div>
    </article>
  );
}

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[18px] border border-[#e4e9ec] bg-white px-5 py-4 shadow-sm">
      <p className="text-[10px] font-medium text-[#98a2b3]">
        {label}
      </p>

      <p className="mt-2 text-[16px] font-semibold text-[#344054]">
        {value}
      </p>
    </article>
  );
}

function TableHeading({
  label,
}: {
  label: string;
}) {
  return (
    <th className="px-4 py-4 text-[9px] font-bold uppercase tracking-[0.12em] text-[#98a2b3]">
      {label}
    </th>
  );
}

function PaymentBadge({
  status,
}: {
  status: PaymentStatus;
}) {
  const styles: Record<
    PaymentStatus,
    string
  > = {
    NOT_PAID:
      "border-red-200 bg-red-50 text-red-700",

    PARTIALLY_PAID:
      "border-amber-200 bg-amber-50 text-amber-700",

    PAID:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[8px] font-semibold ${styles[status]}`}
    >
      {getPaymentLabel(status)}
    </span>
  );
}

function OrderStatusBadge({
  status,
}: {
  status: OrderStatus;
}) {
  const styles: Record<
    OrderStatus,
    string
  > = {
    PENDING:
      "border-amber-200 bg-amber-50 text-amber-700",

    IN_PROCESS:
      "border-amber-200 bg-amber-50 text-amber-700",

    PACKED:
      "border-purple-200 bg-purple-50 text-purple-700",

    IN_TRANSIT:
      "border-blue-200 bg-blue-50 text-blue-700",

    DELIVERED:
      "border-emerald-200 bg-emerald-50 text-emerald-700",

    CANCELLED:
      "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[8px] font-semibold ${styles[status]}`}
    >
      {getOrderStatusLabel(status)}
    </span>
  );
}

function getCustomer(
  users: CustomerDetails
) {
  const customer = Array.isArray(users)
    ? users[0]
    : users;

  return {
    name:
      customer?.name ?? "Customer",

    phone:
      customer?.phone ?? "-",

    address:
      customer?.address ??
      "Not available",
  };
}

function getProduct(
  products: ProductDetails
) {
  return Array.isArray(products)
    ? products[0]
    : products;
}

function getProductName(
  item: ReportOrderItem
) {
  if (item.product_name_snapshot) {
    return item.product_name_snapshot;
  }

  return (
    getProduct(item.products)
      ?.product_name ?? "Product"
  );
}

function getPaymentLabel(
  status: PaymentStatus
) {
  const labels: Record<
    PaymentStatus,
    string
  > = {
    NOT_PAID: "Not paid",

    PARTIALLY_PAID:
      "Partially paid",

    PAID: "Paid",
  };

  return labels[status];
}

function getOrderStatusLabel(
  status: OrderStatus
) {
  const labels: Record<
    OrderStatus,
    string
  > = {
    PENDING: "Pending",

    IN_PROCESS: "In process",

    PACKED: "Packed",

    IN_TRANSIT: "In transit",

    DELIVERED: "Delivered",

    CANCELLED: "Cancelled",
  };

  return labels[status];
}

function getTodayDate() {
  return toDateInputValue(
    new Date()
  );
}

function getFirstDayOfCurrentMonth() {
  const today = new Date();

  const firstDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    1
  );

  return toDateInputValue(firstDay);
}

function toDateInputValue(
  date: Date
) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStartOfDateIso(
  dateValue: string
) {
  return new Date(
    `${dateValue}T00:00:00`
  ).toISOString();
}

function getNextDateStartIso(
  dateValue: string
) {
  const date = new Date(
    `${dateValue}T00:00:00`
  );

  date.setDate(
    date.getDate() + 1
  );

  return date.toISOString();
}

function formatDateOnly(
  dateValue: string
) {
  if (!dateValue) {
    return "-";
  }

  const date = new Date(
    `${dateValue}T00:00:00`
  );

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatDateTime(
  value: string
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function formatMoney(
  value: number | string | null
) {
  return `₹${Number(
    value ?? 0
  ).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function DownloadIcon({
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
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function CalendarIcon({
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
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
      />

      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

const dateControlClass =
  "h-12 w-full rounded-xl border border-[#dfe5e8] bg-[#fbfcfc] px-4 text-[12px] text-[#101828] outline-none transition focus:border-[#81cdc5] focus:bg-white focus:ring-4 focus:ring-[#e6f6f3]";