// src/app/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { Plus, Minus, Edit, Trash2, ListOrdered, ClipboardList, Search, User as UserIcon, Phone, Share2 } from "lucide-react"; // Added Share2
import { QRCodeCanvas } from 'qrcode.react';
import { addSnack, getSnacks, updateSnack, deleteSnack, saveBill } from "./actions";
import type { Snack, BillInput } from "@/lib/db"; // Import Snack type from db
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


interface SelectedSnack extends Snack {
  quantity: number;
}

const snackSchema = z.object({
  name: z.string().min(3, {
    message: "Name must be at least 3 characters.",
  }),
  price: z.string().refine((value) => !isNaN(parseFloat(value)) && parseFloat(value) > 0, {
    message: "Price must be a positive number.",
  }),
  category: z.string().min(3, {
    message: "Category must be at least 3 characters.",
  }),
});

type SnackFormDataType = z.infer<typeof snackSchema>;

const generatePaymentLink = (total: number) => {
    const upiId = process.env.NEXT_PUBLIC_UPI_ID || "your-default-upi-id@paytm";
    const upiLink = `upi://pay?pa=${upiId}&pn=YourStoreName&am=${total.toFixed(2)}&cu=INR`;
    const paytmFallback = `https://p.paytm.me/xCTH/your-link?amount=${total.toFixed(2)}`;

    return {
      upiLink,
      paytmFallback,
    };
};

