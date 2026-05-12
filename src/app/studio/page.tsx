import { redirect } from "next/navigation";
import StudioWorkspace from "@/components/StudioWorkspace";
import { createClient } from "@/lib/supabase/server";

export default async function StudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ lane?: string; guide?: string; voice?: string; voiceName?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};

  return (
    <StudioWorkspace
      lane={params.lane}
      guide={params.guide}
      voice={params.voice}
      voiceName={params.voiceName}
    />
  );
}
