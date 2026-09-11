"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CONSOLE_DEVICE_PATH } from "@/lib/domain/device-declaration";
import { CONSOLE_ROOT_PATH } from "@/lib/domain/operator-session";
import { requireOperator } from "@/lib/server/console-session";
import {
  DEVICE_SENDER_COOKIE_NAME,
  deviceSenderCookieOptions,
  signDeviceSenderCookie,
} from "@/lib/server/cookies";
import { listOperatorProfiles } from "@/lib/server/invitations";
import { createServerSupabaseClient } from "@/lib/server/supabase";

/**
 * Records which WhatsApp account is installed on this device.
 *
 * `requireOperator()` first, even though the declaration authorizes nothing: an
 * anonymous visitor has no console to declare anything about, and a route
 * handler that writes a cookie for anyone who asks is a route handler that can
 * be pointed at somebody else's browser.
 *
 * The submitted id is checked against the real sender list before it is signed.
 * Not because a forged declaration would grant anything — it would not, the
 * declaration is never an authorization input — but because an id naming nobody
 * produces a permanent mismatch interstitial that no exit resolves, and the
 * operator would have no way to understand why.
 *
 * An unusable answer returns to the PICKER. Not to a default, not to the
 * console with the previous value intact: the question is unanswered, so it gets
 * asked again.
 */
export async function declareDeviceAction(formData: FormData): Promise<void> {
  await requireOperator();

  const senderId = String(formData.get("senderId") ?? "").trim();
  const operators = await listOperatorProfiles(createServerSupabaseClient());

  if (!operators.some((operator) => operator.id === senderId)) {
    redirect(CONSOLE_DEVICE_PATH);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    DEVICE_SENDER_COOKIE_NAME,
    signDeviceSenderCookie(senderId),
    deviceSenderCookieOptions(),
  );

  redirect(CONSOLE_ROOT_PATH);
}
