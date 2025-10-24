// src/app/page.tsx (New Login Page)
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Landmark } from "lucide-react";

const SESSION_STORAGE_ADMIN_LOGGED_IN_KEY = 'isAdminLoggedIn';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Check if already logged in
  useEffect(() => {
    try {
      const adminLoggedIn = sessionStorage.getItem(SESSION_STORAGE_ADMIN_LOGGED_IN_KEY);
      if (adminLoggedIn === 'true') {
        router.replace('/sales');
      } else {
        setIsLoading(false);
      }
    } catch (error) {
        console.warn("Session storage not available.");
        setIsLoading(false);
    }
  }, [router]);

  const handleAdminLogin = () => {
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (!adminPassword || adminPassword.length === 0) {
      toast({
        variant: "destructive",
        title: "Admin password not configured.",
        description: "Please set NEXT_PUBLIC_ADMIN_PASSWORD in your environment variables.",
      });
      return;
    }
    if (password === adminPassword) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_ADMIN_LOGGED_IN_KEY, 'true');
        router.push('/sales');
      } catch (error) {
         toast({
            variant: "destructive",
            title: "Login Failed",
            description: "Could not persist login session. Please enable cookies/session storage.",
        });
      }
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Password.",
      });
    }
  };

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4 md:p-8">
            <p className="text-lg text-muted-foreground">Loading...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4 md:p-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
                 <Landmark className="h-10 w-10 text-primary" />
            </div>
          <CardTitle className="text-2xl">Snackulator</CardTitle>
          <CardDescription>Please enter the admin password to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                required
                aria-label="Admin Password"
              />
            </div>
            <Button className="w-full" onClick={handleAdminLogin}>Login</Button>
          </div>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}
