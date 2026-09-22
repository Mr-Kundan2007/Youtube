import React, { useState } from "react"
import { ChevronDown, HelpCircle } from "lucide-react"

interface FAQItem {
  question: string
  answer: string
}

const FAQS: FAQItem[] = [
  {
    question: "What is included in each subscription plan?",
    answer:
      "Every plan is designed for different viewing and learning needs. Free tier offers standard videos and 720p HD. Bronze unlocks premium video library access, 1080p Full HD, and 5 downloads/day. Silver adds 100% ad-free playback, premium interactive courses, 2K 1440p resolution, and 15 downloads/day. Gold is our VIP tier with 4K Ultra HD HDR, exclusive masterclasses, 50 downloads/day, and 5 concurrent screens.",
  },
  {
    question: "Can I upgrade or downgrade my subscription later?",
    answer:
      "Yes, absolutely. You can upgrade anytime to immediately unlock higher resolution streaming, increased daily download quotas, and premium courses. Downgrades take effect at the conclusion of your current active billing period, ensuring you retain all paid benefits.",
  },
  {
    question: "How do offline video downloads work?",
    answer:
      "Eligible videos can be downloaded offline using our secure download token delivery. Downloaded files are bound to your authorized devices and can be watched seamlessly without internet. Your daily download limit resets at midnight UTC.",
  },
  {
    question: "What happens when my subscription expires?",
    answer:
      "When your subscription expires, your account automatically and gracefully transitions back to the Free plan. Your account data, watch history, playlists, liked videos, and channel subscriptions are 100% preserved permanently.",
  },
  {
    question: "Will my watch history or saved videos be deleted if I cancel?",
    answer:
      "Never! Your personal watch history, saved playlists, liked videos, and channel interactions remain intact and safe forever, regardless of your subscription status.",
  },
  {
    question: "Can I cancel my subscription at any time?",
    answer:
      "Yes, you can schedule cancellation at any moment directly from your Subscription Management dashboard with a single click. There are no cancellation penalties or hidden lock-in contracts.",
  },
  {
    question: "Which payment methods will be supported?",
    answer:
      "We will support all major payment options including UPI (Google Pay, PhonePe, Paytm), Credit & Debit Cards (Visa, Mastercard, RuPay), and Netbanking through our upcoming secure Razorpay payment integration.",
  },
  {
    question: "What is the difference between Monthly, Quarterly, and Yearly billing?",
    answer:
      "Monthly billing gives you maximum flexibility with 30-day renewals. Quarterly billing gives you 3 months with an automatic 10% discount. Yearly billing gives you 365 days of uninterrupted access with an automatic 20% discount (equivalent to getting over 2 months free).",
  },
]

export const SubscriptionFAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <div className="w-full my-16 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Got Questions?</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-sm text-neutral-400 mt-2">
          Find instant answers to common questions regarding plans, billing, and offline downloads.
        </p>
      </div>

      <div className="space-y-3">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index
          return (
            <div
              key={index}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-md overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => toggleFAQ(index)}
                aria-expanded={isOpen}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-neutral-800/40 transition"
              >
                <span className="text-sm sm:text-base font-semibold text-white">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-neutral-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-red-400" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-neutral-300 leading-relaxed border-t border-neutral-800/40">
                  {faq.answer}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SubscriptionFAQ
