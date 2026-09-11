"use client";

import { SystemHeader } from "@/src/components/SystemHeader";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { formatAppVersion } from "@/src/lib/app-version";

interface LoginClientProps {
  enabledProviders: Array<{ id: string; name: string }>;
}

export default function LoginClient({ enabledProviders = [] }: LoginClientProps) {
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [oauthPending, setOauthPending] = useState<string | null>(null);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    setLoginPending(true);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!username || !password) {
      setLoginError("Username and password are required.");
      setLoginPending(false);
      return;
    }

    // `signIn.username` is added at runtime by the usernameClient plugin. The plugin's
    // $InferServerPlugin types fail to merge into the client signature in some environments,
    // so we cast a stable shape here.
    type SignInUsername = (input: { username: string; password: string }) => Promise<{
      error: { status?: number; message?: string } | null;
    }>;
    const signInUsername = (authClient.signIn as unknown as { username: SignInUsername }).username;
    const { error } = await signInUsername({ username, password });

    if (error) {
      let message: string | null = null;
      if (error.status === 429) {
        message = error.message || "Too many login attempts. Try again in a few minutes.";
      } else if (error.message) {
        message = error.message;
      }
      setLoginError(message ?? "Invalid username or password.");
      setLoginPending(false);
      return;
    }

    router.replace("/");
    router.refresh();
  };

  const handleOAuthSignIn = async (providerId: string) => {
    setLoginError(null);
    setOauthPending(providerId);
    try {
      await authClient.signIn.social({ provider: providerId, callbackURL: "/" });
    } catch {
      setLoginError("Failed to sign in with OAuth");
      setOauthPending(null);
    }
  };

  const disabled = loginPending || !!oauthPending;

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background eva-auth-canvas px-4 py-8">
      <div className="eva-auth-layout"><SystemHeader login /><Card className="eva-auth-form">
        <CardHeader className="space-y-1">
          <CardTitle className="eva-form-title">Operator authentication</CardTitle>
          <CardDescription>
            {enabledProviders.length > 0
              ? "Sign in to your account"
              : "Sign in with your credentials"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loginError && (
            <Alert variant="destructive">
              <AlertDescription>{loginError}</AlertDescription>
            </Alert>
          )}

          {enabledProviders.length > 0 && (
            <>
              <div className="space-y-2">
                {enabledProviders.map((provider) => {
                  const isPending = oauthPending === provider.id;
                  return (
                    <Button
                      key={provider.id}
                      variant="outline"
                      className="w-full"
                      onClick={() => handleOAuthSignIn(provider.id)}
                      disabled={disabled}
                    >
                      {isPending ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                      ) : (
                        <LogIn className="h-4 w-4 mr-2" />
                      )}
                      {isPending ? `Signing in with ${provider.name}…` : `Continue with ${provider.name}`}
                    </Button>
                  );
                })}
              </div>
              <div className="relative">
                <Separator />
                <span className="eva-auth-divider">
                  Or sign in with credentials
                </span>
              </div>
            </>
          )}

          <form onSubmit={handleSignIn} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                required
                autoComplete="username"
                autoFocus={enabledProviders.length === 0}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                disabled={disabled}
              />
            </div>
            <Button type="submit" className="w-full" disabled={disabled}>
              {loginPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground" title="Application version">
            {formatAppVersion()}
          </p>
        </CardContent>
      </Card></div>
    </div>
  );
}
