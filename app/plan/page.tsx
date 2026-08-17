import { redirect } from "next/navigation";
import { PlanClient } from "@/components/PlanClient";
import { getStore } from "@/lib/data";
import { getServerUser } from "@/lib/supabase/serverUser";
import {
  currentWeekStartKey,
  isValidDateKey,
  startOfWeek,
  fromDateKey,
  toDateKey,
  weekDateKeys,
} from "@/lib/plan/week";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; day?: string }>;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login?next=/plan");

  const { week, day } = await searchParams;
  const today = toDateKey(new Date());

  const weekStart =
    week && isValidDateKey(week)
      ? toDateKey(startOfWeek(fromDateKey(week)))
      : day && isValidDateKey(day)
        ? toDateKey(startOfWeek(fromDateKey(day)))
        : currentWeekStartKey();

  const days = weekDateKeys(weekStart);
  const entries = await getStore().listPlan(user.id, days[0], days[6]);

  return (
    <PlanClient key={weekStart} weekStart={weekStart} initialEntries={entries} />
  );
}
