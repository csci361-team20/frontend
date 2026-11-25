/** The visitor's language on the server: the cookie, else the browser's preference. */
import { cookies, headers } from "next/headers";
import { isLang, LANG_COOKIE, langFromHeader, translators, type Lang } from "./i18n";

export async function serverLang(): Promise<Lang> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(saved)) return saved;
  return langFromHeader((await headers()).get("accept-language")) ?? "en";
}

/** The translator for server components. */
export async function serverT() {
  return translators[await serverLang()];
}
