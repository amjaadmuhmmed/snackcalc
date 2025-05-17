
// src/app/bills/page.tsx
"use client";

import { useState, useEffect } from "react";
import { getBills } from "../actions"; // Import the server action
import type { Bill } from "@/lib/db"; // Import the Bill type
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { format } from 'date-fns'; // For formatting dates

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBills = async () => {
      try {
        setLoading(true);
        const fetchedBills = await getBills(); // Call the server action
        console.log("Fetched Bills:", fetchedBills); // Log fetched bills
        setBills(fetchedBills);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch bills:", err);
        setError("Failed to load bills. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, []);

  const formatFirestoreTimestamp = (timestamp: any): string => {
    if (!timestamp) {
      return 'N/A';
    }

    try {
      let date: Date | null = null;

      // 1. Check if it's a Firestore Timestamp object
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
        if (isNaN(date.getTime())) {
            console.warn("Firestore Timestamp conversion resulted in invalid date:", timestamp);
            return 'Invalid Date (FS Conv)';
        }
      // 2. Check if it's a plain object with seconds/nanoseconds (common serialization)
      } else if (typeof timestamp === 'object' && timestamp !== null && typeof timestamp.seconds === 'number') {
        // Firestore timestamps use seconds since epoch. Multiply by 1000 for JS Date (milliseconds).
        date = new Date(timestamp.seconds * 1000);
        if (isNaN(date.getTime())) {
            console.warn("Timestamp object resulted in invalid date:", timestamp);
            return 'Invalid Date (Obj)';
        }
      // 3. Check if it's a number (assume milliseconds since epoch)
      } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            console.warn("Timestamp number resulted in invalid date:", timestamp);
            return 'Invalid Date (Num)';
        }
      // 4. Check if it's a string that can be parsed
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          console.warn("Timestamp string is not a valid date representation:", timestamp);
          return 'Invalid Date (Str)';
        }
      }

      // If we successfully created a valid date, format it
      if (date instanceof Date && !isNaN(date.getTime())) {
          return format(date, 'Pp'); // Format like: 09/15/2023, 4:30 PM
      } else {
        // If none of the above worked, log and return invalid
        console.warn('Unknown or unsupported timestamp format:', typeof timestamp, timestamp);
        return 'Invalid Date (Format)';
      }
    } catch (e) {
      console.error("Error formatting timestamp:", e, "Timestamp value:", timestamp);
      return 'Invalid Date (Error)';
    }
  };


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
       <div className="w-full max-w-5xl mb-4 flex justify-between items-center"> {/* Increased max-width */}
             <Button variant="outline" size="icon" asChild>
                <Link href="/" aria-label="Back to Snackulator">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <h1 className="text-2xl font-semibold">Transaction History</h1>
            <div style={{ width: '36px' }}></div> {/* Spacer */}
        </div>

      <Card className="w-full max-w-5xl"> {/* Increased max-width */}
        <CardHeader>
          {/* <CardTitle>Transaction History</CardTitle> */}
          <CardDescription>View all previously generated bills.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Loading bills...</p>
          ) : error ? (
            <p className="text-center text-destructive">{error}</p>
          ) : bills.length === 0 ? (
             <p className="text-center text-muted-foreground">No bills recorded yet.</p>
          ) : (
            <Table>
               <TableCaption>A list of your recent transactions.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead> {/* Added Customer column */}
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Service Ch.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.orderNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatFirestoreTimestamp(bill.createdAt)}</TableCell>
                    <TableCell>
                        {bill.customerName || '-'} <br />
                        <span className="text-xs text-muted-foreground">{bill.customerPhoneNumber || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <ul className="list-disc list-inside text-sm">
                        {bill.items.map((item, index) => (
                          <li key={index}>
                            {item.name} (x{item.quantity}) - ₹{item.price.toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="text-right">₹{bill.serviceCharge.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">₹{bill.totalAmount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
