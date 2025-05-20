
// src/app/bills/page.tsx
"use client";

import { useState, useEffect } from "react";
import { getBills } from "../actions"; // Import the server action
import type { Bill, BillItem as DbBillItem } from "@/lib/db"; // Import the Bill type
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Printer } from "lucide-react"; // Added Printer icon
import { format, isValid } from 'date-fns'; // For formatting dates
import { useToast } from "@/hooks/use-toast";
import { setSharedOrderInRTDB, SharedOrderItem } from "@/lib/rt_db";

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const fetchBills = async () => {
      try {
        setLoading(true);
        const fetchedBills = await getBills(); // Call the server action
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
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (typeof timestamp === 'object' && timestamp !== null && typeof timestamp.seconds === 'number') {
        date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
      } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      }

      if (date instanceof Date && isValid(date)) {
        return format(date, 'Pp');
      } else {
        console.warn('Invalid or unsupported timestamp format:', typeof timestamp, timestamp);
        return 'Invalid Date';
      }
    } catch (e) {
      console.error("Error formatting timestamp:", e, "Timestamp value:", timestamp);
      return 'Error Formatting Date';
    }
  };

  const handleEditBill = async (bill: Bill) => {
    try {
      const itemsToShare: SharedOrderItem[] = bill.items.map((item: DbBillItem) => ({
        id: item.name, 
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
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
      
      // Corrected regex: replace actual newline characters (\n) with <br>
      const receiptHeaderTitle = rawHeaderTitle.replace(/\n/g, '<br>');
      const receiptFooterMessage = rawFooterMessage.replace(/\n/g, '<br>');

      const formattedDate = formatFirestoreTimestamp(bill.createdAt);
      let itemsHtml = '';
      let subtotal = 0;

      bill.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        itemsHtml += `
          <tr class="item">
            <td>${item.name} (x${item.quantity})</td>
            <td class="text-right">₹${itemTotal.toFixed(2)}</td>
          </tr>
        `;
      });

      const receiptHtml = `
        <html>
          <head>
            <title>Receipt - ${bill.orderNumber}</title>
            <style>
              body { font-family: 'Courier New', Courier, monospace; font-size: 10pt; margin: 0; padding: 5mm; width: 280px; /* Approx 58mm paper width */ }
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
                    <td class="text-right">₹${subtotal.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Service Charge:</td>
                    <td class="text-right">₹${bill.serviceCharge.toFixed(2)}</td>
                  </tr>
                  <tr class="strong">
                    <td>TOTAL:</td>
                    <td class="text-right">₹${bill.totalAmount.toFixed(2)}</td>
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
      // printWindow.close(); // May not work reliably due to browser restrictions
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
                {bills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-medium">{bill.orderNumber}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatFirestoreTimestamp(bill.createdAt)}</TableCell>
                    <TableCell>
                        {bill.customerName || '-'} <br />
                        <span className="text-xs text-muted-foreground">{bill.customerPhoneNumber || '-'}</span>
                    </TableCell>
                    <TableCell>{bill.tableNumber || '-'}</TableCell>
                    <TableCell className="min-w-[200px] sm:min-w-[250px] md:min-w-[300px]">
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
                    <TableCell className="text-center space-x-1">
                      <Button variant="outline" size="sm" onClick={() => handleEditBill(bill)} aria-label="Edit Bill">
                        <Edit className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handlePrintBill(bill)} aria-label="Print Bill">
                        <Printer className="h-3 w-3 mr-1" /> Print
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs whitespace-pre-wrap">{bill.notes || '-'}</TableCell>
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

