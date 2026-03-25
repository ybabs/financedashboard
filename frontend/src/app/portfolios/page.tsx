"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowSquareOut,
  Buildings,
  CheckCircle,
  Plus,
} from "@phosphor-icons/react/dist/ssr";

import {
  addWorkspaceListItem,
  createWorkspaceList,
  getWorkspaceLists,
  type WorkspaceListResponse,
} from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function PortfoliosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetCompanyNumber = normalizeCompanyNumber(searchParams.get("company"));
  const targetCompanyName = (searchParams.get("name") || "").trim() || targetCompanyNumber;

  const [lists, setLists] = useState<WorkspaceListResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionBusyListId, setActionBusyListId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLists() {
      try {
        setLoading(true);
        setError(null);
        const payload = await getWorkspaceLists(100);
        if (!active) {
          return;
        }
        setLists(payload.items ?? []);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load portfolios");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadLists();
    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = createName.trim();
    if (!trimmedName) {
      setCreateError("Enter a portfolio name");
      return;
    }

    try {
      setCreateBusy(true);
      setCreateError(null);
      setActionMessage(null);
      const created = await createWorkspaceList(trimmedName);
      setCreateName("");

      if (targetCompanyNumber) {
        await addWorkspaceListItem(created.id, targetCompanyNumber);
        router.push(`/portfolios/${created.id}?added=${encodeURIComponent(targetCompanyNumber)}`);
        return;
      }

      router.push(`/portfolios/${created.id}?created=1`);
    } catch (createFailure) {
      setCreateError(createFailure instanceof Error ? createFailure.message : "Failed to create portfolio");
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleAddToPortfolio(list: WorkspaceListResponse) {
    if (!targetCompanyNumber) {
      return;
    }

    try {
      setActionBusyListId(list.id);
      setActionMessage(null);
      await addWorkspaceListItem(list.id, targetCompanyNumber);
      router.push(`/portfolios/${list.id}?added=${encodeURIComponent(targetCompanyNumber)}`);
    } catch (addFailure) {
      setActionMessage(addFailure instanceof Error ? addFailure.message : "Failed to add company to portfolio");
    } finally {
      setActionBusyListId(null);
    }
  }

  function clearTargetCompany() {
    router.replace("/portfolios", { scroll: false });
  }

  return (
    <div className="flex h-full w-full flex-col space-y-6 pb-6">
      <section className="cb-card rounded-3xl p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cb-text-subtle)]">
              Portfolio Navigation
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--cb-text-strong)]">
              Organize tracked companies into reusable workspaces
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cb-text-muted)]">
              Portfolios are tenant-scoped company lists. Use them to group entities for repeat review, monitoring,
              and later reporting workflows.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-4 text-sm text-[var(--cb-text-muted)]">
            {lists.length
              ? `${lists.length} portfolio${lists.length === 1 ? "" : "s"} available`
              : "Create your first portfolio to begin tracking companies"}
          </div>
        </div>
      </section>

      {targetCompanyNumber ? (
        <section className="rounded-3xl border border-[var(--astronaut-200)] bg-[var(--astronaut-50)] p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--astronaut-700)]">
                Add Current Company
              </div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">
                {targetCompanyName || targetCompanyNumber}
              </div>
              <div className="mt-1 text-sm text-[var(--cb-text-muted)]">Co. {targetCompanyNumber}</div>
            </div>

            <button
              type="button"
              onClick={clearTargetCompany}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--cb-stroke-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--cb-text-strong)] transition-colors hover:bg-[var(--cb-neutral-1)]"
            >
              Clear selection
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <section className="cb-card rounded-3xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">Create portfolio</h3>
              <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
                Start a new workspace list for a watchlist, sector view, or investigation thread.
              </p>
            </div>
            <div className="rounded-full bg-[var(--astronaut-50)] p-3 text-[var(--astronaut-700)]">
              <Plus className="h-5 w-5" />
            </div>
          </div>

          <form onSubmit={handleCreate} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">
                Portfolio name
              </span>
              <input
                type="text"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="Northern manufacturing watchlist"
                className="mt-2 h-12 w-full rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 text-sm font-medium text-[var(--cb-text-strong)] outline-none transition-colors focus:border-[var(--astronaut-200)]"
              />
            </label>

            {targetCompanyNumber ? (
              <div className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-4 text-sm text-[var(--cb-text-muted)]">
                The new portfolio will be created and immediately seeded with <span className="font-semibold text-[var(--cb-text-strong)]">{targetCompanyNumber}</span>.
              </div>
            ) : null}

            {createError ? (
              <div className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-3 text-sm text-[var(--cb-text-muted)]">
                {createError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={createBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#00288e] to-[#1e40af] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(23,28,31,0.08)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {createBusy ? "Creating portfolio..." : "Create portfolio"}
            </button>
          </form>
        </section>

        <section className="cb-card rounded-3xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">Existing portfolios</h3>
              <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
                Open a saved workspace or drop the current company into one of your lists.
              </p>
            </div>
            <div className="rounded-full bg-[var(--cb-neutral-1)] p-3 text-[var(--cb-text-subtle)]">
              <Buildings className="h-5 w-5" />
            </div>
          </div>

          {actionMessage ? (
            <div className="mt-4 rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-3 text-sm text-[var(--cb-text-muted)]">
              {actionMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-8 text-center text-sm text-[var(--cb-text-muted)]">
              Loading portfolios...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-4 text-sm text-[var(--cb-text-muted)]">
              {error}
            </div>
          ) : lists.length ? (
            <div className="mt-6 grid grid-cols-1 gap-4">
              {lists.map((list) => (
                <article
                  key={list.id}
                  className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)] p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">
                        Portfolio
                      </div>
                      <h4 className="mt-2 text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">
                        {list.name}
                      </h4>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-[var(--cb-text-muted)]">
                        <span>Created {formatDate(list.created_at)}</span>
                        <span>Updated {formatDate(list.updated_at)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {targetCompanyNumber ? (
                        <button
                          type="button"
                          onClick={() => handleAddToPortfolio(list)}
                          disabled={actionBusyListId === list.id}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#00288e] to-[#1e40af] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(23,28,31,0.08)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {actionBusyListId === list.id ? "Adding..." : "Add current company"}
                        </button>
                      ) : null}

                      <Link
                        href={`/portfolios/${list.id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-2.5 text-sm font-semibold text-[var(--cb-text-strong)] transition-colors hover:bg-[var(--cb-neutral-0)]"
                      >
                        <ArrowSquareOut className="h-4 w-4" />
                        Open portfolio
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[var(--astronaut-700)]">
                <Buildings className="h-5 w-5" />
              </div>
              <div className="mt-4 text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">
                No portfolios yet
              </div>
              <div className="mt-2 text-sm text-[var(--cb-text-muted)]">
                Create your first portfolio to turn one-off company reviews into a reusable workspace.
              </div>
            </div>
          )}

          {!loading && !error && lists.length ? (
            <div className="mt-6 flex items-center justify-between rounded-2xl bg-[var(--cb-neutral-1)] px-4 py-4 text-sm text-[var(--cb-text-muted)]">
              <span>Portfolio detail adds company-level monitoring metrics and direct company links.</span>
              <span className="inline-flex items-center gap-2 font-semibold text-[var(--cb-text-strong)]">
                Open one <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function normalizeCompanyNumber(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}
