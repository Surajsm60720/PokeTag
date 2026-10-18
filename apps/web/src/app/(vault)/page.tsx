import { DialogBox } from "@/components/DialogBox";
import { Shelf } from "@/components/Shelf";
import { listSlots } from "@/lib/vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage() {
  const slots = await listSlots();
  const copy =
    slots.length === 0
      ? "The shelf is empty. Open NEW RUN to start tracking a save."
      : `You have ${slots.length} run${slots.length === 1 ? "" : "s"} on the shelf. Pick one, or start another with NEW RUN.`;

  return (
    <main className="stack">
      <DialogBox text={copy} name="SHELF" showArrow speed="fast" />
      <Shelf slots={slots} />
    </main>
  );
}
