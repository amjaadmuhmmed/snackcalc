
// src/app/orders/[orderNumber]/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; 
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus, Search, User as UserIcon, Phone, ArrowLeft, CopyIcon, Hash, FileText } from "lucide-react"; 
import { QRCodeCanvas } from 'qrcode.react';

import { getItems as getSnacks } from "@/app/actions"; // Renamed getSnacks to getItems
import type { Snack } from "@/lib/db"; // Internal type remains Snack
import {
  SharedOrderData,
  SharedOrderItem,
  subscribeToSharedOrder,
  setSharedOrderInRTDB,
  SharedOrderDataSnapshot,
} from "@/lib/rt_db";

interface SelectedItemForOrder extends SharedOrderItem {} 

const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';

export default function SharedOrderPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const orderNumber = typeof params.orderNumber === 'string' ? params.orderNumber : '';

  const [allItems, setAllItems] = useState<Snack[]>([]); 
  const [selectedItems, setSelectedItems] = useState<SelectedItemForOrder[]>([]); 
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [serviceChargeInput, setServiceChargeInput] = useState<string>("0");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhoneNumber, setCustomerPhoneNumber] = useState<string>("");
  const [tableNumber, setTableNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>(""); 
  const [isLoadingItems, setIsLoadingItems] = useState(true); 
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdatingRTDB, setIsUpdatingRTDB] = useState(false);
  const [isUpdatingFromRTDBSync, setIsUpdatingFromRTDBSync] = useState(false);
  const [isLocalDirty, setIsLocalDirty] = useState(false);


  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const isInitialDataLoaded = useRef(false);

  const listRefs = useRef<Record<string, HTMLLIElement | null>>({}); 
  const lastInteractedItemIdRef = useRef<string | null>(null); 


  const loadAllItems = useCallback(async () => { 
    setIsLoadingItems(true); 
    try {
      const itemsFromDb = await getSnacks(); 
      setAllItems(itemsFromDb || []); 
    } catch (error: any) {
      console.error("Failed to load all items:", error); 
      // toast({ variant: "destructive", title: "Failed to load item list." }); 
    } finally {
      setIsLoadingItems(false); 
    }
  }, [toast]);

  useEffect(() => {
    loadAllItems(); 
  }, [loadAllItems]); 

  useEffect(() => {
    if (!orderNumber) return;
    
    if (isLocalDirty) {
        console.log(`SharedOrderPage: Local state is dirty for ${orderNumber}, skipping RTDB sync for now.`);
        return;
    }

    setIsLoadingOrder(true);
    isInitialDataLoaded.current = false; 

    console.log(`SharedOrderPage subscribing to RTDB for order: ${orderNumber}`);
    const unsubscribe = subscribeToSharedOrder(orderNumber, (data) => {
      if (data) {
        if (isLocalDirty) {
            console.log(`SharedOrderPage: Received RTDB update for ${orderNumber}, but local is dirty. Ignoring.`);
            return;
        }
        console.log(`SharedOrderPage received RTDB update for ${orderNumber}:`, data);
        setIsUpdatingFromRTDBSync(true);

        const newSelectedItemsData = Array.isArray(data.items) ? [...data.items] : []; 
        const currentSimpleSelected = selectedItems.map(s => ({id: s.id, quantity: s.quantity, price: s.price, name: s.name})); 
        const newSimpleSelected = newSelectedItemsData.map(s => ({id: s.id, quantity: s.quantity, price: s.price, name: s.name})); 


        if (JSON.stringify(currentSimpleSelected) !== JSON.stringify(newSimpleSelected)) {
            setSelectedItems(newSelectedItemsData); 
        }
        
        const newServiceCharge = Number(data.serviceCharge) || 0;
        if (newServiceCharge !== serviceCharge) {
            setServiceCharge(newServiceCharge);
        }

        if (String(data.customerName || "") !== customerName) {
            setCustomerName(String(data.customerName) || "");
        }
        if (String(data.customerPhoneNumber || "") !== customerPhoneNumber) {
            setCustomerPhoneNumber(String(data.customerPhoneNumber) || "");
        }
        if (String(data.tableNumber || "") !== tableNumber) {
            setTableNumber(String(data.tableNumber || ""));
        }
        if (String(data.notes || "") !== notes) { 
            setNotes(String(data.notes || ""));
        }
        
        if (!isInitialDataLoaded.current) {
             isInitialDataLoaded.current = true;
        }
         requestAnimationFrame(() => {
            setIsUpdatingFromRTDBSync(false);
        });
      } else {
        // toast({ variant: "destructive", title: "Order Not Found", description: `Could not load order ${orderNumber}. It might not exist or there was an error.` });
      }
      setIsLoadingOrder(false);
    });

    return () => {
        console.log(`SharedOrderPage unsubscribing from RTDB for order: ${orderNumber}`);
        unsubscribe()
    };
  }, [orderNumber, toast, isLocalDirty, customerName, customerPhoneNumber, tableNumber, notes, selectedItems, serviceCharge]); 

  const updateSharedOrder = useCallback(async () => {
    if (!orderNumber || isUpdatingRTDB || !isLocalDirty) { 
        return;
    }
    console.log(`SharedOrderPage pushing update to RTDB for ${orderNumber} (local is dirty)`);
    setIsUpdatingRTDB(true);

    const currentOrderData: Omit<SharedOrderData, 'lastUpdatedAt' | 'orderNumber'> = {
      items: selectedItems, 
      serviceCharge: serviceCharge,
      customerName: customerName,
      customerPhoneNumber: customerPhoneNumber,
      tableNumber: tableNumber,
      notes: notes, 
    };

    try {
      await setSharedOrderInRTDB(orderNumber, currentOrderData);
      setIsLocalDirty(false); 
    } catch (error) {
      console.error("Failed to update RTDB:", error);
      // toast({ variant: "destructive", title: "Sync Error", description: "Failed to save changes." });
    } finally {
        setIsUpdatingRTDB(false);
    }
  }, [orderNumber, selectedItems, serviceCharge, customerName, customerPhoneNumber, tableNumber, notes, toast, isUpdatingRTDB, isLocalDirty]); 

  useEffect(() => {
    if (isLoadingOrder || !isInitialDataLoaded.current || isUpdatingFromRTDBSync || isUpdatingRTDB || !isLocalDirty) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    const timer = setTimeout(() => {
      if (!isUpdatingFromRTDBSync && isLocalDirty) { 
          updateSharedOrder();
      }
    }, 750);
    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [selectedItems, serviceCharge, customerName, customerPhoneNumber, tableNumber, notes, isLoadingOrder, updateSharedOrder, isUpdatingFromRTDBSync, isUpdatingRTDB, isLocalDirty]); 
  
   useEffect(() => {
    if (document.activeElement?.id !== 'shared-service-charge') {
      setServiceChargeInput(serviceCharge.toFixed(2));
    }
  }, [serviceCharge]);

  useEffect(() => {
    if (lastInteractedItemIdRef.current && listRefs.current[lastInteractedItemIdRef.current]) {
      listRefs.current[lastInteractedItemIdRef.current]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedItems]); 


  const calculateTotal = () => {
    const itemsTotal = selectedItems.reduce((total, item) => total + Number(item.price) * item.quantity, 0); 
    return itemsTotal + serviceCharge;
  };

  const handleItemIncrement = (item: Snack) => { 
    setIsLocalDirty(true);
    lastInteractedItemIdRef.current = item.id;
    setSelectedItems((prevSelected) => { 
      const existingItemIndex = prevSelected.findIndex((s) => s.id === item.id); 
      if (existingItemIndex > -1) {
        const updatedItem = { ...prevSelected[existingItemIndex], quantity: prevSelected[existingItemIndex].quantity + 1 }; 
        const newSelected = [...prevSelected];
        newSelected.splice(existingItemIndex, 1);
        return [updatedItem, ...newSelected];
      } else {
        const newItemData: SelectedItemForOrder = { 
            id: item.id,
            name: item.name,
            price: Number(item.price),
            quantity: 1,
            itemCode: item.itemCode || '',
        };
        return [newItemData, ...prevSelected];
      }
    });
    setSearchTerm("");
  };

  const handleItemDecrement = (itemId: string) => { 
    setIsLocalDirty(true);
    lastInteractedItemIdRef.current = itemId;
    setSelectedItems((prevSelected) => { 
      const itemToDecrementIndex = prevSelected.findIndex((s) => s.id === itemId);
      if (itemToDecrementIndex === -1) return prevSelected;

      const itemToDecrement = prevSelected[itemToDecrementIndex];

      if (itemToDecrement.quantity === 1) {
        const newSelected = [...prevSelected];
        newSelected.splice(itemToDecrementIndex, 1);
        return newSelected;
      } else {
        const updatedItem = { ...itemToDecrement, quantity: itemToDecrement.quantity - 1 }; 
        const newSelected = [...prevSelected];
        newSelected.splice(itemToDecrementIndex, 1);
        return [updatedItem, ...newSelected];
      }
    });
  };

  const getItemQuantity = (itemId: string) => { 
    const selected = selectedItems.find((s) => s.id === itemId); 
    return selected ? selected.quantity : 0;
  };

  const handleServiceChargeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLocalDirty(true);
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

  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLocalDirty(true);
    setCustomerName(e.target.value);
  };

  const handleCustomerPhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLocalDirty(true);
    setCustomerPhoneNumber(e.target.value);
  };

  const handleTableNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLocalDirty(true);
    setTableNumber(e.target.value);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => { 
    setIsLocalDirty(true);
    setNotes(e.target.value);
  };


  const filteredAllItems = useMemo(() => { 
    if (!searchTerm) {
      return allItems; 
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allItems.filter(item => 
      item.name.toLowerCase().includes(lowerSearchTerm) ||
      (item.itemCode && item.itemCode.toLowerCase().includes(lowerSearchTerm))
    );
  }, [allItems, searchTerm]); 

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredAllItems.length === 1) { 
        handleItemIncrement(filteredAllItems[0]); 
      } else if (filteredAllItems.length === 0 && searchTerm) { 
        toast({ title: "No items found", description: `No available items match "${searchTerm}".` }); 
      } else if (filteredAllItems.length > 1) { 
        toast({ title: "Multiple matches", description: "Please refine your search or select from the list." });
      }
    }
  };

  const total = calculateTotal();
  const upiId = process.env.NEXT_PUBLIC_UPI_ID || "your-default-upi-id@paytm";
  const upiLink = `upi://pay?pa=${upiId}&pn=SnackulatorShared&am=${total.toFixed(2)}&cu=INR&tn=Order%20${orderNumber}`;
  const shareablePageLink = typeof window !== "undefined" ? window.location.href : "";


  if (isLoadingOrder && isLoadingItems) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4 md:p-8">
        <p className="text-lg text-muted-foreground">Loading shared order and items...</p> 
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
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-all-items" 
              type="search"
              placeholder="Search items by name or code..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-8 w-full h-9"
              aria-label="Search available items" 
            />
          </div>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 rounded-md border bg-muted/20">
            {isLoadingItems ? <p className="text-sm text-muted-foreground w-full text-center py-2">Loading item list...</p> : 
             filteredAllItems.map((item) => ( 
              <div key={item.id} className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-3 py-1 h-auto text-xs"
                  onClick={() => handleItemIncrement(item)} 
                >
                  {item.name} ({currencySymbol}{Number(item.price).toFixed(2)})
                </Button>
                {getItemQuantity(item.id) > 0 && ( 
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                    {getItemQuantity(item.id)} 
                  </Badge>
                )}
              </div>
            ))}
            {!isLoadingItems && filteredAllItems.length === 0 && <p className="text-sm text-muted-foreground w-full text-center py-2">No items match search.</p>} 
          </div>
          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-2">Items in this Order</h3>
            {selectedItems.length === 0 ? ( 
              <p className="text-sm text-muted-foreground">No items added to this order yet.</p> 
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {selectedItems.map((item) => ( 
                  <li 
                    key={item.id} 
                    ref={(el) => listRefs.current[item.id] = el} 
                    className="flex items-center justify-between text-sm p-1.5 rounded-md hover:bg-muted/50"
                  >
                    <div className="flex items-center space-x-2">
                      <span>{item.name}</span>
                      <div className="flex items-center border rounded-md">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleItemDecrement(item.id)} aria-label={`Decrease ${item.name}`}> 
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Badge variant="outline" className="text-xs px-1.5 border-none tabular-nums">{item.quantity}</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                            const originalItem = allItems.find(s => s.id === item.id); 
                            if (originalItem) handleItemIncrement(originalItem); 
                        }} aria-label={`Increase ${item.name}`}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <span className="font-medium tabular-nums">{currencySymbol}{(Number(item.price) * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="shared-customer-name" className="text-sm">Customer Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="shared-customer-name" type="text" placeholder="Optional" value={customerName} onChange={handleCustomerNameChange} className="pl-8 h-9 text-sm" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="shared-customer-phone" className="text-sm">Customer Phone</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="shared-customer-phone" type="tel" placeholder="Optional" value={customerPhoneNumber} onChange={handleCustomerPhoneNumberChange} className="pl-8 h-9 text-sm" />
              </div>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="shared-service-charge" className="text-sm">Service Charge ({currencySymbol})</Label>
            <Input id="shared-service-charge" type="text" placeholder="0.00" value={serviceChargeInput} onChange={handleServiceChargeInputChange} onBlur={handleServiceChargeInputBlur} onFocus={handleServiceChargeInputFocus} className="h-9 text-sm" inputMode="decimal" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="shared-table-number" className="text-sm">Table Number</Label>
             <div className="relative">
                <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="shared-table-number" type="text" placeholder="Optional" value={tableNumber} onChange={handleTableNumberChange} className="pl-8 h-9 text-sm" />
              </div>
          </div>
           <div className="grid gap-1.5">
            <Label htmlFor="shared-notes" className="text-sm">Notes</Label>
            <div className="relative">
              <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Textarea
                id="shared-notes"
                placeholder="Optional: e.g., less spicy..."
                value={notes}
                onChange={handleNotesChange}
                className="pl-8 text-sm min-h-[60px]"
                aria-label="Notes"
              />
            </div>
          </div>
          <Separator />

          <div className="flex flex-col items-center justify-between gap-3">
            <div className="flex justify-between w-full items-center">
              <span className="text-base font-semibold">Total:</span>
              <Badge variant="secondary" className="text-base font-semibold tabular-nums">{currencySymbol}{total.toFixed(2)}</Badge>
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

