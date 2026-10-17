import { UploadFlow } from "@/components/UploadFlow";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ slotId?: string }>;
}) {
  const params = await searchParams;
  return (
    <main>
      <UploadFlow slotId={params.slotId} />
    </main>
  );
}
