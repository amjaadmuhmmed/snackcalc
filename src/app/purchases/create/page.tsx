
// src/app/purchases/create/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker"; // Assuming you have or will create this
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Plus, Minus, Search, ArrowLeft, FileText, ShoppingBag, CalendarIcon as Calendar } from "lucide-react";
import { getItems, savePurchase } from "@/app/actions";
import type { Snack, PurchaseInput, PurchaseItem as DbPurchaseItem } from "@/lib/db"; // Snack is used as Item type
import { Timestamp } from "firebase/firestore";

interface SelectedItemForPurchase extends Snack {
  quantity: number;
  purchaseCost: number; // Cost for this specific purchase
}

const generatePurchaseOrderNumber = () => {
  return `PO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
};

export default function CreatePurchasePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [allItems, setAllItems] = useState<Snack[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItemForPurchase[]>([]);
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState<string>("");
  const [supplierName, setSupplierName] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState<string>("");
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const listRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const lastInteractedItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    setPurchaseOrderNumber(generatePurchaseOrderNumber());
    const loadAllItems = async () => {
      setIsLoadingItems(true);
      try {
        const itemsFromDb = await getItems();
        setAllItems(itemsFromDb || []);
      } catch (error: any) {
        console.error("Failed to load items:", error);
        toast({ variant: "destructive", title: "Failed to load item list." });
        setAllItems([]);
      } finally {
        setIsLoadingItems(false);
      }
    };
    loadAllItems();
  }, [toast]);

  useEffect(() => {
    if (lastInteractedItemIdRef.current && listRefs.current[lastInteractedItemIdRef.current]) {
      listRefs.current[lastInteractedItemIdRef.current]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedItems]);

  const calculateTotal = useMemo(() => {
    return selectedItems.reduce((total, item) => total + Number(item.purchaseCost) * item.quantity, 0);
  }, [selectedItems]);

  const handleItemIncrement = (item: Snack) => {
    lastInteractedItemIdRef.current = item.id;
    setSelectedItems((prevSelected) => {
      const existingItemIndex = prevSelected.findIndex((s) => s.id === item.id);
      if (existingItemIndex > -1) {
        const updatedItem = { ...prevSelected[existingItemIndex], quantity: prevSelected[existingItemIndex].quantity + 1 };
        const newSelected = [...prevSelected];
        newSelected.splice(existingItemIndex, 1);
        return [updatedItem, ...newSelected];
      } else {
        // Default purchaseCost to item's cost or 0 if not available
        const defaultPurchaseCost = item.cost !== undefined ? Number(item.cost) : 0;
        const newItemData: SelectedItemForPurchase = { ...item, quantity: 1, purchaseCost: defaultPurchaseCost };
        return [newItemData, ...prevSelected];
      }
    });
    setSearchTerm("");
  };

  const handleItemDecrement = (itemId: string) => {
    lastInteractedItemIdRef.current = itemId;
    setSelectedItems((prevSelected) => {
      const itemToDecrementIndex = prevSelected.findIndex((s) => s.id === itemId);
      if (itemToDecrementIndex === -1) return prevSelected;

      const itemToDecrement = prevSelected[itemToDecrementIndex];
      let newSelected = [...prevSelected];
      newSelected.splice(itemToDecrementIndex, 1);

      if (itemToDecrement.quantity === 1) {
        return newSelected;
      } else {
        const updatedItem = { ...itemToDecrement, quantity: itemToDecrement.quantity - 1 };
        return [updatedItem, ...newSelected];
      }
    });
  };

  const handlePurchaseCostChange = (itemId: string, cost: string) => {
    const parsedCost = parseFloat(cost);
    setSelectedItems((prevSelected) =>
      prevSelected.map((item) =>
        item.id === itemId ? { ...item, purchaseCost: isNaN(parsedCost) || parsedCost < 0 ? 0 : parsedCost } : item
      )
    );
  };

  const getItemQuantity = (itemId: string) => {
    const selected = selectedItems.find((s) => s.id === itemId);
    return selected ? selected.quantity : 0;
  };

  const handleSavePurchase = async () => {
    if (selectedItems.length === 0) {
      toast({ variant: "default", title: "Cannot save an empty purchase order." });
      return;
    }
    if (!purchaseDate) {
      toast({ variant: "destructive", title: "Purchase Date is required."});
      return;
    }
     if (!purchaseOrderNumber.trim()) {
      toast({ variant: "destructive", title: "Purchase Order Number is required." });
      return;
    }


    setIsSavingPurchase(true);

    const purchaseData: PurchaseInput = {
      purchaseOrderNumber: purchaseOrderNumber,
      supplierName: supplierName,
      purchaseDate: Timestamp.fromDate(purchaseDate), // Convert JS Date to Firestore Timestamp
      items: selectedItems.map(s => ({
        itemId: s.id,
        name: s.name,
        quantity: s.quantity,
        purchaseCost: Number(s.purchaseCost),
        itemCode: s.itemCode || ''
      })),
      totalAmount: calculateTotal,
      notes: notes,
    };

    try {
      const result = await savePurchase(purchaseData);
      if (result.success) {
        toast({ title: result.message });
        // Reset form
        setSelectedItems([]);
        setSupplierName("");
        setNotes("");
        setPurchaseOrderNumber(generatePurchaseOrderNumber());
        setPurchaseDate(new Date());
        // Optionally redirect or update item list on main page if it's also shown there
        router.push('/purchases/history'); 
      } else {
        toast({ variant: "destructive", title: "Failed to save purchase.", description: result.message });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error saving purchase.", description: error.message });
    } finally {
      setIsSavingPurchase(false);
    }
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
      }
    }
  };


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
      <div className="w-full max-w-2xl mb-4 flex justify-between items-center">
        <Button variant="outline" size="icon" asChild>
          <Link href="/" aria-label="Back to Main Page">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Create Purchase Order</h1>
        <div style={{ width: '36px' }}></div> {/* Spacer */}
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>New Purchase Entry</CardTitle>
          <CardDescription>Add items received from suppliers to update stock levels.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="purchase-order-number">P.O. Number</Label>
              <Input 
                id="purchase-order-number" 
                type="text" 
                value={purchaseOrderNumber} 
                onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                placeholder="e.g., PO-2024001" 
              />
            </div>
             <div className="grid gap-1.5">
              <Label htmlFor="purchase-date">Purchase Date</Label>
                <DatePicker date={purchaseDate} setDate={setPurchaseDate} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="supplier-name">Supplier Name (Optional)</Label>
              <Input 
                id="supplier-name" 
                type="text" 
                value={supplierName} 
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g., Main Supplier Co."
              />
            </div>
          </div>
          
          <Separator />

          <div>
            <Label htmlFor="search-purchase-items" className="mb-1.5 block">Search Items to Add</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-purchase-items"
                type="search"
                placeholder="Search items by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-8 w-full h-9"
              />
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 mt-2 rounded-md border bg-muted/20">
              {isLoadingItems ? <p className="text-sm text-muted-foreground w-full text-center py-2">Loading item list...</p> :
               filteredAllItems.map((item) => (
                <div key={item.id} className="flex items-center space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full px-3 py-1 h-auto text-xs"
                    onClick={() => handleItemIncrement(item)}
                  >
                    {item.name} (Stock: {item.stockQuantity})
                  </Button>
                  {getItemQuantity(item.id) > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                      Added: {getItemQuantity(item.id)}
                    </Badge>
                  )}
                </div>
              ))}
              {!isLoadingItems && filteredAllItems.length === 0 && <p className="text-sm text-muted-foreground w-full text-center py-2">No items match search.</p>}
            </div>
          </div>
          
          <Separator />

          <div>
            <h3 className="text-md font-medium mb-2">Items in this Purchase</h3>
            {selectedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items added to this purchase yet.</p>
            ) : (
              <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {selectedItems.map((item) => (
                  <li
                    key={item.id}
                    ref={(el) => listRefs.current[item.id] = el}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm p-2 rounded-md border hover:bg-muted/50 gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{item.name}</span>
                      {item.itemCode && <span className="text-xs text-muted-foreground block sm:inline sm:ml-1">[{item.itemCode}]</span>}
                    </div>
                    <div className="flex items-center space-x-2 w-full sm:w-auto mt-1 sm:mt-0">
                       <Label htmlFor={`purchase-cost-${item.id}`} className="text-xs sr-only">Cost</Label>
                       <Input 
                        id={`purchase-cost-${item.id}`}
                        type="number"
                        value={item.purchaseCost}
                        onChange={(e) => handlePurchaseCostChange(item.id, e.target.value)}
                        className="h-8 w-20 text-xs"
                        placeholder="Cost"
                        min="0"
                        step="0.01"
                      />
                      <div className="flex items-center border rounded-md">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleItemDecrement(item.id)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Badge variant="outline" className="text-xs px-2 py-1 border-none tabular-nums">{item.quantity}</Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleItemIncrement(item)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                       <span className="font-medium tabular-nums w-20 text-right">
                        ₹{(Number(item.purchaseCost) * item.quantity).toFixed(2)}
                       </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />
           <div className="grid gap-1.5">
            <Label htmlFor="purchase-notes">Notes (Optional)</Label>
            <div className="relative">
              <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Textarea
                id="purchase-notes"
                placeholder="e.g., Specific batch number, supplier remarks..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="pl-8 text-sm min-h-[60px]"
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col items-end gap-2">
            <div className="flex justify-between w-full sm:w-auto sm:min-w-[200px] items-center">
              <span className="text-lg font-semibold">Total Purchase Amount:</span>
              <Badge variant="secondary" className="text-lg font-semibold tabular-nums">
                ₹{calculateTotal.toFixed(2)}
              </Badge>
            </div>
            <Button 
                onClick={handleSavePurchase} 
                disabled={isSavingPurchase || selectedItems.length === 0}
                className="w-full sm:w-auto"
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              {isSavingPurchase ? "Saving Purchase..." : "Save Purchase & Update Stock"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  );
}

// Basic DatePicker component (can be moved to components/ui if not already there)
// For simplicity, this is a very basic one. You might have a more advanced one from ShadCN.
// If you already have a DatePicker, you can remove this.
interface DatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  className?: string;
}

const DatePickerComponent: React.FC<DatePickerProps> = ({ date, setDate, className }) => {
  const { Popover, PopoverTrigger, PopoverContent } = require("@/components/ui/popover");
  const { Calendar: ShadCalendar } = require("@/components/ui/calendar"); // Renamed to avoid conflict
  const { format } = require("date-fns");
  const { cn } = require("@/lib/utils");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal h-9",
            !date && "text-muted-foreground",
            className
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <ShadCalendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};
// Use the alias in the main component
DatePicker = DatePickerComponent;

