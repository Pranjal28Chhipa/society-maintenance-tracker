import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

/** The front door only decides where you belong; the sections do the work. */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "ADMIN" ? "/admin" : "/complaints");
}