const generateOrderNumber = () => {
    return `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

export default function Home() {
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [selectedSnacks, setSelectedSnacks] = useState<SelectedSnack[]>([]);
  const [editingSnackId, setEditingSnackId] = useState<string | null>(null);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [serviceChargeInput, setServiceChargeInput] = useState<string>("0");
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhoneNumber, setCustomerPhoneNumber] = useState<string>("");
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [isSavingBill, setIsSavingBill] = useState(false);
  const [isLoadingSnacks, setIsLoadingSnacks] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState("");


  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset
  } = useForm<SnackFormDataType>({
    resolver: zodResolver(snackSchema),
    defaultValues: {
      name: "",
      price: "",
      category: "",
    }
  });

  const loadSnacks = async () => {
    setIsLoadingSnacks(true);
    try {
      const snacksFromDb = await getSnacks();
      setSnacks(snacksFromDb || []);
    } catch (error: any) {
      console.error("Failed to load snacks:", error);
      toast({
        variant: "destructive",
        title: "Failed to load snacks.",
        description: error.message || "Please check your connection and configuration.",
      });
      setSnacks([]);
    } finally {
        setIsLoadingSnacks(false);
    }
  };

  useEffect(() => {
    loadSnacks();
    // Only set a new order number if one isn't already set (e.g., from URL params)
    if (!orderNumber) {
      setOrderNumber(generateOrderNumber());
    }
  }, []); // Empty dependency array means this runs once on mount

  useEffect(() => {
    if (document.activeElement?.id !== 'service-charge') {
        setServiceChargeInput(serviceCharge.toString());
    }
  }, [serviceCharge]);

  // Effect to process URL parameters for sharing
  useEffect(() => {
    const processUrlParams = () => {
      if (snacks.length === 0) return; // Wait for snacks to be loaded

      const params = new URLSearchParams(window.location.search);
      const sharedOrder = params.get('order');

      if (sharedOrder) {
        // Reset current bill state before loading shared state
        setSelectedSnacks([]);
        setServiceCharge(0);
        setServiceChargeInput("0");
        setCustomerName("");
        setCustomerPhoneNumber("");
        setSearchTerm("");

        setOrderNumber(sharedOrder);

        const itemsParam = params.get('items');
        if (itemsParam) {
          const newSelectedSnacks: SelectedSnack[] = [];
          const itemPairs = itemsParam.split(',');
          for (const pair of itemPairs) {
            const [id, qtyStr] = pair.split(':');
            const quantity = parseInt(qtyStr, 10);
            // Ensure snacks are available before finding
            const snack = snacks.find(s => s.id === id);
            if (snack && !isNaN(quantity) && quantity > 0) {
              newSelectedSnacks.push({ ...snack, price: Number(snack.price), quantity });
            }
          }
          setSelectedSnacks(newSelectedSnacks);
        }

        const chargeParam = params.get('charge');
        if (chargeParam) {
          const parsedCharge = parseFloat(chargeParam);
          if (!isNaN(parsedCharge) && parsedCharge >= 0) {
            setServiceCharge(parsedCharge);
            setServiceChargeInput(parsedCharge.toString());
          }
        }

        const nameParam = params.get('name');
        if (nameParam) {
          setCustomerName(decodeURIComponent(nameParam));
        }

        const phoneParam = params.get('phone');
        if (phoneParam) {
          setCustomerPhoneNumber(decodeURIComponent(phoneParam));
        }
        
        toast({ title: "Bill loaded from shared link!" });
        // Clear URL params to avoid reprocessing on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    if (snacks.length > 0 && window.location.search) {
        processUrlParams();
    }
  }, [snacks, toast]);


  const calculateTotal = () => {
    const snacksTotal = selectedSnacks.reduce((total, snack) => total + snack.price * snack.quantity, 0);
    return snacksTotal + serviceCharge;
  };

  const handleSnackIncrement = (snack: Snack) => {
    setSelectedSnacks((prevSelected) => {
      const alreadySelected = prevSelected.find((s) => s.id === snack.id);
      if (alreadySelected) {
        return prevSelected.map((s) =>
          s.id === snack.id ? { ...s, quantity: s.quantity + 1 } : s
        );
      } else {
        return [...prevSelected, { ...snack, price: Number(snack.price), quantity: 1 }];
      }
    });
    setSearchTerm("");
  };

  const handleSnackDecrement = (snack: Snack) => {
    setSelectedSnacks((prevSelected) => {
      const alreadySelected = prevSelected.find((s) => s.id === snack.id);
      if (!alreadySelected) {
        return prevSelected;
      }

      if (alreadySelected.quantity === 1) {
        return prevSelected.filter((s) => s.id !== snack.id);
      } else {
        return prevSelected.map((s) =>
          s.id === snack.id ? { ...s, quantity: s.quantity - 1 } : s
        );
      }
    });
  };

  const getSnackQuantity = (snack: Snack) => {
    const selected = selectedSnacks.find((s) => s.id === snack.id);
    return selected ? selected.quantity : 0;
  };

  const handleEditSnack = (snack: Snack) => {
    setEditingSnackId(snack.id);
    setValue("name", snack.name);
    setValue("price", snack.price.toString());
    setValue("category", snack.category);
  };

  const handleFormSubmit = async (formData: FormData) => {
    try {
      let result;
      if (editingSnackId) {
        result = await updateSnack(editingSnackId, formData);
        setEditingSnackId(null);
      } else {
        result = await addSnack(formData);
      }

      if (result?.success) {
        toast({
          title: result.message,
        });
        await loadSnacks();
        reset();
      } else {
        toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: result?.message || "There was a problem saving the snack.",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: e.message || "There was a problem saving the snack.",
      });
    }
  };

  const handleDeleteSnack = async (id: string) => {
     if (!confirm("Are you sure you want to delete this snack?")) {
       return;
     }
    try {
      const result = await deleteSnack(id);
      if (result?.success) {
        toast({
          title: result.message,
        });
        await loadSnacks();
      } else {
        toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: result?.message || "There was a problem deleting your snack.",
        });
      }
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: e.message || "There was a problem deleting your snack.",
      });
    }
  };

  const handleSaveBill = async () => {
      const currentTotal = calculateTotal();
      if (currentTotal <= 0 || isSavingBill) return;

      setIsSavingBill(true);

      const billData: BillInput = {
          orderNumber: orderNumber,
          customerName: customerName,
          customerPhoneNumber: customerPhoneNumber,
          items: selectedSnacks.map(s => ({ name: s.name, price: s.price, quantity: s.quantity })),
          serviceCharge: serviceCharge,
          totalAmount: currentTotal,
      };

      try {
          const result = await saveBill(billData);
          if (result.success) {
              toast({ title: "Bill saved successfully!" });
              setSelectedSnacks([]);
              setServiceCharge(0);
              setServiceChargeInput("0");
              setCustomerName("");
              setCustomerPhoneNumber("");
              setOrderNumber(generateOrderNumber());
              setSearchTerm("");
          } else {
              toast({ variant: "destructive", title: "Failed to save bill.", description: result.message });
          }
      } catch (error: any) {
          toast({ variant: "destructive", title: "Error saving bill.", description: error.message });
      } finally {
          setIsSavingBill(false);
      }
  };

  const total = calculateTotal();
  const paymentInfo = generatePaymentLink(total);

  const handleAdminLogin = () => {
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (!adminPassword) {
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
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Password.",
      });
    }
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
          setServiceChargeInput("0");
      } else {
          setServiceCharge(parsedValue);
          setServiceChargeInput(parsedValue.toString());
      }
  };

  const handleServiceChargeInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (e.target.value === "0") {
          setServiceChargeInput("");
      }
  };

  const filteredSnacks = useMemo(() => {
      if (!searchTerm) {
          return snacks;
      }
      return snacks.filter(snack =>
          snack.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [snacks, searchTerm]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredSnacks.length === 1) {
        handleSnackIncrement(filteredSnacks[0]);
      } else if (filteredSnacks.length === 0 && searchTerm) {
         toast({
             variant: "default",
             title: "No snacks found.",
             description: `No snacks match "${searchTerm}".`,
         });
      } else {
         setSearchTerm("");
      }
    }
  };

  const generateShareUrl = () => {
    const itemsQueryParam = selectedSnacks
      .map(s => `${s.id}:${s.quantity}`)
      .join(',');

    const params = new URLSearchParams();
    params.append('order', orderNumber);
    if (itemsQueryParam) {
      params.append('items', itemsQueryParam);
    }
    params.append('charge', serviceCharge.toString());
    if (customerName) {
      params.append('name', encodeURIComponent(customerName));
    }
    if (customerPhoneNumber) {
      params.append('phone', encodeURIComponent(customerPhoneNumber));
    }
    
    // Ensure window is defined (client-side)
    if (typeof window !== "undefined") {
        const baseUrl = window.location.origin + window.location.pathname;
        const fullUrl = `${baseUrl}?${params.toString()}`;
        setShareUrl(fullUrl);
    } else {
        setShareUrl(""); // Or handle server-side case appropriately
    }
  };


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
      <div className="w-full max-w-md mb-4 flex justify-between items-center">
        <CardTitle className="text-lg">SnackCalc</CardTitle>
        <div className="flex items-center gap-2">
            <Dialog onOpenChange={(open) => {
              if (open) {
                generateShareUrl();
              }
              setShowShareDialog(open);
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Share Bill">
                  <Share2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Bill</DialogTitle>
                  <DialogDescription>
                    Scan the QR code or copy the link to share the current bill with another device.
                    Changes made on other devices will not sync automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 mt-4">
                  {shareUrl && <QRCodeCanvas value={shareUrl} size={160} level="H" className="rounded-md" />}
                  {shareUrl && (
                    <div className="flex w-full items-center space-x-2">
                      <Input value={shareUrl} readOnly className="flex-1" aria-label="Shareable link" />
                      <Button onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        toast({ title: "Link copied to clipboard!" });
                      }}>
                        Copy
                      </Button>
                    </div>
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

            <Link href="/bills" passHref>
                <Button variant="outline" size="icon" aria-label="View Bills">
                    <ClipboardList className="h-4 w-4" />
                </Button>
            </Link>
            <Badge variant="outline" className="text-sm">
            Order: {orderNumber}
            </Badge>
        </div>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardDescription>Select your snacks and see the total cost.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-snacks"
              type="search"
              placeholder="Search snacks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="pl-8 w-full h-9"
              aria-label="Search snacks"
            />
          </div>

          <div className="flex flex-wrap gap-2">
             {isLoadingSnacks ? (
                 <p className="text-sm text-muted-foreground">Loading snacks...</p>
             ) : filteredSnacks.length === 0 && snacks.length > 0 && searchTerm ? (
                  <p className="text-sm text-muted-foreground">No snacks match your search.</p>
             ): filteredSnacks.length === 0 && snacks.length === 0 ? (
                 <p className="text-sm text-muted-foreground">No snacks available. Add snacks below (Admin).</p>
             ) : (
                filteredSnacks.map((snack) => (
                  <div key={snack.id} className="flex items-center space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full px-3 py-1 h-auto"
                      onClick={() => handleSnackIncrement(snack)}
                    >
                      {snack.name}
                    </Button>
                    {getSnackQuantity(snack) > 0 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                        {getSnackQuantity(snack)}
                      </Badge>
                    )}
                  </div>
                ))
             )}
          </div>
          <Separator />
          <div>
            <h3 className="text-sm font-medium mb-2">Selected Snacks</h3>
            {selectedSnacks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No snacks selected.</p>
            ) : (
              <ul className="space-y-2">
                {selectedSnacks.map((snack) => (
                  <li key={snack.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <span>{snack.name}</span>
                      <div className="flex items-center border rounded-md">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleSnackDecrement(snack)}
                          disabled={getSnackQuantity(snack) <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Badge variant="outline" className="text-xs px-1.5 border-none">
                          {snack.quantity}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                           className="h-6 w-6"
                          onClick={() => handleSnackIncrement(snack)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <span>₹{typeof snack.price === 'number' ? (snack.price * snack.quantity).toFixed(2) : 'N/A'}</span>
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
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
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
                  placeholder="Enter customer phone"
                  value={customerPhoneNumber}
                  onChange={(e) => setCustomerPhoneNumber(e.target.value)}
                  className="pl-8 h-9 text-sm"
                  aria-label="Customer Phone Number"
                />
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="service-charge" className="text-sm">Service Charge</Label>
            <Input
              id="service-charge"
              type="text"
              placeholder="Enter service charge"
              value={serviceChargeInput}
              onChange={handleServiceChargeInputChange}
              onBlur={handleServiceChargeInputBlur}
              onFocus={handleServiceChargeInputFocus}
              className="h-9 text-sm"
              inputMode="decimal"
              aria-label="Service Charge"
            />
          </div>
          <Separator />
          <div className="flex flex-col items-center justify-between gap-3">
             <div className="flex justify-between w-full items-center">
                 <span className="text-base font-semibold">Total:</span>
                 <Badge variant="secondary" className="text-base font-semibold">₹{total.toFixed(2)}</Badge>
             </div>

            {total > 0 && (
                <div className="flex flex-col items-center gap-3 w-full">
                    <QRCodeCanvas value={paymentInfo.upiLink} size={128} level="H" />
                     <Button onClick={handleSaveBill} disabled={isSavingBill || total <= 0} className="w-full">
                        {isSavingBill ? 'Saving Bill...' : 'Save Bill'}
                    </Button>
                </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!isAdmin ? (
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
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="w-full max-w-md mt-4">
            <CardHeader>
              <CardTitle className="text-lg">{editingSnackId ? "Update Snack" : "Add a Snack"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={handleFormSubmit} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" type="text" placeholder="Snack Name" {...register("name")} required/>
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" type="text" placeholder="Snack Price" {...register("price")} required/>
                  {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" type="text" placeholder="Snack Category" {...register("category")} required/>
                  {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                </div>
                 <Button type="submit" disabled={isSavingBill}>
                    {editingSnackId ? "Update Snack" : "Add Snack"}
                 </Button>
                {editingSnackId && (
                  <Button variant="ghost" type="button" onClick={() => { setEditingSnackId(null); reset(); }}>
                    Cancel Edit
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          <Card className="w-full max-w-md mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Manage Snacks</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingSnacks ? (
                 <p className="text-sm text-muted-foreground">Loading snacks...</p>
              ) : snacks.length === 0 ? (
                 <p className="text-sm text-muted-foreground">No snacks added yet.</p>
              ) : (
              <ul className="mt-2 space-y-2">
                {snacks.map((snack) => {
                   const price = typeof snack.price === 'number' ? snack.price.toFixed(2) : 'N/A';
                   return (
                    <li key={snack.id} className="flex items-center justify-between p-2 border rounded-md">
                      <div className="flex flex-col text-sm">
                         <span className="font-medium">{snack.name}</span>
                         <span className="text-muted-foreground">₹{price} - {snack.category}</span>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="icon" onClick={() => handleEditSnack(snack)} aria-label={`Edit ${snack.name}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteSnack(snack.id)} aria-label={`Delete ${snack.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                   )
                })}
              </ul>
              )}
            </CardContent>
          </Card>
           <Button variant="outline" className="mt-4" onClick={() => setIsAdmin(false)}>Logout Admin</Button>
        </>
      )}
      <Toaster />
    </div>
  );
}
