import React, { useState } from "react"
import { History, ArrowRight, Clock, Info, CheckCircle2, Shield } from "lucide-react"
import { SubscriptionHistoryItem } from "@/services/subscriptionService"

interface SubscriptionHistoryProps {
  history: SubscriptionHistoryItem[]
}

const ACTION_LABELS: Record<string, { label: string; badgeColor: string }> = {
  subscription_created: {
    label: "Subscription Created",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  },
  subscription_activated: {
    label: "Subscription Activated",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  plan_upgraded: {
    label: "Plan Upgraded",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  },
  plan_downgraded: {
    label: "Plan Downgraded",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  subscription_renewed: {
    label: "Subscription Renewed",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  subscription_cancelled: {
    label: "Cancellation Scheduled",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  },
  subscription_expired: {
    label: "Subscription Expired",
    badgeColor: "bg-neutral-800 text-neutral-400 border-neutral-700",
  },
}

export const SubscriptionHistory: React.FC<SubscriptionHistoryProps> = ({ history }) => {
  const [selectedItem, setSelectedItem] = useState<SubscriptionHistoryItem | null>(null)

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800 backdrop-blur-md shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-red-500" />
            <span>Subscription Activity & History</span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Immutable chronological audit log of all tier transitions, renewals, and cancellations.
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="py-12 text-center text-neutral-400 bg-neutral-950/40 rounded-2xl border border-neutral-800/80 p-6">
          <Clock className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-neutral-300">No subscription history found</p>
          <p className="text-xs text-neutral-500 mt-1">
            Your future plan activations, upgrades, and renewals will be recorded here automatically.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-950/50">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950 text-neutral-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Plan Transition</th>
                <th className="py-3 px-4">Reason / Details</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => {
                const actionMeta = ACTION_LABELS[item.action] || {
                  label: item.action.replace(/_/g, " "),
                  badgeColor: "bg-neutral-800 text-neutral-300 border-neutral-700",
                }

                const prevPlanName = item.previousPlanId?.name || "None"
                const newPlanName = item.newPlanId?.name || "Active Tier"
                const dateFormatted = item.performedAt
                  ? new Date(item.performedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Recent"

                return (
                  <tr
                    key={item._id}
                    className="border-b border-neutral-800/60 hover:bg-neutral-900/40 transition-colors"
                  >
                    <td className="py-3.5 px-4 text-neutral-300 font-medium whitespace-nowrap">
                      {dateFormatted}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${actionMeta.badgeColor}`}
                      >
                        {actionMeta.label}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-white whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-400">{prevPlanName}</span>
                        <ArrowRight className="w-3 h-3 text-neutral-500" />
                        <span className="text-red-400">{newPlanName}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-neutral-300 max-w-xs truncate">
                      {item.reason || "System verified lifecycle event"}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition cursor-pointer"
                        aria-label="View history item details"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-3xl p-6 shadow-2xl">
            <h4 className="text-lg font-bold text-white mb-4">Subscription Event Record</h4>
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2.5 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Action:</span>
                <span className="font-bold text-white uppercase">{selectedItem.action}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Date:</span>
                <span className="font-semibold text-white">
                  {new Date(selectedItem.performedAt).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Previous Tier:</span>
                <span className="text-neutral-300">{selectedItem.previousPlanId?.name || "None"}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Assigned Tier:</span>
                <span className="text-red-400 font-bold">{selectedItem.newPlanId?.name}</span>
              </div>
              <div className="pt-2 border-t border-neutral-800 text-neutral-400">
                <span className="block mb-1">Reason:</span>
                <p className="text-neutral-200 bg-neutral-900/80 p-2 rounded-lg">
                  {selectedItem.reason || "System operation"}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SubscriptionHistory
