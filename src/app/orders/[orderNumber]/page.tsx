// src/app/orders/[orderNumber]/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus, Search, User as UserIcon, Phone, ArrowLeft, CopyIcon } from "lucide-react";
import { QRCodeCanvas } from 'qrcode.react';
import type { Unsubscribe } from 'firebase/database';

import { getSnacks } from "@/app/actions"; // Server action to get all available snacks
import type { Snack } from "@/lib/db";
import {
  SharedOrderData,
  SharedOrderItem,
  subscribeToSharedOrder,
  setSharedOrderInRTDB,
  SharedOrderDataSnapshot,
} from "@/lib/rt_db";

interface SelectedSnackForOrder extends SharedOrderItem {} // Reuse SharedOrderItem

export default function SharedOrderPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const orderNumber = typeof params.orderNumber === 'string' ? params.orderNumber : '';

  const [allSnacks, setAllSnacks] = useState<Snack[]>([]); // All available snacks from Firestore
  const [selectedSnacks, setSelectedSnacks] = useState<SelectedSnackForOrder[]>([]);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [serviceChargeInput, setServiceChargeInput] = useState<string>("0");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhoneNumber, setCustomerPhoneNumber] = useState<string>("");
  const [isLoadingSnacks, setIsLoadingSnacks] = useState(true);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isUpdatingRTDB, setIsUpdatingRTDB] = useState(false);

  // Debounce timer for RTDB updates
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);


  const loadAllSnacks = useCallback(async () => {
    setIsLoadingSnacks(true);
    try {
      const snacksFromDb = await getSnacks();
      setAllSnacks(snacksFromDb || []);
    } catch (error: any) {
      console.error("Failed to load all snacks:", error);
      toast({ variant: "destructive", title: "Failed to load snack list." });
    } finally {
      setIsLoadingSnacks(false);
    }
  }, [toast]);

  // Effect to load all available snacks once
  useEffect(() => {
    loadAllSnacks();
  }, [loadAllSnacks]);

  // Effect to subscribe to the shared order in RTDB
  useEffect(() => {
    if (!orderNumber) return;

    setIsLoadingOrder(true);
    const unsubscribe = subscribeToSharedOrder(orderNumber, (data) => {
      if (data) {
        // Ensure new array references and correct types for state updates
        setSelectedSnacks(Array.isArray(data.items) ? [...data.items] : []);
        const newServiceCharge = Number(data.serviceCharge) || 0;
        setServiceCharge(newServiceCharge);
        setServiceChargeInput(newServiceCharge.toString());
        setCustomerName(String(data.customerName) || "");
        setCustomerPhoneNumber(String(data.customerPhoneNumber) || "");
        setLastUpdated(Number(data.lastUpdatedAt) || Date.now());
        
        // Only show toast if not the initial load or if data significantly changed
        // This avoids toast on initial page load if data hasn't changed since last view.
        if (!isLoadingOrder) {
             toast({ title: "Order Synced", description: `Order ${orderNumber} updated.` });
        }
      } else {
        toast({ variant: "destructive", title: "Order Not Found", description: `Could not load order ${orderNumber}. It might not exist or there was an error.` });
        // Consider redirecting or showing a "not found" message
      }
      setIsLoadingOrder(false);
    });

    return () => unsubscribe(); // Cleanup subscription on component unmount
  }, [orderNumber, toast, isLoadingOrder]); // Added isLoadingOrder to dependency array to manage initial toast

  // Function to push local changes to RTDB
  const updateSharedOrder = useCallback(async () => {
    if (!orderNumber || isUpdatingRTDB) return;
    setIsUpdatingRTDB(true);

    const currentOrderData: Omit<SharedOrderData, 'lastUpdatedAt' | 'orderNumber'> = {
      items: selectedSnacks,
      serviceCharge: serviceCharge,
      customerName: customerName,
      customerPhoneNumber: customerPhoneNumber,
    };

    try {
      await setSharedOrderInRTDB(orderNumber, currentOrderData);
      // toast({ title: "Order Updated in Real-time", description: "Changes saved." });
    } catch (error) {
      console.error("Failed to update RTDB:", error);
      toast({ variant: "destructive", title: "Sync Error", description: "Failed to save changes." });
    } finally {
        setIsUpdatingRTDB(false);
    }
  }, [orderNumber, selectedSnacks, serviceCharge, customerName, customerPhoneNumber, toast, isUpdatingRTDB]);

  // Debounced RTDB update
  useEffect(() => {
    if (isLoadingOrder) return; // Don't update while initial load is happening

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const timer = setTimeout(() => {
      updateSharedOrder();
    }, 750); // Adjust debounce delay as needed (e.g., 500ms, 1s)
    setDebounceTimer(timer);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSnacks, serviceCharge, customerName, customerPhoneNumber, isLoadingOrder]); // Added isLoadingOrder


  const calculateTotal = () => {
    const snacksTotal = selectedSnacks.reduce((total, snack) => total + Number(snack.price) * snack.quantity, 0);
    return snacksTotal + serviceCharge;
  };

  const handleSnackIncrement = (snack: Snack) => { // Takes a base Snack object
    setSelectedSnacks((prevSelected) => {
      const alreadySelected = prevSelected.find((s) => s.id === snack.id);
      if (alreadySelected) {
        return prevSelected.map((s) =>
          s.id === snack.id ? { ...s, quantity: s.quantity + 1 } : s
        );
      } else {
        // Add as new SharedOrderItem
        return [...prevSelected, { id: snack.id, name: snack.name, price: Number(snack.price), quantity: 1 }];
      }
    });
    setSearchTerm("");
  };

  const handleSnackDecrement = (snackId: string) => {
    setSelectedSnacks((prevSelected) => {
      const itemToDecrement = prevSelected.find((s) => s.id === snackId);
      if (!itemToDecrement) return prevSelected;

      if (itemToDecrement.quantity === 1) {
        return prevSelected.filter((s) => s.id !== snackId);
      } else {
        return prevSelected.map((s) =>
          s.id === snackId ? { ...s, quantity: s.quantity - 1 } : s
        );
      }
    });
  };

  const getSnackQuantity = (snackId: string) => {
    const selected = selectedSnacks.find((s) => s.id === snackId);
    return selected ? selected.quantity : 0;
  };

  const handleServiceChargeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setServiceChargeInput(value);
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      const parsedValue = parseFloat(value);
      setServiceCharge(isNaN(parsedValue) || parsedValue < 0 ? 0 : parsedValue);
    } else {
      setServiceCharge(0);
    }
  };

   const handleServiceChargeInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const parsedValue = parseFloat(value);
      if (value === "" || isNaN(parsedValue) || parsedValue < 0) {
          setServiceCharge(0);
          setServiceChargeInput("0.00");
      } else {
          setServiceCharge(parsedValue);
          setServiceChargeInput(parsedValue.toFixed(2));
      }
  };

  const handleServiceChargeInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (parseFloat(e.target.value) === 0) {
          setServiceChargeInput("");
      }
  };

  const filteredAllSnacks = useMemo(() => {
    if (!searchTerm) {
      return allSnacks;
    }
    return allSnacks.filter(snack =>
      snack.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allSnacks, searchTerm]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredAllSnacks.length === 1) {
        handleSnackIncrement(filteredAllSnacks[0]);
      } else if (filteredAllSnacks.length === 0 && searchTerm) {
        toast({ title: "No snacks found", description: `No available snacks match "${searchTerm}".` });
      } else if (filteredAllSnacks.length > 1) {
        toast({ title: "Multiple matches", description: "Please refine your search or select from the list." });
      }
    }
  };

  const total = calculateTotal();
  const upiId = process.env.NEXT_PUBLIC_UPI_ID || "your-default-upi-id@paytm";
  const upiLink = `upi://pay?pa=${upiId}&pn=SnackCalcShared&am=${total.toFixed(2)}&cu=INR&tn=Order%20${orderNumber}`;
  const shareablePageLink = typeof window !== "undefined" ? window.location.href : "";


  if (isLoadingOrder && isLoadingSnacks) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4 md:p-8">
        <p className="text-lg text-muted-foreground">Loading shared order and snacks...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
      <div className="w-full max-w-md mb-4 flex justify-between items-center">
        <Button variant="outline" size="icon" asChild>
            <Link href="/" aria-label="Back to Main Page">
                <ArrowLeft className="h-4 w-4" />
            </Link>
        </Button>
        <CardTitle className="text-lg text-center">Shared Order</CardTitle>
        <Badge variant="outline" className="text-sm whitespace-nowrap">
          Order: {orderNumber}
        </Badge>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardDescription className="text-center">
            Editing bill <strong className="text-primary">{orderNumber}</strong> in real-time.
            {lastUpdated && <p className="text-xs text-muted-foreground mt-1">Last synced: {new Date(lastUpdated).toLocaleTimeString()}</p>}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {/* Search and Snack Selection from allSnacks */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-all-snacks"
              type="search"
              placeholder="Search available snacks to add..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-8 w-full h-9"
              aria-label="Search available snacks"
            />
          </div>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 rounded-md border bg-muted/20">
            {isLoadingSnacks ? <p className="text-sm text-muted-foreground w-full text-center py-2">Loading snack list...</p> :
             filteredAllSnacks.map((snack) => (
              <div key={snack.id} className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-3 py-1 h-auto text-xs"
                  onClick={() => handleSnackIncrement(snack)}
                >
                  {snack.name} (₹{Number(snack.price).toFixed(2)})
                </Button>
                {getSnackQuantity(snack.id) > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                    {getSnackQuantity(snack.id)}
                  </Badge>
                )}
              </div>
            ))}
            {!isLoadingSnacks && filteredAllSnacks.length === 0 && <p className="text-sm text-muted-foreground w-full text-center py-2">No snacks match search.</p>}
          </div>
          <Separator />

          {/* Display Selected Snacks */}
          <div>
            <h3 className="text-sm font-medium mb-2">Items in this Order</h3>
            {selectedSnacks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No snacks added to this order yet.</p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {selectedSnacks.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm p-1.5 rounded-md hover:bg-muted/50">
                    <div className="flex items-center space-x-2">
                      <span>{item.name}</span>
                      <div className="flex items-center border rounded-md">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSnackDecrement(item.id)} aria-label={`Decrease ${item.name}`}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Badge variant="outline" className="text-xs px-1.5 border-none tabular-nums">{item.quantity}</Badge>
                        {/* Find original snack to increment. This assumes allSnacks is loaded. */}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            const originalSnack = allSnacks.find(s => s.id === item.id);
                            if (originalSnack) handleSnackIncrement(originalSnack);
                        }} aria-label={`Increase ${item.name}`}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <span className="font-medium tabular-nums">₹{(Number(item.price) * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Separator />

          {/* Customer Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="shared-customer-name" className="text-sm">Customer Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="shared-customer-name" type="text" placeholder="Optional" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="shared-customer-phone" className="text-sm">Customer Phone</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="shared-customer-phone" type="tel" placeholder="Optional" value={customerPhoneNumber} onChange={(e) => setCustomerPhoneNumber(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
            </div>
          </div>

          {/* Service Charge */}
          <div className="grid gap-1.5">
            <Label htmlFor="shared-service-charge" className="text-sm">Service Charge (₹)</Label>
            <Input id="shared-service-charge" type="text" placeholder="0.00" value={serviceChargeInput} onChange={handleServiceChargeInputChange} onBlur={handleServiceChargeInputBlur} onFocus={handleServiceChargeInputFocus} className="h-9 text-sm" inputMode="decimal" />
          </div>
          <Separator />

          {/* Total and QR Code */}
          <div className="flex flex-col items-center justify-between gap-3">
            <div className="flex justify-between w-full items-center">
              <span className="text-base font-semibold">Total:</span>
              <Badge variant="secondary" className="text-base font-semibold tabular-nums">₹{total.toFixed(2)}</Badge>
            </div>
            {total > 0 && (
              <div className="flex flex-col items-center gap-3 w-full">
                <QRCodeCanvas value={upiLink} size={128} level="H" data-ai-hint="payment qr" />
                 <Button onClick={() => {
                    if (shareablePageLink) {
                        navigator.clipboard.writeText(shareablePageLink);
                        toast({ title: "Page Link Copied!", description: "You can share this page's link." });
                    }
                 }} variant="outline" className="w-full">
                    <CopyIcon className="mr-2 h-4 w-4" /> Copy Page Link
                 </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}

