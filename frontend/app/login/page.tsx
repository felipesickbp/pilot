import { Card, CardContent, CardHeader, Button, Input, Subhead } from "../components/ui";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[color:var(--bp-bg)]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="text-2xl font-semibold">Sign in</div>
            <Subhead>Access your BexioFlow workspace</Subhead>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Email</div>
              <Input placeholder="you@company.ch" />
            </div>

            <div className="grid gap-2">
              <div className="text-xs font-semibold text-slate-600">Password</div>
              <Input type="password" placeholder="••••••••" />
            </div>

            <Button className="w-full">Login</Button>

            <div className="text-center text-xs text-slate-500">
              By continuing you agree to your organization’s policies.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

