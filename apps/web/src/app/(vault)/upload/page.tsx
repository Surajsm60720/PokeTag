import { UploadFlow } from "@/components/UploadFlow";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{
    slotId?: string;
    mode?: string;
    game?: string;
  }>;
}) {
  const params = await searchParams;
  // Bound uploads add a version; everything else is a new-run flow by default.
  const forceNewRun = !params.slotId;
  return (
    <main>
      <UploadFlow
        slotId={params.slotId}
        forceNewRun={forceNewRun}
        preferredGame={params.game}
      />
    </main>
  );
}
