"use client";

import Link from "next/link";

type IconProps = {
  className?: string;
};

export default function AdminPage() {
  const metrics = [
    {
      title: "Total products",
      value: "0",
      description: "Live catalogue",
      icon: PackageIcon,
      iconBackground: "bg-[#edf4ff]",
      iconColour: "text-[#2563eb]",
    },
    {
      title: "Pending orders",
      value: "0",
      description: "Awaiting processing",
      icon: OrdersIcon,
      iconBackground: "bg-[#fff4e8]",
      iconColour: "text-[#f97316]",
    },
    {
      title: "Active customers",
      value: "0",
      description: "Enabled accounts",
      icon: CustomersIcon,
      iconBackground: "bg-[#faf0ff]",
      iconColour: "text-[#a855f7]",
    },
    {
      title: "Delivered orders",
      value: "0",
      description: "Successfully completed",
      icon: DeliveredIcon,
      iconBackground: "bg-[#eafbf7]",
      iconColour: "text-[#009d8b]",
    },
  ];

  return (
    <div className="min-h-full text-[#101828]">
      {/* Intro */}

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

      {/* Main Dashboard Content */}

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.75fr)]">
        {/* Revenue Overview */}

        <article className="overflow-hidden rounded-[26px] border border-[#e4e9ec] bg-white shadow-[0_2px_4px_rgba(16,24,40,0.03),0_16px_36px_rgba(16,24,40,0.05)]">
          <div className="flex flex-col gap-5 border-b border-[#edf0f2] px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-8">
            <div>
              <p className="text-lg font-semibold text-[#101828]">
                Revenue overview
              </p>

              <p className="mt-1 text-sm text-[#98a2b3]">
                Net revenue generated from delivered orders
              </p>
            </div>

            <span className="w-fit rounded-full bg-[#eafbf7] px-3 py-1.5 text-xs font-semibold text-[#008f80]">
              Live total
            </span>
          </div>

          <div className="px-6 py-7 sm:px-8">
            <p className="text-[36px] font-semibold tracking-[-0.04em] text-[#101828]">
              ₹0.00
            </p>

            <div className="relative mt-8 h-[235px] overflow-hidden rounded-[20px] border border-[#dfeeea] bg-gradient-to-b from-[#f1fbf9] to-[#fbfdfd]">
              <div className="absolute inset-x-0 top-1/4 border-t border-dashed border-[#d4e8e3]" />
              <div className="absolute inset-x-0 top-2/4 border-t border-dashed border-[#d4e8e3]" />
              <div className="absolute inset-x-0 top-3/4 border-t border-dashed border-[#d4e8e3]" />

              <svg
                viewBox="0 0 800 220"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient
                    id="revenue-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#13aaa3" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#13aaa3" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                <path
                  d="M0 175 C70 150, 110 180, 170 138 C230 95, 290 145, 350 105 C410 65, 470 126, 530 86 C590 45, 650 112, 710 72 C750 48, 775 20, 800 42 L800 220 L0 220 Z"
                  fill="url(#revenue-fill)"
                />

                <path
                  d="M0 175 C70 150, 110 180, 170 138 C230 95, 290 145, 350 105 C410 65, 470 126, 530 86 C590 45, 650 112, 710 72 C750 48, 775 20, 800 42"
                  fill="none"
                  stroke="#13aaa3"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute bottom-4 left-5 rounded-full border border-[#d9ece8] bg-white/90 px-3 py-1.5 text-xs font-medium text-[#667085] shadow-sm">
                Revenue activity will update with orders
              </div>
            </div>
          </div>
        </article>

        {/* Recent Activity */}

        <article className="rounded-[26px] border border-[#e4e9ec] bg-white p-6 shadow-[0_2px_4px_rgba(16,24,40,0.03),0_16px_36px_rgba(16,24,40,0.05)] sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#101828]">
                Recent activity
              </h2>

              <p className="mt-1 text-sm text-[#98a2b3]">
                Latest store updates
              </p>
            </div>

            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e4e7ec] text-[#667085] transition hover:bg-[#f8fafb]"
              aria-label="Activity menu"
            >
              <span className="pb-2 text-xl leading-none">•••</span>
            </button>
          </div>

          <div className="mt-7 space-y-1">
            <ActivityItem
              title="Store catalogue ready"
              description="Product management is available"
            />

            <ActivityItem
              title="Database connected"
              description="Store records are available"
            />

            <ActivityItem
              title="Admin account enabled"
              description="Administrative access is active"
            />

            <ActivityItem
              title="Image storage ready"
              description="Product image uploads are enabled"
              last
            />
          </div>
        </article>
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
            href="/admin/products"
            icon={PackageIcon}
          />

          <QuickAction
            title="Add product"
            description="Create new item"
            href="/admin/products/new"
            icon={PlusIcon}
          />

          <QuickAction
            title="Orders"
            description="Track fulfillment"
            href="/admin/orders"
            icon={OrdersIcon}
          />

          <QuickAction
            title="Customers"
            description="View buyers"
            href="/admin/customers"
            icon={CustomersIcon}
          />
        </div>
      </section>
    </div>
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