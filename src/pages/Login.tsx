import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanySettings } from "@/hooks/use-company-settings";

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const { toast } = useToast();
  const { user, role, loading: authLoading, signOut } = useAuth();
  const { data: companySettings } = useCompanySettings();

  if (!authLoading && user && role === "admin") {
    return <Navigate to="/admin/branches" replace />;
  }

  if (!authLoading && user && role === "area_manager") {
    return <Navigate to="/admin/schedules" replace />;
  }

  if (!authLoading && user && role === "staff") {
    return <Navigate to="/staff/dashboard" replace />;
  }

  if (!authLoading && user && !role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-carbon px-4">
        <Card className="w-full max-w-md border-carbon-light">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Account access pending</CardTitle>
            <CardDescription>
              You are signed in, but this account does not have an app role yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" className="w-full" onClick={signOut}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (forgotMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "A password reset link has been sent to your email.",
        });
        setForgotMode(false);
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "A confirmation link has been sent to your email.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      let msg = error?.message || "An unknown error occurred.";
      if (msg.includes("Invalid login credentials")) msg = "Invalid email or password. Please try again.";
      else if (msg.includes("Email not confirmed")) msg = "Please verify your email before signing in.";
      else if (msg.includes("fetch") || msg.includes("network")) msg = "Network error. Please check your connection.";
      toast({
        title: "Sign-in failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "linear-gradient(150deg, hsl(224 60% 7%) 0%, hsl(221 55% 12%) 100%)" }}>
      <Card className="w-full max-w-md bg-card border border-white/[0.08] shadow-2xl">
        <CardHeader className="text-center pb-2">
          {companySettings?.logo_url ? (
            <div className="flex justify-center mb-4">
              <img src={companySettings.logo_url} alt="Company Logo" className="h-16 w-auto object-contain" />
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <div className="gold-avatar h-16 w-16 text-2xl">
                {(companySettings?.company_name || "HR")[0]}
              </div>
            </div>
          )}
          <CardTitle className="text-2xl">{companySettings?.company_name || "HR & Payroll System"}</CardTitle>
          <CardDescription>
            {forgotMode ? "Reset your password" : isSignUp ? "Create an account" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="staff@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>
            {!forgotMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12"
                />
              </div>
            )}
            <Button type="submit" className="w-full h-12 text-base font-semibold shadow-sm" disabled={loading}>
              {loading ? "Loading..." : forgotMode ? "Send Reset Link" : isSignUp ? "Sign Up" : "Sign In"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm space-y-2">
            {!forgotMode && !isSignUp && (
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:underline block w-full"
                onClick={() => setForgotMode(true)}
              >
                Forgot password?
              </button>
            )}
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline"
              onClick={() => { setIsSignUp(!isSignUp); setForgotMode(false); }}
            >
              {forgotMode ? "Back to Sign In" : isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
