
// src/app/purchases/history/page.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Calendar as CalendarIcon, Search as SearchIcon, XCircle } from "lucide-react"; // Added SearchIcon and XCircle
import { getPurchases } from "@/app/actions";
import type { Purchase } from "@/lib/db";
import { format, isValid, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Timestamp } from "firebase/firestore";
import { Toaster } from "@/components/ui/toaster";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';

const convertFirestoreTimestampToDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  try {
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    } else if (timestamp instanceof Timestamp) {
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
      return format(date, 'MMM dd, yyyy');
    }
    return 'Invalid Date';
};


export default function PurchaseHistoryPage() {
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [filteredPurchases, setFilteredPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        setLoading(true);
        const fetchedPurchases = await getPurchases();
        setAllPurchases(fetchedPurchases);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch purchases:", err);
        setError("Failed to load purchase history. Please try again later.");
        setAllPurchases([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, []);

  useEffect(() => {
    if (loading) return;

    let tempFiltered = [...allPurchases];

    // Date Range Filter
    if (dateRange?.from) {
      const fromDate = startOfDay(dateRange.from);
      const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from); // Use purchaseDate for filtering
      tempFiltered = tempFiltered.filter((purchase) => {
        const purchaseCreationDate = convertFirestoreTimestampToDate(purchase.purchaseDate);
        if (!purchaseCreationDate || !isValid(purchaseCreationDate)) {
          return false;
        }
        return isWithinInterval(purchaseCreationDate, { 
            start: fromDate <= toDate ? fromDate : toDate, 
            end: fromDate <= toDate ? toDate : fromDate 
        });
      });
    }

    // Search Term Filter
    if (searchTerm.trim() !== "") {
      const lowerSearchTerm = searchTerm.toLowerCase();
      tempFiltered = tempFiltered.filter(purchase =>
        purchase.purchaseOrderNumber.toLowerCase().includes(lowerSearchTerm) ||
        (purchase.supplierName && purchase.supplierName.toLowerCase().includes(lowerSearchTerm)) ||
        (purchase.items && purchase.items.some(item =>
          item.name.toLowerCase().includes(lowerSearchTerm) ||
          (item.itemCode && item.itemCode.toLowerCase().includes(lowerSearchTerm))
        ))
      );
    }
    setFilteredPurchases(tempFiltered);

  }, [allPurchases, dateRange, searchTerm, loading]);


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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <CardTitle>Recorded Purchases</CardTitle>
              <CardDescription>
                {dateRange?.from && !dateRange.to ? "Showing purchases for " + format(dateRange.from, "LLL dd, yyyy") :
                  dateRange?.from && dateRange?.to && format(dateRange.from, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd") ? "Showing purchases for " + format(dateRange.from, "LLL dd, yyyy") :
                  dateRange?.from && dateRange?.to ? "Showing purchases from " + format(dateRange.from, "LLL dd, yyyy") + " to " + format(dateRange.to, "LLL dd, yyyy") :
                  "Showing all purchases."}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[260px] justify-start text-left font-normal h-9",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                {dateRange && (
                    <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)} aria-label="Clear date filter" className="h-9 w-9">
                        <XCircle className="h-4 w-4" />
                    </Button>
                )}
            </div>
          </div>
           <div className="relative">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                  type="search"
                  placeholder="Search PO#, supplier, items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-full sm:w-1/2 md:w-1/3 h-9"
                  aria-label="Search purchases"
              />
            </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Loading purchase history...</p>
          ) : error ? (
            <p className="text-center text-destructive">{error}</p>
          ) : filteredPurchases.length === 0 ? (
            <p className="text-center text-muted-foreground">
              {allPurchases.length === 0 ? "No purchases recorded yet." : "No purchases found for the selected criteria."}
            </p>
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
                {filteredPurchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-medium">{purchase.purchaseOrderNumber}</TableCell>
                    <TableCell>{formatDisplayDate(purchase.purchaseDate)}</TableCell>
                    <TableCell>{purchase.supplierName || '-'}</TableCell>
                    <TableCell className="min-w-[300px]">
                      <ul className="list-disc list-inside text-sm">
                        {(purchase.items || []).map((item, index) => (
                          <li key={index}>
                            {item.name} (x{item.quantity}) - @ {currencySymbol}{item.purchaseCost.toFixed(2)} each
                            {item.itemCode ? ` [${item.itemCode}]` : ''}
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{currencySymbol}{purchase.totalAmount.toFixed(2)}</TableCell>
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
