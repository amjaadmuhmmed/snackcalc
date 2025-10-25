// src/app/reports/stock/[id]/page.tsx
"use client";

import React, { Suspense, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, BookOpen } from "lucide-react";
import { getItems, getBills, getPurchases } from "@/app/actions";
import type { Snack, Bill, Purchase } from "@/lib/db";
import { format, isValid, parseISO } from 'date-fns';
import { Toaster } from "@/components/ui/toaster";
import { Badge } from "@/components/ui/badge";

const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';

type StockMovement = {
  date: Date;
  type: 'Opening Stock' | 'Sale' | 'Purchase';
  referenceId: string; // Bill ID or Purchase ID
  purchaseQty?: number;
  purchaseAmount?: number;
  saleQty?: number;
  saleAmount?: number;
  closingStock: number;
};

const formatDisplayDate = (date: Date | string): string => {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        if (dateObj && isValid(dateObj)) {
            return format(dateObj, 'MMM dd, yyyy, p');
        }
        return 'Invalid Date';
    } catch(e) {
        return 'Invalid Date';
    }
};

function StockRegisterContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  
  const itemId = params.id as string;
  const itemName = searchParams.get("name") || "Item";

  const [item, setItem] = useState<Snack | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) {
      setError("Item ID not provided.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [allItems, allBills, allPurchases] = await Promise.all([
          getItems(),
          getBills(),
          getPurchases(),
        ]);

        const currentItem = allItems.find(i => i.id === itemId);
        if (!currentItem) {
          throw new Error("Item not found.");
        }
        setItem(currentItem);

        // 1. Find all sales for this item
        const saleMovements: StockMovement[] = [];
        allBills.forEach(bill => {
          const relevantItem = bill.items.find(i => i.itemId === itemId);
          if (relevantItem) {
            saleMovements.push({
              date: parseISO(bill.createdAt),
              type: 'Sale',
              referenceId: bill.id,
              saleQty: relevantItem.quantity,
              saleAmount: relevantItem.price,
              closingStock: 0, // Will be calculated later
            });
          }
        });

        // 2. Find all purchases for this item
        const purchaseMovements: StockMovement[] = [];
        allPurchases.forEach(purchase => {
          const relevantItem = purchase.items.find(i => i.itemId === itemId);
          if (relevantItem) {
            purchaseMovements.push({
              date: parseISO(purchase.purchaseDate),
              type: 'Purchase',
              referenceId: purchase.id,
              purchaseQty: relevantItem.quantity,
              purchaseAmount: relevantItem.purchaseCost,
              closingStock: 0, // Will be calculated later
            });
          }
        });

        // 3. Create Opening Stock entry
        const openingStockMovement: StockMovement = {
            date: new Date(0), // Placeholder, should be the item creation date if available
            type: 'Opening Stock',
            referenceId: currentItem.id,
            purchaseQty: currentItem.stockQuantity, // This needs clarification. Assume initial quantity is an "opening" purchase.
            purchaseAmount: currentItem.cost || 0,
            closingStock: currentItem.stockQuantity
        };
        // For this implementation, we will assume current stockQuantity IS the final stock, and we work backwards.
        // A more robust system would track item creation date and initial quantity.
        
        // Combine and sort all movements by date
        const allMovements = [...saleMovements, ...purchaseMovements].sort((a, b) => a.date.getTime() - b.date.getTime());

        // Calculate closing stock chronologically
        let currentStock = currentItem.stockQuantity; // Start with the final known stock and work backwards
        
        // To calculate historical closing stock, we reverse the logic
        const reversedMovements = allMovements.slice().reverse();
        const historicalMovements: StockMovement[] = [];

        reversedMovements.forEach(move => {
            const moveWithClosing = { ...move, closingStock: currentStock };
            historicalMovements.push(moveWithClosing);
            if (move.type === 'Sale') {
                currentStock += move.saleQty || 0;
            } else if (move.type === 'Purchase') {
                currentStock -= move.purchaseQty || 0;
            }
        });
        
        // The first historical transaction's "before" state is the opening stock
        const openingStock: StockMovement = {
            date: historicalMovements.length > 0 ? historicalMovements[historicalMovements.length - 1].date : new Date(),
            type: 'Opening Stock',
            referenceId: currentItem.id,
            closingStock: currentStock,
        };
        
        setStockMovements([openingStock, ...historicalMovements.reverse()]);

      } catch (err: any) {
        console.error("Failed to generate stock register:", err);
        setError(`Failed to generate stock register for ${itemName}. ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [itemId, itemName]);
  
  const finalStock = useMemo(() => {
    if (stockMovements.length === 0) return item?.stockQuantity || 0;
    const lastMovement = stockMovements[stockMovements.length - 1];
    return lastMovement.closingStock;
  }, [stockMovements, item]);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
      <div className="w-full max-w-5xl mb-4 flex justify-between items-center">
        <Button variant="outline" size="icon" asChild>
          <Link href="/sales" aria-label="Back to Sales Page">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl sm:text-2xl font-semibold text-center truncate px-2">
          Stock Register: {decodeURIComponent(itemName)}
        </h1>
        <div style={{ width: '36px' }}></div> {/* Spacer */}
      </div>

      <Card className="w-full max-w-5xl">
        <CardHeader>
          <CardTitle>Item Movement History</CardTitle>
          <CardDescription>
            A chronological record of all sales and purchases for this item.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Generating stock ledger...</p>
            </div>
          ) : error ? (
            <p className="text-center text-destructive">{error}</p>
          ) : stockMovements.length <= 1 ? (
            <p className="text-center text-muted-foreground">No purchase or sale history found for this item.</p>
          ) : (
            <Table>
              <TableCaption>Stock movement history for {decodeURIComponent(itemName)}.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Transaction Type</TableHead>
                  <TableHead className="text-right">Purchase Qty / Price</TableHead>
                  <TableHead className="text-right">Sale Qty / Price</TableHead>
                  <TableHead className="text-right">Closing Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockMovements.map((move, index) => (
                  <TableRow key={`${move.referenceId}-${index}`}>
                    <TableCell className="text-xs">{formatDisplayDate(move.date)}</TableCell>
                    <TableCell>
                      <Badge variant={
                          move.type === 'Opening Stock' ? 'secondary' :
                          move.type === 'Purchase' ? 'default' : 'outline'
                      }>
                        {move.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {move.purchaseQty ? (
                        <span>
                          {move.purchaseQty} @ {currencySymbol}{move.purchaseAmount?.toFixed(2)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                       {move.saleQty ? (
                        <span>
                          {move.saleQty} @ {currencySymbol}{move.saleAmount?.toFixed(2)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{move.closingStock}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {item && !loading && (
            <CardFooter className="flex justify-end pt-4 border-t">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Final Closing Stock:</span>
                    <Badge variant="secondary" className="text-base font-semibold">
                        {finalStock}
                    </Badge>
                </div>
            </CardFooter>
        )}
      </Card>
      <Toaster />
    </div>
  );
}


export default function StockRegisterPage() {
    return (
      <Suspense fallback={
          <div className="flex h-screen items-center justify-center">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }>
        <StockRegisterContent />
      </Suspense>
    )
  }
