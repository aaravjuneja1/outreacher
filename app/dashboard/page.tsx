import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { DashboardClient } from "@/components/DashboardClient";
import { Footer } from "@/components/Footer";

export default async function DashboardPage() {
  const session = await currentSession();
  if (!session) redirect("/sign-in");

  return (
    <>
      <DashboardClient />
      <Footer />
    </>
  );
}
