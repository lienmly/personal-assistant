"use server";

import { signIn, signOut } from "@/lib/auth";

export async function signInWithGoogle(formData: FormData) {
  const from = formData.get("from");
  await signIn("google", {
    redirectTo: typeof from === "string" && from.startsWith("/") ? from : "/today",
  });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
