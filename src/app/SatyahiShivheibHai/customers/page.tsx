"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

type Customer = {
  user_id: string;
  name: string;
  phone: string;
  password: string;
  role: "ADMIN" | "CUSTOMER";
  address: string;
  is_active: boolean;
  created_at: string;
};

type CustomerStatus = "ALL" | "ACTIVE" | "INACTIVE";

type IconProps = {
  className?: string;
};

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

function SearchIcon({ className = "" }: IconProps) {
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
      <path d="m20 20-4-4" />
    </svg>
  );
}

function SummaryCard({
  title,
  value,
  description,
  colour,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  colour: "blue" | "green" | "orange";
  icon: (props: IconProps) => React.ReactElement;
}) {
  const colours = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <article className="rounded-[20px] border border-[#e1e7ea] bg-white p-5 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-medium text-[#667085]">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-[#101828]">{value}</p>
        </div>
        <span className={`rounded-xl p-2 ${colours[colour]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-[11px] text-[#98a2b3]">{description}</p>
    </article>
  );
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(
    null
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<CustomerStatus>("ALL");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchCustomers = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setLoading(true);
      }

      const { data, error: fetchError } = await supabase
        .from("users")
        .select(
          "user_id, name, phone, password, role, address, is_active, created_at"
        )
        .eq("role", "CUSTOMER")
        .order("created_at", {
          ascending: false,
        });

      if (fetchError) {
        setError(fetchError.message);
        setCustomers([]);
      } else {
        setCustomers((data ?? []) as Customer[]);
        setError("");
      }

      if (showLoader) {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchCustomers(true);

    const channel = supabase
      .channel("admin-customers-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
        },
        () => {
          void fetchCustomers(false);
        }
      )
      .subscribe();

    const fallbackRefresh = window.setInterval(() => {
      void fetchCustomers(false);
    }, 10000);

    return () => {
      window.clearInterval(fallbackRefresh);
      void supabase.removeChannel(channel);
    };
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        searchValue === "" ||
        customer.name.toLowerCase().includes(searchValue) ||
        customer.phone.toLowerCase().includes(searchValue) ||
        customer.user_id.toLowerCase().includes(searchValue) ||
        customer.address.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && customer.is_active) ||
        (statusFilter === "INACTIVE" && !customer.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [customers, search, statusFilter]);

  const activeCustomers = useMemo(
    () => customers.filter((customer) => customer.is_active).length,
    [customers]
  );

  const inactiveCustomers = useMemo(
    () => customers.filter((customer) => !customer.is_active).length,
    [customers]
  );

  async function toggleCustomerStatus(customer: Customer) {
    setUpdatingId(customer.user_id);
    setError("");
    setMessage("");

    const newStatus = !customer.is_active;

    const { error: updateError } = await supabase
      .from("users")
      .update({
        is_active: newStatus,
      })
      .eq("user_id", customer.user_id)
      .eq("role", "CUSTOMER");

    if (updateError) {
      setError(updateError.message);
      setUpdatingId(null);
      return;
    }

    setCustomers((currentCustomers) =>
      currentCustomers.map((currentCustomer) =>
        currentCustomer.user_id === customer.user_id
          ? {
              ...currentCustomer,
              is_active: newStatus,
            }
          : currentCustomer
      )
    );

    setMessage(
      newStatus
        ? `${customer.name}'s account is now active.`
        : `${customer.name}'s account has been deactivated.`
    );

    setUpdatingId(null);
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
  }

  function ActiveIcon({ className = "" }: IconProps) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  function InactiveIcon({ className = "" }: IconProps) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m9 9 6 6m0-6-6 6" />
      </svg>
    );
  }

  return (
    <div className="text-[#101828]">
      <section className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[#009d8b]">
            Customer management
          </p>

          <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.04em] text-[#101828]">
            Customers
          </h1>

          <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#667085]">
            View and manage every registered customer account from one place.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchCustomers(true)}
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
          Refresh customers
        </button>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Total customers"
          value={customers.length}
          description="Registered accounts"
          colour="blue"
          icon={CustomersIcon}
        />

        <SummaryCard
          title="Active customers"
          value={activeCustomers}
          description="Can currently sign in"
          colour="green"
          icon={ActiveIcon}
        />

        <SummaryCard
          title="Inactive customers"
          value={inactiveCustomers}
          description="Access currently disabled"
          colour="orange"
          icon={InactiveIcon}
        />
      </section>

      {(error || message) && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-[12px] ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="mb-6 rounded-[20px] border border-[#e1e7ea] bg-white p-4 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />

            <input
              type="search"
              placeholder="Search by name, phone, customer ID or address"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-[#dfe5e8] bg-[#fbfcfc] py-3 pl-11 pr-4 text-[13px] text-[#101828] outline-none placeholder:text-[#98a2b3] focus:border-[#81cdc5] focus:bg-white focus:ring-4 focus:ring-[#e6f6f3]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as CustomerStatus)
            }
            className="min-w-[190px] rounded-xl border border-[#dfe5e8] bg-[#fbfcfc] px-4 py-3 text-[13px] text-[#101828] outline-none focus:border-[#81cdc5] focus:bg-white"
          >
            <option value="ALL">All customers</option>
            <option value="ACTIVE">Active customers</option>
            <option value="INACTIVE">Inactive customers</option>
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-[#d8e0e4] bg-white px-4 py-3 text-[12px] font-semibold text-[#475467] transition hover:bg-[#f8faf9]"
          >
            Clear filters
          </button>
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] font-medium text-[#667085]">
          Showing {filteredCustomers.length} of {customers.length} customers
        </p>
        <div className="hidden items-center gap-2 text-[11px] font-medium text-[#009d8b] sm:flex">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#00a999]" />
          Live customer list
        </div>
      </div>

      {loading ? (
        <CustomerSkeleton />
      ) : filteredCustomers.length === 0 ? (
        <EmptyCustomers onClear={clearFilters} />
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.user_id}
              customer={customer}
              updating={updatingId === customer.user_id}
              onToggleStatus={toggleCustomerStatus}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function CustomerSkeleton() {
  return (
    <section
      aria-label="Loading customers"
      className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-[24px] border border-[#e1e7ea] bg-white p-5"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#eef2f4]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-[#eef2f4]" />
              <div className="h-3 w-1/3 rounded bg-[#f3f5f6]" />
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-3 w-full rounded bg-[#f3f5f6]" />
            <div className="h-3 w-4/5 rounded bg-[#f3f5f6]" />
            <div className="h-10 w-full rounded-xl bg-[#eef2f4]" />
          </div>
        </div>
      ))}
    </section>
  );
}

function EmptyCustomers({
  onClear,
}: {
  onClear: () => void;
}) {
  return (
    <section className="flex min-h-[340px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[#d4dfdf] bg-white px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eafbf7] text-[#009d8b]">
        <CustomersIcon className="h-6 w-6" />
      </div>

      <h2 className="mt-4 text-[16px] font-semibold text-[#344054]">
        No customers found
      </h2>

      <p className="mt-1 max-w-sm text-[12px] leading-5 text-[#98a2b3]">
        No customer matches the current search or status filter.
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

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "C";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function formatCustomerDate(dateValue: string) {
  if (!dateValue) {
    return "Not available";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function CustomerCard({
  customer,
  updating,
  onToggleStatus,
}: {
  customer: Customer;
  updating: boolean;
  onToggleStatus: (customer: Customer) => void;
}) {
  return (
    <article className="rounded-[24px] border border-[#e1e7ea] bg-white p-5 shadow-[0_2px_8px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eafbf7] text-[13px] font-semibold text-[#009d8b]">
            {getInitials(customer.name)}
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-[#101828]">
              {customer.name}
            </h3>
            <p className="text-[11px] text-[#667085]">Customer ID: {customer.user_id.slice(0, 8)}</p>
          </div>
        </div>

        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            customer.is_active
              ? "bg-[#eafbf7] text-[#009d8b]"
              : "bg-[#f3f5f6] text-[#667085]"
          }`}
        >
          {customer.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-5 space-y-3 text-[12px] text-[#475467]">
        <div className="flex items-center gap-2">
          <PhoneIcon className="h-4 w-4 text-[#98a2b3]" />
          <span>{customer.phone}</span>
        </div>

        <div className="flex items-start gap-2">
          <LocationIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#98a2b3]" />
          <span className="line-clamp-2">{customer.address || "No address provided"}</span>
        </div>

        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-[#98a2b3]" />
          <span>Joined {formatCustomerDate(customer.created_at)}</span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#edf2f3] pt-4">
        <button
          type="button"
          onClick={() => onToggleStatus(customer)}
          disabled={updating}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold transition ${
            customer.is_active
              ? "bg-[#fff3f2] text-[#c4320a] hover:bg-[#ffefe9]"
              : "bg-[#ebfbf7] text-[#009d8b] hover:bg-[#dffaf4]"
          } ${updating ? "cursor-not-allowed opacity-70" : ""}`}
        >
          {updating ? "Updating..." : customer.is_active ? "Deactivate" : "Activate"}
        </button>

        <div className="text-[11px] text-[#98a2b3]">
          {customer.role}
        </div>
      </div>
    </article>
  );
}

function PhoneIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.1 2 19.8 19.8 0 0 1-8.6-3.5 19.8 19.8 0 0 1-6-6A19.8 19.8 0 0 1 2 6.1 2 2 0 0 1 4 4h3a2 2 0 0 1 2 1.7l.5 2.8a2 2 0 0 1-.6 1.9L7 11.5a16 16 0 0 0 6 6l1.1-1.9a2 2 0 0 1 1.9-.6l2.8.5A2 2 0 0 1 19.3 18Z" />
    </svg>
  );
}

function CalendarIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function LocationIcon({ className = "" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}