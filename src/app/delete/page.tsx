import type { Metadata } from "next";
import { DeleteForm } from "./DeleteForm";

export const metadata: Metadata = {
  title: "Delete My Data — SiteScore",
  description: "Request permanent deletion of your personal data held by SiteScore.",
  robots: { index: false, follow: false },
};

export default async function DeletePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <DeleteForm token={token} />;
}
