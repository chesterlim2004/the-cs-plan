import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card } from "../components/ui";

export function RequirementsPage() {
  const query = useQuery({
    queryKey: ["requirements", "computer-science", "AY2025/26"],
    queryFn: () => api.getRequirements("computer-science", "AY2025/26")
  });

  return (
    <div className="p-5">
      <h1 className="text-2xl font-semibold">Requirement rules</h1>
      <p className="mt-1 text-sm text-muted">
        Versioned JSON rules used by the standalone evaluator for Milestone 1.
      </p>

      {query.isLoading && <p className="mt-5 text-sm text-muted">Loading requirement rules...</p>}
      {query.error && (
        <Card className="mt-5 border-amber-500/30 p-4 text-sm text-amber-200">
          Could not load requirement rules. Check that the API is running and that you are logged in.
        </Card>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {query.data?.rules.map((rule) => (
          <Card key={rule.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{rule.label}</h2>
                <p className="mt-1 text-sm text-muted">{rule.type}</p>
              </div>
              <span className="rounded-md border border-line px-2 py-1 text-xs text-muted">{rule.id}</span>
            </div>
            {rule.requiredModules && (
              <p className="mt-4 text-sm text-zinc-300">{rule.requiredModules.join(", ")}</p>
            )}
            {rule.requiredUnits && (
              <p className="mt-4 text-sm text-zinc-300">{rule.requiredUnits} required units</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
