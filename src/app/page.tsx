
// src/app/page.tsx
"use client";

import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { Plus, Minus, Edit, Trash2, Search, User as UserIcon, Phone, Share2, Hash, FileText, UserCog, Save, PlusCircle, ShoppingCart, History, ListChecks, Package, Settings, ShoppingBag, ClipboardList, Loader2 } from "lucide-react";
import { QRCodeCanvas } from 'qrcode.react';
import { addItem, getItems, updateItem, deleteItem, saveBill, addSupplier } from "./actions";
import type { Snack, BillInput, BillItem as DbBillItem, SupplierInput } from "@/lib/db"; // Snack is now effectively Item
import Link from "next/link";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { setSharedOrderInRTDB, SharedOrderItem, SharedOrderData, subscribeToSharedOrder, SharedOrderDataSnapshot } from "@/lib/rt_db";


interface SelectedItem extends Snack { // Snack here refers to the item structure
  quantity: number;
  // price is already here from Snack, it will represent the actual selling price for this instance
}

const itemSchema = z.object({
  name: z.string().min(3, {
    message: "Name must be at least 3 characters.",
  }),
  price: z.string().refine((value) => !isNaN(parseFloat(value)) && parseFloat(value) > 0, {
    message: "Selling price must be a positive number.",
  }),
  category: z.string().min(3, {
    message: "Category must be at least 3 characters.",
  }),
  cost: z.string().optional().refine(
    (value) => value === undefined || value.trim() === "" || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0), {
    message: "Cost must be a non-negative number if provided.",
  }),
  itemCode: z.string().optional(),
  stockQuantity: z.string().optional().refine(
    (value) => value === undefined || value.trim() === "" || (!isNaN(parseInt(value, 10)) && parseInt(value, 10) >= 0), {
    message: "Stock Quantity must be a non-negative integer if provided.",
  }),
});

type ItemFormDataType = z.infer<typeof itemSchema>;

