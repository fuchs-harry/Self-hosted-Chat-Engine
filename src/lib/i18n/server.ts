import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { getDictionary, isLocale, type Locale } from "./index";

export const LOCALE_COOKIE = "locale";

export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(fromCookie) ? fromCookie : env().APP_LOCALE;
}

export async function getT() {
  return getDictionary(await getLocale());
}
