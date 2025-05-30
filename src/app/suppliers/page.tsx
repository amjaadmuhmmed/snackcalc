
// src/app/suppliers/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getSuppliers } from "@/app/actions";
import type { Supplier } from "@/lib/db";
import { Toaster } from "@/components/ui/toaster";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoading(true);
        const fetchedSuppliers = await getSuppliers();
        setSuppliers(fetchedSuppliers);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch suppliers:", err);
        setError("Failed to load suppliers. Please try again later.");
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
  }, []);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
      <div className="w-full max-w-3xl mb-4 flex justify-between items-center">
        <Button variant="outline" size="icon" asChild>
          <Link href="/" aria-label="Back to Main Page">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Supplier List</h1>
        <div style={{ width: '36px' }}></div> {/* Spacer */}
      </div>

      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
          <CardDescription>A list of all suppliers registered in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Loading suppliers...</p>
          ) : error ? (
            <p className="text-center text-destructive">{error}</p>
          ) : suppliers.length === 0 ? (
            <p className="text-center text-muted-foreground">No suppliers recorded yet.</p>
          ) : (
            <Table>
              <TableCaption>Details of all registered suppliers.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Name</TableHead>
                  <TableHead>Supplier ID</TableHead>
                  {/* Add more columns here if supplier details expand in the future */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{supplier.id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}
