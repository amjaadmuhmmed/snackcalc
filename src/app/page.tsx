
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
import { Plus, Minus, Edit, Trash2, ListOrdered, ClipboardList, Search } from "lucide-react";
import { QRCodeCanvas } from 'qrcode.react';
import { addSnack, getSnacks, updateSnack, deleteSnack, saveBill } from "./actions";
import type { Snack, BillInput } from "@/lib/db"; // Import Snack type from db
import Link from "next/link";

interface SelectedSnack extends Snack {
  quantity: number;
}

const snackSchema = z.object({
  name: z.string().min(3, {
    message: "Name must be at least 3 characters.",
  }),
  // Price validation remains the same, ensure parsing happens in the action
  price: z.string().refine((value) => !isNaN(parseFloat(value)) && parseFloat(value) > 0, {
    message: "Price must be a positive number.",
  }),
  category: z.string().min(3, {
    message: "Category must be at least 3 characters.",
  }),
});

// Type for the form data (matches schema)
type SnackFormDataType = z.infer<typeof snackSchema>;


const generatePaymentLink = (total: number) => {
    const upiId = process.env.NEXT_PUBLIC_UPI_ID || "your-default-upi-id@paytm"; // Fallback UPI ID
    const upiLink = `upi://pay?pa=${upiId}&pn=YourStoreName&am=${total.toFixed(2)}&cu=INR`;
    // Fallback link if UPI app is not installed (can be your Paytm payment page link)
    const paytmFallback = `https://p.paytm.me/xCTH/your-link?amount=${total.toFixed(2)}`; // Replace with your actual Paytm link

    return {
      upiLink,
      paytmFallback,
    };
};

