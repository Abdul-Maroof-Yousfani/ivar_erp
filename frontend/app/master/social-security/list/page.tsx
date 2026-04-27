import { getSocialSecurityInstitutions } from "@/lib/actions/social-security";
import { SocialSecurityList } from "./social-security-list";

export const dynamic = "force-dynamic";

export default async function SocialSecurityListPage({
  searchParams,
}: {
  searchParams: Promise<{ newItemId?: string }>;
}) {
  const { newItemId } = await searchParams;
  const { data: institutions } = await getSocialSecurityInstitutions();

  return <SocialSecurityList initialInstitutions={institutions || []} newItemId={newItemId} />;
}

