"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, } from "react";
import { supabase } from "@/lib/supabase";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";

type IconProps = {
  className?: string;
};

type ChartRange =
  | "7_DAYS"
  | "THIS_MONTH"
  | "MONTHLY"
  | "YEARLY";

type ChartMetric =
  | "REVENUE"
  | "ORDERS"
  | "PRODUCTS";

type DashboardOrder = {
  total_amount: number;
  status: string;
  created_at: string;
};

type DashboardProduct = {
  created_at: string;
};

type ChartPoint = {
  label: string;
  revenue: number;
  orders: number;
  products: number;
};
export default function AdminPage() {
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [deliveredOrders, setDeliveredOrders] = useState(0);
  const [revenue, setRevenue] = useState(0);

  const [dashboardOrders, setDashboardOrders,] = useState<DashboardOrder[]>([]);
  const [dashboardProducts, setDashboardProducts,] = useState<DashboardProduct[]>([]);
  const [chartRange, setChartRange,] = useState<ChartRange>("7_DAYS");
  const [selectedChartMetrics, setSelectedChartMetrics,] = useState<ChartMetric[]>(["REVENUE",]);

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [note, setNote] = useState("");
  const [showReminder, setShowReminder] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [alarmRinging, setAlarmRinging] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [imageCount, setImageCount] = useState(0);
  const [storageUsed, setStorageUsed] = useState(0);
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTriggeredReminderRef = useRef("");

  const [mounted, setMounted] = useState(false);

  async function loadDashboardData() {

    const {
      data: productsData,
      count: productCount,
      error: productsError,
    } = await supabase
      .from("products")
      .select(
        "created_at",
        {
          count: "exact",
        }
      )
      .order("created_at", {
        ascending: true,
      });

    if (productsError) {
      console.error(
        "Unable to load product activity:",
        productsError
      );
    }
    const { count: imageCountValue } =
      await supabase
        .from("products")
        .select("*", {
          count: "exact",
          head: true,
        })
        .not("image_url", "is", null);
    setImageCount(
      imageCountValue ?? 0
    );
    const {
      data: storageBytes,
      error: storageError,
    } = await supabase.rpc(
      "get_products_storage_usage"
    );

    if (storageError) {
      console.error(
        "Unable to load Products storage:",
        storageError
      );

      setStorageUsed(0);
    } else {
      setStorageUsed(
        Number(storageBytes ?? 0)
      );
    }

    const { count: customerCount } =
      await supabase
        .from("users")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("role", "CUSTOMER");

    const {
      data: ordersData,
      error: ordersError,
    } = await supabase
      .from("orders")
      .select(
        "order_id,total_amount,status,created_at"
      )
      .order("created_at", {
        ascending: true,
      });

    if (ordersError) {
      console.error(
        "Unable to load dashboard orders:",
        ordersError
      );
    }

    const totalOrderCount =
      ordersData?.length ?? 0;

    const completedOrders =
      ordersData?.filter(
        (x) =>
          x.status === "DELIVERED"
      ).length ?? 0;

    const deliveredRevenue =
      ordersData?.filter(
        (order) =>
          order.status === "DELIVERED"
      ) ?? [];

    const totalRevenue =
      deliveredRevenue.reduce(
        (sum, order) =>
          sum +
          Number(order.total_amount ?? 0),
        0
      );

    setTotalProducts(
      productCount ?? 0
    );

    setTotalCustomers(
      customerCount ?? 0
    );

    setTotalOrders(
      totalOrderCount
    );

    setDeliveredOrders(
      completedOrders
    );

    setDashboardOrders(
      (ordersData ?? []).map(
        (order) => ({
          total_amount: Number(
            order.total_amount ?? 0
          ),

          status: String(
            order.status ?? ""
          ),

          created_at:
            order.created_at,
        })
      )
    );

    setDashboardProducts(
      (productsData ?? []).map(
        (product) => ({
          created_at:
            product.created_at,
        })
      )
    );
    setRevenue(totalRevenue);
  }
  useEffect(() => {

    loadDashboardData();

    const channel = supabase
      .channel("dashboard-sync")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        () => loadDashboardData()
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => loadDashboardData()
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
        },
        () => loadDashboardData()
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, []);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    setCurrentTime(new Date());

    alarmAudioRef.current =
      new Audio("/alarm.mp3");

    alarmAudioRef.current.loop = true;
    alarmAudioRef.current.preload = "auto";

    const savedNote =
      localStorage.getItem(
        "adminStickyNote"
      );

    if (savedNote) {
      setNote(savedNote);
    }

    const savedReminder =
      localStorage.getItem(
        "adminReminder"
      );

    if (savedReminder) {
      try {
        const parsed =
          JSON.parse(savedReminder);

        setReminderTitle(
          parsed.title ?? ""
        );

        setReminderTime(
          parsed.time ?? ""
        );

        setReminderEnabled(
          parsed.enabled === true
        );
      } catch {
        localStorage.removeItem(
          "adminReminder"
        );
      }
    }

    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);

      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
        alarmAudioRef.current.currentTime = 0;
        alarmAudioRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (
      !currentTime ||
      !reminderEnabled ||
      !reminderTitle.trim() ||
      !reminderTime ||
      alarmRinging
    ) {
      return;
    }

    const currentHours = String(
      currentTime.getHours()
    ).padStart(2, "0");

    const currentMinutes = String(
      currentTime.getMinutes()
    ).padStart(2, "0");

    const currentTimeValue =
      `${currentHours}:${currentMinutes}`;

    const currentDateValue = [
      currentTime.getFullYear(),
      String(
        currentTime.getMonth() + 1
      ).padStart(2, "0"),
      String(
        currentTime.getDate()
      ).padStart(2, "0"),
    ].join("-");

    const triggerKey =
      `${currentDateValue}-${reminderTime}`;

    if (
      currentTimeValue === reminderTime &&
      lastTriggeredReminderRef.current !==
      triggerKey
    ) {
      lastTriggeredReminderRef.current =
        triggerKey;

      setAlarmRinging(true);
      setAudioError("");

      const audio =
        alarmAudioRef.current;

      if (audio) {
        audio.currentTime = 0;

        void audio.play().catch(
          (playError) => {
            console.error(
              "Unable to play reminder sound:",
              playError
            );

            setAudioError(
              "The browser blocked the sound. Click Play sound."
            );
          }
        );
      }
    }
  }, [
    currentTime,
    reminderEnabled,
    reminderTitle,
    reminderTime,
    alarmRinging,
  ]);
  function saveReminder() {
    const cleanedTitle =
      reminderTitle.trim();

    if (!cleanedTitle || !reminderTime) {
      return;
    }

    const reminder = {
      title: cleanedTitle,
      time: reminderTime,
      enabled: true,
    };

    localStorage.setItem(
      "adminReminder",
      JSON.stringify(reminder)
    );

    setReminderTitle(cleanedTitle);
    setReminderEnabled(true);
    setShowReminder(false);
    setAudioError("");

    lastTriggeredReminderRef.current =
      "";
  }

  function stopAlarm() {
    if (alarmAudioRef.current) {
      alarmAudioRef.current.pause();
      alarmAudioRef.current.currentTime = 0;
    }

    setAlarmRinging(false);
    setAudioError("");

    setReminderEnabled(false);

    localStorage.setItem(
      "adminReminder",
      JSON.stringify({
        title: reminderTitle,
        time: reminderTime,
        enabled: false,
      })
    );
  }

  function playAlarmSound() {
    if (!alarmAudioRef.current) {
      alarmAudioRef.current =
        new Audio("/alarm.mp3");

      alarmAudioRef.current.loop = true;
    }

    alarmAudioRef.current.currentTime = 0;

    void alarmAudioRef.current
      .play()
      .then(() => {
        setAudioError("");
      })
      .catch((playError) => {
        console.error(playError);

        setAudioError(
          "Unable to play alarm.mp3. Check that the file exists in the public folder."
        );
      });
  }

  function deleteReminder() {
    if (alarmAudioRef.current) {
      alarmAudioRef.current.pause();
      alarmAudioRef.current.currentTime = 0;
    }

    localStorage.removeItem(
      "adminReminder"
    );

    setReminderTitle("");
    setReminderTime("");
    setReminderEnabled(false);
    setAlarmRinging(false);
    setShowReminder(false);
    setAudioError("");

    lastTriggeredReminderRef.current =
      "";
  }
  function toggleChartMetric(
    metric: ChartMetric
  ) {
    setSelectedChartMetrics(
      (currentMetrics) => {
        const alreadySelected =
          currentMetrics.includes(
            metric
          );

        if (alreadySelected) {
          if (
            currentMetrics.length === 1
          ) {
            return currentMetrics;
          }

          return currentMetrics.filter(
            (currentMetric) =>
              currentMetric !== metric
          );
        }

        return [
          ...currentMetrics,
          metric,
        ];
      }
    );
  }
  const metrics = [
    {
      title: "Total products",
      value: totalProducts,
      description: "Live catalogue",
      icon: PackageIcon,
      iconBackground: "bg-[#edf4ff]",
      iconColour: "text-[#2563eb]",
    },
    {
      title: "Orders",
      value: totalOrders,
      description: "Customer orders",
      icon: OrdersIcon,
      iconBackground: "bg-[#fff4e8]",
      iconColour: "text-[#f97316]",
    },
    {
      title: "Customers",
      value: totalCustomers,
      description: "Registered buyers",
      icon: CustomersIcon,
      iconBackground: "bg-[#faf0ff]",
      iconColour: "text-[#a855f7]",
    },
    {
      title: "Delivered",
      value: deliveredOrders,
      description: "Successfully completed",
      icon: DeliveredIcon,
      iconBackground: "bg-[#eafbf7]",
      iconColour: "text-[#009d8b]",
    },
  ];

  const chartData =
    useMemo<ChartPoint[]>(() => {
      const createPoint = (
        label: string,
        startDate: Date,
        endDate: Date
      ): ChartPoint => {
        const matchingOrders =
          dashboardOrders.filter(
            (order) => {
              const orderDate =
                new Date(
                  order.created_at
                );

              return (
                orderDate >= startDate &&
                orderDate < endDate
              );
            }
          );

        const matchingProducts =
          dashboardProducts.filter(
            (product) => {
              const productDate =
                new Date(
                  product.created_at
                );

              return (
                productDate >=
                startDate &&
                productDate <
                endDate
              );
            }
          );

        const deliveredRevenue =
          matchingOrders
            .filter(
              (order) =>
                order.status ===
                "DELIVERED"
            )
            .reduce(
              (sum, order) =>
                sum +
                Number(
                  order.total_amount ??
                  0
                ),
              0
            );

        return {
          label,

          revenue: Number(
            deliveredRevenue.toFixed(
              2
            )
          ),

          orders:
            matchingOrders.length,

          products:
            matchingProducts.length,
        };
      };

      const today = new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      if (
        chartRange === "7_DAYS"
      ) {
        return Array.from(
          {
            length: 7,
          },
          (_, index) => {
            const startDate =
              new Date(today);

            startDate.setDate(
              today.getDate() -
              (6 - index)
            );

            const endDate =
              new Date(startDate);

            endDate.setDate(
              startDate.getDate() +
              1
            );

            return createPoint(
              startDate.toLocaleDateString(
                "en-IN",
                {
                  day: "2-digit",
                  month: "short",
                }
              ),
              startDate,
              endDate
            );
          }
        );
      }

      if (
        chartRange ===
        "THIS_MONTH"
      ) {
        const year =
          today.getFullYear();

        const month =
          today.getMonth();

        const daysInMonth =
          new Date(
            year,
            month + 1,
            0
          ).getDate();

        return Array.from(
          {
            length: daysInMonth,
          },
          (_, index) => {
            const dayNumber =
              index + 1;

            const startDate =
              new Date(
                year,
                month,
                dayNumber
              );

            const endDate =
              new Date(
                year,
                month,
                dayNumber + 1
              );

            return createPoint(
              String(dayNumber),
              startDate,
              endDate
            );
          }
        );
      }

      if (
        chartRange === "MONTHLY"
      ) {
        return Array.from(
          {
            length: 12,
          },
          (_, index) => {
            const startDate =
              new Date(
                today.getFullYear(),
                today.getMonth() -
                (11 - index),
                1
              );

            const endDate =
              new Date(
                startDate.getFullYear(),
                startDate.getMonth() +
                1,
                1
              );

            return createPoint(
              startDate.toLocaleDateString(
                "en-IN",
                {
                  month: "short",
                  year: "2-digit",
                }
              ),
              startDate,
              endDate
            );
          }
        );
      }

      const years = [
        ...dashboardOrders.map(
          (order) =>
            new Date(
              order.created_at
            ).getFullYear()
        ),

        ...dashboardProducts.map(
          (product) =>
            new Date(
              product.created_at
            ).getFullYear()
        ),
      ].filter(
        (year) =>
          Number.isFinite(year)
      );

      const currentYear =
        today.getFullYear();

      const earliestYear =
        years.length > 0
          ? Math.min(
            ...years,
            currentYear
          )
          : currentYear;

      return Array.from(
        {
          length:
            currentYear -
            earliestYear +
            1,
        },
        (_, index) => {
          const year =
            earliestYear + index;

          const startDate =
            new Date(
              year,
              0,
              1
            );

          const endDate =
            new Date(
              year + 1,
              0,
              1
            );

          return createPoint(
            String(year),
            startDate,
            endDate
          );
        }
      );
    }, [
      dashboardOrders,
      dashboardProducts,
      chartRange,
    ]);

  const selectedRevenue =
    useMemo(() => {
      return chartData.reduce(
        (sum, point) =>
          sum + point.revenue,
        0
      );
    }, [chartData]);

  const selectedOrders =
    useMemo(() => {
      return chartData.reduce(
        (sum, point) =>
          sum + point.orders,
        0
      );
    }, [chartData]);

  const selectedProducts =
    useMemo(() => {
      return chartData.reduce(
        (sum, point) =>
          sum + point.products,
        0
      );
    }, [chartData]);

  const hasChartData =
    chartData.some(
      (point) =>
        point.revenue > 0 ||
        point.orders > 0 ||
        point.products > 0
    );

  const chartRangeLabel =
    chartRange === "7_DAYS"
      ? "Last 7 days"
      : chartRange ===
        "THIS_MONTH"
        ? "This month"
        : chartRange ===
          "MONTHLY"
          ? "Last 12 months"
          : "Yearly";

  const storageLimitBytes =
    1024 * 1024 * 1024;

  const storageUsagePercent =
    Math.min(
      100,
      storageLimitBytes > 0
        ? (storageUsed /
          storageLimitBytes) *
        100
        : 0
    );

  const storageRemainingBytes =
    Math.max(
      0,
      storageLimitBytes -
      storageUsed
    );

  return (
    <div className="min-w-0 text-[#101828]">
      {/* Intro */}
      {alarmRinging && (
        <div className="fixed right-5 top-5 z-[200] w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[22px] border border-amber-200 bg-white shadow-[0_30px_80px_rgba(16,24,40,0.28)]">
          <div className="h-1.5 animate-pulse bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 animate-pulse items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <AlarmIcon className="h-6 w-6" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-600">
                      Reminder alarm
                    </p>

                    <h2 className="mt-1 text-[17px] font-semibold text-[#101828]">
                      {reminderTitle ||
                        "Workspace reminder"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    aria-label="Dismiss reminder"
                    onClick={stopAlarm}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-[20px] leading-none text-[#98a2b3] transition hover:bg-[#f2f4f7] hover:text-[#475467]"
                  >
                    ×
                  </button>
                </div>

                <p className="mt-2 text-[11px] text-[#667085]">
                  Scheduled for{" "}
                  {formatReminderTime(
                    reminderTime
                  )}
                </p>

                {audioError && (
                  <p className="mt-2 text-[10px] text-red-600">
                    {audioError}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-2">
                  {audioError && (
                    <button
                      type="button"
                      onClick={playAlarmSound}
                      className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-[10px] font-semibold text-amber-700"
                    >
                      Play sound
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={stopAlarm}
                    className="rounded-xl bg-[#101828] px-4 py-2 text-[10px] font-semibold text-white transition hover:bg-[#1d2939]"
                  >
                    Dismiss alarm
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <section className="mb-6">
        <p className="mb-3 text-sm font-semibold tracking-wide text-[#009d8b]">
          Store overview
        </p>

        <h1 className="text-[28px] font-semibold tracking-[-0.035em] text-[#101828] sm:text-[32px]">
          Hello, Sai
          <span className="ml-2 text-[#00a999]">✦</span>
        </h1>

        <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#667085]">
          Monitor your catalogue, orders, customers and store activity from one
          place.
        </p>
      </section>

      {/* Metric Cards */}

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="rounded-[20px] border border-[#e4e9ec] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_8px_20px_rgba(16,24,40,0.05)]"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-[13px] font-medium text-[#667085]">
                  {item.title}
                </p>

                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.iconBackground} ${item.iconColour}`}
                >
                  <Icon className="h-[17px] w-[17px]" />
                </div>
              </div>

              <p className="mt-5 text-[32px] font-semibold leading-none tracking-[-0.04em] text-[#101828]">
                {item.value}
              </p>

              <p className="mt-4 text-[12px] font-medium text-[#009d8b]">
                {item.description}
              </p>
            </article>
          );
        })}
      </section>

      {/* Quick Actions */}

      <section className="mt-6 rounded-[26px] border border-[#e4e9ec] bg-white p-6 shadow-[0_2px_4px_rgba(16,24,40,0.03),0_16px_36px_rgba(16,24,40,0.05)] sm:p-8">
        <div>
          <p className="text-sm font-semibold text-[#009d8b]">
            Store shortcuts
          </p>

          <h2 className="mt-1 text-xl font-semibold text-[#101828]">
            Quick actions
          </h2>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            title="Products"
            description="Manage catalog"
            href="/SatyahiShivheibHai/products"
            icon={PackageIcon}
          />

          <QuickAction
            title="Add product"
            description="Create new item"
            href="/SatyahiShivheibHai/products"
            icon={PlusIcon}
          />

          <QuickAction
            title="Orders"
            description="Track fulfillment"
            href="/SatyahiShivheibHai/orders"
            icon={OrdersIcon}
          />

          <QuickAction
            title="Customers"
            description="View buyers"
            href="/SatyahiShivheibHai/customers"
            icon={CustomersIcon}
          />
        </div>
      </section>
      {/* Main Dashboard Content */}

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.75fr)]">
        {/* Revenue Overview */}

        <article className="overflow-hidden rounded-[26px] border border-[#e4e9ec] bg-white shadow-[0_2px_4px_rgba(16,24,40,0.03),0_16px_36px_rgba(16,24,40,0.05)]">

          <div className="flex flex-col gap-5 border-b border-[#edf0f2] px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-8">

            <div>
              <p className="text-lg font-semibold text-[#101828]">
                Business overview
              </p>

              <p className="mt-1 text-sm text-[#98a2b3]">
                Revenue, orders and catalogue growth
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">

              <ChartRangeButton
                label="7 Days"
                active={
                  chartRange === "7_DAYS"
                }
                onClick={() =>
                  setChartRange("7_DAYS")
                }
              />

              <ChartRangeButton
                label="This Month"
                active={
                  chartRange ===
                  "THIS_MONTH"
                }
                onClick={() =>
                  setChartRange(
                    "THIS_MONTH"
                  )
                }
              />

              <ChartRangeButton
                label="Monthly"
                active={
                  chartRange === "MONTHLY"
                }
                onClick={() =>
                  setChartRange("MONTHLY")
                }
              />

              <ChartRangeButton
                label="Yearly"
                active={
                  chartRange === "YEARLY"
                }
                onClick={() =>
                  setChartRange("YEARLY")
                }
              />

            </div>

          </div>

          <div className="px-6 py-7 sm:px-8">

            <div className="flex flex-col gap-3">

  <div>
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
      {chartRangeLabel}
    </p>

    <div className="mt-3 flex flex-wrap gap-3">
                  {selectedChartMetrics.includes(
                    "REVENUE"
                  ) && (
                      <ChartSummaryCard
                        label="Revenue"
                        value={`₹${selectedRevenue.toLocaleString(
                          "en-IN",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}`}
                        colour="teal"
                      />
                    )}

                  {selectedChartMetrics.includes(
                    "ORDERS"
                  ) && (
                      <ChartSummaryCard
                        label="Orders"
                        value={String(
                          selectedOrders
                        )}
                        colour="orange"
                      />
                    )}

                  {selectedChartMetrics.includes(
                    "PRODUCTS"
                  ) && (
                      <ChartSummaryCard
                        label="New products"
                        value={String(
                          selectedProducts
                        )}
                        colour="purple"
                      />
                    )}

                </div>
              </div>


              <div className="mt-7 h-[380px] rounded-[20px] border border-[#dfeeea] bg-gradient-to-b from-[#f7fcfb] to-white px-2 pb-3 pt-5 sm:px-4">

                {hasChartData ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <ComposedChart
                      data={chartData}
                      margin={{
                        top: 10,
                        right: 8,
                        left: 0,
                        bottom: 0,
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="revenueAreaFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#0d9488"
                            stopOpacity={0.28}
                          />

                          <stop
                            offset="100%"
                            stopColor="#0d9488"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        stroke="#dceae7"
                        strokeDasharray="4 4"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fill: "#98a2b3",
                          fontSize: 10,
                        }}
                        minTickGap={
                          chartRange ===
                            "THIS_MONTH"
                            ? 16
                            : 12
                        }
                      />

                      {selectedChartMetrics.includes(
                        "REVENUE"
                      ) && (
                          <YAxis
                            yAxisId="revenue"
                            axisLine={false}
                            tickLine={false}
                            width={62}
                            tick={{
                              fill: "#98a2b3",
                              fontSize: 10,
                            }}
                            tickFormatter={(
                              value
                            ) =>
                              formatCompactCurrency(
                                Number(value)
                              )
                            }
                          />
                        )}

                      {(selectedChartMetrics.includes(
                        "ORDERS"
                      ) ||
                        selectedChartMetrics.includes(
                          "PRODUCTS"
                        )) && (
                          <YAxis
                            yAxisId="count"
                            orientation="right"
                            axisLine={false}
                            tickLine={false}
                            width={34}
                            allowDecimals={false}
                            tick={{
                              fill: "#98a2b3",
                              fontSize: 10,
                            }}
                          />
                        )}

                      <Tooltip
                        cursor={{
                          stroke: "#81cdc5",
                          strokeDasharray:
                            "4 4",
                        }}
                        content={
                          <BusinessChartTooltip />
                        }
                      />

                      {selectedChartMetrics.includes(
                        "REVENUE"
                      ) && (
                          <Area
                            yAxisId="revenue"
                            type="monotone"
                            dataKey="revenue"
                            name="Revenue"
                            stroke="#0d9488"
                            strokeWidth={3}
                            fill="url(#revenueAreaFill)"
                            activeDot={{
                              r: 5,
                              fill: "#0d9488",
                              stroke: "#ffffff",
                              strokeWidth: 3,
                            }}
                          />
                        )}

                      {selectedChartMetrics.includes(
                        "ORDERS"
                      ) && (
                          <Line
                            yAxisId="count"
                            type="monotone"
                            dataKey="orders"
                            name="Orders"
                            stroke="#f97316"
                            strokeWidth={3}
                            dot={{
                              r: 3,
                              fill: "#f97316",
                              stroke: "#ffffff",
                              strokeWidth: 2,
                            }}
                            activeDot={{
                              r: 5,
                            }}
                          />
                        )}

                      {selectedChartMetrics.includes(
                        "PRODUCTS"
                      ) && (
                          <Line
                            yAxisId="count"
                            type="monotone"
                            dataKey="products"
                            name="Products"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            dot={{
                              r: 3,
                              fill: "#8b5cf6",
                              stroke: "#ffffff",
                              strokeWidth: 2,
                            }}
                            activeDot={{
                              r: 5,
                            }}
                          />
                        )}

                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                    <RevenueIcon className="h-8 w-8 text-[#009d8b]" />

                    <p className="mt-4 text-[14px] font-semibold text-[#344054]">
                      No activity found
                    </p>

                    <p className="mt-1 text-[11px] text-[#98a2b3]">
                      No revenue, orders or new products were found for this period.
                    </p>
                  </div>
                )}

              </div>



              <div className="mt-5 rounded-2xl border border-[#e4ecea] bg-[#f8fbfa] px-4 py-4">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                      Chart metrics
                    </p>

                    <p className="mt-1 text-[10px] text-[#98a2b3]">
                      Select one or more metrics
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">

                    <ChartMetricCheckbox
                      label="Revenue"
                      colour="#0d9488"
                      checked={
                        selectedChartMetrics.includes(
                          "REVENUE"
                        )
                      }
                      onChange={() =>
                        toggleChartMetric(
                          "REVENUE"
                        )
                      }
                    />

                    <ChartMetricCheckbox
                      label="Orders"
                      colour="#f97316"
                      checked={
                        selectedChartMetrics.includes(
                          "ORDERS"
                        )
                      }
                      onChange={() =>
                        toggleChartMetric(
                          "ORDERS"
                        )
                      }
                    />

                    <ChartMetricCheckbox
                      label="New Products"
                      colour="#8b5cf6"
                      checked={
                        selectedChartMetrics.includes(
                          "PRODUCTS"
                        )
                      }
                      onChange={() =>
                        toggleChartMetric(
                          "PRODUCTS"
                        )
                      }
                    />

                  </div>

                </div>

              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] text-[#98a2b3]">

                <span>
                  X-axis:{" "}
                  {chartRange ===
                    "7_DAYS"
                    ? "Day"
                    : chartRange ===
                      "MONTHLY"
                      ? "Month"
                      : "Year"}
                </span>

                <span>
                  Y-axis: Delivered revenue
                </span>
              </div>
              
            </div>
          </div>
        </article>


        {/* Recent Activity */}
        <article className="rounded-[26px] border border-[#e4e9ec] bg-white p-6 shadow-[0_2px_4px_rgba(16,24,40,0.03),0_16px_36px_rgba(16,24,40,0.05)] sm:p-8">

          <h2 className="text-lg font-semibold text-[#101828]">
            Workspace Tools
          </h2>

          <div className="mt-5 space-y-5">

            <div className="overflow-hidden rounded-2xl border border-[#dce9e6] bg-gradient-to-br from-white to-[#f4faf8] shadow-sm">

              <div className="border-b border-[#e8f0ee] px-4 py-4">

                <div className="flex items-start justify-between gap-3">

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                      Image Storage
                    </p>

                    <p className="mt-1 text-[11px] text-[#667085]">
                      Products bucket usage
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eafbf7] text-[#009d8b]">
                    <StorageIcon className="h-5 w-5" />
                  </div>

                </div>

              </div>

              <div className="px-4 py-4">

                <div className="flex items-end justify-between gap-3">

                  <div>
                    <p className="text-[23px] font-semibold tracking-[-0.04em] text-[#101828]">
                      {formatStorageSize(
                        storageUsed
                      )}
                    </p>

                    <p className="mt-1 text-[10px] text-[#98a2b3]">
                      of{" "}
                      {formatStorageSize(
                        storageLimitBytes
                      )}
                    </p>
                  </div>

                  <span className="rounded-full border border-[#cfe8e3] bg-white px-2.5 py-1 text-[9px] font-semibold text-[#008f80]">
                    {storageUsagePercent.toFixed(
                      storageUsagePercent < 1
                        ? 2
                        : 1
                    )}
                    %
                  </span>

                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#dfeae7]">

                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0f766e] via-[#0d9488] to-[#2dd4bf] transition-all duration-700"
                    style={{
                      width: `${Math.max(
                        storageUsagePercent > 0
                          ? 1
                          : 0,
                        storageUsagePercent
                      )}%`,
                    }}
                  />

                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">

                  <div className="rounded-xl border border-[#e4ecea] bg-white px-3 py-3">

                    <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">
                      Stored Images
                    </p>

                    <p className="mt-1 text-[13px] font-semibold text-[#344054]">
                      {imageCount}
                    </p>

                  </div>

                  <div className="rounded-xl border border-[#e4ecea] bg-white px-3 py-3">

                    <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">
                      Remaining
                    </p>

                    <p className="mt-1 text-[13px] font-semibold text-[#344054]">
                      {formatStorageSize(
                        storageRemainingBytes
                      )}
                    </p>

                  </div>

                </div>

                <p className="mt-3 text-[9px] leading-4 text-[#98a2b3]">
                  Calculated from files stored in the Products bucket.
                </p>

              </div>

            </div>

            <div className="overflow-hidden rounded-2xl border border-[#e5ecea] bg-white shadow-sm">

              <div className="flex items-center justify-between border-b border-[#eef2f1] px-4 py-3">

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                    Quick Note
                  </p>

                  <p className="mt-1 text-[11px] text-[#667085]">
                    Personal admin notes
                  </p>
                </div>

                <button
                  onClick={() => {
                    localStorage.setItem(
                      "adminStickyNote",
                      note
                    );
                  }}
                  className="rounded-lg bg-[#0f766e] px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[#0d9488]"
                >
                  Save
                </button>

              </div>

              <textarea
                value={note}
                onChange={(e) =>
                  setNote(e.target.value)
                }
                rows={5}
                placeholder="Write important reminders..."
                className="w-full resize-none border-0 bg-transparent px-4 py-4 text-[13px] text-[#101828] outline-none"
              />

            </div>

            <button
              type="button"
              onClick={() =>
                setShowReminder(true)
              }
              className="group w-full rounded-2xl border border-[#e5ecea] bg-gradient-to-br from-[#f7faf9] to-[#f0f8f6] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b7ddd7] hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
                    Current time
                  </p>

                  <p className="mt-2 text-[25px] font-semibold tracking-[-0.04em] text-[#101828]">
                    {currentTime
                      ? currentTime.toLocaleTimeString(
                        "en-IN",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        }
                      )
                      : "--:--:--"}
                  </p>

                  <p className="mt-1 text-[10px] text-[#98a2b3]">
                    {currentTime
                      ? currentTime.toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )
                      : "Loading date..."}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#009d8b] shadow-sm ring-1 ring-[#dce9e6] transition group-hover:scale-105">
                  <AlarmIcon className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 border-t border-[#dfe9e7] pt-3">
                {reminderTitle &&
                  reminderTime &&
                  reminderEnabled ? (
                  <>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#009d8b]">
                      Next reminder
                    </p>

                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="truncate text-[11px] font-semibold text-[#344054]">
                        {reminderTitle}
                      </p>

                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-[#667085] shadow-sm">
                        {formatReminderTime(
                          reminderTime
                        )}
                      </span>
                    </div>
                  </>
                ) : reminderTitle &&
                  reminderTime ? (
                  <p className="text-[10px] text-[#98a2b3]">
                    Previous reminder dismissed. Click to set another.
                  </p>
                ) : (
                  <p className="text-[10px] text-[#98a2b3]">
                    Click to set a reminder alarm
                  </p>
                )}
              </div>
            </button>
          </div>
          {showReminder && (
            <div
              className="fixed inset-0 z-[150] flex items-center justify-center bg-[#101828]/45 px-4 backdrop-blur-sm"
              onMouseDown={(event) => {
                if (
                  event.target ===
                  event.currentTarget
                ) {
                  setShowReminder(false);
                }
              }}
            >
              <section className="w-full max-w-[440px] overflow-hidden rounded-[26px] border border-white/60 bg-white shadow-[0_32px_90px_rgba(16,24,40,0.30)]">
                <div className="relative overflow-hidden bg-gradient-to-br from-[#0f766e] to-[#0d9488] px-6 py-6 text-white">
                  <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                        <AlarmIcon className="h-6 w-6" />
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/70">
                          Workspace reminder
                        </p>

                        <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">
                          Set reminder alarm
                        </h2>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label="Close reminder"
                      onClick={() =>
                        setShowReminder(false)
                      }
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-[21px] leading-none text-white transition hover:bg-white/20"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <label>
                    <span className="mb-2 block text-[11px] font-semibold text-[#344054]">
                      Reminder name
                    </span>

                    <input
                      value={reminderTitle}
                      onChange={(event) =>
                        setReminderTitle(
                          event.target.value
                        )
                      }
                      maxLength={80}
                      placeholder="Example: Call supplier"
                      className="h-12 w-full rounded-xl border border-[#dfe5e8] bg-[#fbfcfc] px-4 text-[13px] text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#81cdc5] focus:bg-white focus:ring-4 focus:ring-[#e6f6f3]"
                    />
                  </label>

                  <div className="mt-5">
                    <span className="mb-2 block text-[11px] font-semibold text-[#344054]">
                      Reminder time
                    </span>

                    <div className="rounded-2xl border border-[#dfe5e8] bg-[#f7faf9] p-4">
                      <div className="grid grid-cols-[1fr_auto_1fr_1fr] items-center gap-2">
                        {/* Hour */}
                        <label>
                          <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">
                            Hour
                          </span>

                          <select
                            value={
                              reminderTime
                                ? getReminderHour(
                                  reminderTime
                                )
                                : ""
                            }
                            onChange={(event) => {
                              const hour =
                                event.target.value;

                              if (!hour) {
                                setReminderTime("");
                                return;
                              }

                              setReminderTime(
                                createReminderTime(
                                  hour,
                                  reminderTime
                                    ? getReminderMinute(
                                      reminderTime
                                    )
                                    : "00",
                                  reminderTime
                                    ? getReminderPeriod(
                                      reminderTime
                                    )
                                    : "AM"
                                )
                              );
                            }}
                            className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-[#dfe5e8] bg-white px-3 text-center text-[14px] font-semibold text-[#101828] outline-none transition hover:border-[#b7d8d3] focus:border-[#81cdc5] focus:ring-4 focus:ring-[#e6f6f3]"
                          >
                            <option value="">
                              --
                            </option>

                            {Array.from(
                              { length: 12 },
                              (_, index) => {
                                const hour = String(
                                  index + 1
                                ).padStart(2, "0");

                                return (
                                  <option
                                    key={hour}
                                    value={hour}
                                  >
                                    {hour}
                                  </option>
                                );
                              }
                            )}
                          </select>
                        </label>

                        <span className="mt-5 text-[22px] font-semibold text-[#98a2b3]">
                          :
                        </span>

                        {/* Minute */}
                        <label>
                          <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">
                            Minute
                          </span>

                          <select
                            value={
                              reminderTime
                                ? getReminderMinute(
                                  reminderTime
                                )
                                : "00"
                            }
                            onChange={(event) => {
                              const minute =
                                String(event.target.value);

                              const currentHour =
                                reminderTime
                                  ? getReminderHour(
                                    reminderTime
                                  )
                                  : "12";

                              const currentPeriod =
                                reminderTime
                                  ? getReminderPeriod(
                                    reminderTime
                                  )
                                  : "AM";

                              setReminderTime(
                                createReminderTime(
                                  currentHour,
                                  minute,
                                  currentPeriod
                                )
                              );
                            }}
                            className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-[#dfe5e8] bg-white px-3 text-center text-[14px] font-semibold text-[#101828] outline-none transition hover:border-[#b7d8d3] focus:border-[#81cdc5] focus:ring-4 focus:ring-[#e6f6f3]"
                          >
                            {Array.from(
                              { length: 60 },
                              (_, index) => {
                                const minute = String(
                                  index
                                ).padStart(2, "0");

                                return (
                                  <option
                                    key={minute}
                                    value={minute}
                                  >
                                    {minute}
                                  </option>
                                );
                              }
                            )}
                          </select>
                        </label>

                        {/* AM / PM */}
                        <label>
                          <span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">
                            Period
                          </span>

                          <select
                            value={
                              reminderTime
                                ? getReminderPeriod(
                                  reminderTime
                                )
                                : "AM"
                            }
                            onChange={(event) => {
                              const period =
                                event.target
                                  .value as
                                | "AM"
                                | "PM";

                              const currentHour =
                                reminderTime
                                  ? getReminderHour(
                                    reminderTime
                                  )
                                  : "12";

                              const currentMinute =
                                reminderTime
                                  ? getReminderMinute(
                                    reminderTime
                                  )
                                  : "00";

                              setReminderTime(
                                createReminderTime(
                                  currentHour,
                                  currentMinute,
                                  period
                                )
                              );
                            }}
                            className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-[#dfe5e8] bg-white px-3 text-center text-[13px] font-semibold text-[#008f80] outline-none transition hover:border-[#81cdc5] focus:border-[#81cdc5] focus:ring-4 focus:ring-[#e6f6f3]"
                          >
                            <option value="AM">
                              AM
                            </option>

                            <option value="PM">
                              PM
                            </option>
                          </select>
                        </label>
                      </div>

                      <div className="mt-4 flex items-center justify-between rounded-xl border border-[#dce9e6] bg-white px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eafbf7] text-[#009d8b]">
                            <AlarmIcon className="h-[18px] w-[18px]" />
                          </div>

                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">
                              Selected time
                            </p>

                            <p className="mt-0.5 text-[14px] font-semibold text-[#101828]">
                              {reminderTime
                                ? formatReminderTime(
                                  reminderTime
                                )
                                : "No time selected"}
                            </p>
                          </div>
                        </div>

                        {reminderTime && (
                          <button
                            type="button"
                            onClick={() =>
                              setReminderTime("")
                            }
                            className="rounded-lg px-2.5 py-1.5 text-[9px] font-semibold text-red-500 transition hover:bg-red-50"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={deleteReminder}
                      disabled={
                        !reminderTitle &&
                        !reminderTime
                      }
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[10px] font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Delete
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setShowReminder(false)
                        }
                        className="rounded-xl border border-[#d8e0e4] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#667085] transition hover:bg-[#f8faf9]"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={saveReminder}
                        disabled={
                          !reminderTitle.trim() ||
                          !reminderTime
                        }
                        className="rounded-xl bg-[#101828] px-5 py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#1d2939] disabled:cursor-not-allowed disabled:bg-[#e4e7ec] disabled:text-[#98a2b3]"
                      >
                        Save reminder
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </article>
      </section>

    </div >
  );
}

function ActivityItem({
  title,
  description,
  last = false,
}: {
  title: string;
  description: string;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-4 pb-7">
      {!last && (
        <div className="absolute left-[19px] top-10 h-[calc(100%-26px)] w-px bg-[#e3eeeb]" />
      )}

      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eafbf7] text-[#009d8b]">
        <CheckIcon className="h-5 w-5" />
      </div>

      <div className="pt-0.5">
        <p className="text-sm font-semibold text-[#344054]">{title}</p>

        <p className="mt-1 text-xs leading-5 text-[#98a2b3]">{description}</p>
      </div>
    </div>
  );
}

function QuickAction({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: (props: IconProps) => React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[20px] border border-[#e4e9ec] bg-[#fbfdfd] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#b7ddd7] hover:bg-[#f3fbf9] hover:shadow-[0_12px_28px_rgba(16,24,40,0.07)]"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#009d8b] shadow-sm ring-1 ring-[#e5eeec]">
        <Icon className="h-5 w-5" />
      </div>

      <p className="mt-4 text-base font-semibold text-[#101828]">{title}</p>
      <p className="mt-1 text-sm text-[#667085]">{description}</p>
    </Link>
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
      aria-hidden="true"
    >
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" />
    </svg>
  );
}

function OrdersIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M3 4h2l2.3 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6.1" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

function CustomersIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </svg>
  );
}

function DeliveredIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PlusIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function getReminderHour(timeValue: string) {
  const [hoursValue] = timeValue.split(":");
  const hour = Number(hoursValue);
  return String(hour % 12 || 12).padStart(2, "0");
}

function getReminderMinute(timeValue: string) {
  return timeValue.split(":")[1] ?? "00";
}

function getReminderPeriod(timeValue: string): "AM" | "PM" {
  return Number(timeValue.split(":")[0]) >= 12 ? "PM" : "AM";
}

function createReminderTime(
  hourValue: string,
  minuteValue: string,
  period: "AM" | "PM"
) {
  let hour = Number(hourValue) % 12;
  if (period === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${minuteValue}`;
}

function formatReminderTime(
  timeValue: string
) {
  if (!timeValue) {
    return "Not set";
  }

  const [hoursValue, minutesValue] =
    timeValue.split(":");

  const date = new Date();

  date.setHours(
    Number(hoursValue),
    Number(minutesValue),
    0,
    0
  );

  return date.toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}
function formatStorageSize(
  bytes: number
) {
  const safeBytes =
    Math.max(
      0,
      Number(bytes) || 0
    );

  if (safeBytes === 0) {
    return "0 B";
  }

  if (safeBytes < 1024) {
    return `${safeBytes.toFixed(
      0
    )} B`;
  }

  if (
    safeBytes <
    1024 * 1024
  ) {
    return `${(
      safeBytes / 1024
    ).toFixed(2)} KB`;
  }

  if (
    safeBytes <
    1024 * 1024 * 1024
  ) {
    return `${(
      safeBytes /
      (1024 * 1024)
    ).toFixed(2)} MB`;
  }

  return `${(
    safeBytes /
    (1024 * 1024 * 1024)
  ).toFixed(2)} GB`;
}
function StorageIcon({
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
      <ellipse
        cx="12"
        cy="5"
        rx="8"
        ry="3"
      />

      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />

      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </svg>
  );
}
function AlarmIcon({
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
      <circle
        cx="12"
        cy="13"
        r="8"
      />

      <path d="M12 9v4l3 2" />

      <path d="m5 3-3 3M19 3l3 3" />

      <path d="M7 21l-1 2M17 21l1 2" />
    </svg>
  );
}
function formatCompactCurrency(
  value: number
) {
  const amount =
    Number(value) || 0;

  if (amount >= 10000000) {
    return `₹${(
      amount / 10000000
    ).toFixed(1)}Cr`;
  }

  if (amount >= 100000) {
    return `₹${(
      amount / 100000
    ).toFixed(1)}L`;
  }

  if (amount >= 1000) {
    return `₹${(
      amount / 1000
    ).toFixed(1)}K`;
  }

  return `₹${amount.toFixed(
    0
  )}`;
}
function BusinessChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    dataKey?: string;
    value?: number;
    color?: string;
  }>;
  label?: string;
}) {
  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null;
  }

  return (
    <div className="min-w-[170px] rounded-2xl border border-[#dfe8e6] bg-white px-4 py-3 shadow-[0_18px_45px_rgba(16,24,40,0.18)]">

      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#98a2b3]">
        {label}
      </p>

      <div className="mt-3 space-y-2">

        {payload.map((item) => {
          const isRevenue =
            item.dataKey ===
            "revenue";

          return (
            <div
              key={String(
                item.dataKey
              )}
              className="flex items-center justify-between gap-5"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      item.color ??
                      "#667085",
                  }}
                />

                <span className="text-[10px] text-[#667085]">
                  {item.name}
                </span>
              </div>

              <span className="text-[11px] font-semibold text-[#101828]">
                {isRevenue
                  ? `₹${Number(
                    item.value ?? 0
                  ).toLocaleString(
                    "en-IN",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}`
                  : Number(
                    item.value ?? 0
                  ).toLocaleString(
                    "en-IN"
                  )}
              </span>
            </div>
          );
        })}

      </div>

    </div>
  );
}
function RevenueIcon({
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
      <path d="M3 17l5-5 4 3 7-8" />

      <path d="M14 7h5v5" />

      <path d="M3 21h18" />
    </svg>
  );
}
function ChartRangeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-[10px] font-semibold transition ${active
        ? "bg-[#0f766e] text-white shadow-sm"
        : "border border-[#dfe5e8] bg-white text-[#667085] hover:bg-[#f7faf9]"
        }`}
    >
      {label}
    </button>
  );
}

function ChartMetricCheckbox({
  label,
  colour,
  checked,
  onChange,
}: {
  label: string;
  colour: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#e1e8e6] bg-white px-3 py-2 shadow-sm transition hover:border-[#badbd5]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />

      <span
        className="flex h-4 w-4 items-center justify-center rounded border"
        style={{
          borderColor: colour,
          backgroundColor:
            checked
              ? colour
              : "white",
        }}
      >
        {checked && (
          <svg
            viewBox="0 0 16 16"
            className="h-3 w-3"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
          >
            <path d="m3 8 3 3 7-7" />
          </svg>
        )}
      </span>

      <span className="text-[10px] font-semibold text-[#475467]">
        {label}
      </span>

      <span
        className="h-2 w-2 rounded-full"
        style={{
          backgroundColor:
            colour,
        }}
      />
    </label>
  );
}

function ChartSummaryCard({
  label,
  value,
  colour,
}: {
  label: string;
  value: string;
  colour:
  | "teal"
  | "orange"
  | "purple";
}) {
  const colours = {
    teal: {
      label: "text-[#008f80]",
      border: "border-[#cfe8e3]",
      background: "bg-[#f0faf8]",
    },

    orange: {
      label: "text-orange-600",
      border: "border-orange-200",
      background: "bg-orange-50",
    },

    purple: {
      label: "text-purple-600",
      border: "border-purple-200",
      background: "bg-purple-50",
    },
  };

  const selectedColour =
    colours[colour];

  return (
    <div
      className={`min-w-[145px] rounded-2xl border px-4 py-3 ${selectedColour.border} ${selectedColour.background}`}
    >
      <p
        className={`text-[9px] font-semibold uppercase tracking-[0.1em] ${selectedColour.label}`}
      >
        {label}
      </p>

      <p className="mt-1 text-[18px] font-semibold text-[#101828]">
        {value}
      </p>
    </div>
  );
}
function CheckIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

