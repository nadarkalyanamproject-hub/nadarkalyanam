"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SupportContactResponse } from "@nadar-kalyanam/schemas";
import { Mail, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AppHeader } from "../../components/app-header";
import { getSupportContact } from "../../lib/api-client";
import { supportContactLinks } from "../../lib/membership";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; contact: SupportContactResponse };

// Public Contact page. Shows only the details configured on the server
// (SUPPORT_EMAIL, SUPPORT_WHATSAPP_NUMBER); with none set it says so.
export default function ContactPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getSupportContact()
      .then((contact) => {
        if (!cancelled) setState({ kind: "loaded", contact });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const links =
    state.kind === "loaded" ? supportContactLinks(state.contact) : [];

  return (
    <div className="min-h-screen bg-[#FAF6F0]">
      <AppHeader />
      <main className="mx-auto max-w-xl px-4 py-10 sm:py-14">
        <h1 className="text-center text-2xl sm:text-3xl font-bold tracking-tight text-[#2B1515]">
          Contact us
        </h1>
        <p className="mt-2 text-center text-sm text-[#73645C]">
          Questions about your account or membership? Reach the Nadar Kalyanam
          team here.
        </p>

        <Card
          className="mt-8 rounded-2xl border border-[#E8DCCF] bg-white p-6 text-sm"
          data-testid="contact-card"
        >
          {state.kind === "loading" && (
            <p className="text-center text-[#73645C]">Loading…</p>
          )}
          {state.kind === "error" && (
            <p
              className="text-center text-[#73645C]"
              role="alert"
              data-testid="contact-error"
            >
              Could not load contact details. Please try again later.
            </p>
          )}
          {state.kind === "loaded" && links.length === 0 && (
            <p
              className="text-center font-semibold text-[#5A493E]"
              data-testid="contact-empty"
            >
              Contact details will be added soon.
            </p>
          )}
          {links.length > 0 && (
            <ul className="space-y-3" data-testid="contact-links">
              {links.map((link) => (
                <li key={link.kind}>
                  <a
                    href={link.href}
                    data-testid={`contact-${link.kind}`}
                    {...(link.kind === "whatsapp"
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="flex items-center gap-3 rounded-xl border border-[#EEDFCD] bg-[#FDF9F3] px-4 py-3 font-semibold text-[#680A0E] hover:bg-[#F7EBDC]"
                  >
                    {link.kind === "email" ? (
                      <Mail className="h-4 w-4" />
                    ) : (
                      <MessageCircle className="h-4 w-4 text-[#25D366]" />
                    )}
                    <span className="flex flex-col">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C7B73]">
                        {link.kind === "email" ? "Email" : "WhatsApp"}
                      </span>
                      <span className="break-all">{link.label}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-[#8C7B73]">
          <Link href="/membership" className="underline">
            Membership
          </Link>{" "}
          ·{" "}
          <Link href="/" className="underline">
            Home
          </Link>
        </p>
      </main>
    </div>
  );
}
