
// src/app/purchases/history/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar as CalendarIcon } from "lucide-react";
import { getPurchases } from "@/app/actions";
import type { Purchase } from "@/lib/db";
import { format, isValid } from 'date-fns';
import { Timestamp } from "firebase/firestore";
import { Toaster } from "@/components/ui/toaster"; // Added missing import

const convertFirestoreTimestampToDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  try {
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    } else if (timestamp instanceof Timestamp) { // Explicitly check for Firestore Timestamp
        return timestamp.toDate();
    } else if (typeof timestamp === 'object' && timestamp !== null && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    } else if (typeof timestamp === 'number') {
      const d = new Date(timestamp);
      if (isValid(d)) return d;
    } else if (typeof timestamp === 'string') {
      const d = new Date(timestamp);
      if (isValid(d)) return d;
    }
    console.warn('Invalid or unsupported timestamp format for conversion:', typeof timestamp, timestamp);
    return null;
  } catch (e) {
    console.error("Error converting timestamp to Date:", e, "Timestamp value:", timestamp);
    return null;
  }
};

const formatDisplayDate = (timestamp: any): string => {
    const date = convertFirestoreTimestampToDate(timestamp);
    if (date && isValid(date)) {
      return format(date, 'MMM dd, yyyy'); // E.g., Apr 30, 2024
    }
    return 'Invalid Date';
};


export default function PurchaseHistoryPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        setLoading(true);
        const fetchedPurchases = await getPurchases();
        setPurchases(fetchedPurchases);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch purchases:", err);
        setError("Failed to load purchase history. Please try again later.");
        setPurchases([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, []);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
      <div className="w-full max-w-5xl mb-4 flex justify-between items-center">
        <Button variant="outline" size="icon" asChild>
          <Link href="/" aria-label="Back to Main Page">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Purchase History</h1>
        <div style={{ width: '36px' }}></div> {/* Spacer */}
      </div>

      <Card className="w-full max-w-5xl">
        <CardHeader>
          <CardTitle>Recorded Purchases</CardTitle>
          <CardDescription>A list of all items purchased for your store.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Loading purchase history...</p>
          ) : error ? (
            <p className="text-center text-destructive">{error}</p>
          ) : purchases.length === 0 ? (
            <p className="text-center text-muted-foreground">No purchases recorded yet.</p>
          ) : (
            <Table>
              <TableCaption>Details of past purchase orders.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="min-w-[300px]">Items Purchased</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Recorded At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">{purchase.purchaseOrderNumber}</TableCell>
                    <TableCell>{formatDisplayDate(purchase.purchaseDate)}</TableCell>
                    <TableCell>{purchase.supplierName || '-'}</TableCell>
                    <TableCell className="min-w-[300px]">
                      <ul className="list-disc list-inside text-sm">
                        {(purchase.items || []).map((item, index) => (
                          <li key={index}>
                            {item.name} (x{item.quantity}) - @ ₹{item.purchaseCost.toFixed(2)} each
                            {item.itemCode ? ` [${item.itemCode}]` : ''}
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="text-right font-semibold">₹{purchase.totalAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-xs whitespace-pre-wrap max-w-xs">{purchase.notes || '-'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDisplayDate(purchase.createdAt)}</TableCell>
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

