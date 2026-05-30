import { GraduationCap } from "lucide-react";
import { Button, Card } from "../components/ui";
import { api } from "../lib/api";

export function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-surface p-6 text-zinc-100">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-white text-surface">
            <GraduationCap />
          </div>
          <div>
            <h1 className="text-xl font-semibold">The CS Plan</h1>
            <p className="text-sm text-muted">Your NUS Computing Planning Companion</p>
          </div>
        </div>

        <Button className="w-full" onClick={() => (window.location.href = api.loginUrl)}>
          Continue with Google
        </Button>

        <p className="mt-5 text-xs leading-5 text-muted">
          Uses Google Sign-in only. Your module plan is stored separately from
          Google and can be exported later.
        </p>
      </Card>
    </div>
  );
}