const supplierSchema = z.object({
  name: z.string().min(1, { message: "Supplier name cannot be empty." }),
  contactPerson: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;


const generateOrderNumber = () => {
    return `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
};

type AdminActiveView = 'items' | 'purchasing' | null;
const SESSION_STORAGE_ADMIN_LOGGED_IN_KEY = 'isAdminLoggedIn';
const SESSION_STORAGE_ADMIN_VIEW_KEY = 'adminActiveView';

const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';


function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Snack[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [serviceChargeInput, setServiceChargeInput] = useState<string>("0");
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhoneNumber, setCustomerPhoneNumber] = useState<string>("");
  const [tableNumber, setTableNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLoginSection, setShowAdminLoginSection] = useState(false);
  const [password, setPassword] = useState("");
  const [isSavingBill, setIsSavingBill] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [adminItemSearchTerm, setAdminItemSearchTerm] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [isGeneratingShareUrl, setIsGeneratingShareUrl] = useState(false);

  const [activeSharedOrderNumber, setActiveSharedOrderNumber] = useState<string | null>(null);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [isUpdatingRTDBFromMain, setIsUpdatingRTDBFromMain] = useState(false);
  const [mainDebounceTimer, setMainDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [isUpdatingFromRTDBSync, setIsUpdatingFromRTDBSync] = useState(false);
  const [isLocalDirty, setIsLocalDirty] = useState(false);

  const listRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const lastInteractedItemIdRef = useRef<string | null>(null);

  const [itemsVisible, setItemsVisible] = useState(true);
  const prevShowShareDialogRef = useRef<boolean | undefined>();

  const [adminActiveView, setAdminActiveView] = useState<AdminActiveView>(null);

  // State for supplier dialog on main page
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [supplierDialogMode, setSupplierDialogMode] = useState<'add' | 'edit' | null>(null); // 'edit' won't be used here yet
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);


  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset
  } = useForm<ItemFormDataType>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: "",
      price: "",
      category: "",
      cost: "",
      itemCode: "",
      stockQuantity: "0",
    }
  });

  const supplierForm = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      phoneNumber: "",
      email: "",
      address: "",
      gstNumber: "",
    },
  });

  const loadItems = useCallback(async () => {
    setIsLoadingItems(true);
    try {
      const itemsFromDb = await getItems();
      setItems(itemsFromDb || []);
    } catch (error: any) {
      console.error("Failed to load items:", error);
      toast({
        variant: "destructive",
        title: "Failed to load items.",
        description: error.message || "Please check your connection and configuration.",
      });
      setItems([]);
    } finally {
        setIsLoadingItems(false);
    }
  }, [toast]);

  useEffect(() => {
    const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (adminPass && adminPass.length > 0) {
      const adminLoggedIn = sessionStorage.getItem(SESSION_STORAGE_ADMIN_LOGGED_IN_KEY);
      const storedAdminView = sessionStorage.getItem(SESSION_STORAGE_ADMIN_VIEW_KEY) as AdminActiveView;

      if (adminLoggedIn === 'true') {
        setIsAdmin(true);
        setShowAdminLoginSection(false);
        setAdminActiveView(storedAdminView || 'items'); 
        setItemsVisible(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadItems();

    const editOrderNum = searchParams.get('editOrder');
    const editFsBillId = searchParams.get('editBillId');

    if (editOrderNum && editFsBillId) {
      setOrderNumber(editOrderNum);
      setEditingBillId(editFsBillId);
      setActiveSharedOrderNumber(editOrderNum);
      setItemsVisible(true);
      setIsLocalDirty(false); // Start clean when loading an existing bill
      console.log(`Editing mode activated for order ${editOrderNum}, bill ID ${editFsBillId}`);
    } else if (!orderNumber) {
      setOrderNumber(generateOrderNumber());
      setItemsVisible(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadItems, searchParams]);


  useEffect(() => {
    if (document.activeElement?.id !== 'service-charge' && document.activeElement?.id !== 'shared-service-charge') {
        setServiceChargeInput(serviceCharge.toFixed(2));
    }
  }, [serviceCharge]);

  useEffect(() => {
    if (!activeSharedOrderNumber || items.length === 0 || isUpdatingRTDBFromMain) {
      return;
    }

    console.log(`Main page subscribing to RTDB for order: ${activeSharedOrderNumber}`);
    const unsubscribe = subscribeToSharedOrder(activeSharedOrderNumber, (data: SharedOrderDataSnapshot | null) => {
      if (isUpdatingRTDBFromMain) return;

      if (data && data.orderNumber === activeSharedOrderNumber) {
         if (isLocalDirty && orderNumber === activeSharedOrderNumber && editingBillId) {
            console.log(`Main page: Received RTDB update for ${activeSharedOrderNumber}, but local is dirty (and in FS edit mode). Ignoring direct state update to prevent overwriting local edits.`);
            return;
        }
        console.log(`Main page received RTDB update for ${activeSharedOrderNumber}:`, data);
        setIsUpdatingFromRTDBSync(true);

        const newSelected = (data.items || []).map(item => {
          const baseItem = items.find(s => s.id === item.id || s.name === item.name);
          return {
            id: baseItem?.id || item.id,
            name: item.name,
            price: Number(item.price), // Use price from RTDB data
            quantity: item.quantity,
            category: baseItem?.category || 'Unknown',
            cost: baseItem?.cost,
            itemCode: item.itemCode || baseItem?.itemCode || '',
            stockQuantity: baseItem?.stockQuantity || 0,
          };
        });

        const currentSimpleSelected = selectedItems.map(s => ({id: s.id, quantity: s.quantity, price: s.price, name: s.name, itemCode: s.itemCode}));
        const newSimpleSelected = newSelected.map(s => ({id: s.id, quantity: s.quantity, price: s.price, name: s.name, itemCode: s.itemCode}));

        if (JSON.stringify(currentSimpleSelected) !== JSON.stringify(newSimpleSelected)) {
            setSelectedItems(newSelected);
        }

        const newServiceCharge = Number(data.serviceCharge) || 0;
        if (newServiceCharge !== serviceCharge) {
          setServiceCharge(newServiceCharge);
        }
        if (String(data.customerName || "") !== customerName) {
          setCustomerName(String(data.customerName || ""));
        }
        if (String(data.customerPhoneNumber || "") !== customerPhoneNumber) {
          setCustomerPhoneNumber(String(data.customerPhoneNumber || ""));
        }
        if (String(data.tableNumber || "") !== tableNumber) {
          setTableNumber(String(data.tableNumber || ""));
        }
        if (String(data.notes || "") !== notes) {
          setNotes(String(data.notes || ""));
        }

        requestAnimationFrame(() => {
            setIsUpdatingFromRTDBSync(false);
        });

      } else if (!data && activeSharedOrderNumber) {
          console.warn(`RTDB data for ${activeSharedOrderNumber} became null on main page.`);
      }
    });

    return () => {
      console.log(`Main page unsubscribing from RTDB for order: ${activeSharedOrderNumber}`);
      unsubscribe();
    };
  }, [activeSharedOrderNumber, items, isLocalDirty, customerName, customerPhoneNumber, tableNumber, notes, selectedItems, serviceCharge, orderNumber, isUpdatingRTDBFromMain, editingBillId]);


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
        const updated = { ...prevSelected[existingItemIndex], quantity: prevSelected[existingItemIndex].quantity + 1 };
        const newSelected = [...prevSelected];
        newSelected.splice(existingItemIndex, 1);
        return [updated, ...newSelected];
      } else {
        // Initialize with the item's default price
        const newItemData: SelectedItem = { ...item, price: Number(item.price), quantity: 1 };
        return [newItemData, ...prevSelected];
      }
    });
    setSearchTerm("");
  };

  const handleItemDecrement = (item: SelectedItem) => {
    setIsLocalDirty(true);
    lastInteractedItemIdRef.current = item.id;
    setSelectedItems((prevSelected) => {
      const currentItemIndex = prevSelected.findIndex((s) => s.id === item.id);
      if (currentItemIndex === -1) return prevSelected;

      const current = prevSelected[currentItemIndex];
      let newSelected = [...prevSelected];
      newSelected.splice(currentItemIndex, 1);

      if (current.quantity === 1) {
        return newSelected;
      } else {
        const updated = { ...current, quantity: current.quantity - 1 };
        return [updated, ...newSelected];
      }
    });
  };

  const handleSelectedPriceChange = (itemId: string, newPriceString: string) => {
    const newPrice = parseFloat(newPriceString);
    if (isNaN(newPrice) || newPrice < 0) return; // Or handle error, set to 0, etc.

    setIsLocalDirty(true);
    lastInteractedItemIdRef.current = itemId;
    setSelectedItems(prevSelected =>
      prevSelected.map(item =>
        item.id === itemId ? { ...item, price: newPrice } : item
      )
    );
  };


  const getItemQuantity = (itemId: string) => {
    const selected = selectedItems.find((s) => s.id === itemId);
    return selected ? selected.quantity : 0;
  };

  useEffect(() => {
    if (lastInteractedItemIdRef.current && listRefs.current[lastInteractedItemIdRef.current]) {
      listRefs.current[lastInteractedItemIdRef.current]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedItems]);


  const handleEditItem = (item: Snack) => {
    setEditingItemId(item.id);
    setValue("name", item.name);
    setValue("price", item.price.toString());
    setValue("category", item.category);
    setValue("cost", item.cost?.toString() || "");
    setValue("itemCode", item.itemCode || "");
    setValue("stockQuantity", item.stockQuantity?.toString() || "0");
  };

  const handleItemFormSubmit = async (data: ItemFormDataType) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('price', String(data.price));
    formData.append('category', data.category);
    if (data.cost && data.cost.trim() !== "") formData.append('cost', String(data.cost));
    if (data.itemCode && data.itemCode.trim() !== "") formData.append('itemCode', data.itemCode);
    if (data.stockQuantity && data.stockQuantity.trim() !== "") formData.append('stockQuantity', String(data.stockQuantity));


    try {
      let result;
      if (editingItemId) {
        result = await updateItem(editingItemId, formData);
        setEditingItemId(null);
      } else {
        result = await addItem(formData);
      }

      if (result?.success) {
        toast({
          title: result.message,
        });
        await loadItems();
        reset({ name: "", price: "", category: "", cost: "", itemCode: "", stockQuantity: "0" });
      } else {
        toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: result?.message || "There was a problem saving the item.",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: e.message || "There was a problem saving the item.",
      });
    }
  };


  const handleSupplierFormSubmit = async (data: SupplierFormData) => {
    setIsSubmittingSupplier(true);
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('contactPerson', data.contactPerson || '');
    formData.append('phoneNumber', data.phoneNumber || '');
    formData.append('email', data.email || '');
    formData.append('address', data.address || '');
    formData.append('gstNumber', data.gstNumber || '');

    try {
      const result = await addSupplier(formData);

      if (result.success) {
        toast({ title: "Success", description: result.message || "Supplier added successfully!" });
        setShowSupplierDialog(false);
        supplierForm.reset();
        // Optionally, refresh any lists that depend on suppliers if they are used on this page
        // For now, we mostly care about `loadItems` in case suppliers affect item availability or something.
        await loadItems(); 
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred while adding supplier." });
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  const handleOpenAddSupplierDialog = () => {
    setSupplierDialogMode('add');
    supplierForm.reset({
      name: "",
      contactPerson: "",
      phoneNumber: "",
      email: "",
      address: "",
      gstNumber: "",
    });
    setShowSupplierDialog(true);
  };


  const handleSaveBill = async (resetFormAfterSave: boolean) => {
      const currentTotal = calculateTotal();
      if (isSavingBill) return;

      if (editingBillId && !isLocalDirty && !resetFormAfterSave) {
        toast({
            variant: "default",
            title: "No changes to update.",
            description: "Please make a change before updating the bill."
        });
        return;
      }

      if (!editingBillId && currentTotal <= 0 && selectedItems.length === 0 && !resetFormAfterSave) {
        toast({ variant: "default", title: "Cannot save an empty bill." });
        return;
      }

      setIsSavingBill(true);

      const billData: BillInput = {
          orderNumber: orderNumber,
          customerName: customerName,
          customerPhoneNumber: customerPhoneNumber,
          tableNumber: tableNumber,
          notes: notes,
          items: selectedItems.map(s => ({
            itemId: s.id,
            name: s.name,
            price: Number(s.price),
            quantity: s.quantity,
            itemCode: s.itemCode || ''
          })),
          serviceCharge: serviceCharge,
          totalAmount: currentTotal,
      };

      try {
          const result = await saveBill(billData, editingBillId || undefined);
          if (result.success) {
              await loadItems(); // Reload items to reflect any stock changes
              if (resetFormAfterSave) {
                setSelectedItems([]);
                setServiceCharge(0);
                setCustomerName("");
                setCustomerPhoneNumber("");
                setTableNumber("");
                setNotes("");
                setOrderNumber(generateOrderNumber());
                setSearchTerm("");
                setActiveSharedOrderNumber(null);
                setEditingBillId(null);
                setShareUrl("");
                setIsLocalDirty(false);
                setItemsVisible(true);

                if (searchParams.get('editOrder') || searchParams.get('editBillId')) {
                  router.replace('/', { scroll: false });
                }
              } else {
                if (!editingBillId && result.billId) {
                  setEditingBillId(result.billId);
                }
                setIsLocalDirty(false);
                if (itemsVisible) { // If items were visible, hide them after saving
                    setItemsVisible(false);
                }
              }
              toast({ title: result.message }); 
          } else {
              toast({ variant: "destructive", title: editingBillId ? "Failed to update bill." : "Failed to save bill.", description: result.message });
          }
      } catch (error: any) {
          toast({ variant: "destructive", title: editingBillId ? "Error updating bill." : "Error saving bill.", description: error.message });
      } finally {
          setIsSavingBill(false);
      }
  };

  const total = calculateTotal();
  const upiId = process.env.NEXT_PUBLIC_UPI_ID || "your-default-upi-id@paytm";
  const upiLink = `upi://pay?pa=${upiId}&pn=Snackulator&am=${total.toFixed(2)}&cu=INR&tn=Order%20${orderNumber}`;


  const handleAdminLogin = () => {
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (!adminPassword || adminPassword.length === 0) {
        toast({
            variant: "destructive",
            title: "Admin password not configured.",
            description: "Please set NEXT_PUBLIC_ADMIN_PASSWORD in your environment variables.",
        });
        return;
    }
    if (password === adminPassword) {
      setIsAdmin(true);
      setPassword("");
      setShowAdminLoginSection(false);
      setItemsVisible(false); // Hide bill section when admin logs in
      sessionStorage.setItem(SESSION_STORAGE_ADMIN_LOGGED_IN_KEY, 'true');
      const storedAdminView = sessionStorage.getItem(SESSION_STORAGE_ADMIN_VIEW_KEY) as AdminActiveView;
      const viewToSet = storedAdminView || 'items';
      setAdminActiveView(viewToSet);
      sessionStorage.setItem(SESSION_STORAGE_ADMIN_VIEW_KEY, viewToSet);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Password.",
      });
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminActiveView(null);
    setShowAdminLoginSection(false);
    setItemsVisible(true); // Show bill section when admin logs out
    sessionStorage.removeItem(SESSION_STORAGE_ADMIN_LOGGED_IN_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_ADMIN_VIEW_KEY);
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

  const filteredListedItems = useMemo(() => {
      if (!searchTerm) {
          return items;
      }
      const lowerSearchTerm = searchTerm.toLowerCase();
      return items.filter(item =>
          item.name.toLowerCase().includes(lowerSearchTerm) ||
          (item.itemCode && item.itemCode.toLowerCase().includes(lowerSearchTerm))
      );
  }, [items, searchTerm]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredListedItems.length === 1) {
        handleItemIncrement(filteredListedItems[0]);
      } else if (filteredListedItems.length === 0 && searchTerm) {
         toast({
             variant: "default",
             title: "No items found.",
             description: `No items match "${searchTerm}". Try a different term.`,
         });
      } else if (filteredListedItems.length > 1) {
        toast({
            title: "Multiple matches",
            description: "Please refine your search or select from the list.",
        });
      }
    }
  };

 const handleShareBill = useCallback(async (orderNumberToShare: string) => {
    if (typeof window === "undefined") {
        setShareUrl("");
        setIsGeneratingShareUrl(false);
        if (!editingBillId) { // Only reset activeSharedOrderNumber if not editing a Firestore bill
            setActiveSharedOrderNumber(null);
        }
        return;
    }
    setIsGeneratingShareUrl(true);
    setShareUrl("");

    const itemsToShare: SharedOrderItem[] = selectedItems.map(s => ({
      id: s.id,
      name: s.name,
      price: Number(s.price),
      quantity: s.quantity,
      itemCode: s.itemCode || '',
    }));

    const sharedOrderPayload: Omit<SharedOrderData, 'lastUpdatedAt' | 'orderNumber'> = {
      items: itemsToShare,
      serviceCharge: serviceCharge,
      customerName: customerName,
      customerPhoneNumber: customerPhoneNumber,
      tableNumber: tableNumber,
      notes: notes,
    };

    try {
      setActiveSharedOrderNumber(orderNumberToShare); // Set this regardless of editingBillId for sharing
      await setSharedOrderInRTDB(orderNumberToShare, sharedOrderPayload);
      const baseUrl = window.location.origin;
      const fullUrl = `${baseUrl}/orders/${orderNumberToShare}`;
      setShareUrl(fullUrl);

    } catch (error) {
      console.error("Failed to share bill to RTDB:", error);
      toast({ variant: "destructive", title: "Sharing failed", description: "Could not update shared bill. Please try again." });
      setShareUrl("");
      if (!editingBillId) { // Only reset activeSharedOrderNumber if not editing a Firestore bill
         setActiveSharedOrderNumber(null);
      }
    } finally {
      setIsGeneratingShareUrl(false);
    }
  }, [selectedItems, serviceCharge, customerName, customerPhoneNumber, tableNumber, notes, editingBillId]);


  useEffect(() => {
    if (prevShowShareDialogRef.current !== true && showShareDialog === true) {
      handleShareBill(orderNumber);
    }
    prevShowShareDialogRef.current = showShareDialog;
  }, [showShareDialog, orderNumber, handleShareBill]);


  useEffect(() => {
    if (isUpdatingFromRTDBSync || !activeSharedOrderNumber || orderNumber !== activeSharedOrderNumber || isLoadingItems || isUpdatingRTDBFromMain || !isLocalDirty) {
      return;
    }

    if (mainDebounceTimer) {
      clearTimeout(mainDebounceTimer);
    }

    const timer = setTimeout(async () => {
      if (isUpdatingFromRTDBSync || orderNumber !== activeSharedOrderNumber || !activeSharedOrderNumber || !isLocalDirty) return;

      console.log(`Main page pushing update to RTDB for ${activeSharedOrderNumber} (local is dirty)`);
      setIsUpdatingRTDBFromMain(true);
      const itemsToShare: SharedOrderItem[] = selectedItems.map(s => ({
        id: s.id,
        name: s.name,
        price: Number(s.price),
        quantity: s.quantity,
        itemCode: s.itemCode || '',
      }));

      const currentOrderData: Omit<SharedOrderData, 'lastUpdatedAt' | 'orderNumber'> = {
        items: itemsToShare,
        serviceCharge: serviceCharge,
        customerName: customerName,
        customerPhoneNumber: customerPhoneNumber,
        tableNumber: tableNumber,
        notes: notes,
      };

      try {
        await setSharedOrderInRTDB(activeSharedOrderNumber, currentOrderData);
        if (!editingBillId) { // Only clear dirty flag if not in Firestore edit mode.
          setIsLocalDirty(false);
        }
      } catch (error) {
        console.error("Failed to auto-update RTDB from main page:", error);
         toast({ variant: "destructive", title: "Real-time Sync Error", description: "Failed to sync changes automatically." });
      } finally {
        setIsUpdatingRTDBFromMain(false);
      }
    }, 750);

    setMainDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    selectedItems,
    serviceCharge,
    customerName,
    customerPhoneNumber,
    tableNumber,
    notes,
    orderNumber,
    activeSharedOrderNumber,
    isLoadingItems,
    isUpdatingRTDBFromMain,
    isUpdatingFromRTDBSync,
    isLocalDirty,
    editingBillId
  ]);

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

  const handlePrimaryActionClick = () => {
    if (!itemsVisible) {
      setItemsVisible(true);
    } else {
      handleSaveBill(false);
    }
  };

  const primaryButtonText = !itemsVisible ? "Edit Items" : (editingBillId ? "Update Bill" : "Save Bill");
  const PrimaryButtonIcon = !itemsVisible ? Edit : Save;
  const primaryButtonDisabled = isSavingBill;


  const filteredAdminItems = useMemo(() => {
    if (!adminItemSearchTerm) {
        return items;
    }
    const lowerSearchTerm = adminItemSearchTerm.toLowerCase();
    return items.filter(item =>
        item.name.toLowerCase().includes(lowerSearchTerm) ||
        (item.itemCode && item.itemCode.toLowerCase().includes(lowerSearchTerm))
    );
  }, [items, adminItemSearchTerm]);

  const handleAdminViewChange = (view: AdminActiveView) => {
    setAdminActiveView(view);
    if (view) {
        sessionStorage.setItem(SESSION_STORAGE_ADMIN_VIEW_KEY, view);
    } else {
        sessionStorage.removeItem(SESSION_STORAGE_ADMIN_VIEW_KEY);
    }
  };


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
      <div className="w-full max-w-md mb-4 flex justify-between items-center">
        <CardTitle className="text-lg">Snackulator</CardTitle>
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="icon"
                onClick={() => {
                    const nextShowAdminLoginSection = !showAdminLoginSection;
                    setShowAdminLoginSection(nextShowAdminLoginSection);
                    if (nextShowAdminLoginSection && !isAdmin) {
                        setItemsVisible(false);
                    } else if (!nextShowAdminLoginSection && !isAdmin) { 
                        setItemsVisible(true);
                    }
                }}
                aria-label="Toggle Admin Login"
            >
                <UserCog className="h-4 w-4" />
            </Button>
            <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Share Bill">
                  <Share2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Bill (Real-time)</DialogTitle>
                  <DialogDescription>
                    Scan the QR code or copy the link to share and edit this bill in real-time with another device.
                    The order number for sharing is <strong>{activeSharedOrderNumber || orderNumber}</strong>.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 mt-4">
                  {isGeneratingShareUrl ? (
                    <p>Generating share link...</p>
                  ) : shareUrl ? (
                    <>
                      <QRCodeCanvas value={shareUrl} size={160} level="H" className="rounded-md" data-ai-hint="sharing qr" />
                      <div className="flex w-full items-center space-x-2">
                        <Input value={shareUrl} readOnly className="flex-1" aria-label="Shareable link" />
                        <Button onClick={() => {
                          if (shareUrl) {
                              navigator.clipboard.writeText(shareUrl);
                              toast({ title: "Link copied to clipboard!" });
                          }
                        }}>
                          Copy
                        </Button>
                      </div>
                    </>
                  ) : (
                     <p className="text-destructive">Failed to generate share link. Check connection or try again.</p>
                  )}
                </div>
                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      Close
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Badge variant="outline" className="text-sm whitespace-nowrap">
            Order: {orderNumber}
            </Badge>
        </div>
      </div>

      {(!isAdmin && !showAdminLoginSection) && (
         <Card className="w-full max-w-md">
          <CardHeader>
             <CardTitle className="text-lg">Order {orderNumber}</CardTitle>
             <CardDescription>{editingBillId ? `Editing Bill (Order: ${orderNumber})` : "Select items, add customer details, and calculate the total."}</CardDescription>
          </CardHeader>
           <CardContent className="grid gap-4">
            {itemsVisible && (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-items"
                    type="search"
                    placeholder="Search items by name or code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-8 w-full h-9"
                    aria-label="Search items"
                  />
                </div>

                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 rounded-md border bg-muted/20">
                  {isLoadingItems ? (
                      <p className="text-sm text-muted-foreground w-full text-center py-2">Loading items...</p>
                  ) : filteredListedItems.length === 0 && items.length > 0 && searchTerm ? (
                        <p className="text-sm text-muted-foreground w-full text-center py-2">No items match your search.</p>
                  ): filteredListedItems.length === 0 && items.length === 0 ? (
                      <p className="text-sm text-muted-foreground w-full text-center py-2">No items available. Add items (Admin).</p>
                  ) : (
                      filteredListedItems.map((item) => (
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
                      ))
                  )}
                </div>
                <Separator />
              </>
             )}

            <div>
              <h3 className="text-sm font-medium mb-2">Selected Items</h3>
              {selectedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items selected.</p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedItems.map((item) => (
                    <li
                      key={item.id}
                      ref={(el) => listRefs.current[item.id] = el}
                      className="flex items-center justify-between text-sm p-1.5 rounded-md hover:bg-muted/50"
                    >
                      <div className="flex items-center space-x-2 flex-grow">
                        <span>{item.name}</span>
                        <Input
                          type="number"
                          value={item.price.toString()} // Ensure it's a string for input value
                          onChange={(e) => handleSelectedPriceChange(item.id, e.target.value)}
                          onBlur={(e) => { // Optional: Format on blur
                            const newPrice = parseFloat(e.target.value);
                            if (!isNaN(newPrice) && newPrice >=0) {
                                handleSelectedPriceChange(item.id, newPrice.toFixed(2));
                            } else {
                                // Reset to original if invalid, or keep current valid price
                                const originalItem = items.find(i => i.id === item.id);
                                handleSelectedPriceChange(item.id, (originalItem ? originalItem.price : 0).toFixed(2));
                            }
                          }}
                          className="h-7 w-20 text-xs px-1 text-right"
                          disabled={!itemsVisible}
                          aria-label={`Price for ${item.name}`}
                        />
                        <div className="flex items-center border rounded-md">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleItemDecrement(item)}
                            disabled={item.quantity <= 0 || !itemsVisible}
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Badge variant="outline" className="text-xs px-1.5 border-none tabular-nums">
                            {item.quantity}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                             className="h-6 w-6"
                            onClick={() => {
                              const originalItem = items.find(s => s.id === item.id);
                              if (originalItem) handleItemIncrement(originalItem);
                            }}
                             disabled={!itemsVisible}
                             aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <span className="font-medium tabular-nums ml-2">{currencySymbol}{typeof item.price === 'number' ? (item.price * item.quantity).toFixed(2) : 'N/A'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="customer-name" className="text-sm">Customer Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customer-name"
                    type="text"
                    placeholder="Optional"
                    value={customerName}
                    onChange={handleCustomerNameChange}
                    className="pl-8 h-9 text-sm"
                    aria-label="Customer Name"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="customer-phone" className="text-sm">Customer Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="customer-phone"
                    type="tel"
                    placeholder="Optional"
                    value={customerPhoneNumber}
                    onChange={handleCustomerPhoneNumberChange}
                    className="pl-8 h-9 text-sm"
                    aria-label="Customer Phone Number"
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="service-charge" className="text-sm">Service Charge ({currencySymbol})</Label>
              <Input
                id="service-charge"
                type="text"
                placeholder="0.00"
                value={serviceChargeInput}
                onChange={handleServiceChargeInputChange}
                onBlur={handleServiceChargeInputBlur}
                onFocus={handleServiceChargeInputFocus}
                className="h-9 text-sm"
                inputMode="decimal"
                aria-label="Service Charge"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="table-number" className="text-sm">Table Number</Label>
              <div className="relative">
                  <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="table-number"
                    type="text"
                    placeholder="Optional"
                    value={tableNumber}
                    onChange={handleTableNumberChange}
                    className="pl-8 h-9 text-sm"
                    aria-label="Table Number"
                  />
                </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes" className="text-sm">Notes</Label>
              <div className="relative">
                <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="notes"
                  placeholder="Optional: e.g., less spicy, no onions..."
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

              {(total > 0 || selectedItems.length > 0 || editingBillId || !itemsVisible) && (
                  <div className="flex flex-col items-center gap-3 w-full">
                      <QRCodeCanvas value={upiLink} size={128} level="H" data-ai-hint="payment qr" />
                       <div className="flex w-full gap-2">
                        <Button variant="default" onClick={handlePrimaryActionClick} disabled={primaryButtonDisabled} className="flex-1">
                           <PrimaryButtonIcon className="mr-2 h-4 w-4" /> {primaryButtonText}
                        </Button>
                        <Button variant="outline" onClick={() => handleSaveBill(true)} disabled={isSavingBill} className="flex-1">
                           <PlusCircle className="mr-2 h-4 w-4" /> New Order
                        </Button>
                       </div>
                  </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(!isAdmin && showAdminLoginSection) && (
        <Card className="w-full max-w-md mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                aria-label="Admin Password"
              />
            </div>
            <Button className="mt-4 w-full" onClick={handleAdminLogin}>Login</Button>
            <Button variant="ghost" className="mt-2 w-full" onClick={() => {
                setShowAdminLoginSection(false);
                setItemsVisible(true); // Ensure items are visible when canceling admin login
            }}>Cancel</Button>
          </CardContent>
        </Card>
      )}


      {isAdmin && (
        <Card className="w-full max-w-md mt-4">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Admin Panel</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleAdminLogout}>Logout Admin</Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-b pb-2">
                    <Button
                        variant={adminActiveView === 'items' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleAdminViewChange('items')}
                    >
                       <Package className="mr-2 h-4 w-4" /> Item Management
                    </Button>
                    <Button
                        variant={adminActiveView === 'purchasing' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleAdminViewChange('purchasing')}
                    >
                        <ShoppingBag className="mr-2 h-4 w-4" /> Purchasing & Suppliers
                    </Button>
                    <Link href="/bills" passHref>
                        <Button
                            variant={'outline'}
                            size="sm"
                        >
                           <History className="mr-2 h-4 w-4" /> Sales History
                        </Button>
                    </Link>
                </div>
            </CardHeader>
            <CardContent>
                {adminActiveView === 'items' && (
                    <>
                        <div className="mb-6">
                            <h3 className="text-md font-semibold mb-2">{editingItemId ? "Update Item" : "Add an Item"}</h3>
                            <form onSubmit={handleSubmit(handleItemFormSubmit)} className="grid gap-4">
                                <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" type="text" placeholder="Item Name" {...register("name")} required/>
                                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                                </div>
                                <div className="grid gap-2">
                                <Label htmlFor="price">Selling Price ({currencySymbol})</Label>
                                <Input id="price" type="text" placeholder="Item Selling Price" {...register("price")} required inputMode="decimal"/>
                                {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
                                </div>
                                <div className="grid gap-2">
                                <Label htmlFor="cost">Cost Price ({currencySymbol})</Label>
                                <Input id="cost" type="text" placeholder="Item Cost Price (Optional)" {...register("cost")} inputMode="decimal"/>
                                {errors.cost && <p className="text-sm text-destructive">{errors.cost.message}</p>}
                                </div>
                                <div className="grid gap-2">
                                <Label htmlFor="itemCode">Item Code</Label>
                                <Input id="itemCode" type="text" placeholder="Item Code (Optional)" {...register("itemCode")} />
                                {errors.itemCode && <p className="text-sm text-destructive">{errors.itemCode.message}</p>}
                                </div>
                                <div className="grid gap-2">
                                <Label htmlFor="stockQuantity">Stock Quantity</Label>
                                <Input id="stockQuantity" type="number" placeholder="Initial Stock (e.g., 0)" {...register("stockQuantity")} />
                                {errors.stockQuantity && <p className="text-sm text-destructive">{errors.stockQuantity.message}</p>}
                                </div>
                                <div className="grid gap-2">
                                <Label htmlFor="category">Category</Label>
                                <Input id="category" type="text" placeholder="Item Category" {...register("category")} required/>
                                {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                                </div>
                                <Button type="submit" disabled={isSavingBill}>
                                    {editingItemId ? "Update Item" : "Add Item"}
                                </Button>
                                {editingItemId && (
                                <Button variant="ghost" type="button" onClick={() => { setEditingItemId(null); reset({ name: "", price: "", category: "", cost: "", itemCode: "", stockQuantity: "0" }); }}>
                                    Cancel Edit
                                </Button>
                                )}
                            </form>
                        </div>
                        <Separator className="my-6" />
                        <div>
                            <h3 className="text-md font-semibold mb-2">Manage Existing Items</h3>
                            <div className="relative mt-2">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                id="search-admin-items"
                                type="search"
                                placeholder="Search items by name or code..."
                                value={adminItemSearchTerm}
                                onChange={(e) => setAdminItemSearchTerm(e.target.value)}
                                className="pl-8 w-full h-9"
                                aria-label="Search managed items"
                                />
                            </div>
                            {isLoadingItems ? (
                                <p className="text-sm text-muted-foreground mt-2">Loading items...</p>
                            ) : filteredAdminItems.length === 0 ? (
                                <p className="text-sm text-muted-foreground mt-2">
                                    {items.length === 0 ? "No items added yet." : "No items match your search."}
                                </p>
                            ) : (
                            <ul className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                                {filteredAdminItems.map((item) => {
                                const price = typeof item.price === 'number' ? item.price.toFixed(2) : (typeof item.price === 'string' ? parseFloat(item.price).toFixed(2) : 'N/A');
                                const cost = item.cost !== undefined && typeof item.cost === 'number' ? item.cost.toFixed(2) : (item.cost === undefined || String(item.cost).trim() === "" ? 'N/A' : String(item.cost));
                                const stock = item.stockQuantity;
                                return (
                                    <li key={item.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/30">
                                    <div className="flex flex-col text-sm">
                                        <span className="font-medium">{item.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                        Sell: {currencySymbol}{price} {cost !== 'N/A' ? `| Cost: ${currencySymbol}${cost}` : ''} {item.itemCode ? `| Code: ${item.itemCode}` : ''} | Stock: {stock !== undefined ? stock : 'N/A'} - {item.category}
                                        </span>
                                    </div>
                                    <div className="flex space-x-2">
                                        <Button variant="outline" size="icon" onClick={() => handleEditItem(item)} aria-label={`Edit ${item.name}`}>
                                        <Edit className="h-4 w-4" />
                                        </Button>
                                        <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="destructive" size="icon" aria-label={`Delete ${item.name}`}>
                                            <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                            <DialogTitle>Confirm Deletion</DialogTitle>
                                            <DialogDescription>
                                                Are you sure you want to delete the item "{item.name}"? This action cannot be undone.
                                            </DialogDescription>
                                            </DialogHeader>
                                            <DialogFooter>
                                            <DialogClose asChild>
                                                <Button variant="outline">Cancel</Button>
                                            </DialogClose>
                                            <Button variant="destructive" onClick={async () => {
                                                const result = await deleteItem(item.id);
                                                if (result.success) {
                                                toast({ title: result.message });
                                                loadItems();
                                                } else {
                                                toast({ variant: "destructive", title: "Error", description: result.message });
                                                }
                                                // Close the dialog after action
                                                const closeButton = document.querySelector('[data-radix-dialog-close]');
                                                if (closeButton instanceof HTMLElement) closeButton.click();
                                            }}>
                                                Delete
                                            </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                        </Dialog>
                                    </div>
                                    </li>
                                )
                                })}
                            </ul>
                            )}
                        </div>
                    </>
                )}

                {adminActiveView === 'purchasing' && (
                     <div className="flex flex-col space-y-3">
                        <h3 className="text-md font-semibold mb-1">Purchasing & Supplier Management</h3>
                        <Button variant="outline" className="w-full justify-start" onClick={handleOpenAddSupplierDialog}>
                           <PlusCircle className="mr-2 h-4 w-4" /> Add New Supplier
                        </Button>
                        <Link href="/purchases/create" passHref>
                            <Button variant="outline" className="w-full justify-start"><ShoppingCart className="mr-2 h-4 w-4" /> New Purchase Order</Button>
                        </Link>
                        <Link href="/purchases/history" passHref>
                            <Button variant="outline" className="w-full justify-start"><History className="mr-2 h-4 w-4" /> Purchase Order History</Button>
                        </Link>
                        <Link href="/suppliers" passHref>
                            <Button variant="outline" className="w-full justify-start"><ListChecks className="mr-2 h-4 w-4" /> View Suppliers List</Button>
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>
      ) }

      {/* Supplier Add/Edit Dialog for Main Page Admin Panel */}
      <Dialog open={showSupplierDialog} onOpenChange={(open) => {
          if (!open) {
            setShowSupplierDialog(false);
            setSupplierDialogMode(null);
            supplierForm.reset(); 
          }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {supplierDialogMode === 'add' ? "Add New Supplier" : "Edit Supplier"}
            </DialogTitle>
            <DialogDescription>
              {supplierDialogMode === 'add' 
                ? "Enter the details for the new supplier." 
                : "Update the details for this supplier. Click save when you're done."}
            </DialogDescription>
          </DialogHeader>
          <Form {...supplierForm}>
            <form onSubmit={supplierForm.handleSubmit(handleSupplierFormSubmit)} className="grid gap-4 py-4 max-h-[75vh] overflow-y-auto pr-2">
              <FormField
                control={supplierForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Supplier's full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={supplierForm.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={supplierForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g., +919876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={supplierForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., contact@supplier.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={supplierForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Supplier's full address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={supplierForm.control}
                name="gstNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 29ABCDE1234F1Z5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="sticky bottom-0 bg-background py-4 border-t">
                <Button type="button" variant="outline" onClick={() => { setShowSupplierDialog(false); supplierForm.reset(); }}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingSupplier}>
                  {isSubmittingSupplier && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {supplierDialogMode === 'add' ? "Add Supplier" : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}


export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4 md:p-8">
        <p className="text-lg text-muted-foreground">Loading page content...</p>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
