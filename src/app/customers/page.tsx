
// src/app/customers/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Edit, Loader2, PlusCircle, Search, Users } from "lucide-react";
import { getCustomers, updateCustomer, addCustomer } from "@/app/actions";
import type { Customer, CustomerInput } from "@/lib/db";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const customerSchema = z.object({
  name: z.string().min(1, { message: "Customer name cannot be empty." }),
  phoneNumber: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  address: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
      email: "",
      address: "",
    },
  });

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedCustomers = await getCustomers();
      setAllCustomers(fetchedCustomers);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch customers:", err);
      setError("Failed to load customers. Please try again later.");
      setAllCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenDialog = (mode: 'add' | 'edit', customer?: Customer) => {
    setDialogMode(mode);
    if (mode === 'edit' && customer) {
      setEditingCustomer(customer);
      form.reset({
        name: customer.name,
        phoneNumber: customer.phoneNumber || "",
        email: customer.email || "",
        address: customer.address || "",
      });
    } else {
      setEditingCustomer(null);
      form.reset({
        name: "",
        phoneNumber: "",
        email: "",
        address: "",
      });
    }
  };

  const onSubmit = async (data: CustomerFormData) => {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('phoneNumber', data.phoneNumber || '');
    formData.append('email', data.email || '');
    formData.append('address', data.address || '');

    try {
      let result;
      if (dialogMode === 'edit' && editingCustomer) {
        result = await updateCustomer(editingCustomer.id, formData);
      } else if (dialogMode === 'add') {
        const addResult = await addCustomer(formData);
        result = { success: addResult.success, message: addResult.message };
      } else {
        toast({ variant: "destructive", title: "Error", description: "Invalid dialog mode." });
        setIsSubmitting(false);
        return;
      }

      if (result.success) {
        toast({ title: "Success", description: result.message || (dialogMode === 'add' ? "Customer added successfully!" : "Customer updated successfully!") });
        setDialogMode(null);
        setEditingCustomer(null);
        fetchCustomers(); 
      } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) {
      return allCustomers;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allCustomers.filter(customer =>
      customer.name.toLowerCase().includes(lowerSearchTerm) ||
      (customer.phoneNumber && customer.phoneNumber.toLowerCase().includes(lowerSearchTerm)) ||
      (customer.email && customer.email.toLowerCase().includes(lowerSearchTerm)) ||
      (customer.address && customer.address.toLowerCase().includes(lowerSearchTerm))
    );
  }, [allCustomers, searchTerm]);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-secondary p-4 md:p-8">
      <div className="w-full max-w-5xl mb-4 flex justify-between items-center">
        <Button variant="outline" size="icon" asChild>
          <Link href="/" aria-label="Back to Main Page">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Customer List</h1>
        <Button variant="outline" onClick={() => handleOpenDialog('add')}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Customer
        </Button>
      </div>

      <Card className="w-full max-w-5xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
                <CardTitle>All Customers</CardTitle>
                <CardDescription>Manage your customers. Search, edit, or add new customers.</CardDescription>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search customers by name, phone, email, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-full sm:w-1/2 md:w-1/3 h-9"
              aria-label="Search customers"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground">Loading customers...</p>
          ) : error ? (
            <p className="text-center text-destructive">{error}</p>
          ) : filteredCustomers.length === 0 ? (
            <p className="text-center text-muted-foreground">
              {allCustomers.length === 0 ? "No customers recorded yet. Click 'Add New Customer' to get started." : "No customers match your search criteria."}
            </p>
          ) : (
            <Table>
              <TableCaption>Details of all registered customers.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center w-[10%]">Actions</TableHead>
                  <TableHead className="w-[20%]">Customer Name</TableHead>
                  <TableHead className="w-[15%]">Phone Number</TableHead>
                  <TableHead className="w-[20%]">Email</TableHead>
                  <TableHead className="w-[35%]">Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="text-center space-x-1">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog('edit', customer)} aria-label={`Edit ${customer.name}`}>
                        <Edit className="h-4 w-4 mr-1 sm:mr-0" /> <span className="hidden sm:inline">Edit</span>
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phoneNumber || '-'}</TableCell>
                    <TableCell>{customer.email || '-'}</TableCell>
                    <TableCell className="whitespace-pre-wrap max-w-xs">{customer.address || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => {
          if (!open) {
            setDialogMode(null);
            setEditingCustomer(null); 
            form.reset(); 
          }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'add' ? "Add New Customer" : `Edit Customer: ${editingCustomer?.name || ""}`}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'add' 
                ? "Enter the details for the new customer." 
                : "Update the details for this customer. Click save when you're done."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 max-h-[75vh] overflow-y-auto pr-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Customer's full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., customer@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Customer's full address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="sticky bottom-0 bg-background py-4 border-t">
                <Button type="button" variant="outline" onClick={() => { setDialogMode(null); form.reset(); }}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {dialogMode === 'add' ? "Add Customer" : "Save Changes"}
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

        