// Function to generate a random order number (simple example)
const generateOrderNumber = () => {
    return `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

export default function Home() {
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [selectedSnacks, setSelectedSnacks] = useState<SelectedSnack[]>([]);
  const [editingSnackId, setEditingSnackId] = useState<string | null>(null);
  const [serviceCharge, setServiceCharge] = useState<number>(0); // State for the actual numeric value
  const [serviceChargeInput, setServiceChargeInput] = useState<string>("0"); // State for the input field's string value
  const [orderNumber, setOrderNumber] = useState<string>(''); // State for order number
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [isSavingBill, setIsSavingBill] = useState(false);
  const [isLoadingSnacks, setIsLoadingSnacks] = useState(true); // Loading state for snacks
  const [searchTerm, setSearchTerm] = useState(""); // State for search term

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset
  } = useForm<SnackFormDataType>({ // Use the base schema type here
    resolver: zodResolver(snackSchema),
    defaultValues: {
      name: "",
      price: "", // Default price as string
      category: "",
    }
  });

  // Function to load snacks
  const loadSnacks = async () => {
    setIsLoadingSnacks(true); // Start loading
    console.log("Attempting to load snacks...");
    try {
      const snacksFromDb = await getSnacks(); // Call the server action
      console.log("Snacks fetched from action:", snacksFromDb);
      setSnacks(snacksFromDb || []); // Update state, ensure it's an array
    } catch (error: any) {
      console.error("Failed to load snacks:", error);
      toast({
        variant: "destructive",
        title: "Failed to load snacks.",
        description: error.message || "Please check your connection and configuration.",
      });
      setSnacks([]); // Set to empty array on error
    } finally {
        setIsLoadingSnacks(false); // Finish loading
        console.log("Finished loading snacks.");
    }
  };


  useEffect(() => {
    loadSnacks();
    setOrderNumber(generateOrderNumber()); // Generate initial order number
  }, []); // Empty dependency array means this runs once on mount

  // Update input string state when number state changes (e.g., reset)
  useEffect(() => {
    // Avoid resetting input if it's currently focused and empty/invalid
    if (document.activeElement?.id !== 'service-charge') {
        setServiceChargeInput(serviceCharge.toString());
    }
  }, [serviceCharge]);


  const calculateTotal = () => {
    const snacksTotal = selectedSnacks.reduce((total, snack) => total + snack.price * snack.quantity, 0);
    // serviceCharge state (number) is used for calculation
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
        // Ensure price is a number when adding to selected snacks
        return [...prevSelected, { ...snack, price: Number(snack.price), quantity: 1 }];
      }
    });
    // Clear search term after selecting a snack
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
    // Price needs to be set as string for the input field
    setValue("price", snack.price.toString());
    setValue("category", snack.category);
  };

  // Use server action for form submission
  const handleFormSubmit = async (formData: FormData) => {
    // setIsSavingBill(true); // Renamed state, maybe use a different state for snack saving?
    try {
      let result;
      if (editingSnackId) {
        result = await updateSnack(editingSnackId, formData);
        setEditingSnackId(null); // Clear editing state on success
      } else {
        result = await addSnack(formData);
      }

      if (result?.success) {
        toast({
          title: result.message,
        });
        await loadSnacks(); // Reload snacks after successful add/update
        reset(); // Reset form after successful submission
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
    } finally {
      // setIsSavingBill(false); // Re-enable button
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
        await loadSnacks(); // Reload snacks after deletion
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
      const currentTotal = calculateTotal(); // Calculate total again to be sure
      if (currentTotal <= 0 || isSavingBill) return; // Don't save if total is 0 or already saving

      setIsSavingBill(true);

      const billData: BillInput = {
          orderNumber: orderNumber,
          items: selectedSnacks.map(s => ({ name: s.name, price: s.price, quantity: s.quantity })),
          serviceCharge: serviceCharge,
          totalAmount: currentTotal, // Use the calculated total
      };

      try {
          const result = await saveBill(billData);
          if (result.success) {
              toast({ title: "Bill saved successfully!" });
              // Reset the form/selection after saving
              setSelectedSnacks([]);
              setServiceCharge(0); // Reset numeric state
              setServiceChargeInput("0"); // Reset input string state
              setOrderNumber(generateOrderNumber()); // Generate a new order number for the next bill
              setSearchTerm(""); // Clear search term

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
    // Use environment variable for password check
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
      setPassword(""); // Clear password field after successful login
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Password.",
      });
    }
  };

  // Handles changes to the service charge input
  const handleServiceChargeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setServiceChargeInput(value); // Update the input string state

    // Allow empty string or valid non-negative decimal numbers (start with digit or .)
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      const parsedValue = parseFloat(value);
      // If empty string or not a valid number, set numeric state to 0
      // Otherwise, use the parsed non-negative value
      setServiceCharge(isNaN(parsedValue) || parsedValue < 0 ? 0 : parsedValue);
    } else {
      // If the input is invalid (e.g., contains letters), reset numeric state to 0
      // but keep the invalid string in the input for user correction
      setServiceCharge(0);
    }
  };

    // Handles blur event for the service charge input
    const handleServiceChargeInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const parsedValue = parseFloat(value);

        // If the input is empty, or invalid, or negative, reset both states to 0
        if (value === "" || isNaN(parsedValue) || parsedValue < 0) {
            setServiceCharge(0);
            setServiceChargeInput("0");
        } else {
            // If valid, ensure the input string matches the numeric state (e.g., remove trailing dot)
            setServiceCharge(parsedValue);
            setServiceChargeInput(parsedValue.toString());
        }
    };

    // Handles focus event for the service charge input
    const handleServiceChargeInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        // If the current value is "0", clear the input field
        if (e.target.value === "0") {
            setServiceChargeInput("");
        }
    };

     // Memoized filtered snacks based on search term
    const filteredSnacks = useMemo(() => {
        if (!searchTerm) {
            return snacks; // Return all snacks if search term is empty
        }
        return snacks.filter(snack =>
            snack.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [snacks, searchTerm]);

    // Handle Enter key press in search bar
    const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault(); // Prevent potential form submission
        if (filteredSnacks.length === 1) {
          handleSnackIncrement(filteredSnacks[0]);
          // handleSnackIncrement already clears the search term
        } else {
          // Optionally clear search term even if no single match
           setSearchTerm("");
        }
      }
    };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
       {/* Header Section */}
      <div className="w-full max-w-md mb-4 flex justify-between items-center">
        <CardTitle className="text-lg">SnackCalc</CardTitle>
        <div className="flex items-center gap-2">
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
          {/* <CardTitle className="text-lg">SnackCalc</CardTitle> Moved title to top */}
          <CardDescription>Select your snacks and see the total cost.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
         {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-snacks"
              type="search"
              placeholder="Search snacks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown} // Add keydown handler
              className="pl-8 w-full h-9"
              aria-label="Search snacks"
            />
          </div>

          {/* Snack Selection */}
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
                      size="sm" // Smaller buttons for selection
                      className="rounded-full px-3 py-1 h-auto" // Adjust padding/height
                      onClick={() => handleSnackIncrement(snack)}
                    >
                      {snack.name}
                    </Button>
                    {getSnackQuantity(snack) > 0 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5"> {/* Smaller badge */}
                        {getSnackQuantity(snack)}
                      </Badge>
                    )}
                  </div>
                ))
             )}
          </div>
          <Separator />
          {/* Selected Snacks */}
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
                          className="h-6 w-6" // Smaller buttons
                          onClick={() => handleSnackDecrement(snack)}
                          disabled={getSnackQuantity(snack) <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Badge variant="outline" className="text-xs px-1.5 border-none"> {/* No border needed */}
                          {snack.quantity}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                           className="h-6 w-6" // Smaller buttons
                          onClick={() => handleSnackIncrement(snack)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {/* Ensure price is displayed correctly */}
                    <span>₹{typeof snack.price === 'number' ? (snack.price * snack.quantity).toFixed(2) : 'N/A'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Service Charge Input */}
          <div className="grid gap-1.5"> {/* Reduced gap */}
            <Label htmlFor="service-charge" className="text-sm">Service Charge</Label>
            <Input
              id="service-charge"
              type="text" // Keep type as text for flexible input
              placeholder="Enter service charge"
              // Bind value to the input string state
              value={serviceChargeInput}
              onChange={handleServiceChargeInputChange}
              onBlur={handleServiceChargeInputBlur} // Format/reset on blur
              onFocus={handleServiceChargeInputFocus} // Clear on focus if "0"
              className="h-9 text-sm" // Smaller input
              inputMode="decimal" // Hint for mobile keyboards
              aria-label="Service Charge"
            />
          </div>
          <Separator />
          {/* Total and Payment */}
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
                     {/* Optional: Display Paytm fallback link - kept for reference if needed */}
                     {/* <a href={paymentInfo.paytmFallback} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline mt-2">
                         Pay via Paytm Link (Fallback)
                     </a> */}
                </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admin Section */}
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
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()} // Login on Enter
                aria-label="Admin Password"
              />
            </div>
            <Button className="mt-4 w-full" onClick={handleAdminLogin}>Login</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Add/Update Snack Form */}
          <Card className="w-full max-w-md mt-4">
            <CardHeader>
              <CardTitle className="text-lg">{editingSnackId ? "Update Snack" : "Add a Snack"}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Use form element and server action */}
              <form action={handleFormSubmit} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" type="text" placeholder="Snack Name" {...register("name")} required/>
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">Price</Label>
                  {/* Ensure price input is type text for better control, validation handles number */}
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

          {/* Manage Snacks List */}
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

    