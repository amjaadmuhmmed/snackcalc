
// src/app/bills/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { getBills } from "../actions"; // Import the server action
import type { Bill, BillItem as DbBillItem } from "@/lib/db"; // Import the Bill type
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Printer, Calendar as CalendarIcon, XCircle, BarChart3 } from "lucide-react";
import { format, isValid, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { setSharedOrderInRTDB, SharedOrderItem } from "@/lib/rt_db";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';

// Helper to convert Firestore Timestamp to JS Date
const convertFirestoreTimestampToDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  try {
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    } else if (typeof timestamp === 'object' && timestamp !== null && typeof timestamp.seconds === 'number') {
      // Handling Firestore Timestamp-like objects (e.g., from RTDB or serialized)
      return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    } else if (typeof timestamp === 'number') {
      // Assuming it's a Unix timestamp in milliseconds
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

interface SummaryItem {
  name: string;
  itemCode?: string;
  totalQuantity: number;
  totalRevenue: number;
}

export default function BillsPage() {
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);

  useEffect(() => {
    const fetchBills = async () => {
      try {
        setLoading(true);
        const fetchedBills = await getBills();
        setAllBills(fetchedBills);
        setError(null);
      } catch (err: any) {
        console.error("Failed to fetch bills:", err);
        setError("Failed to load bills. Please try again later.");
        setAllBills([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!dateRange || !dateRange.from) {
      setFilteredBills(allBills);
      return;
    }

    const fromDate = startOfDay(dateRange.from);
    const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

    const newFilteredBills = allBills.filter((bill) => {
      const billCreationDate = convertFirestoreTimestampToDate(bill.createdAt);
      if (!billCreationDate || !isValid(billCreationDate)) {
        console.warn(`Bill ${bill.id} has invalid createdAt:`, bill.createdAt);
        return false;
      }
      return isWithinInterval(billCreationDate, {
        start: fromDate <= toDate ? fromDate : toDate,
        end: fromDate <= toDate ? toDate : fromDate
      });
    });
    setFilteredBills(newFilteredBills);

  }, [allBills, dateRange, loading]);


  const formatFirestoreTimestampForDisplay = (timestamp: any): string => {
    const date = convertFirestoreTimestampToDate(timestamp);
    if (date && isValid(date)) {
      return format(date, 'Pp');
    }
    return 'Invalid Date';
  };

  const handleEditBill = async (bill: Bill) => {
    try {
      const itemsToShare: SharedOrderItem[] = bill.items.map((item: DbBillItem) => ({
        id: item.itemId, // Use itemId from DbBillItem as id for SharedOrderItem
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        itemCode: item.itemCode || '', // Include itemCode
      }));

      await setSharedOrderInRTDB(bill.orderNumber, {
        items: itemsToShare,
        serviceCharge: bill.serviceCharge,
        customerName: bill.customerName || "",
        customerPhoneNumber: bill.customerPhoneNumber || "",
        tableNumber: bill.tableNumber || "",
        notes: bill.notes || "",
      });

      router.push(`/?editOrder=${bill.orderNumber}&editBillId=${bill.id}`);
    } catch (error: any) {
      console.error("Failed to stage bill for editing:", error);
      toast({
        variant: "destructive",
        title: "Editing Error",
        description: "Could not prepare bill for editing. " + error.message,
      });
    }
  };

  const handlePrintBill = (bill: Bill) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const rawHeaderTitle = process.env.NEXT_PUBLIC_RECEIPT_HEADER_TITLE || "Snackulator";
      const rawFooterMessage = process.env.NEXT_PUBLIC_RECEIPT_FOOTER_MESSAGE || "Thank you for your order!";

      const receiptHeaderTitle = rawHeaderTitle.replace(/\n/g, '<br>');
      const receiptFooterMessage = rawFooterMessage.replace(/\n/g, '<br>');

      const formattedDate = formatFirestoreTimestampForDisplay(bill.createdAt);
      let itemsHtml = '';
      let subtotal = 0;

      bill.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        itemsHtml += `
          <tr class="item">
            <td>${item.name} (x${item.quantity}) ${item.itemCode ? `[${item.itemCode}]` : ''}</td>
            <td class="text-right">${currencySymbol}${itemTotal.toFixed(2)}</td>
          </tr>
        `;
      });

      const receiptHtml = `
        <html>
          <head>
            <title>Receipt - ${bill.orderNumber}</title>
            <style>
              body { font-family: 'Courier New', Courier, monospace; font-size: 10pt; margin: 0; padding: 5mm; width: 280px; }
              .receipt-container { width: 100%; }
              .header { text-align: center; margin-bottom: 10px; }
              .header h2 { margin: 0; font-size: 14pt; line-height: 1.2; }
              .info p { margin: 2px 0; }
              .item-table { width: 100%; border-collapse: collapse; margin-top: 5px; margin-bottom: 5px; }
              .item-table th, .item-table td { text-align: left; padding: 1px 0; }
              .item-table .text-right { text-align: right; }
              .totals-table { width: 100%; margin-top: 5px; }
              .totals-table td { padding: 1px 0; }
              .totals-table .text-right { text-align: right; }
              .totals-table .strong { font-weight: bold; }
              .separator { border-top: 1px dashed #000; margin: 5px 0; }
              .notes { margin-top: 5px; font-size: 9pt; }
              .footer { text-align: center; margin-top: 10px; font-size: 9pt; line-height: 1.2; }
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <div class="header">
                <h2>${receiptHeaderTitle}</h2>
              </div>
              <div class="separator"></div>
              <div class="info">
                <p>Order #: ${bill.orderNumber}</p>
                <p>Date: ${formattedDate}</p>
                ${bill.tableNumber ? `<p>Table: ${bill.tableNumber}</p>` : ''}
                ${bill.customerName ? `<p>Customer: ${bill.customerName}</p>` : ''}
                ${bill.customerPhoneNumber ? `<p>Phone: ${bill.customerPhoneNumber}</p>` : ''}
              </div>
              <div class="separator"></div>
              <table class="item-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th class="text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              <div class="separator"></div>
              <table class="totals-table">
                <tbody>
                  <tr>
                    <td>Subtotal:</td>
                    <td class="text-right">${currencySymbol}${subtotal.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Service Charge:</td>
                    <td class="text-right">${currencySymbol}${bill.serviceCharge.toFixed(2)}</td>
                  </tr>
                  <tr class="strong">
                    <td>TOTAL:</td>
                    <td class="text-right">${currencySymbol}${bill.totalAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              ${bill.notes ? `<div class="separator"></div><div class="notes"><p><strong>Notes:</strong> ${bill.notes.replace(/\n/g, '<br>')}</p></div>` : ''}
              <div class="separator"></div>
              <div class="footer">
                <p>${receiptFooterMessage}</p>
              </div>
            </div>
          </body>
        </html>
      `;
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } else {
      toast({
        variant: "destructive",
        title: "Print Error",
        description: "Could not open print window. Please check your pop-up blocker settings.",
      });
    }
  };

  const dailySummaryData = useMemo(() => {
    if (!filteredBills || filteredBills.length === 0) {
      return [];
    }
    const summaryMap: Record<string, { totalQuantity: number; totalRevenue: number; itemCode?: string }> = {};

    filteredBills.forEach(bill => {
      (bill.items || []).forEach(item => {
        if (summaryMap[item.name]) {
          summaryMap[item.name].totalQuantity += item.quantity;
          summaryMap[item.name].totalRevenue += item.price * item.quantity;
          if (item.itemCode && (!summaryMap[item.name].itemCode || summaryMap[item.name].itemCode !== item.itemCode)) {
             summaryMap[item.name].itemCode = item.itemCode;
          }
        } else {
          summaryMap[item.name] = {
            totalQuantity: item.quantity,
            totalRevenue: item.price * item.quantity,
            itemCode: item.itemCode || undefined,
          };
        }
      });
    });

    return Object.entries(summaryMap).map(([name, data]) => ({
      name,
      itemCode: data.itemCode,
      totalQuantity: data.totalQuantity,
      totalRevenue: data.totalRevenue,
    })).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [filteredBills]);

  const handlePrintSummary = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const rawHeaderTitle = process.env.NEXT_PUBLIC_RECEIPT_HEADER_TITLE || "Snackulator";
      const receiptHeaderTitle = rawHeaderTitle.replace(/\n/g, '<br>');
      const dateRangeString = dateRange?.from && !dateRange.to ? `for ${format(dateRange.from, "LLL dd, yyyy")}` :
                              dateRange?.from && dateRange?.to && format(dateRange.from, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd") ? `for ${format(dateRange.from, "LLL dd, yyyy")}` :
                              dateRange?.from && dateRange?.to ? `from ${format(dateRange.from, "LLL dd, yyyy")} to ${format(dateRange.to, "LLL dd, yyyy")}` :
                              "for All Transactions";

      let itemsHtml = '';
      dailySummaryData.forEach(item => {
        itemsHtml += `
          <tr>
            <td>${item.name}</td>
            <td>${item.itemCode || '-'}</td>
            <td class="text-right">${item.totalQuantity}</td>
            <td class="text-right">${currencySymbol}${item.totalRevenue.toFixed(2)}</td>
          </tr>
        `;
      });

      const overallTotalRevenue = dailySummaryData.reduce((sum, item) => sum + item.totalRevenue, 0);

      const summaryReceiptHtml = `
        <html>
          <head>
            <title>Sales Summary - ${dateRangeString}</title>
            <style>
              body { font-family: 'Courier New', Courier, monospace; font-size: 10pt; margin: 0; padding: 5mm; width: 280px; }
              .receipt-container { width: 100%; }
              .header { text-align: center; margin-bottom: 10px; }
              .header h2 { margin: 0; font-size: 14pt; line-height: 1.2; }
              .info p { margin: 2px 0; font-size: 10pt; text-align: center;}
              .item-table { width: 100%; border-collapse: collapse; margin-top: 5px; margin-bottom: 5px; }
              .item-table th, .item-table td { text-align: left; padding: 2px 1px; border-bottom: 1px solid #eee; }
              .item-table .text-right { text-align: right; }
              .separator { border-top: 1px dashed #000; margin: 5px 0; }
              .footer-total { margin-top: 10px; text-align: right; font-weight: bold; font-size: 11pt;}
            </style>
          </head>
          <body>
            <div class="receipt-container">
              <div class="header">
                <h2>${receiptHeaderTitle}</h2>
              </div>
              <div class="info">
                <p>Sales Summary ${dateRangeString}</p>
              </div>
              <div class="separator"></div>
              <table class="item-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Code</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
              <div class="separator"></div>
              <div class="footer-total">
                <p>Total Revenue: ${currencySymbol}${overallTotalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </body>
        </html>
      `;
      printWindow.document.write(summaryReceiptHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } else {
      toast({
        variant: "destructive",
        title: "Print Error",
        description: "Could not open print window. Please check your pop-up blocker settings.",
      });
    }
  };


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
       <div className="w-full max-w-5xl mb-4 flex justify-between items-center">
             <Button variant="outline" size="icon" asChild>
                <Link href="/" aria-label="Back to Snackulator">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <h1 className="text-2xl font-semibold">Transaction History</h1>
            <div style={{ width: '36px' }}></div> {/* Spacer */}
        </div>

      <Card className="w-full max-w-5xl">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardDescription>
                    {dateRange?.from && !dateRange.to ? "Showing transactions for " + format(dateRange.from, "LLL dd, yyyy") :
                     dateRange?.from && dateRange?.to && format(dateRange.from, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd") ? "Showing transactions for " + format(dateRange.from, "LLL dd, yyyy") :
                     dateRange?.from && dateRange?.to ? "Showing transactions from " + format(dateRange.from, "LLL dd, yyyy") + " to " + format(dateRange.to, "LLL dd, yyyy") :
                     "Showing all transactions."}
                </CardDescription>
                <div className="flex flex-wrap gap-2 items-center">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="date"
                          variant={"outline"}
                          className={cn(
                            "w-full sm:w-[260px] justify-start text-left font-normal",
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
                        <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)} aria-label="Clear date filter">
                            <XCircle className="h-4 w-4" />
                        </Button>
                    )}
                    <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <BarChart3 className="mr-2 h-4 w-4" /> View Summary
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Daily Sales Summary</DialogTitle>
                          <DialogDescription>
                            Summary for {
                            dateRange?.from && !dateRange.to ? `transactions on ${format(dateRange.from, "LLL dd, yyyy")}` :
                            dateRange?.from && dateRange?.to && format(dateRange.from, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd") ? `transactions on ${format(dateRange.from, "LLL dd, yyyy")}` :
                            dateRange?.from && dateRange?.to ? `transactions from ${format(dateRange.from, "LLL dd, yyyy")} to ${format(dateRange.to, "LLL dd, yyyy")}` :
                            "all recorded transactions."}
                          </DialogDescription>
                        </DialogHeader>
                        {dailySummaryData.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">No items sold in this period.</p>
                        ) : (
                          <div className="max-h-[60vh] overflow-y-auto pr-2 mt-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item Name</TableHead>
                                  <TableHead>Item Code</TableHead>
                                  <TableHead className="text-right">Qty Sold</TableHead>
                                  <TableHead className="text-right">Total Revenue</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {dailySummaryData.map((item, index) => (
                                  <TableRow key={`${item.name}-${index}`}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.itemCode || '-'}</TableCell>
                                    <TableCell className="text-right">{item.totalQuantity}</TableCell>
                                    <TableCell className="text-right">{currencySymbol}{item.totalRevenue.toFixed(2)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        <DialogFooter className="sm:justify-start mt-4 gap-2">
                           {dailySummaryData.length > 0 && (
                             <Button variant="outline" onClick={handlePrintSummary}>
                               <Printer className="mr-2 h-4 w-4" /> Print Summary
                             </Button>
                           )}
                          <DialogClose asChild>
                            <Button type="button" variant="secondary">
                              Close
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                </div>
            </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Loading bills...</p>
          ) : error ? (
            <p className="text-center text-destructive">{error}</p>
          ) : filteredBills.length === 0 ? (
             <p className="text-center text-muted-foreground">
                {allBills.length === 0 ? "No bills recorded yet." : "No bills found for the selected period."}
            </p>
          ) : (
            <Table>
               <TableCaption>A list of your recent transactions. Click Edit to modify a bill or Print to get a receipt.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Table #</TableHead>
                  <TableHead className="min-w-[200px] sm:min-w-[250px] md:min-w-[300px]">Items</TableHead>
                  <TableHead className="text-right">Service Ch.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.orderNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatFirestoreTimestampForDisplay(bill.createdAt)}</TableCell>
                    <TableCell>
                        {bill.customerName || '-'} <br />
                        <span className="text-xs text-muted-foreground">{bill.customerPhoneNumber || '-'}</span>
                    </TableCell>
                    <TableCell>{bill.tableNumber || '-'}</TableCell>
                    <TableCell className="min-w-[200px] sm:min-w-[250px] md:min-w-[300px]">
                      <ul className="list-disc list-inside text-sm">
                        {(bill.items || []).map((item, index) => (
                          <li key={index}>
                            {item.name} (x{item.quantity}) - {currencySymbol}{item.price.toFixed(2)} {item.itemCode ? `[${item.itemCode}]`: ''}
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell className="text-right">{currencySymbol}{bill.serviceCharge.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{currencySymbol}{bill.totalAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button variant="outline" size="sm" onClick={() => handleEditBill(bill)} aria-label="Edit Bill">
                        <Edit className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handlePrintBill(bill)} aria-label="Print Bill">
                        <Printer className="h-3 w-3 mr-1" /> Print
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs whitespace-pre-wrap max-w-xs">{bill.notes || '-'}</TableCell>
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
