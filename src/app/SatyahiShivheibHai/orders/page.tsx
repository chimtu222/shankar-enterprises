"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  product_id: string;
  product_name_snapshot: string | null;
  quantity: number;
  price_at_order: number;
  gst_rate: number;
  gst_amount: number;
  line_total: number;
  products:
  | {
    product_name: string;
  }
  | {
    product_name: string;
  }[]
  | null;
};

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

type Order = {
  order_id: string;
  customer_id: string;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  paid_amount: number;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  users: CustomerDetails;
  order_items: OrderItem[];
};
type NewOrderNotification = {
  order_id: string;
  customer_id: string;
  customer_name: string;
  total_amount: number;
};
const ORDER_STATUSES: {
  value: OrderStatus;
  label: string;
}[] = [
    {
      value: "PENDING",
      label: "Pending",
    },
    {
      value: "IN_PROCESS",
      label: "In process",
    },
    {
      value: "PARTIAL",
      label: "Partial",
    },
    {
      value: "DELIVERED",
      label: "Delivered",
    },
    {
      value: "CANCELLED",
      label: "Cancelled",
    },
  ];

const PAYMENT_STATUSES: {
  value: PaymentStatus;
  label: string;
}[] = [
    {
      value: "NOT_PAID",
      label: "Not paid",
    },
    {
      value: "PARTIALLY_PAID",
      label: "Partially paid",
    },
    {
      value: "PAID",
      label: "Paid",
    },
  ];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");

  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [noteOrder, setNoteOrder] = useState<Order | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deleteOrder, setDeleteOrder] = useState<Order | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);

  const [newOrderNotification, setNewOrderNotification,] = useState<NewOrderNotification | null>(null);

  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());

  const loadOrders = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setLoading(true);
      }

      const { data, error: loadError } =
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
            admin_note,
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
                product_name
              )
            )
          `)
          .order("created_at", {
            ascending: false,
          });

      if (loadError) {
        console.error(loadError);
        setError(loadError.message);
        setOrders([]);
      } else {
        setOrders(
          (data ?? []) as unknown as Order[]
        );

        setError("");
      }

      if (showLoader) {
        setLoading(false);
      }
    },
    []
  );

  const showNewOrderNotification = useCallback(
    async (orderId: string) => {
      if (
        notifiedOrderIdsRef.current.has(orderId)
      ) {
        return;
      }

      notifiedOrderIdsRef.current.add(orderId);

      /*
        The checkout RPC first inserts the order and
        then calculates its GST and total.
  
        This short delay allows the transaction to
        finish before loading the notification details.
      */
      await new Promise((resolve) => {
        window.setTimeout(resolve, 700);
      });

      const { data, error: notificationError } =
        await supabase
          .from("orders")
          .select(`
          order_id,
          customer_id,
          total_amount,
          users!orders_customer_fk (
            name
          )
        `)
          .eq("order_id", orderId)
          .single();

      if (notificationError || !data) {
        console.error(
          "Unable to load new order notification:",
          notificationError
        );

        setNewOrderNotification({
          order_id: orderId,
          customer_id: "",
          customer_name: "Customer",
          total_amount: 0,
        });
      } else {
        const relatedCustomer = Array.isArray(
          data.users
        )
          ? data.users[0]
          : data.users;

        setNewOrderNotification({
          order_id: data.order_id,
          customer_id: data.customer_id,
          customer_name:
            relatedCustomer?.name ?? "Customer",
          total_amount: Number(
            data.total_amount ?? 0
          ),
        });
      }

      if (notificationTimerRef.current) {
        window.clearTimeout(
          notificationTimerRef.current
        );
      }

      notificationTimerRef.current =
        setTimeout(() => {
          setNewOrderNotification(null);
          notificationTimerRef.current = null;
        }, 7000);
    },
    []
  );
  useEffect(() => {
    void loadOrders(true);

    const channelName = `admin-live-orders-${Date.now()}`;

    const orderChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log(
            "NEW ORDER INSERT EVENT:",
            payload
          );

          const insertedOrder = payload.new as {
            order_id?: string;
          };

          void loadOrders(false);

          if (insertedOrder.order_id) {
            void showNewOrderNotification(
              insertedOrder.order_id
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log(
            "ORDER UPDATE EVENT:",
            payload
          );

          void loadOrders(false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "orders",
        },
        () => {
          void loadOrders(false);
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
          void loadOrders(false);
        }
      )
      .subscribe((status, subscribeError) => {
        console.log(
          "ORDERS REALTIME STATUS:",
          status
        );

        if (subscribeError) {
          console.error(
            "ORDERS REALTIME ERROR:",
            subscribeError
          );
        }

        if (status === "SUBSCRIBED") {
          console.log(
            "Admin order notifications are ready"
          );
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          setError(
            "Order notification connection failed. Refresh the page and try again."
          );
        }
      });

    return () => {
      if (notificationTimerRef.current) {
        window.clearTimeout(
          notificationTimerRef.current
        );

        notificationTimerRef.current = null;
      }

      void supabase.removeChannel(orderChannel);
    };
  }, [
    loadOrders,
    showNewOrderNotification,
  ]);

  const filteredOrders = useMemo(() => {
    const searchValue =
      search.trim().toLowerCase();

    return orders.filter((order) => {
      const customer = getCustomer(order.users);

      const itemText = order.order_items
        .map((item) =>
          getProductName(item).toLowerCase()
        )
        .join(" ");

      const matchesSearch =
        searchValue === "" ||
        order.order_id
          .toLowerCase()
          .includes(searchValue) ||
        order.customer_id
          .toLowerCase()
          .includes(searchValue) ||
        customer.name
          .toLowerCase()
          .includes(searchValue) ||
        customer.phone.includes(searchValue) ||
        itemText.includes(searchValue);

      const matchesOrderStatus =
        statusFilter === "ALL" ||
        order.status === statusFilter;

      const matchesPaymentStatus =
        paymentFilter === "ALL" ||
        order.payment_status === paymentFilter;

      return (
        matchesSearch &&
        matchesOrderStatus &&
        matchesPaymentStatus
      );
    });
  }, [
    orders,
    search,
    statusFilter,
    paymentFilter,
  ]);

  const statistics = useMemo(() => {
    return {
      total: orders.length,

      pending: orders.filter(
        (order) =>
          order.status === "PENDING" ||
          order.status === "IN_PROCESS"
      ).length,

      transit: orders.filter(
        (order) =>
          order.status === "PARTIAL"
      ).length,

      delivered: orders.filter(
        (order) =>
          order.status === "DELIVERED"
      ).length,
    };
  }, [orders]);

  async function updateOrderStatus(
    order: Order,
    newStatus: OrderStatus
  ) {
    if (order.status === newStatus) {
      return;
    }

    setUpdatingOrderId(order.order_id);
    setError("");
    setMessage("");

    try {
      const { error: updateError } =
        await supabase.rpc(
          "change_order_status",
          {
            p_order_id: order.order_id,
            p_new_status: newStatus,
          }
        );

      if (updateError) {
        throw updateError;
      }

      if (
        order.status !== "CANCELLED" &&
        newStatus === "CANCELLED"
      ) {
        setMessage(
          `${order.order_id} cancelled. Ordered quantities were returned to stock.`
        );
      } else if (
        order.status === "CANCELLED" &&
        newStatus !== "CANCELLED"
      ) {
        setMessage(
          `${order.order_id} reactivated. Ordered quantities were deducted from stock again.`
        );
      } else {
        setMessage(
          `${order.order_id} order status updated.`
        );
      }

      await loadOrders(false);
    } catch (statusError) {
      console.error(
        "Unable to update order status:",
        statusError
      );

      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to update the order status."
      );

      await loadOrders(false);
    } finally {
      setUpdatingOrderId(null);
    }
  }


  async function updatePaymentStatus(
    order: Order,
    newStatus: PaymentStatus
  ) {
    setError("");
    setMessage("");

    let paidAmount = Number(order.paid_amount);

    if (newStatus === "NOT_PAID") {
      paidAmount = 0;
    }

    if (newStatus === "PAID") {
      paidAmount = Number(order.total_amount);
    }

    if (newStatus === "PARTIALLY_PAID") {
      const enteredAmount = window.prompt(
        `Enter the amount received for ${order.order_id}. Total order amount is ₹${formatMoney(
          order.total_amount
        )}`,
        String(
          Number(order.paid_amount) > 0
            ? order.paid_amount
            : ""
        )
      );

      if (enteredAmount === null) {
        return;
      }

      const numericAmount =
        Number(enteredAmount);

      if (
        Number.isNaN(numericAmount) ||
        numericAmount <= 0 ||
        numericAmount >=
        Number(order.total_amount)
      ) {
        setError(
          `Partial payment must be greater than ₹0 and less than ₹${formatMoney(
            order.total_amount
          )}.`
        );

        return;
      }

      paidAmount = numericAmount;
    }

    setUpdatingOrderId(order.order_id);

    const { error: updateError } =
      await supabase
        .from("orders")
        .update({
          payment_status: newStatus,
          paid_amount: paidAmount,
        })
        .eq("order_id", order.order_id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage(
        `${order.order_id} payment status updated.`
      );

      await loadOrders(false);
    }

    setUpdatingOrderId(null);
  }
  function openOrderNote(order: Order) {
    setNoteOrder(order);
    setNoteText(order.admin_note ?? "");
    setError("");
    setMessage("");
  }

  function closeOrderNote() {
    if (savingNote) {
      return;
    }

    setNoteOrder(null);
    setNoteText("");
  }

  async function saveOrderNote() {
    if (!noteOrder) {
      return;
    }

    setSavingNote(true);
    setError("");
    setMessage("");

    const cleanedNote =
      noteText.trim();

    const { error: noteError } =
      await supabase
        .from("orders")
        .update({
          admin_note:
            cleanedNote === ""
              ? null
              : cleanedNote,
        })
        .eq(
          "order_id",
          noteOrder.order_id
        );

    if (noteError) {
      console.error(noteError);
      setError(noteError.message);
      setSavingNote(false);
      return;
    }

    setMessage(
      cleanedNote
        ? `Note saved for ${noteOrder.order_id}.`
        : `Note removed from ${noteOrder.order_id}.`
    );

    setNoteOrder(null);
    setNoteText("");
    setSavingNote(false);

    await loadOrders(false);
  }
  function openDeleteOrder(order: Order) {
    setDeleteOrder(order);
    setDeleteConfirmation(false);
    setError("");
    setMessage("");
  }

  function closeDeleteOrder() {
    if (deletingOrder) {
      return;
    }

    setDeleteOrder(null);
    setDeleteConfirmation(false);
  }

  async function permanentlyDeleteOrder() {
  if (
    !deleteOrder ||
    !deleteConfirmation ||
    deletingOrder
  ) {
    return;
  }

  const orderToDelete = deleteOrder;
  const orderId = orderToDelete.order_id;

  setDeletingOrder(true);
  setError("");
  setMessage("");

  try {
    const {
      data,
      error: rpcError,
    } = await supabase.rpc(
      "delete_order_permanently",
      {
        p_order_id: orderId,
      }
    );

    console.log(
      "DELETE ORDER RPC RESULT:",
      {
        orderId,
        data,
        rpcError,
      }
    );

    if (rpcError) {
      console.error(
        "DELETE ORDER RPC ERROR DETAILS:",
        {
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
          code: rpcError.code,
        }
      );

      const completeErrorMessage = [
        rpcError.message,
        rpcError.details,
        rpcError.hint,
        rpcError.code
          ? `Error code: ${rpcError.code}`
          : "",
      ]
        .filter(Boolean)
        .join(" ");

      setError(
        completeErrorMessage ||
          "Unable to permanently delete the order."
      );

      return;
    }

    setOrders((currentOrders) =>
      currentOrders.filter(
        (order) =>
          order.order_id !== orderId
      )
    );

    setDeleteOrder(null);
    setDeleteConfirmation(false);

    setMessage(
      orderToDelete.status === "CANCELLED"
        ? `${orderId} has been permanently deleted. Stock was already restored when this order was cancelled.`
        : `${orderId} has been permanently deleted and all ordered quantities were returned to stock.`
    );

    await loadOrders(false);
  } catch (unexpectedError: unknown) {
    console.error(
      "UNEXPECTED DELETE ORDER ERROR:",
      unexpectedError
    );

    let errorMessage =
      "An unexpected error occurred while deleting the order.";

    if (
      unexpectedError &&
      typeof unexpectedError === "object"
    ) {
      const possibleError =
        unexpectedError as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };

      errorMessage = [
        possibleError.message,
        possibleError.details,
        possibleError.hint,
        possibleError.code
          ? `Error code: ${possibleError.code}`
          : "",
      ]
        .filter(Boolean)
        .join(" ");

      if (!errorMessage) {
        errorMessage =
          JSON.stringify(unexpectedError);
      }
    } else if (
      typeof unexpectedError === "string"
    ) {
      errorMessage = unexpectedError;
    }

    setError(errorMessage);
  } finally {
    setDeletingOrder(false);
  }
}
  async function downloadBill(order: Order) {
    try {
      const { jsPDF } = await import("jspdf");

      const customer = getCustomer(order.users);

      const itemSpace = order.order_items.reduce(
        (total, item) => {
          const itemName = getProductName(item);

          const estimatedNameLines = Math.max(
            1,
            Math.ceil(itemName.length / 28)
          );

          return total + estimatedNameLines * 4 + 12;
        },
        0
      );

      const receiptHeight =
        Math.max(
          220,
          170 + itemSpace
        );

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [100, receiptHeight],
        compress: true,
      });
      const logo = new Image();
      logo.src = "/SE_logo.png";

      await new Promise((resolve) => {
        logo.onload = resolve;
      });

      const pageWidth = 100;
      const left = 6;
      const right = 94;
      const centre = 50;

      let y = 7;

      function drawLine(
        lineY: number,
        colour = 220
      ) {
        pdf.setDrawColor(
          colour,
          colour,
          colour
        );

        pdf.setLineWidth(0.25);

        pdf.line(
          left,
          lineY,
          right,
          lineY
        );
      }

      function drawDottedLine(
        lineY: number
      ) {
        pdf.setDrawColor(190, 198, 204);
        pdf.setLineDashPattern([1, 1], 0);
        pdf.line(left, lineY, right, lineY);
        pdf.setLineDashPattern([], 0);
      }

      function money(
        value: number | string | null
      ) {
        return `Rs. ${Number(
          value ?? 0
        ).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }

      function printLabelValue(
        label: string,
        value: string,
        lineY: number,
        boldValue = false
      ) {
        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(6.6);

        pdf.setTextColor(102, 112, 133);

        pdf.text(
          label.toUpperCase(),
          left,
          lineY
        );

        pdf.setFont(
          "helvetica",
          boldValue ? "bold" : "normal"
        );

        pdf.setTextColor(29, 41, 57);

        pdf.text(
          value,
          right,
          lineY,
          {
            align: "right",
            maxWidth: 45,
          }
        );
      }

      // =================================================
      // LOGO
      // =================================================

      pdf.addImage(
        logo,
        "PNG",
        35,
        y,
        30,
        18
      );

      y += 24;

      // =================================================
      // BUSINESS HEADER
      // =================================================

      pdf.setTextColor(16, 24, 40);

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(11);

      pdf.text(
        "SHANKAR ENTERPRISES",
        centre,
        y,
        {
          align: "center",
        }
      );

      y += 4.5;

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(6.3);

      pdf.setTextColor(102, 112, 133);

      pdf.text(
        "SANITARY & BATHROOM SOLUTIONS",
        centre,
        y,
        {
          align: "center",
        }
      );

      y += 4;

      pdf.setFontSize(5.8);

      pdf.setTextColor(152, 162, 179);

      pdf.text(
        "Retail Invoice",
        centre,
        y,
        {
          align: "center",
        }
      );

      y += 5;

      drawLine(y);

      y += 5;

      // =================================================
      // ORDER DETAILS
      // =================================================

      pdf.setFillColor(245, 248, 248);

      pdf.roundedRect(
        left,
        y,
        right - left,
        16,
        2,
        2,
        "F"
      );

      pdf.setTextColor(0, 143, 128);

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(7.3);

      pdf.text(
        "ORDER",
        left + 3,
        y + 4.5
      );

      pdf.setTextColor(16, 24, 40);

      pdf.setFontSize(9);

      pdf.text(
        order.order_id,
        left + 3,
        y + 10
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(6.3);

      pdf.setTextColor(102, 112, 133);

      pdf.text(
        formatDate(order.created_at),
        right - 3,
        y + 10,
        {
          align: "right",
        }
      );

      y += 21;

      // =================================================
      // CUSTOMER DETAILS
      // =================================================

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(6.8);

      pdf.setTextColor(16, 24, 40);

      pdf.text(
        "BILL TO",
        left,
        y
      );

      y += 4;

      pdf.setFontSize(8);

      pdf.text(
        customer.name ||
        "Customer",
        left,
        y
      );

      y += 4;

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(6.5);

      pdf.setTextColor(71, 84, 103);

      pdf.text(
        `Phone: ${customer.phone || "-"
        }`,
        left,
        y
      );

      y += 4;

      const addressLines =
        pdf.splitTextToSize(
          customer.address ||
          "Address not available",
          66
        );

      pdf.text(
        addressLines,
        left,
        y
      );

      y +=
        Math.max(
          addressLines.length,
          1
        ) *
        3.3 +
        3;

      drawLine(y);

      y += 5;

      // =================================================
      // ITEM HEADER
      // =================================================

      pdf.setFillColor(16, 24, 40);

      pdf.roundedRect(
        left,
        y,
        right - left,
        7,
        1.5,
        1.5,
        "F"
      );

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(6.2);

      pdf.setTextColor(255, 255, 255);

      pdf.text(
        "ITEM DETAILS",
        left + 3,
        y + 4.5
      );

      pdf.text(
        "AMOUNT",
        right - 3,
        y + 4.5,
        {
          align: "right",
        }
      );

      y += 12;

      // =================================================
      // ORDER ITEMS
      // =================================================

      order.order_items.forEach(
        (item, index) => {
          const itemName =
            getProductName(item);

          const itemNameLines =
            pdf.splitTextToSize(
              itemName,
              45
            );

          pdf.setFont(
            "helvetica",
            "bold"
          );

          pdf.setFontSize(7.4);

          pdf.setTextColor(
            29,
            41,
            57
          );

          pdf.text(
            itemNameLines,
            left,
            y
          );

          pdf.text(
            money(item.line_total),
            right,
            y,
            {
              align: "right",
            }
          );

          y +=
            Math.max(
              itemNameLines.length,
              1
            ) * 3.5;

          pdf.setFont(
            "helvetica",
            "normal"
          );

          pdf.setFontSize(6.2);

          pdf.setTextColor(
            102,
            112,
            133
          );

          pdf.text(
            `${item.quantity} x ${money(
              item.price_at_order
            )}`,
            left,
            y
          );

          y += 3.5;

          pdf.text(
            `GST ${Number(
              item.gst_rate ?? 0
            ).toFixed(2)}%`,
            left,
            y
          );

          pdf.text(
            money(item.gst_amount),
            right,
            y,
            {
              align: "right",
            }
          );

          y += 4;

          if (
            index <
            order.order_items.length - 1
          ) {
            drawDottedLine(y);

            y += 5;
          }
        }
      );

      y += 1;

      drawLine(y);

      y += 6;

      // =================================================
      // TOTALS
      // =================================================

      printLabelValue(
        "Subtotal",
        money(order.subtotal),
        y
      );

      y += 5;

      printLabelValue(
        "GST",
        money(order.gst_amount),
        y
      );

      y += 5;

      pdf.setFillColor(234, 251, 247);

      pdf.roundedRect(
        left,
        y,
        right - left,
        12,
        2,
        2,
        "F"
      );

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(8);

      pdf.setTextColor(0, 111, 101);

      pdf.text(
        "GRAND TOTAL",
        left + 3,
        y + 7.5
      );

      pdf.setFontSize(9.5);

      pdf.text(
        money(order.total_amount),
        right - 3,
        y + 7.5,
        {
          align: "right",
        }
      );

      y += 17;

      printLabelValue(
        "Paid amount",
        money(order.paid_amount),
        y,
        true
      );

      y += 5;

      const balanceAmount =
        Math.max(
          0,
          Number(order.total_amount) -
          Number(order.paid_amount)
        );

      printLabelValue(
        "Balance",
        money(balanceAmount),
        y,
        true
      );

      y += 6;

      drawLine(y);

      y += 6;

      // =================================================
      // STATUS SECTION
      // =================================================

      pdf.setFillColor(248, 250, 251);

      pdf.roundedRect(
        left,
        y,
        right - left,
        18,
        2,
        2,
        "F"
      );

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(6.2);

      pdf.setTextColor(
        102,
        112,
        133
      );

      pdf.text(
        "PAYMENT STATUS",
        left + 3,
        y + 5
      );

      pdf.text(
        "ORDER STATUS",
        left + 3,
        y + 12.5
      );

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setTextColor(
        29,
        41,
        57
      );

      pdf.text(
        getPaymentLabel(
          order.payment_status
        ).toUpperCase(),
        right - 3,
        y + 5,
        {
          align: "right",
        }
      );

      pdf.text(
        getOrderStatusLabel(
          order.status
        ).toUpperCase(),
        right - 3,
        y + 12.5,
        {
          align: "right",
        }
      );

      y += 23;

      // =================================================
      // FOOTER
      // =================================================

      pdf.setFont(
        "helvetica",
        "bold"
      );

      pdf.setFontSize(7.2);

      pdf.setTextColor(16, 24, 40);

      pdf.text(
        "THANK YOU FOR SHOPPING WITH US",
        centre,
        y,
        {
          align: "center",
        }
      );

      y += 4;

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(5.8);

      pdf.setTextColor(
        152,
        162,
        179
      );

      pdf.text(
        "Please keep this invoice for future reference.",
        centre,
        y,
        {
          align: "center",
        }
      );

      y += 4;

      pdf.text(
        `Invoice generated for ${order.order_id}`,
        centre,
        y,
        {
          align: "center",
        }
      );
      y += 10;

      pdf.save(
        `${order.order_id}-bill.pdf`
      );
    } catch (billError) {
      console.error(billError);

      setError(
        "Unable to generate the bill. Please try again."
      );
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
  }

  return (
    <div className="text-[#101828]">
      {deleteOrder && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-[#101828]/50 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeDeleteOrder();
            }
          }}
        >
          <section className="w-full max-w-[450px] overflow-hidden rounded-[24px] border border-red-100 bg-white shadow-[0_30px_90px_rgba(16,24,40,0.30)]">
            <div className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <DeleteIcon className="h-6 w-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-600">
                    Permanent deletion
                  </p>

                  <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-[#101828]">
                    Delete this order?
                  </h2>

                  <p className="mt-2 text-[12px] leading-5 text-[#667085]">
                    Order{" "}
                    <span className="font-semibold text-[#344054]">
                      {deleteOrder.order_id}
                    </span>{" "}
                    will be permanently deleted. This
                    action cannot be undone.
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Close delete confirmation"
                  onClick={closeDeleteOrder}
                  disabled={deletingOrder}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[20px] leading-none text-[#98a2b3] transition hover:bg-[#f2f4f7] hover:text-[#475467] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ×
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
                <p className="text-[11px] font-semibold text-red-800">
                  What will happen?
                </p>

                <ul className="mt-2 space-y-2 text-[10px] leading-4 text-red-700">
                  <li className="flex items-start gap-2">
                    <span>•</span>

                    <span>
                      The order and all its items will
                      be removed from the database.
                    </span>
                  </li>

                  <li className="flex items-start gap-2">
                    <span>•</span>

                    <span>
                      It will disappear from Admin
                      Orders, customer order history
                      and reports.
                    </span>
                  </li>

                  <li className="flex items-start gap-2">
                    <span>•</span>

                    <span>
                      {deleteOrder.status ===
                        "CANCELLED"
                        ? "This order is already cancelled, so its stock will not be added again."
                        : "All ordered product quantities will be returned to stock."}
                    </span>
                  </li>
                </ul>
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#e1e7ea] bg-[#f8faf9] px-4 py-3">
                <input
                  type="checkbox"
                  checked={deleteConfirmation}
                  disabled={deletingOrder}
                  onChange={(event) =>
                    setDeleteConfirmation(
                      event.target.checked
                    )
                  }
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-red-600 disabled:cursor-not-allowed"
                />

                <span className="text-[10px] leading-4 text-[#475467]">
                  I understand that{" "}
                  <strong>
                    {deleteOrder.order_id}
                  </strong>{" "}
                  will be permanently deleted and
                  cannot be recovered.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#edf1f2] bg-[#fbfcfc] px-6 py-4">
              <button
                type="button"
                onClick={closeDeleteOrder}
                disabled={deletingOrder}
                className="rounded-xl border border-[#d8e0e4] bg-white px-5 py-2.5 text-[10px] font-semibold text-[#475467] transition hover:bg-[#f8faf9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                No, keep order
              </button>

              <button
                type="button"
                onClick={() =>
                  void permanentlyDeleteOrder()
                }
                disabled={
                  !deleteConfirmation ||
                  deletingOrder
                }
                className="inline-flex min-w-[165px] items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-[10px] font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {deletingOrder && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}

                {deletingOrder
                  ? "Deleting..."
                  : "Yes, permanently delete"}
              </button>
            </div>
          </section>
        </div>
      )}
      {newOrderNotification && (
        <div className="fixed right-5 top-5 z-[100] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[20px] border border-[#b7e4dc] bg-white shadow-[0_24px_60px_rgba(16,24,40,0.20)]">
          <div className="h-1 bg-gradient-to-r from-[#009d8b] to-[#5dd7ca]" />

          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eafbf7] text-[#008f80]">
                <NotificationBellIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#009d8b]">
                      New order received
                    </p>

                    <p className="mt-1 text-[16px] font-semibold text-[#101828]">
                      {newOrderNotification.order_id}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Close notification"
                    onClick={() => {
                      if (
                        notificationTimerRef.current
                      ) {
                        window.clearTimeout(
                          notificationTimerRef.current
                        );

                        notificationTimerRef.current =
                          null;
                      }

                      setNewOrderNotification(null);
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[18px] leading-none text-[#98a2b3] transition hover:bg-[#f2f4f7] hover:text-[#475467]"
                  >
                    ×
                  </button>
                </div>

                <p className="mt-2 truncate text-[12px] font-medium text-[#475467]">
                  {
                    newOrderNotification.customer_name
                  }
                </p>

                {newOrderNotification.customer_id && (
                  <p className="mt-0.5 text-[9px] text-[#98a2b3]">
                    {
                      newOrderNotification.customer_id
                    }
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f7faf9] px-3 py-2.5">
                  <span className="text-[10px] font-medium text-[#667085]">
                    Order value
                  </span>

                  <span className="text-[13px] font-semibold text-[#101828]">
                    ₹
                    {formatMoney(
                      newOrderNotification.total_amount
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSearch(
                      newOrderNotification.order_id
                    );

                    setStatusFilter("ALL");
                    setPaymentFilter("ALL");
                    setNewOrderNotification(null);

                    if (
                      notificationTimerRef.current
                    ) {
                      window.clearTimeout(
                        notificationTimerRef.current
                      );

                      notificationTimerRef.current =
                        null;
                    }

                    window.setTimeout(() => {
                      document
                        .getElementById(
                          "admin-orders-table"
                        )
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }, 100);
                  }}
                  className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#008f80] transition hover:text-[#006f65]"
                >
                  View this order
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {noteOrder && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[#101828]/40 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeOrderNote();
            }
          }}
        >
          <section className="w-full max-w-[460px] overflow-hidden rounded-[24px] border border-[#e1e7ea] bg-white shadow-[0_30px_80px_rgba(16,24,40,0.25)]">
            <div className="flex items-start justify-between border-b border-[#edf1f2] px-6 py-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#009d8b]">
                  Internal order note
                </p>

                <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-[#101828]">
                  {noteOrder.order_id}
                </h2>

                <p className="mt-1 text-[11px] text-[#667085]">
                  Visible only to the Admin.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close note"
                onClick={closeOrderNote}
                disabled={savingNote}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[20px] leading-none text-[#98a2b3] transition hover:bg-[#f2f4f7] hover:text-[#475467] disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <label>
                <span className="mb-2 block text-[11px] font-semibold text-[#344054]">
                  Note or reminder
                </span>

                <textarea
                  value={noteText}
                  onChange={(event) =>
                    setNoteText(
                      event.target.value
                    )
                  }
                  maxLength={1000}
                  rows={7}
                  autoFocus
                  placeholder="Example: Customer ordered 10 pieces. Delivered 8 pieces; remaining 2 pieces will be delivered later."
                  className="w-full resize-none rounded-2xl border border-[#dfe5e8] bg-[#fbfcfc] px-4 py-3 text-[13px] leading-6 text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#81cdc5] focus:bg-white focus:ring-4 focus:ring-[#e6f6f3]"
                />
              </label>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-[9px] text-[#98a2b3]">
                  The note stays saved against this order.
                </p>

                <p className="text-[9px] text-[#98a2b3]">
                  {noteText.length}/1000
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={
                    savingNote ||
                    !noteOrder.admin_note
                  }
                  onClick={() => {
                    setNoteText("");
                  }}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[10px] font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear note
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeOrderNote}
                    disabled={savingNote}
                    className="rounded-xl border border-[#d8e0e4] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#667085] transition hover:bg-[#f8faf9] disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={savingNote}
                    onClick={() =>
                      void saveOrderNote()
                    }
                    className="rounded-xl bg-[#101828] px-5 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#1d2939] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingNote
                      ? "Saving..."
                      : noteText.trim()
                        ? "Save note"
                        : "Remove note"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold text-[#009d8b]">
            Order management
          </p>

          <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.04em]">
            Orders
          </h1>

          <p className="mt-2 text-[13px] text-[#667085]">
            Track customer orders, payment and
            delivery status from one place.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadOrders(true)
          }
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#d8e0e4] bg-white px-4 py-2.5 text-[12px] font-semibold text-[#475467] shadow-sm transition hover:border-[#9ddbd4] hover:bg-[#f5fbfa] hover:text-[#008f80]"
        >
          <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M20 6v5h-5" />
              <path d="M4 18v-5h5" />
              <path d="M6.1 9a7 7 0 0 1 11.7-2.6L20 11" />
              <path d="M17.9 15a7 7 0 0 1-11.7 2.6L4 13" />
            </svg>
          Refresh Orders
        </button>
      </section>

      <OrderSummary
        total={statistics.total}
        pending={statistics.pending}
        transit={statistics.transit}
        delivered={statistics.delivered}
      />

      {(error || message) && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-[12px] ${error
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
        >
          {error || message}
        </div>
      )}

      <section className="mb-5 rounded-[20px] border border-[#e1e7ea] bg-white p-4 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
        <div className="grid gap-3 md:grid-cols-[1fr_190px_190px_auto]">
          <input
            type="search"
            placeholder="Search Order ID, name, phone or item"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className={controlClass}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
            className={controlClass}
          >
            <option value="ALL">
              All order statuses
            </option>

            {ORDER_STATUSES.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>

          <select
            value={paymentFilter}
            onChange={(event) =>
              setPaymentFilter(
                event.target.value
              )
            }
            className={controlClass}
          >
            <option value="ALL">
              All payment statuses
            </option>

            {PAYMENT_STATUSES.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-[#d8e0e4] bg-white px-4 py-3 text-[12px] font-semibold text-[#475467] transition hover:bg-[#f8faf9]"
          >
            Clear
          </button>
        </div>
      </section>

      <section id="admin-orders-table" className="scroll-mt-24 overflow-hidden rounded-[22px] border border-[#e1e7ea] bg-white shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
        <div className="flex items-center justify-between border-b border-[#edf1f2] px-5 py-4">
          <p className="text-[12px] text-[#667085]">
            Showing {filteredOrders.length} of{" "}
            {orders.length} orders
          </p>

          <div className="hidden items-center gap-2 text-[10px] font-semibold text-[#009d8b] sm:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#00a999]" />

            Live orders
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[13px] text-[#667085]">
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[15px] font-semibold text-[#344054]">
              No orders found
            </p>

            <p className="mt-1 text-[12px] text-[#98a2b3]">
              New customer orders will appear here
              automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse">
              <thead>
                <tr className="border-b border-[#edf1f2] bg-[#fbfcfc] text-left">
                  <TableHeading label="Order" />

                  <TableHeading label="Customer" />

                  <TableHeading label="Items" />

                  <TableHeading label="Amount" />

                  <TableHeading label="Payment" />

                  <TableHeading label="Status" />

                  <TableHeading label="Date" />

                  <TableHeading label="Actions" />
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map(
                  (order) => (
                    <OrderRow
                      key={order.order_id}
                      order={order}
                      updating={
                        updatingOrderId ===
                        order.order_id
                      }
                      onStatusChange={
                        updateOrderStatus
                      }
                      onPaymentChange={
                        updatePaymentStatus
                      }
                      onDownloadBill={
                        downloadBill
                      }
                      onOpenNote={
                        openOrderNote
                      }
                      onDeleteOrder={
                        openDeleteOrder
                      }
                    />
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function OrderSummary({
  total,
  pending,
  transit,
  delivered,
}: {
  total: number;
  pending: number;
  transit: number;
  delivered: number;
}) {
  const cards = [
    {
      label: "Total orders",
      value: total,
      colour:
        "bg-[#edf4ff] text-[#2563eb]",
    },
    {
      label: "Pending",
      value: pending,
      colour:
        "bg-[#fff4e8] text-[#f97316]",
    },
    {
      label: "Partial",
      value: transit,
      colour:
        "bg-[#f0f9ff] text-[#0284c7]",
    },
    {
      label: "Delivered",
      value: delivered,
      colour:
        "bg-[#eafbf7] text-[#009d8b]",
    },
  ];

  return (
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-[20px] border border-[#e4e9ec] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_8px_20px_rgba(16,24,40,0.045)]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] font-medium text-[#667085]">
                {card.label}
              </p>

              <p className="mt-3 text-[28px] font-semibold leading-none tracking-[-0.04em] text-[#101828]">
                {card.value}
              </p>
            </div>

            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-[12px] font-bold ${card.colour}`}
            >
              {card.value}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function OrderRow({
  order,
  updating,
  onStatusChange,
  onPaymentChange,
  onDownloadBill,
  onOpenNote,
  onDeleteOrder,
}: {
  order: Order;
  updating: boolean;
  onStatusChange: (
    order: Order,
    status: OrderStatus
  ) => Promise<void>;
  onPaymentChange: (
    order: Order,
    status: PaymentStatus
  ) => Promise<void>;
  onDownloadBill: (
    order: Order
  ) => Promise<void>;
  onOpenNote: (
    order: Order
  ) => void;
  onDeleteOrder: (
    order: Order
  ) => void;
}) {
  const customer =
    getCustomer(order.users);

  return (
    <tr className="border-b border-[#f0f2f3] align-top transition duration-200 last:border-0 hover:bg-[#fafdfd]">
      <td className="px-5 py-5">
        <p className="inline-flex rounded-full bg-[#eef8ff] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#2563eb]">
          {order.order_id}
        </p>
      </td>

      <td className="max-w-[210px] px-5 py-5">
        <p className="truncate text-[13px] font-semibold text-[#344054]">
          {customer.name}
        </p>
        <p className="mt-0.5 text-[9px] text-[#98a2b3]">
          {order.customer_id}
        </p>
        <p className="mt-1 text-[10px] text-[#667085]">
          {customer.phone}
        </p>

        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#98a2b3]">
          {customer.address}
        </p>
      </td>

      <td className="max-w-[270px] px-5 py-5">
        {order.order_items.length === 0 ? (
          <p className="text-[11px] text-[#98a2b3]">
            No items found
          </p>
        ) : (
          <div className="space-y-1.5">
            {order.order_items.map(
              (item) => (
                <div
                  key={item.order_item_id}
                  className="flex items-start justify-between gap-3"
                >
                  <p className="line-clamp-1 text-[11px] text-[#475467]">
                    {getProductName(item)}
                  </p>

                  <span className="shrink-0 rounded-full bg-[#f2f4f7] px-2 py-0.5 text-[9px] font-semibold text-[#667085]">
                    x{item.quantity}
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </td>

      <td className="px-2 py-4 whitespace-nowrap">
        <p className="text-[13px] font-semibold text-[#101828]">
          ₹{formatMoney(order.total_amount)}
        </p>

        <p className="mt-1 text-[9px] text-[#98a2b3]">
          GST ₹
          {formatMoney(order.gst_amount)}
        </p>

        {Number(order.paid_amount) > 0 && (
          <p className="mt-1 text-[9px] font-medium text-[#047857]">
            Paid ₹
            {formatMoney(
              order.paid_amount
            )}
          </p>
        )}
      </td>

      <td className="px-2 py-4 whitespace-nowrap">
        <select
          value={order.payment_status}
          disabled={updating}
          onChange={(event) =>
            void onPaymentChange(
              order,
              event.target
                .value as PaymentStatus
            )
          }
          className={`${miniControlClass} appearance-none ${getPaymentClasses(
            order.payment_status
          )}`}
        >
          {PAYMENT_STATUSES.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>
      </td>

      <td className="px-2 py-4 whitespace-nowrap">
        <select
          value={order.status}
          disabled={updating}
          onChange={(event) =>
            void onStatusChange(
              order,
              event.target
                .value as OrderStatus
            )
          }
          className={`${miniControlClass} appearance-none ${getOrderStatusClasses(
            order.status
          )}`}
        >
          {ORDER_STATUSES.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>
      </td>

      <td className="px-2 py-4 whitespace-nowrap">
        <p className="whitespace-nowrap text-[10px] leading-4 text-[#667085]">
          {formatDate(order.created_at)}
        </p>
      </td>

      <td className="px-2 py-4 whitespace-nowrap">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            title="Download bill"
            aria-label={`Download bill for ${order.order_id}`}
            onClick={() =>
              void onDownloadBill(order)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dce7ea] bg-white text-[#667085] shadow-sm transition hover:border-[#81cdc5] hover:text-[#009d8b] hover:shadow-md"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v12m0 0l4-4m-4 4l-4-4M4 19h16"
              />
            </svg>
          </button>

          <button
            type="button"
            title={
              order.admin_note
                ? "View or edit note"
                : "Add note"
            }
            aria-label={
              order.admin_note
                ? `Edit note for ${order.order_id}`
                : `Add note for ${order.order_id}`
            }
            onClick={() =>
              onOpenNote(order)
            }
            className={`relative flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm transition hover:shadow-md ${order.admin_note
              ? "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400"
              : "border-[#dce7ea] bg-white text-[#667085] hover:border-[#81cdc5] hover:text-[#009d8b]"
              }`}
          >
            <NoteIcon className="h-4 w-4" />

            {order.admin_note && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500" />
            )}
          </button>
          <button
            type="button"
            title="Permanently delete order"
            aria-label={`Permanently delete ${order.order_id}`}
            onClick={() =>
              onDeleteOrder(order)
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-100 hover:text-red-700 hover:shadow-md"
          >
            <DeleteIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
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

function getCustomer(
  users: CustomerDetails
) {
  const customer = Array.isArray(users)
    ? users[0]
    : users;

  return {
    name: customer?.name ?? "Customer",
    phone: customer?.phone ?? "-",
    address:
      customer?.address ?? "Not available",
  };
}

function getProductName(
  item: OrderItem
) {
  if (item.product_name_snapshot) {
    return item.product_name_snapshot;
  }

  const product = Array.isArray(
    item.products
  )
    ? item.products[0]
    : item.products;

  return (
    product?.product_name ?? "Product"
  );
}

function formatMoney(
  value: number | string | null
) {
  return Number(value ?? 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatDate(value: string) {
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

function getOrderStatusLabel(
  value: OrderStatus
) {
  switch (value) {
    case "PENDING":
      return "Pending";

    case "IN_PROCESS":
      return "In Process";

    case "PARTIAL":
      return "Partial";

    case "DELIVERED":
      return "Delivered";

    case "CANCELLED":
      return "Cancelled";

    default:
      return value;
  }
}

function getPaymentLabel(
  value: PaymentStatus
) {
  return (
    PAYMENT_STATUSES.find(
      (item) => item.value === value
    )?.label ?? value
  );
}

function getOrderStatusClasses(
  value: OrderStatus
) {
  if (value === "DELIVERED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "IN_PROCESS") {
    return "border-purple-200 bg-purple-50 text-purple-700";
  }
  if (value === "CANCELLED") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (value === "PARTIAL") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getPaymentClasses(
  value: PaymentStatus
) {
  if (value === "PAID") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    value === "PARTIALLY_PAID"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-red-200 bg-red-50 text-red-700";
}

function drawReceiptLine(
  pdf: {
    setDrawColor: (
      red: number,
      green: number,
      blue: number
    ) => void;
    line: (
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ) => void;
  },
  y: number
) {
  pdf.setDrawColor(190, 200, 205);
  pdf.line(5, y, 75, y);
}

function NotificationBellIcon({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />

      <path d="M10 21h4" />

      <circle
        cx="18"
        cy="5"
        r="3"
        fill="currentColor"
        stroke="white"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function DeleteIcon({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />

      <path d="M8 6V4h8v2" />

      <path d="M19 6l-1 14H6L5 6" />

      <path d="M10 11v5" />

      <path d="M14 11v5" />
    </svg>
  );
}

function NoteIcon({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M5 3h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />

      <path d="M8 8h8M8 12h6" />
    </svg>
  );
}
const controlClass =
  "w-full rounded-xl border border-[#dfe5e8] bg-[#fbfcfc] px-4 py-3 text-[12px] text-[#101828] outline-none focus:border-[#81cdc5] focus:bg-white focus:ring-4 focus:ring-[#e6f6f3]";

const miniControlClass =
  "h-7 min-w-[85px] rounded-md border px-2 text-[8.5px] font-medium shadow-sm outline-none transition bg-white hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50";