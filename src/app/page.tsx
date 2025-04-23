"use client";

import { useState, useEffect } from "react";
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
import { Plus, Minus, Edit, Trash2 } from "lucide-react";
import { QRCodeCanvas } from 'qrcode.react';
import { addSnack, getSnacks, updateSnack, deleteSnack } from "./actions";

interface Snack {
  id: string;
  name: string;
  price: number;
  category: string;
}

const snackSchema = z.object({
  name: z.string().min(3, {
    message: "Name must be at least 3 characters.",
  }),
  price: z.string().refine((value) => !isNaN(parseFloat(value)), {
    message: "Price must be a number.",
  }).transform(value => parseFloat(value)),
  category: z.string().min(3, {
    message: "Category must be at least 3 characters.",
  }),
});

type SnackSchemaType = z.infer<typeof snackSchema>;

interface SelectedSnack extends Snack {
  quantity: number;
}

const generatePaymentLink = (total: number) => {
    const upiLink = `upi://pay?pa=8943145359@ptyes&pn=AMJAD%20K%20M&am=${total}&cu=INR`;
    const paytmFallback = `https://p.paytm.me/xCTH/xyz?amount=${total}`;

    return {
      upiLink,
      paytmFallback,
    };
  };

export default function Home() {
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [selectedSnacks, setSelectedSnacks] = useState<SelectedSnack[]>([]);
  const [editingSnackId, setEditingSnackId] = useState<string | null>(null);
  const [serviceCharge, setServiceCharge] = useState<number>(0); // Added service charge state
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset
  } = useForm<SnackSchemaType>({
    resolver: zodResolver(snackSchema),
  });

  useEffect(() => {
    const loadSnacks = async () => {
      try {
        const snacksFromDb = await getSnacks();
        setSnacks(snacksFromDb);
      } catch (error: any) {
        console.error("Failed to load snacks:", error);
        toast({
          variant: "destructive",
          title: "Failed to load snacks.",
          description: "Please check your internet connection and Firebase configuration.",
        });
        setSnacks([]);
      }
    };

    loadSnacks();
  }, [toast]);

  const calculateTotal = () => {
    const snacksTotal = selectedSnacks.reduce((total, snack) => total + snack.price * snack.quantity, 0);
    return snacksTotal + serviceCharge; // Add service charge to the total
  };

  const handleSnackIncrement = (snack: Snack) => {
    setSelectedSnacks((prevSelected) => {
      const alreadySelected = prevSelected.find((s) => s.id === snack.id);
      if (alreadySelected) {
        return prevSelected.map((s) =>
          s.id === snack.id ? { ...s, quantity: s.quantity + 1 } : s
        );
      } else {
        return [...prevSelected, { ...snack, quantity: 1 }];
      }
    });
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

  const onSubmit = async (data: SnackSchemaType) => {
    try {
      let result;
      if (editingSnackId) {
        result = await updateSnack(editingSnackId, new FormData(document.querySelector('form')!));
        setEditingSnackId(null);
      } else {
        result = await addSnack(new FormData(document.querySelector('form')!));
      }

      if (result?.success) {
        toast({
          title: result.message,
        });
        const snacksFromDb = await getSnacks();
        setSnacks(snacksFromDb);
      } else {
        toast({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
          description: result?.message || "There was a problem adding/updating your snack.",
        });
      }
      reset();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: e.message || "There was a problem adding/updating your snack.",
      });
    }
  };

  const handleDeleteSnack = async (id: string) => {
    try {
      const result = await deleteSnack(id);
      if (result?.success) {
        toast({
          title: result.message,
        });
        const snacksFromDb = await getSnacks();
        setSnacks(snacksFromDb);
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

  const total = calculateTotal();
  const paymentInfo = generatePaymentLink(total);

  const handleAdminLogin = () => {
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setIsAdmin(true);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Password.",
      });
    }
  };


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">SnackCalc</CardTitle>
          <CardDescription>Select your snacks and see the total cost.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {snacks.map((snack) => (
              <div key={snack.id} className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => handleSnackIncrement(snack)}
                >
                  {snack.name}
                </Button>
                {getSnackQuantity(snack) > 0 && (
                  <Badge variant="secondary">{getSnackQuantity(snack)}</Badge>
                )}
              </div>
            ))}
          </div>
          <Separator />
          <div>
            <h3 className="text-sm font-medium">Selected Snacks</h3>
            {selectedSnacks.length === 0 ? (
              <p className="text-muted-foreground">No snacks selected.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {selectedSnacks.map((snack) => (
                  <li key={snack.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span>{snack.name}</span>
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSnackDecrement(snack)}
                          disabled={getSnackQuantity(snack) <= 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Badge variant="secondary">{snack.quantity}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSnackIncrement(snack)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <span>₹{(snack.price * snack.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Add service charge input field */}
          <div className="grid gap-2">
            <Label htmlFor="service-charge">Service Charge</Label>
            <Input
              id="service-charge"
              type="number"
              placeholder="Enter service charge"
              value={serviceCharge.toString()}
              onChange={(e) => setServiceCharge(Number(e.target.value))}
            />
          </div>
          <Separator />
          <div className="flex flex-col items-center justify-between">
            <span className="text-lg font-semibold">Total:</span>
            <Badge variant="secondary" className="text-lg font-semibold">₹{total.toFixed(2)}</Badge>

            {total > 0 && (
                <>
                    <QRCodeCanvas value={paymentInfo.upiLink} size={128} level="H" />
                    <Button asChild>
                      <a href={`${paymentInfo.paytmFallback}`} target="_blank" rel="noopener noreferrer">
                        Pay Now
                      </a>
                    </Button>
                </>
            )}
          </div>
        </CardContent>
      </Card>
      {!isAdmin ? (
        <Card className="w-full max-w-md mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Admin Login</CardTitle>
            <CardDescription>Enter the admin password to manage snacks.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button className="mt-4" onClick={handleAdminLogin}>Login</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="w-full max-w-md mt-4">
            <CardHeader>
              <CardTitle className="text-lg">{editingSnackId ? "Update Snack" : "Add a Snack"}</CardTitle>
              <CardDescription>{editingSnackId ? "Update the snack details." : "Add a new snack to the listing."}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" type="text" placeholder="Snack Name" {...register("name")} />
                  {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" type="text" placeholder="Snack Price" {...register("price")} />
                  {errors.price && <p className="text-sm text-red-500">{errors.price.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" type="text" placeholder="Snack Category" {...register("category")} />
                  {errors.category && <p className="text-sm text-red-500">{errors.category.message}</p>}
                </div>
                <Button type="submit">{editingSnackId ? "Update Snack" : "Add Snack"}</Button>
                {editingSnackId && (
                  <Button variant="ghost" onClick={() => { setEditingSnackId(null); reset(); }}>
                    Cancel Edit
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
          <Card className="w-full max-w-md mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Manage Snacks</CardTitle>
              <CardDescription>Edit or delete existing snacks.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="mt-2 space-y-1">
                {snacks.map((snack) => {
                  const price = typeof snack.price === 'number' ? snack.price.toFixed(2) : 'N/A';
                  return (
                    <li key={snack.id} className="flex items-center justify-between">
                      <span>{snack.name} - ₹{price} - {snack.category}</span>
                      <div className="flex space-x-2">
                        <Button variant="secondary" size="icon" onClick={() => handleEditSnack(snack)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteSnack(snack.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
      <Toaster />
    </div>
  );
}

