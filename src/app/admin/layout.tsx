"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconProps = {
  className?: string;
};

const menuItems = [
  {
    name: "Overview",
    path: "/admin",
    icon: OverviewIcon,
  },
  {
    name: "Orders",
    path: "/admin/orders",
    icon: OrdersIcon,
  },
  {
    name: "Products",
    path: "/admin/products",
    icon: ProductsIcon,
  },
  {
    name: "Customers",
    path: "/admin/customers",
    icon: CustomersIcon,
  },
  {
    name: "Reports",
    path: "/admin/reports",
    icon: ReportsIcon,
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const currentPage =
    menuItems.find((item) => item.path === pathname)?.name ??
    "Admin Dashboard";

  return (
    <div className="flex h-screen overflow-hidden bg-[#f3f8f7] text-[#101828]">
      {/* Fixed sidebar */}

      <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-[#e5ebe9] bg-white">
        {/* Brand */}

        <div className="flex h-[76px] shrink-0 items-center border-b border-[#edf1f0] px-5">
          <div className="flex items-center gap-3">
            <img src="/SE_logo.png" alt="Logo" className="w-10 h-10" />

            <div>
              <h1 className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-[#101828]">
                Shankar Enterprises
              </h1>
            </div>
          </div>
        </div>

        {/* Navigation */}

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
            Workspace
          </p>

          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;

              const isActive =
                item.path === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.path);

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition ${
                    isActive
                      ? "bg-[#e9f7f4] text-[#0f172a] shadow-sm"
                      : "text-[#667085] hover:bg-[#f7f9f9] hover:text-[#344054]"
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] ${
                      isActive
                        ? "text-[#009d8b]"
                        : "text-[#8090a6] group-hover:text-[#475467]"
                    }`}
                  />

                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile */}

        <div className="shrink-0 border-t border-[#edf1f0] p-4">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-xs font-semibold text-white">
              SP
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#344054]">
                Sai Panda
              </p>

              <p className="text-[11px] text-[#98a2b3]">
                Administrator
              </p>
            </div>

            <svg
              className="h-4 w-4 text-[#98a2b3]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </div>
      </aside>

      {/* Right section */}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Fixed header */}

        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-[#edf1f0] bg-white px-6 lg:px-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#98a2b3]">
              Admin workspace
            </p>

            <h1 className="mt-0.5 text-[18px] font-semibold tracking-[-0.02em] text-[#1d2939]">
              {currentPage}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <svg
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>

              <input
                type="search"
                placeholder="Search"
                className="w-[220px] rounded-xl border border-[#dfe5e8] bg-[#fbfcfc] py-2.5 pl-10 pr-4 text-[13px] text-[#101828] shadow-sm outline-none placeholder:text-[#98a2b3] focus:border-[#81cdc5] focus:bg-white focus:ring-4 focus:ring-[#e6f6f3]"
              />
            </div>

            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#dfe5e8] bg-white text-[#667085] shadow-sm transition hover:bg-[#f8faf9]"
              aria-label="Notifications"
            >
              <svg
                className="h-[18px] w-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
            </button>
          </div>
        </header>

        {/* Only this section scrolls */}

        <main className="min-w-0 flex-1 overflow-y-auto bg-[#f3f8f7]">
          <div className="mx-auto w-full max-w-[1500px] px-5 py-6 sm:px-7 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function OverviewIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
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
      <path d="M5 7h14l-1 14H6L5 7Z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function ProductsIcon({ className = "" }: IconProps) {
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
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
      <path d="M16 3.1a4 4 0 0 1 0 7.8" />
    </svg>
  );
}

function ReportsIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </svg>
  );
}