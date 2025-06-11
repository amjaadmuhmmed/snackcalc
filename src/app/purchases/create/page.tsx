
// src/app/purchases/create/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Plus, Minus, Search, ArrowLeft, FileText, ShoppingBag, Calendar as CalendarIconLucide, AlertCircle, Info, Loader2, Edit } from "lucide-react";
import { getItems, savePurchase, getSuppliers, addSupplier, getPurchaseById } from "@/app/actions";
import type { Snack, PurchaseInput, PurchaseItem as DbPurchaseItem, Supplier, Purchase } from "@/lib/db";
import { Timestamp } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


interface SelectedItemForPurchase extends Snack {
  quantity: number;
  purchaseCost: number;
}

const generatePurchaseOrderNumber = () => {
  return `PO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
};

const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';

function CreatePurchasePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [allItems, setAllItems] = useState<Snack[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItemForPurchase[]>([]);
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState<string>("");
  
  const [supplierNameInput, setSupplierNameInput] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(undefined); // This holds user's date choice from DatePicker
  const [initialLoadedPurchaseDate, setInitialLoadedPurchaseDate] = useState<Timestamp | null>(null); // Stores original TS for edits

  const [notes, setNotes] = useState<string>("");
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [isLoadingPurchaseForEdit, setIsLoadingPurchaseForEdit] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [showNewSupplierDialog, setShowNewSupplierDialog] = useState(false);
  const [newSupplierNameToCreate, setNewSupplierNameToCreate] = useState("");

  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editingPurchaseOrderNumber, setEditingPurchaseOrderNumber] = useState<string | null>(null);


  const listRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const lastInteractedItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    const editId = searchParams.get("editPurchaseId");
    const editPONumber = searchParams.get("editOrderNumber");

    if (editId) {
      setEditingPurchaseId(editId);
      if (editPONumber) setEditingPurchaseOrderNumber(editPONumber);
      setIsLoadingPurchaseForEdit(true);
      const fetchPurchaseForEdit = async () => {
        try {
          const purchaseToEdit = await getPurchaseById(editId);
          if (purchaseToEdit) {
            setPurchaseOrderNumber(purchaseToEdit.purchaseOrderNumber);
            
            if (purchaseToEdit.purchaseDate instanceof Timestamp) {
              setPurchaseDate(purchaseToEdit.purchaseDate.toDate());
              setInitialLoadedPurchaseDate(purchaseToEdit.purchaseDate); 
            } else if (purchaseToEdit.purchaseDate instanceof Date) { 
              setPurchaseDate(purchaseToEdit.purchaseDate);
              setInitialLoadedPurchaseDate(Timestamp.fromDate(purchaseToEdit.purchaseDate));
            }


            if (purchaseToEdit.supplierId && purchaseToEdit.supplierName) {
               const foundSupplier = allSuppliers.find(s => s.id === purchaseToEdit.supplierId) || 
                                    allSuppliers.find(s => s.name === purchaseToEdit.supplierName);
                if (foundSupplier) {
                    setSelectedSupplier(foundSupplier);
                    setSupplierNameInput(foundSupplier.name);
                } else {
                    setSupplierNameInput(purchaseToEdit.supplierName || "");
                    setSelectedSupplier({
                        id: purchaseToEdit.supplierId || '',
                        name: purchaseToEdit.supplierName || 'Unknown Supplier (from edit)'
                    });
                }
            } else if (purchaseToEdit.supplierName) {
                 setSupplierNameInput(purchaseToEdit.supplierName);
            }

            setNotes(purchaseToEdit.notes || "");
            
            const itemsToEdit: SelectedItemForPurchase[] = purchaseToEdit.items.map(pItem => {
              const baseItem = allItems.find(i => i.id === pItem.itemId || i.name === pItem.name);
              return {
                id: baseItem?.id || pItem.itemId,
                name: pItem.name,
                price: baseItem?.price || 0,
                category: baseItem?.category || "Unknown",
                cost: baseItem?.cost,
                itemCode: pItem.itemCode || baseItem?.itemCode || '',
                stockQuantity: baseItem?.stockQuantity || 0,
                quantity: pItem.quantity,
                purchaseCost: pItem.purchaseCost,
              };
            });
            setSelectedItems(itemsToEdit);
            
          } else {
            toast({ variant: "destructive", title: "Error", description: "Could not load purchase order for editing." });
            router.push("/purchases/history");
          }
        } catch (error: any) {
          toast({ variant: "destructive", title: "Error loading purchase for edit.", description: error.message });
        } finally {
          setIsLoadingPurchaseForEdit(false);
        }
      };
      
      if(allItems.length > 0 || allSuppliers.length > 0) { // Fetch only after items/suppliers are loaded to find baseItem info
          fetchPurchaseForEdit();
      }

    } else {
      setPurchaseOrderNumber(generatePurchaseOrderNumber());
      setInitialLoadedPurchaseDate(null); // Clear for new PO
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router, toast, allItems, allSuppliers]); // Rerun if allItems or allSuppliers changes

  useEffect(() => {
    if (!editingPurchaseId && !purchaseDate) {
      setPurchaseDate(new Date());
    }
  }, [editingPurchaseId, purchaseDate]);


  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoadingItems(true);
      setIsLoadingSuppliers(true);
      try {
        const [itemsFromDb, suppliersFromDb] = await Promise.all([
          getItems(),
          getSuppliers()
        ]);
        setAllItems(itemsFromDb || []);
        setAllSuppliers(suppliersFromDb || []);
      } catch (error: any) {
        console.error("Failed to load initial data:", error);
        toast({ variant: "destructive", title: "Failed to load page data." });
        setAllItems([]);
        setAllSuppliers([]);
      } finally {
        setIsLoadingItems(false);
        setIsLoadingSuppliers(false);
      }
    };
    loadInitialData();
  }, [toast]);

  useEffect(() => {
    if (lastInteractedItemIdRef.current && listRefs.current[lastInteractedItemIdRef.current]) {
      listRefs.current[lastInteractedItemIdRef.current]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedItems]);

  const handleSupplierInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentInputName = e.target.value;
    setSupplierNameInput(currentInputName);

    const foundSupplier = allSuppliers.find(
      (s) => s.name.toLowerCase() === currentInputName.trim().toLowerCase()
    );
    if (foundSupplier) {
      setSelectedSupplier(foundSupplier);
      setSupplierNameInput(foundSupplier.name); 
    } else {
      setSelectedSupplier(null);
    }
  };


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

  const resetFormForNewPurchase = () => {
    setEditingPurchaseId(null);
    setEditingPurchaseOrderNumber(null);
    setPurchaseOrderNumber(generatePurchaseOrderNumber());
    setPurchaseDate(new Date()); 
    setInitialLoadedPurchaseDate(null); 
    setSupplierNameInput("");
    setSelectedSupplier(null);
    setNotes("");
    setSelectedItems([]);
    setSearchTerm("");
    if (searchParams.get("editPurchaseId")) {
        router.push("/purchases/create", { scroll: false });
    }
  };

  const proceedToSavePurchase = async (finalSupplierName: string, finalSupplierId?: string) => {
    setIsSavingPurchase(true);

    let finalPurchaseDateForSave: Timestamp;

    // User-selected date from DatePicker state
    const userSelectedDate = purchaseDate; 

    if (!userSelectedDate) { 
        toast({ variant: "destructive", title: "Purchase Date is required." });
        setIsSavingPurchase(false);
        return; 
    }

    // Current system time for the time component
    const now = new Date(); 
    const combinedDateTime = new Date(
        userSelectedDate.getFullYear(), 
        userSelectedDate.getMonth(),    
        userSelectedDate.getDate(),     
        now.getHours(),             
        now.getMinutes(),          
        now.getSeconds(),          
        now.getMilliseconds()      
    );
    finalPurchaseDateForSave = Timestamp.fromDate(combinedDateTime);
    

    const purchaseData: PurchaseInput = {
      purchaseOrderNumber: purchaseOrderNumber,
      supplierName: finalSupplierName,
      supplierId: finalSupplierId,
      purchaseDate: finalPurchaseDateForSave, 
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
      const result = await savePurchase(purchaseData, editingPurchaseId || undefined);
      if (result.success) {
        toast({ title: result.message });
        if (editingPurchaseId) {
          router.push("/purchases/history"); 
        } else {
           resetFormForNewPurchase(); 
        }
        
        const updatedSuppliers = await getSuppliers(); 
        setAllSuppliers(updatedSuppliers);
      } else {
        toast({ variant: "destructive", title: editingPurchaseId ? "Failed to update purchase." : "Failed to save purchase.", description: result.message });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: editingPurchaseId ? "Error updating purchase." : "Error saving purchase.", description: error.message });
    } finally {
      setIsSavingPurchase(false);
    }
  };


  const handleSavePurchaseAttempt = async () => {
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

    const trimmedSupplierName = supplierNameInput.trim();

    if (selectedSupplier && selectedSupplier.id) {
        proceedToSavePurchase(selectedSupplier.name, selectedSupplier.id);
    } else if (trimmedSupplierName && !editingPurchaseId) { 
        setNewSupplierNameToCreate(trimmedSupplierName);
        setShowNewSupplierDialog(true);
    } else if (trimmedSupplierName && editingPurchaseId) { 
        // If editing and supplier name typed but not selected, save with the typed name (no ID)
        proceedToSavePurchase(trimmedSupplierName, undefined);
    } else { 
        // No supplier selected or typed
        proceedToSavePurchase("", undefined);
    }
  };

  const handleCreateNewSupplierAndSave = async () => {
    if (!newSupplierNameToCreate) return;
    setIsSavingPurchase(true);

    const formData = new FormData();
    formData.append('name', newSupplierNameToCreate);

    const result = await addSupplier(formData);
    
    if (result.success && result.id && result.supplier) {
      toast({ title: `Supplier '${result.supplier.name}' created successfully.` });
      const newSupplier = result.supplier;
      
      setAllSuppliers(prev => [...prev, newSupplier]); 
      
      setSupplierNameInput(newSupplier.name); 
      setSelectedSupplier(newSupplier);      
      
      setShowNewSupplierDialog(false);
      proceedToSavePurchase(newSupplier.name, newSupplier.id); 
    } else {
      toast({ variant: "destructive", title: "Failed to create supplier.", description: result.message || "Unknown error creating supplier." });
      setShowNewSupplierDialog(false); 
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
  
  if (isLoadingPurchaseForEdit || (editingPurchaseId && (isLoadingItems || isLoadingSuppliers))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4 md:p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Loading purchase order for editing...</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
      <div className="w-full max-w-2xl mb-4 flex justify-between items-center">
        <Button variant="outline" size="icon" asChild>
          <Link href={editingPurchaseId ? "/purchases/history" : "/"} aria-label={editingPurchaseId ? "Back to Purchase History" : "Back to Main Page"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">
            {editingPurchaseId ? `Edit Purchase Order: ${editingPurchaseOrderNumber || purchaseOrderNumber}` : "Create Purchase Order"}
        </h1>
        <div style={{ width: '36px' }}></div> {/* Spacer */}
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{editingPurchaseId ? "Update Purchase Entry" : "New Purchase Entry"}</CardTitle>
          <CardDescription>
            {editingPurchaseId 
                ? "Modify the details of this purchase order." 
                : "Add items received from suppliers to update stock levels."}
          </CardDescription>
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
              <Label htmlFor="supplier-name-input">Supplier Name</Label>
              <Input
                id="supplier-name-input"
                type="text"
                value={supplierNameInput}
                onChange={handleSupplierInputChange}
                placeholder="Type or select supplier (optional)"
                list="suppliers-datalist"
                autoComplete="off"
              />
              {isLoadingSuppliers ? (
                <p className="text-xs text-muted-foreground">Loading suppliers...</p>
              ) : (
                <datalist id="suppliers-datalist">
                    {allSuppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.name} />
                    ))}
                </datalist>
              )}
              {selectedSupplier && selectedSupplier.id && (
                <div className="text-xs text-muted-foreground mt-1 p-2 border border-dashed rounded-md bg-muted/50">
                  <div className="flex items-center">
                    <Info className="h-3 w-3 mr-1.5 text-primary" />
                    <span>Selected Supplier ID: <strong>{selectedSupplier.id}</strong></span>
                  </div>
                </div>
              )}
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
                        value={item.purchaseCost === undefined ? '' : item.purchaseCost}
                        onChange={(e) => handlePurchaseCostChange(item.id, e.target.value)}
                        onBlur={(e) => {
                           const newCost = parseFloat(e.target.value);
                           if (!isNaN(newCost) && newCost >= 0) {
                              handlePurchaseCostChange(item.id, newCost.toFixed(2));
                           } else {
                              handlePurchaseCostChange(item.id, "0.00");
                           }
                        }}
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
                        {currencySymbol}{(Number(item.purchaseCost) * item.quantity).toFixed(2)}
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
                {currencySymbol}{calculateTotal.toFixed(2)}
              </Badge>
            </div>
             <div className="flex w-full sm:w-auto gap-2">
                {editingPurchaseId && (
                    <Button variant="outline" onClick={resetFormForNewPurchase} className="flex-1 sm:flex-none">
                        New Purchase
                    </Button>
                )}
                <Button
                    onClick={handleSavePurchaseAttempt}
                    disabled={isSavingPurchase || selectedItems.length === 0}
                    className="flex-1 sm:flex-auto"
                >
                {isSavingPurchase && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingPurchaseId ? <Edit className="mr-2 h-4 w-4" /> : <ShoppingBag className="mr-2 h-4 w-4" />}
                {isSavingPurchase ? (editingPurchaseId ? "Updating..." : "Saving...") : (editingPurchaseId ? "Update Purchase Order" : "Save Purchase & Update Stock")}
                </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showNewSupplierDialog} onOpenChange={setShowNewSupplierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-yellow-500" />
              Confirm New Supplier
            </DialogTitle>
            <DialogDescription>
              The supplier "<strong>{newSupplierNameToCreate}</strong>" was not found in your records.
              Would you like to create this new supplier? You can add more details later from the Suppliers List page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => {setShowNewSupplierDialog(false); setIsSavingPurchase(false);}}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewSupplierAndSave} disabled={isSavingPurchase}>
              {isSavingPurchase && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Create & Save PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

export default function CreatePurchasePage() {
  return (
    <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4 md:p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-lg text-muted-foreground">Loading Purchase Page...</p>
      </div>
    }>
      <CreatePurchasePageContent />
    </Suspense>
  );
}

